import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshSupabaseSession } from "./lib/supabase/middleware";
import { isTrustedMutationOrigin } from "./lib/auth/request-origin";

export async function middleware(request: NextRequest) {
  const protectedMutation =
    request.nextUrl.pathname.startsWith("/v2/actions/") ||
    request.nextUrl.pathname === "/auth/signout";
  if (protectedMutation && !isTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "forbidden_origin", message: "Cross-origin mutation rejected" } },
      { status: 403 }
    );
  }
  return refreshSupabaseSession(request);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
