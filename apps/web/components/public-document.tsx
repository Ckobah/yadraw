import type { ReactNode } from "react";

export function PublicDocument({ title, children }: { title: string; children: ReactNode }) {
  return <main className="v2PublicDocument"><nav><a href="/login">Yadraw</a><a href="/support">Support</a></nav><article><h1>{title}</h1><p className="updated">Effective July 12, 2026</p>{children}</article></main>;
}
