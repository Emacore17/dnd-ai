import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("identity persistence stores pseudonymous controls and no raw secrets", async () => {
  const [migration, store] = await Promise.all([
    read("packages/persistence/src/migrations/000003_identity_signup.ts"),
    read("packages/persistence/src/identity-store.ts"),
  ]);
  const manifest = await read("packages/persistence/src/migration-manifest.ts");
  const identityManifest = manifest.slice(
    manifest.indexOf("DATABASE_IDENTITY_USERS_TABLE_SQL"),
  );

  assert.doesNotMatch(store, /SELECT\s+\*/iu);
  assert.doesNotMatch(store, /console\.(?:log|error|warn|info)/u);
  assert.doesNotMatch(store, /idempotency_key\b/iu);
  assert.match(store, /idempotency_key_digest|key_digest/u);
  assert.match(store, /actor_subject_hash/u);
  assert.match(store, /request_fingerprint/u);
  assert.doesNotMatch(store, /password\s*[,)]/iu);
  assert.doesNotMatch(
    `${migration}\n${identityManifest}`,
    /raw_password|verification_code|session_token|idempotency_key\b|ip_address/iu,
  );
  assert.match(manifest, /identity_audit_events_metadata_allowlist/u);
  assert.match(manifest, /identity_rate_limits_subject_hash_sha256/u);
  assert.match(manifest, /identity_idempotency_key_digest_sha256/u);
});

test("identity store exposes only redacted stable errors", async () => {
  const store = await read("packages/persistence/src/identity-store.ts");
  assert.match(store, /IdentityPersistenceError/u);
  assert.match(store, /Identity persistence operation failed\./u);
  assert.match(store, /throw storeUnavailable\(\)/u);
  assert.doesNotMatch(store, /new IdentityPersistenceError\([^)]*error/isu);
});
