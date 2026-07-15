import assert from "node:assert/strict";
import test from "node:test";

import {
  FEATURE_FLAG_CATALOG,
  evaluateFeatureGate,
  isFeatureFlagKey,
} from "../../packages/persistence/dist/index.js";

const expectedKeys = Object.freeze([
  "campaign.start",
  "turn.new",
  "model.route.premium",
]);

function storeWithState(state) {
  return {
    async readFeatureFlag(key) {
      return { ...state, key };
    },
  };
}

test("feature flag catalog is closed, frozen and defaults to disabled", () => {
  assert.equal(Object.isFrozen(FEATURE_FLAG_CATALOG), true);
  assert.deepEqual(
    FEATURE_FLAG_CATALOG.map(({ key }) => key),
    expectedKeys,
  );

  for (const entry of FEATURE_FLAG_CATALOG) {
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(entry.defaultEnabled, false);
    assert.match(entry.owner, /^[a-z][a-z0-9-]{1,40}$/u);
    assert.equal(isFeatureFlagKey(entry.key), true);
  }

  assert.equal(isFeatureFlagKey("model.route.unreviewed"), false);
  assert.equal(isFeatureFlagKey("__proto__"), false);
});

test("gate evaluation allows an enabled catalog flag from the store", async () => {
  const decision = await evaluateFeatureGate(
    storeWithState({
      defaultEnabled: false,
      enabled: true,
      owner: "platform",
      reasonCode: "maintenance",
      updatedAt: new Date("2026-07-15T12:00:00.000Z"),
      updatedBy: "operator:alice",
      version: 2,
    }),
    "campaign.start",
  );

  assert.deepEqual(decision, {
    enabled: true,
    key: "campaign.start",
    reason: "enabled",
    source: "store",
    version: 2,
  });
  assert.equal(Object.isFrozen(decision), true);
});

test("unknown flags and unavailable stores fail closed without reflecting causes", async () => {
  const unknown = await evaluateFeatureGate(
    storeWithState({
      defaultEnabled: false,
      enabled: true,
      owner: "platform",
      reasonCode: "maintenance",
      updatedAt: new Date("2026-07-15T12:00:00.000Z"),
      updatedBy: "operator:alice",
      version: 2,
    }),
    "model.route.unreviewed",
  );
  assert.deepEqual(unknown, {
    enabled: false,
    key: "model.route.unreviewed",
    reason: "unknown_flag",
    source: "safe_default",
  });

  const unavailable = await evaluateFeatureGate(
    {
      async readFeatureFlag() {
        throw new Error("postgresql://operator:secret@db.internal:5432/dnd_ai");
      },
    },
    "turn.new",
  );

  assert.deepEqual(unavailable, {
    enabled: false,
    key: "turn.new",
    reason: "store_unavailable",
    source: "safe_default",
  });
});

test("malformed store state fails closed", async () => {
  const malformed = await evaluateFeatureGate(
    storeWithState({
      defaultEnabled: true,
      enabled: true,
      owner: "platform",
      reasonCode: "maintenance",
      updatedAt: new Date("2026-07-15T12:00:00.000Z"),
      updatedBy: "operator:alice",
      version: 2,
    }),
    "turn.new",
  );

  assert.deepEqual(malformed, {
    enabled: false,
    key: "turn.new",
    reason: "malformed_store_state",
    source: "safe_default",
  });
});
