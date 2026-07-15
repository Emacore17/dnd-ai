import { z } from "zod";

import {
  OpaqueIdentifierSchema,
  RequestIdSchema,
  StateVersionSchema,
  UuidV7Schema,
} from "./identifiers.js";

const PLAYER_INPUT_LIMIT = 2_000;
const OPTIONAL_COMMENT_LIMIT = 500;
const ERROR_DETAIL_LIMIT = 20;
// The bounded character classes contain no ambiguous backtracking path.
// eslint-disable-next-line security/detect-unsafe-regex
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const PARAMETER_NAME_PATTERN = /^[a-z][A-Za-z0-9_]*$/u;
const STREAM_URL_PATTERN =
  /^\/api\/turns\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/stream$/u;

const ClientStateVersionSchema = StateVersionSchema;
const PlayerInputSchema = z.string().min(1).max(PLAYER_INPUT_LIMIT);

const FreeTextTurnRequestSchema = z.strictObject({
  mode: z.enum(["free_action", "dialogue", "relationship"]),
  input: PlayerInputSchema,
  clientStateVersion: ClientStateVersionSchema,
});

const ClosedChoiceTurnRequestSchema = z.strictObject({
  mode: z.literal("closed_choice"),
  choiceSetId: OpaqueIdentifierSchema,
  optionId: OpaqueIdentifierSchema,
  optionalComment: z.string().min(1).max(OPTIONAL_COMMENT_LIMIT).optional(),
  clientStateVersion: ClientStateVersionSchema,
});

const CombatParameterValueSchema = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
]);

const CombatTurnRequestSchema = z.strictObject({
  mode: z.literal("combat"),
  combatAction: z.strictObject({
    actionDefinitionId: OpaqueIdentifierSchema,
    targetEntityIds: z.array(UuidV7Schema).max(16),
    destinationZoneId: UuidV7Schema.optional(),
    parameters: z
      .record(
        z.string().min(1).max(64).regex(PARAMETER_NAME_PATTERN),
        CombatParameterValueSchema,
      )
      .optional(),
  }),
  clientStateVersion: ClientStateVersionSchema,
});

export const SubmitTurnRequestSchema = z.discriminatedUnion("mode", [
  FreeTextTurnRequestSchema,
  ClosedChoiceTurnRequestSchema,
  CombatTurnRequestSchema,
]);

export const SubmitTurnAcceptedResponseSchema = z.strictObject({
  turnId: UuidV7Schema,
  status: z.literal("queued"),
  streamUrl: z.string().regex(STREAM_URL_PATTERN),
  requestId: RequestIdSchema,
});

const ApiErrorDetailSchema = z.strictObject({
  path: z.string().min(1).max(256).optional(),
  code: z
    .string()
    .min(1)
    .max(96)
    .regex(/^[a-z][a-z0-9_]*$/u),
  message: z.string().min(1).max(500),
});

export const ApiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().min(1).max(96).regex(ERROR_CODE_PATTERN),
    message: z.string().min(1).max(500),
    requestId: RequestIdSchema,
    retryable: z.boolean(),
    details: z.array(ApiErrorDetailSchema).max(ERROR_DETAIL_LIMIT).optional(),
    currentStateVersion: StateVersionSchema.optional(),
  }),
});

export type SubmitTurnRequest = z.infer<typeof SubmitTurnRequestSchema>;
export type SubmitTurnAcceptedResponse = z.infer<
  typeof SubmitTurnAcceptedResponseSchema
>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
