import nodemailer from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool/index.js";

import {
  EmailDeliveryError,
  type IdentityEmailMessage,
  type VerificationEmailSender,
} from "./email-sender.js";

export interface SmtpVerificationEmailConfig {
  readonly from: string;
  readonly host: string;
  readonly password: string;
  readonly port: number;
  readonly secure: boolean;
  readonly username: string;
}

interface MailTransport {
  sendMail(message: Readonly<Record<string, unknown>>): Promise<unknown>;
  close(): void;
}

interface SmtpVerificationEmailDependencies {
  readonly createTransport?: (options: SMTPPool.Options) => MailTransport;
}

function renderMessage(message: IdentityEmailMessage): string {
  if (message.kind === "password_reset") {
    return [
      "Hai richiesto di reimpostare la password.",
      "",
      `Il tuo codice è ${message.code}.`,
      `Scade tra ${message.expiresInMinutes} minuti.`,
      "",
      "Se non hai fatto tu questa richiesta, ignora questa email.",
    ].join("\n");
  }
  return [
    `Ciao ${message.displayName},`,
    "",
    `Il tuo codice di verifica è ${message.code}.`,
    `Scade tra ${message.expiresInMinutes} minuti.`,
    "",
    "Se non hai richiesto tu questo codice, ignora questa email.",
  ].join("\n");
}

function isRetryableSmtpError(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("responseCode" in error) ||
    typeof error.responseCode !== "number"
  ) {
    return true;
  }
  return error.responseCode < 500 || error.responseCode >= 600;
}

export function createSmtpVerificationEmailSender(
  config: SmtpVerificationEmailConfig,
  dependencies: SmtpVerificationEmailDependencies = {},
): VerificationEmailSender {
  const createTransport =
    dependencies.createTransport ??
    ((options: SMTPPool.Options) => nodemailer.createTransport(options));
  const transport = createTransport({
    auth: { pass: config.password, user: config.username },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    host: config.host,
    maxConnections: 2,
    maxMessages: 20,
    pool: true,
    port: config.port,
    secure: config.secure,
    socketTimeout: 10_000,
    tls: { rejectUnauthorized: true },
  });
  let closed = false;

  return Object.freeze({
    async send(message: IdentityEmailMessage): Promise<void> {
      try {
        await transport.sendMail({
          from: config.from,
          subject:
            message.kind === "password_reset"
              ? "Il tuo codice per reimpostare la password"
              : "Il tuo codice di verifica DND AI",
          text: renderMessage(message),
          to: message.recipient,
        });
      } catch (error) {
        throw new EmailDeliveryError(
          "SMTP delivery failed",
          isRetryableSmtpError(error),
          { cause: error },
        );
      }
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      transport.close();
    },
  });
}
