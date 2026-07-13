import { Goal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { GameShellFixture } from "@/lib/game-shell-state";

export interface CurrentObjectiveCardProps {
  objective: GameShellFixture["objective"];
}

export function CurrentObjectiveCard({ objective }: CurrentObjectiveCardProps) {
  return (
    <section
      aria-label="Obiettivo attuale"
      className="rounded-xl border border-game-border bg-game-surface px-4 py-4"
      data-testid="current-objective"
    >
      <div className="flex items-center gap-2 text-primary">
        <Goal aria-hidden="true" className="size-4" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em]">
          Obiettivo attuale
        </p>
      </div>
      <h2 className="mt-2 text-base font-semibold text-foreground">
        {objective.label}
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {objective.detail}
      </p>
      <Badge className="mt-3" variant="secondary">
        {objective.progress}
      </Badge>
    </section>
  );
}
