import type { IdentityId, IdentitySessionId } from "../identity/types.js";

const CONTEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const ERROR_MESSAGE = "actor context metadata is invalid";

export interface ActorContext {
  readonly correlationId: string;
  readonly requestId: string;
  readonly sessionId: IdentitySessionId;
  readonly userId: IdentityId;
}

export function createActorContext(input: ActorContext): ActorContext {
  if (
    !CONTEXT_ID_PATTERN.test(input.requestId) ||
    !CONTEXT_ID_PATTERN.test(input.correlationId)
  ) {
    throw new TypeError(ERROR_MESSAGE);
  }

  return Object.freeze({ ...input });
}
