import { createClient } from 'npm:@supabase/supabase-js@2.100.1';
import { corsHeaders } from '../_shared/cors.ts';

type AnalyzePayload = {
  bucket?: string;
  path?: string;
  imageUrl?: string;
  fileName?: string;
  mimeType?: string;
};

type FoodItem = {
  id: string;
  nome: string;
  categoria: string;
  quantidade_gramas: number;
  calorias: number;
  carboidratos: number;
  proteinas: number;
  gorduras: number;
  food_item_position: string | number | null;
};

const LOGMEAL_API_URL = 'https://api.logmeal.com';
const DEFAULT_BUCKET = 'refeicoes-ia';
const LOGMEAL_LANGUAGE = 'eng';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const logMealApiKey = Deno.env.get('LOGMEAL_API_KEY') || '';

const FOOD_TRANSLATIONS: Record<string, string> = {
  food: 'Comida',
  dish: 'Prato',
  rice: 'Arroz',
  'white rice': 'Arroz branco',
  'brown rice': 'Arroz integral',
  'rice with beans': 'Arroz com feijao',
  spaghetti: 'Espaguete',
  'spaghetti with tomato sauce': 'Espaguete ao molho de tomate',
  pasta: 'Macarrao',
  'pasta with tomato sauce': 'Macarrao ao molho de tomate',
  noodles: 'Macarrao',
  macaroni: 'Macarrao',
  'instant noodles': 'Macarrao instantaneo',
  tomato: 'Tomate',
  sauce: 'Molho',
  'tomato sauce': 'Molho de tomate',
  bolognese: 'Bolonhesa',
  'pasta bolognese': 'Macarrao a bolonhesa',
  beans: 'Feijao',
  bean: 'Feijao',
  blackbeans: 'Feijao preto',
  chicken: 'Frango',
  'grilled chicken': 'Frango grelhado',
  beef: 'Carne bovina',
  steak: 'Bife',
  fish: 'Peixe',
  salad: 'Salada',
  lettuce: 'Alface',
  egg: 'Ovo',
  bread: 'Pao',
  potato: 'Batata',
  fries: 'Batata frita',
  cheese: 'Queijo',
  milk: 'Leite',
  soup: 'Sopa',
  pizza: 'Pizza',
  burger: 'Hamburguer',
  sandwich: 'Sanduiche',
  sausage: 'Salsicha',
  pork: 'Carne suina',
  cassava: 'Mandioca',
  manioc: 'Mandioca',
  farofa: 'Farofa',
  broccoli: 'Brocolis',
  carrot: 'Cenoura',
  shrimp: 'Camarao',
  lasagna: 'Lasanha',
  pancake: 'Panqueca',
  omelette: 'Omelete',
  'fried egg': 'Ovo frito',
  'mashed potato': 'Pure de batata',
  'grilled fish': 'Peixe grelhado',
  'fried fish': 'Peixe frito',
  'fried chicken': 'Frango frito',
  'breaded chicken': 'Frango a milanesa',
  'breaded chicken fillet': 'Frango a milanesa',
  'breaded chicken breast': 'Frango a milanesa',
  'chicken schnitzel': 'Frango a milanesa',
  schnitzel: 'Frango a milanesa',
  milanesa: 'Frango a milanesa',
  'chicken cutlet': 'Frango a milanesa',
  cutlet: 'Milanesa',
  'white beans': 'Feijao branco',
  'black beans': 'Feijao preto',
  'brown beans': 'Feijao carioca',
  'pinto beans': 'Feijao carioca',
  'carioca beans': 'Feijao carioca',
  'bean stew': 'Feijao',
  'cassava flour': 'Farinha de mandioca',
  'cassava fries': 'Mandioca frita',
  'fried cassava': 'Mandioca frita',
  yucca: 'Mandioca',
  plantain: 'Banana da terra',
  okra: 'Quiabo',
  kale: 'Couve',
  'collard greens': 'Couve',
  'minced beef': 'Carne moida',
  'ground beef': 'Carne moida',
  barbecue: 'Churrasco',
  barbecuebeef: 'Churrasco',
  'pork sausage': 'Linguica',
  'beef stew': 'Carne cozida',
  'chicken stew': 'Frango cozido',
  feijoada: 'Feijoada',
  stroganoff: 'Estrogonofe',
  'beef stroganoff': 'Estrogonofe de carne',
  'chicken stroganoff': 'Estrogonofe de frango',
  cuscuz: 'Cuscuz',
  polenta: 'Polenta',
};

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  cereal: 'Cereal',
  cereals: 'Cereais',
  grain: 'Grao',
  grains: 'Graos',
  pasta: 'Massas',
  noodle: 'Massas',
  noodles: 'Massas',
  rice: 'Arroz',
  vegetable: 'Vegetal',
  vegetables: 'Vegetais',
  meat: 'Carne',
  fish: 'Peixe',
  seafood: 'Frutos do mar',
  salad: 'Salada',
  sauce: 'Molho',
  legumes: 'Legumes',
  fruit: 'Fruta',
  fruits: 'Frutas',
  dessert: 'Sobremesa',
  drink: 'Bebida',
  side: 'Acompanhamento',
  main: 'Prato principal',
  traditional: 'Comida caseira',
  homemade: 'Comida caseira',
};

