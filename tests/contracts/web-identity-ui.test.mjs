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
    read("apps/web/components/auth/sign-in-form.tsx"),
    read("apps/web/components/auth/password-reset-form.tsx"),
    read("apps/web/components/auth/account-security-panel.tsx"),
    read("apps/web/app/sign-up/page.tsx"),
    read("apps/web/app/verify-email/page.tsx"),
    read("apps/web/components/ui/label.tsx"),
    read("apps/web/components/ui/alert.tsx"),
  ]);
  const combined = sources.join("\n");

  for (const primitive of ["Card", "Label", "Input", "Button", "Alert"]) {
    assert.match(combined, new RegExp(`\\b${primitive}\\b`, "u"));
  }
  assert.ok((combined.match(/type="submit"/gu) ?? []).length >= 4);
  assert.doesNotMatch(
    combined,
    /StaticGameShell|HUD|Dungeon Master|pergamena|araldic/iu,
  );
  assert.doesNotMatch(combined, /motion|rive|ai-elements/iu);
});

test("access surfaces keep each mobile screen focused and password-manager friendly", async () => {
  const [signIn, reset, security, dialog] = await Promise.all([
    read("apps/web/components/auth/sign-in-form.tsx"),
    read("apps/web/components/auth/password-reset-form.tsx"),
    read("apps/web/components/auth/account-security-panel.tsx"),
    read("apps/web/components/ui/alert-dialog.tsx"),
  ]);
  const combined = [signIn, reset, security].join("\n");

  assert.match(signIn, /autoComplete="current-password"/u);
  assert.match(signIn, /fetch\("\/api\/auth\/sign-in/u);
  assert.match(signIn, /href="\/reset-password"/u);
  assert.match(reset, /type ResetStep/u);
  assert.match(reset, /autoComplete="one-time-code"/u);
  assert.ok((reset.match(/autoComplete="new-password"/gu) ?? []).length >= 2);
  assert.match(reset, /fetch\("\/api\/auth\/password-reset\/request/u);
  assert.match(reset, /fetch\("\/api\/auth\/password-reset\/confirm/u);
  assert.match(security, /fetch\("\/api\/auth\/sign-out/u);
  assert.match(security, /fetch\("\/api\/auth\/sessions\/revoke-all/u);
  assert.match(dialog, /AlertDialogPrimitive/u);
  assert.match(security, /AlertDialog/u);
  assert.match(combined, /aria-live="polite"/u);
  assert.match(combined, /size="lg"/u);
  assert.doesNotMatch(combined, /device|dispositivo connesso|ultimo accesso/iu);
  assert.doesNotMatch(
    combined,
    /onPaste|clipboardData|dangerouslySetInnerHTML/u,
  );
});

test("reset identity remains only in React state and never enters navigation or storage", async () => {
  const reset = await read("apps/web/components/auth/password-reset-form.tsx");

  assert.match(reset, /kind: "confirm"; email: string/u);
  assert.doesNotMatch(
    reset,
    /localStorage|sessionStorage|indexedDB|document\.cookie|URLSearchParams/u,
  );
  assert.doesNotMatch(reset, /router\.(?:push|replace)\([^)]*email/u);
  assert.doesNotMatch(reset, /[?&](?:email|code|session)=/u);
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
    read("apps/web/components/auth/sign-in-form.tsx"),
    read("apps/web/components/auth/password-reset-form.tsx"),
    read("apps/web/components/auth/account-security-panel.tsx"),
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
    read("apps/web/components/auth/sign-in-form.tsx"),
    read("apps/web/components/auth/password-reset-form.tsx"),
    read("apps/web/components/auth/account-security-panel.tsx"),
  ]);
  const combined = sources.join("\n");

  for (const endpoint of [
    "/api/auth/sign-up",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
    "/api/auth/sign-in",
    "/api/auth/password-reset/request",
    "/api/auth/password-reset/confirm",
    "/api/auth/sign-out",
    "/api/auth/sessions/revoke-all",
  ]) {
    assert.match(combined, new RegExp(`fetch\\("${endpoint}`, "u"));
  }
  assert.doesNotMatch(combined, /WEB_API_INTERNAL_ORIGIN|NEXT_PUBLIC_/u);
  assert.doesNotMatch(combined, /[?&](?:email|code|session)=/u);
});
