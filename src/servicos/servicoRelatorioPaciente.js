import { downloadPdfDocument, downloadTextFile } from '../utilitarios/exportarArquivo';
import { buildClinicalReportAnalytics, filterReportEntriesByBounds } from '../utilitarios/relatorioPacienteAnalytics';
import { buildPatientClinicalReportPdf } from '../utilitarios/relatorioPacientePdf';
import { mergeCachedGlucoseReadings } from './centralGlicose';
import { supabase } from './configSupabase';
import { fetchMealEntries, fetchPatientExperience, getPatientId } from './servicoDadosPaciente';
import { getMedicoById } from './servicoMedicos';
import { getNutritionistById } from './servicoNutricionistas';

function calculateAgeFromBirth(value) {
  const birth = value ? new Date(value) : null;
  if (!birth || Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function formatReportMetric(value, suffix = '') {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  const formatted = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
  return suffix ? `${formatted}${suffix}` : formatted;
}

function formatFollowUpSince(startDate) {
  const date = startDate ? new Date(startDate) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR');
}

function formatFollowUpDuration(startDate) {
  const start = startDate ? new Date(startDate) : null;
  if (!start || Number.isNaN(start.getTime())) return null;

  const diffMs = Date.now() - start.getTime();
  if (diffMs < 0) return null;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'desde hoje';
  if (days < 30) return `${days} dia(s)`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mes(es)`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} ano(s)`;
  return `${years} ano(s) e ${remainingMonths} mes(es)`;
}

function buildFollowUpTimeLabel(startDate) {
  const since = formatFollowUpSince(startDate);
  const duration = formatFollowUpDuration(startDate);
  if (!since) return 'Sem vinculo ativo';
  if (!duration) return `Desde ${since}`;
  return `Desde ${since} · ${duration}`;
}

async function fetchActiveFollowUpLinks(pacienteId) {
  if (!pacienteId) return { nutri: null, medico: null };

  const { data, error } = await supabase
    .from('paciente_profissional_vinculo')
    .select('nutricionista_id, medico_id, created_at, ativo')
    .eq('paciente_id', pacienteId)
    .eq('ativo', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('Erro ao buscar vinculos do relatorio:', error);
    return { nutri: null, medico: null };
  }

  const rows = Array.isArray(data) ? data : [];
  return {
    nutri: rows.find((row) => row?.nutricionista_id) || null,
    medico: rows.find((row) => row?.medico_id) || null,
  };
}

export async function resolvePatientReportProfile(patient) {
  if (!patient) {
    return {
      age: '—',
      weight: '—',
      height: '—',
      bmi: '—',
      nutricionistaNome: '—',
      nutricionistaTempo: '—',
      medicoNome: '—',
      medicoTempo: '—',
    };
  }

  const ageValue = calculateAgeFromBirth(patient?.data_nascimento);
  const pacienteId = patient?.id_paciente_uuid || null;
  const [nutricionista, medico, vinculos] = await Promise.all([
    patient?.id_nutricionista_uuid
      ? getNutritionistById(patient.id_nutricionista_uuid).catch(() => null)
      : Promise.resolve(null),
    patient?.id_medico_uuid
      ? getMedicoById(patient.id_medico_uuid).catch(() => null)
      : Promise.resolve(null),
    fetchActiveFollowUpLinks(pacienteId),
  ]);

  return {
    age: ageValue != null ? `${ageValue} anos` : '—',
    weight: formatReportMetric(patient?.peso_atual_kg, ' kg'),
    height: formatReportMetric(patient?.altura_cm, ' cm'),
    bmi: formatReportMetric(patient?.imc_calculado),
    nutricionistaNome: nutricionista?.nome_completo_nutri || '—',
    nutricionistaTempo: vinculos.nutri?.created_at
      ? buildFollowUpTimeLabel(vinculos.nutri.created_at)
      : patient?.id_nutricionista_uuid
        ? 'Vinculado (data de inicio indisponivel)'
        : 'Sem vinculo ativo',
    medicoNome: medico?.nome_completo_medico || '—',
    medicoTempo: vinculos.medico?.created_at
      ? buildFollowUpTimeLabel(vinculos.medico.created_at)
      : patient?.id_medico_uuid
        ? 'Vinculado (data de inicio indisponivel)'
        : 'Sem vinculo ativo',
  };
}

function resolveEntryDate(entry) {
  if (typeof entry === 'string' || typeof entry === 'number') {
    const raw = String(entry).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    return raw.slice(0, 10) || null;
  }

  const raw = String(
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

export function isInsulinMedicationEntry(entry) {
  const kind = String(entry?.medicationKind || entry?.tipo_registro || entry?.kind || '').toLowerCase();
  if (kind === 'insulin') return true;
  if (entry?.insulinCategory || entry?.categoria_insulina || entry?.insulinDatabaseId) return true;
  return false;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export function getReportPeriodBounds(period, startDateInput = '', endDateInput = '') {
  const today = getTodayDateString();
  let startDate = today;
  let endDate = today;

  if (period === '7days') {
    startDate = addDaysToIsoDate(today, -6);
  } else if (period === '14days') {
    startDate = addDaysToIsoDate(today, -13);
  } else if (period === '15days') {
    startDate = addDaysToIsoDate(today, -14);
  } else if (period === '30days') {
    startDate = addDaysToIsoDate(today, -29);
  } else if (period === 'today') {
    startDate = today;
    endDate = today;
  } else if (period === 'search') {
    startDate = resolveEntryDate(startDateInput) || resolveEntryDate(endDateInput) || today;
    endDate = resolveEntryDate(endDateInput) || resolveEntryDate(startDateInput) || today;
  }

  if (startDate > endDate) {
    return { startDate: endDate, endDate: startDate };
  }

  return { startDate, endDate };
}

export function filterReportEntriesByPeriod(
  items,
  period,
  startDateInput = '',
  endDateInput = '',
  getDate
) {
  const { startDate, endDate } = getReportPeriodBounds(period, startDateInput, endDateInput);

  return (Array.isArray(items) ? items : []).filter((item) => {
    const rawDate =
      typeof getDate === 'function'
        ? getDate(item)
        : item?.date || item?.data || item?.data_registro || item?.created_at || item?.createdAt;
    const itemDate = resolveEntryDate(rawDate);
    if (!itemDate || !/^\d{4}-\d{2}-\d{2}$/.test(itemDate)) return false;
    return itemDate >= startDate && itemDate <= endDate;
  });
}

function buildCountByDayForRange(entries, startDate, endDate, getDate) {
  const map = new Map();
  let cursor = startDate;

  while (cursor && cursor <= endDate) {
    map.set(cursor, 0);
    cursor = addDaysToIsoDate(cursor, 1);
  }

  (entries || []).forEach((entry) => {
    const resolved = typeof getDate === 'function' ? getDate(entry) : entry;
    const date =
      resolveEntryDate(resolved) ||
      resolveEntryDate(entry) ||
      (typeof resolved === 'string' ? resolveEntryDate(resolved) : null);
    if (!date || !map.has(date)) return;
    map.set(date, (map.get(date) || 0) + 1);
  });

  return [...map.entries()].map(([date, value]) => ({
    date,
    label: formatShortDateLabel(date),
    value,
  }));
}

function formatShortDateLabel(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate || '').slice(5, 10) || '—';
  return `${match[3]}/${match[2]}`;
}

function buildWeekRanges(startDate, endDate) {
  const weeks = [];
  if (!startDate || !endDate) return weeks;

  let weekStart = startDate;
  let index = 1;

  while (weekStart <= endDate) {
    let weekEnd = addDaysToIsoDate(weekStart, 6);
    if (weekEnd > endDate) weekEnd = endDate;
    weeks.push({ weekStart, weekEnd, index });
    weekStart = addDaysToIsoDate(weekEnd, 1);
    index += 1;
  }

  return weeks;
}

function formatWeekLabel(weekStart, weekEnd, index, totalWeeks) {
  if (totalWeeks === 1) return 'Semana';
  return `S${index}`;
}

function formatWeekRangeLabel(weekStart, weekEnd) {
  return `${formatShortDateLabel(weekStart)}-${formatShortDateLabel(weekEnd)}`;
}

export function buildCountByWeekForRange(entries, startDate, endDate, getDate) {
  if (!startDate || !endDate) return [];

  const weeks = buildWeekRanges(startDate, endDate);

  return weeks.map(({ weekStart, weekEnd, index }) => {
    let count = 0;

    (entries || []).forEach((entry) => {
      const resolved = typeof getDate === 'function' ? getDate(entry) : entry;
      const date =
        resolveEntryDate(resolved) ||
        resolveEntryDate(entry) ||
        (typeof resolved === 'string' ? resolveEntryDate(resolved) : null);
      if (!date || date < weekStart || date > weekEnd) return;
      count += 1;
    });

    return {
      date: weekStart,
      label: formatWeekLabel(weekStart, weekEnd, index, weeks.length),
      rangeLabel: formatWeekRangeLabel(weekStart, weekEnd),
      value: count,
    };
  });
}

function buildGlucoseDailyAverageForRange(readings, startDate, endDate) {
  if (!startDate || !endDate) {
    return buildGlucoseDailyAverageSeries(readings);
  }

  const buckets = new Map();
  let cursor = startDate;

  while (cursor <= endDate) {
    buckets.set(cursor, { sum: 0, count: 0 });
    cursor = addDaysToIsoDate(cursor, 1);
  }

  mergeCachedGlucoseReadings(Array.isArray(readings) ? readings : []).forEach((entry) => {
    const date = resolveEntryDate(entry?.date);
    const value = Number(entry?.value);
    if (!date || !buckets.has(date) || !Number.isFinite(value) || value <= 0) return;
    const bucket = buckets.get(date);
    bucket.sum += value;
    bucket.count += 1;
  });

  return [...buckets.entries()].map(([date, stats]) => {
    const avg = stats.count ? Math.round(stats.sum / stats.count) : 0;
    return {
      date,
      label: formatShortDateLabel(date),
      value: avg,
      color:
        avg < 70 ? [252, 129, 129] : avg > 180 ? [237, 137, 54] : [72, 187, 120],
    };
  });
}

export function buildGlucoseWeeklyAverageSeries(readings, startDate, endDate) {
  if (!startDate || !endDate) return [];

  const weeks = buildWeekRanges(startDate, endDate);
  const merged = mergeCachedGlucoseReadings(Array.isArray(readings) ? readings : []);

  return weeks.map(({ weekStart, weekEnd, index }) => {
    const values = merged
      .filter((entry) => {
        const date = resolveEntryDate(entry?.date);
        return date && date >= weekStart && date <= weekEnd;
      })
      .map((entry) => Number(entry?.value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const average = values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;

    return {
      date: weekStart,
      label: formatWeekLabel(weekStart, weekEnd, index, weeks.length),
      rangeLabel: formatWeekRangeLabel(weekStart, weekEnd),
      value: average,
      color:
        average < 70 ? [252, 129, 129] : average > 180 ? [237, 137, 54] : [72, 187, 120],
    };
  });
}

function buildCountByDay(entries, getDate, maxPoints = 7) {
  const map = new Map();
  (entries || []).forEach((entry) => {
    const date = resolveEntryDate(typeof getDate === 'function' ? getDate(entry) : entry) || resolveEntryDate(entry);
    if (!date) return;
    map.set(date, (map.get(date) || 0) + 1);
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxPoints)
    .map(([date, value]) => ({
      date,
      label: formatShortDateLabel(date),
      value,
    }));
}

function buildGlucoseDailyAverageSeries(readings, maxPoints = 7) {
  const buckets = new Map();
  mergeCachedGlucoseReadings(Array.isArray(readings) ? readings : []).forEach((entry) => {
    const date = String(entry?.date || '').slice(0, 10);
    const value = Number(entry?.value);
    if (!date || !Number.isFinite(value) || value <= 0) return;
    const current = buckets.get(date) || { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    buckets.set(date, current);
  });

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxPoints)
    .map(([date, stats]) => {
      const avg = Math.round(stats.sum / stats.count);
      return {
        date,
        label: formatShortDateLabel(date),
        value: avg,
        color: avg < 70 ? [252, 129, 129] : avg > 180 ? [237, 137, 54] : [72, 187, 120],
      };
    });
}

export function buildGlycemicMetrics(glucoseReadings) {
  const values = mergeCachedGlucoseReadings(Array.isArray(glucoseReadings) ? glucoseReadings : [])
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) {
    return {
      average: null,
      min: null,
      max: null,
      gmi: null,
      variability: null,
      tir: null,
      total: 0,
      hasData: false,
    };
  }

  const total = values.length;
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const inRange = values.filter((value) => value >= 70 && value <= 180).length;
  const tir = Math.round((inRange / total) * 100);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(total, 1);
  const variability = Math.round(Math.sqrt(variance));
  const gmi = Number((3.31 + 0.02392 * average).toFixed(1));

  return { average, min, max, gmi, variability, tir, total, hasData: true };
}

function sortEntriesChronologically(entries = []) {
  const sortKey = (entry) => {
    const date = resolveEntryDate(entry) || '9999-99-99';
    const time = String(entry?.time || entry?.hora || '').slice(0, 8);
    return `${date}T${time}`;
  };

  return [...entries].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

function formatPeriodRangeLabel(periodBounds = {}, periodLabel = '') {
  if (periodBounds?.startDate && periodBounds?.endDate) {
    return `${formatShortDateLabel(periodBounds.startDate)} a ${formatShortDateLabel(periodBounds.endDate)}`;
  }
  return periodLabel || 'Período selecionado';
}

function resolveBundlePeriodBounds(payload) {
  if (payload?.periodBounds?.startDate && payload?.periodBounds?.endDate) {
    return payload.periodBounds;
  }

  if (payload?.period) {
    return getReportPeriodBounds(payload.period, payload.startDate, payload.endDate);
  }

  const dates = [];
  const collectDates = (entries) => {
    (entries || []).forEach((entry) => {
      const date = resolveEntryDate(entry?.date || entry?.data || entry?.created_at || entry);
      if (date) dates.push(date);
    });
  };

  collectDates(payload?.mealEntries);
  collectDates(payload?.glucoseReadings);
  collectDates(payload?.medicationEntries);

  if (dates.length) {
    dates.sort();
    return { startDate: dates[0], endDate: dates[dates.length - 1] };
  }

  return getReportPeriodBounds('7days');
}

function resolveMealDatabaseId(entry = {}) {
  const databaseId = String(entry?.databaseId || '').trim();
  const id = String(entry?.id || '').trim();
  return databaseId || (id.startsWith('meal-ia-') ? id.slice('meal-ia-'.length) : '');
}

function mergeReportMealSources(...sources) {
  const byDbId = new Map();
  const byEntryId = new Map();
  const legacyOnlyIds = [];

  const upsert = (entry, index = 0) => {
    if (!entry || typeof entry !== 'object') return;

    const databaseId = resolveMealDatabaseId(entry);
    const entryId =
      String(entry?.id || '').trim() ||
      (databaseId ? `meal-ia-${databaseId}` : `meal-report-${index}-${entry?.date || ''}`);

    if (databaseId) {
      const existing = byDbId.get(databaseId);
      byDbId.set(databaseId, existing ? { ...existing, ...entry, ...mergeReportMealPair(existing, entry) } : { ...entry, id: entryId });
      return;
    }

    const existing = byEntryId.get(entryId);
    if (existing) {
      byEntryId.set(entryId, { ...existing, ...entry, ...mergeReportMealPair(existing, entry) });
      return;
    }

    byEntryId.set(entryId, { ...entry, id: entryId });
    legacyOnlyIds.push(entryId);
  };

  sources.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach(upsert);
  });

  return [...byDbId.values(), ...legacyOnlyIds.map((id) => byEntryId.get(id)).filter(Boolean)];
}

function mergeReportMealPair(existing = {}, incoming = {}) {
  const pickDate = () => incoming?.date || existing?.date || null;
  const pickTime = () => incoming?.time || incoming?.hora || existing?.time || existing?.hora || null;
  const pickLabel = (field) => {
    const values = [incoming?.[field], existing?.[field]].filter(Boolean);
    const specific = values.find((value) => !/refei(c|ç)(a|ã)o registrada/i.test(String(value)));
    return specific || values[0] || null;
  };

  const incomingFoods = Array.isArray(incoming?.foods) ? incoming.foods : [];
  const existingFoods = Array.isArray(existing?.foods) ? existing.foods : [];

  return {
    date: pickDate(),
    time: pickTime(),
    title: pickLabel('title') || pickLabel('mealLabel'),
    mealLabel: pickLabel('mealLabel') || pickLabel('title'),
    mealTypeLabel: pickLabel('mealTypeLabel') || pickLabel('mealLabel') || pickLabel('title'),
    description: incoming?.description || existing?.description || '',
    foods: incomingFoods.length ? incomingFoods : existingFoods,
    kcal: Number(incoming?.kcal) || Number(existing?.kcal) || 0,
    carbsG: Number(incoming?.carbsG) || Number(existing?.carbsG) || 0,
    proteinG: Number(incoming?.proteinG) || Number(existing?.proteinG) || 0,
    fatG: Number(incoming?.fatG) || Number(existing?.fatG) || 0,
    databaseId: resolveMealDatabaseId(incoming) || resolveMealDatabaseId(existing) || null,
    storageOrigin: incoming?.storageOrigin || existing?.storageOrigin || null,
  };
}

async function loadReportMealEntries(patientId, payload = {}, experience = {}, periodBounds = {}) {
  const databaseMeals = patientId
    ? await fetchMealEntries(patientId, 500, payload.patient).catch(() => [])
    : [];

  const mergedMeals = mergeReportMealSources(
    databaseMeals,
    experience?.appState?.mealEntries,
    payload?.mealEntries
  );

  let filteredMeals = filterReportEntriesByBounds(mergedMeals, periodBounds);

  if (!filteredMeals.length && payload?.mealEntries?.length) {
    filteredMeals = filterReportEntriesByBounds(payload.mealEntries, periodBounds);
  }

  return filteredMeals;
}

export function buildPatientClinicalReportBundle(payload) {
  const medicationEntries = Array.isArray(payload.medicationEntries) ? payload.medicationEntries : [];
  const mealEntries = sortEntriesChronologically(payload.mealEntries || []);
  const glucoseReadings = sortEntriesChronologically(payload.glucoseReadings || []);
  const insulinEntries = sortEntriesChronologically(
    medicationEntries.filter(isInsulinMedicationEntry)
  );
  const pureMedicationEntries = sortEntriesChronologically(
    medicationEntries.filter((entry) => !isInsulinMedicationEntry(entry))
  );
  const glycemicMetrics = payload.glycemicMetrics || buildGlycemicMetrics(glucoseReadings);
  const periodBounds = resolveBundlePeriodBounds(payload);
  const countByDay = (entries, getDate) =>
    periodBounds?.startDate && periodBounds?.endDate
      ? buildCountByDayForRange(entries, periodBounds.startDate, periodBounds.endDate, getDate)
      : buildCountByDay(entries, getDate);
  const countByWeek = (entries, getDate) =>
    periodBounds?.startDate && periodBounds?.endDate
      ? buildCountByWeekForRange(entries, periodBounds.startDate, periodBounds.endDate, getDate)
      : [];

  const baseBundle = {
    patientName: payload.patientName || 'Paciente',
    generatedAt: payload.generatedAt || new Date().toLocaleString('pt-BR'),
    periodLabel: payload.periodLabel || '7 dias',
    periodRangeLabel: formatPeriodRangeLabel(periodBounds, payload.periodLabel),
    periodBounds,
    personalProfile: payload.personalProfile || null,
  glycemicMetrics,
    summary: {
      meals: mealEntries.length,
      glucose: glucoseReadings.length,
      insulin: insulinEntries.length,
      medication: pureMedicationEntries.length,
    },
    mealEntries,
    glucoseReadings,
    insulinEntries,
    medicationEntries: pureMedicationEntries,
    charts: {
      glucoseByDay:
        periodBounds?.startDate && periodBounds?.endDate
          ? buildGlucoseDailyAverageForRange(
              glucoseReadings,
              periodBounds.startDate,
              periodBounds.endDate
            )
          : buildGlucoseDailyAverageSeries(glucoseReadings),
      glucoseByWeek:
        periodBounds?.startDate && periodBounds?.endDate
          ? buildGlucoseWeeklyAverageSeries(
              glucoseReadings,
              periodBounds.startDate,
              periodBounds.endDate
            )
          : [],
      mealsByDay: countByDay(mealEntries, (entry) => resolveEntryDate(entry)),
      mealsByWeek: countByWeek(mealEntries, (entry) => resolveEntryDate(entry)),
      insulinByDay: countByDay(insulinEntries, (entry) => resolveEntryDate(entry)),
      insulinByWeek: countByWeek(insulinEntries, (entry) => resolveEntryDate(entry)),
      medicationByDay: countByDay(pureMedicationEntries, (entry) => resolveEntryDate(entry)),
      medicationByWeek: countByWeek(pureMedicationEntries, (entry) => resolveEntryDate(entry)),
    },
    weightSeries: payload.weightSeries,
    weeklyAdherence: payload.weeklyAdherence,
    monthlySummary: payload.monthlySummary,
    achievements: payload.achievements,
  };

  return {
    ...baseBundle,
    analytics: buildClinicalReportAnalytics(baseBundle),
  };
}

export function buildPatientProgressTxt(bundle) {
  const g = bundle.glycemicMetrics || {};
  const s = bundle.summary || {};
  const p = bundle.personalProfile || {};
  const period = bundle.periodLabel || '7 dias';
  const lines = [
    'GLICNUTRI — RELATÓRIO CLÍNICO DO PACIENTE',
    '========================================',
    `Paciente: ${bundle.patientName}`,
    `Período: ${bundle.periodLabel}`,
    `Gerado em: ${bundle.generatedAt}`,
    '',
    'DADOS PESSOAIS',
    `Idade: ${p.age || '—'}`,
    `Peso: ${p.weight || '—'}`,
    `Altura: ${p.height || '—'}`,
    `IMC: ${p.bmi || '—'}`,
    '',
    'ACOMPANHAMENTO',
    `Nutricionista: ${p.nutricionistaNome || '—'}`,
    `Tempo: Acompanhamento ativo · ${period}`,
    `Médico: ${p.medicoNome || '—'}`,
    `Tempo: Acompanhamento ativo · ${period}`,
    '',
    'TOTAIS DE REGISTROS',
    `Alimentação: ${s.meals ?? 0}`,
    `Glicose: ${s.glucose ?? 0}`,
    `Insulina: ${s.insulin ?? 0}`,
    `Medicação: ${s.medication ?? 0}`,
    '',
    'GLICEMIA',
    `Média: ${g.average ?? '—'} mg/dL`,
    `Mín / Máx: ${g.min ?? '—'} / ${g.max ?? '—'} mg/dL`,
    `TIR (70-180): ${g.tir ?? '—'}%`,
    `Variabilidade (DP): ${g.variability ?? '—'} mg/dL`,
    `GMI estimado: ${g.gmi ?? '—'}%`,
  ];

  lines.push('', 'INSULINA');
  (bundle.insulinEntries || []).forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.date} ${entry.time} — ${entry.medicineName || entry.label} ${entry.medicineQuantity || ''} UI`
    );
  });

  lines.push('', 'MEDICAÇÃO');
  (bundle.medicationEntries || []).forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.date} ${entry.time} — ${entry.medicineName || entry.label} ${entry.medicineQuantity || ''} ${entry.medicineUnit || ''}`
    );
  });

  lines.push('', 'REFEIÇÕES');
  (bundle.mealEntries || []).forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.date} ${entry.time || ''} — ${entry.title || entry.mealLabel || 'Refeição'}`
    );
  });

  lines.push('', 'GLICOSE');
  (bundle.glucoseReadings || []).forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.date} ${entry.time || ''} — ${entry.value} mg/dL (${entry.context || entry.mealContext || '—'})`
    );
  });

  lines.push('', 'FIM DO RELATORIO');
  return lines.join('\n');
}

