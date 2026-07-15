import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CookieConsent } from "../components/cookie-consent";

export const metadata: Metadata = {
  title: "Yadraw",
  description: "Visual JSON cards, workflows, files, and AI search system"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<CookieConsent /></body>
    </html>
  );
}
