import { createRequire, Module } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactRoot = path.dirname(fileURLToPath(import.meta.url));
const hiddenHoistRoot = path.join(
  artifactRoot,
  "node_modules",
  ".pnpm",
  "node_modules",
);

// The artifact materializes Windows junctions as regular directories. Restore
// pnpm's traced hidden-hoist lookup without reaching the repository store.
process.env.NODE_PATH = [hiddenHoistRoot, process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

createRequire(import.meta.url)("./apps/web/server.js");
