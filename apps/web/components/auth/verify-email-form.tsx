"use client";

import { useRouter } from "next/navigation";
import type {
  ResendVerificationRequest,
  VerifyEmailRequest,
} from "@dnd-ai/contracts";
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

type PendingAction = "resend" | "verify" | null;

const ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "identity.delivery_unavailable":
    "Il servizio non è disponibile in questo momento. Riprova tra poco.",
  "identity.idempotency_conflict":
    "La richiesta è cambiata durante l’invio. Controlla i dati e riprova.",
  "identity.origin_rejected":
    "La richiesta non può essere completata da questa pagina.",
  "identity.rate_limited":
    "Hai effettuato troppe richieste. Attendi qualche minuto e riprova.",
  "identity.request_invalid": "Controlla email e codice e riprova.",
  "identity.verification_expired": "Il codice è scaduto. Richiedine uno nuovo.",
  "identity.verification_invalid":
    "Il codice non è corretto. Controllalo e riprova.",
  "identity.verification_rate_limited":
    "Hai esaurito i tentativi disponibili. Richiedi un nuovo codice.",
});

export function VerifyEmailForm() {
  const router = useRouter();
  const errorSummary = useRef<HTMLDivElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const verifyIdempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const resendIdempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [resendAfterSeconds, setResendAfterSeconds] = useState(60);

  useEffect(() => {
    if (error !== null) errorSummary.current?.focus();
  }, [error]);

  useEffect(() => {
    if (resendAfterSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [resendAfterSeconds]);

  function changeCode(event: ChangeEvent<HTMLInputElement>): void {
    setCode(normalizeVerificationCode(event.currentTarget.value));
  }

  async function verify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending !== null) return;
    const payload = { code, email } satisfies VerifyEmailRequest;
    setError(null);
    setNotice(null);
    setPending("verify");
    try {
      const response = await fetch("/api/auth/verify-email", {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(
            verifyIdempotency,
            "verify",
            payload,
          ),
        },
        method: "POST",
      });
      if (!response.ok) {
        setError(await identityErrorMessage(response, ERROR_MESSAGES));
        return;
      }
      router.replace("/");
    } catch {
      setError("La connessione si è interrotta. Controllala e riprova.");
    } finally {
      setPending(null);
    }
  }

  async function resend(): Promise<void> {
    if (
      pending !== null ||
      resendAfterSeconds > 0 ||
      emailInput.current?.reportValidity() === false
    ) {
      emailInput.current?.focus();
      return;
    }
    const payload = { email } satisfies ResendVerificationRequest;
    setError(null);
    setNotice(null);
    setPending("resend");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(
            resendIdempotency,
            "resend",
            payload,
          ),
        },
        method: "POST",
      });
      if (!response.ok) {
        setError(await identityErrorMessage(response, ERROR_MESSAGES));
        return;
      }
      resendIdempotency.current = null;
      setResendAfterSeconds(60);
      setNotice("Nuovo codice richiesto. Controlla la tua email.");
    } catch {
      setError("La connessione si è interrotta. Controllala e riprova.");
    } finally {
      setPending(null);
    }
  }

  const describedBy = error === null ? undefined : "verify-email-error";

  return (
    <form className="space-y-5" onSubmit={verify}>
      {error !== null ? (
        <Alert
          ref={errorSummary}
          id="verify-email-error"
          tabIndex={-1}
          variant="destructive"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice !== null ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="verify-email">Email</Label>
        <Input
          ref={emailInput}
          id="verify-email"
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          aria-describedby={describedBy}
          aria-invalid={error === null ? undefined : true}
          maxLength={254}
          placeholder="tu@esempio.it"
          required
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="verification-code">Codice a 6 cifre</Label>
        <Input
          id="verification-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-describedby={
            error === null
              ? "verification-code-help"
              : "verification-code-help verify-email-error"
          }
          aria-invalid={error === null ? undefined : true}
          className="h-12 font-mono text-lg tracking-[0.28em]"
          pattern="[0-9]{6}"
          placeholder="000000"
          required
          value={code}
          onChange={changeCode}
        />
        <p
          id="verification-code-help"
          className="text-xs leading-5 text-muted-foreground"
        >
          Il codice resta valido per 10 minuti.
        </p>
      </div>

      <div className="space-y-3">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending !== null}
        >
          {pending === "verify" ? "Verifica in corso…" : "Verifica email"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending !== null || resendAfterSeconds > 0}
          onClick={resend}
        >
          {pending === "resend"
            ? "Richiesta in corso…"
            : "Invia un nuovo codice"}
        </Button>
        <p className="text-center text-xs leading-5 text-muted-foreground">
          {resendAfterSeconds > 0
            ? `Disponibile tra ${resendAfterSeconds} secondi.`
            : "Puoi richiedere un nuovo codice."}
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {pending === "verify"
          ? "Verifica del codice in corso."
          : pending === "resend"
            ? "Richiesta di un nuovo codice in corso."
            : (notice ??
              (resendAfterSeconds > 0
                ? `Potrai richiedere un nuovo codice tra ${resendAfterSeconds} secondi.`
                : "Puoi richiedere un nuovo codice."))}
      </p>
    </form>
  );
}
