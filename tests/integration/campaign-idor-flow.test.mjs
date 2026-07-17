import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  createApiApp,
  createCampaignAccessService,
  createCampaignSseAuthorizationPreHandler,
  createNodeIdentityCryptography,
} from "../../apps/api/dist/index.js";
import {
  createPostgresCampaignAccessStore,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const NOW = new Date("2026-07-17T12:00:00.000Z");
const CREATED_AT = new Date("2026-07-17T10:00:00.000Z");
const REQUEST_ID = "40000000-0000-4000-8000-000000000001";
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";
const SESSION_A = "20000000-0000-4000-8000-000000000001";
const SESSION_B = "20000000-0000-4000-8000-000000000002";
const SESSION_REVOKED = "20000000-0000-4000-8000-000000000003";
const CAMPAIGN_A = "70000000-0000-7000-8000-000000000001";
const CAMPAIGN_B = "70000000-0000-7000-8000-000000000002";
const DELETED_CAMPAIGN = "70000000-0000-7000-8000-000000000003";
const MISSING_CAMPAIGN = "70000000-0000-7000-8000-000000000099";

function key(seed) {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);
}

const cryptography = createNodeIdentityCryptography({
  challengeKey: key(1),
  challengeKeyVersion: 7,
  randomBytes: (length) => new Uint8Array(length),
  resetChallengeKey: key(33),
  resetChallengeKeyVersion: 11,
  sessionKey: key(65),
  sessionKeyVersion: 9,
  subjectHashKey: key(97),
});

function sessionToken(sessionId) {
  return cryptography.deriveSessionToken(sessionId, 9);
}

const TOKEN_A = sessionToken(SESSION_A);
const TOKEN_B = sessionToken(SESSION_B);
const TOKEN_REVOKED = sessionToken(SESSION_REVOKED);

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function seedUser(client, userId, ordinal) {
  await client.query(
    `INSERT INTO app.users (
       user_id, canonical_email, delivery_email, display_name,
       status, created_at, activated_at, updated_at
     ) VALUES ($1, $2, $2, $3, 'active', $4, $4, $4)`,
    [userId, `player${ordinal}@example.test`, `Player ${ordinal}`, CREATED_AT],
  );
}

async function seedSession(client, sessionId, userId, token, revokedAt = null) {
  await client.query(
    `INSERT INTO app.user_sessions (
       session_id, user_id, token_digest, key_version, created_at,
       last_seen_at, idle_expires_at, absolute_expires_at, revoked_at
     ) VALUES ($1, $2, $3, 9, $4, $4, $5, $6, $7)`,
    [
      sessionId,
      userId,
      cryptography.sessionTokenDigest(token),
      CREATED_AT,
      new Date("2026-07-17T14:00:00.000Z"),
      new Date("2026-07-18T14:00:00.000Z"),
      revokedAt,
    ],
  );
}

async function seedFixture(databaseUrl) {
  const client = await connect(databaseUrl);
  try {
    await seedUser(client, USER_A, 1);
    await seedUser(client, USER_B, 2);
    await seedSession(client, SESSION_A, USER_A, TOKEN_A);
    await seedSession(client, SESSION_B, USER_B, TOKEN_B);
    await seedSession(client, SESSION_REVOKED, USER_A, TOKEN_REVOKED, NOW);
    await client.query(
      `INSERT INTO app.campaigns (
         campaign_id, user_id, title, status, state_version,
         created_at, updated_at, deleted_at
       ) VALUES
         ($1, $4, 'Campagna A', 'active', 7, $6, $7, NULL),
         ($2, $5, 'Campagna B', 'ready', 3, $6, $7, NULL),
         ($3, $4, 'Campagna eliminata', 'abandoned', 9, $6, $7, $7)`,
      [
        CAMPAIGN_A,
        CAMPAIGN_B,
        DELETED_CAMPAIGN,
        USER_A,
        USER_B,
        CREATED_AT,
        NOW,
      ],
    );
  } finally {
    await client.end();
  }
}

function requestHeaders(token) {
  return {
    ...(token === null ? {} : { cookie: `__Host-dnd_ai_session=${token}` }),
    "x-correlation-id": "correlation-campaign-idor-0001",
    "x-request-id": REQUEST_ID,
  };
}

