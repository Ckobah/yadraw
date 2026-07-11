import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
