import { CampaignDetailResponseSchema } from "@dnd-ai/contracts";
import type { FastifyInstance } from "fastify";

import type { CampaignAccessService } from "./campaign-access-service.js";
import {
  campaignRequestError,
  sendCampaignError,
  toCampaignHttpError,
} from "./http-errors.js";
import { readCampaignRequest } from "./request-context.js";

export const CAMPAIGN_READ_RATE_LIMIT_CLASS = "campaign.read" as const;

export interface RegisterCampaignRoutesOptions {
  readonly service: CampaignAccessService;
}

export function registerCampaignRoutes(
  app: FastifyInstance,
  options: RegisterCampaignRoutesOptions,
): void {
  app.get<{ Params: { campaignId: string } }>(
    "/api/campaigns/:campaignId",
    { config: { rateLimitClass: CAMPAIGN_READ_RATE_LIMIT_CLASS } },
    async (request, reply) => {
      const boundary = readCampaignRequest(request, reply);
      if (boundary.campaignId === null) {
        sendCampaignError(reply, campaignRequestError(boundary.requestId));
        return;
      }

      try {
        const actor = await options.service.authenticate(
          boundary.sessionToken,
          Object.freeze({
            correlationId: boundary.correlationId,
            requestId: boundary.requestId,
          }),
        );
        const campaign = await options.service.getCampaign(
          actor,
          boundary.campaignId,
        );
        const body = CampaignDetailResponseSchema.parse({
          ...campaign,
          updatedAt: campaign.updatedAt.toISOString(),
        });
        reply.header("cache-control", "private, no-store");
        await reply.code(200).send(body);
      } catch (error) {
        sendCampaignError(
          reply,
          toCampaignHttpError(error, boundary.requestId),
        );
      }
    },
  );
}
