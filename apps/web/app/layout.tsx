import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

export const metadata: Metadata = {
  title: "Avventura AI",
  description:
    "Un gioco di ruolo conversazionale guidato da un Dungeon Master AI.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="it"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
    >
      <body className="min-h-svh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
