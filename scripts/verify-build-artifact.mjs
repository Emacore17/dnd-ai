import { fileURLToPath, URL } from "node:url";

import { verifyBuildArtifact } from "./lib/build-artifact.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const errors = await verifyBuildArtifact({ repositoryRoot });

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exitCode = 1;
} else {
  console.log("build-artifact-verification: PASS");
}