export async function enrichReportPayloadFromDatabase(payload = {}) {
  const patientId =
    payload.patient?.id_paciente_uuid ||
    getPatientId(payload.patient) ||
    null;
  const period = payload.period === 'search' || payload.period === 'today' ? payload.period : '7days';
  const periodBounds =
    period === '7days'
      ? getReportPeriodBounds('7days')
      : resolveBundlePeriodBounds({ ...payload, period });

  if (!patientId) {
    return { ...payload, periodBounds };
  }

  try {
    const experience = await fetchPatientExperience(patientId, {
      patientContext: payload.patient,
      forceRefresh: true,
      skipChat: true,
      skipAlertSync: true,
      glucoseLimit: 500,
      medicationLimit: 500,
      mealLimit: 500,
    });

    const mealEntries = await loadReportMealEntries(patientId, payload, experience, periodBounds);
    const glucoseReadings = filterReportEntriesByBounds(
      experience?.glucoseReadings,
      periodBounds
    );
    const medicationEntries = filterReportEntriesByBounds(
      experience?.appState?.medicationEntries,
      periodBounds
    );

    return {
      ...payload,
      period,
      periodBounds,
      periodLabel: payload.periodLabel || '7 dias',
      mealEntries,
      glucoseReadings,
      medicationEntries,
      glycemicMetrics: buildGlycemicMetrics(glucoseReadings),
    };
  } catch (error) {
    console.log('Erro ao carregar dados do relatorio no banco:', error);
    const fallbackMeals = filterReportEntriesByBounds(payload?.mealEntries, periodBounds);
    return {
      ...payload,
      periodBounds,
      mealEntries: fallbackMeals.length ? fallbackMeals : payload?.mealEntries || [],
    };
  }
}

export async function exportPatientProgressReport(payload, { format = 'pdf' } = {}) {
  const enrichedPayload = await enrichReportPayloadFromDatabase(payload);
  const personalProfile =
    enrichedPayload.personalProfile ||
    (enrichedPayload.patient ? await resolvePatientReportProfile(enrichedPayload.patient) : null);
  const bundle = buildPatientClinicalReportBundle({ ...enrichedPayload, personalProfile });
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = `glicnutri_relatorio_${stamp}`;

  if (format === 'txt') {
    return downloadTextFile(`${safeName}.txt`, buildPatientProgressTxt(bundle));
  }

  const pdfDoc = await buildPatientClinicalReportPdf(bundle);
  return downloadPdfDocument(`${safeName}.pdf`, pdfDoc);
}

export {
  buildCountByDay,
  buildGlucoseDailyAverageSeries,
  resolveEntryDate,
};
