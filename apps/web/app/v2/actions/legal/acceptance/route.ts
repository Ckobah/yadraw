import { proxyGetJson, proxyPost } from "../../helpers";

export async function GET() {
  return proxyGetJson("/v2/legal/acceptance");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  return proxyPost("/v2/legal/acceptance", {
    termsAccepted: body?.termsAccepted,
    personalDataConsentAccepted: body?.personalDataConsentAccepted,
    ageConfirmed: body?.ageConfirmed,
    userAgent: request.headers.get("user-agent")?.slice(0, 512) || null
  });
}
