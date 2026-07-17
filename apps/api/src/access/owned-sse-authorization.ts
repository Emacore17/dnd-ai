import type { ActorContext } from "@dnd-ai/domain";
import type { FastifyReply, FastifyRequest } from "fastify";

export type OwnedSseFailure =
  "request_invalid" | "session_invalid" | "not_found" | "unavailable";

export type OwnedSseResolution<TIdentifier> =
  | Readonly<{
      ok: true;
      actor: ActorContext;
      identifier: TIdentifier;
      requestId: string;
    }>
  | Readonly<{
      ok: false;
      failure: Exclude<OwnedSseFailure, "not_found">;
      requestId: string;
    }>;

export interface CreateOwnedSsePreHandlerOptions<TIdentifier> {
  readonly existsOwned: (
    actor: ActorContext,
    identifier: TIdentifier,
  ) => Promise<boolean>;
  readonly fallbackRequestId: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => string;
  readonly resolve: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<OwnedSseResolution<TIdentifier>>;
  readonly sendFailure: (
    reply: FastifyReply,
    failure: OwnedSseFailure,
    requestId: string,
  ) => void;
}

export function createOwnedSsePreHandler<TIdentifier>(
  options: Readonly<CreateOwnedSsePreHandlerOptions<TIdentifier>>,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    let resolved: OwnedSseResolution<TIdentifier>;
    try {
      resolved = await options.resolve(request, reply);
    } catch {
      options.sendFailure(
        reply,
        "unavailable",
        options.fallbackRequestId(request, reply),
      );
      return;
    }

    if (!resolved.ok) {
      options.sendFailure(reply, resolved.failure, resolved.requestId);
      return;
    }

    try {
      if (!(await options.existsOwned(resolved.actor, resolved.identifier))) {
        options.sendFailure(reply, "not_found", resolved.requestId);
      }
    } catch {
      options.sendFailure(reply, "unavailable", resolved.requestId);
    }
  };
}
