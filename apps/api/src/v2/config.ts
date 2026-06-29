/**
 * Validate v2 runtime configuration.
 * Exported for testing.
 */
export function validateV2RuntimeConfig(
  nodeEnv: string | undefined,
  yadrawV2Storage: string | undefined,
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
}
