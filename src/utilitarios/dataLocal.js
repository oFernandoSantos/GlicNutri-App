export const GLICNUTRI_TIMEZONE = 'America/Sao_Paulo';
export const DEFAULT_LIBRE_TIMEZONE = GLICNUTRI_TIMEZONE;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizeHourPart(hour) {
  if (hour === '24') {
    return '00';
  }

  return hour || '00';
}

export function parseLibreUsTimestampParts(value) {
  const text = String(value || '').trim();
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

function resolveTimeZone(timeZone) {
  const candidate = String(timeZone || '').trim();
  if (!candidate || /^\d+$/.test(candidate)) {
    return DEFAULT_LIBRE_TIMEZONE;
  }
  return candidate;
}

export function formatDateTimePartsInTimeZone(
  date,
  timeZone = DEFAULT_LIBRE_TIMEZONE
) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(value);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  if (!lookup.year || !lookup.month || !lookup.day) {
    return null;
  }

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${normalizeHourPart(lookup.hour)}:${lookup.minute || '00'}:${lookup.second || '00'}`,
  };
}

export function extractLocalDateTimeFromIsoTimestamp(
  value,
  timeZone = DEFAULT_LIBRE_TIMEZONE
) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const hasExplicitOffset = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);

  if (isoMatch && !hasExplicitOffset) {
    return {
      date: isoMatch[1],
      time: isoMatch[2],
    };
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const local = formatDateTimePartsInTimeZone(parsed, timeZone);
    if (local) {
      return {
        date: local.date,
        time: local.time.slice(0, 5),
      };
    }
  }

  if (isoMatch) {
    return {
      date: isoMatch[1],
      time: isoMatch[2],
    };
  }

  return null;
}

export function parseLibreUsTimestampAsUtcToLocalParts(
  value,
  timeZone = DEFAULT_LIBRE_TIMEZONE
) {
  const text = String(value || '').trim();
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

  return formatDateTimePartsInTimeZone(utcDate, timeZone);
}

/** Parse Libre/US timestamp wall clock as UTC instant (ISO string). */
export function parseLibreUsTimestampToUtcIso(value) {
  const text = String(value || '').trim();
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

  if (match) {
    const [, month, day, year, hour12, minute, second = '0', ampm] = match;
    let hour = Number(hour12) % 12;
    if (/pm/i.test(ampm)) {
      hour += 12;
    }

    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second))
    ).toISOString();
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    const epochMs = numeric < 1e12 ? numeric * 1000 : numeric;
    const parsed = new Date(epochMs);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

const BRAZIL_UTC_OFFSET_HOURS = 3;

function diffUtcIsoHours(laterIso, earlierIso) {
  const laterMs = new Date(laterIso).getTime();
  const earlierMs = new Date(earlierIso).getTime();
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) {
    return NaN;
  }
  return (laterMs - earlierMs) / 3600000;
}

function isBrazilUtcOffsetHours(hours) {
  return Number.isFinite(hours) && Math.abs(hours - BRAZIL_UTC_OFFSET_HOURS) <= 0.75;
}

/**
 * LA/Brazil: Timestamp wall clock = horario local (Libre app).
 * FactoryTimestamp fica ~3h a frente quando Timestamp e interpretado como UTC.
 */
function parseLaRegionTimestampToUtcIso(item = {}) {
  const timestampField = item?.Timestamp ?? item?.timestamp;
  const timestampLocal = parseLibreUsTimestampParts(timestampField);
  const timestampAsUtcIso = parseLibreUsTimestampToUtcIso(timestampField);
  const factoryAsUtcIso = parseLibreUsTimestampToUtcIso(
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

/** Convert America/Sao_Paulo local parts to UTC ISO (BRT = UTC-3). */
export function brazilLocalPartsToUtcIso(parts) {
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

/**
 * Canonical UTC instant from LibreLinkUp payload.
 * LA: Timestamp = horario local BR. Outras regioes: Timestamp UTC.
 */
export function parseLibreReadingTimeUtc(item = {}) {
  const laRegionUtc = parseLaRegionTimestampToUtcIso(item);
  if (laRegionUtc) {
    return laRegionUtc;
  }

  const timestampField = item?.Timestamp ?? item?.timestamp;
  const fromTimestamp = parseLibreUsTimestampToUtcIso(timestampField);
  if (fromTimestamp) {
    return fromTimestamp;
  }

  const factoryField = item?.FactoryTimestamp ?? item?.factoryTimestamp;
  const factoryLocal = parseLibreUsTimestampParts(factoryField);
  if (factoryLocal) {
    return brazilLocalPartsToUtcIso(factoryLocal);
  }

  return (
    parseLibreUsTimestampToUtcIso(item?.created_at) ||
    parseLibreUsTimestampToUtcIso(item?.createdAt) ||
    null
  );
}

export function resolveCanonicalReadingTimeUtc(reading = {}) {
  const raw = reading?.raw_payload || reading?.raw;
  if (raw && (raw.Timestamp || raw.FactoryTimestamp || raw.timestamp || raw.factoryTimestamp)) {
    const fromRaw = parseLibreReadingTimeUtc(raw);
    if (fromRaw) {
      return fromRaw;
    }
  }

  return reading?.readingTimeUtc || reading?.reading_time_utc || null;
}

/** Display-only: convert stored UTC to America/Sao_Paulo parts. */
export function formatReadingTimeForDisplay(
  readingTimeUtc,
  timeZone = GLICNUTRI_TIMEZONE
) {
  if (!readingTimeUtc) {
    return null;
  }

  const parts = formatDateTimePartsInTimeZone(readingTimeUtc, timeZone);
  if (!parts) {
    return null;
  }

  return {
    ...parts,
    label: parts.time.slice(0, 5),
  };
}

export function enrichGlucoseReadingDisplayFields(
  reading = {},
  timeZone = GLICNUTRI_TIMEZONE
) {
  const readingTimeUtc = resolveCanonicalReadingTimeUtc(reading);

  if (!readingTimeUtc) {
    return {
      ...reading,
      date: normalizeLocalDateString(reading?.date),
      time: normalizeLocalTimeString(reading?.time),
    };
  }

  const display = formatReadingTimeForDisplay(readingTimeUtc, resolveTimeZone(timeZone));
  if (!display) {
    return reading;
  }

  return {
    ...reading,
    readingTimeUtc,
    date: display.date,
    time: display.time,
    timeLabel: display.label,
  };
}

export function getGlucoseReadingDisplayDate(
  reading = {},
  timeZone = GLICNUTRI_TIMEZONE
) {
  const enriched = enrichGlucoseReadingDisplayFields(reading, timeZone);
  return normalizeLocalDateString(enriched.date);
}

export function getGlucoseReadingEpochMs(reading = {}) {
  const readingTimeUtc =
    resolveCanonicalReadingTimeUtc(reading) ||
    reading?.readingTimeUtc ||
    reading?.reading_time_utc;
  if (readingTimeUtc) {
    const ms = new Date(readingTimeUtc).getTime();
    if (Number.isFinite(ms)) {
      return ms;
    }
  }

  const date = normalizeLocalDateString(reading?.date);
  const time = normalizeLocalTimeString(reading?.time);
  const ms = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export function filterGlucoseReadingsLastHours(readings = [], hours = 24) {
  const cutoff = Date.now() - hours * 3600000;

  return (Array.isArray(readings) ? readings : []).filter((item) => {
    const ms = getGlucoseReadingEpochMs(item);
    return Number.isFinite(ms) && ms >= cutoff;
  });
}

/** Gráfico do prontuário: 12h, depois 24h, depois últimas leituras disponíveis. */
export function pickGlucoseReadingsForRecentChart(readings = [], hours = 12, minPoints = 2) {
  const ordered = sortGlucoseReadingsChronologically(readings);
  let picked = filterGlucoseReadingsLastHours(ordered, hours);
  if (picked.length >= minPoints) return picked;

  picked = filterGlucoseReadingsLastHours(ordered, 24);
  if (picked.length >= minPoints) return picked;

  return ordered.slice(Math.max(0, ordered.length - 12));
}

function dateTimePartsToEpochMs(parts) {
  if (!parts?.date || !parts?.time) {
    return NaN;
  }

  return new Date(`${parts.date}T${parts.time}`).getTime();
}

function diffDateTimePartsInHours(laterParts, earlierParts) {
  const laterMs = dateTimePartsToEpochMs(laterParts);
  const earlierMs = dateTimePartsToEpochMs(earlierParts);

  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) {
    return NaN;
  }

  return (laterMs - earlierMs) / 3600000;
}

function areLibreTimestampPartsSameMinute(left, right) {
  if (!left || !right) {
    return false;
  }

  return left.date === right.date && left.time.slice(0, 5) === right.time.slice(0, 5);
}

function isMidnightLocalHour(parts) {
  return Number(parts?.time?.slice(0, 2)) < 1;
}

function isEarlyMorningLocalHour(parts) {
  return Number(parts?.time?.slice(0, 2)) < 3;
}

function shouldPreferTimestampLocalOverFactory(factoryLocal, timestampLocal) {
  const timestampAheadOfFactory = diffDateTimePartsInHours(
    timestampLocal,
    factoryLocal
  );

  if (!isBrazilUtcOffsetHours(timestampAheadOfFactory)) {
    return false;
  }

  if (timestampLocal.date > factoryLocal.date) {
    return isEarlyMorningLocalHour(timestampLocal);
  }

  return isMidnightLocalHour(timestampLocal);
}

function shouldPreferTimestampLocalOverUtcConversion(timestampLocal, timestampFromUtc) {
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

function shouldTreatUsWallClockAsUtc(raw, converted) {
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

function resolveUsLibreWallClock(value, timeZone = DEFAULT_LIBRE_TIMEZONE) {
  const raw = parseLibreUsTimestampParts(value);
  const converted = parseLibreUsTimestampAsUtcToLocalParts(value, timeZone);

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

export function parseLibreMeasurementTimestamp(
  item = {},
  { timeZone = DEFAULT_LIBRE_TIMEZONE } = {}
) {
  const timestampField = item?.Timestamp ?? item?.timestamp;
  const factoryField = item?.FactoryTimestamp ?? item?.factoryTimestamp;

  const factoryLocal = parseLibreUsTimestampParts(factoryField);
  const timestampLocal = parseLibreUsTimestampParts(timestampField);
  const timestampFromUtc = parseLibreUsTimestampAsUtcToLocalParts(
    timestampField,
    timeZone
  );

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
      const timestampAheadOfFactory = diffDateTimePartsInHours(
        timestampLocal,
        factoryLocal
      );

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
    return resolveUsLibreWallClock(factoryField, timeZone);
  }

  if (timestampLocal) {
    return resolveUsLibreWallClock(timestampField, timeZone);
  }

  const createdAt = item?.created_at ?? item?.createdAt;
  if (createdAt != null && String(createdAt).trim()) {
    return parseLibreTimestampParts(createdAt, { timeZone });
  }

  return null;
}

export function resolveLibreReadingDateTime(reading = {}) {
  const rawPayload =
    reading?.raw_payload && typeof reading.raw_payload === 'object'
      ? reading.raw_payload
      : reading?.raw && typeof reading.raw === 'object'
        ? reading.raw
        : null;

  const timestampItem = {
    Timestamp:
      reading?.Timestamp ??
      reading?.timestamp ??
      rawPayload?.Timestamp ??
      rawPayload?.timestamp,
    FactoryTimestamp:
      reading?.FactoryTimestamp ??
      reading?.factoryTimestamp ??
      rawPayload?.FactoryTimestamp ??
      rawPayload?.factoryTimestamp,
  };

  if (timestampItem.Timestamp || timestampItem.FactoryTimestamp) {
    const parsed = parseLibreMeasurementTimestamp(timestampItem);
    if (parsed) {
      return parsed;
    }
  }

  return {
    date: normalizeLocalDateString(reading?.date ?? reading?.data),
    time: normalizeLocalTimeString(reading?.time ?? reading?.hora),
  };
}

export function parseLibreTimestampParts(
  value,
  { timeZone = DEFAULT_LIBRE_TIMEZONE, assumeUtcUsFormat = false } = {}
) {
  if (value == null || value === '') {
    return null;
  }

  if (assumeUtcUsFormat) {
    const utcParts = parseLibreUsTimestampAsUtcToLocalParts(value, timeZone);
    if (utcParts) {
      return utcParts;
    }
  }

  const usParts = parseLibreUsTimestampParts(value);
  if (usParts) {
    return resolveUsLibreWallClock(value, timeZone);
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const epochMs = numeric > 1e12 ? numeric : numeric * 1000;
    return formatDateTimePartsInTimeZone(new Date(epochMs), timeZone);
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const isoLike = text.match(
      /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/
    );
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
    return formatDateTimePartsInTimeZone(new Date(parsed), timeZone);
  }

  return null;
}

export function buildLocalDateString(date = new Date()) {
  const parts = formatDateTimePartsInTimeZone(date, GLICNUTRI_TIMEZONE);
  if (parts?.date) {
    return parts.date;
  }

  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return buildLocalDateString(new Date());
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildLocalTimeString(date = new Date()) {
  const parts = formatDateTimePartsInTimeZone(date, GLICNUTRI_TIMEZONE);
  if (parts?.time) {
    return parts.time;
  }

  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return new Date().toTimeString().slice(0, 8);
  }

  return value.toTimeString().slice(0, 8);
}

/** ISO com offset de Brasilia para timestamptz sem drift na leitura. */
export function buildLocalTimestampIso(date, time) {
  const datePart = normalizeLocalDateString(date);
  const timePart = normalizeLocalTimeString(time).slice(0, 5);

  if (!datePart || !/^\d{2}:\d{2}$/.test(timePart)) {
    return null;
  }

  return `${datePart}T${timePart}:00-03:00`;
}

export function normalizeLocalDateString(value) {
  const raw = String(value || '').trim();
  if (!raw) return buildLocalDateString();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return buildLocalDateString(parsed);
  }

  return buildLocalDateString();
}

export function normalizeLocalTimeString(value) {
  const raw = String(value || '').trim();
  if (!raw) return buildLocalTimeString();

  const hmsMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (hmsMatch) {
    const [, hour, minute, second = '00'] = hmsMatch;
    return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return buildLocalTimeString(parsed);
  }

  return buildLocalTimeString();
}

export function buildGlucoseTimestampKey(item) {
  const ms = getGlucoseReadingEpochMs(enrichGlucoseReadingDisplayFields(item));

  if (Number.isFinite(ms)) {
    return String(ms).padStart(15, '0');
  }

  return '0'.padStart(15, '0');
}

export function sortGlucoseReadingsChronologically(readings = []) {
  return [...(Array.isArray(readings) ? readings : [])].sort((left, right) => {
    const leftKey = buildGlucoseTimestampKey(left);
    const rightKey = buildGlucoseTimestampKey(right);
    if (leftKey === rightKey) return 0;
    return leftKey < rightKey ? -1 : 1;
  });
}

export function sortGlucoseReadingsNewestFirst(readings = []) {
  return sortGlucoseReadingsChronologically(readings).reverse();
}

export function buildSparklineFromReadings(readings = [], limit = 7) {
  const ordered = sortGlucoseReadingsChronologically(readings);
  const slice = ordered.slice(Math.max(ordered.length - limit, 0));

  return slice.map((item) => {
    const enriched = enrichGlucoseReadingDisplayFields(item);
    return {
      value: enriched.value,
      label: enriched.timeLabel || normalizeLocalTimeString(enriched.time).slice(0, 5),
      date: normalizeLocalDateString(enriched.date),
      time: normalizeLocalTimeString(enriched.time),
      readingTimeUtc: enriched.readingTimeUtc || null,
    };
  });
}

export function buildTodaySparklineFromReadings(
  readings = [],
  limit = 7,
  today = buildLocalDateString()
) {
  const ordered = sortGlucoseReadingsChronologically(readings);
  const normalizedToday = normalizeLocalDateString(today);
  const todayReadings = ordered.filter(
    (item) => getGlucoseReadingDisplayDate(item) === normalizedToday
  );

  const lastDayReadings = filterGlucoseReadingsLastHours(ordered, 24);

  if (todayReadings.length >= 2) {
    return buildSparklineFromReadings(todayReadings, limit);
  }

  if (lastDayReadings.length >= 2) {
    return buildSparklineFromReadings(lastDayReadings, limit);
  }

  const latestDate = getGlucoseReadingDisplayDate(ordered[ordered.length - 1]);
  if (!latestDate) {
    return [];
  }

  const latestDayReadings = ordered.filter(
    (item) => getGlucoseReadingDisplayDate(item) === latestDate
  );

  return buildSparklineFromReadings(latestDayReadings, limit);
}
