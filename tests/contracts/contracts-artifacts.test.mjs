import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { URL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const contracts = await import("../../packages/contracts/dist/index.js");
const requireFromContracts = createRequire(
  new URL("../../packages/contracts/package.json", import.meta.url),
);
const { z } = requireFromContracts("zod");

const expectedCatalog = [
  ["ApiErrorResponse", "response", "api-error-response.schema.json"],
  [
    "DungeonMasterTurnResult",
    "ai_output",
    "dungeon-master-turn-result.schema.json",
  ],
  ["GameEvent", "event", "game-event.schema.json"],
  [
    "SubmitTurnAcceptedResponse",
    "response",
    "submit-turn-accepted-response.schema.json",
  ],
  ["SubmitTurnRequest", "request", "submit-turn-request.schema.json"],
  ["TurnStreamEvent", "event", "turn-stream-event.schema.json"],
];

const TURN_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000102";
const CAMPAIGN_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000101";
const REQUEST_ID = "3b241101-e2bb-4255-8caf-4136c566a962";
const EVENT_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000103";
const PLAYER_ENTITY_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000111";

const validFixtureByContract = {
  ApiErrorResponse: {
    error: {
      code: "STATE_VERSION_CONFLICT",
      message: "State changed.",
      requestId: REQUEST_ID,
      retryable: false,
      currentStateVersion: 5,
    },
  },
  DungeonMasterTurnResult: {
    turnId: TURN_ID,
    interactionMode: "free_action",
    narration: "La sala resta immobile.",
    suggestedActions: [],
    freeTextAllowed: true,
    activeEntityIds: [PLAYER_ENTITY_ID],
    requestedChecks: [],
    proposedStateChanges: [],
    questUpdates: [],
    relationshipUpdates: [],
    memoryCandidates: [],
    safetyFlags: [],
    campaignProgression: {
      proposedMilestoneIds: [],
      proposedClockAdvances: [],
      pacingHint: "maintain",
    },
    endingStatus: "not_ready",
  },
  GameEvent: {
    id: EVENT_ID,
    campaignId: CAMPAIGN_ID,
    sequence: 1,
    aggregateType: "campaign",
    aggregateId: CAMPAIGN_ID,
    eventType: "turn.accepted.v1",
    eventVersion: 1,
    turnId: TURN_ID,
    causationId: "command_1",
    correlationId: REQUEST_ID,
    actorType: "player",
    actorId: PLAYER_ENTITY_ID,
    payload: { accepted: true },
    metadata: {
      schemaVersion: 1,
      requestId: REQUEST_ID,
      rulesVersion: "rules_v1",
    },
    occurredAt: "2026-07-15T12:00:00.000Z",
  },
  SubmitTurnAcceptedResponse: {
    turnId: TURN_ID,
    status: "queued",
    streamUrl: `/api/turns/${TURN_ID}/stream`,
    requestId: REQUEST_ID,
  },
  SubmitTurnRequest: {
    mode: "free_action",
    input: "Osservo la stanza.",
    clientStateVersion: 4,
  },
  TurnStreamEvent: {
    schemaVersion: 1,
    id: "1",
    event: "turn.progress",
    data: {
      turnId: TURN_ID,
      requestId: REQUEST_ID,
      stage: "validating",
      percent: 25,
    },
  },
};

function collectReferences(value, references = []) {
  if (Array.isArray(value)) {
    for (const child of value) {
      collectReferences(child, references);
    }
    return references;
  }

  if (typeof value !== "object" || value === null) {
    return references;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") {
      references.push(child);
    } else {
      collectReferences(child, references);
    }
  }

  return references;
}

test("the v1 contract catalog has stable unique names, kinds and filenames", () => {
  assert.deepEqual(
    contracts.CONTRACT_CATALOG.map(({ fileName, kind, name }) => [
      name,
      kind,
      fileName,
    ]),
    expectedCatalog,
  );
  assert.equal(Object.isFrozen(contracts.CONTRACT_CATALOG), true);
  assert.equal(
    contracts.CONTRACT_CATALOG.every((entry) => Object.isFrozen(entry)),
    true,
  );
});

