"use client";

import type { SignInRequest } from "@dnd-ai/contracts";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  idempotencyKeyFor,
  identityErrorMessage,
  type IdentityIdempotencyRef,
} from "@/components/auth/identity-client";

const ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "identity.credentials_invalid": "Email o password non corretti.",
  "identity.delivery_unavailable":
    "Il servizio non è disponibile in questo momento. Riprova tra poco.",
  "identity.idempotency_conflict":
    "I dati sono cambiati durante l’invio. Controllali e riprova.",
  "identity.origin_rejected":
    "La richiesta non può essere completata da questa pagina.",
  "identity.rate_limited":
    "Hai effettuato troppi tentativi. Attendi qualche minuto e riprova.",
  "identity.request_invalid": "Controlla i dati inseriti e riprova.",
});

export function SignInForm() {
  const router = useRouter();
  const idempotency = useRef<IdentityIdempotencyRef["current"]>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error !== null) errorSummary.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    } satisfies SignInRequest;

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/sign-in", {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyFor(idempotency, "sign-in", payload),
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
      setSubmitting(false);
    }
  }

  const describedBy = error === null ? undefined : "sign-in-error";

  return (
    <form className="space-y-5" onSubmit={submit}>
      {error !== null ? (
        <Alert
          ref={errorSummary}
          id="sign-in-error"
          tabIndex={-1}
          variant="destructive"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="sign-in-email">Email</Label>
        <Input
          id="sign-in-email"
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
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sign-in-password">Password</Label>
          <Link
            href="/reset-password"
            className="inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Password dimenticata?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="sign-in-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            aria-describedby={describedBy}
            aria-invalid={error === null ? undefined : true}
            className="h-12 pr-12"
            maxLength={128}
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
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Accesso in corso…" : "Accedi"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Non hai un profilo?{" "}
        <Link
          href="/sign-up"
          className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
        >
          Crealo ora
        </Link>
      </p>
      <p aria-live="polite" className="sr-only">
        {submitting ? "Accesso in corso." : ""}
      </p>
    </form>
  );
}
