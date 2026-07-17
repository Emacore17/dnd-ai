import assert from "node:assert/strict";
import test from "node:test";

const contracts = await import("../../packages/contracts/dist/index.js");

const CAMPAIGN_ID = "018f47a0-7b5c-7a21-8c1e-0d4f78000101";
const REQUEST_ID = "3b241101-e2bb-4255-8caf-4136c566a962";

test("campaign v4 contracts expose one safe owner read", () => {
  const detail = contracts.CampaignDetailResponseSchema.parse({
    id: CAMPAIGN_ID,
    stateVersion: 0,
    status: "active",
    title: "La città sommersa",
    updatedAt: "2026-07-17T12:00:00.000Z",
  });
  assert.equal(detail.status, "active");
  assert.equal(
    contracts.CampaignDetailResponseSchema.safeParse({
      ...detail,
      hiddenBible: { ending: "canary" },
    }).success,
    false,
  );

  const openapi = contracts.createContractArtifacts()["v4/openapi.json"];
  const operation = openapi.paths["/api/campaigns/{campaignId}"].get;
  assert.equal(operation.operationId, "getCampaign");
  assert.equal(operation["x-dnd-ai-rate-limit-class"], "campaign.read");
  assert.equal(
    operation.parameters[0].schema.$ref,
    "#/components/schemas/CampaignId",
  );
  assert.equal(
    operation.responses["404"].content["application/json"].schema.$ref,
    "#/components/schemas/CampaignErrorResponse",
  );
  assert.equal(openapi.paths["/api/turns/{turnId}/stream"], undefined);
});

test("campaign errors are strict and keep foreign resources indistinguishable", () => {
  const body = {
    error: {
      code: "campaign.not_found",
      message: "Campagna non trovata.",
      requestId: REQUEST_ID,
      retryable: false,
    },
  };
  assert.deepEqual(contracts.CampaignErrorResponseSchema.parse(body), body);
  assert.equal(
    contracts.CampaignErrorResponseSchema.safeParse({
      ...body,
      ownerId: "10000000-0000-4000-8000-000000000001",
    }).success,
    false,
  );
  assert.equal(
    contracts.CampaignErrorResponseSchema.safeParse({
      error: { ...body.error, code: "campaign.forbidden" },
    }).success,
    false,
  );
});
