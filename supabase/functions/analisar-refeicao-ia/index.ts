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

const DEFAULT_BUCKET = 'refeicoes-ia';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';
const geminiApiKeyFallback = Deno.env.get('GEMINI_API_KEY_FALLBACK') || '';
const geminiVisionModelRaw = Deno.env.get('GEMINI_VISION_MODEL') || '';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_MODEL_FALLBACKS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-2.0-flash',
  'gemini-1.5-flash-8b': 'gemini-2.0-flash-lite',
  'gemini-1.5-pro': 'gemini-2.0-flash',
};

function resolveGeminiModelName(raw: string) {
  let name = String(raw || '').trim();
  name = name.replace(/^models\//i, '');
  name = name.replace(/:generatecontent$/i, '');
  name = name.replace(/['"]/g, '');

  if (!name || /gpt|openai|sk-/i.test(name)) {
    return DEFAULT_GEMINI_MODEL;
  }

  if (DEPRECATED_MODEL_ALIASES[name]) {
    return DEPRECATED_MODEL_ALIASES[name];
  }

  if (!/^gemini[\d.]*-[\w.-]+$/i.test(name)) {
    return DEFAULT_GEMINI_MODEL;
  }

  return name;
}

function buildGeminiModelCandidates(preferredRaw: string) {
  const preferred = resolveGeminiModelName(preferredRaw);
  const ordered = [preferred, ...GEMINI_MODEL_FALLBACKS];
  return [...new Set(ordered)];
}

function isPlaceholderGeminiKey(key: string) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('sua-chave') ||
    normalized.includes('your-key') ||
    normalized.includes('cole_aqui') ||
    normalized === 'aiza...' ||
    normalized.startsWith('aiza...')
  );
}

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
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const error = parsed.error as Record<string, unknown> | undefined;
    return String(error?.message || parsed.message || parsed.error || trimmed);
  } catch (_error) {
    return trimmed;
  }
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatorias.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
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

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && typeof value !== 'undefined' && String(value).trim() !== '') {
      const parsed = normalizeNumber(value);
      if (parsed > 0) return parsed;
    }
  }
  return 0;
}

function makeFoodId(prefix: string, index: number) {
  return `${prefix}-${index}-${crypto.randomUUID().slice(0, 8)}`;
}

function calculateTotals(foods: FoodItem[]) {
  return foods.reduce(
    (totais, item) => ({
      carboidratos_total: roundValue(totais.carboidratos_total + item.carboidratos),
      calorias_total: roundValue(totais.calorias_total + item.calorias),
      proteinas_total: roundValue(totais.proteinas_total + item.proteinas),
      gorduras_total: roundValue(totais.gorduras_total + item.gorduras),
    }),
    { carboidratos_total: 0, calorias_total: 0, proteinas_total: 0, gorduras_total: 0 }
  );
}

function inferMimeType(path = '', fallback = 'image/jpeg') {
  const normalized = path.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
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
    mimeType: payload.mimeType || inferMimeType(path),
  };
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function isGenericMealLabel(nome: string) {
  const texto = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    /prato feito|refeicao completa|almoco completo|jantar completo|comida no prato/.test(texto) ||
    texto.length < 3
  );
}

function mapVisionFoodsToItems(rawFoods: unknown[]): FoodItem[] {
  return (Array.isArray(rawFoods) ? rawFoods : [])
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const nome = String(record.nome || record.name || record.alimento || '').trim();
      if (!nome || isGenericMealLabel(nome)) return null;

      const grams = roundValue(
        pickNumber(record, ['gramas_estimados', 'quantidade_gramas', 'grams', 'gram', 'porcao_gramas']) ||
          100
      );

      return {
        id: makeFoodId('ia', index),
        nome,
        categoria: String(record.categoria || record.category || 'Reconhecido por IA').trim(),
        quantidade_gramas: grams > 0 ? grams : 100,
        calorias: roundValue(pickNumber(record, ['calorias', 'kcal', 'calories'])),
        carboidratos: roundValue(pickNumber(record, ['carboidratos', 'carbs', 'carbohydrates'])),
        proteinas: roundValue(pickNumber(record, ['proteinas', 'protein', 'proteins'])),
        gorduras: roundValue(pickNumber(record, ['gorduras', 'fat', 'fats', 'lipids'])),
        food_item_position: index,
      };
    })
    .filter((item): item is FoodItem => Boolean(item));
}

