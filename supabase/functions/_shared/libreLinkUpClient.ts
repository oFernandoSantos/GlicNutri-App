export type LibreLinkUpReading = {
  value: number;
  readingTimeUtc: string;
  FactoryTimestamp?: string;
  Timestamp?: string;
};

type LibreSession = {
  token: string;
  accountIdHash: string;
  baseUrl: string;
  region: string;
};

const CLIENT_VERSION = '4.16.0';
/** Abbott uses api-la for Latin America (incl. Brazil). api-br does not exist. */
const LIBRE_REGION_ALIASES: Record<string, string> = {
  br: 'la',
  mx: 'la',
  ar: 'la',
  cl: 'la',
  co: 'la',
};
const DEFAULT_REGIONS = ['la', 'eu', 'us', 'de'];
const SESSION_TTL_MS = 20 * 60 * 1000;

const sessionCache = new Map<string, { session: LibreSession; expiresAt: number }>();

function buildRateLimitError(status: number) {
  if (status === 429) {
    return new Error(
      'LibreLinkUp limitou tentativas (429). Aguarde 2 a 5 minutos antes de sincronizar de novo.'
    );
  }

  if (status === 430) {
    return new Error(
      'LibreLinkUp bloqueou login temporariamente (430). Aguarde 5 a 10 minutos, confira senha no app Abbott e tente de novo.'
    );
  }

  return null;
}

function isLibreRateLimitError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || '');
  return (
    message.includes('(429)') ||
    message.includes('(430)') ||
    message.includes('limitou tentativas') ||
    message.includes('bloqueou login')
  );
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeLibreApiRegion(region?: string) {
  const value = String(region || '').trim().toLowerCase();
  if (!value || value === 'global') {
    return 'la';
  }

  return LIBRE_REGION_ALIASES[value] || value;
}

function buildBaseUrl(region: string) {
  const normalized = normalizeLibreApiRegion(region);
  if (normalized === 'global') {
    return 'https://api.libreview.io';
  }
  return `https://api-${normalized}.libreview.io`;
}

function commonHeaders() {
  return {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'cache-control': 'no-cache',
    connection: 'Keep-Alive',
    'content-type': 'application/json',
    product: 'llu.android',
    version: CLIENT_VERSION,
  };
}

function authedHeaders(session: LibreSession) {
  return {
    ...commonHeaders(),
    Authorization: `Bearer ${session.token}`,
    'Account-Id': session.accountIdHash,
  };
}

function buildLocalDateFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildLocalTimeFromDate(date: Date) {
  return date.toTimeString().slice(0, 8);
}

const LIBRE_TIMEZONE = 'America/Sao_Paulo';

function pad2(value: string | number) {
  return String(value).padStart(2, '0');
}

function normalizeHourPart(hour: string | undefined) {
  if (hour === '24') {
    return '00';
  }

  return hour || '00';
}

