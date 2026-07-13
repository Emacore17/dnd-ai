"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useId, useState } from "react";

import { GameDrawer } from "@/components/game/game-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SuggestedAction {
  id: string;
  label: string;
}

export interface SuggestedActionListProps {
  actions: readonly SuggestedAction[];
  className?: string;
  disabled?: boolean;
  onSelect: (action: SuggestedAction) => void;
}

const visibleActionCount = 2;

export function SuggestedActionList({
  actions,
  className,
  disabled = false,
  onSelect,
}: SuggestedActionListProps) {
  const headingId = useId();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const primaryActions = actions.slice(0, visibleActionCount);
  const additionalActions = actions.slice(visibleActionCount);

  if (actions.length === 0) {
    return null;
  }

  function handleAdditionalAction(action: SuggestedAction) {
    setIsDrawerOpen(false);
    onSelect(action);
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn("suggested-actions space-y-3", className)}
      data-testid="suggested-actions"
    >
      <div className="suggested-actions-heading flex min-h-11 items-center justify-between gap-3">
        <h2
          className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase"
          id={headingId}
        >
          Come vuoi agire?
        </h2>

        {additionalActions.length > 0 ? (
          <GameDrawer
            description="Scegli una delle altre azioni disponibili per questa scena."
            onOpenChange={setIsDrawerOpen}
            open={isDrawerOpen}
            title="Altre azioni"
            trigger={
              <Button
                className="min-h-11 shrink-0 rounded-xl px-3"
                disabled={disabled}
                type="button"
                variant="ghost"
              >
                <MoreHorizontalIcon aria-hidden="true" className="size-4" />
                Altre azioni
              </Button>
            }
          >
            <ul className="grid gap-2" role="list">
              {additionalActions.map((action) => (
                <li key={action.id}>
                  <Button
                    className="h-auto min-h-12 w-full justify-start whitespace-normal px-4 py-3 text-left leading-5"
                    disabled={disabled}
                    onClick={() => handleAdditionalAction(action)}
                    type="button"
                    variant="outline"
                  >
                    {action.label}
                  </Button>
                </li>
              ))}
            </ul>
          </GameDrawer>
        ) : null}
      </div>

      <ul className="grid gap-2" role="list">
        {primaryActions.map((action, index) => (
          <li key={action.id}>
            <Button
              className="min-h-12 h-auto w-full justify-start whitespace-normal px-4 py-3 text-left leading-5"
              disabled={disabled}
              onClick={() => onSelect(action)}
              type="button"
              variant={index === 0 ? "default" : "outline"}
            >
              {action.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