const BRAZILIAN_NAME_ALIASES: Array<{ patterns: string[]; result: string; scoreBoost?: number }> = [
  { patterns: ['white rice'], result: 'Arroz branco', scoreBoost: 40 },
  { patterns: ['brown rice'], result: 'Arroz integral', scoreBoost: 40 },
  { patterns: ['rice'], result: 'Arroz', scoreBoost: 15 },
  { patterns: ['beans', 'bean stew'], result: 'Feijao', scoreBoost: 20 },
  { patterns: ['black beans'], result: 'Feijao preto', scoreBoost: 45 },
  { patterns: ['brown beans', 'pinto beans', 'carioca beans'], result: 'Feijao carioca', scoreBoost: 45 },
  { patterns: ['spaghetti', 'pasta', 'noodles', 'macaroni'], result: 'Macarrao', scoreBoost: 15 },
  { patterns: ['spaghetti with tomato sauce', 'pasta with tomato sauce'], result: 'Macarrao ao molho de tomate', scoreBoost: 50 },
  { patterns: ['pasta bolognese'], result: 'Macarrao a bolonhesa', scoreBoost: 55 },
  { patterns: ['fried egg', 'egg'], result: 'Ovo', scoreBoost: 25 },
  { patterns: ['breaded chicken', 'breaded chicken fillet', 'breaded chicken breast', 'chicken schnitzel', 'schnitzel', 'chicken cutlet', 'milanesa'], result: 'Frango a milanesa', scoreBoost: 70 },
  { patterns: ['cassava', 'manioc', 'yucca'], result: 'Mandioca', scoreBoost: 35 },
  { patterns: ['cassava flour'], result: 'Farinha de mandioca', scoreBoost: 45 },
  { patterns: ['farofa'], result: 'Farofa', scoreBoost: 55 },
  { patterns: ['collard greens', 'kale'], result: 'Couve', scoreBoost: 30 },
  { patterns: ['okra'], result: 'Quiabo', scoreBoost: 35 },
  { patterns: ['barbecue', 'barbecuebeef'], result: 'Churrasco', scoreBoost: 30 },
  { patterns: ['beef stroganoff', 'chicken stroganoff', 'stroganoff'], result: 'Estrogonofe', scoreBoost: 45 },
  { patterns: ['feijoada'], result: 'Feijoada', scoreBoost: 80 },
  { patterns: ['cuscuz'], result: 'Cuscuz', scoreBoost: 60 },
];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function unwrapErrorMessage(raw: string) {
  const trimmed = String(raw || '').trim();

  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return String(parsed.message || parsed.error || trimmed);
  } catch (_error) {
    return trimmed;
  }
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatorias.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function roundValue(value: unknown) {
  return Math.round(normalizeNumber(value) * 10) / 10;
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeKey(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeReadableText(value: unknown) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMostlyNumericText(value: unknown) {
  const text = normalizeReadableText(value);

  if (!text) {
    return true;
  }

  const lettersOnly = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');

  if (lettersOnly.length > 0) {
    return false;
  }

  return /[0-9]/.test(text);
}

function includesNormalizedTerm(text: string, term: string) {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);

  return normalizedText.includes(normalizedTerm);
}

function translateLabel(value: unknown, dictionary: Record<string, string>, fallback: string) {
  const raw = normalizeReadableText(value);

  if (!raw) {
    return fallback;
  }

  const normalized = normalizeText(raw);

  if (dictionary[normalized]) {
    return dictionary[normalized];
  }

  for (const [key, translated] of Object.entries(dictionary)) {
    if (normalized === key) {
      return translated;
    }
  }

  let translatedText = raw;

  Object.entries(dictionary).forEach(([key, translated]) => {
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    translatedText = translatedText.replace(regex, translated);
  });

  return titleCase(normalizeReadableText(translatedText));
}

function makeFoodId(position: unknown, index: number) {
  const normalized = String(position ?? index).trim();
  return `food-${normalized || index}`;
}

function walkValues(value: unknown, visitor: (key: string, current: unknown) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkValues(item, visitor));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, current]) => {
    visitor(key, current);
    walkValues(current, visitor);
  });
}

