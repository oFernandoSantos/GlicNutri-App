const libreViewSyncUrl = globalThis?.process?.env?.EXPO_PUBLIC_LIBRE_VIEW_SYNC_URL || '';

function normalizeDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function normalizeTime(value) {
  if (!value) return new Date().toTimeString().slice(0, 8);

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toTimeString().slice(0, 8);
  }

  const text = String(value);
  return text.length === 5 ? `${text}:00` : text.slice(0, 8);
}

function normalizeLibreReading(item) {
  const timestamp =
    item?.timestamp ||
    item?.dateTime ||
    item?.date_time ||
    item?.time ||
    item?.createdAt ||
    null;

  return {
    value: Number(item?.valueMgDl || item?.value_in_mg_per_dl || item?.value || item?.glucose),
    date: item?.date || normalizeDate(timestamp),
    time: item?.hour || item?.hora || normalizeTime(timestamp),
  };
}

export function isLibreViewSyncConfigured() {
  return Boolean(libreViewSyncUrl);
}

export async function fetchLibreViewReadings({ patientId, patientEmail, limit = 24 }) {
  if (!libreViewSyncUrl) {
    throw new Error('A URL de sincronizacao do LibreView ainda nao foi configurada.');
  }

  const response = await fetch(libreViewSyncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      patientId,
      patientEmail,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error('Nao foi possivel buscar leituras do LibreView agora.');
  }

  const payload = await response.json();
  const rawReadings = Array.isArray(payload) ? payload : payload?.readings || [];

  return rawReadings
    .map(normalizeLibreReading)
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
}
