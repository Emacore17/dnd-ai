import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXTURE_COMPLETED_TURN,
  FIXTURE_POST_APPLY_FAILURE,
  FIXTURE_PROGRESS,
  FIXTURE_RETRYABLE_FAILURE,
  FIXTURE_TURN_SOURCE,
  createInitialGameShellState,
} from "../../apps/web/lib/game-shell/game-shell-fixtures.ts";
import { reduceGameShell } from "../../apps/web/lib/game-shell/game-shell-reducer.ts";

function submit(state, action = "Seguo il segnale") {
  return reduceGameShell(state, { type: "submit_requested", action });
}

test("draft changes preserve player text up to the 2,000 character boundary", () => {
  const initial = createInitialGameShellState();
  const atLimit = "a".repeat(2_000);

  const changed = reduceGameShell(initial, {
    type: "draft_changed",
    draft: atLimit,
  });
  const rejected = reduceGameShell(changed, {
    type: "draft_changed",
    draft: `${atLimit}b`,
  });

  assert.equal(changed.draft, atLimit);
  assert.equal(rejected, changed);
});

test("idle accepts one normalized action and keeps the draft until acknowledgement", () => {
  const withDraft = reduceGameShell(createInitialGameShellState(), {
    type: "draft_changed",
    draft: "Seguo il segnale",
  });

  const submitting = submit(withDraft);

  assert.equal(submitting.status, "submitting");
  assert.equal(submitting.pendingAction, "Seguo il segnale");
  assert.equal(submitting.draft, "Seguo il segnale");
});

test("empty and oversized actions are rejected", () => {
  const initial = createInitialGameShellState();

  assert.equal(submit(initial, "   "), initial);
  assert.equal(submit(initial, "a".repeat(2_001)), initial);
});

test("duplicate submit is rejected while the current action is locked", () => {
  const submitting = submit(createInitialGameShellState());
  const progress = reduceGameShell(submitting, FIXTURE_PROGRESS);
  const reconnect = reduceGameShell(progress, { type: "connection_lost" });

  assert.equal(submit(submitting, "Seconda azione"), submitting);
  assert.equal(submit(progress, "Seconda azione"), progress);
  assert.equal(submit(reconnect, "Seconda azione"), reconnect);
});

test("acknowledgement clears the draft without losing the pending action", () => {
  const submitting = submit(
    reduceGameShell(createInitialGameShellState(), {
      type: "draft_changed",
      draft: "Seguo il segnale",
    }),
  );

  const acknowledged = reduceGameShell(submitting, {
    type: "command_acknowledged",
  });

  assert.equal(acknowledged.draft, "");
  assert.equal(acknowledged.pendingAction, "Seguo il segnale");
  assert.equal(acknowledged.status, "submitting");
});

test("progress can start, advance, and resume after reconnect", () => {
  const submitting = submit(createInitialGameShellState());
  const started = reduceGameShell(submitting, FIXTURE_PROGRESS);
  const advanced = reduceGameShell(started, {
    type: "progress_received",
    progress: { label: "Applico le conseguenze", value: 80 },
  });
  const reconnect = reduceGameShell(advanced, { type: "connection_lost" });
  const resumed = reduceGameShell(reconnect, {
    type: "progress_received",
    progress: { label: "Ripristino completato", value: 90 },
  });

  assert.equal(started.status, "progress");
  assert.deepEqual(advanced.progress, {
    label: "Applico le conseguenze",
    value: 80,
  });
  assert.equal(reconnect.status, "reconnect");
  assert.equal(reconnect.pendingAction, "Seguo il segnale");
  assert.equal(resumed.status, "progress");
  assert.deepEqual(resumed.progress, {
    label: "Ripristino completato",
    value: 90,
  });
});

