"use client";

import { ChevronDown, Dices } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanonicalResultMotion } from "@/components/motion/game-motion";
import { cn } from "@/lib/utils";
import type { GameShellFixture } from "@/lib/game-shell-state";

export interface RuleResultCardProps {
  result: GameShellFixture["ruleResult"];
}

export function RuleResultCard({ result }: RuleResultCardProps) {
  const isSuccess = result.tone === "success";
  const difficultyLabel =
    result.difficulty.visibility === "shown"
      ? `${result.difficulty.value} · ${result.difficulty.label}`
      : "Nascosta";

  return (
    <section
      aria-label={`Esito ${result.label}: ${result.degree}, totale ${result.total}`}
      className="rounded-xl border border-game-border bg-game-surface px-4 py-3"
      data-testid="rule-result"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground",
            isSuccess && "bg-game-success/10 text-game-success",
          )}
        >
          <CanonicalResultMotion result={result.total}>
            <Dices className="size-5" />
          </CanonicalResultMotion>
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {result.label}
          </p>
          <p className="text-xs text-muted-foreground">Esito della prova</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            className={cn(
              "border-game-border bg-secondary text-secondary-foreground",
              isSuccess &&
                "border-game-success/30 bg-game-success/10 text-game-success",
            )}
            variant="outline"
          >
            {result.degree}
          </Badge>
          <strong className="font-mono text-xl tabular-nums text-foreground">
            {result.total}
          </strong>
        </div>
      </div>

      <Collapsible className="mt-2">
        <CollapsibleTrigger asChild>
          <Button
            className="group min-h-11 w-full justify-between px-2 text-muted-foreground"
            type="button"
            variant="ghost"
          >
            Dettagli del calcolo
            <ChevronDown
              aria-hidden="true"
              className="transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t border-game-border px-2 pt-3 text-xs leading-5 text-muted-foreground">
            <dt>Formula</dt>
            <dd className="text-right font-mono text-foreground">
              {result.formula}
            </dd>
            <dt>Difficoltà</dt>
            <dd className="text-right text-foreground">{difficultyLabel}</dd>
            <dt>Fonte</dt>
            <dd className="text-right text-foreground">{result.sourceLabel}</dd>
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
