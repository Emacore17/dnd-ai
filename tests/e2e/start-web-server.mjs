import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

import { assertOwnedPathChain } from "../../scripts/lib/owned-path-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const expectedServerRelativePath =
  "apps/web/.next/standalone/apps/web/server.js";

if (process.env.BROWSER_STANDALONE_SERVER_PATH !== expectedServerRelativePath) {
  throw new Error("browser-harness: invalid-standalone-server");
}

const sourceStatic = path.join(
  repositoryRoot,
  "apps",
  "web",
  ".next",
  "static",
);
const destinationStatic = path.join(
  repositoryRoot,
  "apps",
  "web",
  ".next",
  "standalone",
  "apps",
  "web",
  ".next",
  "static",
);
const serverPath = path.join(
  repositoryRoot,
  ...expectedServerRelativePath.split("/"),
);

await Promise.all([
  assertOwnedPathChain(repositoryRoot, sourceStatic, {
    allowMissing: false,
  }),
  assertOwnedPathChain(repositoryRoot, destinationStatic),
  assertOwnedPathChain(repositoryRoot, serverPath, {
    allowMissing: false,
    finalType: "file",
  }),
]);

await rm(destinationStatic, { force: true, recursive: true });
await cp(sourceStatic, destinationStatic, {
  errorOnExist: true,
  force: false,
  recursive: true,
});
await import(pathToFileURL(serverPath).href);