test("contract artifacts contain versioned JSON Schema and components-only OpenAPI", () => {
  const artifacts = contracts.createContractArtifacts();
  const expectedArtifactPaths = [
    "v1/manifest.json",
    "v1/openapi.json",
    ...expectedCatalog.map(([, , fileName]) => `v1/schemas/${fileName}`),
  ].sort();

  assert.deepEqual(Object.keys(artifacts).sort(), expectedArtifactPaths);

  const manifest = artifacts["v1/manifest.json"];
  assert.equal(manifest.schemaVersion, "contract-artifact-manifest-v1");
  assert.equal(manifest.contractVersion, "1.0.0");
  assert.equal(
    manifest.jsonSchemaDialect,
    "https://json-schema.org/draft/2020-12/schema",
  );
  assert.deepEqual(
    manifest.schemas.map(({ file, kind, name }) => [name, kind, file]),
    expectedCatalog.map(([name, kind, fileName]) => [
      name,
      kind,
      `schemas/${fileName}`,
    ]),
  );

  for (const [name, kind, fileName] of expectedCatalog) {
    const schema = artifacts[`v1/schemas/${fileName}`];

    assert.equal(
      schema.$schema,
      "https://json-schema.org/draft/2020-12/schema",
    );
    assert.equal(schema.$id, `urn:dnd-ai:contracts:v1:${name}`);
    assert.equal(schema.title, name);
    assert.equal(schema["x-dnd-ai-contract-version"], "1.0.0");
    assert.equal(schema["x-dnd-ai-contract-kind"], kind);
  }

  const openapi = artifacts["v1/openapi.json"];
  assert.equal(openapi.openapi, "3.1.1");
  assert.equal(openapi.info.version, "1.0.0");
  assert.equal(
    openapi.jsonSchemaDialect,
    "https://spec.openapis.org/oas/3.1/dialect/base",
  );
  assert.deepEqual(openapi.paths, {});
  assert.deepEqual(
    Object.keys(openapi.components.schemas).sort(),
    expectedCatalog.map(([name]) => name).sort(),
  );
  assert.equal(Object.isFrozen(openapi.components.schemas.GameEvent), true);
});

test("artifact creation fails closed on duplicate names and unrepresentable Zod", () => {
  const first = contracts.CONTRACT_CATALOG[0];

  assert.throws(
    () => contracts.createContractArtifacts([first, { ...first }]),
    /duplicate contract name: ApiErrorResponse/u,
  );
  assert.throws(
    () =>
      contracts.createContractArtifacts([
        {
          name: "UnsupportedContract",
          kind: "event",
          fileName: "unsupported-contract.schema.json",
          schema: z.bigint(),
        },
      ]),
    /BigInt cannot be represented in JSON Schema/u,
  );
});

test("artifact creation returns isolated immutable snapshots", () => {
  const first = contracts.createContractArtifacts();
  const second = contracts.createContractArtifacts();

  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.throws(() => {
    first["v1/openapi.json"].paths.extra = {};
  }, TypeError);
});

test("generated JSON Schema agrees with Zod on valid and unknown-field fixtures", () => {
  const artifacts = contracts.createContractArtifacts();
  const ajv = new Ajv2020({ allErrors: true, strict: true });

  addFormats(ajv);
  ajv.addKeyword({
    keyword: "x-dnd-ai-contract-kind",
    metaSchema: { type: "string" },
  });
  ajv.addKeyword({
    keyword: "x-dnd-ai-contract-version",
    metaSchema: { type: "string" },
  });

  for (const entry of contracts.CONTRACT_CATALOG) {
    const fixture = validFixtureByContract[entry.name];
    const schema = artifacts[`v1/schemas/${entry.fileName}`];
    const validate = ajv.compile(schema);

    assert.equal(entry.schema.safeParse(fixture).success, true, entry.name);
    assert.equal(validate(fixture), true, JSON.stringify(validate.errors));

    const invalidFixture = { ...fixture, unexpected: true };
    assert.equal(
      entry.schema.safeParse(invalidFixture).success,
      false,
      entry.name,
    );
    assert.equal(validate(invalidFixture), false, entry.name);
  }
});

test("OpenAPI component-local references are rebased to their component root", () => {
  const openapi = contracts.createContractArtifacts()["v1/openapi.json"];

  for (const [name, schema] of Object.entries(openapi.components.schemas)) {
    for (const reference of collectReferences(schema)) {
      assert.match(
        reference,
        new RegExp(`^#/components/schemas/${name}(?:/|$)`, "u"),
        `${name}: ${reference}`,
      );
    }
  }
});
