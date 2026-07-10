import { getCurrentV2User } from "../../../../../lib/auth/current-user";
import { proxyPost } from "../../helpers";

export async function POST() {
  const user = await getCurrentV2User();
  if (!user) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
  }
  return proxyPost("/v2/session/bootstrap", {
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider
  });
}
