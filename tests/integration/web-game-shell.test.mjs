import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const webServerPath = path.join(
  repositoryRoot,
  "apps",
  "web",
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js",
);

async function reserveAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

async function waitForPage(origin, child, output) {
  const deadline = Date.now() + 8_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`web server exited before page check: ${output()}`);
    }
    try {
      const response = await globalThis.fetch(origin);
      if (response.status === 200) {
        return response;
      }
    } catch {
      // The bounded poll expects connection refusal until Next finishes binding.
    }
    await delay(50);
  }

  throw new Error(`web page did not become ready: ${output()}`);
}

test("the standalone page renders the interactive mobile-first game hierarchy", async (context) => {
  const port = await reserveAvailablePort();
  const child = spawn(process.execPath, [webServerPath], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-4_096);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4_096);
  });
  context.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
  });

  const response = await waitForPage(`http://127.0.0.1:${port}`, child, () =>
    `${stdout}\n${stderr}`.trim(),
  );
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="it"/u);
  assert.match(html, /<main[^>]+data-game-shell="interactive"/u);
  assert.match(html, /data-shell-status="idle"/u);
  assert.match(html, /<header/u);
  assert.match(html, /<h1[^>]*>Passaggio di servizio<\/h1>/u);
  assert.match(html, /18 \/ 24 HP/u);
  assert.match(html, /Stabile/u);
  assert.match(html, /data-message-kind="narration"/u);
  assert.match(html, /data-message-kind="player_action"/u);
  assert.match(html, /data-message-kind="rule_result"/u);
  assert.match(html, /Percezione/u);
  assert.match(html, /aria-label="Azioni suggerite"/u);
  assert.match(html, /Segui il segnale/u);
  assert.match(html, /Resta con Mara/u);
  assert.match(html, /<label[^>]+for="free-action"/u);
  assert.match(html, /<textarea[^>]+maxlength="2000"/iu);
  assert.match(html, /placeholder="Cosa vuoi fare\?"/u);
  assert.match(html, /aria-label="Invia azione"/u);
  assert.match(html, /role="status"/u);
  assert.doesNotMatch(html, /javascript:/iu);
});
