import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import net from "node:net";
import test from "node:test";

import pg from "pg";

import {
  POSTGRES_TEST_IMAGE,
  REDIS_TEST_IMAGE,
  withPostgresTestContainer,
  withRedisTestContainer,
} from "../../packages/testing/dist/node/index.js";

const { Client } = pg;

function encodeRedisCommand(parts) {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;
}

async function sendRedisCommand({ host, port }, parts) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = Buffer.alloc(0);

    socket.setTimeout(5_000);
    socket.on("connect", () => socket.write(encodeRedisCommand(parts)));
    socket.on("data", (chunk) => {
      response = Buffer.concat([response, chunk]);
      const source = response.toString("utf8");

      if (source.startsWith("+") && source.endsWith("\r\n")) {
        socket.destroy();
        resolve(source.slice(1, -2));
        return;
      }

      if (source.startsWith("$")) {
        const separator = source.indexOf("\r\n");
        const length = Number(source.slice(1, separator));
        const bodyStart = separator + 2;
        if (separator > 0 && response.byteLength >= bodyStart + length + 2) {
          socket.destroy();
          resolve(source.slice(bodyStart, bodyStart + length));
        }
      }
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("redis-test-client: timeout"));
    });
    socket.on("error", () => reject(new Error("redis-test-client: failed")));
  });
}

async function runIsolatedEnvironment(value) {
  return withPostgresTestContainer(async (postgres) =>
    withRedisTestContainer(async (redis) => {
      const client = new Client({ connectionString: postgres.databaseUrl });
      await client.connect();

      try {
        await client.query("CREATE TABLE isolated_value (value text NOT NULL)");
        await client.query("INSERT INTO isolated_value (value) VALUES ($1)", [
          value,
        ]);
        const databaseResult = await client.query(
          "SELECT value FROM isolated_value",
        );

        assert.equal(
          await sendRedisCommand(redis, ["SET", "isolated-value", value]),
          "OK",
        );

        return {
          databaseValue: databaseResult.rows[0].value,
          postgresImage: postgres.image,
          postgresPort: postgres.port,
          redisImage: redis.image,
          redisPort: redis.port,
          redisValue: await sendRedisCommand(redis, ["GET", "isolated-value"]),
        };
      } finally {
        await client.end();
      }
    }),
  );
}

test(
  "QA-001:postgres-and-redis-containers-isolate-concurrent-test-data",
  { timeout: 180_000 },
  async () => {
    const [first, second] = await Promise.all([
      runIsolatedEnvironment("alpha"),
      runIsolatedEnvironment("beta"),
    ]);

    assert.deepEqual(
      [first.databaseValue, first.redisValue],
      ["alpha", "alpha"],
    );
    assert.deepEqual(
      [second.databaseValue, second.redisValue],
      ["beta", "beta"],
    );
    assert.notEqual(first.postgresPort, second.postgresPort);
    assert.notEqual(first.redisPort, second.redisPort);
    assert.equal(first.postgresImage, POSTGRES_TEST_IMAGE);
    assert.equal(first.redisImage, REDIS_TEST_IMAGE);
  },
);
