import { CampaignIdSchema } from "@dnd-ai/contracts";
import type { CampaignId } from "@dnd-ai/domain";
import { createRequestId } from "@dnd-ai/observability";
import type { FastifyReply, FastifyRequest } from "fastify";

import { readIdentitySessionToken } from "../identity/session-cookie.js";

const CORRELATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export interface CampaignRequestBoundary {
  readonly campaignId: CampaignId | null;
  readonly correlationId: string;
  readonly requestId: string;
  readonly sessionToken: string | null;
}

function singleHeader(
  request: FastifyRequest,
  name: "cookie" | "x-correlation-id" | "x-request-id",
): string | undefined {
  const value = (() => {
    switch (name) {
      case "cookie":
        return request.headers.cookie;
      case "x-correlation-id":
        return request.headers["x-correlation-id"];
      case "x-request-id":
        return request.headers["x-request-id"];
    }
  })();
  return typeof value === "string" ? value : undefined;
}

function currentRequestId(
  request: FastifyRequest,
  reply: FastifyReply,
): string {
  const replyRequestId = reply.getHeader("x-request-id");
  const candidate =
    typeof replyRequestId === "string"
      ? replyRequestId
      : singleHeader(request, "x-request-id");
  const requestId = createRequestId(candidate);
  reply.header("x-request-id", requestId);
  return requestId;
}

function readCampaignId(request: FastifyRequest): CampaignId | null {
  if (typeof request.params !== "object" || request.params === null)
    return null;
  const parsed = CampaignIdSchema.safeParse(
    Reflect.get(request.params, "campaignId"),
  );
  return parsed.success ? (parsed.data as CampaignId) : null;
}

export function readCampaignRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): CampaignRequestBoundary {
  const requestId = currentRequestId(request, reply);
  const correlationHeader = singleHeader(request, "x-correlation-id");

  return Object.freeze({
    campaignId: readCampaignId(request),
    correlationId:
      correlationHeader !== undefined &&
      CORRELATION_PATTERN.test(correlationHeader)
        ? correlationHeader
        : requestId,
    requestId,
    sessionToken: readIdentitySessionToken(singleHeader(request, "cookie")),
  });
}
