/**
 * Validate v2 runtime configuration.
 * Exported for testing.
 */
export function validateV2RuntimeConfig(
  nodeEnv: string | undefined,
  yadrawV2Storage: string | undefined,
): void {
  if (
    nodeEnv === "production" &&
    yadrawV2Storage === "legacy-postgres"
  ) {
    throw new Error(
      "YADRAW_V2_STORAGE=legacy-postgres is migration-only and is not allowed in production. Use YADRAW_V2_STORAGE=v2-postgres."
    );
  }
}
