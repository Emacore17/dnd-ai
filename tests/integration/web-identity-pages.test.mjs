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
      throw new Error(
        `web server exited before identity page check: ${output()}`,
      );
    }
    try {
      const response = await globalThis.fetch(`${origin}/sign-up`);
      if (response.status === 200) return;
    } catch {
      // The bounded poll expects connection refusal until Next binds.
    }
    await delay(50);
  }
  throw new Error(`web identity pages did not become ready: ${output()}`);
}

test("standalone auth pages render focused Italian forms at stable routes", async (context) => {
  const port = await reserveAvailablePort();
  const child = spawn(process.execPath, [webServerPath], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      APP_ENV: "local",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      WEB_API_INTERNAL_ORIGIN: "http://127.0.0.1:9",
      WEB_AUTH_BFF_ASSERTION_KEY_BASE64:
        "gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8=",
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
  const origin = `http://127.0.0.1:${port}`;
  await waitForPage(origin, child, () => `${stdout}\n${stderr}`.trim());

  const signUp = await (await globalThis.fetch(`${origin}/sign-up`)).text();
  assert.match(signUp, /<html[^>]+lang="it"/u);
  assert.match(signUp, /<h1[^>]*>Crea il tuo profilo<\/h1>/u);
  assert.match(signUp, /<label[^>]+for="display-name"/u);
  assert.match(signUp, /autoComplete="new-password"/u);
  assert.match(signUp, /Continua/u);
  assert.doesNotMatch(signUp, /data-game-shell/u);

  const verify = await (
    await globalThis.fetch(`${origin}/verify-email`)
  ).text();
  assert.match(verify, /<h1[^>]*>Verifica la tua email<\/h1>/u);
  assert.match(verify, /inputMode="numeric"/u);
  assert.match(verify, /autoComplete="one-time-code"/u);
  assert.match(verify, /Invia un nuovo codice/u);
  assert.doesNotMatch(verify, /value="[^"]+@/u);

  const signIn = await (await globalThis.fetch(`${origin}/sign-in`)).text();
  assert.match(signIn, /<h1[^>]*>Bentornato<\/h1>/u);
  assert.match(signIn, /autoComplete="current-password"/u);
  assert.match(signIn, /Accedi/u);
  assert.match(signIn, /href="\/reset-password"/u);

  const reset = await (
    await globalThis.fetch(`${origin}/reset-password`)
  ).text();
  assert.match(reset, /<h1[^>]*>Reimposta la password<\/h1>/u);
  assert.match(reset, /Invia il codice/u);
  assert.doesNotMatch(reset, /value="[^"]+@/u);

  const security = await (
    await globalThis.fetch(`${origin}/account/security`)
  ).text();
  assert.match(security, /<h1[^>]*>Sicurezza account<\/h1>/u);
  assert.match(security, /Esci/u);
  assert.match(security, /Disconnetti tutti i dispositivi/u);
  assert.doesNotMatch(security, /ultimo accesso|indirizzo IP/iu);
});
