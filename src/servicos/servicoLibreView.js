const supabaseProjectUrl = globalThis?.process?.env?.EXPO_PUBLIC_SUPABASE_URL || '';
const libreViewSyncUrl =
  globalThis?.process?.env?.EXPO_PUBLIC_LIBRE_VIEW_SYNC_URL ||
  (supabaseProjectUrl ? `${supabaseProjectUrl}/functions/v1/libreview-sync` : '');

const LIBRE_LINKUP_STORAGE_PREFIX = '@glicnutri:libreLinkUp:';

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseDelimitedLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(line) {
  const candidates = [',', ';', '\t'];
  let bestDelimiter = ',';
  let bestCount = -1;

  candidates.forEach((delimiter) => {
    const count = line.split(delimiter).length;
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  });

  return bestDelimiter;
}

function parseLibreNumber(value) {
  if (value == null) return NaN;

  const text = String(value).replace(/\s/g, '').replace(',', '.');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return NaN;

  return Number(match[0]);
}

function normalizeTimestampParts(rawTimestamp, rawDate, rawTime) {
  const timestamp = String(rawTimestamp || '').trim();

  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        date: parsed.toISOString().slice(0, 10),
        time: parsed.toTimeString().slice(0, 8),
      };
    }

    const isoLike = timestamp.match(
      /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (isoLike) {
      const [, year, month, day, hours, minutes, seconds = '00'] = isoLike;
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}:${seconds}`,
      };
    }

    const brLike = timestamp.match(
      /(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (brLike) {
      const [, day, month, year, hours, minutes, seconds = '00'] = brLike;
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}:${seconds}`,
      };
    }
  }

  const normalizedDate = normalizeDate(rawDate);
  const normalizedTime = normalizeTime(rawTime);
  return {
    date: normalizedDate,
    time: normalizedTime,
  };
}

function buildHeaderIndexes(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);

  const timestampIndex = normalizedHeaders.findIndex(
    (header) =>
      header.includes('timestamp') ||
      header.includes('date/time') ||
      header.includes('date time') ||
      header.includes('data/hora') ||
      header.includes('data hora')
  );

  const dateIndex = normalizedHeaders.findIndex(
    (header) =>
      header === 'date' ||
      header === 'data' ||
      header.includes('device date')
  );

  const timeIndex = normalizedHeaders.findIndex(
    (header) =>
      header === 'time' ||
      header === 'hora' ||
      header.includes('device time')
  );

  const glucoseIndexes = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter(
      ({ header }) =>
        (header.includes('glucose') || header.includes('glicose')) &&
        !header.includes('ketone') &&
        !header.includes('ceton')
    )
    .sort((left, right) => {
      const score = (header) => {
        if (header.includes('historic')) return 0;
        if (header.includes('histor')) return 0;
        if (header.includes('scan')) return 1;
        if (header.includes('manual')) return 2;
        return 3;
      };

      return score(left.header) - score(right.header);
    })
    .map((item) => item.index);

  return {
    timestampIndex,
    dateIndex,
    timeIndex,
    glucoseIndexes,
  };
}

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

function buildLibreLinkUpStorageKey(patientId) {
  return patientId ? `${LIBRE_LINKUP_STORAGE_PREFIX}${patientId}` : '';
}

export async function loadLibreLinkUpCredentials(patientId) {
  const key = buildLibreLinkUpStorageKey(patientId);
  if (!key) return null;

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const email = String(parsed?.email || '').trim();
    const password = String(parsed?.password || '');

    if (!email || !password) return null;

    return {
      email,
      password,
      region: String(parsed?.region || 'la').trim() || 'la',
      connectionPatientId: String(parsed?.connectionPatientId || '').trim() || null,
    };
  } catch (error) {
    console.log('Erro ao carregar credenciais LibreLinkUp:', error);
    return null;
  }
}

export async function saveLibreLinkUpCredentials(patientId, credentials = {}) {
  const key = buildLibreLinkUpStorageKey(patientId);
  if (!key) return null;

  const email = String(credentials?.email || '').trim();
  const password = String(credentials?.password || '');

  if (!email || !password) {
    throw new Error('Informe e-mail e senha do LibreLinkUp.');
  }

  const payload = {
    email,
    password,
    region: String(credentials?.region || 'la').trim() || 'la',
    connectionPatientId: String(credentials?.connectionPatientId || '').trim() || null,
    linkedAt: new Date().toISOString(),
  };

  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(key, JSON.stringify(payload));
  return payload;
}

export async function clearLibreLinkUpCredentials(patientId) {
  const key = buildLibreLinkUpStorageKey(patientId);
  if (!key) return;

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.log('Erro ao remover credenciais LibreLinkUp:', error);
  }
}

export async function fetchLibreViewReadings({
  patientId,
  patientEmail,
  limit = 48,
  libreEmail,
  librePassword,
  libreRegion,
  connectionPatientId,
} = {}) {
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
      libreEmail,
      librePassword,
      libreRegion,
      connectionPatientId,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload?.details ||
        payload?.error ||
        'Nao foi possivel buscar leituras do LibreView agora.'
    );
  }

  const rawReadings = Array.isArray(payload) ? payload : payload?.readings || [];

  return {
    readings: rawReadings
      .map(normalizeLibreReading)
      .filter((item) => Number.isFinite(item.value) && item.value > 0),
    connection: payload?.connection || null,
    source: payload?.source || null,
  };
}

export function parseLibreViewExportText(rawText) {
  const text = String(rawText || '').replace(/\r/g, '').trim();

  if (!text) {
    return [];
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const { timestampIndex, dateIndex, timeIndex, glucoseIndexes } = buildHeaderIndexes(headers);

  if (!glucoseIndexes.length) {
    return [];
  }

  const seen = new Set();
  const readings = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const columns = parseDelimitedLine(lines[lineIndex], delimiter);
    const valueIndex = glucoseIndexes.find((index) => Number.isFinite(parseLibreNumber(columns[index])));

    if (valueIndex == null) {
      continue;
    }

    const value = parseLibreNumber(columns[valueIndex]);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const normalizedMoment = normalizeTimestampParts(
      timestampIndex >= 0 ? columns[timestampIndex] : '',
      dateIndex >= 0 ? columns[dateIndex] : '',
      timeIndex >= 0 ? columns[timeIndex] : ''
    );

    const key = `${normalizedMoment.date}|${normalizedMoment.time}|${value}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    readings.push({
      value,
      date: normalizedMoment.date,
      time: normalizedMoment.time,
    });
  }

  return readings.sort((left, right) => {
    const leftKey = `${left.date}T${left.time}`;
    const rightKey = `${right.date}T${right.time}`;
    return rightKey.localeCompare(leftKey);
  });
}