function findNumberByVariants(value: unknown, variants: string[]) {
  const normalizedVariants = variants.map(normalizeKey);
  let found = 0;
  let matched = false;

  walkValues(value, (key, current) => {
    if (matched) return;

    if (typeof current !== 'number' && typeof current !== 'string') {
      return;
    }

    const normalized = normalizeKey(key);

    if (
      normalizedVariants.some(
        (variant) => normalized === variant || normalized.includes(variant) || variant.includes(normalized)
      )
    ) {
      const parsed = roundValue(current);

      if (parsed || String(current) === '0') {
        found = parsed;
        matched = true;
      }
    }
  });

  return found;
}

function findTextByVariants(value: unknown, variants: string[]) {
  const normalizedVariants = variants.map(normalizeKey);
  let found = '';

  walkValues(value, (key, current) => {
    if (found) return;
    if (typeof current !== 'string') return;

    const normalized = normalizeKey(key);

    if (
      normalizedVariants.some(
        (variant) => normalized === variant || normalized.includes(variant) || variant.includes(normalized)
      )
    ) {
      const text = String(current).trim();

      if (text) {
        found = text;
      }
    }
  });

  return found;
}

function getDirectString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string') {
      const normalized = normalizeReadableText(value);

      if (normalized && !isMostlyNumericText(normalized)) {
        return normalized;
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const normalized = normalizeReadableText(item);

          if (normalized && !isMostlyNumericText(normalized)) {
            return normalized;
          }
        }
      }
    }
  }

  return '';
}

function getRecognitionCandidates(segmentationItem: Record<string, unknown>) {
  const recognitionResults = Array.isArray(segmentationItem.recognition_results)
    ? segmentationItem.recognition_results
    : Array.isArray(segmentationItem.recognitionResults)
      ? segmentationItem.recognitionResults
      : [];

  return recognitionResults
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const record = item as Record<string, unknown>;
      const label =
        findTextByVariants(record, ['foodname', 'dishname', 'label', 'name']) || '';
      const score =
        findNumberByVariants(record, ['confidence', 'prob', 'probability', 'score']) || 0;

      return {
        label,
        score,
      };
    })
    .filter((item) => item.label);
}

