/**
 * Validate v2 runtime configuration.
 * Exported for testing.
 */
export function validateV2RuntimeConfig(
  nodeEnv: string | undefined,
  yadrawV2Storage: string | undefined,
  internalApiSecret?: string,
): void {
  const mode = yadrawV2Storage ?? "v2-postgres";

  if (
    nodeEnv === "production" &&
    mode !== "v2-postgres"
  ) {
    throw new Error(
      "YADRAW_V2_STORAGE must be 'v2-postgres' in production. In-memory mode is not allowed."
    );
  }

  if (nodeEnv === "production" && (internalApiSecret?.trim().length ?? 0) < 32) {
    throw new Error("INTERNAL_API_SECRET must contain at least 32 characters in production.");
  }
}
