import { z } from "zod";

import {
  JsonValueSchema,
  OpaqueIdentifierSchema,
  UuidV7Schema,
} from "./identifiers.js";

const ShortTextSchema = z.string().min(1).max(500);
const NarrativeTextSchema = z.string().min(1).max(12_000);
const EvidenceEventIdsSchema = z.array(UuidV7Schema).min(1).max(32);

export const InteractionModeSchema = z.enum([
  "free_action",
  "closed_choice",
  "skill_check",
  "combat",
  "dialogue",
  "inventory",
  "relationship",
  "quest_update",
  "scene_transition",
  "campaign_ending",
]);

const DialogueLineSchema = z.strictObject({
  speakerEntityId: UuidV7Schema,
  text: z.string().min(1).max(2_000),
  delivery: z.string().min(1).max(240).optional(),
  audienceEntityIds: z.array(UuidV7Schema).max(32).optional(),
});

const SuggestedActionSchema = z.strictObject({
  id: OpaqueIdentifierSchema,
  label: z.string().min(1).max(120),
  intentHint: OpaqueIdentifierSchema,
  mode: z.enum(["choice", "free_text_seed", "combat_action"]),
  choiceOptionId: OpaqueIdentifierSchema.optional(),
});

const RequestedCheckSchema = z.strictObject({
  requestId: OpaqueIdentifierSchema,
  actorId: UuidV7Schema,
  skill: OpaqueIdentifierSchema,
  proposedDifficultyBand: z.enum([
    "routine",
    "easy",
    "standard",
    "hard",
    "extreme",
  ]),
  advantageReason: ShortTextSchema.optional(),
  disadvantageReason: ShortTextSchema.optional(),
  successStakes: ShortTextSchema,
  failureStakes: ShortTextSchema,
});

const ProposedStateChangeSchema = z.strictObject({
  proposalId: OpaqueIdentifierSchema,
  kind: z.enum([
    "location_intent",
    "npc_disposition_hint",
    "scene_fact_candidate",
    "item_reward_request",
    "condition_request",
  ]),
  entityId: UuidV7Schema.optional(),
  payload: JsonValueSchema,
  evidenceEventIds: EvidenceEventIdsSchema,
});

const QuestUpdateProposalSchema = z.strictObject({
  questId: UuidV7Schema,
  stepId: UuidV7Schema.optional(),
  proposedTransition: z.enum(["start", "advance", "complete", "fail"]),
  evidenceEventIds: EvidenceEventIdsSchema,
  reason: ShortTextSchema,
});

const RelationshipUpdateProposalSchema = z.strictObject({
  targetNpcId: UuidV7Schema,
  axis: z.enum([
    "trust",
    "affection",
    "respect",
    "fear",
    "attraction",
    "resentment",
  ]),
  proposedDelta: z.number().int().min(-5).max(5),
  reason: ShortTextSchema,
  evidenceEventIds: EvidenceEventIdsSchema,
  proposedMilestoneId: UuidV7Schema.optional(),
});

const SceneTransitionProposalSchema = z.strictObject({
  targetLocationId: UuidV7Schema,
  reason: ShortTextSchema,
  participantEntityIds: z.array(UuidV7Schema).min(1).max(32),
  proposedSceneObjective: ShortTextSchema,
  evidenceEventIds: EvidenceEventIdsSchema,
});

const MemoryCandidateSchema = z.strictObject({
  type: OpaqueIdentifierSchema,
  summary: z.string().min(1).max(1_000),
  importance: z.number().min(0).max(1),
  emotionalWeight: z.number().min(0).max(1),
  entityIds: z.array(UuidV7Schema).min(1).max(32),
  visibility: z.enum(["world", "party", "player", "npc_private"]),
  ownerNpcId: UuidV7Schema.optional(),
  sourceEventIds: EvidenceEventIdsSchema,
});

const SafetyFlagSchema = z.strictObject({
  category: OpaqueIdentifierSchema,
  severity: z.enum(["info", "warning", "critical"]),
  actionHint: z.enum(["allow", "constrain", "rewrite", "block"]),
});

const CampaignProgressionProposalSchema = z.strictObject({
  proposedMilestoneIds: z.array(UuidV7Schema).max(16),
  proposedClockAdvances: z
    .array(
      z.strictObject({
        clockId: UuidV7Schema,
        ticks: z.number().int().min(1).max(10),
        evidenceEventIds: EvidenceEventIdsSchema,
      }),
    )
    .max(16),
  pacingHint: z.enum(["slow_down", "maintain", "escalate", "converge"]),
});

export const DungeonMasterTurnResultSchema = z.strictObject({
  turnId: UuidV7Schema,
  interactionMode: InteractionModeSchema,
  narration: NarrativeTextSchema,
  spokenDialogue: z.array(DialogueLineSchema).max(32).optional(),
  suggestedActions: z.array(SuggestedActionSchema).max(6),
  freeTextAllowed: z.boolean(),
  activeEntityIds: z.array(UuidV7Schema).min(1).max(64),
  requestedChecks: z.array(RequestedCheckSchema).max(8),
  proposedStateChanges: z.array(ProposedStateChangeSchema).max(16),
  questUpdates: z.array(QuestUpdateProposalSchema).max(16),
  relationshipUpdates: z.array(RelationshipUpdateProposalSchema).max(16),
  sceneTransition: SceneTransitionProposalSchema.optional(),
  memoryCandidates: z.array(MemoryCandidateSchema).max(24),
  safetyFlags: z.array(SafetyFlagSchema).max(16),
  campaignProgression: CampaignProgressionProposalSchema,
  endingStatus: z.enum(["not_ready", "approaching", "ready", "completed"]),
});

export type InteractionMode = z.infer<typeof InteractionModeSchema>;
export type DungeonMasterTurnResult = z.infer<
  typeof DungeonMasterTurnResultSchema
>;
