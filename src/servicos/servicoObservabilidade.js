import Constants from 'expo-constants';
import { getSentryDsn } from '../constantes/configPublicaApp';

let inited = false;

/**
 * Inicializa telemetria de erros (Sentry) quando EXPO_PUBLIC_SENTRY_DSN esta definido.
 * No Expo Go o SDK nativo pode ser limitado; em builds EAS/Dev Client o comportamento e completo.
 */
export function initObservabilidade() {
  if (inited) return;
  inited = true;

  const dsn = getSentryDsn();
  if (!dsn) {
    return;
  }

  if (Constants.appOwnership === 'expo') {
    if (__DEV__) {
      console.log(
        '[Observabilidade] Sentry omitido no Expo Go; use um build EAS / Dev Client para telemetria nativa.'
      );
    }
    return;
  }

  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      debug: __DEV__,
      tracesSampleRate: __DEV__ ? 1.0 : 0.15,
    });
  } catch (error) {
    console.warn('[Observabilidade] Sentry indisponivel:', error?.message || error);
  }
}

export function capturarExcecaoObservabilidade(error, contexto) {
  const dsn = getSentryDsn();
  if (!dsn || Constants.appOwnership === 'expo') {
    return;
  }

  try {
    const Sentry = require('@sentry/react-native');
    if (contexto && typeof contexto === 'object') {
      Sentry.withScope((scope) => {
        Object.entries(contexto).forEach(([k, v]) => {
          scope.setContext(k, typeof v === 'object' ? v : { valor: String(v) });
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch (_e) {
    /* noop */
  }
}
