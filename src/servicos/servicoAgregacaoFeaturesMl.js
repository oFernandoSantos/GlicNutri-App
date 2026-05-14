/**
 * Agrega registros recentes do paciente em um vetor compatível com POST /predict (granularidade "dia típico").
 * Usa média diária ao longo da janela e depois média entre dias com dados (alinhado ao uso clínico-resumo).
 */

function sliceDate(d) {
  return String(d || '').slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Number(days) || 0);
  return d.toISOString().slice(0, 10);
}

function mealCarbsG(entry) {
  if (typeof entry?.carbsG === 'number' && !Number.isNaN(entry.carbsG)) return entry.carbsG;
  const m = String(entry?.glucoseDelta || '').match(/([\d.,]+)\s*g\s*carbos/i);
  if (m) return Number(String(m[1]).replace(',', '.')) || 0;
  return 0;
}

function mealKcal(entry) {
  return typeof entry?.kcal === 'number' && !Number.isNaN(entry.kcal) ? entry.kcal : 0;
}

function mealProteinG(entry) {
  return typeof entry?.proteinG === 'number' && !Number.isNaN(entry.proteinG) ? entry.proteinG : 0;
}

function mealFatG(entry) {
  return typeof entry?.fatG === 'number' && !Number.isNaN(entry.fatG) ? entry.fatG : 0;
}

export function buildTypicalDayFeaturesForMl({
  glucoseReadings = [],
  meals = [],
  medications = [],
  windowDays = 14,
} = {}) {
  const cutoff = daysAgoIso(Math.max(3, Math.min(90, Number(windowDays) || 14)));
  const byDay = new Map();

  function ensureDay(day) {
    if (!byDay.has(day)) {
      byDay.set(day, {
        glucoseValues: [],
        carbs: 0,
        kcal: 0,
        protein: 0,
        fat: 0,
        nMeals: 0,
        nMeds: 0,
      });
    }
    return byDay.get(day);
  }

  (glucoseReadings || []).forEach((r) => {
    const day = sliceDate(r?.date);
    if (!day || day < cutoff) return;
    const v = Number(r?.value);
    if (!Number.isFinite(v) || v <= 0) return;
    ensureDay(day).glucoseValues.push(v);
  });

  (meals || []).forEach((m) => {
    const day = sliceDate(m?.date);
    if (!day || day < cutoff) return;
    const row = ensureDay(day);
    row.carbs += mealCarbsG(m);
    row.kcal += mealKcal(m);
    row.protein += mealProteinG(m);
    row.fat += mealFatG(m);
    row.nMeals += 1;
  });

  (medications || []).forEach((x) => {
    const day = sliceDate(x?.date);
    if (!day || day < cutoff) return;
    ensureDay(day).nMeds += 1;
  });

  const days = [...byDay.keys()].filter((d) => d >= cutoff).sort();
  if (!days.length) {
    return {
      features: {
        n_leituras_glicemia: 0,
        carbs_sum_g: 0,
        kcal_sum: 0,
        protein_sum_g: 0,
        fat_sum_g: 0,
        n_refeicoes_ia: 0,
        n_eventos_medicacao: 0,
      },
      diasComDados: 0,
      janelaDias: windowDays,
      cutoff,
    };
  }

  const acc = {
    n_leituras_glicemia: 0,
    carbs_sum_g: 0,
    kcal_sum: 0,
    protein_sum_g: 0,
    fat_sum_g: 0,
    n_refeicoes_ia: 0,
    n_eventos_medicacao: 0,
  };

  days.forEach((day) => {
    const row = byDay.get(day);
    acc.n_leituras_glicemia += row.glucoseValues.length;
    acc.carbs_sum_g += row.carbs;
    acc.kcal_sum += row.kcal;
    acc.protein_sum_g += row.protein;
    acc.fat_sum_g += row.fat;
    acc.n_refeicoes_ia += row.nMeals;
    acc.n_eventos_medicacao += row.nMeds;
  });

  const n = days.length;
  const features = {
    n_leituras_glicemia: acc.n_leituras_glicemia / n,
    carbs_sum_g: acc.carbs_sum_g / n,
    kcal_sum: acc.kcal_sum / n,
    protein_sum_g: acc.protein_sum_g / n,
    fat_sum_g: acc.fat_sum_g / n,
    n_refeicoes_ia: acc.n_refeicoes_ia / n,
    n_eventos_medicacao: acc.n_eventos_medicacao / n,
  };

  return {
    features,
    diasComDados: n,
    janelaDias: windowDays,
    cutoff,
  };
}
