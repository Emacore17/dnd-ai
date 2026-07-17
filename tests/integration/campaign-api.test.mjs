import assert from "node:assert/strict";
import test from "node:test";

import {
  CampaignAccessError,
  createApiApp,
} from "../../apps/api/dist/index.js";

const REQUEST_ID = "40000000-0000-4000-8000-000000000001";
const TOKEN = "_".repeat(42) + "8";
const COOKIE = `__Host-dnd_ai_session=${TOKEN}`;
const CAMPAIGN_A = "70000000-0000-7000-8000-000000000001";
const CAMPAIGN_B = "70000000-0000-7000-8000-000000000002";
const MISSING_CAMPAIGN = "70000000-0000-7000-8000-000000000099";
const ACTOR = Object.freeze({
  correlationId: "correlation-campaign-0001",
  requestId: REQUEST_ID,
  sessionId: "20000000-0000-4000-8000-000000000001",
  userId: "10000000-0000-4000-8000-000000000001",
});
const SAFE_DETAIL = Object.freeze({
  id: CAMPAIGN_A,
  stateVersion: 7,
  status: "active",
  title: "La città sommersa",
  updatedAt: "2026-07-17T12:00:00.000Z",
});

function createHarness(overrides = {}) {
  const calls = [];
  const service = {
    async authenticate(sessionToken, metadata) {
      calls.push({ metadata, operation: "authenticate", sessionToken });
      if (sessionToken === null)
        throw new CampaignAccessError("SESSION_INVALID");
      return { ...ACTOR, ...metadata };
    },
    async getCampaign(actor, campaignId) {
      calls.push({ actor, campaignId, operation: "campaign" });
      if (campaignId !== CAMPAIGN_A) throw new CampaignAccessError("NOT_FOUND");
      return { ...SAFE_DETAIL, updatedAt: new Date(SAFE_DETAIL.updatedAt) };
    },
    ...overrides.service,
  };
  const app = createApiApp({ logger: false }, { campaign: { service } });
  return { app, calls };
}

function headers(overrides = {}) {
  return {
    cookie: COOKIE,
    "x-correlation-id": "correlation-campaign-0001",
    "x-request-id": REQUEST_ID,
    ...overrides,
  };
}

test("campaign API returns the safe owner projection and stable not-found envelope", async (context) => {
  const { app, calls } = createHarness();
  context.after(() => app.close());

  const owned = await app.inject({
    headers: headers(),
    method: "GET",
    url: `/api/campaigns/${CAMPAIGN_A}`,
  });
  assert.equal(owned.statusCode, 200);
  assert.deepEqual(owned.json(), SAFE_DETAIL);
  assert.equal(owned.headers["cache-control"], "private, no-store");
  assert.equal(owned.headers["x-request-id"], REQUEST_ID);
  assert.deepEqual(calls[0], {
    metadata: {
      correlationId: "correlation-campaign-0001",
      requestId: REQUEST_ID,
    },
    operation: "authenticate",
    sessionToken: TOKEN,
  });

  const notFound = [];
  for (const campaignId of [CAMPAIGN_B, MISSING_CAMPAIGN]) {
    const response = await app.inject({
      headers: headers(),
      method: "GET",
      url: `/api/campaigns/${campaignId}`,
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["cache-control"], "private, no-store");
    notFound.push(response.json());
  }
  assert.deepEqual(notFound[0], notFound[1]);
  assert.deepEqual(notFound[0], {
    error: {
      code: "campaign.not_found",
      message: "Campagna non trovata.",
      requestId: REQUEST_ID,
      retryable: false,
    },
  });
});

test("campaign API rejects invalid input and sessions before returning campaign data", async (context) => {
  const { app, calls } = createHarness();
  context.after(() => app.close());

  const invalid = await app.inject({
    headers: headers(),
    method: "GET",
    url: "/api/campaigns/not-a-uuid",
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, "campaign.request_invalid");
  assert.equal(calls.length, 0);

  const unauthenticatedHeaders = headers();
  delete unauthenticatedHeaders.cookie;
  const unauthenticated = await app.inject({
    headers: unauthenticatedHeaders,
    method: "GET",
    url: `/api/campaigns/${CAMPAIGN_A}`,
  });
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.json().error.code, "identity.session_invalid");
  assert.equal(calls.at(-1).operation, "authenticate");
  assert.equal(calls.at(-1).sessionToken, null);
});

test("campaign API maps storage failures to retryable unavailable", async (context) => {
  const { app } = createHarness({
    service: {
      getCampaign() {
        throw new CampaignAccessError("UNAVAILABLE");
      },
    },
  });
  context.after(() => app.close());

  const response = await app.inject({
    headers: headers(),
    method: "GET",
    url: `/api/campaigns/${CAMPAIGN_A}`,
  });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    error: {
      code: "campaign.unavailable",
      message: "Servizio temporaneamente non disponibile.",
      requestId: REQUEST_ID,
      retryable: true,
    },
  });
  assert.equal(response.headers["cache-control"], "private, no-store");
});
