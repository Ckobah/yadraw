"use client";
import { FormEvent, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter(); const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState(""); const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supabase) return; const { error } = await supabase.auth.updateUser({ password }); if (error) setMessage(error.message); else { router.replace("/v2/dashboard"); router.refresh(); } }
  return <form className="v2AuthForm" onSubmit={submit}><label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message ? <p className="v2AuthMessage" role="alert">{message}</p> : null}<button className="v2AuthSubmit" disabled={!supabase}><KeyRound size={18} /> Update password</button></form>;
}
