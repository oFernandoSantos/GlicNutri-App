import {
  enrichGlucoseReadingDisplayFields,
  getGlucoseReadingEpochMs,
  normalizeLocalDateString,
  normalizeLocalTimeString,
} from './dataLocal';

const GLUCOSE_TARGET_LOW = 70;
const GLUCOSE_TARGET_HIGH = 180;

const MEAL_TYPE_LABELS = {
  cafe: 'Café da manhã',
  cafe_da_manha: 'Café da manhã',
  breakfast: 'Café da manhã',
  almoco: 'Almoço',
  lunch: 'Almoço',
  jantar: 'Jantar',
  dinner: 'Jantar',
  lanche: 'Lanche',
  snack: 'Lanche',
  ceia: 'Ceia',
};

export function resolveReportEntryDate(entry) {
  if (typeof entry === 'string' || typeof entry === 'number') {
    const raw = String(entry).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    return raw.slice(0, 10) || null;
  }

  const enriched = entry?.readingTimeUtc ? enrichGlucoseReadingDisplayFields(entry) : entry;
  const raw = String(
    enriched?.date ||
      entry?.date ||
      entry?.data ||
      entry?.data_registro ||
      entry?.created_at ||
      entry?.createdAt ||
      ''
  ).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return raw.slice(0, 10) || null;
}

