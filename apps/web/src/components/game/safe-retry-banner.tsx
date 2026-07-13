"use client";

import { CircleAlert, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface SafeRetryBannerProps {
  onRetry: () => void;
  retryable: boolean;
  stateApplied: boolean;
}

export function SafeRetryBanner({
  onRetry,
  retryable,
  stateApplied,
}: SafeRetryBannerProps) {
  if (stateApplied || !retryable) {
    return null;
  }

  return (
    <Alert
      className="border-destructive/45 bg-destructive/10"
      data-testid="safe-retry-banner"
      role="group"
      variant="destructive"
    >
      <CircleAlert aria-hidden="true" />
      <AlertTitle>Azione non applicata</AlertTitle>
      <AlertDescription>
        <p>
          Nessun cambiamento è stato salvato. Puoi riprovare senza duplicare gli
          effetti.
        </p>
        <Button
          className="mt-2 min-h-12 w-full sm:w-auto"
          onClick={onRetry}
          type="button"
          variant="destructive"
        >
          <RotateCcw aria-hidden="true" />
          Riprova in sicurezza
        </Button>
      </AlertDescription>
    </Alert>
  );
}
