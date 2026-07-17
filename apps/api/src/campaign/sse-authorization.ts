import type { CampaignId } from "@dnd-ai/domain";

import {
  createOwnedSsePreHandler,
  type OwnedSseFailure,
} from "../access/owned-sse-authorization.js";
import {
  CampaignAccessError,
  type CampaignAccessService,
} from "./campaign-access-service.js";
import {
  campaignRequestError,
  sendCampaignError,
  toCampaignHttpError,
} from "./http-errors.js";
import { readCampaignRequest } from "./request-context.js";

export interface CreateCampaignSseAuthorizationPreHandlerOptions {
  readonly service: CampaignAccessService;
}

function failureError(failure: OwnedSseFailure, requestId: string) {
  switch (failure) {
    case "request_invalid":
      return campaignRequestError(requestId);
    case "session_invalid":
      return toCampaignHttpError(
        new CampaignAccessError("SESSION_INVALID"),
        requestId,
      );
    case "not_found":
      return toCampaignHttpError(
        new CampaignAccessError("NOT_FOUND"),
        requestId,
      );
    case "unavailable":
      return toCampaignHttpError(
        new CampaignAccessError("UNAVAILABLE"),
        requestId,
      );
  }
}

export function createCampaignSseAuthorizationPreHandler(
  options: CreateCampaignSseAuthorizationPreHandlerOptions,
) {
  return createOwnedSsePreHandler<CampaignId>({
    async existsOwned(actor, campaignId) {
      try {
        await options.service.getCampaign(actor, campaignId);
        return true;
      } catch (error) {
        if (
          error instanceof CampaignAccessError &&
          error.code === "NOT_FOUND"
        ) {
          return false;
        }
        throw error;
      }
    },
    fallbackRequestId(request, reply) {
      return readCampaignRequest(request, reply).requestId;
    },
    async resolve(request, reply) {
      const boundary = readCampaignRequest(request, reply);
      if (boundary.campaignId === null) {
        return Object.freeze({
          failure: "request_invalid" as const,
          ok: false as const,
          requestId: boundary.requestId,
        });
      }

      try {
        const actor = await options.service.authenticate(
          boundary.sessionToken,
          Object.freeze({
            correlationId: boundary.correlationId,
            requestId: boundary.requestId,
          }),
        );
        return Object.freeze({
          actor,
          identifier: boundary.campaignId,
          ok: true as const,
          requestId: boundary.requestId,
        });
      } catch (error) {
        if (
          error instanceof CampaignAccessError &&
          error.code === "SESSION_INVALID"
        ) {
          return Object.freeze({
            failure: "session_invalid" as const,
            ok: false as const,
            requestId: boundary.requestId,
          });
        }
        throw error;
      }
    },
    sendFailure(reply, failure, requestId) {
      sendCampaignError(reply, failureError(failure, requestId));
    },
  });
}
