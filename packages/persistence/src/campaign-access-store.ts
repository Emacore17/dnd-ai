import type {
  ActiveIdentitySession,
  ActorContext,
  CampaignId,
  CampaignReader,
  CampaignSafeView,
  CampaignStatus,
  IdentityId,
  IdentitySessionId,
  IdentitySessionReader,
} from "@dnd-ai/domain";
import { Pool } from "pg";

const CONNECTION_TIMEOUT_MS = 10_000;
const IDLE_TRANSACTION_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 15_000;
const STATEMENT_TIMEOUT_MS = 10_000;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_STATE_VERSION = 2_147_483_647;
const CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  "abandoned",
  "active",
  "completed",
  "draft",
  "failed",
  "generating",
  "ready",
]);

export type CampaignAccessPersistenceErrorCode =
  "INVALID_INPUT" | "STORE_UNAVAILABLE";

export class CampaignAccessPersistenceError extends Error {
  readonly code: CampaignAccessPersistenceErrorCode;

  constructor(code: CampaignAccessPersistenceErrorCode, message: string) {
    super(message);
    this.name = "CampaignAccessPersistenceError";
    this.code = code;
  }
}

interface CreatePostgresCampaignAccessStoreOptions {
  readonly databaseUrl: string;
}

interface SessionRow {
  readonly session_id: string;
  readonly user_id: string;
}

interface CampaignRow {
  readonly campaign_id: string;
  readonly state_version: string;
  readonly status: string;
  readonly title: string;
  readonly updated_at: Date;
}

export type CampaignAccessStore = IdentitySessionReader &
  CampaignReader &
  Readonly<{ close(): Promise<void> }>;

function invalidInput(): CampaignAccessPersistenceError {
  return new CampaignAccessPersistenceError(
    "INVALID_INPUT",
    "Campaign access persistence input is invalid.",
  );
}

function storeUnavailable(): CampaignAccessPersistenceError {
  return new CampaignAccessPersistenceError(
    "STORE_UNAVAILABLE",
    "Campaign access persistence operation failed.",
  );
}

function wrapStoreError(error: unknown): never {
  if (error instanceof CampaignAccessPersistenceError) throw error;
  throw storeUnavailable();
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.valueOf());
}

function requireSessionLookup(tokenDigest: string, occurredAt: Date): void {
  if (!HASH_PATTERN.test(tokenDigest) || !isValidDate(occurredAt)) {
    throw invalidInput();
  }
}

function requireCampaignLookup(
  actor: ActorContext,
  campaignId: CampaignId,
): void {
  if (
    !UUID_V4_PATTERN.test(actor.userId) ||
    !UUID_V7_PATTERN.test(campaignId)
  ) {
    throw invalidInput();
  }
}

function mapCampaign(row: CampaignRow): CampaignSafeView {
  const stateVersion = Number(row.state_version);
  if (
    !UUID_V7_PATTERN.test(row.campaign_id) ||
    !Number.isSafeInteger(stateVersion) ||
    stateVersion < 0 ||
    stateVersion > MAX_STATE_VERSION ||
    !CAMPAIGN_STATUSES.has(row.status as CampaignStatus) ||
    typeof row.title !== "string" ||
    !isValidDate(row.updated_at)
  ) {
    throw storeUnavailable();
  }

  return Object.freeze({
    id: row.campaign_id as CampaignId,
    stateVersion,
    status: row.status as CampaignStatus,
    title: row.title,
    updatedAt: row.updated_at,
  });
}

export function createPostgresCampaignAccessStore(
  options: CreatePostgresCampaignAccessStoreOptions,
): CampaignAccessStore {
  const pool = new Pool({
    application_name: "dnd-ai-campaign-access",
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idle_in_transaction_session_timeout: IDLE_TRANSACTION_TIMEOUT_MS,
    max: 5,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
  let closePromise: Promise<void> | undefined;

  return Object.freeze({
    async resolveActiveSession(
      tokenDigest: string,
      occurredAt: Date,
    ): Promise<ActiveIdentitySession | null> {
      requireSessionLookup(tokenDigest, occurredAt);
      try {
        const result = await pool.query<SessionRow>(
          `SELECT s.session_id, s.user_id
             FROM app.user_sessions AS s
             JOIN app.users AS u ON u.user_id = s.user_id
            WHERE s.token_digest = $1
              AND u.status = 'active'
              AND s.revoked_at IS NULL
              AND s.idle_expires_at > $2
              AND s.absolute_expires_at > $2
            LIMIT 1`,
          [tokenDigest, occurredAt],
        );
        const row = result.rows[0];
        return row
          ? Object.freeze({
              sessionId: row.session_id as IdentitySessionId,
              userId: row.user_id as IdentityId,
            })
          : null;
      } catch (error) {
        wrapStoreError(error);
      }
    },

    async findOwnedCampaign(
      actor: ActorContext,
      campaignId: CampaignId,
    ): Promise<CampaignSafeView | null> {
      requireCampaignLookup(actor, campaignId);
      try {
        const result = await pool.query<CampaignRow>(
          `SELECT c.campaign_id, c.title, c.status,
                  c.state_version, c.updated_at
             FROM app.campaigns AS c
            WHERE c.campaign_id = $1
              AND c.user_id = $2
              AND c.deleted_at IS NULL
            LIMIT 1`,
          [campaignId, actor.userId],
        );
        const row = result.rows[0];
        return row ? mapCampaign(row) : null;
      } catch (error) {
        wrapStoreError(error);
      }
    },

    close(): Promise<void> {
      closePromise ??= pool.end().catch(() => {
        throw storeUnavailable();
      });
      return closePromise;
    },
  });
}
