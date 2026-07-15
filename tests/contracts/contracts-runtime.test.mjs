import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { URL } from "node:url";

const contracts = await import("../../packages/contracts/dist/index.js");
const requireFromContracts = createRequire(
  new URL("../../packages/contracts/package.json", import.meta.url),
);
const { z } = requireFromContracts("zod");

const CAMPAIGN_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000101";
const TURN_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000102";
const EVENT_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000103";
const CAUSATION_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000104";
const CORRELATION_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000105";
const REQUEST_ID = "3b241101-e2bb-4255-8caf-4136c566a962";
const PLAYER_ENTITY_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000111";
const COMPANION_ENTITY_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000112";
const GUARD_ENTITY_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000113";
const BRIDGE_LOCATION_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000114";
const BALCONY_LOCATION_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000115";
const BALCONY_ZONE_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000116";
const QUEST_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000117";
const QUEST_STEP_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000118";
const MILESTONE_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000119";
const CLOCK_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000120";

function roundtrip(schema, value) {
  const parsed = schema.parse(value);
  const serialized = JSON.parse(JSON.stringify(parsed));

  assert.deepEqual(schema.parse(serialized), value);
}

const validSubmitTurnRequests = [
  {
    mode: "free_action",
    input: "Osservo le rune senza toccarle.",
    clientStateVersion: 4,
  },
  {
    mode: "dialogue",
    input: "Chiedo a Sera cosa ricorda del ponte.",
    clientStateVersion: 4,
  },
  {
    mode: "relationship",
    input: "La ringrazio per avermi protetto.",
    clientStateVersion: 4,
  },
  {
    mode: "closed_choice",
    choiceSetId: "bridge_escape",
    optionId: "swing_to_balcony",
    optionalComment: "Provo a mantenere la presa.",
    clientStateVersion: 4,
  },
  {
    mode: "combat",
    combatAction: {
      actionDefinitionId: "careful_strike",
      targetEntityIds: [GUARD_ENTITY_ID],
      destinationZoneId: BALCONY_ZONE_ID,
      parameters: { careful: true, intensity: 2, style: "wide" },
    },
    clientStateVersion: 4,
  },
];

const validAcceptedResponse = {
  turnId: TURN_ID,
  status: "queued",
  streamUrl: `/api/turns/${TURN_ID}/stream`,
  requestId: REQUEST_ID,
};

const validErrorResponse = {
  error: {
    code: "STATE_VERSION_CONFLICT",
    message: "Lo stato della campagna è cambiato.",
    requestId: REQUEST_ID,
    retryable: false,
    details: [
      {
        path: "clientStateVersion",
        code: "stale_value",
        message: "Aggiorna lo stato prima di continuare.",
      },
    ],
    currentStateVersion: 5,
  },
};

const validGameEvent = {
  id: EVENT_ID,
  campaignId: CAMPAIGN_ID,
  sequence: 12,
  aggregateType: "campaign",
  aggregateId: CAMPAIGN_ID,
  eventType: "turn.accepted.v1",
  eventVersion: 1,
  turnId: TURN_ID,
  causationId: CAUSATION_ID,
  correlationId: CORRELATION_ID,
  actorType: "player",
  actorId: PLAYER_ENTITY_ID,
  payload: { baseStateVersion: 4, tags: ["accepted"] },
  metadata: {
    schemaVersion: 1,
    requestId: REQUEST_ID,
    rulesVersion: "rules_v1",
    bibleVersion: 2,
  },
  occurredAt: "2026-07-15T12:00:00.000Z",
};