function collectFoodNameCandidates(
  segmentationItem: Record<string, unknown>,
  nutritionItem: Record<string, unknown>
) {
  const candidates: Array<{ label: string; score: number }> = [];

  const pushCandidate = (label: unknown, score: number) => {
    const text = normalizeReadableText(label);

    if (!text || isMostlyNumericText(text)) {
      return;
    }

    candidates.push({
      label: text,
      score,
    });
  };

  [
    segmentationItem.foodName,
    segmentationItem.food_name,
    segmentationItem.dishName,
    segmentationItem.dish_name,
    segmentationItem.name,
    getDirectString(segmentationItem, ['food_label', 'label', 'class_name', 'className']),
    getDirectString(nutritionItem, ['foodName', 'food_name', 'dishName', 'dish_name', 'label']),
  ].forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => pushCandidate(item, 100 - index));
      return;
    }

    pushCandidate(value, 100);
  });

  getRecognitionCandidates(segmentationItem).forEach((candidate) => {
    pushCandidate(candidate.label, candidate.score || 0);
  });

  BRAZILIAN_NAME_ALIASES.forEach((alias) => {
    const matched = candidates.find((candidate) =>
      alias.patterns.some((pattern) => includesNormalizedTerm(candidate.label, pattern))
    );

    if (matched) {
      candidates.push({
        label: alias.result,
        score: matched.score + (alias.scoreBoost || 25),
      });
    }
  });

  return candidates
    .filter((candidate) => candidate.label)
    .sort((left, right) => right.score - left.score);
}

function extractFoodName(
  segmentationItem: Record<string, unknown>,
  nutritionItem: Record<string, unknown>
) {
  const bestCandidate = collectFoodNameCandidates(segmentationItem, nutritionItem)[0];
  return translateLabel(bestCandidate?.label || '', FOOD_TRANSLATIONS, 'Alimento nao identificado');
}

function extractCategory(
  segmentationItem: Record<string, unknown>,
  nutritionItem: Record<string, unknown>
) {
  const rawCategory =
    getDirectString(segmentationItem, ['groupName', 'group_name', 'foodGroup', 'food_group', 'foodType', 'food_type', 'category', 'subgroupName', 'subgroup_name']) ||
    getDirectString(nutritionItem, ['groupName', 'group_name', 'foodGroup', 'food_group', 'foodType', 'food_type', 'category', 'subgroupName', 'subgroup_name']) ||
    'Nao informada';

  return translateLabel(rawCategory, CATEGORY_TRANSLATIONS, 'Nao informada');
}

function extractQuantityGrams(segmentationItem: Record<string, unknown>) {
  const servingSize = segmentationItem.serving_size as
    | Record<string, unknown>
    | number
    | undefined;

  if (servingSize && typeof servingSize === 'object') {
    const grams = findNumberByVariants(servingSize, ['grams', 'gram', 'weight', 'quantity']);
    if (grams) return grams;
  }

  if (typeof servingSize === 'number') {
    return roundValue(servingSize);
  }

  return (
    findNumberByVariants(segmentationItem, [
      'servingsizegrams',
      'quantitygrams',
      'grams',
      'gram',
      'weightgrams',
      'weight',
      'quantity',
    ]) || 0
  );
}

function parseNutritionPerItem(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.nutritional_info_per_item)
    ? payload.nutritional_info_per_item
    : [];
  const map = new Map<string, Record<string, unknown>>();

  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;

    const record = item as Record<string, unknown>;
    const key = String(
      record.food_item_position ??
        record.foodItemPosition ??
        record.position ??
        index
    );

    map.set(key, record);
  });

  return map;
}

