"use client";

import { useEffect, useState } from "react";
import { COOKIE_POLICY_VERSION } from "../lib/legal";

export type OptionalConsent = {
  version: string;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

const COOKIE_NAME = "yadraw_cookie_consent";

export function readOptionalCookieConsent(): OptionalConsent | null {
  const encoded = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as OptionalConsent;
    return parsed.version === COOKIE_POLICY_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function hasOptionalCookieConsent(category: "functional" | "analytics" | "marketing"): boolean {
  return readOptionalCookieConsent()?.[category] === true;
}

function persistConsent(consent: OptionalConsent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(consent))}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("yadraw:cookie-consent", { detail: consent }));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = readOptionalCookieConsent();
    if (existing) {
      setFunctional(existing.functional);
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
    } else {
      setVisible(true);
    }
    const open = () => { setCustomizing(true); setVisible(true); };
    window.addEventListener("yadraw:open-cookie-settings", open);
    return () => window.removeEventListener("yadraw:open-cookie-settings", open);
  }, []);

  function save(next: Omit<OptionalConsent, "version">) {
    persistConsent({ version: COOKIE_POLICY_VERSION, ...next });
    setFunctional(next.functional);
    setAnalytics(next.analytics);
    setMarketing(next.marketing);
    setVisible(false);
    setCustomizing(false);
  }

  return (
    <>
      <button className="v2CookieSettingsButton" type="button" onClick={() => { setCustomizing(true); setVisible(true); }}>
        Privacy choices
      </button>
      {visible ? <section className="v2CookieBanner" aria-labelledby="cookie-title">
        <div>
          <h2 id="cookie-title">Your privacy choices</h2>
          <p>Yadraw uses necessary technologies for sign-in, security, and your requested workspace features. Optional categories stay off unless you enable them. See the <a href="/cookies">Cookie Policy</a>.</p>
        </div>
        {customizing ? <div className="v2CookieChoices">
          <label><input type="checkbox" checked disabled /> <span><strong>Strictly necessary</strong><small>Authentication, security, consent records, and service delivery.</small></span></label>
          <label><input type="checkbox" checked={functional} onChange={(event) => setFunctional(event.target.checked)} /> <span><strong>Functional</strong><small>Optional convenience and personalization features.</small></span></label>
          <label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /> <span><strong>Analytics</strong><small>Optional measurement used to improve the service.</small></span></label>
          <label><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /> <span><strong>Marketing</strong><small>Optional advertising, attribution, or cross-site measurement.</small></span></label>
        </div> : null}
        <div className="v2CookieActions">
          <button type="button" onClick={() => save({ functional: false, analytics: false, marketing: false })}>Reject optional</button>
          {customizing ? <button type="button" onClick={() => save({ functional, analytics, marketing })}>Save choices</button> : <button type="button" onClick={() => setCustomizing(true)}>Customize</button>}
          <button className="primary" type="button" onClick={() => save({ functional: true, analytics: true, marketing: true })}>Accept all</button>
        </div>
      </section> : null}
    </>
  );
}
