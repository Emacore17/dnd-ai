import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { PropsWithChildren } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Avventura AI — La tua storia, una scelta alla volta",
  description:
    "Un gioco di ruolo conversazionale guidato da un Dungeon Master AI.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  initialScale: 1,
  themeColor: "#0a0d14",
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      lang="it"
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
