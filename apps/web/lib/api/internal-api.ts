import "server-only";

export function buildInternalApiHeaders(userId: string): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("INTERNAL_API_SECRET is not configured for the web server.");
  }
  return {
    "x-yadraw-user-id": userId,
    ...(secret ? { "x-yadraw-internal-secret": secret } : {})
  };
}
