import { z } from "zod";

import {
  CorrelationIdentifierSchema,
  EventTypeSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  OpaqueIdentifierSchema,
  RequestIdSchema,
  SequenceSchema,
  UuidV7Schema,
} from "./identifiers.js";
import { CONTRACT_SCHEMA_VERSION } from "./version.js";

const GameEventMetadataSchema = z.strictObject({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  requestId: RequestIdSchema,
  rulesVersion: OpaqueIdentifierSchema,
  bibleVersion: z.number().int().min(1).max(2_147_483_647).optional(),
});

function createGameEventSchema<
  TEventType extends z.ZodType<string>,
  TPayload extends z.ZodType,
>(eventTypeSchema: TEventType, payloadSchema: TPayload) {
  return z.strictObject({
    id: UuidV7Schema,
    campaignId: UuidV7Schema,
    sequence: SequenceSchema,
    aggregateType: OpaqueIdentifierSchema,
    aggregateId: UuidV7Schema,
    eventType: eventTypeSchema,
    eventVersion: z.literal(CONTRACT_SCHEMA_VERSION),
    turnId: UuidV7Schema.optional(),
    causationId: CorrelationIdentifierSchema,
    correlationId: CorrelationIdentifierSchema,
    actorType: z.enum(["player", "system", "ai_proposal", "admin"]),
    actorId: UuidV7Schema.optional(),
    payload: payloadSchema,
    metadata: GameEventMetadataSchema,
    occurredAt: IsoDateTimeSchema,
  });
}

export const GameEventSchema = createGameEventSchema(
  EventTypeSchema,
  JsonValueSchema,
);

export type GameEvent = z.infer<typeof GameEventSchema>;
