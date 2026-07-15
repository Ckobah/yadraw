export const V2_CURRENT_LEGAL_VERSIONS = {
  termsVersion: "2026-07-15",
  privacyVersion: "2026-07-15",
  personalDataConsentVersion: "2026-07-15"
} as const;

export type V2LegalAcceptanceStatus = {
  current: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
  personalDataConsentVersion: string | null;
  acceptedAt: string | null;
  required: typeof V2_CURRENT_LEGAL_VERSIONS;
};

export function isCurrentLegalAcceptance(input: {
  termsVersion: string | null;
  privacyVersion: string | null;
  personalDataConsentVersion: string | null;
}): boolean {
  return input.termsVersion === V2_CURRENT_LEGAL_VERSIONS.termsVersion &&
    input.privacyVersion === V2_CURRENT_LEGAL_VERSIONS.privacyVersion &&
    input.personalDataConsentVersion === V2_CURRENT_LEGAL_VERSIONS.personalDataConsentVersion;
}
