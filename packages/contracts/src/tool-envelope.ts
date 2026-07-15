import { z } from "zod";

import {
  CorrelationIdentifierSchema,
  OpaqueIdentifierSchema,
  StateVersionSchema,
  UuidV7Schema,
} from "./identifiers.js";
import { CONTRACT_SCHEMA_VERSION } from "./version.js";

const ToolErrorSchema = z.strictObject({
  code: OpaqueIdentifierSchema,
  messageForModel: z.string().min(1).max(500),
  retryable: z.boolean(),
});

export function createAIToolCallSchema<
  TName extends z.ZodType<string>,
  TArguments extends z.ZodType,
>(toolNameSchema: TName, argumentsSchema: TArguments) {
  return z.strictObject({
    toolCallId: CorrelationIdentifierSchema,
    turnId: UuidV7Schema,
    toolName: toolNameSchema,
    schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
    arguments: argumentsSchema,
    rationaleCode: OpaqueIdentifierSchema,
  });
}

export function createAIToolResultSchema<TData extends z.ZodType>(
  dataSchema: TData,
) {
  return z.strictObject({
    toolCallId: CorrelationIdentifierSchema,
    status: z.enum(["ok", "rejected", "error"]),
    data: dataSchema.optional(),
    error: ToolErrorSchema.optional(),
    canonicalStateVersion: StateVersionSchema,
    pendingEventIds: z.array(UuidV7Schema).max(64),
  });
}
