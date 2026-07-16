import type { ReactNode } from "react";
import { YadrawLogo } from "./yadraw-logo";

export function PublicDocument({ title, children }: { title: string; children: ReactNode }) {
  return <main className="v2PublicDocument"><nav><a href="/login" aria-label="Yadraw sign in"><YadrawLogo /></a><a href="/support">Support</a></nav><article><h1>{title}</h1><p className="updated">Effective July 12, 2026</p>{children}</article></main>;
}