function formatDateTimePartsInTimeZone(date: Date, timeZone = LIBRE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  if (!lookup.year || !lookup.month || !lookup.day) {
    return null;
  }

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${normalizeHourPart(lookup.hour)}:${lookup.minute || '00'}:${lookup.second || '00'}`,
  };
}

function parseUsLocalTimestamp(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  );
  if (!match) {
    return null;
  }

  const [, month, day, year, hour12, minute, second = '0', ampm] = match;
  let hour = Number(hour12) % 12;
  if (/pm/i.test(ampm)) {
    hour += 12;
  }

  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    time: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
  };
}

const BRAZIL_UTC_OFFSET_HOURS = 3;

function parseUsTimestampToUtcIso(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text) || /Z$/i.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  );
  if (!match) {
    return null;
  }

  const [, month, day, year, hour12, minute, second = '0', ampm] = match;
  let hour = Number(hour12) % 12;
  if (/pm/i.test(ampm)) {
    hour += 12;
  }

  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second))
  ).toISOString();
}

function brazilLocalPartsToUtcIso(parts: { date: string; time: string } | null): string | null {
  if (!parts?.date || !parts?.time) {
    return null;
  }

  const [year, month, day] = parts.date.split('-').map(Number);
  const [hour, minute, second = '00'] = parts.time.split(':');

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      Number(hour) + BRAZIL_UTC_OFFSET_HOURS,
      Number(minute),
      Number(second)
    )
  ).toISOString();
}

function diffUtcIsoHours(laterIso: string, earlierIso: string) {
  const laterMs = new Date(laterIso).getTime();
  const earlierMs = new Date(earlierIso).getTime();
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) {
    return NaN;
  }
  return (laterMs - earlierMs) / 3600000;
}

function isBrazilUtcOffsetHours(hours: number) {
  return Number.isFinite(hours) && Math.abs(hours - BRAZIL_UTC_OFFSET_HOURS) <= 0.75;
}

function parseLaRegionTimestampToUtcIso(item: Record<string, unknown>): string | null {
  const timestampField = item?.Timestamp ?? item?.timestamp;
  const timestampLocal = parseUsLocalTimestamp(timestampField);
  const timestampAsUtcIso = parseUsTimestampToUtcIso(timestampField);
  const factoryAsUtcIso = parseUsTimestampToUtcIso(
    item?.FactoryTimestamp ?? item?.factoryTimestamp
  );

  if (!timestampLocal || !timestampAsUtcIso || !factoryAsUtcIso) {
    return null;
  }

  if (isBrazilUtcOffsetHours(diffUtcIsoHours(factoryAsUtcIso, timestampAsUtcIso))) {
    return brazilLocalPartsToUtcIso(timestampLocal);
  }

  return null;
}

function extractLibreReadingTimeUtc(item: Record<string, unknown>): string | null {
  const laRegionUtc = parseLaRegionTimestampToUtcIso(item);
  if (laRegionUtc) {
    return laRegionUtc;
  }

  const timestampField = item?.Timestamp ?? item?.timestamp;
  const fromTimestamp = parseUsTimestampToUtcIso(timestampField);
  if (fromTimestamp) {
    return fromTimestamp;
  }

  const factoryLocal = parseUsLocalTimestamp(item?.FactoryTimestamp ?? item?.factoryTimestamp);
  if (factoryLocal) {
    return brazilLocalPartsToUtcIso(factoryLocal);
  }

  return parseUsTimestampToUtcIso(item?.created_at ?? item?.createdAt);
}

function parseUsUtcTimestampToLocal(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  );
  if (!match) {
    return null;
  }

  const [, month, day, year, hour12, minute, second = '0', ampm] = match;
  let hour = Number(hour12) % 12;
  if (/pm/i.test(ampm)) {
    hour += 12;
  }

  const utcDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second))
  );

  return formatDateTimePartsInTimeZone(utcDate, LIBRE_TIMEZONE);
}

function parseEpochOrIsoTimestamp(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const epochMs = numeric > 1e12 ? numeric : numeric * 1000;
    return formatDateTimePartsInTimeZone(new Date(epochMs), LIBRE_TIMEZONE);
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const isoLike = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
    if (isoLike) {
      const [, date, time = '00:00:00'] = isoLike;
      return {
        date,
        time: time.length === 5 ? `${time}:00` : time.slice(0, 8),
      };
    }
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return formatDateTimePartsInTimeZone(new Date(parsed), LIBRE_TIMEZONE);
  }

  return null;
}

function dateTimePartsToEpochMs(parts: { date: string; time: string } | null) {
  if (!parts?.date || !parts?.time) {
    return NaN;
  }

  return new Date(`${parts.date}T${parts.time}`).getTime();
}

function diffDateTimePartsInHours(
  laterParts: { date: string; time: string } | null,
  earlierParts: { date: string; time: string } | null
) {
  const laterMs = dateTimePartsToEpochMs(laterParts);
  const earlierMs = dateTimePartsToEpochMs(earlierParts);

  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) {
    return NaN;
  }

  return (laterMs - earlierMs) / 3600000;
}

function areLibreTimestampPartsSameMinute(
  left: { date: string; time: string } | null,
  right: { date: string; time: string } | null
) {
  if (!left || !right) {
    return false;
  }

  return left.date === right.date && left.time.slice(0, 5) === right.time.slice(0, 5);
}

function isMidnightLocalHour(parts: { date: string; time: string } | null) {
  return Number(parts?.time?.slice(0, 2)) < 1;
}

function isEarlyMorningLocalHour(parts: { date: string; time: string } | null) {
  return Number(parts?.time?.slice(0, 2)) < 3;
}

function shouldPreferTimestampLocalOverFactory(
  factoryLocal: { date: string; time: string },
  timestampLocal: { date: string; time: string }
) {
  const timestampAheadOfFactory = diffDateTimePartsInHours(timestampLocal, factoryLocal);

  if (!isBrazilUtcOffsetHours(timestampAheadOfFactory)) {
    return false;
  }

  if (timestampLocal.date > factoryLocal.date) {
    return isEarlyMorningLocalHour(timestampLocal);
  }

  return isMidnightLocalHour(timestampLocal);
}

function shouldPreferTimestampLocalOverUtcConversion(
  timestampLocal: { date: string; time: string },
  timestampFromUtc: { date: string; time: string }
) {
  const timestampAheadOfConverted = diffDateTimePartsInHours(
    timestampLocal,
    timestampFromUtc
  );

  if (!isBrazilUtcOffsetHours(timestampAheadOfConverted)) {
    return false;
  }

  if (timestampLocal.date === timestampFromUtc.date) {
    return false;
  }

  return isEarlyMorningLocalHour(timestampLocal) || timestampLocal.date > timestampFromUtc.date;
}

function shouldTreatUsWallClockAsUtc(
  raw: { date: string; time: string },
  converted: { date: string; time: string }
) {
  const rawAheadOfConverted = diffDateTimePartsInHours(raw, converted);

  if (!isBrazilUtcOffsetHours(rawAheadOfConverted)) {
    return false;
  }

  if (raw.date === converted.date) {
    return true;
  }

  const rawHour = Number(raw.time.slice(0, 2));
  return rawHour >= 1;
}

function resolveUsLibreWallClock(value: unknown) {
  const raw = parseUsLocalTimestamp(value);
  const converted = parseUsUtcTimestampToLocal(value);

  if (!raw) {
    return converted;
  }

  if (!converted) {
    return raw;
  }

  if (shouldTreatUsWallClockAsUtc(raw, converted)) {
    return converted;
  }

  return raw;
}

function resolveMeasurementTimestamp(item: Record<string, unknown>) {
  const timestampField = item?.Timestamp ?? item?.timestamp;
  const factoryField = item?.FactoryTimestamp ?? item?.factoryTimestamp;

  const factoryLocal = parseUsLocalTimestamp(factoryField);
  const timestampLocal = parseUsLocalTimestamp(timestampField);
  const timestampFromUtc = parseUsUtcTimestampToLocal(timestampField);

  if (factoryLocal && timestampFromUtc) {
    const factoryVsUtcConverted = Math.abs(
      diffDateTimePartsInHours(factoryLocal, timestampFromUtc)
    );

    if (factoryVsUtcConverted <= 0.1) {
      if (
        timestampLocal &&
        timestampLocal.date > factoryLocal.date &&
        isBrazilUtcOffsetHours(
          diffDateTimePartsInHours(timestampLocal, factoryLocal)
        )
      ) {
        return timestampLocal;
      }

      if (
        timestampLocal &&
        shouldPreferTimestampLocalOverFactory(factoryLocal, timestampLocal)
      ) {
        return timestampLocal;
      }

      return timestampFromUtc;
    }

    if (timestampLocal) {
      const timestampAheadOfFactory = diffDateTimePartsInHours(timestampLocal, factoryLocal);

      if (isBrazilUtcOffsetHours(timestampAheadOfFactory)) {
        if (timestampLocal.date > factoryLocal.date) {
          return timestampLocal;
        }

        return factoryLocal;
      }

      if (areLibreTimestampPartsSameMinute(factoryLocal, timestampLocal)) {
        if (
          timestampFromUtc &&
          shouldTreatUsWallClockAsUtc(timestampLocal, timestampFromUtc)
        ) {
          return timestampFromUtc;
        }

        return factoryLocal;
      }
    }

    return timestampFromUtc;
  }

  if (timestampFromUtc) {
    if (
      timestampLocal &&
      shouldPreferTimestampLocalOverUtcConversion(timestampLocal, timestampFromUtc)
    ) {
      return timestampLocal;
    }

    return timestampFromUtc;
  }

  if (factoryLocal) {
    return resolveUsLibreWallClock(factoryField);
  }

  if (timestampLocal) {
    return resolveUsLibreWallClock(timestampField);
  }

  return parseEpochOrIsoTimestamp(timestampField) || parseEpochOrIsoTimestamp(factoryField);
}

function normalizeMeasurement(item: Record<string, unknown> | null | undefined) {
  const value = Number(item?.ValueInMgPerDl ?? item?.Value ?? item?.value);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const readingTimeUtc = extractLibreReadingTimeUtc((item || {}) as Record<string, unknown>);
  if (!readingTimeUtc) {
    return null;
  }

  const source = (item || {}) as Record<string, unknown>;

  return {
    value,
    readingTimeUtc,
    FactoryTimestamp: source?.FactoryTimestamp ?? source?.factoryTimestamp,
    Timestamp: source?.Timestamp ?? source?.timestamp,
  } satisfies LibreLinkUpReading;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

async function continueAuthStep(
  session: Pick<LibreSession, 'baseUrl' | 'token' | 'accountIdHash'>,
  stepType: string
) {
  const response = await fetch(`${session.baseUrl}/llu/auth/continue/${stepType}`, {
    method: 'POST',
    headers: authedHeaders(session as LibreSession),
    body: JSON.stringify({}),
  });

  return parseJson(response);
}

async function loginOnce(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/llu/auth/login`, {
    method: 'POST',
    headers: commonHeaders(),
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const rateLimitError = buildRateLimitError(response.status);
    if (rateLimitError) {
      throw rateLimitError;
    }

    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `Falha ao autenticar no LibreLinkUp (${response.status}).`
    );
  }

  return payload;
}

