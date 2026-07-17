import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = {
  title: "Reimposta la password · Avventura AI",
  description: "Richiedi un codice e scegli una nuova password.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Reimposta la password"
      description="Ricevi un codice via email e scegli una nuova password."
    >
      <PasswordResetForm />
    </AuthShell>
  );
}
