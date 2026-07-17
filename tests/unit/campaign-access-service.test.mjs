import assert from "node:assert/strict";
import test from "node:test";

import {
  CampaignAccessError,
  createCampaignAccessService,
} from "../../apps/api/dist/index.js";

const NOW = new Date("2026-07-17T12:00:00.000Z");
const TOKEN = "_".repeat(42) + "8";
const TOKEN_DIGEST = "a".repeat(64);
const SESSION_ID = "20000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000001";
const CAMPAIGN_ID = "70000000-0000-7000-8000-000000000001";
const METADATA = Object.freeze({
  correlationId: "correlation-campaign-0001",
  requestId: "40000000-0000-4000-8000-000000000001",
});
const CAMPAIGN = Object.freeze({
  id: CAMPAIGN_ID,
  stateVersion: 7,
  status: "active",
  title: "La città sommersa",
  updatedAt: NOW,
});

function createHarness(overrides = {}) {
  const calls = [];
  const cryptography = {
    sessionTokenDigest(token) {
      calls.push({ operation: "digest", token });
      return TOKEN_DIGEST;
    },
    ...overrides.cryptography,
  };
  const sessionReader = {
    async resolveActiveSession(tokenDigest, occurredAt) {
      calls.push({ occurredAt, operation: "session", tokenDigest });
      return { sessionId: SESSION_ID, userId: USER_ID };
    },
    ...overrides.sessionReader,
  };
  const campaignReader = {
    async findOwnedCampaign(actor, campaignId) {
      calls.push({ actor, campaignId, operation: "campaign" });
      return CAMPAIGN;
    },
    ...overrides.campaignReader,
  };
  const service = createCampaignAccessService({
    campaignReader,
    clock: { now: () => new Date(NOW) },
    cryptography,
    sessionReader,
  });
  return { calls, service };
}

async function expectAccessError(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error instanceof CampaignAccessError, true);
    assert.equal(error.code, code);
    assert.equal(error.message, "Campaign access failed.");
    return true;
  });
}

test("campaign access service resolves an immutable ActorContext before owner lookup", async () => {
  const { calls, service } = createHarness();

  const actor = await service.authenticate(TOKEN, METADATA);
  assert.deepEqual(actor, {
    ...METADATA,
    sessionId: SESSION_ID,
    userId: USER_ID,
  });
  assert.equal(Object.isFrozen(actor), true);
  assert.deepEqual(await service.getCampaign(actor, CAMPAIGN_ID), CAMPAIGN);
  assert.equal(calls[0].token, TOKEN);
  assert.equal(calls[1].tokenDigest, TOKEN_DIGEST);
  assert.equal(calls[1].occurredAt.valueOf(), NOW.valueOf());
  assert.equal(calls[2].actor, actor);
  assert.equal(calls[2].campaignId, CAMPAIGN_ID);
});

test("campaign access service distinguishes invalid sessions from unavailable storage", async () => {
  const absent = createHarness();
  await expectAccessError(
    () => absent.service.authenticate(null, METADATA),
    "SESSION_INVALID",
  );
  assert.deepEqual(absent.calls, []);

  const malformed = createHarness({
    cryptography: {
      sessionTokenDigest() {
        throw new TypeError("invalid token");
      },
    },
  });
  await expectAccessError(
    () => malformed.service.authenticate("not-a-token", METADATA),
    "SESSION_INVALID",
  );

  const unknown = createHarness({
    sessionReader: { resolveActiveSession: async () => null },
  });
  await expectAccessError(
    () => unknown.service.authenticate(TOKEN, METADATA),
    "SESSION_INVALID",
  );

  const sessionFailure = createHarness({
    sessionReader: {
      resolveActiveSession() {
        throw new Error("database canary");
      },
    },
  });
  await expectAccessError(
    () => sessionFailure.service.authenticate(TOKEN, METADATA),
    "UNAVAILABLE",
  );
});

test("campaign access service maps absent campaigns separately from repository failures", async () => {
  const absent = createHarness({
    campaignReader: { findOwnedCampaign: async () => null },
  });
  const actor = await absent.service.authenticate(TOKEN, METADATA);
  await expectAccessError(
    () => absent.service.getCampaign(actor, CAMPAIGN_ID),
    "NOT_FOUND",
  );

  const failure = createHarness({
    campaignReader: {
      findOwnedCampaign() {
        throw new Error("database canary");
      },
    },
  });
  const failureActor = await failure.service.authenticate(TOKEN, METADATA);
  await expectAccessError(
    () => failure.service.getCampaign(failureActor, CAMPAIGN_ID),
    "UNAVAILABLE",
  );
});
