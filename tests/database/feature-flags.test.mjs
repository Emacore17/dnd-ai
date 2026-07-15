import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import pg from "pg";

import {
  FeatureFlagError,
  createPostgresFeatureFlagStore,
  evaluateFeatureGate,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const featureFlagCliPath = path.join(
  repositoryRoot,
  "scripts",
  "manage-feature-flag.mjs",
);

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

function command(overrides = {}) {
  return {
    actorId: "operator:alice",
    correlationId: "corr-feature-flags-0001",
    enabled: true,
    expectedVersion: 0,
    idempotencyKey: "idem-feature-flags-0001",
    key: "campaign.start",
    reasonCode: "maintenance",
    ...overrides,
  };
}

function assertFeatureFlagError(error, code) {
  assert.equal(error instanceof FeatureFlagError, true);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//iu);
  assert.doesNotMatch(error.message, /secret|password/iu);
  return true;
}

function runFeatureFlagCli(arguments_, databaseUrl) {
  return spawnSync(process.execPath, [featureFlagCliPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      APP_ENV: "local",
      MIGRATION_DATABASE_URL: databaseUrl,
    },
    timeout: 30_000,
    windowsHide: true,
  });
}

function assertSuccessfulCli(result, expectedOutput, databaseUrl) {
  const password = new URL(databaseUrl).password;

  assert.equal(result.status, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, expectedOutput);
  assert.doesNotMatch(result.stdout, new RegExp(password, "u"));
  assert.doesNotMatch(result.stdout, new RegExp(databaseUrl, "u"));
}

test(
  "PostgreSQL feature flag store gates, audits, retries and rolls back safely",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });

      const store = createPostgresFeatureFlagStore({ databaseUrl });
      const client = await connect(databaseUrl);

      try {
        const initial = await store.readFeatureFlag("campaign.start");
        assert.deepEqual(
          {
            defaultEnabled: initial.defaultEnabled,
            enabled: initial.enabled,
            key: initial.key,
            owner: initial.owner,
            reasonCode: initial.reasonCode,
            updatedBy: initial.updatedBy,
            version: initial.version,
          },
          {
            defaultEnabled: false,
            enabled: false,
            key: "campaign.start",
            owner: "platform",
            reasonCode: "operator_request",
            updatedBy: "system:migration",
            version: 0,
          },
        );
        assert.equal(initial.updatedAt instanceof Date, true);

        assert.deepEqual(await evaluateFeatureGate(store, "campaign.start"), {
          enabled: false,
          key: "campaign.start",
          reason: "disabled",
          source: "store",
          version: 0,
        });

        const enabled = await store.changeFeatureFlag(command());
        assert.equal(enabled.auditEventId, 1);
        assert.equal(enabled.idempotentReplay, false);
        assert.equal(enabled.state.enabled, true);
        assert.equal(enabled.state.version, 1);

        const audit = await client.query(
          `SELECT flag_key,
                  idempotency_key,
                  previous_version,
                  resulting_version,
                  enabled,
                  actor_id,
                  reason_code,
                  correlation_id
             FROM app.feature_flag_events
            ORDER BY event_id`,
        );
        assert.deepEqual(audit.rows, [
          {
            actor_id: "operator:alice",
            correlation_id: "corr-feature-flags-0001",
            enabled: true,
            flag_key: "campaign.start",
            idempotency_key: "idem-feature-flags-0001",
            previous_version: "0",
            reason_code: "maintenance",
            resulting_version: "1",
          },
        ]);

        const replay = await store.changeFeatureFlag(command());
        assert.equal(replay.auditEventId, enabled.auditEventId);
        assert.equal(replay.idempotentReplay, true);
        assert.equal(replay.state.version, 1);
        const auditCount = await client.query(
          "SELECT count(*)::integer AS count FROM app.feature_flag_events",
        );
        assert.equal(auditCount.rows[0].count, 1);

        await assert.rejects(
          store.changeFeatureFlag(command({ enabled: false })),
          (error) => assertFeatureFlagError(error, "IDEMPOTENCY_CONFLICT"),
        );

        await assert.rejects(
          store.changeFeatureFlag(
            command({
              expectedVersion: 0,
              idempotencyKey: "idem-feature-flags-0002",
            }),
          ),
          (error) => assertFeatureFlagError(error, "VERSION_CONFLICT"),
        );

        const disabled = await store.changeFeatureFlag(
          command({
            enabled: false,
            expectedVersion: 1,
            idempotencyKey: "idem-feature-flags-0004",
          }),
        );
        assert.equal(disabled.auditEventId, 2);
        assert.equal(disabled.idempotentReplay, false);
        assert.equal(disabled.state.enabled, false);
        assert.equal(disabled.state.version, 2);

        const replayAfterLaterChange = await store.changeFeatureFlag(command());
        assert.equal(replayAfterLaterChange.auditEventId, enabled.auditEventId);
        assert.equal(replayAfterLaterChange.idempotentReplay, true);
        assert.equal(replayAfterLaterChange.state.enabled, true);
        assert.equal(replayAfterLaterChange.state.version, 1);

        const currentAfterReplay =
          await store.readFeatureFlag("campaign.start");
        assert.equal(currentAfterReplay.enabled, false);
        assert.equal(currentAfterReplay.version, 2);

        await client.query(
          "ALTER TABLE app.feature_flag_events ADD CONSTRAINT feature_flag_events_block_insert CHECK (false) NOT VALID",
        );
        try {
          await assert.rejects(
            store.changeFeatureFlag(
              command({
                idempotencyKey: "idem-feature-flags-0003",
                key: "turn.new",
              }),
            ),
            (error) => assertFeatureFlagError(error, "STORE_UNAVAILABLE"),
          );
        } finally {
          await client.query(
            "ALTER TABLE app.feature_flag_events DROP CONSTRAINT feature_flag_events_block_insert",
          );
        }

        const unchanged = await store.readFeatureFlag("turn.new");
        assert.equal(unchanged.enabled, false);
        assert.equal(unchanged.version, 0);
      } finally {
        await client.end();
        await store.close();
      }
    });
  },
);

test(
  "feature flag CLI reads and changes a kill switch without deploy",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      await runDatabaseMigrations({ databaseUrl, direction: "up" });

      assertSuccessfulCli(
        runFeatureFlagCli(["status", "turn.new"], databaseUrl),
        "Feature flag status: key=turn.new; enabled=false; version=0\n",
        databaseUrl,
      );

      assertSuccessfulCli(
        runFeatureFlagCli(
          [
            "set",
            "turn.new",
            "--enable",
            "--actor",
            "operator:alice",
            "--reason",
            "maintenance",
            "--idempotency-key",
            "idem-feature-cli-0001",
            "--correlation-id",
            "corr-feature-cli-0001",
            "--expected-version",
            "0",
          ],
          databaseUrl,
        ),
        "Feature flag set: key=turn.new; enabled=true; version=1; auditEventId=1; replay=false\n",
        databaseUrl,
      );

      assertSuccessfulCli(
        runFeatureFlagCli(["status", "turn.new"], databaseUrl),
        "Feature flag status: key=turn.new; enabled=true; version=1\n",
        databaseUrl,
      );
    });
  },
);
