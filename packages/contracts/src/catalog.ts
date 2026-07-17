import type { z } from "zod";

import { DungeonMasterTurnResultSchema } from "./ai-turn.js";
import {
  ApiErrorResponseSchema,
  SubmitTurnAcceptedResponseSchema,
  SubmitTurnRequestSchema,
} from "./api.js";
import {
  CampaignDetailResponseSchema,
  CampaignErrorResponseSchema,
  CampaignIdSchema,
} from "./campaign.js";
import { TurnStreamEventSchema } from "./events.js";
import { GameEventSchema } from "./game-event.js";
import {
  AuthenticatedResponseSchema,
  PasswordResetCompletedResponseSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestedResponseSchema,
  PasswordResetRequestSchema,
  RevokeAllSessionsRequestSchema,
  SignInRequestSchema,
} from "./identity-access.js";
import {
  IdempotencyKeySchema,
  IdentityErrorResponseSchema,
  ResendVerificationRequestSchema,
  SignUpRequestSchema,
  VerificationRequiredResponseSchema,
  VerifiedResponseSchema,
  VerifyEmailRequestSchema,
} from "./identity.js";

export type ContractKind = "request" | "response" | "event" | "ai_output";

export interface ContractCatalogEntry {
  readonly name: string;
  readonly kind: ContractKind;
  readonly fileName: string;
  readonly schema: z.ZodType;
}

function contract(
  name: string,
  kind: ContractKind,
  fileName: string,
  schema: z.ZodType,
): ContractCatalogEntry {
  return Object.freeze({ fileName, kind, name, schema });
}

export const CONTRACT_CATALOG: readonly ContractCatalogEntry[] = Object.freeze([
  contract(
    "AuthenticatedResponse",
    "response",
    "authenticated-response.schema.json",
    AuthenticatedResponseSchema,
  ),
  contract(
    "ApiErrorResponse",
    "response",
    "api-error-response.schema.json",
    ApiErrorResponseSchema,
  ),
  contract(
    "CampaignDetailResponse",
    "response",
    "campaign-detail-response.schema.json",
    CampaignDetailResponseSchema,
  ),
  contract(
    "CampaignErrorResponse",
    "response",
    "campaign-error-response.schema.json",
    CampaignErrorResponseSchema,
  ),
  contract(
    "CampaignId",
    "request",
    "campaign-id.schema.json",
    CampaignIdSchema,
  ),
  contract(
    "DungeonMasterTurnResult",
    "ai_output",
    "dungeon-master-turn-result.schema.json",
    DungeonMasterTurnResultSchema,
  ),
  contract(
    "IdempotencyKey",
    "request",
    "idempotency-key.schema.json",
    IdempotencyKeySchema,
  ),
  contract(
    "IdentityErrorResponse",
    "response",
    "identity-error-response.schema.json",
    IdentityErrorResponseSchema,
  ),
  contract(
    "PasswordResetCompletedResponse",
    "response",
    "password-reset-completed-response.schema.json",
    PasswordResetCompletedResponseSchema,
  ),
  contract(
    "PasswordResetConfirm",
    "request",
    "password-reset-confirm.schema.json",
    PasswordResetConfirmSchema,
  ),
  contract(
    "PasswordResetRequestedResponse",
    "response",
    "password-reset-requested-response.schema.json",
    PasswordResetRequestedResponseSchema,
  ),
  contract(
    "PasswordResetRequest",
    "request",
    "password-reset-request.schema.json",
    PasswordResetRequestSchema,
  ),
  contract(
    "ResendVerificationRequest",
    "request",
    "resend-verification-request.schema.json",
    ResendVerificationRequestSchema,
  ),
  contract(
    "RevokeAllSessionsRequest",
    "request",
    "revoke-all-sessions-request.schema.json",
    RevokeAllSessionsRequestSchema,
  ),
  contract(
    "SignInRequest",
    "request",
    "sign-in-request.schema.json",
    SignInRequestSchema,
  ),
  contract(
    "SignUpRequest",
    "request",
    "sign-up-request.schema.json",
    SignUpRequestSchema,
  ),
  contract("GameEvent", "event", "game-event.schema.json", GameEventSchema),
  contract(
    "SubmitTurnAcceptedResponse",
    "response",
    "submit-turn-accepted-response.schema.json",
    SubmitTurnAcceptedResponseSchema,
  ),
  contract(
    "SubmitTurnRequest",
    "request",
    "submit-turn-request.schema.json",
    SubmitTurnRequestSchema,
  ),
  contract(
    "VerificationRequiredResponse",
    "response",
    "verification-required-response.schema.json",
    VerificationRequiredResponseSchema,
  ),
  contract(
    "VerifiedResponse",
    "response",
    "verified-response.schema.json",
    VerifiedResponseSchema,
  ),
  contract(
    "VerifyEmailRequest",
    "request",
    "verify-email-request.schema.json",
    VerifyEmailRequestSchema,
  ),
  contract(
    "TurnStreamEvent",
    "event",
    "turn-stream-event.schema.json",
    TurnStreamEventSchema,
  ),
]);
