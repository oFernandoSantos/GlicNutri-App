/**
 * Leitura centralizada de variaveis EXPO_PUBLIC_* (Expo / EAS).
 */

const DEFAULT_TERMS_OF_USE_URL =
  'https://drive.google.com/file/d/14dUXiO5bZ9NThO7jKPAUjZXntAg5KXLv/view?usp=sharing';

export function getPrivacyPolicyUrl() {
  return String(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '').trim();
}

export function getTermsOfUseUrl() {
  const fromEnv = String(process.env.EXPO_PUBLIC_TERMS_OF_USE_URL || '').trim();
  return fromEnv || DEFAULT_TERMS_OF_USE_URL;
}

export function getSentryDsn() {
  return String(process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim();
}