const validDungeonMasterTurnResult = {
  turnId: TURN_ID,
  interactionMode: "dialogue",
  narration: "La catena vibra mentre Sera indica una balconata laterale.",
  spokenDialogue: [
    {
      speakerEntityId: COMPANION_ENTITY_ID,
      text: "Spostati verso la parete, ora.",
      delivery: "con fermezza",
      audienceEntityIds: [PLAYER_ENTITY_ID],
    },
  ],
  suggestedActions: [
    {
      id: "sug_swing",
      label: "Oscillare verso la balconata",
      intentHint: "swing_to_balcony",
      mode: "free_text_seed",
    },
  ],
  freeTextAllowed: true,
  activeEntityIds: [PLAYER_ENTITY_ID, COMPANION_ENTITY_ID, BRIDGE_LOCATION_ID],
  requestedChecks: [
    {
      requestId: "check_balance_1",
      actorId: PLAYER_ENTITY_ID,
      skill: "agility",
      proposedDifficultyBand: "hard",
      successStakes: "Raggiungere la balconata.",
      failureStakes: "Perdere tempo e attirare le guardie.",
    },
  ],
  proposedStateChanges: [
    {
      proposalId: "proposal_fact_1",
      kind: "scene_fact_candidate",
      entityId: BRIDGE_LOCATION_ID,
      payload: { fact: "La catena raggiunge la balconata." },
      evidenceEventIds: [EVENT_ID],
    },
  ],
  questUpdates: [
    {
      questId: QUEST_ID,
      stepId: QUEST_STEP_ID,
      proposedTransition: "advance",
      evidenceEventIds: [EVENT_ID],
      reason: "Il gruppo ha individuato una via d'uscita.",
    },
  ],
  relationshipUpdates: [
    {
      targetNpcId: COMPANION_ENTITY_ID,
      axis: "respect",
      proposedDelta: 1,
      reason: "Il protagonista ha seguito il consiglio sotto pressione.",
      evidenceEventIds: [EVENT_ID],
      proposedMilestoneId: MILESTONE_ID,
    },
  ],
  sceneTransition: {
    targetLocationId: BALCONY_LOCATION_ID,
    reason: "La balconata è raggiungibile dalla catena.",
    participantEntityIds: [PLAYER_ENTITY_ID, COMPANION_ENTITY_ID],
    proposedSceneObjective: "Sfuggire alle guardie.",
    evidenceEventIds: [EVENT_ID],
  },
  memoryCandidates: [
    {
      type: "shared_danger",
      summary: "Sera guidò il protagonista durante il crollo del ponte.",
      importance: 0.62,
      emotionalWeight: 0.7,
      entityIds: [PLAYER_ENTITY_ID, COMPANION_ENTITY_ID],
      visibility: "party",
      sourceEventIds: [EVENT_ID],
    },
  ],
  safetyFlags: [],
  campaignProgression: {
    proposedMilestoneIds: [MILESTONE_ID],
    proposedClockAdvances: [
      {
        clockId: CLOCK_ID,
        ticks: 1,
        evidenceEventIds: [EVENT_ID],
      },
    ],
    pacingHint: "maintain",
  },
  endingStatus: "not_ready",
};

const validStreamEvents = [
  {
    schemaVersion: 1,
    id: "1",
    event: "turn.accepted",
    data: {
      turnId: TURN_ID,
      requestId: REQUEST_ID,
      baseStateVersion: 4,
      queuePosition: 1,
    },
  },
  {
    schemaVersion: 1,
    id: "2",
    event: "turn.progress",
    data: {
      turnId: TURN_ID,
      requestId: REQUEST_ID,
      stage: "validating",
      percent: 25,
    },
  },
  {
    schemaVersion: 1,
    id: "3",
    event: "turn.completed",
    data: {
      turnId: TURN_ID,
      requestId: REQUEST_ID,
      stateVersion: 5,
      checksum:
        "b8f5f70a6756f3f84f653a8f9f6a7df6d16d8dbddc6db73d09ec4a9e55284d2b",
      completedAt: "2026-07-15T12:00:03.000Z",
    },
  },
  {
    schemaVersion: 1,
    id: "4",
    event: "turn.failed",
    data: {
      turnId: TURN_ID,
      requestId: REQUEST_ID,
      code: "TURN_GENERATION_FAILED",
      retryable: true,
      stateApplied: false,
    },
  },
];

test("submit-turn request modes roundtrip without coercion", () => {
  for (const fixture of validSubmitTurnRequests) {
    roundtrip(contracts.SubmitTurnRequestSchema, fixture);
  }
});

