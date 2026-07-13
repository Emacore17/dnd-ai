import { HeartPulse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PartyMemberFixture } from "@/lib/game-shell-state";

export interface PartyStatusPanelProps {
  heading?: string;
  members: readonly PartyMemberFixture[];
}

function clampHp(member: PartyMemberFixture): number {
  return Math.min(Math.max(member.hp, 0), Math.max(member.maxHp, 1));
}

export function PartyStatusPanel({
  heading = "Compagnia",
  members,
}: PartyStatusPanelProps) {
  return (
    <section aria-label={heading} data-testid="party-status">
      <div className="mb-3 flex items-center gap-2">
        <HeartPulse aria-hidden="true" className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{heading}</h2>
      </div>

      <ul className="grid gap-3" role="list">
        {members.map((member) => {
          const maxHp = Math.max(member.maxHp, 1);
          const hp = clampHp(member);
          const percentage = (hp / maxHp) * 100;

          return (
            <li className="grid gap-2" key={member.id}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.role}
                  </p>
                </div>
                <Badge className="shrink-0" variant="outline">
                  {member.condition}
                </Badge>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <Progress
                  aria-label={`Punti salute di ${member.name}`}
                  aria-valuemax={maxHp}
                  aria-valuemin={0}
                  aria-valuenow={hp}
                  className="h-1.5 bg-secondary"
                  value={percentage}
                />
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  <span className="sr-only">Punti salute: </span>
                  {hp}/{maxHp}
                </span>
              </div>

              {member.resources.length > 0 ? (
                <ul
                  aria-label={`Risorse di ${member.name}`}
                  className="flex flex-wrap gap-1.5"
                  role="list"
                >
                  {member.resources.map((resource) => {
                    const max = Math.max(resource.max, 0);
                    const current = Math.min(
                      Math.max(resource.current, 0),
                      max,
                    );

                    return (
                      <li key={resource.id}>
                        <Badge
                          className="gap-1.5 bg-secondary font-normal text-secondary-foreground"
                          variant="secondary"
                        >
                          <span>{resource.label}</span>
                          <span className="font-mono tabular-nums">
                            {current}/{max}
                          </span>
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
