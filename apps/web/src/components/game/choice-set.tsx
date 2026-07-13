"use client";

import { ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SuggestedActionFixture } from "@/lib/game-shell-state";

export interface ChoiceOption extends SuggestedActionFixture {
  prerequisite?: {
    label: string;
    met: boolean;
  };
}

export interface ChoiceConfirmation {
  description: string;
  title?: string;
}

interface ChoiceSetBaseProps {
  actions: readonly ChoiceOption[];
  choiceSetId: string;
  consumed?: boolean;
  disabled?: boolean;
  onSelect?: (action: ChoiceOption) => void;
}

export type ChoiceSetProps = ChoiceSetBaseProps &
  (
    | {
        confirmation: ChoiceConfirmation;
        irreversible: true;
      }
    | {
        confirmation?: never;
        irreversible?: false;
      }
  );

interface ChoiceOptionRowProps {
  action: ChoiceOption;
  confirmation: ChoiceConfirmation | null;
  disabled: boolean;
  irreversible: boolean;
  onCommit: (action: ChoiceOption) => void;
}

function ChoiceOptionRow({
  action,
  confirmation,
  disabled,
  irreversible,
  onCommit,
}: ChoiceOptionRowProps) {
  const prerequisiteId = useId();
  const isUnavailable = action.prerequisite?.met === false;
  const isDisabled = disabled || isUnavailable;
  const choiceButton = (
    <Button
      aria-describedby={action.prerequisite ? prerequisiteId : undefined}
      className="min-h-12 h-auto w-full justify-start whitespace-normal border-game-border bg-game-surface-elevated px-4 py-3 text-left leading-5"
      disabled={isDisabled}
      onClick={irreversible ? undefined : () => onCommit(action)}
      type="button"
      variant="outline"
    >
      {action.label}
    </Button>
  );

  return (
    <div className="grid gap-1.5">
      {irreversible && confirmation && !isUnavailable ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>{choiceButton}</AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmation.title ?? "Conferma questa scelta"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block font-medium text-foreground">
                  {action.label}
                </span>
                <span className="mt-2 block">{confirmation.description}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-12">
                Torna indietro
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-12"
                onClick={() => onCommit(action)}
              >
                Conferma scelta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        choiceButton
      )}

      {action.prerequisite ? (
        <p
          className="px-1 text-xs leading-5 text-muted-foreground"
          id={prerequisiteId}
        >
          {action.prerequisite.met ? "Requisito: " : "Non disponibile: "}
          {action.prerequisite.label}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceSetSession(props: ChoiceSetProps) {
  const { actions, consumed = false, disabled = false, onSelect } = props;
  const [committedChoiceId, setCommittedChoiceId] = useState<string | null>(
    null,
  );
  const commitLock = useRef(false);
  const irreversible = props.irreversible === true;
  const confirmation = irreversible ? props.confirmation : null;
  const isLocked = disabled || consumed || committedChoiceId !== null;

  if (actions.length === 0) {
    return null;
  }

  const visibleActions = actions.slice(0, 2);
  const additionalActions = actions.slice(2);
  const selectedAction = actions.find(
    (action) => action.id === committedChoiceId,
  );

  function commitChoice(action: ChoiceOption) {
    if (
      commitLock.current ||
      disabled ||
      consumed ||
      action.prerequisite?.met === false
    ) {
      return;
    }

    commitLock.current = true;
    setCommittedChoiceId(action.id);
    onSelect?.(action);
  }

  return (
    <section aria-label="Scelta vincolante" data-testid="choice-set">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">
          Scegli come procedere
        </h2>
        <p className="text-xs text-muted-foreground">Una sola scelta</p>
      </div>

      <div className="grid gap-2">
        {visibleActions.map((action) => (
          <ChoiceOptionRow
            action={action}
            confirmation={confirmation}
            disabled={isLocked}
            irreversible={irreversible}
            key={action.id}
            onCommit={commitChoice}
          />
        ))}
      </div>

      {additionalActions.length > 0 ? (
        <Collapsible className="mt-1.5">
          <CollapsibleTrigger asChild>
            <Button
              aria-label={`Mostra altre ${additionalActions.length} opzioni`}
              className="group min-h-11 w-full text-muted-foreground"
              disabled={isLocked}
              type="button"
              variant="ghost"
            >
              Altre opzioni
              <ChevronDown
                aria-hidden="true"
                className="transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-2 pt-1.5">
            {additionalActions.map((action) => (
              <ChoiceOptionRow
                action={action}
                confirmation={confirmation}
                disabled={isLocked}
                irreversible={irreversible}
                key={action.id}
                onCommit={commitChoice}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {selectedAction || consumed ? (
        <p className="mt-2 text-sm text-game-success" role="status">
          {selectedAction
            ? `Scelta inviata: ${selectedAction.label}.`
            : "Scelta già confermata."}
        </p>
      ) : null}
    </section>
  );
}

export function ChoiceSet(props: ChoiceSetProps) {
  return <ChoiceSetSession key={props.choiceSetId} {...props} />;
}
