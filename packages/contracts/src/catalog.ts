import type { z } from "zod";

import { DungeonMasterTurnResultSchema } from "./ai-turn.js";
import {
  ApiErrorResponseSchema,
  SubmitTurnAcceptedResponseSchema,
  SubmitTurnRequestSchema,
} from "./api.js";
import { TurnStreamEventSchema } from "./events.js";
import { GameEventSchema } from "./game-event.js";

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
    "ApiErrorResponse",
    "response",
    "api-error-response.schema.json",
    ApiErrorResponseSchema,
  ),
  contract(
    "DungeonMasterTurnResult",
    "ai_output",
    "dungeon-master-turn-result.schema.json",
    DungeonMasterTurnResultSchema,
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
    "TurnStreamEvent",
    "event",
    "turn-stream-event.schema.json",
    TurnStreamEventSchema,
  ),
]);
