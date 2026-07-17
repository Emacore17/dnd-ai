import {
  MAX_ACTION_LENGTH,
  type GameShellEvent,
  type GameShellStatus,
  type GameShellViewModel,
  type TurnProgressView,
} from "./game-shell-model.ts";

function hasStatus(
  state: GameShellViewModel,
  statuses: readonly GameShellStatus[],
): boolean {
  return statuses.includes(state.status);
}

function isValidAction(action: string): boolean {
  return action.length > 0 && action.length <= MAX_ACTION_LENGTH;
}

function isValidProgress(progress: TurnProgressView): boolean {
  return (
    progress.label.trim().length > 0 &&
    Number.isFinite(progress.value) &&
    progress.value >= 0 &&
    progress.value <= 100
  );
}

export function reduceGameShell(
  state: GameShellViewModel,
  event: GameShellEvent,
): GameShellViewModel {
  switch (event.type) {
    case "draft_changed":
      if (state.status !== "idle" || event.draft.length > MAX_ACTION_LENGTH) {
        return state;
      }
      return event.draft === state.draft
        ? state
        : { ...state, draft: event.draft };

    case "submit_requested": {
      if (state.status !== "idle") {
        return state;
      }

      const action = event.action.trim();
      if (!isValidAction(action)) {
        return state;
      }

      return {
        ...state,
        status: "submitting",
        pendingAction: action,
        progress: null,
        failure: null,
        stateDiff: null,
      };
    }

    case "command_acknowledged":
      if (state.status !== "submitting" || state.pendingAction === null) {
        return state;
      }
      return { ...state, draft: "" };

    case "progress_received":
      if (
        !hasStatus(state, ["submitting", "progress", "reconnect"]) ||
        !isValidProgress(event.progress)
      ) {
        return state;
      }
      return {
        ...state,
        status: "progress",
        progress: event.progress,
        failure: null,
      };

    case "connection_lost":
      if (!hasStatus(state, ["submitting", "progress"])) {
        return state;
      }
      return { ...state, status: "reconnect" };

    case "turn_failed":
      if (
        !hasStatus(state, ["submitting", "progress", "reconnect"]) &&
        !(state.status === "completed" && event.failure.stateApplied)
      ) {
        return state;
      }
      return {
        ...state,
        status: "error",
        progress: null,
        failure: event.failure,
      };

    case "retry_requested":
      if (
        state.status !== "error" ||
        state.pendingAction === null ||
        state.failure === null ||
        !state.failure.retryable ||
        state.failure.stateApplied
      ) {
        return state;
      }
      return {
        ...state,
        status: "submitting",
        progress: null,
        failure: null,
        stateDiff: null,
      };

    case "turn_completed":
      if (!hasStatus(state, ["submitting", "progress", "reconnect"])) {
        return state;
      }
      return {
        ...state,
        status: "completed",
        turns: event.turns,
        suggestedActions: event.suggestedActions,
        hud: event.hud,
        progress: null,
        failure: null,
        stateDiff: event.stateDiff,
      };

    case "turn_ready":
      if (
        state.status !== "completed" &&
        !(state.status === "error" && state.failure?.stateApplied === true)
      ) {
        return state;
      }
      return {
        ...state,
        status: "idle",
        pendingAction: null,
        progress: null,
        failure: null,
        stateDiff: null,
      };

    case "drawer_opened":
      return state.activeDrawer === event.section
        ? state
        : { ...state, activeDrawer: event.section };

    case "drawer_closed":
      return state.activeDrawer === null
        ? state
        : { ...state, activeDrawer: null };

    default: {
      const exhaustiveEvent: never = event;
      void exhaustiveEvent;
      return state;
    }
  }
}
