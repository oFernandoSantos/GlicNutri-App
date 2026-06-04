import { nutriGreenRgb } from '../temas/designSystemNutricionista';
import { clampPercent, riskBucketLabel } from './adesaoNutricional';
import { buildExecutiveAlerts, resolveMealTypeLabel } from './relatorioPacienteAnalytics';

const CONTROL_LABELS = {
  bom: 'Bom controle',
  atencao: 'Atenção',
  critico: 'Crítico',
  sem_dados: 'Sem dados',
};

function resolveEntryDate(entry) {
  if (typeof entry === 'string' || typeof entry === 'number') {
    const raw = String(entry).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return raw.slice(0, 10) || null;
  }

  const raw = String(
    entry?.date || entry?.data || entry?.data_registro || entry?.created_at || entry?.createdAt || ''
  ).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw.slice(0, 10) || null;
}

function addDaysToIsoDate(dateString, amount) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDayKeys(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const keys = [];
  let cursor = startDate;
  while (cursor && cursor <= endDate) {
    keys.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return keys;
}

function formatShortDateLabel(isoDate) {
  if (!isoDate) return '—';
  const [, month, day] = String(isoDate).split('-');
  return `${day}/${month}`;
}

export function buildAdherenceSeriesForRange(mealEntries = [], periodBounds = {}, targetMeals = 3) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const safeTarget = Math.max(targetMeals || 3, 1);
  const counts = new Map(dayKeys.map((key) => [key, 0]));

  (mealEntries || []).forEach((entry) => {
    const date = resolveEntryDate(entry);
    if (!date || !counts.has(date)) return;
    counts.set(date, (counts.get(date) || 0) + 1);
  });

  const items = dayKeys.map((isoDate) => {
    const total = counts.get(isoDate) || 0;
    const dateObj = new Date(`${isoDate}T12:00:00`);
    const weekday = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][dateObj.getDay()];
    return {
      id: `adherence-${isoDate}`,
      label: dayKeys.length <= 7 ? weekday : formatShortDateLabel(isoDate),
      isoDate,
      value: clampPercent((total / safeTarget) * 100),
      mealsLogged: total,
    };
  });

  const hasRealData = items.some((item) => item.mealsLogged > 0);
  return { items, hasRealData };
}

export function resolveLastRecordDate(entries = []) {
  let latest = null;
  (entries || []).forEach((entry) => {
    const date = resolveEntryDate(entry);
    if (!date) return;
    if (!latest || date > latest) latest = date;
  });
  return latest;
}

