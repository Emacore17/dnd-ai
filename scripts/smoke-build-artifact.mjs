import { spawn } from "node:child_process";
import { get } from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const HOST = "127.0.0.1";
const STARTUP_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 1_000;
const POLL_INTERVAL_MS = 100;
const MAX_LOG_LENGTH = 16_384;
const MAX_RESPONSE_LENGTH = 1024 * 1024;

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to reserve smoke port")));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(timeoutMs),
  ]);
}

function probe(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, { timeout: REQUEST_TIMEOUT_MS }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body = `${body}${chunk}`;

        if (body.length > MAX_RESPONSE_LENGTH) {
          request.destroy(new Error("artifact smoke response is too large"));
        }
      });
      response.once("end", () => {
        resolve({
          body,
          ok:
            response.statusCode !== undefined &&
            response.statusCode >= 200 &&
            response.statusCode < 300,
        });
      });
    });
    request.once("error", reject);
    request.once("timeout", () => {
      request.destroy(new Error("artifact smoke request timed out"));
    });
  });
}

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const artifactRoot = path.join(
  repositoryRoot,
  "artifacts",
  "bl002",
  "payload",
  "web",
);
const port = await reservePort();
const child = spawn(process.execPath, [path.join(artifactRoot, "start.mjs")], {
  cwd: artifactRoot,
  env: {
    ...process.env,
    HOSTNAME: HOST,
    NODE_ENV: "production",
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let output = "";
let exited = false;
let exitCode = null;

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    output = `${output}${chunk}`.slice(-MAX_LOG_LENGTH);
  });
}

child.once("exit", (code) => {
  exited = true;
  exitCode = code;
});

const deadline = Date.now() + STARTUP_TIMEOUT_MS;
let passed = false;

try {
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`standalone server exited with code ${exitCode}`);
    }

    try {
      const response = await probe(`http://${HOST}:${port}/`);

      if (response.ok && response.body.includes('data-testid="game-shell"')) {
        passed = true;
        break;
      }
    } catch (error) {
      const retryable =
        ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(error.code) ||
        error.message === "artifact smoke request timed out";

      if (!retryable) {
        throw error;
      }
    }

    await delay(POLL_INTERVAL_MS);
  }

  if (!passed) {
    throw new Error("standalone server did not pass its HTTP smoke in time");
  }
} catch (error) {
  const diagnostic = output.trim();
  throw new Error(
    diagnostic ? `${error.message}\n${diagnostic}` : error.message,
    { cause: error },
  );
} finally {
  if (!exited) {
    child.kill();
    await waitForExit(child, 2_000);
  }

  if (!exited) {
    child.kill("SIGKILL");
    await waitForExit(child, 2_000);
  }
}

console.log(`build-artifact-smoke: PASS (http://${HOST}:${port}/)`);
