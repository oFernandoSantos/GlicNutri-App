/**
 * Leitura centralizada de variaveis EXPO_PUBLIC_* (Expo / EAS).
 */

function readPublicEnv(name) {
  try {
    return String(globalThis?.process?.env?.[name] || '').trim();
  } catch (_e) {
    return '';
  }
}

export function getPrivacyPolicyUrl() {
  return readPublicEnv('EXPO_PUBLIC_PRIVACY_POLICY_URL');
}

export function getSentryDsn() {
  return readPublicEnv('EXPO_PUBLIC_SENTRY_DSN');
}
