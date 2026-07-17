"use client";

import { m, useReducedMotion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import type { NarrativeTurnView } from "@/lib/game-shell/game-shell-model";
import { cn } from "@/lib/utils";

export interface NarrativeTurnProps {
  readonly turn: NarrativeTurnView;
  readonly isAnimating?: boolean;
}

const RESULT_ANIMATE = { opacity: 1, transform: "translateY(0)" } as const;
const RESULT_INITIAL = {
  opacity: 0,
  transform: "translateY(0.25rem)",
} as const;

function assertNever(turn: never): never {
  throw new Error(`Unhandled narrative turn: ${JSON.stringify(turn)}`);
}

export function NarrativeTurn({
  turn,
  isAnimating = false,
}: NarrativeTurnProps) {
  const prefersReducedMotion = useReducedMotion();

  switch (turn.kind) {
    case "narration":
      return (
        <Message data-message-kind="narration" from="assistant">
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">
            {turn.authorLabel}
          </span>
          <MessageContent className="max-w-[65ch]">
            <MessageResponse isAnimating={isAnimating}>
              {turn.markdown}
            </MessageResponse>
          </MessageContent>
        </Message>
      );

    case "player_action":
      return (
        <Message data-message-kind="player_action" from="user">
          <span className="sr-only">La tua azione</span>
          <MessageContent>{turn.text}</MessageContent>
        </Message>
      );

    case "rule_result":
      return (
        <m.section
          animate={RESULT_ANIMATE}
          aria-label={`Risultato: ${turn.label}`}
          className="max-w-[65ch] rounded-2xl border border-border/80 bg-card/75 p-4 shadow-sm"
          data-message-kind="rule_result"
          initial={prefersReducedMotion ? false : RESULT_INITIAL}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                turn.outcome === "success"
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-white",
              )}
            >
              {turn.outcome === "success" ? "Successo" : "Fallimento"}
            </Badge>
            <strong className="text-sm">{turn.label}</strong>
            <span className="font-mono text-xs text-muted-foreground">
              {turn.formula}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            {turn.detail}
          </p>
          {turn.stateDiff ? (
            <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              {turn.stateDiff}
            </p>
          ) : null}
        </m.section>
      );

    default:
      return assertNever(turn);
  }
}
