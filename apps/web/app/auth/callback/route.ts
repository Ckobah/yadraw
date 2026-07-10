import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/v2/dashboard";
}


function onboardingPath(destination: string): string {
  return destination === "/v2/dashboard"
    ? destination
    : `/v2/dashboard?next=${encodeURIComponent(destination)}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }
  return NextResponse.redirect(new URL(onboardingPath(nextPath), url.origin));
}
