import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Avventura AI",
  description: "Un gioco di ruolo conversazionale guidato da un Dungeon Master AI."
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
