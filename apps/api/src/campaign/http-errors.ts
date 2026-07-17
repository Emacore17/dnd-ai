import type { CampaignErrorResponse } from "@dnd-ai/contracts";
import type { FastifyReply } from "fastify";

import {
  CampaignAccessError,
  type CampaignAccessErrorCode,
} from "./campaign-access-service.js";

export interface CampaignHttpError {
  readonly body: CampaignErrorResponse;
  readonly statusCode: number;
}

const CAMPAIGN_ERROR_MAP = Object.freeze({
  SESSION_INVALID: Object.freeze({
    code: "identity.session_invalid" as const,
    message: "La sessione non è valida.",
    retryable: false,
    statusCode: 401,
  }),
  NOT_FOUND: Object.freeze({
    code: "campaign.not_found" as const,
    message: "Campagna non trovata.",
    retryable: false,
    statusCode: 404,
  }),
  UNAVAILABLE: Object.freeze({
    code: "campaign.unavailable" as const,
    message: "Servizio temporaneamente non disponibile.",
    retryable: true,
    statusCode: 503,
  }),
}) satisfies Readonly<
  Record<
    CampaignAccessErrorCode,
    Readonly<{
      code: CampaignErrorResponse["error"]["code"];
      message: string;
      retryable: boolean;
      statusCode: number;
    }>
  >
>;

function httpError(
  requestId: string,
  definition: Readonly<{
    code: CampaignErrorResponse["error"]["code"];
    message: string;
    retryable: boolean;
    statusCode: number;
  }>,
): CampaignHttpError {
  return Object.freeze({
    body: Object.freeze({
      error: Object.freeze({
        code: definition.code,
        message: definition.message,
        requestId,
        retryable: definition.retryable,
      }),
    }),
    statusCode: definition.statusCode,
  });
}

export function campaignRequestError(requestId: string): CampaignHttpError {
  return httpError(
    requestId,
    Object.freeze({
      code: "campaign.request_invalid",
      message: "Richiesta non valida.",
      retryable: false,
      statusCode: 400,
    }),
  );
}

export function toCampaignHttpError(
  error: unknown,
  requestId: string,
): CampaignHttpError {
  const applicationError =
    error instanceof CampaignAccessError
      ? error
      : new CampaignAccessError("UNAVAILABLE");
  return httpError(requestId, CAMPAIGN_ERROR_MAP[applicationError.code]);
}

export function sendCampaignError(
  reply: FastifyReply,
  error: CampaignHttpError,
): void {
  reply.header("cache-control", "private, no-store");
  void reply.code(error.statusCode).send(error.body);
}
