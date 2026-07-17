"use client";

import { HeartPulse, MapPin, ShieldCheck } from "lucide-react";
import { useCallback, useReducer, useRef } from "react";

import { FreeActionComposer } from "@/components/game/free-action-composer";
import { GameConversation } from "@/components/game/game-conversation";
import { SuggestedActions } from "@/components/game/suggested-actions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { FIXTURE_TURN_SOURCE } from "@/lib/game-shell/game-shell-fixtures";
import type {
  FixtureTurnSource,
  GameShellEvent,
  GameShellViewModel,
} from "@/lib/game-shell/game-shell-model";
import { MAX_ACTION_LENGTH } from "@/lib/game-shell/game-shell-model";
import { reduceGameShell } from "@/lib/game-shell/game-shell-reducer";

export interface InteractiveGameShellProps {
  readonly initialViewModel: GameShellViewModel;
  readonly turnSource?: FixtureTurnSource;
}

export function InteractiveGameShell({
  initialViewModel,
  turnSource = FIXTURE_TURN_SOURCE,
}: InteractiveGameShellProps) {
  const [state, dispatch] = useReducer(reduceGameShell, initialViewModel);
  const isConsumingEvents = useRef(false);

  const consumeEvents = useCallback(
    async (events: readonly GameShellEvent[]) => {
      let stateApplied = false;
      try {
        for await (const event of events) {
          stateApplied ||= event.type === "turn_completed";
          dispatch(event);
        }
      } catch {
        dispatch({
          type: "turn_failed",
          failure: {
            message: stateApplied
              ? "Lo stato è stato applicato, ma la scena deve essere sincronizzata."
              : "La risposta non è arrivata. Puoi riprovare la stessa azione.",
            retryable: !stateApplied,
            stateApplied,
          },
        });
      } finally {
        isConsumingEvents.current = false;
      }
    },
    [],
  );

  const submitAction = useCallback(
    (action: string) => {
      const normalizedAction = action.trim();
      if (
        isConsumingEvents.current ||
        normalizedAction.length === 0 ||
        normalizedAction.length > MAX_ACTION_LENGTH
      ) {
        return;
      }

      isConsumingEvents.current = true;
      dispatch({ type: "submit_requested", action: normalizedAction });
      void consumeEvents(turnSource.eventsFor(normalizedAction));
    },
    [consumeEvents, turnSource],
  );

  const retryAction = useCallback(() => {
    if (
      isConsumingEvents.current ||
      state.status !== "error" ||
      state.pendingAction === null ||
      state.failure?.retryable !== true ||
      state.failure.stateApplied
    ) {
      return;
    }

    isConsumingEvents.current = true;
    dispatch({ type: "retry_requested" });
    void consumeEvents(turnSource.retryEventsFor(state.pendingAction));
  }, [consumeEvents, state, turnSource]);

  const isComposerLocked = state.status !== "idle";

  return (
    <main
      className="mx-auto h-svh w-full overflow-hidden bg-background lg:px-6"
      data-game-shell="interactive"
      data-shell-status={state.status}
    >
      <div className="mx-auto flex h-svh w-full max-w-3xl flex-col overflow-hidden bg-background sm:border-x sm:border-border/70">
        <header className="shrink-0 border-b border-border/80 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                <MapPin aria-hidden="true" className="size-3.5" />
                {state.scene.campaignLabel}
              </p>
              <h1 className="truncate text-xl leading-tight font-semibold tracking-[-0.025em] sm:text-2xl">
                {state.scene.sceneTitle}
              </h1>
            </div>
            <Badge
              className="mt-0.5 shrink-0 border-success/30 bg-success/10 text-success"
              variant="outline"
            >
              {state.scene.saveLabel}
            </Badge>
          </div>
          <div
            aria-label="Stato dell'avventura"
            className="mt-3 flex min-h-11 items-center gap-3 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 text-foreground">
              <HeartPulse aria-hidden="true" className="size-4 text-destructive" />
              {state.scene.hitPointsLabel}
            </span>
            <Separator className="h-4" orientation="vertical" />
            <span className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden="true" className="size-4 text-success" />
              {state.scene.conditionLabel}
            </span>
          </div>
        </header>

        <GameConversation
          isAnimating={state.status === "progress"}
          turns={state.turns}
        />

        <footer className="shrink-0 border-t border-border/80 bg-background px-3 pt-3 pb-[var(--safe-area-bottom)] sm:px-4">
          <div className="mx-auto max-w-3xl space-y-3">
            {state.status === "progress" && state.progress ? (
              <Progress
                aria-label={state.progress.label}
                value={state.progress.value}
              />
            ) : null}
            {state.status === "completed" && state.stateDiff ? (
              <p className="rounded-xl bg-success/10 px-3 py-2 text-xs text-success">
                {state.stateDiff}
              </p>
            ) : null}
            <SuggestedActions
              actions={state.suggestedActions}
              disabled={isComposerLocked}
              onSubmitAction={submitAction}
            />
            <FreeActionComposer
              draft={state.draft}
              failure={state.failure}
              onContinue={() => dispatch({ type: "turn_ready" })}
              onDraftChange={(draft) =>
                dispatch({ type: "draft_changed", draft })
              }
              onRetry={retryAction}
              onSubmitAction={submitAction}
              progress={state.progress}
              status={state.status}
            />
          </div>
        </footer>
      </div>
    </main>
  );
}
