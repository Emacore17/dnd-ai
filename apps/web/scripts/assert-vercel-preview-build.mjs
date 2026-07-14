import process from "node:process";

import { validateVercelPreviewBuildEnvironment } from "./vercel-preview-build-policy.mjs";

const argumentsList = process.argv.slice(2);
const validArguments =
  argumentsList.length === 0 ||
  (argumentsList.length === 1 && argumentsList[0] === "--allow-local");

if (!validArguments) {
  process.stderr.write("preview-build-guard: invalid-arguments\n");
  process.exitCode = 1;
} else {
  const result = validateVercelPreviewBuildEnvironment(process.env, {
    allowLocal: argumentsList[0] === "--allow-local",
  });
  if (!result.allowed) {
    process.stderr.write(`preview-build-guard: ${result.code}\n`);
    process.exitCode = 1;
  }
}
