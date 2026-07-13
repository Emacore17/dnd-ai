import { describe, expect, it } from "vitest";

import {
  canonicalTurnStates,
  getGameShellFixture,
  resolveCanonicalTurnState,
  turnStatePresentation,
} from "@/lib/game-shell-state";

describe("BL-079 game shell state contract", () => {
  it("maps readable fixture aliases to canonical turn states", () => {
    expect(resolveCanonicalTurnState("loading")).toBe("processing_rules");
    expect(resolveCanonicalTurnState("error")).toBe("failed_precommit");
    expect(resolveCanonicalTurnState("reconnect")).toBe(
      "completed_with_delivery_error",
    );
    expect(resolveCanonicalTurnState("long")).toBe("completed");
  });

  it("defines a complete presentation for every canonical state", () => {
    expect(Object.keys(turnStatePresentation).sort()).toEqual(
      [...canonicalTurnStates].sort(),
    );

    for (const presentation of Object.values(turnStatePresentation)) {
      expect(presentation.announce.length).toBeGreaterThan(10);
      expect(presentation.label.length).toBeGreaterThan(0);
    }
  });

  it("offers retry only before a state-changing commit", () => {
    const retryableStates = Object.entries(turnStatePresentation)
      .filter(([, presentation]) => presentation.retryable)
      .map(([state]) => state);

    expect(retryableStates).toEqual(["failed_precommit"]);
    expect(
      turnStatePresentation.completed_with_delivery_error.stateApplied,
    ).toBe(true);
    expect(
      turnStatePresentation.completed_with_delivery_error.composerLocked,
    ).toBe(true);
  });

  it("falls back to the completed deterministic fixture for unknown input", () => {
    expect(getGameShellFixture("unknown").fixtureName).toBe("completed");
    expect(getGameShellFixture(undefined).canonicalState).toBe("completed");
    expect(getGameShellFixture("completed").ruleResult.tone).toBe("success");
  });
});
