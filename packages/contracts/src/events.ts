import { z } from "zod";

import {
  IsoDateTimeSchema,
  RequestIdSchema,
  StateVersionSchema,
  UuidV7Schema,
} from "./identifiers.js";
import { CONTRACT_SCHEMA_VERSION } from "./version.js";

const StreamEventIdSchema = z.string().regex(/^[1-9][0-9]*$/u);
const SafeErrorCodeSchema = z
  .string()
  .min(1)
  .max(96)
  // The bounded character classes contain no ambiguous backtracking path.
  // eslint-disable-next-line security/detect-unsafe-regex
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u);

const TurnAcceptedStreamEventSchema = z.strictObject({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  id: StreamEventIdSchema,
  event: z.literal("turn.accepted"),
  data: z.strictObject({
    turnId: UuidV7Schema,
    requestId: RequestIdSchema,
    baseStateVersion: StateVersionSchema,
    queuePosition: z.number().int().min(1).max(10_000).optional(),
  }),
});

const TurnProgressStreamEventSchema = z.strictObject({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  id: StreamEventIdSchema,
  event: z.literal("turn.progress"),
  data: z.strictObject({
    turnId: UuidV7Schema,
    requestId: RequestIdSchema,
    stage: z.enum([
      "queued",
      "validating",
      "building_context",
      "generating",
      "executing_tools",
      "committing",
      "delivering",
    ]),
    percent: z.number().int().min(0).max(100).optional(),
  }),
});

const TurnCompletedStreamEventSchema = z.strictObject({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  id: StreamEventIdSchema,
  event: z.literal("turn.completed"),
  data: z.strictObject({
    turnId: UuidV7Schema,
    requestId: RequestIdSchema,
    stateVersion: StateVersionSchema,
    checksum: z.string().regex(/^[0-9a-f]{64}$/u),
    completedAt: IsoDateTimeSchema,
  }),
});

const TurnFailedStreamEventSchema = z.strictObject({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  id: StreamEventIdSchema,
  event: z.literal("turn.failed"),
  data: z.strictObject({
    turnId: UuidV7Schema,
    requestId: RequestIdSchema,
    code: SafeErrorCodeSchema,
    retryable: z.boolean(),
    stateApplied: z.boolean(),
  }),
});

export const TurnStreamEventSchema = z.discriminatedUnion("event", [
  TurnAcceptedStreamEventSchema,
  TurnProgressStreamEventSchema,
  TurnCompletedStreamEventSchema,
  TurnFailedStreamEventSchema,
]);

export type TurnStreamEvent = z.infer<typeof TurnStreamEventSchema>;
