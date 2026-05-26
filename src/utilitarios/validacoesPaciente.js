/** Validacoes compartilhadas para registros do paciente (front + servicos). */

export const GLUCOSE_MIN_MGDL = 20;
export const GLUCOSE_MAX_MGDL = 600;
export const GLUCOSE_CRITICAL_LOW = 54;
export const GLUCOSE_CRITICAL_HIGH = 400;

export const INSULIN_DOSE_MIN_UI = 0.5;
export const INSULIN_DOSE_MAX_UI = 80;

export function parseNumericInput(value) {
  const match = String(value ?? '')
    .replace(',', '.')
    .match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

export function validateGlucoseValue(value) {
  const numeric = typeof value === 'number' ? value : parseNumericInput(value);

  if (!Number.isFinite(numeric)) {
    return { ok: false, message: 'Informe um valor numerico de glicose em mg/dL.' };
  }

  if (numeric < GLUCOSE_MIN_MGDL || numeric > GLUCOSE_MAX_MGDL) {
    return {
      ok: false,
      message: `A glicose deve estar entre ${GLUCOSE_MIN_MGDL} e ${GLUCOSE_MAX_MGDL} mg/dL.`,
    };
  }

  let warning = '';

  if (numeric < GLUCOSE_CRITICAL_LOW) {
    warning = 'Valor muito baixo. Confira se esta correto e procure orientacao medica se necessario.';
  } else if (numeric > GLUCOSE_CRITICAL_HIGH) {
    warning = 'Valor muito alto. Confira se esta correto e siga o plano do seu profissional.';
  }

  return { ok: true, value: Math.round(numeric * 10) / 10, warning };
}

export function validateInsulinDose(value, { maxUi = INSULIN_DOSE_MAX_UI } = {}) {
  const numeric = typeof value === 'number' ? value : parseNumericInput(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { ok: false, message: 'Informe uma dose de insulina valida em UI.' };
  }

  if (numeric < INSULIN_DOSE_MIN_UI) {
    return {
      ok: false,
      message: `A dose minima aceita e ${INSULIN_DOSE_MIN_UI} UI.`,
    };
  }

  if (numeric > maxUi) {
    return {
      ok: false,
      message: `Por seguranca, a dose maxima e ${maxUi} UI. Confira o valor com seu profissional.`,
    };
  }

  return { ok: true, value: Math.round(numeric * 10) / 10 };
}

export function validateMedicationEntry(entry = {}) {
  const name = String(entry?.medicineName || entry?.nome_medicamento || entry?.label || '').trim();

  if (!name) {
    return { ok: false, message: 'Informe o nome do medicamento.' };
  }

  if (name.length < 2) {
    return { ok: false, message: 'Nome do medicamento muito curto.' };
  }

  const quantity = String(entry?.medicineQuantity || entry?.quantidade || '').trim();

  if (entry?.medicationKind === 'medicine' && !quantity) {
    return { ok: false, message: 'Informe a dose ou quantidade do medicamento.' };
  }

  return { ok: true };
}

export function validateMealFoods(alimentos = []) {
  const items = Array.isArray(alimentos) ? alimentos : [];

  if (!items.length) {
    return { ok: false, message: 'Adicione ao menos um alimento antes de salvar.' };
  }

  const hasNamedFood = items.some((item) => String(item?.nome || '').trim().length >= 2);

  if (!hasNamedFood) {
    return { ok: false, message: 'Informe o nome de pelo menos um alimento.' };
  }

  return { ok: true };
}