export function resolveReportEntryEpochMs(entry) {
  if (entry?.readingTimeUtc || entry?.reading_time_utc || entry?.fonte || entry?.source === 'librelinkup') {
    const ms = getGlucoseReadingEpochMs(entry);
    if (Number.isFinite(ms)) return ms;
  }

  const date = normalizeLocalDateString(resolveReportEntryDate(entry));
  const time = normalizeLocalTimeString(entry?.time || entry?.hora || '00:00');
  if (!date) return NaN;
  const ms = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export function sortReportEntriesChronologically(entries = []) {
  return [...entries].sort((a, b) => {
    const diff = resolveReportEntryEpochMs(a) - resolveReportEntryEpochMs(b);
    if (diff !== 0) return diff;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

export function filterReportEntriesByBounds(entries = [], periodBounds = {}) {
  const { startDate, endDate } = periodBounds || {};
  if (!startDate || !endDate) return [...entries];

  return (entries || []).filter((entry) => {
    const date = resolveReportEntryDate(entry);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return date >= startDate && date <= endDate;
  });
}

export function enrichGlucoseForReport(readings = []) {
  return sortReportEntriesChronologically(
    (readings || []).map((reading) => {
      const enriched = enrichGlucoseReadingDisplayFields(reading);
      const value = Number(enriched.value);
      const classification = classifyGlucoseValue(value);
      return {
        ...enriched,
        value: Number.isFinite(value) ? value : null,
        sourceLabel: formatGlucoseSourceLabel(enriched),
        classificationLabel: classification.label,
        classificationColor: classification.color,
        displayDateTime: formatDisplayDateTime(enriched.date, enriched.time),
      };
    })
  ).filter((item) => Number.isFinite(item.value) && item.value > 0);
}

export function classifyGlucoseValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { label: '—', tier: 'unknown', color: [150, 150, 150] };
  }
  if (numeric < GLUCOSE_TARGET_LOW) {
    return { label: 'Abaixo', tier: 'low', color: [252, 129, 129] };
  }
  if (numeric > GLUCOSE_TARGET_HIGH) {
    return { label: 'Alto', tier: 'high', color: [237, 137, 54] };
  }
  return { label: 'No alvo', tier: 'inRange', color: [47, 157, 120] };
}

export function classifyGlucoseTier(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'unknown';
  if (numeric < GLUCOSE_TARGET_LOW) return 'below70';
  if (numeric <= GLUCOSE_TARGET_HIGH) return 'in70180';
  if (numeric <= 250) return 'in181250';
  return 'above250';
}

export function formatGlucoseSourceLabel(entry = {}) {
  const source = String(entry.source || entry.fonte || '').toLowerCase();
  if (source.includes('libre') || source === 'librelinkup' || source === 'abbottlibreview') {
    return 'LibreLinkUp';
  }
  if (source === 'manual' || source === 'manual_import') return 'Manual';
  if (source === 'dexcom') return 'Dexcom';
  if (source) return source.charAt(0).toUpperCase() + source.slice(1);
  return 'Manual';
}

export function formatDisplayDateTime(date, time) {
  const d = normalizeLocalDateString(date);
  const t = normalizeLocalTimeString(time).slice(0, 5);
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}${t ? ` ${t}` : ''}`;
}

export function formatShortDateLabel(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate || '').slice(5, 10) || '—';
  return `${match[3]}/${match[2]}`;
}

function addDaysToIsoDate(dateString, amount) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDayKeys(startDate, endDate) {
  const keys = [];
  let cursor = startDate;
  while (cursor && cursor <= endDate) {
    keys.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return keys;
}

export function buildGlucoseReportMetrics(readings = []) {
  const values = readings.map((item) => Number(item.value)).filter((v) => Number.isFinite(v) && v > 0);

  if (!values.length) {
    return {
      average: null,
      min: null,
      max: null,
      tir: null,
      variability: null,
      gmi: null,
      total: 0,
      hasData: false,
    };
  }

  const total = values.length;
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const inRange = values.filter((value) => value >= GLUCOSE_TARGET_LOW && value <= GLUCOSE_TARGET_HIGH).length;
  const tir = Math.round((inRange / total) * 100);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(total, 1);
  const variability = Math.round(Math.sqrt(variance));
  const gmi = Number((3.31 + 0.02392 * average).toFixed(1));

  return { average, min, max, tir, variability, gmi, total, hasData: true };
}

export function buildGlucoseTimelineSeries(readings = [], maxPoints = 72) {
  const sorted = enrichGlucoseForReport(readings);
  if (!sorted.length) return [];

  const step = sorted.length > maxPoints ? Math.ceil(sorted.length / maxPoints) : 1;
  const sampled = sorted.filter((_, index) => index % step === 0 || index === sorted.length - 1);

  return sampled.map((reading, index) => ({
    date: reading.date,
    label: `${formatShortDateLabel(reading.date)} ${String(reading.time || '').slice(0, 5)}`,
    shortLabel: index % Math.max(1, Math.floor(sampled.length / 7)) === 0
      ? formatShortDateLabel(reading.date)
      : String(reading.time || '').slice(0, 5),
    value: reading.value,
    color: reading.classificationColor,
  }));
}

export function buildGlucoseDailyAverageSeries(readings = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const buckets = new Map(dayKeys.map((day) => [day, { sum: 0, count: 0 }]));

  enrichGlucoseForReport(readings).forEach((reading) => {
    const date = resolveReportEntryDate(reading);
    if (!buckets.has(date)) return;
    const bucket = buckets.get(date);
    bucket.sum += reading.value;
    bucket.count += 1;
  });

  return dayKeys.map((date) => {
    const stats = buckets.get(date);
    const avg = stats?.count ? Math.round(stats.sum / stats.count) : 0;
    return {
      date,
      label: formatShortDateLabel(date),
      value: avg,
      color: avg < GLUCOSE_TARGET_LOW ? [252, 129, 129] : avg > GLUCOSE_TARGET_HIGH ? [237, 137, 54] : [47, 157, 120],
    };
  });
}

export function buildGlucoseRangeSeries(readings = []) {
  let inRange = 0;
  let high = 0;
  let low = 0;

  enrichGlucoseForReport(readings).forEach((reading) => {
    if (reading.classificationLabel === 'Abaixo') low += 1;
    else if (reading.classificationLabel === 'Alto') high += 1;
    else inRange += 1;
  });

  return [
    { label: 'No alvo', value: inRange, color: [47, 157, 120] },
    { label: 'Alta', value: high, color: [237, 137, 54] },
    { label: 'Baixa', value: low, color: [252, 129, 129] },
  ].filter((item) => item.value > 0);
}

function normalizeMealTypeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isGenericMealTypeLabel(normalized) {
  if (!normalized) return true;
  if (normalized === 'refeicao' || normalized === 'refeicao registrada') return true;
  return normalized.includes('refeicao registrada');
}

function classifyMealTypeByKeywords(normalized) {
  if (!normalized || isGenericMealTypeLabel(normalized)) return null;
  if (normalized.includes('cafe') || normalized.includes('breakfast')) return 'Café da manhã';
  if (normalized.includes('almoco') || normalized.includes('lunch')) return 'Almoço';
  if (normalized.includes('jantar') || normalized.includes('dinner')) return 'Jantar';
  if (normalized.includes('lanche') || normalized.includes('snack') || normalized.includes('colacao')) {
    return 'Lanche';
  }
  if (normalized.includes('ceia')) return 'Ceia';
  if (normalized.includes('outro')) return 'Não classificada';

  const key = normalized.replace(/\s+/g, '_');
  if (MEAL_TYPE_LABELS[key]) return MEAL_TYPE_LABELS[key];

  return null;
}

function classifyMealTypeByTime(entry = {}) {
  const time = normalizeLocalTimeString(
    entry.time || entry.hora || entry.hora_refeicao || entry.mealTime || ''
  );
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute)) return null;

  const totalMinutes = hour * 60 + minute;

  if (totalMinutes >= 22 * 60 || totalMinutes <= 4 * 60 + 59) return 'Ceia';
  if (totalMinutes <= 10 * 60 + 59) return 'Café da manhã';
  if (totalMinutes <= 14 * 60 + 59) return 'Almoço';
  if (totalMinutes <= 17 * 60 + 59) return 'Lanche';
  if (totalMinutes <= 21 * 60 + 59) return 'Jantar';

  return null;
}

export function resolveMealTypeLabel(entry = {}) {
  const rawSources = [
    entry.mealTypeLabel,
    entry.mealLabel,
    entry.title,
    entry.planSectionId,
  ];

  for (const source of rawSources) {
    const normalized = normalizeMealTypeText(source);
    if (!normalized) continue;
    const byKeyword = classifyMealTypeByKeywords(normalized);
    if (byKeyword) return byKeyword;
  }

  const normalizedSources = rawSources.map(normalizeMealTypeText).filter(Boolean);
  const hasOnlyGenericLabels =
    normalizedSources.length === 0 || normalizedSources.every(isGenericMealTypeLabel);

  if (hasOnlyGenericLabels) {
    return classifyMealTypeByTime(entry) || 'Não classificada';
  }

  const byTime = classifyMealTypeByTime(entry);
  if (byTime) return byTime;

  const readable = rawSources.find((source) => {
    const normalized = normalizeMealTypeText(source);
    return normalized && !isGenericMealTypeLabel(normalized);
  });

  return readable ? String(readable).trim() : 'Não classificada';
}

export function enrichMealsForReport(meals = []) {
  return sortReportEntriesChronologically(meals || []).map((entry) => {
    const foods = Array.isArray(entry?.foods)
      ? entry.foods
          .filter((f) => !f?.metadataOnly)
          .map((f) => f?.name || f?.nome || f?.alimento)
          .filter(Boolean)
      : [];
    const description = entry.description || foods.join(', ') || entry.title || '—';
    return {
      ...entry,
      mealTypeLabel: resolveMealTypeLabel(entry),
      foodsText: description,
      kcal: Math.round(Number(entry.kcal ?? entry.calories ?? entry.calorias_total) || 0),
      carbsG: Math.round(Number(entry.carbsG ?? entry.carbs ?? entry.carboidratos_total) || 0),
      proteinG: Math.round(Number(entry.proteinG ?? entry.protein ?? entry.proteinas_total) || 0),
      fatG: Math.round(Number(entry.fatG ?? entry.fat ?? entry.gorduras_total) || 0),
      displayDateTime: formatDisplayDateTime(entry.date, entry.time || entry.hora),
    };
  });
}

export function buildMealTypeSeries(meals = []) {
  const map = new Map();
  enrichMealsForReport(meals).forEach((entry) => {
    const label = entry.mealTypeLabel || 'Não classificada';
    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value], index) => ({
      label,
      value,
      color: [[66, 153, 225], [47, 157, 120], [237, 137, 54], [159, 122, 234], [72, 187, 187]][index % 5],
    }));
}

export function buildMealDailySeries(meals = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const map = new Map(dayKeys.map((day) => [day, 0]));
  enrichMealsForReport(meals).forEach((entry) => {
    const date = resolveReportEntryDate(entry);
    if (map.has(date)) map.set(date, (map.get(date) || 0) + 1);
  });
  return dayKeys.map((date) => ({
    date,
    label: formatShortDateLabel(date),
    value: map.get(date) || 0,
  }));
}

export function buildMealMacroTotals(meals = []) {
  return enrichMealsForReport(meals).reduce(
    (acc, entry) => ({
      kcal: acc.kcal + entry.kcal,
      carbsG: acc.carbsG + entry.carbsG,
      proteinG: acc.proteinG + entry.proteinG,
      fatG: acc.fatG + entry.fatG,
    }),
    { kcal: 0, carbsG: 0, proteinG: 0, fatG: 0 }
  );
}

export function classifyInsulinType(entry = {}) {
  const category = String(entry.insulinCategory || entry.categoria_insulina || '').toLowerCase();
  if (category === 'basal' || category.includes('basal')) return 'basal';
  if (['bolus', 'rapida', 'prandial', 'correcao', 'intermediaria', 'premisturada'].includes(category)) {
    return category === 'basal' ? 'basal' : 'bolus';
  }
  return 'outro';
}

export function getInsulinDoseUi(entry = {}) {
  const fromNumber = Number(entry.medicineQuantityNumber);
  if (Number.isFinite(fromNumber) && fromNumber > 0) return fromNumber;
  const value = Number(String(entry.medicineQuantity ?? entry.quantidade ?? entry.dose_ui ?? '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function enrichInsulinForReport(entries = []) {
  return sortReportEntriesChronologically(entries || []).map((entry) => {
    const insulinType = classifyInsulinType(entry);
    const doseUi = getInsulinDoseUi(entry);
    return {
      ...entry,
      insulinType,
      insulinTypeLabel: insulinType === 'basal' ? 'Basal' : insulinType === 'bolus' ? 'Bolus' : 'Outro',
      doseUi,
      displayDateTime: formatDisplayDateTime(entry.date, entry.time),
      medicineName: entry.medicineName || entry.nome_medicamento || entry.label || 'Insulina',
      observacao: entry.observacao || entry.medicineNote || entry.note || '',
    };
  });
}

export function buildInsulinDailySeries(entries = [], periodBounds = {}, { insulinType = null } = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const map = new Map(dayKeys.map((day) => [day, 0]));

  enrichInsulinForReport(entries)
    .filter((entry) => !insulinType || entry.insulinType === insulinType)
    .forEach((entry) => {
      const date = resolveReportEntryDate(entry);
      if (!map.has(date)) return;
      map.set(date, (map.get(date) || 0) + entry.doseUi);
    });

  return dayKeys.map((date) => ({
    date,
    label: formatShortDateLabel(date),
    value: Math.round((map.get(date) || 0) * 10) / 10,
  }));
}

export function buildInsulinTypeBreakdown(entries = []) {
  const map = { basal: 0, bolus: 0, outro: 0 };
  enrichInsulinForReport(entries).forEach((entry) => {
    map[entry.insulinType] = (map[entry.insulinType] || 0) + entry.doseUi;
  });
  return [
    { label: 'Basal (UI)', value: Math.round(map.basal * 10) / 10, color: [159, 122, 234] },
    { label: 'Bolus (UI)', value: Math.round(map.bolus * 10) / 10, color: [47, 157, 120] },
    { label: 'Outro (UI)', value: Math.round(map.outro * 10) / 10, color: [237, 137, 54] },
  ].filter((item) => item.value > 0);
}

export function resolveMedicationUsageLabel(entry = {}) {
  if (entry.medicineContinuousUse || entry.uso_continuo) return 'Contínuo';
  if (entry.medicineDays || entry.dias_tratamento) return `Pontual (${entry.medicineDays || entry.dias_tratamento} dias)`;
  return 'Pontual';
}

export function enrichMedicationForReport(entries = []) {
  return sortReportEntriesChronologically(entries || []).map((entry) => ({
    ...entry,
    medicineName: entry.medicineName || entry.nome_medicamento || entry.label || 'Medicamento',
    doseText: entry.medicineQuantity
      ? `${entry.medicineQuantity} ${entry.medicineUnit || entry.unidade_medida || ''}`.trim()
      : '—',
    usageLabel: resolveMedicationUsageLabel(entry),
    statusLabel: entry.statusLabel || entry.medicationStatus || 'Tomado',
    displayDateTime: formatDisplayDateTime(entry.date, entry.time),
  }));
}

export function buildMedicationByNameSeries(entries = []) {
  const map = new Map();
  enrichMedicationForReport(entries).forEach((entry) => {
    const label = String(entry.medicineName || 'Medicamento').slice(0, 22);
    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value], index) => ({
      label,
      value,
      color: [[237, 137, 54], [159, 122, 234], [66, 153, 225], [47, 157, 120], [252, 129, 129], [72, 187, 187]][index % 6],
    }));
}

export function buildMedicationAdherenceSeries(entries = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const map = new Map(dayKeys.map((day) => [day, 0]));
  enrichMedicationForReport(entries).forEach((entry) => {
    const date = resolveReportEntryDate(entry);
    if (map.has(date)) map.set(date, (map.get(date) || 0) + 1);
  });
  return dayKeys.map((date) => ({
    date,
    label: formatShortDateLabel(date),
    value: map.get(date) || 0,
  }));
}

export function buildDailyCountSeries(entries = [], periodBounds = {}, getDate = resolveReportEntryDate) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const map = new Map(dayKeys.map((day) => [day, 0]));
  (entries || []).forEach((entry) => {
    const date = typeof getDate === 'function' ? getDate(entry) : resolveReportEntryDate(entry);
    if (map.has(date)) map.set(date, (map.get(date) || 0) + 1);
  });
  return dayKeys.map((date) => ({
    date,
    label: formatShortDateLabel(date),
    value: map.get(date) || 0,
  }));
}

export function buildGlucoseTirDetailedSeries(readings = []) {
  const tiers = { below70: 0, in70180: 0, in181250: 0, above250: 0 };

  enrichGlucoseForReport(readings).forEach((reading) => {
    const tier = classifyGlucoseTier(reading.value);
    if (tier !== 'unknown') tiers[tier] += 1;
  });

  return [
    { label: 'Abaixo de 70', value: tiers.below70, color: [252, 129, 129] },
    { label: '70 a 180', value: tiers.in70180, color: [47, 157, 120] },
    { label: '181 a 250', value: tiers.in181250, color: [237, 137, 54] },
    { label: 'Acima de 250', value: tiers.above250, color: [229, 62, 62] },
  ].filter((item) => item.value > 0);
}

export function buildGlucoseDailyMinAvgMaxSeries(readings = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const buckets = new Map(dayKeys.map((day) => [day, []]));

  enrichGlucoseForReport(readings).forEach((reading) => {
    const date = resolveReportEntryDate(reading);
    if (!buckets.has(date)) return;
    buckets.get(date).push(reading.value);
  });

  return dayKeys
    .map((date) => {
      const values = buckets.get(date) || [];
      if (!values.length) {
        return { date, label: formatShortDateLabel(date), min: 0, avg: 0, max: 0, count: 0 };
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      return { date, label: formatShortDateLabel(date), min, avg, max, count: values.length };
    })
    .filter((item) => item.count > 0);
}

export function buildGlucoseDailyProfiles(readings = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);

  return dayKeys
    .map((date) => {
      const dayReadings = enrichGlucoseForReport(readings).filter(
        (reading) => resolveReportEntryDate(reading) === date
      );
      if (!dayReadings.length) return null;

      const points = dayReadings.map((reading) => ({
        label: String(reading.time || '00:00').slice(0, 5),
        hour: Number(String(reading.time || '0').slice(0, 2)) || 0,
        value: reading.value,
      }));

      const values = points.map((point) => point.value);
      return {
        date,
        label: formatShortDateLabel(date),
        points,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        count: points.length,
      };
    })
    .filter(Boolean);
}

export function groupReportEntriesByDay(entries = [], getDate = resolveReportEntryDate) {
  const map = new Map();

  sortReportEntriesChronologically(entries).forEach((entry) => {
    const date = getDate(entry);
    if (!date) return;
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(entry);
  });

  return [...map.entries()].map(([date, groupEntries]) => ({
    date,
    label: formatShortDateLabel(date),
    entries: groupEntries,
  }));
}

export function buildMealCaloriesDailySeries(meals = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const map = new Map(dayKeys.map((day) => [day, 0]));

  enrichMealsForReport(meals).forEach((entry) => {
    const date = resolveReportEntryDate(entry);
    if (map.has(date)) map.set(date, (map.get(date) || 0) + entry.kcal);
  });

  return dayKeys.map((date) => ({
    date,
    label: formatShortDateLabel(date),
    value: map.get(date) || 0,
  }));
}

export function buildMealCarbsDailySeries(meals = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const map = new Map(dayKeys.map((day) => [day, 0]));

  enrichMealsForReport(meals).forEach((entry) => {
    const date = resolveReportEntryDate(entry);
    if (map.has(date)) map.set(date, (map.get(date) || 0) + entry.carbsG);
  });

  return dayKeys.map((date) => ({
    date,
    label: formatShortDateLabel(date),
    value: map.get(date) || 0,
  }));
}

export function buildMealMacroBreakdownSeries(meals = []) {
  const totals = buildMealMacroTotals(meals);
  return [
    { label: 'Carboidratos', value: totals.carbsG, color: [66, 153, 225] },
    { label: 'Proteínas', value: totals.proteinG, color: [47, 157, 120] },
    { label: 'Gorduras', value: totals.fatG, color: [237, 137, 54] },
  ].filter((item) => item.value > 0);
}

export function buildInsulinApplicationsDailySeries(entries = [], periodBounds = {}) {
  return buildDailyCountSeries(enrichInsulinForReport(entries), periodBounds);
}

export function buildMedicationHourDistribution(entries = []) {
  const map = new Map([
    ['06-11h', 0],
    ['12-17h', 0],
    ['18-23h', 0],
    ['00-05h', 0],
  ]);

  enrichMedicationForReport(entries).forEach((entry) => {
    const hour = Number(String(entry.time || entry.hora || '12').slice(0, 2));
    if (hour >= 6 && hour <= 11) map.set('06-11h', (map.get('06-11h') || 0) + 1);
    else if (hour >= 12 && hour <= 17) map.set('12-17h', (map.get('12-17h') || 0) + 1);
    else if (hour >= 18 && hour <= 23) map.set('18-23h', (map.get('18-23h') || 0) + 1);
    else map.set('00-05h', (map.get('00-05h') || 0) + 1);
  });

  return [...map.entries()].map(([label, value], index) => ({
    label,
    value,
    color: [[237, 137, 54], [159, 122, 234], [66, 153, 225], [150, 150, 150]][index],
  }));
}

export function buildMedicationAdherencePercentSeries(entries = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const byName = new Map();

  enrichMedicationForReport(entries).forEach((entry) => {
    const name = String(entry.medicineName || 'Medicamento').slice(0, 24);
    const days = byName.get(name) || new Set();
    const date = resolveReportEntryDate(entry);
    if (date) days.add(date);
    byName.set(name, days);
  });

  const totalDays = Math.max(dayKeys.length, 1);

  return [...byName.entries()]
    .map(([label, days], index) => ({
      label,
      value: Math.round((days.size / totalDays) * 100),
      display: `${Math.round((days.size / totalDays) * 100)}%`,
      max: 100,
      color: [[237, 137, 54], [159, 122, 234], [66, 153, 225], [47, 157, 120], [252, 129, 129]][index % 5],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function buildExecutiveAlerts({
  glucose = {},
  meals = {},
  insulin = {},
  medication = {},
  summary = {},
  periodBounds = {},
} = {}) {
  const alerts = [];
  const metrics = glucose.metrics || {};
  const tirDetailed = glucose.tirDetailedSeries || [];
  const totalReadings = metrics.total || 0;

  if (totalReadings > 0) {
    const aboveTarget =
      (tirDetailed.find((item) => item.label === '181 a 250')?.value || 0) +
      (tirDetailed.find((item) => item.label === 'Acima de 250')?.value || 0) +
      (tirDetailed.find((item) => item.label === 'Abaixo de 70')?.value || 0);
    const inRange = tirDetailed.find((item) => item.label === '70 a 180')?.value || 0;

    if (aboveTarget > inRange) {
      alerts.push('Maior parte das leituras ficou fora da meta glicêmica (70–180 mg/dL).');
    } else if (metrics.tir != null && metrics.tir >= 70) {
      alerts.push(`Boa estabilidade glicêmica: ${metrics.tir}% das leituras no alvo.`);
    }

    const dailyAvg = (glucose.dailyAverageSeries || []).filter((item) => item.value > 0);
    const peakDay = [...dailyAvg].sort((a, b) => b.value - a.value)[0];
    if (peakDay) {
      alerts.push(`Dia com maior média glicêmica: ${peakDay.label} (${peakDay.value} mg/dL).`);
    }
  }

  const calSeries = meals.caloriesDailySeries || [];
  const peakCalDay = [...calSeries].sort((a, b) => b.value - a.value)[0];
  if (peakCalDay?.value > 0) {
    alerts.push(`Dia com maior consumo calórico: ${peakCalDay.label} (${peakCalDay.value} kcal).`);
  }

  const insulinTotal = (insulin.entries || []).reduce((sum, entry) => sum + (entry.doseUi || 0), 0);
  if (insulinTotal > 0) {
    alerts.push(`Total de insulina no período: ${Math.round(insulinTotal * 10) / 10} UI.`);
  }

  const totalRecords =
    (summary.meals || 0) + (summary.glucose || 0) + (summary.insulin || 0) + (summary.medication || 0);
  if (totalRecords === 0) {
    alerts.push('Nenhum registro clínico encontrado no período selecionado.');
  } else if (periodBounds.startDate && periodBounds.endDate) {
    alerts.push(
      `Período analisado: ${formatShortDateLabel(periodBounds.startDate)} a ${formatShortDateLabel(periodBounds.endDate)}.`
    );
  }

  if ((medication.entries || []).length === 0 && (summary.medication || 0) === 0) {
    alerts.push('Sem registros de medicação no período.');
  }

  return alerts.slice(0, 6);
}

export function buildGlucosePatientDonutSeries(readings = []) {
  let inRange = 0;
  let high = 0;
  let low = 0;

  enrichGlucoseForReport(readings).forEach((reading) => {
    if (reading.classificationLabel === 'Abaixo') low += 1;
    else if (reading.classificationLabel === 'Alto') high += 1;
    else inRange += 1;
  });

  return [
    { label: 'Dentro da meta', value: inRange, color: [47, 157, 120] },
    { label: 'Acima da meta', value: high, color: [237, 137, 54] },
    { label: 'Abaixo da meta', value: low, color: [252, 129, 129] },
  ].filter((item) => item.value > 0);
}

export function buildPatientFriendlySummary(analytics = {}, bundle = {}) {
  const g = analytics.glucose?.metrics || bundle.glycemicMetrics || {};
  const s = analytics.summary || bundle.summary || {};
  const meals = analytics.meals || {};
  const insulin = analytics.insulin || {};
  const medication = analytics.medication || {};
  const periodBounds = analytics.periodBounds || bundle.periodBounds || {};
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const activeDays = Math.max(dayKeys.length, 1);

  const mealCount = meals.entries?.length || s.meals || 0;
  const insulinApps = insulin.entries?.length || s.insulin || 0;
  const medCount = medication.entries?.length || s.medication || 0;
  const totalInsulinUi =
    analytics.executive?.totalInsulinUi ??
    Math.round((insulin.entries || []).reduce((sum, entry) => sum + getInsulinDoseUi(entry), 0) * 10) / 10;

  const basalUi = insulin.typeBreakdown?.find((item) => String(item.label || '').includes('Basal'))?.value || 0;
  const bolusUi = insulin.typeBreakdown?.find((item) => String(item.label || '').includes('Bolus'))?.value || 0;
  const insulinMixTotal = basalUi + bolusUi || totalInsulinUi;
  const basalPercent = insulinMixTotal ? Math.round((basalUi / insulinMixTotal) * 100) : 0;
  const bolusPercent = insulinMixTotal ? Math.round((bolusUi / insulinMixTotal) * 100) : 0;
  const dailyInsulinAvg = activeDays ? Math.round((totalInsulinUi / activeDays) * 10) / 10 : 0;

  const macroTotals = meals.macroTotals || { kcal: 0, carbsG: 0 };
  const avgKcalDay = Math.round((macroTotals.kcal || 0) / activeDays);
  const avgCarbsDay = Math.round((macroTotals.carbsG || 0) / activeDays);
  const topMealType = meals.typeSeries?.[0]?.label || '—';

  const dailyAvg = (analytics.glucose?.dailyAverageSeries || []).filter((item) => item.value > 0);
  const worstDay = dailyAvg.length ? [...dailyAvg].sort((a, b) => b.value - a.value)[0] : null;
  const bestDay = dailyAvg.length
    ? [...dailyAvg].sort((a, b) => Math.abs(a.value - 125) - Math.abs(b.value - 125))[0]
    : null;

  const medAdherenceSeries = medication.adherencePercentSeries || [];
  const medAdherencePct = medAdherenceSeries.length
    ? Math.round(medAdherenceSeries.reduce((sum, item) => sum + item.value, 0) / medAdherenceSeries.length)
    : medCount > 0
      ? Math.round(
          ((medication.adherenceSeries || []).filter((item) => item.value > 0).length / activeDays) * 100
        )
      : 0;

  const medicinesUsed =
    (medication.byNameSeries || [])
      .map((item) => item.label)
      .slice(0, 5)
      .join(', ') || '—';

  const tir = g.tir ?? 0;
  const glucoseInsights = [];
  if ((g.total || 0) > 0) {
    glucoseInsights.push(`Sua glicose ficou dentro da meta em ${tir}% do tempo.`);
    if (bestDay) glucoseInsights.push(`O dia com melhor controle foi ${bestDay.label}.`);
    if (worstDay) glucoseInsights.push(`O dia com maior média glicêmica foi ${worstDay.label}.`);
  } else {
    glucoseInsights.push('Não há leituras de glicose suficientes nesta semana.');
  }

  const closingMessage =
    g.average != null
      ? `Durante esta semana sua glicose média foi de ${g.average} mg/dL. Você permaneceu ${tir}% do tempo dentro da meta. Foram registradas ${mealCount} refeições, ${insulinApps} aplicações de insulina e ${medCount} medicações. Continue acompanhando seus registros e mantendo contato com sua equipe de saúde.`
      : `Nesta semana foram registradas ${mealCount} refeições, ${insulinApps} aplicações de insulina e ${medCount} medicações. Continue registrando seus dados e mantendo contato com sua equipe de saúde.`;

  return {
    cards: {
      average: g.average,
      tir: g.tir,
      max: g.max,
      min: g.min,
      meals: mealCount,
      insulinApps,
      medications: medCount,
    },
    glucoseInsights,
    donutSeries: buildGlucosePatientDonutSeries(analytics.glucose?.readings || []),
    meals: {
      total: mealCount,
      avgKcalDay,
      avgCarbsDay,
      topMealType,
    },
    insulin: {
      totalUi: totalInsulinUi,
      dailyAvg: dailyInsulinAvg,
      basalPercent,
      bolusPercent,
    },
    medication: {
      total: medCount,
      adherencePct: medAdherencePct,
      medicinesUsed,
    },
    closingMessage,
  };
}

export function buildClinicalReportAnalytics(bundle = {}) {
  const periodBounds = bundle.periodBounds || {};
  const glucoseReadings = enrichGlucoseForReport(bundle.glucoseReadings || []);
  const mealEntries = enrichMealsForReport(bundle.mealEntries || []);
  const insulinEntries = enrichInsulinForReport(bundle.insulinEntries || []);
  const medicationEntries = enrichMedicationForReport(bundle.medicationEntries || []);
  const glucoseMetrics = buildGlucoseReportMetrics(glucoseReadings);
  const tirDetailedSeries = buildGlucoseTirDetailedSeries(glucoseReadings);
  const dailyAverageSeries = buildGlucoseDailyAverageSeries(glucoseReadings, periodBounds);
  const dailyMinAvgMaxSeries = buildGlucoseDailyMinAvgMaxSeries(glucoseReadings, periodBounds);
  const dailyProfiles = buildGlucoseDailyProfiles(glucoseReadings, periodBounds);
  const caloriesDailySeries = buildMealCaloriesDailySeries(mealEntries, periodBounds);
  const carbsDailySeries = buildMealCarbsDailySeries(mealEntries, periodBounds);
  const macroBreakdownSeries = buildMealMacroBreakdownSeries(mealEntries);
  const insulinApplicationsDaily = buildInsulinApplicationsDailySeries(insulinEntries, periodBounds);
  const medicationHourSeries = buildMedicationHourDistribution(medicationEntries);
  const medicationAdherencePercent = buildMedicationAdherencePercentSeries(medicationEntries, periodBounds);

  const glucoseBlock = {
    readings: glucoseReadings,
    metrics: glucoseMetrics,
    timelineSeries: buildGlucoseTimelineSeries(glucoseReadings, 24),
    dailyAverageSeries,
    dailyMinAvgMaxSeries,
    dailyProfiles,
    rangeSeries: buildGlucoseRangeSeries(glucoseReadings),
    tirDetailedSeries,
    groupedByDay: groupReportEntriesByDay(glucoseReadings),
  };

  const mealsBlock = {
    entries: mealEntries,
    hasData: mealEntries.length > 0,
    typeSeries: buildMealTypeSeries(mealEntries),
    dailySeries: buildMealDailySeries(mealEntries, periodBounds),
    caloriesDailySeries,
    carbsDailySeries,
    macroBreakdownSeries,
    macroTotals: buildMealMacroTotals(mealEntries),
    groupedByDay: groupReportEntriesByDay(mealEntries),
  };

  const insulinBlock = {
    entries: insulinEntries,
    hasData: insulinEntries.length > 0,
    typeBreakdown: buildInsulinTypeBreakdown(insulinEntries),
    dailyTotalSeries: buildInsulinDailySeries(insulinEntries, periodBounds),
    dailyBasalSeries: buildInsulinDailySeries(insulinEntries, periodBounds, { insulinType: 'basal' }),
    dailyBolusSeries: buildInsulinDailySeries(insulinEntries, periodBounds, { insulinType: 'bolus' }),
    applicationsDailySeries: insulinApplicationsDaily,
    groupedByDay: groupReportEntriesByDay(insulinEntries),
  };

  const medicationBlock = {
    entries: medicationEntries,
    hasData: medicationEntries.length > 0,
    byNameSeries: buildMedicationByNameSeries(medicationEntries),
    adherenceSeries: buildMedicationAdherenceSeries(medicationEntries, periodBounds),
    hourSeries: medicationHourSeries,
    adherencePercentSeries: medicationAdherencePercent,
    groupedByDay: groupReportEntriesByDay(medicationEntries),
  };

  const executive = {
    alerts: buildExecutiveAlerts({
      glucose: glucoseBlock,
      meals: mealsBlock,
      insulin: insulinBlock,
      medication: medicationBlock,
      summary: bundle.summary || {},
      periodBounds,
    }),
    totalRecords:
      (bundle.summary?.meals || 0) +
      (bundle.summary?.glucose || 0) +
      (bundle.summary?.insulin || 0) +
      (bundle.summary?.medication || 0),
    totalInsulinUi: Math.round(
      insulinEntries.reduce((sum, entry) => sum + getInsulinDoseUi(entry), 0) * 10
    ) / 10,
  };

  return {
    periodBounds,
    summary: bundle.summary || {},
    executive,
    patientSummary: buildPatientFriendlySummary(
      {
        glucose: glucoseBlock,
        meals: mealsBlock,
        insulin: insulinBlock,
        medication: medicationBlock,
        executive,
        periodBounds,
        summary: bundle.summary || {},
      },
      bundle
    ),
    glucose: glucoseBlock,
    meals: mealsBlock,
    insulin: insulinBlock,
    medication: medicationBlock,
  };
}
