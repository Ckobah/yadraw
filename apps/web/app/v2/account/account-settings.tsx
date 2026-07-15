"use client";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";

export function AccountSettings({ email }: { email: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []); const [message, setMessage] = useState<string | null>(null);
  return <div className="v2AccountSections"><section><h2>Email</h2><label>Email address<input type="email" defaultValue={email} onBlur={async (event) => { const value = event.currentTarget.value.trim(); if (!supabase || value === email) return; const { error } = await supabase.auth.updateUser({ email: value }); setMessage(error ? error.message : "Check both email addresses to confirm the change."); }} /></label>{message ? <p role="status">{message}</p> : null}</section>
    <section><h2>Data and support</h2><p><a href="/privacy">Privacy Policy</a> · <a href="/personal-data-consent">Processing consent</a> · <a href="/cookies">Cookies</a> · <a href="/retention">Data retention</a> · <a href="/support">Support</a></p></section>
    <section className="danger"><h2>Delete account</h2><p>Your workspaces and boards will become unavailable immediately.</p><button type="button" onClick={async () => { if (!window.confirm("Permanently delete your account and all Yadraw data?")) return; const response = await fetch("/v2/actions/account", { method: "DELETE" }); if (response.ok) window.location.assign("/login"); else setMessage((await response.json().catch(() => null))?.error?.message ?? "Account deletion failed"); }}><Trash2 size={16} /> Delete account</button></section>
  </div>;
}
