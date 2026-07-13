import { Check, CircleMinus, Cloud, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CanonicalTurnState } from "@/lib/game-shell-state";

export interface SaveIndicatorProps {
  state: CanonicalTurnState;
  stateVersion: number;
}

interface SavePresentation {
  icon: "applied" | "pending" | "unchanged" | "version";
  label: string;
  tone: string;
}

function getSavePresentation(state: CanonicalTurnState): SavePresentation {
  switch (state) {
    case "completed":
    case "completed_with_delivery_error":
      return {
        icon: "applied",
        label: "Salvato",
        tone: "text-game-success",
      };
    case "committing":
      return {
        icon: "pending",
        label: "Salvataggio in corso",
        tone: "text-primary",
      };
    case "submitting":
    case "queued":
    case "processing_rules":
    case "streaming_provisional":
      return {
        icon: "pending",
        label: "In attesa di conferma",
        tone: "text-primary",
      };
    case "failed_precommit":
    case "blocked_safety":
      return {
        icon: "unchanged",
        label: "Nessuna modifica salvata",
        tone: "text-muted-foreground",
      };
    case "idle":
      return {
        icon: "version",
        label: "Pronto",
        tone: "text-muted-foreground",
      };
  }
}

function SaveIcon({ icon }: Pick<SavePresentation, "icon">) {
  switch (icon) {
    case "applied":
      return <Check aria-hidden="true" className="size-3.5" />;
    case "pending":
      return (
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
      );
    case "unchanged":
      return <CircleMinus aria-hidden="true" className="size-3.5" />;
    case "version":
      return <Cloud aria-hidden="true" className="size-3.5" />;
  }
}

export function SaveIndicator({ state, stateVersion }: SaveIndicatorProps) {
  const presentation = getSavePresentation(state);

  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 text-xs",
        presentation.tone,
      )}
      data-state-version={stateVersion}
      data-testid="save-indicator"
      title={`Versione stato ${stateVersion}`}
    >
      <SaveIcon icon={presentation.icon} />
      {presentation.label}
    </span>
  );
}
