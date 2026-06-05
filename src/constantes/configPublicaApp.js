/**
 * Leitura centralizada de variaveis EXPO_PUBLIC_* (Expo / EAS).
 */

export function getPrivacyPolicyUrl() {
  return String(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '').trim();
}

export function getSentryDsn() {
  return String(process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim();
}
