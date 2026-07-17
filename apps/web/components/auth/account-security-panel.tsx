"use client";

import type { RevokeAllSessionsRequest } from "@dnd-ai/contracts";
import { LogOut, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import {
  idempotencyKeyFor,
  identityErrorMessage,
  type IdentityIdempotencyRef,
} from "@/components/auth/identity-client";

type PendingAction = "revoke-all" | "sign-out" | null;

const ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "identity.delivery_unavailable":
    "Il servizio non è disponibile in questo momento. Riprova tra poco.",
  "identity.idempotency_conflict": "La richiesta è già stata modificata.",
  "identity.origin_rejected":
    "La richiesta non può essere completata da questa pagina.",
  "identity.rate_limited":
    "Hai effettuato troppe richieste. Attendi qualche minuto e riprova.",
  "identity.request_invalid": "La richiesta non è valida. Riprova.",
  "identity.session_invalid": "La sessione non è più valida. Accedi di nuovo.",
});

export function AccountSecurityPanel() {
  const router = useRouter();
  const signOutIdempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const revokeIdempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  useEffect(() => {
    if (error !== null) errorSummary.current?.focus();
  }, [error]);

  async function signOut(): Promise<void> {
    if (pending !== null) return;
    setError(null);
    setPending("sign-out");
    try {
      const response = await fetch("/api/auth/sign-out", {
        headers: {
          "idempotency-key": idempotencyKeyFor(
            signOutIdempotency,
            "sign-out",
            null,
          ),
        },
        method: "POST",
      });
      if (!response.ok) {
        setError(await identityErrorMessage(response, ERROR_MESSAGES));
        return;
      }
      router.replace("/sign-in");
    } catch {
      setError("La connessione si è interrotta. Controllala e riprova.");
    } finally {
      setPending(null);
    }
  }

  async function revokeAll(): Promise<void> {
    if (pending !== null) return;
    const payload = {
      confirmation: "revoke_all",
    } satisfies RevokeAllSessionsRequest;
    setError(null);
    setPending("revoke-all");
    try {
      const response = await fetch("/api/auth/sessions/revoke-all", {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(
            revokeIdempotency,
            "revoke-all",
            payload,
          ),
        },
        method: "POST",
      });
      if (!response.ok) {
        setError(await identityErrorMessage(response, ERROR_MESSAGES));
        return;
      }
      router.replace("/sign-in");
    } catch {
      setError("La connessione si è interrotta. Controllala e riprova.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      {error !== null ? (
        <Alert
          ref={errorSummary}
          id="account-security-error"
          tabIndex={-1}
          variant="destructive"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3" aria-labelledby="sign-out-title">
        <div className="flex gap-3">
          <LogOut className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
          <div>
            <h2 id="sign-out-title" className="font-medium">
              Termina questa sessione
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Tornerai alla schermata di accesso.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={signOut}
        >
          {pending === "sign-out" ? "Uscita in corso…" : "Esci"}
        </Button>
      </section>

      <Separator />

      <section className="space-y-3" aria-labelledby="revoke-title">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 size-5 text-destructive" aria-hidden />
          <div>
            <h2 id="revoke-title" className="font-medium">
              Proteggi il profilo
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Usa questa azione se non riconosci un accesso o hai condiviso la
              password.
            </p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="w-full"
              disabled={pending !== null}
            >
              Disconnetti tutti i dispositivi
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnettere tutto?</AlertDialogTitle>
              <AlertDialogDescription>
                Tutte le sessioni verranno chiuse, compresa questa. Dovrai
                accedere di nuovo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel size="lg">Annulla</AlertDialogCancel>
              <AlertDialogAction
                size="lg"
                variant="destructive"
                onClick={revokeAll}
              >
                Conferma disconnessione
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <p aria-live="polite" className="sr-only">
        {pending === "sign-out"
          ? "Chiusura della sessione in corso."
          : pending === "revoke-all"
            ? "Chiusura di tutte le sessioni in corso."
            : ""}
      </p>
    </div>
  );
}
