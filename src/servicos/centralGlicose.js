import { resolveCanonicalReadingTimeUtc, sortGlucoseReadingsNewestFirst } from '../utilitarios/dataLocal';

const glucoseCache = new Map();
const glucoseCacheFetchedAt = new Map();
const glucoseListeners = new Map();
const DEFAULT_GLUCOSE_CACHE_TTL_MS = 90 * 1000;

function sortReadings(readings) {
  return sortGlucoseReadingsNewestFirst(readings);
}

export function buildGlucoseFingerprint(item) {
  const source = String(item?.source || item?.fonte || 'manual').trim().toLowerCase();
  const patientKey = item?.patientId || item?.id_paciente_uuid || '';
  const value = Number(item?.value) || Number(item?.valor_glicose_mgdl) || 0;
  const raw = item?.raw_payload || item?.raw;
  const rawTimestamp = raw?.Timestamp ?? raw?.timestamp;
  if (rawTimestamp) {
    return [patientKey, String(rawTimestamp), value, source].join('|');
  }

  const readingTimeUtc = resolveCanonicalReadingTimeUtc(item);
  if (readingTimeUtc) {
    return [patientKey, readingTimeUtc, value, source].join('|');
  }

  return [
    patientKey,
    item?.date || '',
    String(item?.time || '').slice(0, 8),
    value,
    source,
  ].join('|');
}

function buildFingerprint(item) {
  return buildGlucoseFingerprint(item);
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

function runGlucoseListeners(patientId) {
  if (!patientId) return;

  const listeners = glucoseListeners.get(patientId) || new Set();
  const nextReadings = glucoseCache.get(patientId) || [];

  listeners.forEach((listener) => listener(nextReadings));
}

function notify(patientId) {
  if (!patientId) return;
  queueMicrotask(() => runGlucoseListeners(patientId));
}

export function getCachedGlucoseReadings(patientId) {
  return glucoseCache.get(patientId) || [];
}

export function isGlucoseCacheFresh(patientId, ttlMs = DEFAULT_GLUCOSE_CACHE_TTL_MS) {
  if (!patientId) return false;
  const fetchedAt = glucoseCacheFetchedAt.get(patientId);
  if (!fetchedAt || Date.now() - fetchedAt > ttlMs) return false;
  return (glucoseCache.get(patientId) || []).length > 0;
}

function touchGlucoseCacheFetchedAt(patientId) {
  if (patientId) {
    glucoseCacheFetchedAt.set(patientId, Date.now());
  }
}

export function mergeIntoCachedGlucoseReadings(patientId, readings = []) {
  if (!patientId) return [];

  const next = mergeCachedGlucoseReadings(readings, getCachedGlucoseReadings(patientId));
  glucoseCache.set(patientId, next);
  touchGlucoseCacheFetchedAt(patientId);
  notify(patientId);
  return next;
}

export function replaceCachedGlucoseReadings(patientId, readings) {
  if (!patientId) return;
  glucoseCache.set(patientId, mergeCachedGlucoseReadings(readings));
  touchGlucoseCacheFetchedAt(patientId);
  notify(patientId);
}

export function prependCachedGlucoseReading(patientId, reading) {
  if (!patientId || !reading) return;

  const current = glucoseCache.get(patientId) || [];
  const next = mergeCachedGlucoseReadings([reading], current);

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

  queueMicrotask(() => listener(getCachedGlucoseReadings(patientId)));

  return () => {
    listeners.delete(listener);

    if (!listeners.size) {
      glucoseListeners.delete(patientId);
    }
  };
}