async function resolveLoginPayload(email: string, password: string, preferredRegion?: string) {
  const normalizedPreferred = preferredRegion
    ? normalizeLibreApiRegion(preferredRegion)
    : null;
  const regions = normalizedPreferred
    ? [normalizedPreferred, ...DEFAULT_REGIONS.filter((region) => region !== normalizedPreferred)]
    : DEFAULT_REGIONS;

  let lastError = 'Nao foi possivel autenticar no LibreLinkUp.';

  for (const region of regions) {
    let baseUrl = buildBaseUrl(region);
    let payload;

    try {
      payload = await loginOnce(baseUrl, email, password);
    } catch (error) {
      if (isLibreRateLimitError(error)) {
        throw error;
      }
      lastError = error instanceof Error ? error.message : String(error);
      continue;
    }

    if (payload?.data?.redirect && payload?.data?.region) {
      const resolvedRegion = normalizeLibreApiRegion(String(payload.data.region).trim());
      baseUrl = buildBaseUrl(resolvedRegion);
      try {
        payload = await loginOnce(baseUrl, email, password);
      } catch (error) {
        if (isLibreRateLimitError(error)) {
          throw error;
        }
        lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
    }

    let guard = 0;
    while (payload?.status === 4 && payload?.data?.step?.type && guard < 4) {
      const stepType = String(payload.data.step.type);
      const token = payload?.data?.authTicket?.token;
      const userId = payload?.data?.user?.id;

      if (!token || !userId) {
        throw new Error(
          'Aceite os termos de uso no app LibreLinkUp e tente novamente.'
        );
      }

      payload = await continueAuthStep(
        {
          baseUrl,
          token,
          accountIdHash: await sha256Hex(String(userId)),
        },
        stepType
      );
      guard += 1;
    }

    const token = payload?.data?.authTicket?.token;
    const userId = payload?.data?.user?.id;

    if (payload?.status === 0 && token && userId) {
      return {
        token,
        accountIdHash: await sha256Hex(String(userId)),
        baseUrl,
        region: normalizeLibreApiRegion(payload?.data?.region || region),
      } satisfies LibreSession;
    }

    lastError =
      payload?.error?.message ||
      payload?.message ||
      'Credenciais invalidas ou conta sem permissao para compartilhar dados.';
  }

  throw new Error(lastError);
}

async function getCachedSession(email: string, password: string, preferredRegion?: string) {
  const normalizedRegion = preferredRegion
    ? normalizeLibreApiRegion(preferredRegion)
    : 'auto';
  const cacheKey = `${email}:${normalizedRegion}`;
  const cached = sessionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }

  const session = await resolveLoginPayload(email, password, preferredRegion);
  sessionCache.set(cacheKey, {
    session,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return session;
}

async function fetchGraph(session: LibreSession, patientId: string) {
  const response = await fetch(`${session.baseUrl}/llu/connections/${patientId}/graph`, {
    method: 'GET',
    headers: authedHeaders(session),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `Nao foi possivel buscar leituras do sensor (${response.status}).`
    );
  }

  return payload;
}

async function fetchConnections(session: LibreSession) {
  const response = await fetch(`${session.baseUrl}/llu/connections`, {
    method: 'GET',
    headers: authedHeaders(session),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `Nao foi possivel listar conexoes do LibreLinkUp (${response.status}).`
    );
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

function mergeReadings(
  readings: LibreLinkUpReading[],
  limit: number
) {
  const deduped = new Map<string, LibreLinkUpReading>();

  readings.forEach((reading) => {
    if (!reading) return;
    const key = `${reading.readingTimeUtc}|${reading.value}`;
    deduped.set(key, reading);
  });

  return Array.from(deduped.values())
    .sort((left, right) => right.readingTimeUtc.localeCompare(left.readingTimeUtc))
    .slice(0, Math.max(1, limit));
}

function extractReadingsFromConnections(
  connections: Array<Record<string, unknown>>,
  limit: number
) {
  const readings = connections
    .flatMap((connection) => {
      const current = connection?.glucoseMeasurement;
      const graphData = Array.isArray(connection?.graphData) ? connection.graphData : [];

      return [...graphData, current]
        .map((item) => normalizeMeasurement((item || {}) as Record<string, unknown>))
        .filter((item): item is LibreLinkUpReading => Boolean(item));
    });

  return mergeReadings(readings, limit);
}

function extractReadingsFromGraph(payload: Record<string, unknown>, limit: number) {
  const data = (payload?.data || {}) as Record<string, unknown>;
  const connection = data?.connection as Record<string, unknown> | undefined;

  const graphData = [
    ...(Array.isArray(connection?.graphData) ? connection.graphData : []),
    ...(Array.isArray(data?.graphData) ? data.graphData : []),
  ];
  const current = connection?.glucoseMeasurement || data?.glucoseMeasurement;

  const readings = [...graphData, current]
    .map((item) => normalizeMeasurement((item || {}) as Record<string, unknown>))
    .filter((item): item is LibreLinkUpReading => Boolean(item));

  return mergeReadings(readings, limit);
}

export async function fetchLibreLinkUpReadings({
  email,
  password,
  region,
  limit = 48,
  connectionPatientId,
}: {
  email: string;
  password: string;
  region?: string;
  limit?: number;
  connectionPatientId?: string;
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error('Informe e-mail e senha do LibreLinkUp.');
  }

  const session = await getCachedSession(
    normalizedEmail,
    normalizedPassword,
    region ? normalizeLibreApiRegion(region) : undefined
  );
  const connections = await fetchConnections(session);

  if (!connections.length) {
    throw new Error(
      'Nenhuma conexao encontrada. Compartilhe os dados no LibreLink/LibreLinkUp ou use a conta correta.'
    );
  }

  const prioritizedConnections = connectionPatientId
    ? [
        ...connections.filter((item) => item?.patientId === connectionPatientId),
        ...connections.filter((item) => item?.patientId !== connectionPatientId),
      ]
    : connections;

  let readings: LibreLinkUpReading[] = extractReadingsFromConnections(
    prioritizedConnections as Array<Record<string, unknown>>,
    limit
  );
  let selectedConnection = prioritizedConnections[0];

  for (const connection of prioritizedConnections) {
    const patientId = String(connection?.patientId || '').trim();
    if (!patientId) {
      continue;
    }

    selectedConnection = connection;
    const graphPayload = await fetchGraph(session, patientId);
    const graphReadings = extractReadingsFromGraph(
      (graphPayload || {}) as Record<string, unknown>,
      limit
    );

    readings = mergeReadings([...readings, ...graphReadings], limit);

    if (readings.length) {
      selectedConnection = connection;
      break;
    }
  }

  const patientId = String(selectedConnection?.patientId || '').trim();

  if (!patientId) {
    throw new Error('Conexao LibreLinkUp invalida: patientId ausente.');
  }

  if (!readings.length) {
    throw new Error(
      'Conexao encontrada, mas sem leituras recentes do sensor. Confirme compartilhamento ativo no app LibreLinkUp.'
    );
  }

  return {
    readings,
    connection: {
      patientId,
      firstName: selectedConnection?.firstName || '',
      lastName: selectedConnection?.lastName || '',
      region: session.region,
    },
  };
}
