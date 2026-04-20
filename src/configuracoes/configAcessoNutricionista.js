const fallbackCodes = ['GLICNUTRI-NUTRI'];

function parseCodes(rawValue) {
  if (!rawValue) {
    return fallbackCodes;
  }

  return rawValue
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export function normalizeNutritionistAccessCode(value) {
  return String(value || '').trim().toUpperCase();
}

export const nutritionistAccessCodes = parseCodes(
  process.env.EXPO_PUBLIC_NUTRICIONISTA_ACCESS_CODES ||
    process.env.EXPO_PUBLIC_NUTRICIONISTA_ACCESS_CODE
);

export function isValidNutritionistAccessCode(value) {
  const normalized = normalizeNutritionistAccessCode(value);

  return nutritionistAccessCodes.includes(normalized);
}
