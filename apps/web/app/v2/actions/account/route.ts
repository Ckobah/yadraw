import { getCurrentV2User } from "../../../../lib/auth/current-user";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { proxyDelete } from "../helpers";

export async function DELETE() {
  const user = await getCurrentV2User(); const admin = createSupabaseAdminClient();
  if (!user) return Response.json({ error: { message: "Authentication required" } }, { status: 401 });
  if (!admin) return Response.json({ error: { message: "Account deletion is not configured" } }, { status: 503 });
  const dataResponse = await proxyDelete("/v2/account"); if (!dataResponse.ok) return dataResponse;
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: { message: "Account data was removed, but authentication cleanup requires support" } }, { status: 502 });
  return Response.json({ deleted: true });
}
