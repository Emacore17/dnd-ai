import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verifica email · Avventura AI",
  description: "Verifica l’indirizzo email con il codice ricevuto.",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verifica la tua email"
      description="Inserisci l’indirizzo usato prima e il codice che hai ricevuto."
    >
      <VerifyEmailForm />
    </AuthShell>
  );
}
