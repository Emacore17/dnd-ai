---
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

- Source: SecLists 2026.1, `Passwords/Common-Credentials/10k-most-common.txt`
- URL: https://raw.githubusercontent.com/danielmiessler/SecLists/2026.1/Passwords/Common-Credentials/10k-most-common.txt
- Retrieved: 2026-07-16
- License: MIT
- Source SHA-256: `4adb3f0afb4a10cf19ebe48d8c69a46f934bbc8d77c694c210564f9583e7f4ba`
- Output SHA-256: `2c347310666f473f3ee0665792d0cafd3bf40e8c3f27865fb51ced32d2ae7b29`
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
