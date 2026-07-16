import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceUrl =
  "https://raw.githubusercontent.com/danielmiessler/SecLists/2026.1/Passwords/Common-Credentials/10k-most-common.txt";
const sourceSha256 =
  "4adb3f0afb4a10cf19ebe48d8c69a46f934bbc8d77c694c210564f9583e7f4ba";
const outputDirectory = path.join(repositoryRoot, "apps", "api", "assets");
const outputPath = path.join(
  outputDirectory,
  "common-passwords-top-10000.sha256",
);
const noticePath = path.join(outputDirectory, "NOTICE.md");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function renderNotice(outputSha256) {
  return `---
status: active
owner: engineering-security
last_reviewed: 2026-07-16
last_verified_commit: 3ab1e953eb214b9b4f35e5064ddac1b2263e8f63
source_refs:
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/adr/0010-internal-provider-neutral-identity.md
related_tasks:
  - BL-005
code_refs:
  - apps/api/assets/common-passwords-top-10000.sha256
  - scripts/vendor-common-passwords.mjs
test_refs:
  - tests/unit/identity-policy.test.mjs
supersedes: null
---

# Common password blocklist provenance

- Source: SecLists 2026.1, \`Passwords/Common-Credentials/10k-most-common.txt\`
- URL: ${sourceUrl}
- Retrieved: 2026-07-16
- License: MIT
- Source SHA-256: \`${sourceSha256}\`
- Output SHA-256: \`${outputSha256}\`
- Transformation: each non-empty UTF-8 line is normalized to Unicode NFC, hashed with SHA-256 and the unique lowercase digests are sorted. No plaintext password is vendored.

## SecLists license

MIT License

Copyright (c) 2018 Daniel Miessler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--write") {
    throw new Error("usage: node scripts/vendor-common-passwords.mjs --write");
  }

  const response = await globalThis.fetch(sourceUrl, {
    headers: { "user-agent": "dnd-ai-blocklist-vendor/1" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`blocklist source returned HTTP ${response.status}`);
  }

  const source = Buffer.from(await response.arrayBuffer());
  if (sha256(source) !== sourceSha256) {
    throw new Error("blocklist source checksum mismatch");
  }

  const passwords = source
    .toString("utf8")
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
    .filter((line) => line.length > 0);
  if (passwords.length !== 10_000) {
    throw new Error(
      `expected 10000 source passwords, observed ${passwords.length}`,
    );
  }

  const digests = passwords
    .map((password) => sha256(password.normalize("NFC")))
    .sort();
  if (new Set(digests).size !== 10_000) {
    throw new Error("normalized blocklist contains duplicate entries");
  }

  const output = `${digests.join("\n")}\n`;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, output, "utf8");
  await writeFile(noticePath, renderNotice(sha256(output)), "utf8");
  console.log(`identity-blocklist: WROTE (${digests.length} digests)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