function extractGeminiText(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content =
    first?.content && typeof first.content === 'object'
      ? (first.content as Record<string, unknown>)
      : null;
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  return parts
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      return String((part as Record<string, unknown>).text || '').trim();
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

const VISION_PROMPT =
  'Voce e nutricionista analisando uma foto de refeicao tipica do Brasil. ' +
  'Liste SOMENTE alimentos claramente visiveis (maximo 8). ' +
  'Use nomes em portugues brasileiro adequados a tabela TACO (ex: "Arroz, tipo 1, cozido", "Mandioca, cozida", "Carne, bovina, acém, sem gordura, cozido"). ' +
  'Cada alimento em um item separado — nunca "prato feito" ou "refeicao completa". ' +
  'Estime gramas por porcao visivel. Macros podem ser 0 — o app corrige com TACO. ' +
  'Responda APENAS JSON valido: {"alimentos":[{"nome":"string","gramas_estimados":number,"categoria":"string","calorias":0,"carboidratos":0,"proteinas":0,"gorduras":0}]}';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaOrRateLimitError(details: string, status: number) {
  const lower = String(details || '').toLowerCase();
  return (
    status === 429 ||
    lower.includes('resource exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  );
}

function isRetryableModelError(details: string) {
  const lower = String(details || '').toLowerCase();
  return (
    lower.includes('not found') ||
    lower.includes('not supported') ||
    lower.includes('unexpected model name')
  );
}

function collectGeminiApiKeys() {
  return [geminiApiKey, geminiApiKeyFallback].filter((key) => key && !isPlaceholderGeminiKey(key));
}

async function analyzeMealImageWithGemini(blob: Blob, mimeType: string) {
  const apiKeys = collectGeminiApiKeys();
  if (!apiKeys.length) {
    throw new Error(
      'GEMINI_API_KEY invalida ou ausente. Configure no Supabase (Edge Functions → Secrets).'
    );
  }

  const base64 = await blobToBase64(blob);
  const modelCandidates = buildGeminiModelCandidates(geminiVisionModelRaw);
  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: VISION_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
    },
  });

  let response: Response | null = null;
  let lastError = 'Falha ao consultar a IA de visao (Gemini).';
  let sawQuotaError = false;

  for (const apiKey of apiKeys) {
    for (const modelId of modelCandidates) {
      for (let retryIndex = 0; retryIndex < 2; retryIndex += 1) {
        const endpoint =
          `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const attempt = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });

        if (attempt.ok) {
          response = attempt;
          break;
        }

        const details = unwrapErrorMessage(await attempt.text());
        lastError = details || lastError;

        if (isQuotaOrRateLimitError(details, attempt.status)) {
          sawQuotaError = true;
          if (retryIndex === 0) {
            await sleep(2500);
            continue;
          }
          break;
        }

        if (!isRetryableModelError(details)) {
          console.log(`Gemini (${modelId}):`, lastError);
        }
      }
      if (response) break;
    }
    if (response) break;
  }

  if (!response) {
    if (sawQuotaError) {
      const quotaError = new Error(
        'Limite da API Gemini atingido. Aguarde alguns minutos ou verifique o plano em aistudio.google.com.'
      );
      (quotaError as Error & { code?: string }).code = 'QUOTA_EXCEEDED';
      throw quotaError;
    }
    throw new Error(lastError);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const content = extractGeminiText(payload);
  if (!content) {
    throw new Error('A IA nao retornou sugestoes de alimentos para esta imagem.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch (_error) {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
    } else {
      throw new Error('Resposta da IA em formato invalido. Tente outra foto.');
    }
  }

  const rawList = Array.isArray(parsed.alimentos)
    ? parsed.alimentos
    : Array.isArray(parsed.foods)
      ? parsed.foods
      : [];

  const alimentos = mapVisionFoodsToItems(rawList);
  if (!alimentos.length) {
    throw new Error('Nao foi possivel identificar alimentos nesta foto. Use busca TACO ou outra imagem.');
  }

  return {
    source: 'gemini-vision',
    imageId: null,
    alimentos,
    totais: calculateTotals(alimentos),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Metodo nao permitido.' }, 405);
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as AnalyzePayload;
    const { blob, mimeType } = await loadImageBlob(payload);
    const analysis = await analyzeMealImageWithGemini(blob, mimeType);

    return jsonResponse({
      ok: true,
      source: analysis.source,
      imageId: analysis.imageId,
      alimentos: analysis.alimentos,
      totais: analysis.totais,
      requiresReview: true,
    });
  } catch (error) {
    console.log('Erro ao analisar refeicao por IA (Gemini):', error);
    const message = error instanceof Error ? error.message : 'Nao foi possivel analisar a refeicao agora.';
    const lower = message.toLowerCase();
    const isConfigError = lower.includes('gemini_api_key') || lower.includes('google ai studio');
    const isQuotaError =
      (error as Error & { code?: string })?.code === 'QUOTA_EXCEEDED' ||
      lower.includes('quota') ||
      lower.includes('resource exhausted');

    return jsonResponse(
      {
        ok: false,
        code: isConfigError ? 'IA_NOT_CONFIGURED' : isQuotaError ? 'QUOTA_EXCEEDED' : 'ANALYSIS_ERROR',
        message,
      },
      isConfigError ? 503 : isQuotaError ? 429 : 500
    );
  }
});
