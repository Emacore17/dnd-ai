declare const campaignIdBrand: unique symbol;

export type CampaignId = string & { readonly [campaignIdBrand]: true };

export type CampaignStatus =
  | "draft"
  | "ready"
  | "generating"
  | "active"
  | "completed"
  | "abandoned"
  | "failed";

export interface CampaignSafeView {
  readonly id: CampaignId;
  readonly stateVersion: number;
  readonly status: CampaignStatus;
  readonly title: string;
  readonly updatedAt: Date;
}
