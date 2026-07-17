import type { ActorContext } from "../access/actor-context.js";

import type { CampaignId, CampaignSafeView } from "./types.js";

export interface CampaignReader {
  findOwnedCampaign(
    actor: ActorContext,
    campaignId: CampaignId,
  ): Promise<CampaignSafeView | null>;
}
