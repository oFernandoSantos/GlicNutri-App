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
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const openaiVisionModelRaw = Deno.env.get('OPENAI_VISION_MODEL') || '';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_MODEL_FALLBACKS = ['gpt-4o-mini', 'gpt-4o'];

const VISION_PROMPT =
  'Voce e nutricionista analisando uma foto de refeicao tipica do Brasil. ' +
  'Liste SOMENTE alimentos claramente visiveis (maximo 8). ' +
  'Use nomes em portugues brasileiro adequados a tabela TACO (ex: "Arroz, tipo 1, cozido", "Mandioca, cozida", "Carne, bovina, acém, sem gordura, cozido"). ' +
  'Cada alimento em um item separado — nunca "prato feito" ou "refeicao completa". ' +
  'Estime gramas por porcao visivel. Macros podem ser 0 — o app corrige com TACO. ' +
  'Responda APENAS JSON valido: {"alimentos":[{"nome":"string","gramas_estimados":number,"categoria":"string","calorias":0,"carboidratos":0,"proteinas":0,"gorduras":0}]}';

function resolveOpenAiModelName(raw: string) {
  const name = String(raw || '').trim();
  if (!name || /gemini|generativelanguage/i.test(name)) {
    return DEFAULT_OPENAI_MODEL;
  }
  return name;
}

function buildOpenAiModelCandidates(preferredRaw: string) {
  const preferred = resolveOpenAiModelName(preferredRaw);
  const ordered = [preferred, ...OPENAI_MODEL_FALLBACKS];
  return [...new Set(ordered)];
}

function isPlaceholderOpenAiKey(key: string) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('sua-chave') ||
    normalized.includes('your-key') ||
    normalized.includes('cole_aqui') ||
    normalized.includes('sk-...') ||
    !normalized.startsWith('sk-')
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

function extractOpenAiText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message =
    first?.message && typeof first.message === 'object'
      ? (first.message as Record<string, unknown>)
      : null;
  return String(message?.content || '').trim();
}

function parseVisionJson(content: string) {
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
  return parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaOrRateLimitError(details: string, status: number) {
  const lower = String(details || '').toLowerCase();
  return (
    status === 429 ||
    lower.includes('rate limit') ||
    lower.includes('insufficient_quota') ||
    lower.includes('quota') ||
    lower.includes('billing')
  );
}

function isRetryableModelError(details: string) {
  const lower = String(details || '').toLowerCase();
  return (
    lower.includes('model') &&
    (lower.includes('not found') || lower.includes('does not exist') || lower.includes('not supported'))
  );
}

async function analyzeMealImageWithOpenAI(blob: Blob, mimeType: string) {
  if (isPlaceholderOpenAiKey(openaiApiKey)) {
    throw new Error(
      'OPENAI_API_KEY invalida ou ausente. Configure no Supabase (Edge Functions → Secrets).'
    );
  }

  const base64 = await blobToBase64(blob);
  const modelCandidates = buildOpenAiModelCandidates(openaiVisionModelRaw);
  const imageDataUrl = `data:${mimeType};base64,${base64}`;

  let response: Response | null = null;
  let lastError = 'Falha ao consultar a IA de visao (OpenAI).';
  let sawQuotaError = false;

  for (const modelId of modelCandidates) {
    for (let retryIndex = 0; retryIndex < 2; retryIndex += 1) {
      const attempt = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.15,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: VISION_PROMPT },
                { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
              ],
            },
          ],
        }),
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
          await sleep(2000);
          continue;
        }
        break;
      }

      if (!isRetryableModelError(details)) {
        console.log(`OpenAI (${modelId}):`, lastError);
        break;
      }
    }
    if (response) break;
  }

  if (!response) {
    if (sawQuotaError) {
      const quotaError = new Error(
        'Limite ou saldo da OpenAI insuficiente. Adicione creditos em platform.openai.com/settings/billing.'
      );
      (quotaError as Error & { code?: string }).code = 'QUOTA_EXCEEDED';
      throw quotaError;
    }
    throw new Error(lastError);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const content = extractOpenAiText(payload);
  if (!content) {
    throw new Error('A IA nao retornou sugestoes de alimentos para esta imagem.');
  }

  const parsed = parseVisionJson(content);
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
    source: 'openai-vision',
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
    const analysis = await analyzeMealImageWithOpenAI(blob, mimeType);

    return jsonResponse({
      ok: true,
      source: analysis.source,
      imageId: analysis.imageId,
      alimentos: analysis.alimentos,
      totais: analysis.totais,
      requiresReview: true,
    });
  } catch (error) {
    console.log('Erro ao analisar refeicao por IA (OpenAI):', error);
    const message = error instanceof Error ? error.message : 'Nao foi possivel analisar a refeicao agora.';
    const lower = message.toLowerCase();
    const isConfigError =
      lower.includes('openai_api_key') || lower.includes('platform.openai.com');
    const isQuotaError =
      (error as Error & { code?: string })?.code === 'QUOTA_EXCEEDED' ||
      lower.includes('quota') ||
      lower.includes('insufficient_quota') ||
      lower.includes('billing');

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
