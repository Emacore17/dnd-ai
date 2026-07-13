import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
  discoverWorkspace,
  validateWorkspaceBoundaries,
} from "./lib/workspace-boundaries.mjs";

function resolveRoot(args) {
  const rootIndex = args.indexOf("--root");

  if (rootIndex === -1) {
    return fileURLToPath(new URL("../", import.meta.url));
  }

  const requestedRoot = args[rootIndex + 1];

  if (!requestedRoot) {
    throw new Error("--root requires a directory");
  }

  return path.resolve(requestedRoot);
}

const rootDirectory = resolveRoot(process.argv.slice(2));
const workspace = await discoverWorkspace(rootDirectory);
const errors = validateWorkspaceBoundaries(workspace);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exitCode = 1;
} else {
  console.log(`workspace-boundaries: PASS (${workspace.length} packages)`);
}
