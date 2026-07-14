import { Buffer } from "node:buffer";
import process from "node:process";

import { validateVercelDeployDryRun } from "./lib/vercel-deploy-dry-run.mjs";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;

function fail(message) {
  process.stderr.write(`vercel-deploy-dry-run: ${message}\n`);
  process.exitCode = 1;
}

if (process.argv.length !== 2) {
  fail("invalid-arguments");
} else {
  let input = "";
  let inputBytes = 0;
  let inputTooLarge = false;

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    inputBytes += Buffer.byteLength(chunk, "utf8");
    if (inputBytes > MAX_INPUT_BYTES) {
      inputTooLarge = true;
      input = "";
      return;
    }
    if (!inputTooLarge) {
      input += chunk;
    }
  });
  process.stdin.on("error", () => fail("input-error"));
  process.stdin.on("end", () => {
    if (inputTooLarge) {
      fail("input-too-large");
      return;
    }

    let manifest;
    try {
      manifest = JSON.parse(input);
    } catch {
      fail("invalid-json");
      return;
    }

    const errors = validateVercelDeployDryRun(manifest, {
      expectedBasePath: process.cwd(),
    });
    if (errors.length > 0) {
      process.stderr.write(
        ["vercel-deploy-dry-run: FAIL", ...errors].join("\n") + "\n",
      );
      process.exitCode = 1;
      return;
    }

    process.stdout.write("vercel-deploy-dry-run: PASS\n");
  });
}
