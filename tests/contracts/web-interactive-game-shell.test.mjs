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

async function readRequired(relativePath) {
  const source = await read(relativePath);
  assert.notEqual(source, null, `${relativePath} should exist`);
  return source;
}

test("the interactive shell pins only its approved direct runtime dependencies", async () => {
  const manifest = JSON.parse(await readRequired("apps/web/package.json"));
  const requiredDependencies = Object.freeze({
    motion: "12.42.2",
    streamdown: "2.5.0",
    "use-stick-to-bottom": "1.1.6",
    vaul: "1.1.2",
  });
  const forbiddenDependencies = Object.freeze([
    "@ai-sdk/react",
    "@rive-app/react-canvas",
    "@streamdown/cjk",
    "@streamdown/code",
    "@streamdown/math",
    "@streamdown/mermaid",
    "ai",
    "cmdk",
    "nanoid",
  ]);

  for (const [packageName, version] of Object.entries(requiredDependencies)) {
    assert.equal(manifest.dependencies?.[packageName], version);
  }
  for (const packageName of forbiddenDependencies) {
    assert.equal(
      packageName in (manifest.dependencies ?? {}),
      false,
      `${packageName} should not be a direct runtime dependency`,
    );
  }
});

test("the approved AI Elements and shadcn source inventory stays selective", async () => {
  const componentPaths = [
    "apps/web/components/ai-elements/conversation.tsx",
    "apps/web/components/ai-elements/message.tsx",
    "apps/web/components/ai-elements/prompt-input.tsx",
    "apps/web/components/ui/collapsible.tsx",
    "apps/web/components/ui/drawer.tsx",
    "apps/web/components/ui/progress.tsx",
    "apps/web/components/ui/textarea.tsx",
  ];
  const sources = await Promise.all(componentPaths.map(readRequired));
  const combined = sources.join("\n");

  for (const exportName of [
    "Conversation",
    "ConversationContent",
    "ConversationScrollButton",
    "Message",
    "MessageContent",
    "MessageResponse",
    "PromptInput",
    "PromptInputSubmit",
    "PromptInputTextarea",
  ]) {
    assert.match(combined, new RegExp(`export (?:const|function) ${exportName}\\b`, "u"));
  }

  for (const forbiddenToken of [
    "ConversationDownload",
    "DefaultChatTransport",
    "MessageBranch",
    "PromptInputActionAddAttachments",
    "PromptInputSelect",
    "UIMessage",
    "useChat",
  ]) {
    assert.doesNotMatch(combined, new RegExp(`\\b${forbiddenToken}\\b`, "u"));
  }
});

test("the game shell keeps domain state independent from UI and transport packages", async () => {
  const modelPaths = [
    "apps/web/lib/game-shell/game-shell-fixtures.ts",
    "apps/web/lib/game-shell/game-shell-model.ts",
    "apps/web/lib/game-shell/game-shell-reducer.ts",
  ];
  const sources = await Promise.all(modelPaths.map(readRequired));
  const combined = sources.join("\n");

  for (const forbiddenPattern of [
    /from ["'](?:@ai-sdk|ai|motion|next|react|streamdown|vaul)/u,
    /dangerouslySetInnerHTML/u,
    /localStorage/u,
    /sessionStorage/u,
    /setTimeout/u,
  ]) {
    assert.doesNotMatch(combined, forbiddenPattern);
  }

  assert.match(combined, /type GameShellStatus/u);
  assert.match(combined, /stateApplied/u);
  assert.match(combined, /retryable/u);
  assert.match(combined, /FixtureTurnSource/u);
});

test("the public conversational wrappers preserve the mobile game controls", async () => {
  const wrapperPaths = [
    "apps/web/components/game/free-action-composer.tsx",
    "apps/web/components/game/game-conversation.tsx",
    "apps/web/components/game/narrative-turn.tsx",
    "apps/web/components/game/suggested-actions.tsx",
  ];
  const sources = await Promise.all([
    ...wrapperPaths.map(readRequired),
    readRequired("apps/web/components/ai-elements/prompt-input.tsx"),
  ]);
  const combined = sources.join("\n");

  for (const exportName of [
    "FreeActionComposer",
    "GameConversation",
    "NarrativeTurn",
    "SuggestedActions",
  ]) {
    assert.match(combined, new RegExp(`export function ${exportName}\\b`, "u"));
  }

  for (const requiredPattern of [
    /data-message-kind/u,
    /aria-live/u,
    /maxLength=\{2000\}/u,
    /isComposing/u,
    /shiftKey/u,
    /Collapsible/u,
    /slice\(0, 2\)/u,
  ]) {
    assert.match(combined, requiredPattern);
  }

  for (const forbiddenPattern of [
    /@ai-sdk\/react/u,
    /DefaultChatTransport/u,
    /UIMessage/u,
    /useChat/u,
  ]) {
    assert.doesNotMatch(combined, forbiddenPattern);
  }
});

test("the game drawer remains a dedicated domain wrapper", async () => {
  const source = await readRequired(
    "apps/web/components/game/game-drawer.tsx",
  );

  assert.match(source, /export function GameDrawer\b/u);
  assert.doesNotMatch(
    source,
    /@ai-sdk\/react|DefaultChatTransport|UIMessage|useChat/u,
  );
});

test("the game feature boundary forbids trusted AI HTML, browser persistence, and fake latency", async () => {
  const boundaryPaths = [
    "apps/web/components/ai-elements/conversation.tsx",
    "apps/web/components/ai-elements/message.tsx",
    "apps/web/components/ai-elements/prompt-input.tsx",
    "apps/web/components/game/free-action-composer.tsx",
    "apps/web/components/game/game-conversation.tsx",
    "apps/web/components/game/game-drawer.tsx",
    "apps/web/components/game/interactive-game-shell.tsx",
    "apps/web/components/game/narrative-turn.tsx",
    "apps/web/components/game/suggested-actions.tsx",
    "apps/web/lib/game-shell/game-shell-fixtures.ts",
    "apps/web/lib/game-shell/game-shell-model.ts",
    "apps/web/lib/game-shell/game-shell-reducer.ts",
  ];
  const sources = await Promise.all(boundaryPaths.map(readRequired));
  const combined = sources.join("\n");

  for (const forbiddenPattern of [
    /\/api\/chat/u,
    /@rive-app/u,
    /DefaultChatTransport/u,
    /dangerouslySetInnerHTML/u,
    /localStorage/u,
    /sessionStorage/u,
    /setTimeout/u,
    /useChat/u,
  ]) {
    assert.doesNotMatch(combined, forbiddenPattern);
  }
});

test("Motion stays behind a strict lazy reduced-motion boundary", async () => {
  const [provider, features, shell] = await Promise.all([
    readRequired("apps/web/components/game/game-motion-provider.tsx"),
    readRequired("apps/web/components/game/game-motion-features.ts"),
    readRequired("apps/web/components/game/interactive-game-shell.tsx"),
  ]);

  assert.match(provider, /LazyMotion/u);
  assert.match(provider, /strict/u);
  assert.match(provider, /reducedMotion=["']user["']/u);
  assert.match(provider, /import\(["'].\/game-motion-features["']\)/u);
  assert.match(features, /domAnimation/u);
  assert.doesNotMatch(`${provider}\n${shell}`, /\bmotion\s*[,}]/u);
  assert.doesNotMatch(`${provider}\n${features}\n${shell}`, /@rive-app/u);
});