export function computeDaysSince(isoDate, referenceDate = getTodayDateString()) {
  if (!isoDate) return null;
  const start = new Date(`${isoDate}T12:00:00`).getTime();
  const end = new Date(`${referenceDate}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

export function classifyPatientControl(row = {}) {
  const tir = Number(row.glucoseTir);
  const avg = Number(row.glucoseAverage);
  const adherence = Number(row.adherence);
  const hasData =
    Number(row.glucoseCount) > 0 ||
    Number(row.mealsInPeriod) > 0 ||
    Number(row.insulinCount) > 0 ||
    Number(row.medicationsInPeriod) > 0;

  if (row.inactive || !hasData) return 'sem_dados';
  if (row.riskBucket === 'alto' || (Number.isFinite(tir) && tir > 0 && tir < 50) || avg > 200) {
    return 'critico';
  }
  if (
    (Number.isFinite(tir) && tir > 0 && tir < 70) ||
    (Number.isFinite(avg) && avg >= 180) ||
    adherence < 55
  ) {
    return 'atencao';
  }
  return 'bom';
}

export function buildPortfolioEvolutionSeries(rows = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  if (!dayKeys.length) return [];

  return dayKeys.map((isoDate) => {
    const tirValues = [];
    const glucoseValues = [];

    rows.forEach((row) => {
      const dayTir = row.dailyTirMap?.[isoDate];
      const dayAvg = row.dailyGlucoseAvgMap?.[isoDate];
      if (Number.isFinite(dayTir) && dayTir > 0) tirValues.push(dayTir);
      if (Number.isFinite(dayAvg) && dayAvg > 0) glucoseValues.push(dayAvg);
    });

    const tirAvg = tirValues.length
      ? Math.round(tirValues.reduce((sum, value) => sum + value, 0) / tirValues.length)
      : 0;
    const glucoseAvg = glucoseValues.length
      ? Math.round(glucoseValues.reduce((sum, value) => sum + value, 0) / glucoseValues.length)
      : 0;

    return {
      date: isoDate,
      label: formatShortDateLabel(isoDate),
      tir: tirAvg,
      glucose: glucoseAvg,
    };
  });
}

function buildDailyGlucoseMaps(glucoseReadings = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const byDay = new Map(dayKeys.map((key) => [key, []]));

  (glucoseReadings || []).forEach((entry) => {
    const date = resolveEntryDate(entry);
    const value = Number(entry?.value);
    if (!date || !byDay.has(date) || !Number.isFinite(value) || value <= 0) return;
    byDay.get(date).push(value);
  });

  const dailyGlucoseAvgMap = {};
  const dailyTirMap = {};

  dayKeys.forEach((key) => {
    const values = byDay.get(key) || [];
    if (!values.length) return;
    const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const inRange = values.filter((value) => value >= 70 && value <= 180).length;
    dailyGlucoseAvgMap[key] = average;
    dailyTirMap[key] = clampPercent((inRange / values.length) * 100);
  });

  return { dailyGlucoseAvgMap, dailyTirMap };
}

export function enrichPatientRowWithPeriodData(row, experience = {}, periodBounds = {}, inactiveDays = 7) {
  const mealEntries = experience?.filteredMeals || [];
  const glucoseReadings = experience?.filteredGlucose || [];
  const medicationEntries = experience?.filteredMedication || [];
  const insulinEntries = experience?.filteredInsulin || [];
  const pureMedicationEntries = experience?.filteredPureMeds || medicationEntries;

  const { dailyGlucoseAvgMap, dailyTirMap } = buildDailyGlucoseMaps(glucoseReadings, periodBounds);
  const lastRecordDate = resolveLastRecordDate([
    ...mealEntries,
    ...glucoseReadings,
    ...medicationEntries,
  ]);
  const daysSinceLastRecord = computeDaysSince(lastRecordDate, periodBounds.endDate);
  const inactive =
    daysSinceLastRecord == null ? true : daysSinceLastRecord >= Number(inactiveDays || 7);

  const periodDayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  const periodDays = Math.max(periodDayKeys.length, 1);
  const activeDaySet = new Set();

  [...mealEntries, ...glucoseReadings, ...medicationEntries].forEach((entry) => {
    const date = resolveEntryDate(entry);
    if (date && periodDayKeys.includes(date)) activeDaySet.add(date);
  });

  const activeDays = activeDaySet.size;
  const totalRecords =
    mealEntries.length + glucoseReadings.length + medicationEntries.length;

  let usageFrequency = 'inativo';
  if (!inactive && totalRecords > 0) {
    if (activeDays >= Math.max(5, Math.round(periodDays * 0.6))) usageFrequency = 'diario';
    else if (activeDays >= 2) usageFrequency = 'semanal';
    else usageFrequency = 'esporadico';
  }

  const totalCalories = mealEntries.reduce(
    (sum, entry) => sum + (Number(entry?.calories ?? entry?.kcal) || 0),
    0
  );
  const totalCarbs = mealEntries.reduce(
    (sum, entry) =>
      sum +
      (Number(entry?.carbsG ?? entry?.carbs ?? entry?.carboidratos_total ?? entry?.carboidratos) || 0),
    0
  );

  const mealTypeCountsMap = new Map();
  mealEntries.forEach((entry) => {
    const label = resolveMealTypeLabel(entry);
    mealTypeCountsMap.set(label, (mealTypeCountsMap.get(label) || 0) + 1);
  });
  const mealTypeCounts = [...mealTypeCountsMap.entries()].map(([label, value]) => ({ label, value }));

  const medicationNameMap = new Map();
  pureMedicationEntries.forEach((entry) => {
    const label = String(entry?.medicineName || entry?.nome_medicamento || entry?.label || 'Medicamento').slice(
      0,
      24
    );
    medicationNameMap.set(label, (medicationNameMap.get(label) || 0) + 1);
  });
  const topMedications = [...medicationNameMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  let insulinBasal = 0;
  let insulinBolus = 0;
  insulinEntries.forEach((entry) => {
    const category = String(entry?.insulinCategory || entry?.categoria_insulina || '').toLowerCase();
    if (category.includes('basal')) insulinBasal += 1;
    else insulinBolus += 1;
  });

  const medDays = new Set();
  pureMedicationEntries.forEach((entry) => {
    const date = resolveEntryDate(entry);
    if (date) medDays.add(date);
  });
  const medicationAdherencePct =
    pureMedicationEntries.length > 0
      ? clampPercent((medDays.size / periodDays) * 100)
      : null;

  let glucoseInTarget = 0;
  let glucoseAboveTarget = 0;
  let glucoseBelowTarget = 0;
  glucoseReadings.forEach((entry) => {
    const value = Number(entry?.value);
    if (!Number.isFinite(value) || value <= 0) return;
    if (value < 70) glucoseBelowTarget += 1;
    else if (value > 180) glucoseAboveTarget += 1;
    else glucoseInTarget += 1;
  });

  const hasUpcomingConsulta = Boolean(
    row?.nextConsultaAt &&
      !Number.isNaN(new Date(row.nextConsultaAt).getTime()) &&
      new Date(row.nextConsultaAt).getTime() >= Date.now()
  );

  return {
    ...row,
    mealsInPeriod: mealEntries.length,
    glucoseCount: glucoseReadings.length,
    insulinCount: insulinEntries.length,
    medicationsInPeriod: pureMedicationEntries.length,
    totalRecords,
    activeDays,
    usageFrequency,
    totalCalories,
    totalCarbs,
    mealTypeCounts,
    topMedications,
    insulinBasal,
    insulinBolus,
    medicationAdherencePct,
    glucoseInTarget,
    glucoseAboveTarget,
    glucoseBelowTarget,
    dailyGlucoseAvgMap,
    dailyTirMap,
    lastRecordDate,
    daysSinceLastRecord,
    inactive,
    hasUpcomingConsulta,
    controlBucket: classifyPatientControl({
      ...row,
      mealsInPeriod: mealEntries.length,
      glucoseCount: glucoseReadings.length,
      insulinCount: insulinEntries.length,
      medicationsInPeriod: pureMedicationEntries.length,
      inactive,
    }),
  };
}

export function buildPortfolioReportAnalytics(bundle = {}) {
  const rows = (bundle.patients || []).map((row) => ({
    ...row,
    controlBucket: row.controlBucket || classifyPatientControl(row),
  }));

  const controlCounts = { bom: 0, atencao: 0, critico: 0, sem_dados: 0 };
  rows.forEach((row) => {
    const bucket = row.controlBucket || 'sem_dados';
    controlCounts[bucket] = (controlCounts[bucket] || 0) + 1;
  });

  const activePatients = rows.filter((row) => !row.inactive).length;
  const inactivePatients = rows.filter((row) => row.inactive).length;

  const glucoseWeighted = rows.filter((row) => Number(row.glucoseCount) > 0 && row.glucoseAverage != null);
  const portfolioAvgGlucose = glucoseWeighted.length
    ? Math.round(
        glucoseWeighted.reduce(
          (sum, row) => sum + Number(row.glucoseAverage) * Number(row.glucoseCount),
          0
        ) / glucoseWeighted.reduce((sum, row) => sum + Number(row.glucoseCount), 0)
      )
    : null;

  const tirWeighted = rows.filter((row) => Number(row.glucoseCount) > 0 && row.glucoseTir != null);
  const portfolioAvgTir = tirWeighted.length
    ? Math.round(
        tirWeighted.reduce((sum, row) => sum + Number(row.glucoseTir) * Number(row.glucoseCount), 0) /
          tirWeighted.reduce((sum, row) => sum + Number(row.glucoseCount), 0)
      )
    : null;

  const totals = rows.reduce(
    (acc, row) => ({
      meals: acc.meals + Number(row.mealsInPeriod || 0),
      glucose: acc.glucose + Number(row.glucoseCount || 0),
      insulin: acc.insulin + Number(row.insulinCount || 0),
      medication: acc.medication + Number(row.medicationsInPeriod || 0),
    }),
    { meals: 0, glucose: 0, insulin: 0, medication: 0 }
  );

  const evolution = buildPortfolioEvolutionSeries(rows, bundle.periodBounds || {});
  const evolutionTirSeries = evolution.map((item) => ({
    label: item.label,
    value: item.tir,
    color: nutriGreenRgb,
  }));

  const sortByTir = [...rows]
    .filter((row) => row.glucoseTir != null && Number(row.glucoseCount) > 0)
    .sort((a, b) => Number(b.glucoseTir) - Number(a.glucoseTir));
  const sortByGlucose = [...rows]
    .filter((row) => row.glucoseAverage != null)
    .sort((a, b) => Number(a.glucoseAverage) - Number(b.glucoseAverage));
  const sortByRecords = [...rows]
    .filter((row) => Number(row.glucoseCount) + Number(row.mealsInPeriod) > 0)
    .sort(
      (a, b) =>
        Number(b.glucoseCount) +
        Number(b.mealsInPeriod) -
        (Number(a.glucoseCount) + Number(a.mealsInPeriod))
    );
  const sortByAdherence = [...rows]
    .filter((row) => Number(row.adherence) > 0)
    .sort((a, b) => Number(b.adherence) - Number(a.adherence));

  const formatPatientLine = (row, extra = '') => {
    const base = `${row.name} · TIR ${row.glucoseTir ?? '—'}% · Adesão ${row.adherence}%`;
    return extra ? `${base} · ${extra}` : base;
  };

  return {
    controlDistribution: [
      { label: CONTROL_LABELS.bom, value: controlCounts.bom, color: nutriGreenRgb },
      { label: CONTROL_LABELS.atencao, value: controlCounts.atencao, color: [237, 137, 54] },
      { label: CONTROL_LABELS.critico, value: controlCounts.critico, color: [229, 62, 62] },
    ].filter((item) => item.value > 0),
    activePatients,
    inactivePatients,
    portfolioAvgGlucose,
    portfolioAvgTir,
    totals,
    tirRanking: sortByTir.slice(0, 8).map((row) => ({
      label: row.name,
      value: row.glucoseTir,
      display: `${row.glucoseTir}%`,
      color: nutriGreenRgb,
    })),
    glucoseAvgRanking: sortByGlucose.slice(0, 8).map((row) => ({
      label: row.name,
      value: row.glucoseAverage,
      display: `${row.glucoseAverage} mg/dL`,
      color: [66, 153, 225],
    })),
    recordsRanking: sortByRecords.slice(0, 8).map((row) => ({
      label: row.name,
      value: Number(row.glucoseCount) + Number(row.mealsInPeriod),
      display: `${Number(row.glucoseCount) + Number(row.mealsInPeriod)} reg.`,
      color: [159, 122, 234],
    })),
    adherenceRanking: sortByAdherence.slice(0, 8).map((row) => ({
      label: row.name,
      value: row.adherence,
      display: `${row.adherence}%`,
      color: [66, 153, 225],
    })),
    bestControlPatients: sortByTir.slice(0, 5).map((row) => formatPatientLine(row)),
    needsAttentionPatients: rows
      .filter((row) => row.controlBucket === 'critico' || row.controlBucket === 'atencao')
      .slice(0, 6)
      .map((row) =>
        formatPatientLine(row, `${CONTROL_LABELS[row.controlBucket] || 'Atenção'} · ${riskBucketLabel(row.riskBucket)}`)
      ),
    lowAdherencePatients: rows
      .filter((row) => Number(row.adherence) > 0 && Number(row.adherence) < 60)
      .slice(0, 6)
      .map((row) => formatPatientLine(row, `Adesão ${row.adherence}%`)),
    inactivePatientsList: rows
      .filter((row) => row.inactive)
      .slice(0, 6)
      .map((row) => {
        const days = row.daysSinceLastRecord != null ? `${row.daysSinceLastRecord} dia(s) sem registro` : 'Sem registros';
        return `${row.name} · ${days}`;
      }),
    evolutionTirSeries,
  };
}

const TIR_BUCKETS = [
  { id: 'tir-0-30', label: '0-30%', min: 0, max: 30 },
  { id: 'tir-31-50', label: '31-50%', min: 31, max: 50 },
  { id: 'tir-51-70', label: '51-70%', min: 51, max: 70 },
  { id: 'tir-71-90', label: '71-90%', min: 71, max: 90 },
  { id: 'tir-91-100', label: '91-100%', min: 91, max: 100 },
];

const RECORD_BUCKETS = [
  { id: 'r0', label: '0', min: 0, max: 0 },
  { id: 'r1-20', label: '1-20', min: 1, max: 20 },
  { id: 'r21-50', label: '21-50', min: 21, max: 50 },
  { id: 'r51-100', label: '51-100', min: 51, max: 100 },
  { id: 'r100', label: '100+', min: 101, max: Infinity },
];

function bucketTirValue(tir) {
  const value = Number(tir);
  if (!Number.isFinite(value) || value <= 0) return null;
  return TIR_BUCKETS.find((bucket) => value >= bucket.min && value <= bucket.max) || null;
}

function bucketRecordCount(count) {
  const value = Number(count) || 0;
  return (
    RECORD_BUCKETS.find((bucket) => value >= bucket.min && value <= bucket.max) || RECORD_BUCKETS[0]
  );
}

function splitPeriodHalves(periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  if (dayKeys.length < 2) return { first: dayKeys, second: [] };
  const mid = Math.ceil(dayKeys.length / 2);
  return { first: dayKeys.slice(0, mid), second: dayKeys.slice(mid) };
}

function patientActiveInDays(row, dayKeys = []) {
  if (!dayKeys.length) return false;
  const set = new Set(dayKeys);
  const glucoseActive = Object.keys(row.dailyGlucoseAvgMap || {}).some((key) => set.has(key));
  const mealActive = (row.weeklyItems || []).some(
    (item) => set.has(item.isoDate) && Number(item.mealsLogged) > 0
  );
  return glucoseActive || mealActive;
}

function buildPatientAlertReason(row = {}) {
  const reasons = [];
  if (Number(row.glucoseAverage) >= 180) reasons.push('glicose alta');
  if (Number(row.glucoseTir) > 0 && Number(row.glucoseTir) < 50) reasons.push('baixo tempo no alvo');
  if (Number(row.adherence) > 0 && Number(row.adherence) < 55) reasons.push('baixa adesão alimentar');
  if (row.inactive) reasons.push('sem registros recentes');
  if (row.riskBucket === 'alto') reasons.push('alto risco glicêmico');
  if ((row.mealsInPeriod || 0) === 0) reasons.push('sem refeições registradas');
  if (Number(row.medicationAdherencePct) > 0 && Number(row.medicationAdherencePct) < 50) {
    reasons.push('baixa adesão medicamentosa');
  }
  if (!reasons.length) return 'requer acompanhamento prioritário';
  return reasons.slice(0, 2).join(' e ');
}

function scorePatientCriticality(row = {}) {
  let score = 0;
  if (row.controlBucket === 'critico') score += 40;
  if (row.controlBucket === 'atencao') score += 25;
  if (Number(row.glucoseAverage) >= 200) score += 20;
  else if (Number(row.glucoseAverage) >= 180) score += 12;
  if (Number(row.glucoseTir) > 0 && Number(row.glucoseTir) < 50) score += 18;
  if (Number(row.adherence) > 0 && Number(row.adherence) < 55) score += 10;
  if (row.inactive) score += 8;
  if (row.riskBucket === 'alto') score += 15;
  return score;
}

function buildWeeklyTrendSeries(rows = [], periodBounds = {}) {
  const dayKeys = buildDayKeys(periodBounds.startDate, periodBounds.endDate);
  if (!dayKeys.length) {
    return { glucose: [], adherence: [], tir: [] };
  }

  const chunkSize = Math.max(Math.ceil(dayKeys.length / 4), 1);
  const weeks = [];
  for (let index = 0; index < dayKeys.length; index += chunkSize) {
    weeks.push(dayKeys.slice(index, index + chunkSize));
  }

  const toSeries = (getter) =>
    weeks.map((weekKeys, index) => ({
      id: `week-${index + 1}`,
      label: `S${index + 1}`,
      value: getter(weekKeys),
    }));

  return {
    glucose: toSeries((weekKeys) => {
      const values = [];
      rows.forEach((row) => {
        weekKeys.forEach((key) => {
          const val = row.dailyGlucoseAvgMap?.[key];
          if (Number.isFinite(val) && val > 0) values.push(val);
        });
      });
      return values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : 0;
    }),
    adherence: toSeries((weekKeys) => {
      const values = rows
        .map((row) => {
          const items = (row.weeklyItems || []).filter((item) => weekKeys.includes(item.isoDate));
          if (!items.length) return null;
          return Math.round(items.reduce((sum, item) => sum + Number(item.value || 0), 0) / items.length);
        })
        .filter((value) => Number.isFinite(value));
      return values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : 0;
    }),
    tir: toSeries((weekKeys) => {
      const values = [];
      rows.forEach((row) => {
        weekKeys.forEach((key) => {
          const val = row.dailyTirMap?.[key];
          if (Number.isFinite(val) && val > 0) values.push(val);
        });
      });
      return values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : 0;
    }),
  };
}

function buildRankingLists(rows = []) {
  const withTir = rows.filter((row) => Number(row.glucoseTir) > 0);
  const withRecords = rows.filter((row) => Number(row.totalRecords) > 0);
  const withAdherence = rows.filter((row) => Number(row.adherence) > 0);

  const mapRank = (sorted, valueKey, suffix = '') =>
    sorted.slice(0, 8).map((row, index) => ({
      id: row.id || `rank-${index}`,
      patientName: row.name,
      value: row[valueKey],
      display: `${row[valueKey]}${suffix}`,
      adherence: row.adherence,
      tir: row.glucoseTir,
      risk: row.risk,
      streak:
        row.adherenceStreak > 0
          ? `${row.adherenceStreak} dia${row.adherenceStreak === 1 ? '' : 's'} seguidos`
          : 'Sem sequência recente',
      objective: row.objectiveCategory?.label || row.objective,
    }));

  return {
    bestAdherence: mapRank([...withAdherence].sort((a, b) => b.adherence - a.adherence), 'adherence', '%'),
    bestTir: mapRank([...withTir].sort((a, b) => b.glucoseTir - a.glucoseTir), 'glucoseTir', '%'),
    mostRecords: mapRank([...withRecords].sort((a, b) => b.totalRecords - a.totalRecords), 'totalRecords', ' reg.'),
    lowestAdherence: mapRank([...withAdherence].sort((a, b) => a.adherence - b.adherence), 'adherence', '%'),
    highestRisk: [...rows]
      .sort((a, b) => {
        const riskScore = { alto: 3, moderado: 2, baixo: 1 };
        return (riskScore[b.riskBucket] || 0) - (riskScore[a.riskBucket] || 0);
      })
      .slice(0, 8)
      .map((row, index) => ({
        id: row.id || `risk-${index}`,
        patientName: row.name,
        value: row.risk,
        display: row.risk,
        adherence: row.adherence,
        tir: row.glucoseTir,
        risk: row.risk,
        streak:
          row.adherenceStreak > 0
            ? `${row.adherenceStreak} dia${row.adherenceStreak === 1 ? '' : 's'} seguidos`
            : 'Sem sequência recente',
        objective: row.objectiveCategory?.label || row.objective,
      })),
  };
}

function buildPortfolioInsights(bundle = {}, rows = [], portfolio = {}) {
  const total = bundle.metrics?.totalPatients || rows.length || 0;
  const good = rows.filter((row) => row.controlBucket === 'bom').length;
  const attention = rows.filter(
    (row) => row.controlBucket === 'atencao' || row.controlBucket === 'critico'
  ).length;
  const avgAdherence = bundle.metrics?.averageAdherence ?? 0;
  const avgTir = portfolio.portfolioAvgTir;
  const weeklyTrend = buildWeeklyTrendSeries(rows, bundle.periodBounds || {});
  const tirWeeks = weeklyTrend.tir.filter((item) => item.value > 0);
  let tirDeltaText = 'Sem variação relevante de tempo no alvo entre as semanas analisadas.';
  if (tirWeeks.length >= 2) {
    const delta = tirWeeks[tirWeeks.length - 1].value - tirWeeks[tirWeeks.length - 2].value;
    if (delta > 0) tirDeltaText = `Houve aumento de ${delta}% no tempo médio no alvo em relação à semana anterior.`;
    else if (delta < 0) tirDeltaText = `Houve redução de ${Math.abs(delta)}% no tempo médio no alvo em relação à semana anterior.`;
    else tirDeltaText = 'O tempo médio no alvo se manteve estável entre as semanas analisadas.';
  }

  return `Dos ${total} pacientes acompanhados, ${good} estão em bom controle e ${attention} precisam de atenção. A adesão média da carteira é de ${avgAdherence}%. ${
    avgTir != null ? `O tempo médio no alvo da carteira é ${avgTir}%. ` : ''
  }${tirDeltaText}`;
}

export function buildReportsDashboardAnalytics(bundle = {}) {
  const rows = (bundle.patients || []).map((row) => ({
    ...row,
    controlBucket: row.controlBucket || classifyPatientControl(row),
  }));
  const portfolio = buildPortfolioReportAnalytics(bundle);
  const totalPatients = bundle.metrics?.totalPatients || rows.length || 0;
  const { first, second } = splitPeriodHalves(bundle.periodBounds || {});

  const overview = {
    goodControl: rows.filter((row) => row.controlBucket === 'bom').length,
    attention: rows.filter((row) => row.controlBucket === 'atencao').length,
    critical: rows.filter((row) => row.controlBucket === 'critico').length,
    noRecords7Days: rows.filter((row) => row.inactive).length,
    lowAdherence: rows.filter((row) => Number(row.adherence) > 0 && Number(row.adherence) < 60).length,
    highGlucose: rows.filter((row) => Number(row.glucoseAverage) >= 180).length,
    upcomingConsultas: rows.filter((row) => row.hasUpcomingConsulta).length,
  };

  const tirDistribution = TIR_BUCKETS.map((bucket) => {
    const value = rows.filter((row) => bucketTirValue(row.glucoseTir)?.id === bucket.id).length;
    return {
      id: bucket.id,
      label: bucket.label,
      value,
      percent: totalPatients ? Math.round((value / totalPatients) * 100) : 0,
    };
  });

  const objectiveEnhanced = (bundle.objectiveRows || [])
    .filter((item) => item.value > 0)
    .map((item) => {
      const percent = totalPatients ? Math.round((item.value / totalPatients) * 100) : 0;
      const categoryRows = rows.filter((row) => row.objectiveCategory?.id === item.id);
      const firstHalf = categoryRows.filter((row) => patientActiveInDays(row, first)).length;
      const secondHalf = categoryRows.filter((row) => patientActiveInDays(row, second)).length;
      let trend = 'stable';
      if (secondHalf > firstHalf) trend = 'up';
      else if (secondHalf < firstHalf) trend = 'down';
      return {
        ...item,
        percent,
        trend,
        summary: `${item.label} → ${item.value} paciente${item.value === 1 ? '' : 's'} (${percent}%)`,
      };
    });

  const weeklyTrend = buildWeeklyTrendSeries(rows, bundle.periodBounds || {});

  const engagementRecords = RECORD_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    value: rows.filter((row) => bucketRecordCount(row.totalRecords).id === bucket.id).length,
  }));

  const frequencyLabels = {
    diario: 'Diário',
    semanal: 'Semanal',
    esporadico: 'Esporádico',
    inativo: 'Inativo',
  };
  const engagementFrequency = Object.keys(frequencyLabels).map((key) => ({
    id: key,
    label: frequencyLabels[key],
    value: rows.filter((row) => row.usageFrequency === key).length,
  }));

  const periodDays = Math.max(buildDayKeys(bundle.periodBounds?.startDate, bundle.periodBounds?.endDate).length, 1);
  const mealsByDayMap = new Map();
  rows.forEach((row) => {
    (row.weeklyItems || []).forEach((item) => {
      mealsByDayMap.set(item.isoDate, (mealsByDayMap.get(item.isoDate) || 0) + Number(item.mealsLogged || 0));
    });
  });
  const mealsByDay = [...mealsByDayMap.entries()].map(([isoDate, value]) => ({
    id: isoDate,
    label: formatShortDateLabel(isoDate),
    value,
  }));

  const totalCalories = rows.reduce((sum, row) => sum + Number(row.totalCalories || 0), 0);
  const avgCalories = totalCalories > 0 ? Math.round(totalCalories / periodDays) : 0;
  const totalCarbs = rows.reduce((sum, row) => sum + Number(row.totalCarbs || 0), 0);
  const avgCarbs = totalCarbs > 0 ? Math.round(totalCarbs / periodDays) : 0;

  const mealTypeMap = new Map();
  rows.forEach((row) => {
    (row.mealTypeCounts || []).forEach((item) => {
      mealTypeMap.set(item.label, (mealTypeMap.get(item.label) || 0) + item.value);
    });
  });

  const nutrition = {
    mealsByDay,
    avgCalories,
    avgCarbs,
    mealTypes: [...mealTypeMap.entries()]
      .map(([label, value]) => ({ id: label, label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    noMealPatients: rows.filter((row) => (row.mealsInPeriod || 0) === 0).length,
  };

  const glucose = {
    portfolioAvg: portfolio.portfolioAvgGlucose,
    portfolioTir: portfolio.portfolioAvgTir,
    aboveTarget: rows.filter(
      (row) => Number(row.glucoseAverage) > 180 || (row.glucoseAboveTarget || 0) > (row.glucoseInTarget || 0)
    ).length,
    belowTarget: rows.filter((row) => (row.glucoseBelowTarget || 0) > 0 && Number(row.glucoseAverage) < 70).length,
    inTarget: rows.filter(
      (row) =>
        Number(row.glucoseAverage) >= 70 &&
        Number(row.glucoseAverage) <= 180 &&
        Number(row.glucoseTir) >= 50
    ).length,
    rangeDistribution: [
      { id: 'below', label: 'Abaixo', value: rows.reduce((sum, row) => sum + Number(row.glucoseBelowTarget || 0), 0) },
      { id: 'in', label: 'No alvo', value: rows.reduce((sum, row) => sum + Number(row.glucoseInTarget || 0), 0) },
      { id: 'above', label: 'Acima', value: rows.reduce((sum, row) => sum + Number(row.glucoseAboveTarget || 0), 0) },
    ],
  };

  const insulinized = rows.filter((row) => Number(row.insulinCount) > 0).length;
  const totalInsulinApps = rows.reduce((sum, row) => sum + Number(row.insulinCount || 0), 0);
  const basalTotal = rows.reduce((sum, row) => sum + Number(row.insulinBasal || 0), 0);
  const bolusTotal = rows.reduce((sum, row) => sum + Number(row.insulinBolus || 0), 0);

  const insulin = {
    insulinizedPatients: insulinized,
    totalApplications: totalInsulinApps,
    dailyAverage: periodDays ? Math.round((totalInsulinApps / periodDays) * 10) / 10 : 0,
    basalBolus: [
      { id: 'basal', label: 'Basal', value: basalTotal },
      { id: 'bolus', label: 'Bolus', value: bolusTotal },
    ],
  };

  const medMap = new Map();
  rows.forEach((row) => {
    (row.topMedications || []).forEach((item) => {
      medMap.set(item.label, (medMap.get(item.label) || 0) + item.value);
    });
  });

  const medAdherenceValues = rows
    .map((row) => row.medicationAdherencePct)
    .filter((value) => Number.isFinite(value));
  const medication = {
    overallAdherence: medAdherenceValues.length
      ? Math.round(medAdherenceValues.reduce((sum, value) => sum + value, 0) / medAdherenceValues.length)
      : 0,
    topMedications: [...medMap.entries()]
      .map(([label, value]) => ({ id: label, label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    lowAdherencePatients: rows.filter(
      (row) => Number(row.medicationAdherencePct) > 0 && Number(row.medicationAdherencePct) < 50
    ).length,
  };

  const smartAlerts = [...rows]
    .map((row) => ({
      id: row.id,
      name: row.name,
      tir: row.glucoseTir,
      adherence: row.adherence,
      glucoseAverage: row.glucoseAverage,
      reason: buildPatientAlertReason(row),
      score: scorePatientCriticality(row),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    overview,
    tirDistribution,
    objectiveEnhanced,
    weeklyTrend,
    engagementRecords,
    engagementFrequency,
    nutrition,
    glucose,
    insulin,
    medication,
    rankingLists: buildRankingLists(rows),
    smartAlerts,
    insightsText: buildPortfolioInsights(bundle, rows, portfolio),
  };
}

export function buildNutritionistPatientAlerts(bundle = {}) {
  const baseAlerts = bundle.analytics?.alerts || buildExecutiveAlerts(bundle.analytics || {});
  const alerts = [...baseAlerts];
  const g = bundle.glycemicMetrics || bundle.analytics?.glucose?.metrics || {};
  const s = bundle.summary || {};
  const patient = bundle.analytics?.patientSummary || {};

  if (g.average != null && g.average >= 180) {
    alerts.unshift(`Glicose média elevada no período: ${g.average} mg/dL.`);
  }
  if (g.tir != null && g.tir < 50) {
    alerts.unshift(`Baixo tempo no alvo (${g.tir}%). Revisar estratégia glicêmica.`);
  }
  if ((s.meals || 0) === 0) {
    alerts.unshift('Ausência de refeições registradas no período analisado.');
  }
  if ((patient.medication?.adherencePct ?? 0) < 50 && (s.medication || 0) > 0) {
    alerts.unshift('Baixa adesão medicamentosa detectada.');
  }
  if (bundle.daysSinceLastRecord != null && bundle.daysSinceLastRecord >= 7) {
    alerts.unshift(`Paciente sem atualizações recentes (${bundle.daysSinceLastRecord} dia(s)).`);
  }

  const tirDetailed = bundle.analytics?.glucose?.tirDetailedSeries || [];
  const veryHigh = tirDetailed.find((item) => String(item.label).includes('250'))?.value || 0;
  const totalGlucose = g.total || s.glucose || 0;
  if (totalGlucose > 0 && veryHigh / totalGlucose > 0.2) {
    alerts.unshift('Volume elevado de leituras muito acima da meta (>250 mg/dL).');
  }

  return [...new Set(alerts)].slice(0, 8);
}

export function resolveReportPeriodLabel(period, periodBounds = {}) {
  if (period === '7days') return 'Últimos 7 dias';
  if (period === '15days') return 'Últimos 15 dias';
  if (period === '30days') return 'Últimos 30 dias';
  if (period === 'search' && periodBounds.startDate && periodBounds.endDate) {
    return `${formatShortDateLabel(periodBounds.startDate)} a ${formatShortDateLabel(periodBounds.endDate)}`;
  }
  return 'Últimos 7 dias';
}