function buildFoodItems(
  segmentationPayload: Record<string, unknown>,
  nutritionPayload: Record<string, unknown>
) {
  const segmentationResults = Array.isArray(segmentationPayload.segmentation_results)
    ? segmentationPayload.segmentation_results
    : [];
  const nutritionByPosition = parseNutritionPerItem(nutritionPayload);

  const foods = segmentationResults
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const segmentationItem = item as Record<string, unknown>;
      const position =
        segmentationItem.food_item_position ??
        segmentationItem.foodItemPosition ??
        index;
      const nutritionItem =
        nutritionByPosition.get(String(position)) ||
        nutritionByPosition.get(String(index)) ||
        {};

      const food: FoodItem = {
        id: makeFoodId(position, index),
        nome: extractFoodName(segmentationItem, nutritionItem),
        categoria: extractCategory(segmentationItem, nutritionItem),
        quantidade_gramas: extractQuantityGrams(segmentationItem),
        calorias: findNumberByVariants(nutritionItem, ['calories', 'energykcal', 'energy', 'kcal']),
        carboidratos: findNumberByVariants(nutritionItem, ['carbohydrates', 'carbs', 'carbohydrate']),
        proteinas: findNumberByVariants(nutritionItem, ['proteins', 'protein']),
        gorduras: findNumberByVariants(nutritionItem, ['fat', 'fats', 'lipids', 'totalfat']),
        food_item_position: position as string | number,
      };

      if (!food.nome || isMostlyNumericText(food.nome)) {
        return null;
      }

      return food;
    })
    .filter((item): item is FoodItem => Boolean(item));

  const hasRice = foods.some((item) => includesNormalizedTerm(item.nome, 'arroz'));
  const hasBeans = foods.some((item) => includesNormalizedTerm(item.nome, 'feijao'));

  if (hasRice && hasBeans) {
    return foods.map((item) => {
      if (includesNormalizedTerm(item.nome, 'arroz') && item.categoria === 'Nao informada') {
        return {
          ...item,
          categoria: 'Comida caseira',
        };
      }

      if (includesNormalizedTerm(item.nome, 'feijao') && item.categoria === 'Nao informada') {
        return {
          ...item,
          categoria: 'Comida caseira',
        };
      }

      return item;
    });
  }

  return foods;
}

function buildFallbackFoodItemFromTopLevel(
  segmentationPayload: Record<string, unknown>,
  nutritionPayload: Record<string, unknown>
) {
  const topLevelName =
    findTextByVariants(segmentationPayload, ['foodname', 'dishname', 'label', 'name']) || '';

  if (!topLevelName) {
    return [];
  }

  return [
    {
      id: makeFoodId('top-level', 0),
      nome: translateLabel(topLevelName, FOOD_TRANSLATIONS, 'Alimento'),
      categoria: translateLabel(
        findTextByVariants(segmentationPayload, ['groupname', 'foodgroup', 'category']) || '',
        CATEGORY_TRANSLATIONS,
        'Nao informada'
      ),
      quantidade_gramas:
        findNumberByVariants(segmentationPayload, ['grams', 'gram', 'weight', 'quantity']) || 0,
      calorias: findNumberByVariants(nutritionPayload, ['calories', 'energykcal', 'energy', 'kcal']),
      carboidratos: findNumberByVariants(nutritionPayload, ['carbohydrates', 'carbs', 'carbohydrate']),
      proteinas: findNumberByVariants(nutritionPayload, ['proteins', 'protein']),
      gorduras: findNumberByVariants(nutritionPayload, ['fat', 'fats', 'lipids', 'totalfat']),
      food_item_position: 'top-level',
    },
  ];
}

function calculateTotals(foods: FoodItem[]) {
  return foods.reduce(
    (totals, item) => ({
      carboidratos_total: roundValue(totals.carboidratos_total + item.carboidratos),
      calorias_total: roundValue(totals.calorias_total + item.calorias),
      proteinas_total: roundValue(totals.proteinas_total + item.proteinas),
      gorduras_total: roundValue(totals.gorduras_total + item.gorduras),
    }),
    {
      carboidratos_total: 0,
      calorias_total: 0,
      proteinas_total: 0,
      gorduras_total: 0,
    }
  );
}

