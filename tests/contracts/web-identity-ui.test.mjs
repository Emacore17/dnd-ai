import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("identity pages compose the approved focused shadcn auth surface", async () => {
  const sources = await Promise.all([
    read("apps/web/components/auth/auth-shell.tsx"),
    read("apps/web/components/auth/sign-up-form.tsx"),
    read("apps/web/components/auth/verify-email-form.tsx"),
    read("apps/web/app/sign-up/page.tsx"),
    read("apps/web/app/verify-email/page.tsx"),
    read("apps/web/components/ui/label.tsx"),
    read("apps/web/components/ui/alert.tsx"),
  ]);
  const combined = sources.join("\n");

  for (const primitive of ["Card", "Label", "Input", "Button", "Alert"]) {
    assert.match(combined, new RegExp(`\\b${primitive}\\b`, "u"));
  }
  assert.equal((combined.match(/type="submit"/gu) ?? []).length, 2);
  assert.doesNotMatch(
    combined,
    /StaticGameShell|HUD|Dungeon Master|pergamena|araldic/iu,
  );
  assert.doesNotMatch(combined, /motion|rive|ai-elements/iu);
});

test("signup keeps password managers, paste and stable accessible errors", async () => {
  const source = await read("apps/web/components/auth/sign-up-form.tsx");

  assert.match(source, /^"use client";/u);
  assert.match(source, /autoComplete="name"/u);
  assert.match(source, /autoComplete="email"/u);
  assert.match(source, /autoComplete="new-password"/u);
  assert.match(source, /aria-describedby/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /disabled=\{status === "submitting"\}/u);
  assert.doesNotMatch(source, /onPaste|clipboardData/u);
});

test("verification is numeric, keeps resend secondary and stores no identity data", async () => {
  const sources = await Promise.all([
    read("apps/web/components/auth/sign-up-form.tsx"),
    read("apps/web/components/auth/verify-email-form.tsx"),
  ]);
  const verification = sources[1];
  const combined = sources.join("\n");

  assert.match(verification, /^"use client";/u);
  assert.match(verification, /inputMode="numeric"/u);
  assert.match(verification, /autoComplete="one-time-code"/u);
  assert.match(verification, /pattern="\[0-9\]\{6\}"/u);
  assert.match(verification, /variant="outline"/u);
  assert.match(verification, /aria-live="polite"/u);
  assert.doesNotMatch(
    combined,
    /localStorage|sessionStorage|indexedDB|document\.cookie|URLSearchParams/u,
  );
  assert.doesNotMatch(combined, /dangerouslySetInnerHTML/u);
});

test("auth layout preserves touch targets, safe areas and visible focus at 320px", async () => {
  const globals = await read("apps/web/app/globals.css");
  const shell = await read("apps/web/components/auth/auth-shell.tsx");

  assert.match(globals, /env\(safe-area-inset-top/u);
  assert.match(globals, /env\(safe-area-inset-bottom/u);
  assert.match(globals, /--touch-target: 2\.75rem/u);
  assert.match(globals, /--touch-target-primary: 3rem/u);
  assert.match(globals, /:focus-visible/u);
  assert.match(shell, /min-h-svh/u);
  assert.match(shell, /max-w-md/u);
  assert.doesNotMatch(shell, /min-w-\[/u);
});

test("the browser uses only relative identity endpoints", async () => {
  const sources = await Promise.all([
    read("apps/web/components/auth/sign-up-form.tsx"),
    read("apps/web/components/auth/verify-email-form.tsx"),
  ]);
  const combined = sources.join("\n");

  for (const endpoint of [
    "/api/auth/sign-up",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
  ]) {
    assert.match(combined, new RegExp(`fetch\\("${endpoint}`, "u"));
  }
  assert.doesNotMatch(combined, /WEB_API_INTERNAL_ORIGIN|NEXT_PUBLIC_/u);
  assert.doesNotMatch(combined, /[?&](?:email|code|session)=/u);
});
