"use client";

import { FormEvent, useState } from "react";

function safeNextPath(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/v2/dashboard";
}

export function LegalAcceptanceForm({ nextPath }: { nextPath: string }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [personalDataConsentAccepted, setPersonalDataConsentAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/v2/actions/legal/acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termsAccepted, personalDataConsentAccepted, ageConfirmed })
    });
    if (response.ok) {
      window.location.assign(safeNextPath(nextPath));
      return;
    }
    const body = await response.json().catch(() => null);
    setError(body?.error?.message ?? "Your acceptance could not be recorded. Please try again.");
    setPending(false);
  }

  return <form className="v2LegalAcceptanceForm" onSubmit={submit}>
    <label><input type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I have read and agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>.</span></label>
    <label><input type="checkbox" required checked={personalDataConsentAccepted} onChange={(event) => setPersonalDataConsentAccepted(event.target.checked)} /><span>Separately, I give the <a href="/personal-data-consent" target="_blank" rel="noreferrer">Personal Data Processing Consent</a> and acknowledge the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>. I understand that optional cookies remain a separate choice.</span></label>
    <label><input type="checkbox" required checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /><span>I confirm that I am at least 18 years old and legally able to accept these documents.</span></label>
    {error ? <p className="v2AuthMessage v2AuthMessageError" role="alert">{error}</p> : null}
    <button className="v2LegalAcceptButton" type="submit" disabled={pending}>{pending ? "Recording acceptance…" : "Accept and continue"}</button>
  </form>;
}
