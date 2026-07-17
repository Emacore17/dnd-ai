import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Accedi · Avventura AI",
  description: "Accedi e riprendi la tua avventura conversazionale.",
};

export default function SignInPage() {
  return (
    <AuthShell
      title="Bentornato"
      description="Accedi per riprendere la tua avventura."
    >
      <SignInForm />
    </AuthShell>
  );
}
