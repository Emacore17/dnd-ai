import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
  formatSecretFinding,
  scanRepositoryFiles,
} from "./lib/secret-scanner.mjs";

const repositoryRoot = path.resolve(
  process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url)),
);
const findings = await scanRepositoryFiles(repositoryRoot);

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(formatSecretFinding(finding));
  }

  process.exitCode = 1;
} else {
  console.log("repository-secret-scan: PASS");
}
