import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'glicnutri:nutricao:aprendizado-itens:v1';
const MAX_LEARNED_ITEMS = 500;

const NUTRIENT_FIELDS = [
  { itemKey: 'calorias', baseKey: 'base_calorias' },
  { itemKey: 'carboidratos', baseKey: 'base_carboidratos' },
  { itemKey: 'proteinas', baseKey: 'base_proteinas' },
  { itemKey: 'gorduras', baseKey: 'base_gorduras' },
  { itemKey: 'fibras', baseKey: 'base_fibras' },
  { itemKey: 'acucares', baseKey: 'base_acucares' },
  { itemKey: 'acucares_adicionados', baseKey: 'base_acucares_adicionados' },
  { itemKey: 'gorduras_saturadas', baseKey: 'base_gorduras_saturadas' },
  { itemKey: 'gordura_trans', baseKey: 'base_gordura_trans' },
  { itemKey: 'sodio', baseKey: 'base_sodio' },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function roundNutrient(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 10) / 10;
}

function getLearningKeys(item) {
  const keys = new Set();
  const code = String(item?.code || item?.codigo_barras || '').replace(/\D/g, '');
  const name = normalizeText(item?.nome || item?.name || item?.alimento);
  const brand = normalizeText(item?.brands || item?.marca);

  if (code) keys.add(`code:${code}`);
  if (brand && name) keys.add(`brand:${brand}:${name}`);
  if (name) keys.add(`name:${name}`);

  return [...keys];
}

function getBaseQuantity(item) {
  const base = Number(item?.base_quantidade_gramas);
  if (Number.isFinite(base) && base > 0) return base;

  const quantity = Number(item?.quantidade_gramas || item?.grams);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 100;
}

function getQuantity(item) {
  const quantity = Number(item?.quantidade_gramas || item?.grams);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : getBaseQuantity(item);
}

function getBaseNutrient(item, field) {
  const explicitBase = Number(item?.[field.baseKey]);
  if (Number.isFinite(explicitBase)) return explicitBase;

  const current = Number(item?.[field.itemKey]);
  if (!Number.isFinite(current)) return 0;

  const quantity = getQuantity(item);
  return quantity > 0 ? (current * getBaseQuantity(item)) / quantity : current;
}

function buildLearnedEntry(item, key) {
  const baseQuantity = getBaseQuantity(item);
  const nutrientes = NUTRIENT_FIELDS.reduce((values, field) => {
    values[field.baseKey] = roundNutrient(getBaseNutrient(item, field));
    return values;
  }, {});

  return {
    key,
    nome: String(item?.nome || item?.name || item?.alimento || '').trim(),
    marca: String(item?.brands || item?.marca || '').trim(),
    categoria: String(item?.categoria || item?.category || '').trim(),
    porcao: String(item?.porcao || '').trim(),
    unidade_quantidade: item?.unidade_quantidade || item?.unidade || null,
    base_quantidade_gramas: baseQuantity,
    nutrientes,
    count: 1,
    updatedAt: new Date().toISOString(),
  };
}

function mergeLearnedEntry(previous, next) {
  if (!previous) return next;

  const previousCount = Math.max(Number(previous.count) || 1, 1);
  const nextCount = 1;
  const totalCount = previousCount + nextCount;
  const nutrientes = { ...(previous.nutrientes || {}) };

  NUTRIENT_FIELDS.forEach((field) => {
    const previousValue = Number(previous.nutrientes?.[field.baseKey]) || 0;
    const nextValue = Number(next.nutrientes?.[field.baseKey]) || 0;
    nutrientes[field.baseKey] = roundNutrient(
      (previousValue * previousCount + nextValue * nextCount) / totalCount
    );
  });

  return {
    ...previous,
    ...next,
    nutrientes,
    count: totalCount,
    updatedAt: new Date().toISOString(),
  };
}

export async function carregarAprendizadoNutricional() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export async function registrarAprendizadoNutricional(alimentos = []) {
  const items = Array.isArray(alimentos) ? alimentos : [];
  if (!items.length) return {};

  const current = await carregarAprendizadoNutricional();
  const next = { ...current };

  items.forEach((item) => {
    getLearningKeys(item).forEach((key) => {
      const entry = buildLearnedEntry(item, key);
      next[key] = mergeLearnedEntry(next[key], entry);
    });
  });

  const sortedEntries = Object.entries(next)
    .sort((left, right) =>
      String(right[1]?.updatedAt || '').localeCompare(String(left[1]?.updatedAt || ''))
    )
    .slice(0, MAX_LEARNED_ITEMS);
  const compact = Object.fromEntries(sortedEntries);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  return compact;
}

export function aplicarAprendizadoNutricional(item, aprendizado = {}) {
  const keys = getLearningKeys(item);
  const learned = keys.map((key) => aprendizado?.[key]).find(Boolean);

  if (!learned?.nutrientes) {
    return item;
  }

  const baseQuantity = Number(learned.base_quantidade_gramas) > 0 ? Number(learned.base_quantidade_gramas) : 100;
  const quantity = Number(item?.quantidade_gramas) > 0 ? Number(item.quantidade_gramas) : baseQuantity;
  const factor = baseQuantity > 0 ? quantity / baseQuantity : 1;
  const scaled = {};

  NUTRIENT_FIELDS.forEach((field) => {
    const baseValue = Number(learned.nutrientes[field.baseKey]) || 0;
    scaled[field.baseKey] = roundNutrient(baseValue);
    scaled[field.itemKey] = roundNutrient(baseValue * factor);
  });

  return {
    ...item,
    ...scaled,
    base_quantidade_gramas: baseQuantity,
    quantidade_gramas: quantity,
    porcao: learned.porcao || item?.porcao,
    unidade_quantidade: learned.unidade_quantidade || item?.unidade_quantidade || item?.unidade || null,
    fonteNutricional: `Ajuste aprendido (${learned.count || 1} registro(s))`,
    ajusteNutricionalAprendido: true,
    ajusteNutricionalRegistros: learned.count || 1,
  };
}
