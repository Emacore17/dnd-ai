import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  EmailDeliveryError,
  createFakeVerificationEmailSender,
  deriveWorkerPasswordResetCode,
  deriveWorkerVerificationCode,
  dispatchIdentityEmailBatch,
  runIdentityEmailPoller,
  startWorker,
} from "../../apps/worker/dist/index.js";

const START = new Date("2026-07-16T10:00:00.000Z");
const CHALLENGE_KEY = Buffer.alloc(32, 7);
const RESET_KEY = Buffer.alloc(32, 17);
const { AbortController } = globalThis;

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function claimed(number, attemptNumber = 1) {
  return Object.freeze({
    attemptNumber,
    challengeId: uuid(1_000 + number),
    displayName: `Player ${number}`,
    expiresAt: new Date(START.valueOf() + 600_000),
    keyVersion: 1,
    leaseToken: uuid(2_000 + number),
    kind: "verification",
    outboxId: uuid(3_000 + number),
    recipient: `player${number}@example.test`,
  });
}

function claimedReset(number, attemptNumber = 1) {
  const job = claimed(number, attemptNumber);
  return Object.freeze({
    attemptNumber: job.attemptNumber,
    challengeId: job.challengeId,
    expiresAt: job.expiresAt,
    keyVersion: job.keyVersion,
    leaseToken: job.leaseToken,
    kind: "password_reset",
    outboxId: job.outboxId,
    recipient: job.recipient,
  });
}

function createOutbox(items) {
  const calls = [];
  return {
    calls,
    async claimBatch(command) {
      calls.push(["claim", command]);
      return items;
    },
    async markFailed(command) {
      calls.push(["failed", command]);
      return true;
    },
    async markSent(command) {
      calls.push(["sent", command]);
      return true;
    },
    async release(command) {
      calls.push(["released", command]);
      return true;
    },
  };
}

function dependencies(outbox, sender, overrides = {}) {
  return {
    challengeKey: CHALLENGE_KEY,
    challengeKeyVersion: 1,
    clock: { now: () => START },
    jitterMs: () => 250,
    outbox,
    resetKey: RESET_KEY,
    resetKeyVersion: 1,
    sender,
    ...overrides,
  };
}

test("one finite tick claims 25 rows for 30 seconds and acknowledges minimal messages", async () => {
  const jobs = [claimed(1), claimed(2)];
  const outbox = createOutbox(jobs);
  const sender = createFakeVerificationEmailSender();

  assert.deepEqual(
    await dispatchIdentityEmailBatch(dependencies(outbox, sender)),
    { claimed: 2, dead: 0, released: 0, retried: 0, sent: 2 },
  );

  assert.deepEqual(outbox.calls[0], [
    "claim",
    {
      leaseDurationMs: 30_000,
      limit: 25,
      occurredAt: START,
    },
  ]);
  assert.equal(sender.messages.length, 2);
  assert.deepEqual(Object.keys(sender.messages[0]).sort(), [
    "code",
    "displayName",
    "expiresInMinutes",
    "kind",
    "recipient",
  ]);
  assert.equal(sender.messages[0].kind, "verification");
  assert.match(sender.messages[0].code, /^[0-9]{6}$/u);
  assert.equal(sender.messages[0].expiresInMinutes, 10);
  assert.deepEqual(
    outbox.calls.slice(1).map(([kind]) => kind),
    ["sent", "sent"],
  );
});

test("password reset messages use their dedicated key domain and minimal payload", async () => {
  const job = claimedReset(10);
  const outbox = createOutbox([job]);
  const sender = createFakeVerificationEmailSender();

  assert.deepEqual(
    await dispatchIdentityEmailBatch(dependencies(outbox, sender)),
    { claimed: 1, dead: 0, released: 0, retried: 0, sent: 1 },
  );

  assert.equal(sender.messages.length, 1);
  assert.deepEqual(Object.keys(sender.messages[0]).sort(), [
    "code",
    "expiresInMinutes",
    "kind",
    "recipient",
  ]);
  assert.equal(sender.messages[0].kind, "password_reset");
  assert.equal(
    sender.messages[0].code,
    deriveWorkerPasswordResetCode(RESET_KEY, job.challengeId),
  );
  assert.notEqual(
    sender.messages[0].code,
    deriveWorkerVerificationCode(RESET_KEY, job.challengeId),
  );
});

test("retryable delivery failures use bounded exponential backoff and attempt five is terminal", async () => {
  const retryJob = claimed(3, 2);
  const terminalJob = claimed(4, 5);
  const outbox = createOutbox([retryJob, terminalJob]);
  const sender = {
    async send() {
      throw new EmailDeliveryError("SMTP delivery failed", true);
    },
  };

  assert.deepEqual(
    await dispatchIdentityEmailBatch(dependencies(outbox, sender)),
    { claimed: 2, dead: 1, released: 0, retried: 1, sent: 0 },
  );

  const failures = outbox.calls.filter(([kind]) => kind === "failed");
  assert.equal(failures[0][1].terminal, false);
  assert.equal(
    failures[0][1].nextAttemptAt.toISOString(),
    new Date(START.valueOf() + 10_250).toISOString(),
  );
  assert.equal(failures[1][1].terminal, true);
  assert.equal(failures[1][1].nextAttemptAt.toISOString(), START.toISOString());
});

