"use client";

import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SuggestedActionView } from "@/lib/game-shell/game-shell-model";

export interface SuggestedActionsProps {
  readonly actions: readonly SuggestedActionView[];
  readonly disabled: boolean;
  readonly onSubmitAction: (action: string) => void;
}

export function SuggestedActions({
  actions,
  disabled,
  onSubmitAction,
}: SuggestedActionsProps) {
  const primaryActions = actions.slice(0, 2);
  const additionalActions = actions.slice(2);

  const renderAction = (action: SuggestedActionView) => (
    <Button
      className="min-h-11 w-full justify-start whitespace-normal text-left"
      disabled={disabled}
      key={action.id}
      onClick={() => onSubmitAction(action.label)}
      type="button"
      variant="outline"
    >
      {action.label}
    </Button>
  );

  return (
    <section aria-label="Azioni suggerite" className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        {primaryActions.map(renderAction)}
      </div>
      {additionalActions.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              className="w-full justify-between"
              disabled={disabled}
              type="button"
              variant="ghost"
            >
              Altre opzioni
              <ChevronDownIcon aria-hidden="true" className="size-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid grid-cols-2 gap-2 pt-2">
            {additionalActions.map(renderAction)}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}
