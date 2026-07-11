import type { NextRequest } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function firstForwardedValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function isTrustedMutationOrigin(request: NextRequest): boolean {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) return true;
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host =
      firstForwardedValue(request.headers.get("x-forwarded-host")) ??
      firstForwardedValue(request.headers.get("host")) ??
      request.nextUrl.host;
    const protocol =
      firstForwardedValue(request.headers.get("x-forwarded-proto")) ??
      request.nextUrl.protocol.replace(":", "");
    return originUrl.host === host && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
