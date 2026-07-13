import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CanonicalTurnState } from "@/lib/game-shell-state";

export interface ConnectionStatusProps {
  state: CanonicalTurnState;
}

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state !== "completed_with_delivery_error") {
    return null;
  }

  return (
    <Alert
      className="border-primary/35 bg-primary/10 text-foreground"
      data-testid="connection-status"
      role="group"
    >
      <RefreshCw aria-hidden="true" className="animate-spin text-primary" />
      <AlertTitle>Riconnessione in corso</AlertTitle>
      <AlertDescription>
        Il turno è già salvo. Recuperiamo la risposta senza inviare di nuovo
        l&apos;azione.
      </AlertDescription>
    </Alert>
  );
}
