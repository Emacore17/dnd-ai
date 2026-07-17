import {
  createActorContext,
  type ActorContext,
  type CampaignId,
  type CampaignReader,
  type CampaignSafeView,
  type IdentityClock,
  type IdentityCryptography,
  type IdentitySessionReader,
} from "@dnd-ai/domain";

export type CampaignAccessErrorCode =
  "SESSION_INVALID" | "NOT_FOUND" | "UNAVAILABLE";

export class CampaignAccessError extends Error {
  readonly code: CampaignAccessErrorCode;

  constructor(code: CampaignAccessErrorCode) {
    super("Campaign access failed.");
    this.name = "CampaignAccessError";
    this.code = code;
  }
}

export interface CampaignAccessService {
  authenticate(
    sessionToken: string | null,
    context: Readonly<{ requestId: string; correlationId: string }>,
  ): Promise<ActorContext>;
  getCampaign(
    actor: ActorContext,
    campaignId: CampaignId,
  ): Promise<CampaignSafeView>;
}

export interface CreateCampaignAccessServiceOptions {
  readonly campaignReader: CampaignReader;
  readonly clock: IdentityClock;
  readonly cryptography: Pick<IdentityCryptography, "sessionTokenDigest">;
  readonly sessionReader: IdentitySessionReader;
}

function accessError(code: CampaignAccessErrorCode): CampaignAccessError {
  return new CampaignAccessError(code);
}

export function createCampaignAccessService(
  options: CreateCampaignAccessServiceOptions,
): CampaignAccessService {
  return Object.freeze({
    async authenticate(
      sessionToken: string | null,
      context: Readonly<{ requestId: string; correlationId: string }>,
    ) {
      if (sessionToken === null) throw accessError("SESSION_INVALID");

      let tokenDigest: string;
      try {
        tokenDigest = options.cryptography.sessionTokenDigest(sessionToken);
      } catch {
        throw accessError("SESSION_INVALID");
      }

      let session;
      try {
        session = await options.sessionReader.resolveActiveSession(
          tokenDigest,
          options.clock.now(),
        );
      } catch {
        throw accessError("UNAVAILABLE");
      }
      if (session === null) throw accessError("SESSION_INVALID");

      return createActorContext({
        correlationId: context.correlationId,
        requestId: context.requestId,
        sessionId: session.sessionId,
        userId: session.userId,
      });
    },

    async getCampaign(actor: ActorContext, campaignId: CampaignId) {
      let campaign;
      try {
        campaign = await options.campaignReader.findOwnedCampaign(
          actor,
          campaignId,
        );
      } catch {
        throw accessError("UNAVAILABLE");
      }
      if (campaign === null) throw accessError("NOT_FOUND");
      return campaign;
    },
  });
}
