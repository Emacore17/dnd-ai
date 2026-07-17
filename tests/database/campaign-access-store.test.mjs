import assert from "node:assert/strict";
import test from "node:test";

import { createActorContext } from "../../packages/domain/dist/index.js";
import {
  CampaignAccessPersistenceError,
  createPostgresCampaignAccessStore,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

import pg from "pg";

const { Client } = pg;
const NOW = new Date("2026-07-17T12:00:00.000Z");
const CREATED_AT = new Date("2026-07-17T10:00:00.000Z");
const LAST_SEEN_AT = new Date("2026-07-17T11:00:00.000Z");
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";
const USER_PENDING = "10000000-0000-4000-8000-000000000003";
const CAMPAIGN_A = "70000000-0000-7000-8000-000000000001";
const CAMPAIGN_B = "70000000-0000-7000-8000-000000000002";
const DELETED_CAMPAIGN = "70000000-0000-7000-8000-000000000003";
const MISSING_CAMPAIGN = "70000000-0000-7000-8000-000000000099";

function digest(character) {
  return character.repeat(64);
}

function actor(userId, ordinal) {
  return createActorContext({
    correlationId: `correlation-campaign-${ordinal}`,
    requestId: `request-campaign-${ordinal}`,
    sessionId: `20000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
    userId,
  });
}

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function seedUser(client, userId, ordinal, status = "active") {
  await client.query(
    `INSERT INTO app.users (
       user_id, canonical_email, delivery_email, display_name,
       status, created_at, activated_at, updated_at
     ) VALUES ($1, $2, $2, $3, $4, $5, $6, $5)`,
    [
      userId,
      `player${ordinal}@example.test`,
      `Player ${ordinal}`,
      status,
      CREATED_AT,
      status === "active" ? CREATED_AT : null,
    ],
  );
}

async function seedSession(
  client,
  { absoluteExpiresAt, idleExpiresAt, ordinal, revokedAt = null, userId },
) {
  await client.query(
    `INSERT INTO app.user_sessions (
       session_id, user_id, token_digest, key_version, created_at,
       last_seen_at, idle_expires_at, absolute_expires_at, revoked_at
     ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8)`,
    [
      `20000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
      userId,
      digest(ordinal.toString(16)),
      CREATED_AT,
      LAST_SEEN_AT,
      idleExpiresAt,
      absoluteExpiresAt,
      revokedAt,
    ],
  );
}

async function seedFixture(databaseUrl) {
  const client = await connect(databaseUrl);
  try {
    await seedUser(client, USER_A, 1);
    await seedUser(client, USER_B, 2);
    await seedUser(client, USER_PENDING, 3, "pending");

    await seedSession(client, {
      absoluteExpiresAt: new Date("2026-07-18T14:00:00.000Z"),
      idleExpiresAt: new Date("2026-07-17T14:00:00.000Z"),
      ordinal: 1,
      userId: USER_A,
    });
    await seedSession(client, {
      absoluteExpiresAt: new Date("2026-07-18T14:00:00.000Z"),
      idleExpiresAt: new Date("2026-07-17T14:00:00.000Z"),
      ordinal: 2,
      userId: USER_B,
    });
    await seedSession(client, {
      absoluteExpiresAt: new Date("2026-07-18T14:00:00.000Z"),
      idleExpiresAt: new Date("2026-07-17T14:00:00.000Z"),
      ordinal: 3,
      revokedAt: NOW,
      userId: USER_A,
    });
    await seedSession(client, {
      absoluteExpiresAt: new Date("2026-07-17T14:00:00.000Z"),
      idleExpiresAt: new Date("2026-07-17T11:30:00.000Z"),
      ordinal: 4,
      userId: USER_A,
    });
    await seedSession(client, {
      absoluteExpiresAt: new Date("2026-07-17T11:45:00.000Z"),
      idleExpiresAt: new Date("2026-07-17T11:30:00.000Z"),
      ordinal: 5,
      userId: USER_A,
    });
    await seedSession(client, {
      absoluteExpiresAt: new Date("2026-07-18T14:00:00.000Z"),
      idleExpiresAt: new Date("2026-07-17T14:00:00.000Z"),
      ordinal: 6,
      userId: USER_PENDING,
    });

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

async function readSessionSnapshot(databaseUrl, tokenDigest) {
  const client = await connect(databaseUrl);
  try {
    const result = await client.query(
      `SELECT last_seen_at, idle_expires_at, absolute_expires_at
         FROM app.user_sessions
        WHERE token_digest = $1`,
      [tokenDigest],
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
}

function assertInvalidInput(operation) {
  return assert.rejects(operation, (error) => {
    assert.equal(error instanceof CampaignAccessPersistenceError, true);
    assert.equal(error.code, "INVALID_INPUT");
    assert.equal(
      error.message,
      "Campaign access persistence input is invalid.",
    );
    assert.doesNotMatch(error.message, /70000000|10000000|[0-9a-f]{64}/u);
    return true;
  });
}

test(
  "campaign access store resolves active sessions without mutating their lifecycle",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      await seedFixture(databaseUrl);
      const store = createPostgresCampaignAccessStore({ databaseUrl });

      try {
        const before = await readSessionSnapshot(databaseUrl, digest("1"));
        const active = await store.resolveActiveSession(digest("1"), NOW);
        assert.deepEqual(active, {
          sessionId: "20000000-0000-4000-8000-000000000001",
          userId: USER_A,
        });
        assert.equal(Object.isFrozen(active), true);
        assert.deepEqual(
          await readSessionSnapshot(databaseUrl, digest("1")),
          before,
        );

        for (const tokenDigest of [
          digest("0"),
          digest("3"),
          digest("4"),
          digest("5"),
          digest("6"),
        ]) {
          assert.equal(
            await store.resolveActiveSession(tokenDigest, NOW),
            null,
          );
        }

        await assertInvalidInput(() =>
          store.resolveActiveSession("raw-session-token", NOW),
        );
        await assertInvalidInput(() =>
          store.resolveActiveSession(digest("1"), new Date("invalid")),
        );
      } finally {
        await Promise.all([store.close(), store.close()]);
      }
    });
  },
);

test(
  "campaign access store enforces ownership and soft-delete in the lookup query",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });
      await seedFixture(databaseUrl);
      const store = createPostgresCampaignAccessStore({ databaseUrl });
      const actorA = actor(USER_A, 1);
      const actorB = actor(USER_B, 2);

      try {
        for (const [currentActor, campaignId, expectedTitle] of [
          [actorA, CAMPAIGN_A, "Campagna A"],
          [actorA, CAMPAIGN_B, null],
          [actorB, CAMPAIGN_A, null],
          [actorB, CAMPAIGN_B, "Campagna B"],
          [actorA, MISSING_CAMPAIGN, null],
          [actorA, DELETED_CAMPAIGN, null],
        ]) {
          const found = await store.findOwnedCampaign(currentActor, campaignId);
          assert.equal(found?.title ?? null, expectedTitle);
          if (found) assert.equal(Object.isFrozen(found), true);
        }

        assert.deepEqual(await store.findOwnedCampaign(actorA, CAMPAIGN_A), {
          id: CAMPAIGN_A,
          stateVersion: 7,
          status: "active",
          title: "Campagna A",
          updatedAt: NOW,
        });

        await assertInvalidInput(() =>
          store.findOwnedCampaign(actorA, "not-a-campaign-id"),
        );
        await assertInvalidInput(() =>
          store.findOwnedCampaign(
            { ...actorA, userId: "not-a-user-id" },
            CAMPAIGN_A,
          ),
        );
      } finally {
        await Promise.all([store.close(), store.close()]);
      }
    });
  },
);
