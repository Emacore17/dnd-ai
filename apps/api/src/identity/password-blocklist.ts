import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { PasswordBlocklist } from "@dnd-ai/domain";

const BLOCKLIST_SHA256 =
  "2c347310666f473f3ee0665792d0cafd3bf40e8c3f27865fb51ced32d2ae7b29";
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const DEFAULT_BLOCKLIST_URL = new URL(
  "../../assets/common-passwords-top-10000.sha256",
  import.meta.url,
);

export async function loadCommonPasswordBlocklist(): Promise<PasswordBlocklist> {
  // The URL is a package-owned constant; callers cannot select filesystem paths.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const content = await readFile(DEFAULT_BLOCKLIST_URL);
  const checksum = createHash("sha256").update(content).digest("hex");
  if (checksum !== BLOCKLIST_SHA256) {
    throw new Error("common password blocklist checksum mismatch");
  }

  const digests = content.toString("utf8").trimEnd().split("\n");
  if (
    digests.length < 10_000 ||
    digests.some((digest) => !DIGEST_PATTERN.test(digest)) ||
    new Set(digests).size !== digests.length
  ) {
    throw new Error("common password blocklist is malformed");
  }
  const digestSet = new Set(digests);

  return Object.freeze({
    contains(normalizedPassword: string): boolean {
      if (typeof normalizedPassword !== "string") {
        throw new TypeError("normalized password must be a string");
      }
      const digest = createHash("sha256")
        .update(normalizedPassword.normalize("NFC"), "utf8")
        .digest("hex");
      return digestSet.has(digest);
    },
  });
}
