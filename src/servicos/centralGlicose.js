const glucoseCache = new Map();
const glucoseListeners = new Map();

function toTimestamp(item) {
  const date = item?.date || '1970-01-01';
  const time = item?.time || '00:00:00';
  return `${date}T${time}`;
}

function sortReadings(readings) {
  return [...(Array.isArray(readings) ? readings : [])].sort((left, right) =>
    toTimestamp(right).localeCompare(toTimestamp(left))
  );
}

function buildFingerprint(item) {
  return [
    item?.patientId || item?.id_paciente_uuid || '',
    item?.date || '',
    String(item?.time || '').slice(0, 8),
    Number(item?.value) || Number(item?.valor_glicose_mgdl) || 0,
  ].join('|');
}

export function mergeCachedGlucoseReadings(primaryReadings, fallbackReadings = []) {
  const mergedMap = new Map();

  [...(primaryReadings || []), ...(fallbackReadings || [])].forEach((item) => {
    if (!item) return;
    const fingerprint = buildFingerprint(item);

    if (!mergedMap.has(fingerprint)) {
      mergedMap.set(fingerprint, item);
    }
  });

  return sortReadings(Array.from(mergedMap.values()));
}

function notify(patientId) {
  if (!patientId) return;

  const listeners = glucoseListeners.get(patientId) || new Set();
  const nextReadings = glucoseCache.get(patientId) || [];

  listeners.forEach((listener) => listener(nextReadings));
}

export function getCachedGlucoseReadings(patientId) {
  return glucoseCache.get(patientId) || [];
}

export function replaceCachedGlucoseReadings(patientId, readings) {
  if (!patientId) return;
  glucoseCache.set(patientId, mergeCachedGlucoseReadings(readings));
  notify(patientId);
}

export function prependCachedGlucoseReading(patientId, reading) {
  if (!patientId || !reading) return;

  const current = glucoseCache.get(patientId) || [];
  const next = sortReadings([
    reading,
    ...current.filter((item) => item.id !== reading.id),
  ]);

  glucoseCache.set(patientId, next);
  notify(patientId);
}

export function removeCachedGlucoseReading(patientId, readingId) {
  if (!patientId || !readingId) return;

  const current = glucoseCache.get(patientId) || [];
  glucoseCache.set(
    patientId,
    current.filter((item) => item.id !== readingId)
  );
  notify(patientId);
}

export function subscribeToGlucoseReadings(patientId, listener) {
  if (!patientId || typeof listener !== 'function') {
    return () => {};
  }

  if (!glucoseListeners.has(patientId)) {
    glucoseListeners.set(patientId, new Set());
  }

  const listeners = glucoseListeners.get(patientId);
  listeners.add(listener);

  listener(getCachedGlucoseReadings(patientId));

  return () => {
    listeners.delete(listener);

    if (!listeners.size) {
      glucoseListeners.delete(patientId);
    }
  };
}
