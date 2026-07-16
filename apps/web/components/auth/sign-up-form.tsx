"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { SignUpRequest } from "@dnd-ai/contracts";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  idempotencyKeyFor,
  identityErrorMessage,
  type IdentityIdempotencyRef,
} from "@/components/auth/identity-client";

type SubmitStatus = "idle" | "submitting";

const ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "identity.delivery_unavailable":
    "Il servizio non è disponibile in questo momento. Riprova tra poco.",
  "identity.idempotency_conflict":
    "I dati sono cambiati durante l’invio. Controllali e riprova.",
  "identity.origin_rejected":
    "La richiesta non può essere completata da questa pagina.",
  "identity.rate_limited":
    "Hai effettuato troppe richieste. Attendi qualche minuto e riprova.",
  "identity.request_invalid":
    "Controlla i dati inseriti e usa una password di almeno 15 caratteri.",
});

export function SignUpForm() {
  const router = useRouter();
  const idempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");

  useEffect(() => {
    if (error !== null) errorSummary.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status === "submitting") return;
    const form = new FormData(event.currentTarget);
    const payload = {
      displayName: String(form.get("displayName") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    } satisfies SignUpRequest;

    setError(null);
    setStatus("submitting");
    try {
      const response = await fetch("/api/auth/sign-up", {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(idempotency, "sign-up", payload),
        },
        method: "POST",
      });
      if (!response.ok) {
        setError(await identityErrorMessage(response, ERROR_MESSAGES));
        return;
      }
      router.push("/verify-email");
    } catch {
      setError("La connessione si è interrotta. Controllala e riprova.");
    } finally {
      setStatus("idle");
    }
  }

  const describedBy = error === null ? undefined : "sign-up-error";

  return (
    <form className="space-y-5" onSubmit={submit}>
      {error !== null ? (
        <Alert
          ref={errorSummary}
          id="sign-up-error"
          tabIndex={-1}
          variant="destructive"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="display-name">Nome visibile</Label>
        <Input
          id="display-name"
          name="displayName"
          autoComplete="name"
          aria-describedby={describedBy}
          aria-invalid={error === null ? undefined : true}
          maxLength={40}
          minLength={2}
          placeholder="Come vuoi essere chiamato?"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sign-up-email">Email</Label>
        <Input
          id="sign-up-email"
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

      <div className="space-y-2">
        <Label htmlFor="sign-up-password">Password</Label>
        <div className="relative">
          <Input
            id="sign-up-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="new-password"
            aria-describedby={
              error === null
                ? "password-requirements"
                : "password-requirements sign-up-error"
            }
            aria-invalid={error === null ? undefined : true}
            className="h-12 pr-12"
            maxLength={128}
            minLength={15}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              passwordVisible ? "Nascondi password" : "Mostra password"
            }
            aria-pressed={passwordVisible}
            className="absolute top-0 right-0 h-12 rounded-l-none text-muted-foreground"
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
        <p
          id="password-requirements"
          className="text-xs leading-5 text-muted-foreground"
        >
          Usa almeno 15 caratteri.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Creazione in corso…" : "Continua"}
      </Button>
      <p aria-live="polite" className="sr-only">
        {status === "submitting" ? "Creazione del profilo in corso." : ""}
      </p>
    </form>
  );
}
