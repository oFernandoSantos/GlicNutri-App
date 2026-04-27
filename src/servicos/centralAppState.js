const appStateCache = new Map();
const appStateListeners = new Map();

function notify(patientId) {
  if (!patientId) return;

  const listeners = appStateListeners.get(patientId) || new Set();
  const nextAppState = appStateCache.get(patientId) || null;

  listeners.forEach((listener) => listener(nextAppState));
}

export function getCachedPatientAppState(patientId) {
  return appStateCache.get(patientId) || null;
}

export function replaceCachedPatientAppState(patientId, appState) {
  if (!patientId) return;
  appStateCache.set(patientId, appState || null);
  notify(patientId);
}

export function subscribeToPatientAppState(patientId, listener) {
  if (!patientId || typeof listener !== 'function') {
    return () => {};
  }

  if (!appStateListeners.has(patientId)) {
    appStateListeners.set(patientId, new Set());
  }

  const listeners = appStateListeners.get(patientId);
  listeners.add(listener);
  listener(getCachedPatientAppState(patientId));

  return () => {
    listeners.delete(listener);

    if (!listeners.size) {
      appStateListeners.delete(patientId);
    }
  };
}
