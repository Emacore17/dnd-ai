import assert from "node:assert/strict";
import test from "node:test";

import { createActorContext } from "../../packages/domain/dist/index.js";

const ACTOR = Object.freeze({
  correlationId: "correlation-campaign-0001",
  requestId: "40000000-0000-4000-8000-000000000001",
  sessionId: "20000000-0000-4000-8000-000000000001",
  userId: "10000000-0000-4000-8000-000000000001",
});

test("ActorContext is immutable and preserves server-owned identity", () => {
  const actor = createActorContext(ACTOR);

  assert.deepEqual(actor, ACTOR);
  assert.equal(Object.isFrozen(actor), true);
  assert.throws(() => {
    actor.requestId = "changed-request";
  }, TypeError);
});

test("ActorContext rejects invalid request metadata", () => {
  for (const value of ["", "short", "bad value", "x".repeat(129)]) {
    assert.throws(
      () => createActorContext({ ...ACTOR, correlationId: value }),
      /actor context metadata is invalid/u,
    );
    assert.throws(
      () => createActorContext({ ...ACTOR, requestId: value }),
      /actor context metadata is invalid/u,
    );
  }
});
