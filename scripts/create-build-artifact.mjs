import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { prepareBuildArtifact } from "./lib/build-artifact.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = await prepareBuildArtifact({ repositoryRoot });

console.log(
  `build-artifact: PASS (${manifest.files.length} files, ${path.join("artifacts", "bl002")})`,
);
