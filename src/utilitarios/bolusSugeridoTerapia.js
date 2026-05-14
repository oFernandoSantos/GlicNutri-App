/**
 * Cálculo de bolus sugerido a partir das linhas da terapia (tabela_horarios / insulin_profiles).
 * Mantém a mesma convenção de doses do Monitoramento: carbo = g por 1 UI; correção = mg/dL por 1 UI.
 */

const MEAL_VALUE_TO_LABEL = {
  cafe_manha: 'Café da manhã',
  almoco: 'Almoço',
  jantar: 'Jantar',
  lanche: 'Lanche',
  ceia: 'Ceia',
  correcao: 'Correção',
  outro: 'Outro',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseLooseNumber(value) {
  const normalized = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : Number.NaN;
}

export function extractTargetGlucoseFromText(text) {
  const match = String(text || '').match(/\b(?:alvo|meta|objetivo)\s*[:=]?\s*(\d{2,3})\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function rowMealKey(refeicao, mealOptions = []) {
  const s = String(refeicao ?? '').trim();
  if (!s) return '';
  const hit = mealOptions.find((o) => o.value === s || o.label === s);
  return hit?.value || s;
}

export function refeicaoMatchesRow(rowRefeicao, mealValue, mealOptions) {
  const a = rowMealKey(rowRefeicao, mealOptions);
  const b = rowMealKey(mealValue, mealOptions);
  if (a && b && a === b) return true;
  const la = MEAL_VALUE_TO_LABEL[a] || a;
  const lb = MEAL_VALUE_TO_LABEL[b] || mealOptions.find((o) => o.value === b)?.label || b;
  return Boolean(la && lb && normalizeText(la) === normalizeText(lb));
}

function tipoDoseEhCarbo(t) {
  const x = normalizeText(t);
  return x.includes('carbo') || x.includes('dose_carboidrato');
}

function tipoDoseEhFixa(t) {
  const x = normalizeText(t);
  return x.includes('fixa') || x.includes('dose_fixa');
}

function tipoDoseEhCorrecao(t) {
  const x = normalizeText(t);
  return x.includes('correcao') || x.includes('correc') || x.includes('dose_correcao');
}

function pickBolusScheduleRows(schedules, mealValue, mealOptions) {
  const rows = Array.isArray(schedules) ? schedules : [];
  const matched = rows.filter((item) => refeicaoMatchesRow(item?.refeicao, mealValue, mealOptions));
  if (!matched.length) return { primary: null, correction: null, all: [] };

  const primary =
    matched.find((r) => tipoDoseEhCarbo(r?.tipo_dose)) ||
    matched.find((r) => tipoDoseEhFixa(r?.tipo_dose)) ||
    matched[0];
  const correction = matched.find((r) => tipoDoseEhCorrecao(r?.tipo_dose)) || null;
  return { primary, correction, all: matched };
}

export function computeTherapyBolusSuggestion({
  applicationType,
  mealValue,
  mealOptions = [],
  glucoseMgDl,
  carbsG,
  schedules,
  notesText,
  manualTarget,
}) {
  const wantsMeal = applicationType === 'refeicao' || applicationType === 'refeicao_correcao';
  const wantsCorrection = applicationType === 'correcao' || applicationType === 'refeicao_correcao';

  const selectedMeal = wantsMeal ? mealValue : 'correcao';
  const mealSchedule = pickBolusScheduleRows(schedules, selectedMeal, mealOptions);
  const correctionSchedule = pickBolusScheduleRows(schedules, 'correcao', mealOptions);

  const schedulePrimary =
    applicationType === 'correcao' ? correctionSchedule.primary : mealSchedule.primary;
  const scheduleCorrection =
    applicationType === 'correcao'
      ? correctionSchedule.correction
      : mealSchedule.correction || correctionSchedule.primary || correctionSchedule.correction;

  const dosePrimary = parseLooseNumber(schedulePrimary?.dose);
  const doseCorr = parseLooseNumber(scheduleCorrection?.dose);

  const targetFromNotes = extractTargetGlucoseFromText(notesText);
  const targetFromManual = parseLooseNumber(manualTarget);
  const target =
    targetFromNotes != null
      ? targetFromNotes
      : Number.isFinite(targetFromManual) && targetFromManual > 0
        ? targetFromManual
        : null;

  let doseMeal = 0;
  let doseCorrection = 0;
  const warnings = [];

  if (wantsMeal) {
    if (!schedulePrimary) {
      warnings.push(
        'Inclua na tabela abaixo a refeição com tipo de dose (carboidrato ou fixa) para calcular.'
      );
    } else if (tipoDoseEhCarbo(schedulePrimary?.tipo_dose)) {
      if (!Number.isFinite(dosePrimary) || dosePrimary <= 0) {
        warnings.push('Relação insulina/carboidrato inválida na prescrição.');
      } else if (!Number.isFinite(carbsG) || carbsG < 0) {
        warnings.push('Informe os carboidratos (g) para calcular a dose da refeição.');
      } else {
        doseMeal = carbsG / dosePrimary;
      }
    } else if (tipoDoseEhFixa(schedulePrimary?.tipo_dose)) {
      if (!Number.isFinite(dosePrimary) || dosePrimary <= 0) {
        warnings.push('Dose fixa inválida na prescrição.');
      } else {
        doseMeal = dosePrimary;
      }
    } else {
      warnings.push('Tipo de dose desta refeição não permite cálculo automático.');
    }
  }

  if (wantsCorrection) {
    if (!Number.isFinite(glucoseMgDl) || glucoseMgDl <= 0) {
      warnings.push('Informe a glicemia atual para calcular correção.');
    } else if (target == null) {
      warnings.push(
        'Meta glicêmica não definida. Informe abaixo ou use nas observações (ex.: meta 100).'
      );
    } else {
      const delta = glucoseMgDl - target;
      if (delta <= 0) {
        doseCorrection = 0;
      } else if (tipoDoseEhCorrecao(scheduleCorrection?.tipo_dose) && Number.isFinite(doseCorr) && doseCorr > 0) {
        doseCorrection = delta / doseCorr;
      } else {
        warnings.push('Adicione na tabela a linha Correção com tipo “Dose de correção”.');
      }
    }
  }

  const round1 = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0);
  doseMeal = round1(doseMeal);
  doseCorrection = round1(doseCorrection);
  const total = round1(doseMeal + doseCorrection);

  const ratioLabel =
    tipoDoseEhCarbo(schedulePrimary?.tipo_dose) && Number.isFinite(dosePrimary) && dosePrimary > 0
      ? `1 UI : ${String(dosePrimary).replace('.', ',')} g`
      : '—';
  const corrLabel =
    tipoDoseEhCorrecao(scheduleCorrection?.tipo_dose) && Number.isFinite(doseCorr) && doseCorr > 0
      ? `${String(doseCorr).replace('.', ',')} mg/dL por 1 UI`
      : '—';

  return {
    target,
    ratioLabel,
    corrLabel,
    doseMeal,
    doseCorrection,
    doseTotal: total,
    warnings,
  };
}

export function parseGlucoseInputProfile(value) {
  const match = String(value || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

export function formatGlucoseInputProfile(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4);
}
