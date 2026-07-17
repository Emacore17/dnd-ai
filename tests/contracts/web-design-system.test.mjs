import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  try {
    return await readFile(path.join(repositoryRoot, relativePath), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

test("the web workspace exposes the approved shadcn design-system contract", async () => {
  const serialized = await read("apps/web/components.json");

  assert.notEqual(serialized, null, "apps/web/components.json should exist");

  const configuration = JSON.parse(serialized);
  assert.equal(configuration.style, "new-york");
  assert.equal(configuration.rsc, true);
  assert.equal(configuration.tsx, true);
  assert.equal(configuration.iconLibrary, "lucide");
  assert.deepEqual(configuration.tailwind, {
    config: "",
    css: "app/globals.css",
    baseColor: "neutral",
    cssVariables: true,
    prefix: "",
  });
  assert.deepEqual(configuration.aliases, {
    components: "@/components",
    utils: "@/lib/utils",
    ui: "@/components/ui",
    lib: "@/lib",
    hooks: "@/hooks",
  });
});

test("the web workspace pins the minimal local design-system dependencies", async () => {
  const manifest = JSON.parse(await read("apps/web/package.json"));
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };

  for (const packageName of [
    "@tailwindcss/postcss",
    "class-variance-authority",
    "clsx",
    "geist",
    "lucide-react",
    "radix-ui",
    "tailwind-merge",
    "tailwindcss",
    "tw-animate-css",
  ]) {
    assert.equal(
      typeof dependencies[packageName],
      "string",
      `${packageName} should be declared`,
    );
    assert.doesNotMatch(
      dependencies[packageName],
      /^[~^]/u,
      `${packageName} should use an exact version`,
    );
  }

  for (const packageName of ["@ai-sdk/react", "@rive-app/react-canvas"]) {
    assert.equal(packageName in dependencies, false);
  }
});

test("the global theme defines the mobile-first semantic token surface", async () => {
  const [globals, postcss] = await Promise.all([
    read("apps/web/app/globals.css"),
    read("apps/web/postcss.config.mjs"),
  ]);

  assert.notEqual(postcss, null, "Tailwind PostCSS configuration should exist");
  assert.match(postcss, /@tailwindcss\/postcss/u);
  assert.match(globals, /@import "tailwindcss";/u);
  assert.match(globals, /@theme inline/u);

  for (const token of [
    "--background",
    "--foreground",
    "--card",
    "--primary",
    "--muted",
    "--success",
    "--warning",
    "--destructive",
    "--touch-target",
    "--touch-target-primary",
  ]) {
    assert.match(
      globals,
      new RegExp(`${token}:`, "u"),
      `${token} should exist`,
    );
  }

  assert.match(globals, /env\(safe-area-inset-bottom/u);
  assert.match(globals, /:focus-visible/u);
  assert.match(globals, /prefers-reduced-motion/u);
});

test("the root layout uses locally packaged Geist font variables", async () => {
  const layout = await read("apps/web/app/layout.tsx");

  assert.match(layout, /from "geist\/font\/sans"/u);
  assert.match(layout, /from "geist\/font\/mono"/u);
  assert.match(layout, /GeistSans\.variable/u);
  assert.match(layout, /GeistMono\.variable/u);
  assert.doesNotMatch(layout, /next\/font\/google/u);
});

test("the approved shadcn primitives stay selective and server-compatible", async () => {
  const componentPaths = [
    "apps/web/components/ui/badge.tsx",
    "apps/web/components/ui/button.tsx",
    "apps/web/components/ui/card.tsx",
    "apps/web/components/ui/input.tsx",
    "apps/web/components/ui/separator.tsx",
  ];
  const components = await Promise.all(componentPaths.map(read));

  for (const [index, source] of components.entries()) {
    assert.notEqual(source, null, `${componentPaths[index]} should exist`);
    assert.doesNotMatch(source, /^\s*["']use client["'];?\s*$/mu);
  }
});

test("the home page keeps an explicit server-to-client game boundary", async () => {
  const [page, interactiveShell, staticShell] = await Promise.all([
    read("apps/web/app/page.tsx"),
    read("apps/web/components/game/interactive-game-shell.tsx"),
    read("apps/web/components/static-game-shell.tsx"),
  ]);

  assert.notEqual(page, null, "the home page should exist");
  assert.doesNotMatch(page, /^\s*["']use client["'];?\s*$/mu);
  assert.match(page, /InteractiveGameShell/u);
  assert.notEqual(
    interactiveShell,
    null,
    "the client game boundary should exist",
  );
  assert.match(interactiveShell, /^\s*["']use client["'];?\s*$/mu);
  assert.doesNotMatch(interactiveShell, /dangerouslySetInnerHTML/u);
  assert.equal(
    staticShell,
    null,
    "the superseded static shell should be removed",
  );
});

test("the game feed scrolls without letting the persistent composer cover decisions", async () => {
  const [shell, conversation] = await Promise.all([
    read("apps/web/components/game/interactive-game-shell.tsx"),
    read("apps/web/components/game/game-conversation.tsx"),
  ]);

  assert.notEqual(shell, null, "the interactive shell should exist");
  assert.notEqual(conversation, null, "the game conversation should exist");
  assert.match(shell, /h-svh[^"\n]*overflow-hidden/u);
  assert.match(conversation, /min-h-0/u);
  assert.match(shell, /<footer className="shrink-0/u);
  assert.doesNotMatch(`${shell}\n${conversation}`, /sticky bottom-0/u);
});
