export const PACIENTE_MACRO_NUTRIENTES = [
  { id: 'calories', label: 'Calorias', shortLabel: 'Calorias', unit: 'kcal', target: 1800 },
  { id: 'carbs', label: 'Carboidratos', shortLabel: 'Carbos', unit: 'g', target: 225 },
  { id: 'protein', label: 'Proteínas', shortLabel: 'Proteínas', unit: 'g', target: 90 },
  { id: 'fat', label: 'Gorduras totais', shortLabel: 'Gorduras', unit: 'g', target: 60 },
  { id: 'fiber', label: 'Fibras', shortLabel: 'Fibras', unit: 'g', target: 25 },
  { id: 'sugar', label: 'Açúcares', shortLabel: 'Açúcares', unit: 'g', target: 50 },
  { id: 'saturatedFat', label: 'Gordura saturada', shortLabel: 'Gord. sat.', unit: 'g', target: 20 },
  { id: 'sodium', label: 'Sódio', shortLabel: 'Sódio', unit: 'mg', target: 2000 },
];

export const PACIENTE_MICRO_NUTRIENTES = [
  { id: 'iron', label: 'Ferro', shortLabel: 'Ferro', unit: 'mg', target: 18 },
  { id: 'calcium', label: 'Cálcio', shortLabel: 'Cálcio', unit: 'mg', target: 1000 },
  { id: 'magnesium', label: 'Magnésio', shortLabel: 'Magnésio', unit: 'mg', target: 320 },
  { id: 'potassium', label: 'Potássio', shortLabel: 'Potássio', unit: 'mg', target: 2600 },
  { id: 'zinc', label: 'Zinco', shortLabel: 'Zinco', unit: 'mg', target: 8 },
  { id: 'vitaminA', label: 'Vitamina A', shortLabel: 'Vit.A', unit: 'mcg', target: 700 },
  { id: 'vitaminC', label: 'Vitamina C', shortLabel: 'Vit.C', unit: 'mg', target: 75 },
  { id: 'vitaminD', label: 'Vitamina D', shortLabel: 'Vit.D', unit: 'mcg', target: 15 },
  { id: 'vitaminB12', label: 'Vitamina B12', shortLabel: 'B12', unit: 'mcg', target: 2.4 },
  { id: 'folate', label: 'Folato', shortLabel: 'Folato', unit: 'mcg', target: 400 },
];

export const PACIENTE_MACRO_ALVOS_PADRAO = PACIENTE_MACRO_NUTRIENTES.reduce(
  (targets, item) => {
    targets[item.id] = item.target;
    return targets;
  },
  {}
);

export const PACIENTE_MICRO_ALVOS_PADRAO = PACIENTE_MICRO_NUTRIENTES.reduce(
  (targets, item) => {
    targets[item.id] = item.target;
    return targets;
  },
  {}
);

export const PACIENTE_ALVOS_PADRAO = {
  ...PACIENTE_MACRO_ALVOS_PADRAO,
  ...PACIENTE_MICRO_ALVOS_PADRAO,
};

export function normalizePacienteNutritionTotals(totals = {}) {
  const sugar = Number(totals.sugar ?? totals.sugars) || 0;

  return {
    ...totals,
    sugar,
    sugars: sugar,
  };
}

export function buildNutrientCoverageScore(items) {
  const scores = (items || [])
    .filter((item) => item.target > 0)
    .map((item) => {
      const ratio = Math.min(Number(item.value) || 0, item.target) / item.target;
      return Math.max(0, Math.min(100, Math.round(ratio * 100)));
    });

  if (!scores.length) {
    return 0;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function buildMacroPlanProgress(items) {
  const scores = (items || [])
    .filter((item) => item.target > 0)
    .map((item) => {
      const value = Number(item.value) || 0;
      const target = Number(item.target) || 0;
      return Math.max(0, Math.round((value / target) * 100));
    });

  if (!scores.length) {
    return 0;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export const buildMicroCoverageScore = buildNutrientCoverageScore;
