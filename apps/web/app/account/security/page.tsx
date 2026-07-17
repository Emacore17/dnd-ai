import type { Metadata } from "next";

import { AccountSecurityPanel } from "@/components/auth/account-security-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sicurezza account · Avventura AI",
  description: "Gestisci in modo essenziale l’accesso al tuo profilo.",
};

export default function AccountSecurityPage() {
  return (
    <AuthShell
      title="Sicurezza account"
      description="Esci da questa sessione o chiudile tutte in caso di dubbio."
    >
      <AccountSecurityPanel />
    </AuthShell>
  );
}
