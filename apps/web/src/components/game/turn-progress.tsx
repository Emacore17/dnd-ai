import {
  Check,
  CircleAlert,
  CircleDot,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  turnStatePresentation,
  type CanonicalTurnState,
  type TurnStatePresentation,
  type TurnStateTone,
} from "@/lib/game-shell-state";

export interface TurnProgressProps {
  state: CanonicalTurnState;
}

function getToneClassName(tone: TurnStateTone): string {
  switch (tone) {
    case "danger":
      return "text-game-danger";
    case "info":
      return "text-primary";
    case "neutral":
      return "text-muted-foreground";
    case "success":
      return "text-game-success";
  }
}

const pendingStates: ReadonlySet<CanonicalTurnState> = new Set([
  "submitting",
  "queued",
  "processing_rules",
  "streaming_provisional",
  "committing",
  "completed_with_delivery_error",
]);

function StatusIcon({ state }: TurnProgressProps) {
  if (pendingStates.has(state)) {
    return <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />;
  }

  if (state === "completed") {
    return <Check aria-hidden="true" className="size-4" />;
  }

  if (state === "failed_precommit") {
    return <CircleAlert aria-hidden="true" className="size-4" />;
  }

  if (state === "blocked_safety") {
    return <ShieldAlert aria-hidden="true" className="size-4" />;
  }

  return <CircleDot aria-hidden="true" className="size-4" />;
}

function getTurnPresentation(state: CanonicalTurnState): TurnStatePresentation {
  switch (state) {
    case "idle":
      return turnStatePresentation.idle;
    case "submitting":
      return turnStatePresentation.submitting;
    case "queued":
      return turnStatePresentation.queued;
    case "processing_rules":
      return turnStatePresentation.processing_rules;
    case "streaming_provisional":
      return turnStatePresentation.streaming_provisional;
    case "committing":
      return turnStatePresentation.committing;
    case "completed":
      return turnStatePresentation.completed;
    case "failed_precommit":
      return turnStatePresentation.failed_precommit;
    case "completed_with_delivery_error":
      return turnStatePresentation.completed_with_delivery_error;
    case "blocked_safety":
      return turnStatePresentation.blocked_safety;
  }
}

export function TurnProgress({ state }: TurnProgressProps) {
  const presentation = getTurnPresentation(state);

  return (
    <div
      aria-label={presentation.announce}
      className="flex min-h-11 items-center gap-2 rounded-lg border border-game-border bg-game-surface px-3"
      data-state={state}
      data-testid="turn-progress"
    >
      <span className={cn("shrink-0", getToneClassName(presentation.tone))}>
        <StatusIcon state={state} />
      </span>
      <span className="min-w-0 text-sm">
        <strong className="font-medium text-foreground">
          {presentation.label}
        </strong>
        <span className="text-muted-foreground">
          {" · "}
          {presentation.detail}
        </span>
      </span>
    </div>
  );
}
