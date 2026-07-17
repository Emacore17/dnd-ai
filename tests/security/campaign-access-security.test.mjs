import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  CampaignAccessError,
  createApiApp,
  createCampaignAccessService,
} from "../../apps/api/dist/index.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const REQUEST_ID = "40000000-0000-4000-8000-000000000001";
const TOKEN = "_".repeat(42) + "8";
const COOKIE = `__Host-dnd_ai_session=${TOKEN}`;
const FOREIGN_CAMPAIGN = "7ca00000-0000-7000-8000-000000000001";
const MISSING_CAMPAIGN = "7ca00000-0000-7000-8000-000000000002";
const DELETED_CAMPAIGN = "7ca00000-0000-7000-8000-000000000003";
const CANARY_USER = "1ca00000-0000-4000-8000-000000000001";

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function headers() {
  return { cookie: COOKIE, "x-request-id": REQUEST_ID };
}

function createNotFoundHarness() {
  const actor = Object.freeze({
    correlationId: REQUEST_ID,
    requestId: REQUEST_ID,
    sessionId: "20000000-0000-4000-8000-000000000001",
    userId: CANARY_USER,
  });
  const service = {
    async authenticate() {
      return actor;
    },
    async getCampaign() {
      throw new CampaignAccessError("NOT_FOUND");
    },
  };
  return createApiApp({ logger: false }, { campaign: { service } });
}

test("player campaign surfaces cannot bypass ActorContext", async () => {
  const [store, routes, runtime, app] = await Promise.all([
    read("packages/persistence/src/campaign-access-store.ts"),
    read("apps/api/src/campaign/routes.ts"),
    read("apps/api/src/runtime.ts"),
    read("apps/api/src/app.ts"),
  ]);

  assert.match(store, /c\.user_id = \$2/u);
  assert.match(store, /c\.deleted_at IS NULL/u);
  assert.doesNotMatch(store, /SELECT\s+\*/iu);
  assert.doesNotMatch(store, /findById|skipOwnership|bypassTenant/iu);
  assert.doesNotMatch(routes, /x-user-id|x-actor-id|x-dnd-ai-client-subject/iu);
  assert.doesNotMatch(
    `${runtime}\n${app}`,
    /__test\/campaigns|createCampaignSseAuthorizationPreHandler/u,
  );
});

test("foreign, missing and deleted campaigns have one redacted not-found response", async (context) => {
  const app = createNotFoundHarness();
  context.after(() => app.close());
  const responses = [];

  for (const campaignId of [
    FOREIGN_CAMPAIGN,
    MISSING_CAMPAIGN,
    DELETED_CAMPAIGN,
  ]) {
    const response = await app.inject({
      headers: headers(),
      method: "GET",
      url: `/api/campaigns/${campaignId}`,
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["cache-control"], "private, no-store");
    responses.push({ body: response.json(), headers: response.headers });
  }

  assert.deepEqual(responses[0].body, responses[1].body);
  assert.deepEqual(responses[1].body, responses[2].body);
  for (const response of responses) {
    const exposed = JSON.stringify(response);
    assert.doesNotMatch(exposed, new RegExp(CANARY_USER, "u"));
    assert.doesNotMatch(
      exposed,
      new RegExp(
        [FOREIGN_CAMPAIGN, MISSING_CAMPAIGN, DELETED_CAMPAIGN].join("|"),
        "u",
      ),
    );
  }
});

test("campaign storage failures are 503 and never tenant-sensitive 404", async (context) => {
  const service = {
    async authenticate() {
      return Object.freeze({
        correlationId: REQUEST_ID,
        requestId: REQUEST_ID,
        sessionId: "20000000-0000-4000-8000-000000000001",
        userId: CANARY_USER,
      });
    },
    async getCampaign() {
      throw new CampaignAccessError("UNAVAILABLE");
    },
  };
  const app = createApiApp({ logger: false }, { campaign: { service } });
  context.after(() => app.close());

  const response = await app.inject({
    headers: headers(),
    method: "GET",
    url: `/api/campaigns/${FOREIGN_CAMPAIGN}`,
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "campaign.unavailable");
  assert.equal(response.json().error.retryable, true);
  assert.doesNotMatch(response.body, new RegExp(CANARY_USER, "u"));
  assert.doesNotMatch(response.body, new RegExp(FOREIGN_CAMPAIGN, "u"));
});

test("a denied session prevents every campaign repository lookup", async (context) => {
  let campaignLookups = 0;
  const service = createCampaignAccessService({
    campaignReader: {
      async findOwnedCampaign() {
        campaignLookups += 1;
        return null;
      },
    },
    clock: { now: () => new Date("2026-07-17T12:00:00.000Z") },
    cryptography: { sessionTokenDigest: () => "a".repeat(64) },
    sessionReader: { resolveActiveSession: async () => null },
  });
  const app = createApiApp({ logger: false }, { campaign: { service } });
  context.after(() => app.close());

  const response = await app.inject({
    headers: headers(),
    method: "GET",
    url: `/api/campaigns/${FOREIGN_CAMPAIGN}`,
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "identity.session_invalid");
  assert.equal(campaignLookups, 0);
});