test("submit-turn requests reject unknown, prohibited and unbounded input", () => {
  const invalidRequests = [
    { ...validSubmitTurnRequests[0], damage: 12 },
    { ...validSubmitTurnRequests[0], roll: 20 },
    { ...validSubmitTurnRequests[0], toolName: "run_sql" },
    { ...validSubmitTurnRequests[0], clientStateVersion: 0 },
    { ...validSubmitTurnRequests[0], input: "x".repeat(2_001) },
    {
      mode: "closed_choice",
      choiceSetId: "bridge_escape",
      clientStateVersion: 4,
    },
  ];

  for (const fixture of invalidRequests) {
    assert.equal(
      contracts.SubmitTurnRequestSchema.safeParse(fixture).success,
      false,
    );
  }
});

test("API responses roundtrip and reject hidden or malformed fields", () => {
  roundtrip(contracts.SubmitTurnAcceptedResponseSchema, validAcceptedResponse);
  roundtrip(contracts.ApiErrorResponseSchema, validErrorResponse);

  assert.equal(
    contracts.SubmitTurnAcceptedResponseSchema.safeParse({
      ...validAcceptedResponse,
      hiddenBible: { ending: "secret" },
    }).success,
    false,
  );
  assert.equal(
    contracts.ApiErrorResponseSchema.safeParse({
      error: { ...validErrorResponse.error, requestId: "req_not_canonical" },
    }).success,
    false,
  );
});

test("GameEvent accepts JSON payloads and rejects broken canonical metadata", () => {
  roundtrip(contracts.GameEventSchema, validGameEvent);

  for (const fixture of [
    { ...validGameEvent, sequence: 0 },
    { ...validGameEvent, id: REQUEST_ID },
    { ...validGameEvent, eventVersion: 2 },
    { ...validGameEvent, eventType: "turn.accepted.v2" },
    {
      ...validGameEvent,
      metadata: { ...validGameEvent.metadata, schemaVersion: 2 },
    },
    { ...validGameEvent, payload: new Date() },
    {
      ...validGameEvent,
      metadata: { ...validGameEvent.metadata, secret: "must-not-pass" },
    },
  ]) {
    assert.equal(contracts.GameEventSchema.safeParse(fixture).success, false);
  }
});

test("DungeonMasterTurnResult validates proposals without making them canonical", () => {
  roundtrip(
    contracts.DungeonMasterTurnResultSchema,
    validDungeonMasterTurnResult,
  );

  assert.equal(
    contracts.DungeonMasterTurnResultSchema.safeParse({
      ...validDungeonMasterTurnResult,
      endingStatus: "completed_by_model",
    }).success,
    false,
  );
  assert.equal(
    contracts.DungeonMasterTurnResultSchema.safeParse({
      ...validDungeonMasterTurnResult,
      relationshipUpdates: [
        {
          ...validDungeonMasterTurnResult.relationshipUpdates[0],
          proposedDelta: 99,
        },
      ],
    }).success,
    false,
  );
});

test("turn stream lifecycle events roundtrip and reject unknown versions", () => {
  for (const fixture of validStreamEvents) {
    roundtrip(contracts.TurnStreamEventSchema, fixture);
  }

  assert.equal(
    contracts.TurnStreamEventSchema.safeParse({
      ...validStreamEvents[0],
      schemaVersion: 2,
    }).success,
    false,
  );
});

test("AI tool envelopes require the caller-provided allowlist", () => {
  const toolCallSchema = contracts.createAIToolCallSchema(
    z.enum(["perform_skill_check"]),
    z.strictObject({ actorId: z.string(), skill: z.string() }),
  );
  const validToolCall = {
    toolCallId: "tool_call_1",
    turnId: TURN_ID,
    toolName: "perform_skill_check",
    schemaVersion: 1,
    arguments: { actorId: "pc_1", skill: "agility" },
    rationaleCode: "uncertain_action",
  };

  roundtrip(toolCallSchema, validToolCall);
  assert.equal(
    toolCallSchema.safeParse({ ...validToolCall, toolName: "run_sql" }).success,
    false,
  );
});
