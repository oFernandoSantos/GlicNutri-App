import { mergeCachedGlucoseReadings } from '../servicos/centralGlicose';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

function countUniqueMealsByDate(mealEntries) {
  const counts = new Map();
  (Array.isArray(mealEntries) ? mealEntries : []).forEach((entry) => {
    const date = String(entry?.date || '').trim();
    const entryKey = String(entry?.databaseId || entry?.id || '').trim();
    if (!date) return;
    const bucket = counts.get(date) || { total: 0, ids: new Set() };
    if (entryKey && bucket.ids.has(entryKey)) {
      return;
    }
    if (entryKey) {
      bucket.ids.add(entryKey);
    }
    bucket.total += 1;
    counts.set(date, bucket);
  });
  return counts;
}

export function buildWeeklyAdherenceFromMeals(mealEntries, targetMeals = 3) {
  const safeTarget = Math.max(targetMeals || 3, 1);
  const mealCountsByDate = countUniqueMealsByDate(mealEntries);
  const today = new Date();
  const items = [];
  let hasRealData = false;

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - index);
    const isoDate = date.toISOString().slice(0, 10);
    const total = mealCountsByDate.get(isoDate)?.total || 0;
    if (total > 0) hasRealData = true;

    items.push({
      id: `adherence-${isoDate}`,
      label: WEEKDAY_LABELS[6 - index],
      isoDate,
      value: clampPercent((total / safeTarget) * 100),
      mealsLogged: total,
    });
  }

  return { items, hasRealData };
}

export function averageAdherence(items = []) {
  if (!items.length) return 0;
  return clampPercent(
    items.reduce((sum, item) => sum + Number(item.value || 0), 0) / items.length
  );
}

export function computeAdherenceStreak(items = []) {
  let streak = 0;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (Number(items[index]?.value || 0) >= 80) streak += 1;
    else break;
  }
  return streak;
}

export function categorizeObjectiveText(text) {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('gestacional')) return { id: 'gestacional', label: 'D. Gestacional' };
  if (normalized.includes('tipo 1') || normalized.includes('t1') || normalized.includes('tipo1')) {
    return { id: 'diabetes_t1', label: 'Diabetes T1' };
  }
  if (normalized.includes('tipo 2') || normalized.includes('t2') || normalized.includes('tipo2')) {
    return { id: 'diabetes_t2', label: 'Diabetes T2' };
  }
  if (normalized.includes('diabetes')) return { id: 'diabetes', label: 'Diabetes' };
  if (normalized.includes('emagrec') || normalized.includes('perda de peso')) {
    return { id: 'emagrecimento', label: 'Emagrecimento' };
  }
  if (normalized.includes('ganho') || normalized.includes('massa')) {
    return { id: 'ganho_massa', label: 'Ganho de Massa' };
  }
  if (normalized.includes('reeduc') || normalized.includes('habito')) {
    return { id: 'reeducacao', label: 'Reeducação' };
  }
  return { id: 'acompanhamento', label: 'Acompanhamento' };
}

export function normalizeRiskBucket(riskText, latestGlucose) {
  const normalized = String(riskText || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('alto')) return 'alto';
  if (normalized.includes('moder') || normalized.includes('medio')) return 'moderado';

  const glucose = Number(latestGlucose);
  if (glucose >= 250) return 'alto';
  if (glucose >= 180) return 'moderado';
  return 'baixo';
}

export function riskBucketLabel(bucket) {
  if (bucket === 'alto') return 'Alto';
  if (bucket === 'moderado') return 'Moderado';
  return 'Baixo';
}

export function buildPortfolioWeeklyAdherence(patientWeeks = []) {
  if (!patientWeeks.length) {
    return WEEKDAY_LABELS.map((label, index) => ({
      id: `portfolio-${index}`,
      label,
      value: 0,
    }));
  }

  const dayCount = patientWeeks[0]?.items?.length || 7;
  const aggregated = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const values = patientWeeks
      .map((week) => week.items?.[dayIndex]?.value)
      .filter((value) => Number.isFinite(Number(value)));

    aggregated.push({
      id: `portfolio-day-${dayIndex}`,
      label: patientWeeks[0]?.items?.[dayIndex]?.label || WEEKDAY_LABELS[dayIndex],
      value: values.length
        ? clampPercent(values.reduce((sum, value) => sum + Number(value), 0) / values.length)
        : 0,
    });
  }

  return aggregated;
}

export function buildGlycemicSummary(glucoseReadings = []) {
  const values = mergeCachedGlucoseReadings(Array.isArray(glucoseReadings) ? glucoseReadings : [])
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) {
    return { average: null, tir: null, count: 0, last: null };
  }

  const total = values.length;
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / total);
  const inRange = values.filter((value) => value >= 70 && value <= 180).length;

  return {
    average,
    tir: clampPercent((inRange / total) * 100),
    count: total,
    last: values[0],
  };
}
