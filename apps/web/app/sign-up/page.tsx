import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Crea il profilo · Avventura AI",
  description: "Crea il profilo per iniziare la tua avventura conversazionale.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      title="Crea il tuo profilo"
      description="Pochi dati, poi verifichi l’email e inizi a giocare."
    >
      <SignUpForm />
    </AuthShell>
  );
}