test("non-retryable delivery errors are terminal without exposing their cause", async () => {
  const outbox = createOutbox([claimed(5)]);
  const sender = {
    async send() {
      throw new EmailDeliveryError("recipient@example.test rejected", false);
    },
  };

  const summary = await dispatchIdentityEmailBatch(
    dependencies(outbox, sender),
  );

  assert.equal(summary.dead, 1);
  const failure = outbox.calls.find(([kind]) => kind === "failed")[1];
  assert.equal(failure.terminal, true);
  assert.deepEqual(Object.keys(failure).sort(), [
    "leaseToken",
    "nextAttemptAt",
    "occurredAt",
    "outboxId",
    "terminal",
  ]);
});

test("abort stops the tick and releases every remaining lease", async () => {
  const controller = new AbortController();
  const outbox = createOutbox([claimed(6), claimed(7), claimed(8)]);
  let sends = 0;
  const sender = {
    async send() {
      sends += 1;
      controller.abort();
    },
  };

  assert.deepEqual(
    await dispatchIdentityEmailBatch(
      dependencies(outbox, sender, { signal: controller.signal }),
    ),
    { claimed: 3, dead: 0, released: 2, retried: 0, sent: 1 },
  );
  assert.equal(sends, 1);
  assert.deepEqual(
    outbox.calls.filter(([kind]) => kind === "released").length,
    2,
  );
});

test("unsupported challenge key versions fail closed", async () => {
  const outbox = createOutbox([{ ...claimed(9), keyVersion: 2 }]);
  const sender = createFakeVerificationEmailSender();

  const summary = await dispatchIdentityEmailBatch(
    dependencies(outbox, sender),
  );

  assert.deepEqual(summary, {
    claimed: 1,
    dead: 1,
    released: 0,
    retried: 0,
    sent: 0,
  });
  assert.equal(sender.messages.length, 0);
});

test("unsupported reset key versions fail closed", async () => {
  const outbox = createOutbox([{ ...claimedReset(11), keyVersion: 2 }]);
  const sender = createFakeVerificationEmailSender();

  const summary = await dispatchIdentityEmailBatch(
    dependencies(outbox, sender),
  );

  assert.deepEqual(summary, {
    claimed: 1,
    dead: 1,
    released: 0,
    retried: 0,
    sent: 0,
  });
  assert.equal(sender.messages.length, 0);
});

test("runtime poller waits two seconds between finite ticks and stops on abort", async () => {
  const controller = new AbortController();
  let ticks = 0;
  let waits = 0;

  await runIdentityEmailPoller({
    async dispatchTick(signal) {
      assert.equal(signal, controller.signal);
      ticks += 1;
    },
    signal: controller.signal,
    async wait(durationMs, signal) {
      assert.equal(durationMs, 2_000);
      assert.equal(signal, controller.signal);
      waits += 1;
      controller.abort();
    },
  });

  assert.equal(ticks, 1);
  assert.equal(waits, 1);
});

test("worker startup owns one cancellable loop and shuts dependencies down once", async () => {
  let releaseDispatch;
  const dispatchPending = new Promise((resolve) => {
    releaseDispatch = resolve;
  });
  let closes = 0;
  let shutdowns = 0;
  const observability = {
    async shutdown() {
      shutdowns += 1;
      return true;
    },
  };
  const worker = await startWorker({
    createIdentityRuntime() {
      return {
        async close() {
          closes += 1;
        },
        dispatch() {
          return dispatchPending;
        },
      };
    },
    createObservability() {
      return observability;
    },
    environment: {
      APP_ENV: "local",
      WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64: Buffer.alloc(32, 7).toString(
        "base64",
      ),
      WORKER_AUTH_CHALLENGE_KEY_VERSION: "1",
      WORKER_AUTH_RESET_HMAC_KEY_BASE64: Buffer.alloc(32, 17).toString(
        "base64",
      ),
      WORKER_AUTH_RESET_KEY_VERSION: "1",
      WORKER_DATABASE_URL:
        "postgresql://worker:secret@127.0.0.1:5432/dnd_ai?sslmode=disable",
      WORKER_EMAIL_DELIVERY_MODE: "fake",
      WORKER_REDIS_URL: "redis://127.0.0.1:6379",
    },
  });

  const firstStop = worker.stop();
  const secondStop = worker.stop();
  assert.equal(firstStop, secondStop);
  releaseDispatch();
  await firstStop;
  assert.equal(closes, 1);
  assert.equal(shutdowns, 1);
});
