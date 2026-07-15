import type { ReactNode } from "react";
import { LEGAL_EFFECTIVE_DATE } from "../lib/legal";

export function PublicDocument({ title, children }: { title: string; children: ReactNode }) {
  return <main className="v2PublicDocument"><nav><a href="/login">Yadraw</a><span><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/terms">Terms</a><a href="/support">Support</a></span></nav><article><h1>{title}</h1><p className="updated">Effective {LEGAL_EFFECTIVE_DATE}</p>{children}</article></main>;
}
