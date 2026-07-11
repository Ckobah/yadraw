"use client";
import { FormEvent, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function PasswordRecoveryForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState(""); const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!supabase) return;
    const callback = new URL("/auth/callback", window.location.origin); callback.searchParams.set("next", "/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
    setMessage(error ? error.message : "If the account exists, a recovery link has been sent.");
  }
  return <form className="v2AuthForm" onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    {message ? <p className="v2AuthMessage" role="status">{message}</p> : null}<button className="v2AuthSubmit" disabled={!supabase}><Mail size={18} /> Send recovery link</button><a className="v2AuthTextLink" href="/login">Back to sign in</a></form>;
}
