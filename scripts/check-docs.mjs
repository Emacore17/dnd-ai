import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { checkDocumentationRepository } from "./lib/document-policy.mjs";

function resolveRoot(args) {
  if (args.length === 0) {
    return fileURLToPath(new URL("../", import.meta.url));
  }

  if (args.length !== 2 || args[0] !== "--root" || !args[1]) {
    throw new Error("usage: node scripts/check-docs.mjs [--root <path>]");
  }

  return path.resolve(args[1]);
}

async function main() {
  const repositoryRoot = resolveRoot(process.argv.slice(2));
  const result = await checkDocumentationRepository(repositoryRoot);

  for (const warning of result.warnings) {
    console.warn(`documentation-policy: WARN ${warning}`);
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`documentation-policy: ERROR ${error}`);
    }
    throw new Error(
      `documentation-policy: FAIL (${result.errors.length} error(s))`,
    );
  }

  console.log(
    `documentation-policy: PASS (${result.documentPaths.length} documents, ${result.changedDocumentPaths.length} changed)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
