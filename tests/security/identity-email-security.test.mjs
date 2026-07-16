import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

import {
  EmailDeliveryError,
  createSmtpVerificationEmailSender,
} from "../../apps/worker/dist/index.js";

test("SMTP uses a small TLS-verified pool, bounded timeouts and no authenticating links", async () => {
  let transportOptions;
  let sentMail;
  let closed = 0;
  const sender = createSmtpVerificationEmailSender(
    {
      from: "DND AI <noreply@example.test>",
      host: "smtp.example.test",
      password: "smtp-secret",
      port: 465,
      secure: true,
      username: "smtp-user",
    },
    {
      createTransport(options) {
        transportOptions = options;
        return {
          close() {
            closed += 1;
          },
          async sendMail(message) {
            sentMail = message;
            return { accepted: [message.to] };
          },
        };
      },
    },
  );

  assert.deepEqual(transportOptions, {
    auth: { pass: "smtp-secret", user: "smtp-user" },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    host: "smtp.example.test",
    maxConnections: 2,
    maxMessages: 20,
    pool: true,
    port: 465,
    secure: true,
    socketTimeout: 10_000,
    tls: { rejectUnauthorized: true },
  });

  await sender.send({
    code: "123456",
    displayName: "Ada",
    expiresInMinutes: 10,
    recipient: "ada@example.test",
  });
  assert.equal(sentMail.to, "ada@example.test");
  assert.equal(sentMail.from, "DND AI <noreply@example.test>");
  assert.match(sentMail.text, /123456/u);
  assert.match(sentMail.text, /10 minuti/u);
  assert.doesNotMatch(sentMail.text, /https?:\/\//iu);
  assert.doesNotMatch(sentMail.text, /password|session|token/iu);
  assert.equal("html" in sentMail, false);

  await sender.close();
  await sender.close();
  assert.equal(closed, 1);
});

test("SMTP classifies permanent server rejection as non-retryable", async () => {
  const sender = createSmtpVerificationEmailSender(
    {
      from: "noreply@example.test",
      host: "smtp.example.test",
      password: "smtp-secret",
      port: 587,
      secure: false,
      username: "smtp-user",
    },
    {
      createTransport() {
        return {
          close() {},
          async sendMail() {
            throw Object.assign(new Error("address rejected"), {
              responseCode: 550,
            });
          },
        };
      },
    },
  );

  await assert.rejects(
    sender.send({
      code: "123456",
      displayName: "Ada",
      expiresInMinutes: 10,
      recipient: "ada@example.test",
    }),
    (error) => {
      assert.equal(error instanceof EmailDeliveryError, true);
      assert.equal(error.retryable, false);
      assert.doesNotMatch(error.message, /ada@example\.test|address rejected/u);
      return true;
    },
  );
});

test("worker source does not open SMTP at module import or log identity payloads", async () => {
  const source = await readFile(
    new URL(
      "../../apps/worker/src/identity/smtp-email-sender.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)/u);
  assert.doesNotMatch(source, /rejectUnauthorized\s*:\s*false/u);
  assert.ok(
    source.indexOf("export function createSmtpVerificationEmailSender") <
      source.indexOf("const transport = createTransport"),
  );
});
