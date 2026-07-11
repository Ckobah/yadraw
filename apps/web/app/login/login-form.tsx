"use client";

import { LogIn, UserPlus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

function safeNextPath(value: string | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/v2/dashboard";
}

function onboardingPath(destination: string): string {
  return destination === "/v2/dashboard"
    ? destination
    : `/v2/dashboard?next=${encodeURIComponent(destination)}`;
}

export function LoginForm({
  nextPath,
  initialMessage
}: {
  nextPath?: string;
  initialMessage: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [canResend, setCanResend] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || pending) return;
    setPending(true);
    setMessage(null);
    setCanResend(false);
    const destination = safeNextPath(nextPath);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(onboardingPath(destination));
        router.refresh();
        return;
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", destination);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: callbackUrl.toString()
        }
      });
      if (error) throw error;
      if (data.session) {
        router.replace(onboardingPath(destination));
        router.refresh();
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
        setCanResend(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="v2AuthForm" onSubmit={handleSubmit}>
      <div className="v2AuthMode" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => { setMode("signin"); setMessage(null); }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => { setMode("signup"); setMessage(null); }}
        >
          Create account
        </button>
      </div>

      {mode === "signup" ? (
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={160}
          />
        </label>
      ) : null}
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </label>
      {mode === "signin" ? <a className="v2AuthTextLink" href="/forgot-password">Forgot password?</a> : null}

      {message ? <p className="v2AuthMessage" role="status">{message}</p> : null}
      {canResend ? <button className="v2AuthTextButton" type="button" onClick={async () => {
        if (!supabase) return;
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: callbackUrl.toString() } });
        setMessage(error ? error.message : "Confirmation email sent again.");
      }}>Resend confirmation email</button> : null}
      {!supabase ? (
        <p className="v2AuthMessage v2AuthMessageError" role="alert">
          Authentication is not configured.
        </p>
      ) : null}
      <button className="v2AuthSubmit" type="submit" disabled={!supabase || pending}>
        {mode === "signin" ? <LogIn size={18} /> : <UserPlus size={18} />}
        {pending ? "Please wait" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <p className="v2AuthLegal">By continuing, you agree to the <a href="/terms">Terms</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</p>
    </form>
  );
}
