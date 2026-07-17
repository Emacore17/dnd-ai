"use client";

import type {
  PasswordResetConfirm,
  PasswordResetRequest,
} from "@dnd-ai/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  idempotencyKeyFor,
  identityErrorMessage,
  normalizeVerificationCode,
  type IdentityIdempotencyRef,
} from "@/components/auth/identity-client";

type ResetStep =
  Readonly<{ kind: "request" }> | Readonly<{ kind: "confirm"; email: string }>;

const ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "identity.delivery_unavailable":
    "Il servizio non è disponibile in questo momento. Riprova tra poco.",
  "identity.idempotency_conflict":
    "I dati sono cambiati durante l’invio. Controllali e riprova.",
  "identity.origin_rejected":
    "La richiesta non può essere completata da questa pagina.",
  "identity.password_reset_code_invalid":
    "Il codice non è valido o è scaduto. Richiedine uno nuovo.",
  "identity.rate_limited":
    "Hai effettuato troppe richieste. Attendi qualche minuto e riprova.",
  "identity.request_invalid":
    "Controlla i dati inseriti e usa almeno 15 caratteri per la password.",
});

export function PasswordResetForm() {
  const router = useRouter();
  const requestIdempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const confirmIdempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<ResetStep>({ kind: "request" });

  useEffect(() => {
    if (error !== null) errorSummary.current?.focus();
  }, [error]);

  function changeCode(event: ChangeEvent<HTMLInputElement>): void {
    setCode(normalizeVerificationCode(event.currentTarget.value));
  }

  async function requestReset(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
    } satisfies PasswordResetRequest;

    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(
            requestIdempotency,
            "reset-request",
            payload,
          ),
        },
        method: "POST",
      });
      if (!response.ok) {
        setError(await identityErrorMessage(response, ERROR_MESSAGES));
        return;
      }
      setStep({ email: payload.email, kind: "confirm" });
    } catch {
      setError("La connessione si è interrotta. Controllala e riprova.");
    } finally {
      setPending(false);
    }
  }

  async function confirmReset(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (pending || step.kind !== "confirm") return;
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
    if (newPassword !== passwordConfirmation) {
      setError("Le due password non coincidono.");
      return;
    }
    const payload = {
      code,
      email: step.email,
      newPassword,
    } satisfies PasswordResetConfirm;

    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(
            confirmIdempotency,
            "reset-confirm",
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
      setPending(false);
    }
  }

  const errorAlert =
    error === null ? null : (
      <Alert
        ref={errorSummary}
        id="password-reset-error"
        tabIndex={-1}
        variant="destructive"
      >
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  const describedBy = error === null ? undefined : "password-reset-error";

  if (step.kind === "request") {
    return (
      <form className="space-y-5" onSubmit={requestReset}>
        {errorAlert}
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            aria-describedby={describedBy}
            aria-invalid={error === null ? undefined : true}
            maxLength={254}
            placeholder="tu@esempio.it"
            required
            spellCheck={false}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Invio in corso…" : "Invia il codice"}
        </Button>
        <p aria-live="polite" className="sr-only">
          {pending ? "Richiesta del codice in corso." : ""}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
          >
            Torna all’accesso
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form className="space-y-5" onSubmit={confirmReset}>
      {errorAlert}
      <Alert>
        <AlertDescription>
          Se l’indirizzo è registrato, riceverai un codice valido per 10 minuti.
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        <Label htmlFor="reset-code">Codice a 6 cifre</Label>
        <Input
          id="reset-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-describedby={describedBy}
          aria-invalid={error === null ? undefined : true}
          className="h-12 font-mono text-lg tracking-[0.28em]"
          pattern="[0-9]{6}"
          placeholder="000000"
          required
          value={code}
          onChange={changeCode}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nuova password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          aria-describedby={describedBy}
          aria-invalid={error === null ? undefined : true}
          className="h-12"
          maxLength={128}
          minLength={15}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Conferma password</Label>
        <Input
          id="confirm-password"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          aria-describedby={describedBy}
          aria-invalid={error === null ? undefined : true}
          className="h-12"
          maxLength={128}
          minLength={15}
          required
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Aggiornamento in corso…" : "Aggiorna password"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={pending}
        onClick={() => {
          setCode("");
          setError(null);
          setStep({ kind: "request" });
        }}
      >
        Richiedi un altro codice
      </Button>
      <p aria-live="polite" className="sr-only">
        {pending ? "Aggiornamento della password in corso." : ""}
      </p>
    </form>
  );
}
