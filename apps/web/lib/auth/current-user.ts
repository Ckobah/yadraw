import "server-only";

import { v2UuidSchema } from "@yadraw/shared";
import { createSupabaseServerClient } from "../supabase/server";

export type CurrentV2User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: "supabase";
};

function optionalHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getCurrentV2User(): Promise<CurrentV2User | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user || !v2UuidSchema.safeParse(user.id).success || !user.email) return null;

  const metadata = user.user_metadata ?? {};
  const nameCandidate = metadata.full_name ?? metadata.name ?? metadata.user_name;
  const name = typeof nameCandidate === "string" ? nameCandidate.trim() : "";
  return {
    id: user.id,
    email: user.email.toLowerCase(),
    name: name || user.email.split("@")[0] || "User",
    avatarUrl: optionalHttpUrl(metadata.avatar_url ?? metadata.picture),
    authProvider: "supabase"
  };
}