function assertDeniedBeforeStream(response, statusCode, errorCode) {
  assert.equal(response.statusCode, statusCode);
  assert.equal(response.json().error.code, errorCode);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.notEqual(
    response.headers["content-type"],
    "text/event-stream; charset=utf-8",
  );
  assert.doesNotMatch(response.body, /access\.granted/u);
}

async function getCampaign(app, token, campaignId) {
  return app.inject({
    headers: requestHeaders(token),
    method: "GET",
    url: `/api/campaigns/${campaignId}`,
  });
}

async function streamCampaign(app, token, campaignId) {
  return app.inject({
    headers: requestHeaders(token),
    method: "GET",
    url: `/__test/campaigns/${campaignId}/stream`,
  });
}

test(
  "real PostgreSQL ownership protects both HTTP and the unregistered SSE boundary",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      await seedFixture(databaseUrl);
      const store = createPostgresCampaignAccessStore({ databaseUrl });
      const service = createCampaignAccessService({
        campaignReader: store,
        clock: { now: () => new Date(NOW) },
        cryptography,
        sessionReader: store,
      });
      const app = createApiApp({ logger: false }, { campaign: { service } });
      app.get(
        "/__test/campaigns/:campaignId/stream",
        {
          preHandler: createCampaignSseAuthorizationPreHandler({ service }),
        },
        async (_request, reply) => {
          reply.hijack();
          reply.raw.writeHead(200, {
            "cache-control": "private, no-store",
            "content-type": "text/event-stream; charset=utf-8",
          });
          reply.raw.end("event: access.granted\ndata: {}\n\n");
        },
      );

      try {
        for (const [token, campaignId, title] of [
          [TOKEN_A, CAMPAIGN_A, "Campagna A"],
          [TOKEN_B, CAMPAIGN_B, "Campagna B"],
        ]) {
          const http = await getCampaign(app, token, campaignId);
          assert.equal(http.statusCode, 200);
          assert.equal(http.json().title, title);

          const sse = await streamCampaign(app, token, campaignId);
          assert.equal(sse.statusCode, 200);
          assert.equal(
            sse.headers["content-type"],
            "text/event-stream; charset=utf-8",
          );
          assert.match(sse.body, /event: access\.granted/u);
        }

        for (const [token, campaignId] of [
          [TOKEN_A, CAMPAIGN_B],
          [TOKEN_B, CAMPAIGN_A],
        ]) {
          assertDeniedBeforeStream(
            await getCampaign(app, token, campaignId),
            404,
            "campaign.not_found",
          );
          assertDeniedBeforeStream(
            await streamCampaign(app, token, campaignId),
            404,
            "campaign.not_found",
          );
        }

        const httpNotFound = [];
        const sseNotFound = [];
        for (const campaignId of [
          CAMPAIGN_B,
          MISSING_CAMPAIGN,
          DELETED_CAMPAIGN,
        ]) {
          const http = await getCampaign(app, TOKEN_A, campaignId);
          const sse = await streamCampaign(app, TOKEN_A, campaignId);
          assertDeniedBeforeStream(http, 404, "campaign.not_found");
          assertDeniedBeforeStream(sse, 404, "campaign.not_found");
          httpNotFound.push(http.json());
          sseNotFound.push(sse.json());
        }
        assert.deepEqual(httpNotFound[0], httpNotFound[1]);
        assert.deepEqual(httpNotFound[1], httpNotFound[2]);
        assert.deepEqual(sseNotFound[0], sseNotFound[1]);
        assert.deepEqual(sseNotFound[1], sseNotFound[2]);
        assert.deepEqual(httpNotFound[0], sseNotFound[0]);

        for (const token of [null, TOKEN_REVOKED]) {
          assertDeniedBeforeStream(
            await getCampaign(app, token, CAMPAIGN_A),
            401,
            "identity.session_invalid",
          );
          assertDeniedBeforeStream(
            await streamCampaign(app, token, CAMPAIGN_A),
            401,
            "identity.session_invalid",
          );
        }
      } finally {
        await Promise.all([app.close(), store.close()]);
      }
    });
  },
);