function inferMimeType(path = '', fallback = 'image/jpeg') {
  const normalized = path.toLowerCase();

  if (normalized.endsWith('.png')) {
    return 'image/png';
  }

  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  return fallback;
}

async function loadImageBlob(payload: AnalyzePayload) {
  if (payload.imageUrl) {
    const response = await fetch(payload.imageUrl);

    if (!response.ok) {
      throw new Error('Nao foi possivel baixar a imagem enviada para analise.');
    }

    return {
      blob: await response.blob(),
      fileName: payload.fileName || 'refeicao.jpg',
      mimeType: payload.mimeType || inferMimeType(payload.imageUrl),
    };
  }

  const bucket = payload.bucket || DEFAULT_BUCKET;
  const path = String(payload.path || '').trim();

  if (!path) {
    throw new Error('Informe o caminho da imagem no Storage.');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);

  if (error || !data) {
    throw new Error('Nao foi possivel ler a imagem salva no Storage.');
  }

  return {
    blob: data,
    fileName: payload.fileName || path.split('/').pop() || 'refeicao.jpg',
    mimeType: payload.mimeType || inferMimeType(path),
  };
}

async function callLogMealSegmentation(imageBlob: Blob, fileName: string) {
  const urls = [
    `${LOGMEAL_API_URL}/v2/image/segmentation/complete/quantity/v1.0?language=${LOGMEAL_LANGUAGE}`,
    `${LOGMEAL_API_URL}/v2/image/segmentation/complete/v1.0?language=${LOGMEAL_LANGUAGE}`,
  ];

  let lastError = '';

  for (const url of urls) {
    const formData = new FormData();
    formData.append('image', imageBlob, fileName);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${logMealApiKey}`,
      },
      body: formData,
    });

    if (response.ok) {
      return await response.json();
    }

    lastError = unwrapErrorMessage(await response.text());
  }

  throw new Error(lastError || 'Falha ao consultar reconhecimento alimentar.');
}

async function callLogMealNutrition(imageId: number | string) {
  const response = await fetch(`${LOGMEAL_API_URL}/v2/nutrition/recipe/nutritionalInfo?language=${LOGMEAL_LANGUAGE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${logMealApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageId,
    }),
  });

  if (!response.ok) {
    const message = unwrapErrorMessage(await response.text());
    throw new Error(message || 'Falha ao obter dados nutricionais da refeicao.');
  }

  return await response.json();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Metodo nao permitido.' }, 405);
  }

  try {
    if (!logMealApiKey) {
      throw new Error('Variavel LOGMEAL_API_KEY obrigatoria.');
    }

    const payload = (await request.json().catch(() => ({}))) as AnalyzePayload;
    const { blob, fileName } = await loadImageBlob(payload);
    const segmentationPayload = await callLogMealSegmentation(blob, fileName);
    const imageId =
      segmentationPayload.imageId ||
      segmentationPayload.image_id ||
      segmentationPayload.id ||
      null;

    if (!imageId) {
      return jsonResponse(
        {
          ok: false,
          message: 'A IA nao retornou um identificador valido para a imagem analisada.',
        },
        422
      );
    }

    const nutritionPayload = await callLogMealNutrition(imageId);
    const alimentos = buildFoodItems(segmentationPayload, nutritionPayload);

    if (!alimentos.length) {
      return jsonResponse(
        {
          ok: false,
          message: 'A IA nao conseguiu reconhecer alimentos nessa imagem.',
          imageId,
        },
        422
      );
    }

    return jsonResponse({
      ok: true,
      source: 'logmeal',
      imageId,
      alimentos,
      totais: calculateTotals(alimentos),
    });
  } catch (error) {
    console.log('Erro ao analisar refeicao por IA:', error);

    return jsonResponse(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel analisar a refeicao agora.',
      },
      500
    );
  }
});
