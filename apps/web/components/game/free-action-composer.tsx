"use client";

import type { FormEvent } from "react";

import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import type {
  GameShellStatus,
  SafeTurnFailureView,
  TurnProgressView,
} from "@/lib/game-shell/game-shell-model";

export interface FreeActionComposerProps {
  readonly draft: string;
  readonly status: GameShellStatus;
  readonly progress: TurnProgressView | null;
  readonly failure: SafeTurnFailureView | null;
  readonly onDraftChange: (draft: string) => void;
  readonly onContinue: () => void;
  readonly onRetry: () => void;
  readonly onSubmitAction: (action: string) => void;
}

function getStatusMessage(
  status: GameShellStatus,
  progress: TurnProgressView | null,
  failure: SafeTurnFailureView | null,
): string {
  switch (status) {
    case "idle":
      return "Pronto per la tua prossima azione.";
    case "submitting":
      return "Invio azione.";
    case "progress":
      return progress?.label ?? "Il Dungeon Master prepara la risposta.";
    case "completed":
      return "Turno completato. Aggiorno la scena.";
    case "reconnect":
      return "Connessione interrotta. Ripristino in corso.";
    case "error":
      return failure?.message ?? "Il turno non è stato completato.";
  }
}

export function FreeActionComposer({
  draft,
  status,
  progress,
  failure,
  onDraftChange,
  onContinue,
  onRetry,
  onSubmitAction,
}: FreeActionComposerProps) {
  const isLocked = status !== "idle";
  const normalizedDraft = draft.trim();
  const showCounter = draft.length >= 1_800;
  const canRetry =
    status === "error" &&
    failure?.retryable === true &&
    failure.stateApplied === false;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      isLocked ||
      normalizedDraft.length === 0 ||
      normalizedDraft.length > 2_000
    ) {
      return;
    }
    onSubmitAction(normalizedDraft);
  };

  return (
    <div className="space-y-2">
      <div
        aria-atomic="true"
        aria-live="polite"
        className="min-h-5 text-xs text-muted-foreground"
        role={status === "error" ? "alert" : "status"}
      >
        {getStatusMessage(status, progress, failure)}
      </div>
      {canRetry ? (
        <Button className="w-full" onClick={onRetry} type="button" variant="outline">
          Riprova la stessa azione
        </Button>
      ) : null}
      {status === "completed" ||
      (status === "error" && failure?.stateApplied === true) ? (
        <Button className="w-full" onClick={onContinue} type="button">
          {status === "completed" ? "Continua" : "Continua dalla scena aggiornata"}
        </Button>
      ) : null}
      <PromptInput onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="free-action">
          Descrivi la tua azione
        </label>
        <PromptInputTextarea
          aria-describedby={showCounter ? "free-action-counter" : undefined}
          disabled={isLocked}
          id="free-action"
          maxLength={2000}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="Cosa vuoi fare?"
          value={draft}
        />
        <PromptInputSubmit
          disabled={isLocked || normalizedDraft.length === 0}
        />
      </PromptInput>
      {showCounter ? (
        <p
          aria-live="polite"
          className="text-right text-xs text-muted-foreground"
          id="free-action-counter"
        >
          {draft.length} / 2000
        </p>
      ) : null}
    </div>
  );
}
