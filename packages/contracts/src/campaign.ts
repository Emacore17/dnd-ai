import { z } from "zod";

import {
  IsoDateTimeSchema,
  RequestIdSchema,
  UuidV7Schema,
} from "./identifiers.js";

export const CampaignIdSchema = UuidV7Schema;

export const CampaignStatusSchema = z.enum([
  "draft",
  "ready",
  "generating",
  "active",
  "completed",
  "abandoned",
  "failed",
]);

export const CampaignDetailResponseSchema = z.strictObject({
  id: CampaignIdSchema,
  stateVersion: z.number().int().min(0).max(2_147_483_647),
  status: CampaignStatusSchema,
  title: z.string().trim().min(1).max(80),
  updatedAt: IsoDateTimeSchema,
});

export const CampaignErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      "campaign.request_invalid",
      "identity.session_invalid",
      "campaign.not_found",
      "campaign.unavailable",
    ]),
    message: z.string().min(1).max(500),
    requestId: RequestIdSchema,
    retryable: z.boolean(),
  }),
});

export type CampaignDetailResponse = z.infer<
  typeof CampaignDetailResponseSchema
>;
export type CampaignErrorResponse = z.infer<typeof CampaignErrorResponseSchema>;
export type CampaignId = z.infer<typeof CampaignIdSchema>;
