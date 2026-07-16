import { deriveWorkerVerificationCode } from "./challenge-code.js";
import {
  EmailDeliveryError,
  type VerificationEmailSender,
} from "./email-sender.js";

const BATCH_LIMIT = 25;
const LEASE_DURATION_MS = 30_000;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;
const MAX_ATTEMPTS = 5;

export interface ClaimedIdentityEmail {
  readonly attemptNumber: number;
  readonly challengeId: string;
  readonly displayName: string;
  readonly expiresAt: Date;
  readonly keyVersion: number;
  readonly leaseToken: string;
  readonly outboxId: string;
  readonly recipient: string;
}

export interface ClaimIdentityEmailBatchCommand {
  readonly leaseDurationMs: 30_000;
  readonly limit: 25;
  readonly occurredAt: Date;
}

export interface CompleteIdentityEmailCommand {
  readonly leaseToken: string;
  readonly occurredAt: Date;
  readonly outboxId: string;
}

export interface FailIdentityEmailCommand extends CompleteIdentityEmailCommand {
  readonly nextAttemptAt: Date;
  readonly terminal: boolean;
}

export interface IdentityEmailOutbox {
  claimBatch(
    command: ClaimIdentityEmailBatchCommand,
  ): Promise<readonly ClaimedIdentityEmail[]>;
  markSent(command: CompleteIdentityEmailCommand): Promise<boolean>;
  markFailed(command: FailIdentityEmailCommand): Promise<boolean>;
  release(command: CompleteIdentityEmailCommand): Promise<boolean>;
  close?(): Promise<void>;
}

export interface IdentityEmailDispatcherClock {
  now(): Date;
}

export interface DispatchIdentityEmailBatchOptions {
  readonly challengeKey: Uint8Array;
  readonly challengeKeyVersion: number;
  readonly clock: IdentityEmailDispatcherClock;
  readonly jitterMs: () => number;
  readonly outbox: IdentityEmailOutbox;
  readonly sender: VerificationEmailSender;
  readonly signal?: AbortSignal;
}

export interface DispatchSummary {
  readonly claimed: number;
  readonly dead: number;
  readonly released: number;
  readonly retried: number;
  readonly sent: number;
}

function retryDelayMs(attemptNumber: number, jitterMs: number): number {
  const boundedAttempt = Math.max(1, Math.min(MAX_ATTEMPTS, attemptNumber));
  const boundedJitter = Number.isFinite(jitterMs)
    ? Math.max(0, Math.min(1_000, Math.floor(jitterMs)))
    : 0;
  return (
    Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (boundedAttempt - 1)) +
    boundedJitter
  );
}

function isRetryable(error: unknown): boolean {
  return !(error instanceof EmailDeliveryError) || error.retryable;
}

function emptySummary(): DispatchSummary {
  return Object.freeze({
    claimed: 0,
    dead: 0,
    released: 0,
    retried: 0,
    sent: 0,
  });
}

export async function dispatchIdentityEmailBatch(
  options: DispatchIdentityEmailBatchOptions,
): Promise<DispatchSummary> {
  if (options.signal?.aborted) return emptySummary();

  const occurredAt = options.clock.now();
  const claimed = await options.outbox.claimBatch({
    leaseDurationMs: LEASE_DURATION_MS,
    limit: BATCH_LIMIT,
    occurredAt,
  });
  const counts = { dead: 0, released: 0, retried: 0, sent: 0 };

  for (const [index, job] of claimed.entries()) {
    if (options.signal?.aborted) {
      for (const remaining of claimed.slice(index)) {
        if (
          await options.outbox.release({
            leaseToken: remaining.leaseToken,
            occurredAt: options.clock.now(),
            outboxId: remaining.outboxId,
          })
        ) {
          counts.released += 1;
        }
      }
      break;
    }

    const completion = {
      leaseToken: job.leaseToken,
      occurredAt: options.clock.now(),
      outboxId: job.outboxId,
    };

    if (
      job.keyVersion !== options.challengeKeyVersion ||
      job.expiresAt <= completion.occurredAt
    ) {
      if (
        await options.outbox.markFailed({
          ...completion,
          nextAttemptAt: completion.occurredAt,
          terminal: true,
        })
      ) {
        counts.dead += 1;
      }
      continue;
    }

    try {
      const code = deriveWorkerVerificationCode(
        options.challengeKey,
        job.challengeId,
      );
      await options.sender.send({
        code,
        displayName: job.displayName,
        expiresInMinutes: 10,
        recipient: job.recipient,
      });
      if (await options.outbox.markSent(completion)) counts.sent += 1;
    } catch (error) {
      const terminal = !isRetryable(error) || job.attemptNumber >= MAX_ATTEMPTS;
      const nextAttemptAt = terminal
        ? completion.occurredAt
        : new Date(
            completion.occurredAt.valueOf() +
              retryDelayMs(job.attemptNumber, options.jitterMs()),
          );
      if (
        await options.outbox.markFailed({
          ...completion,
          nextAttemptAt,
          terminal,
        })
      ) {
        if (terminal) counts.dead += 1;
        else counts.retried += 1;
      }
    }
  }

  return Object.freeze({ claimed: claimed.length, ...counts });
}