test("completion applies feed, suggestions, hud, and state diff atomically", () => {
  const progress = reduceGameShell(
    submit(createInitialGameShellState()),
    FIXTURE_PROGRESS,
  );

  const completed = reduceGameShell(progress, FIXTURE_COMPLETED_TURN);

  assert.equal(completed.status, "completed");
  assert.equal(completed.turns, FIXTURE_COMPLETED_TURN.turns);
  assert.equal(
    completed.suggestedActions,
    FIXTURE_COMPLETED_TURN.suggestedActions,
  );
  assert.equal(completed.hud, FIXTURE_COMPLETED_TURN.hud);
  assert.equal(completed.stateDiff, FIXTURE_COMPLETED_TURN.stateDiff);
  assert.equal(completed.progress, null);
  assert.equal(completed.failure, null);
});

test("a safe pre-apply failure can retry the same pending action", () => {
  const failed = reduceGameShell(
    submit(createInitialGameShellState()),
    FIXTURE_RETRYABLE_FAILURE,
  );

  const retrying = reduceGameShell(failed, { type: "retry_requested" });

  assert.equal(failed.status, "error");
  assert.equal(failed.failure?.retryable, true);
  assert.equal(failed.failure?.stateApplied, false);
  assert.equal(retrying.status, "submitting");
  assert.equal(retrying.pendingAction, "Seguo il segnale");
  assert.equal(retrying.failure, null);
});

test("a post-apply failure refuses retry", () => {
  const failed = reduceGameShell(
    submit(createInitialGameShellState()),
    FIXTURE_POST_APPLY_FAILURE,
  );

  assert.equal(reduceGameShell(failed, { type: "retry_requested" }), failed);
});

test("a post-apply failure can close a completed turn without losing its feed", () => {
  const completed = reduceGameShell(
    submit(createInitialGameShellState()),
    FIXTURE_COMPLETED_TURN,
  );

  const failed = reduceGameShell(completed, FIXTURE_POST_APPLY_FAILURE);

  assert.equal(failed.status, "error");
  assert.equal(failed.turns, completed.turns);
  assert.equal(failed.failure?.stateApplied, true);
  assert.equal(reduceGameShell(failed, { type: "retry_requested" }), failed);

  const recovered = reduceGameShell(failed, { type: "turn_ready" });
  assert.equal(recovered.status, "idle");
  assert.equal(recovered.pendingAction, null);
});

test("incompatible events fail closed without cloning state", () => {
  const initial = createInitialGameShellState();

  assert.equal(reduceGameShell(initial, FIXTURE_PROGRESS), initial);
  assert.equal(
    reduceGameShell(initial, { type: "command_acknowledged" }),
    initial,
  );
  assert.equal(reduceGameShell(initial, FIXTURE_COMPLETED_TURN), initial);
  assert.equal(reduceGameShell(initial, { type: "retry_requested" }), initial);
});

test("drawer events only change the active hud section", () => {
  const initial = createInitialGameShellState();
  const opened = reduceGameShell(initial, {
    type: "drawer_opened",
    section: "party",
  });
  const closed = reduceGameShell(opened, { type: "drawer_closed" });

  assert.equal(opened.activeDrawer, "party");
  assert.equal(opened.turns, initial.turns);
  assert.equal(opened.status, initial.status);
  assert.equal(closed.activeDrawer, null);
  assert.equal(closed.turns, initial.turns);
});

test("a completed turn becomes idle only after turn_ready", () => {
  const completed = reduceGameShell(
    submit(createInitialGameShellState()),
    FIXTURE_COMPLETED_TURN,
  );

  assert.equal(submit(completed, "Agisco di nuovo"), completed);

  const ready = reduceGameShell(completed, { type: "turn_ready" });

  assert.equal(ready.status, "idle");
  assert.equal(ready.pendingAction, null);
  assert.equal(ready.stateDiff, null);
});

test("the fixture source reflects the submitted action in the completed feed", () => {
  const action = "Ascolto oltre la paratia";
  const events = FIXTURE_TURN_SOURCE.eventsFor(action);
  const completed = events.find((event) => event.type === "turn_completed");

  assert.notEqual(completed, undefined);
  assert.equal(
    completed.turns.some(
      (turn) => turn.kind === "player_action" && turn.text === action,
    ),
    true,
  );
});
