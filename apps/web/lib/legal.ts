export const LEGAL_EFFECTIVE_DATE = "July 15, 2026";
export const TERMS_VERSION = "2026-07-15";
export const PRIVACY_VERSION = "2026-07-15";
export const PERSONAL_DATA_CONSENT_VERSION = "2026-07-15";
export const COOKIE_POLICY_VERSION = "2026-07-15";

export type LegalAcceptanceStatus = {
  current: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
  personalDataConsentVersion: string | null;
  acceptedAt: string | null;
  required: {
    termsVersion: string;
    privacyVersion: string;
    personalDataConsentVersion: string;
  };
};

export function legalOperator() {
  return {
    name:
      process.env.LEGAL_OPERATOR_NAME?.trim() ||
      "Individual Entrepreneur Vitaliy Sergeevich Perevozchikov",
    address:
      process.env.LEGAL_OPERATOR_ADDRESS?.trim() ||
      "Apt. 70, 7 Severnaya Street, Odintsovo, Moscow Region",
    country: process.env.LEGAL_OPERATOR_COUNTRY?.trim() || "Russia",
    inn: process.env.LEGAL_OPERATOR_INN?.trim() || "503212943542",
    ogrnip: process.env.LEGAL_OPERATOR_OGRNIP?.trim() || "323508100581261",
    email:
      process.env.PRIVACY_EMAIL?.trim() ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      "ckobah@gmail.com"
  };
}
