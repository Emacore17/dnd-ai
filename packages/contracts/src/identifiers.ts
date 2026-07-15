import { z } from "zod";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
// The bounded character classes contain no ambiguous backtracking path.
// eslint-disable-next-line security/detect-unsafe-regex
const OPAQUE_IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const CORRELATION_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const EVENT_TYPE_PATTERN =
  // The bounded character classes contain no ambiguous backtracking path.
  // eslint-disable-next-line security/detect-unsafe-regex
  /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*\.v1$/u;

export const UuidV7Schema = z
  .string()
  .regex(UUID_V7_PATTERN)
  .meta({ description: "Canonical lowercase UUIDv7." });

export const RequestIdSchema = z
  .string()
  .regex(UUID_V4_PATTERN)
  .meta({ description: "Server-owned canonical lowercase UUIDv4 request ID." });

export const OpaqueIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(OPAQUE_IDENTIFIER_PATTERN);

export const CorrelationIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(CORRELATION_IDENTIFIER_PATTERN);

export const EventTypeSchema = z
  .string()
  .min(5)
  .max(160)
  .regex(EVENT_TYPE_PATTERN)
  .meta({ description: "Version 1 event type ending in .v1." });

export const StateVersionSchema = z.number().int().min(1).max(2_147_483_647);
export const SequenceSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const JsonValueSchema = z.json();

export type UuidV7 = z.infer<typeof UuidV7Schema>;
export type RequestId = z.infer<typeof RequestIdSchema>;
export type OpaqueIdentifier = z.infer<typeof OpaqueIdentifierSchema>;
export type JsonValue = z.infer<typeof JsonValueSchema>;
