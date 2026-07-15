import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readManifest(relativePath) {
  const source = await readFile(
    path.join(repositoryRoot, relativePath),
    "utf8",
  );

  return JSON.parse(source);
}

function declaredDependencies(manifest) {
  return Object.assign(
    {},
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  );
}

test("observability exposes separate browser-safe and Node entry points", async () => {
  const manifest = await readManifest("packages/observability/package.json");

  assert.deepEqual(manifest.exports, {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
    "./node": {
      types: "./dist/node.d.ts",
      import: "./dist/node.js",
    },
  });
  assert.equal(manifest.sideEffects, false);
});

test("observability is a workspace leaf with exact-pinned minimal dependencies", async () => {
  const manifest = await readManifest("packages/observability/package.json");
  const dependencies = declaredDependencies(manifest);

  assert.deepEqual(manifest.dependencies, {
    "@opentelemetry/api": "1.9.1",
    "@opentelemetry/context-async-hooks": "2.9.0",
    "@opentelemetry/core": "2.9.0",
    "@opentelemetry/sdk-trace-base": "2.9.0",
    "@opentelemetry/sdk-trace-node": "2.9.0",
    "@sentry/node": "10.65.0",
    pino: "10.3.1",
  });
  assert.equal(
    Object.values(dependencies).some(
      (version) =>
        typeof version === "string" && version.startsWith("workspace:"),
    ),
    false,
  );
});

test("only runtime composition roots depend on observability", async () => {
  const [api, worker, web] = await Promise.all([
    readManifest("apps/api/package.json"),
    readManifest("apps/worker/package.json"),
    readManifest("apps/web/package.json"),
  ]);

  for (const manifest of [api, worker, web]) {
    assert.equal(
      manifest.dependencies["@dnd-ai/observability"],
      "workspace:*",
      manifest.name,
    );
  }

  assert.equal(web.dependencies["@sentry/nextjs"], "10.65.0");
  assert.equal("@sentry/nextjs" in api.dependencies, false);
  assert.equal("@sentry/nextjs" in worker.dependencies, false);
});

test("manifests exclude automatic instrumentation and remote telemetry add-ons", async () => {
  const manifests = await Promise.all(
    [
      "packages/observability/package.json",
      "apps/api/package.json",
      "apps/worker/package.json",
      "apps/web/package.json",
    ].map(readManifest),
  );
  const dependencyNames = manifests.flatMap((manifest) =>
    Object.keys(declaredDependencies(manifest)),
  );

  for (const dependencyName of dependencyNames) {
    assert.doesNotMatch(
      dependencyName,
      /auto-instrument|replay|profil|exporter.*otlp|otlp.*exporter/iu,
    );
  }
});

test("standalone unit and security scripts build observability before tests", async () => {
  const manifest = await readManifest("package.json");

  for (const scriptName of ["test:unit", "test:security"]) {
    const script = manifest.scripts[scriptName];
    const [buildCommand, testCommand] = script.split(/\s+&&\s+/u);

    assert.match(buildCommand, /^turbo run build\b/u, scriptName);
    assert.match(
      buildCommand,
      /(?:^|\s)--filter=@dnd-ai\/observability(?:\s|$)/u,
      scriptName,
    );
    assert.match(testCommand, /^node --test\b/u, scriptName);
  }
});
