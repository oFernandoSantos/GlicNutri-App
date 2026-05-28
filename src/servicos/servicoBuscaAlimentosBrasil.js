import catalogoTaco from '../dados/alimentosBrasilTaco.json';
import catalogoIndustrial from '../dados/alimentosIndustrializadosComerciais.json';
import {
  ALIASES_PALAVRA_TACO,
  PREPARO_BUSCA_TACO,
  STOP_WORDS_BUSCA,
  resolverPadraoPrato,
} from '../dados/sinonimosBuscaTaco';
import { supabase } from './configSupabase';

const CATALOGO_TACO = Array.isArray(catalogoTaco) ? catalogoTaco : [];
const CATALOGO_INDUSTRIAL_RAW = Array.isArray(catalogoIndustrial) ? catalogoIndustrial : [];

const MAPA_TACO_POR_ID = new Map(CATALOGO_TACO.map((item) => [item.id, item]));

function normalizarTextoBusca(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function chaveAlias(token) {
  return token.replace(/[^a-z0-9]/g, '');
}

function tokenizarTextoLivre(value) {
  return normalizarTextoBusca(value)
    .split(/\s+/)
    .filter((token) => token && token.length >= 2 && !STOP_WORDS_BUSCA.has(token));
}

function resolverNutrientesIndustrial(entry) {
  const ref = entry.refTacoId ? MAPA_TACO_POR_ID.get(entry.refTacoId) : null;
  const quantidade = entry.quantidade_gramas ?? ref?.quantidade_gramas ?? 100;
  const porcao = entry.porcao ?? ref?.porcao ?? '100 g';
  const calorias = entry.calorias ?? ref?.calorias ?? 0;
  const carboidratos = entry.carboidratos ?? ref?.carboidratos ?? 0;
  const proteinas = entry.proteinas ?? ref?.proteinas ?? 0;
  const gorduras = entry.gorduras ?? ref?.gorduras ?? 0;

  return {
    quantidade_gramas: quantidade,
    porcao,
    base_quantidade_gramas: 100,
    base_calorias: calorias,
    base_carboidratos: carboidratos,
    base_proteinas: proteinas,
    base_gorduras: gorduras,
    calorias: Math.round(calorias * (quantidade / 100) * 10) / 10,
    carboidratos: Math.round(carboidratos * (quantidade / 100) * 10) / 10,
    proteinas: Math.round(proteinas * (quantidade / 100) * 10) / 10,
    gorduras: Math.round(gorduras * (quantidade / 100) * 10) / 10,
  };
}

function indexarItem(item, origem) {
  const nomeNormalizado = normalizarTextoBusca(item.nome);
  const partesNome = nomeNormalizado
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);

  const aliasesNormalizados = (item.aliases || [])
    .map((alias) => normalizarTextoBusca(alias))
    .filter(Boolean);

  return {
    ...item,
    origem,
    nomeNormalizado,
    categoriaNormalizada: normalizarTextoBusca(item.categoria),
    partesNome,
    aliasesNormalizados,
    textoBusca: [nomeNormalizado, ...aliasesNormalizados, ...partesNome].join(' '),
  };
}

function montarCatalogoIndustrial() {
  return CATALOGO_INDUSTRIAL_RAW.map((entry) => {
    const nutrientes = resolverNutrientesIndustrial(entry);
    const ref = entry.refTacoId ? MAPA_TACO_POR_ID.get(entry.refTacoId) : null;

    return indexarItem(
      {
        ...entry,
        ...nutrientes,
        categoria: entry.categoria || 'Outros alimentos industrializados',
        refTacoId: entry.refTacoId || null,
        referenciaTacoNome: ref?.nome || null,
        fonteNutricional: ref ? 'Valores aproximados' : 'Valores aproximados',
      },
      'industrializado'
    );
  });
}

const CATALOGO_INDUSTRIAL = montarCatalogoIndustrial();
const CATALOGO_TACO_INDEXADO = CATALOGO_TACO.map((item) => indexarItem(item, 'taco'));
const CATALOGO_UNIFICADO = [...CATALOGO_INDUSTRIAL, ...CATALOGO_TACO_INDEXADO];
const OPEN_FOOD_FACTS_FIELDS = [
  'code',
  'product_name',
  'brands',
  'categories',
  'nutriments',
  'serving_size',
  'image_front_url',
  'countries_tags',
  'nutrition_grades',
  'nutriscore_grade',
  'nova_group',
].join(',');

export const TOTAL_ALIMENTOS_TACO = CATALOGO_TACO_INDEXADO.length;
export const TOTAL_ALIMENTOS_INDUSTRIALIZADOS = CATALOGO_INDUSTRIAL.length;
export const TOTAL_ALIMENTOS_BRASIL = CATALOGO_UNIFICADO.length;
export const FONTE_ALIMENTOS_LABEL = 'alimentos';

function parseServingSizeToGrams(servingSize) {
  const raw = String(servingSize || '').trim().toLowerCase();
  if (!raw) return null;

  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/);
  if (!match) return null;

  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;

  // Para bebidas, 1 ml ~ 1 g (aprox). Mantemos isso para fins de escala.
  return value;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getOffNutriment(nutriments, key) {
  if (!nutriments || typeof nutriments !== 'object') return null;
  if (nutriments[key] == null) return null;
  return toNumber(nutriments[key]);
}

function getOffNutrimentAny(nutriments, keys) {
  for (const key of keys) {
    const value = getOffNutriment(nutriments, key);
    if (value != null) return value;
  }

  return null;
}

function getOffNutrimentPer100(nutriments, baseKey, servingGrams) {
  const direct = getOffNutriment(nutriments, `${baseKey}_100g`);
  if (direct != null) return direct;

  const serving = getOffNutriment(nutriments, `${baseKey}_serving`) ?? getOffNutriment(nutriments, baseKey);
  const servingQty = Number(servingGrams);

  if (serving != null && Number.isFinite(servingQty) && servingQty > 0) {
    return (serving * 100) / servingQty;
  }

  return serving;
}

function gramsToMilligrams(value) {
  return value == null ? null : value * 1000;
}

function getOffMineralMg(nutriments, keys) {
  const value = getOffNutrimentAny(nutriments, keys);
  if (value == null) return null;

  // Open Food Facts armazena minerais em gramas por 100 g/ml.
  return value <= 20 ? gramsToMilligrams(value) : value;
}

function buildNutritionFacts(nutriments, servingGrams) {
  const sodiumG100 = getOffNutrimentPer100(nutriments, 'sodium', servingGrams);
  const saltG100 = getOffNutrimentPer100(nutriments, 'salt', servingGrams);
  const sodiumMg100 =
    sodiumG100 != null ? gramsToMilligrams(sodiumG100) : saltG100 != null ? saltG100 * 0.4 * 1000 : null;

  return {
    calorias: getOffNutrimentPer100(nutriments, 'energy-kcal', servingGrams),
    carboidratos: getOffNutrimentPer100(nutriments, 'carbohydrates', servingGrams),
    proteinas: getOffNutrimentPer100(nutriments, 'proteins', servingGrams),
    gorduras: getOffNutrimentPer100(nutriments, 'fat', servingGrams),
    gorduras_saturadas: getOffNutrimentPer100(nutriments, 'saturated-fat', servingGrams),
    gordura_trans: getOffNutrimentPer100(nutriments, 'trans-fat', servingGrams),
    fibras: getOffNutrimentPer100(nutriments, 'fiber', servingGrams),
    acucares: getOffNutrimentPer100(nutriments, 'sugars', servingGrams),
    acucares_adicionados:
      getOffNutrimentPer100(nutriments, 'added-sugars', servingGrams) ??
      getOffNutrimentPer100(nutriments, 'added_sugars', servingGrams),
    sodio: sodiumMg100,
    sal: saltG100,
    potassio: getOffMineralMg({ potassium_100g: getOffNutrimentPer100(nutriments, 'potassium', servingGrams) }, ['potassium_100g']),
    calcio: getOffMineralMg({ calcium_100g: getOffNutrimentPer100(nutriments, 'calcium', servingGrams) }, ['calcium_100g']),
    ferro: getOffMineralMg({ iron_100g: getOffNutrimentPer100(nutriments, 'iron', servingGrams) }, ['iron_100g']),
    magnesio: getOffMineralMg({ magnesium_100g: getOffNutrimentPer100(nutriments, 'magnesium', servingGrams) }, ['magnesium_100g']),
    zinco: getOffMineralMg({ zinc_100g: getOffNutrimentPer100(nutriments, 'zinc', servingGrams) }, ['zinc_100g']),
    vitamina_a: getOffNutrimentPer100(nutriments, 'vitamin-a', servingGrams),
    vitamina_c: getOffNutrimentPer100(nutriments, 'vitamin-c', servingGrams),
    vitamina_d: getOffNutrimentPer100(nutriments, 'vitamin-d', servingGrams),
    vitamina_b12: getOffNutrimentPer100(nutriments, 'vitamin-b12', servingGrams),
  };
}

function mapBaseNutritionFields(facts) {
  return {
    base_calorias: facts.calorias ?? 0,
    base_carboidratos: facts.carboidratos ?? 0,
    base_proteinas: facts.proteinas ?? 0,
    base_gorduras: facts.gorduras ?? 0,
    base_fibras: facts.fibras,
    base_acucares: facts.acucares,
    base_acucares_adicionados: facts.acucares_adicionados,
    base_gorduras_saturadas: facts.gorduras_saturadas,
    base_gordura_trans: facts.gordura_trans,
    base_sodio: facts.sodio,
    base_sal: facts.sal,
    base_potassio: facts.potassio,
    base_calcio: facts.calcio,
    base_ferro: facts.ferro,
    base_magnesio: facts.magnesio,
    base_zinco: facts.zinco,
    base_vitamina_a: facts.vitamina_a,
    base_vitamina_c: facts.vitamina_c,
    base_vitamina_d: facts.vitamina_d,
    base_vitamina_b12: facts.vitamina_b12,
  };
}

function buildOpenFoodFactsItem(product) {
  const code = String(product?.code || '').trim();
  const nutriments = product?.nutriments || {};
  const nome = String(product?.product_name || '').trim();
  const marca = String(product?.brands || '').trim();
  const categoria = String(product?.categories || '').trim();
  const porcao = String(product?.serving_size || '').trim();

  const servingGrams = parseServingSizeToGrams(porcao);
  const facts = buildNutritionFacts(nutriments, servingGrams);

  const displayName = nome || (marca ? `${marca} (produto)` : '') || code || 'Produto';
  const displayCategory = categoria ? `Rótulo · ${categoria.split(',')[0].trim()}` : 'Rótulo · Produto';

  return indexarItem(
    {
      id: code ? `off-${code}` : `off-${Math.random().toString(16).slice(2)}`,
      code: code || null,
      nome: displayName,
      aliases: [],
      categoria: displayCategory,
      origem: 'rotulo',
      fonteNutricional: 'Rótulo (Open Food Facts)',
      porcao: porcao || (servingGrams ? `${servingGrams} g` : '100 g'),
      quantidade_gramas: servingGrams ?? 100,
      base_quantidade_gramas: 100,
      ...mapBaseNutritionFields(facts),
      tabelaNutricional: facts,
      imageUrl: product?.image_front_url || null,
      brands: marca || null,
      marca: marca || null,
      nutriScore: product?.nutrition_grades || product?.nutriscore_grade || null,
      novaGroup: product?.nova_group || null,
      rotuloCacheUpdatedAt: product?.rotuloCacheUpdatedAt || null,
    },
    'rotulo'
  );
}

function buildCacheRowFromItem(item, product) {
  if (!item?.code) return null;

  return {
    code: item.code,
    nome: item.nome,
    marca: item.brands || item.marca || null,
    categoria: item.categoria || null,
    porcao: item.porcao || null,
    nutriments: product?.nutriments || {},
    produto_normalizado: item,
    fonte: 'Open Food Facts',
    updated_at: new Date().toISOString(),
  };
}

function buildItemFromCacheRow(row) {
  const normalized = row?.produto_normalizado;
  if (normalized && typeof normalized === 'object') {
    return indexarItem(
      {
        ...normalized,
        rotuloCacheUpdatedAt: row.updated_at || normalized.rotuloCacheUpdatedAt || null,
      },
      'rotulo'
    );
  }

  return buildOpenFoodFactsItem({
    code: row?.code,
    product_name: row?.nome,
    brands: row?.marca,
    categories: row?.categoria,
    serving_size: row?.porcao,
    nutriments: row?.nutriments,
    rotuloCacheUpdatedAt: row?.updated_at || null,
  });
}

async function buscarProdutosRotuloCache(query, { limit = 12 } = {}) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 24));

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('buscar_produtos_rotulo_cache', {
      p_query: trimmed,
      p_limite: safeLimit,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map(buildItemFromCacheRow).filter(Boolean);
    }

    const rpcMessage = String(rpcError?.message || '').toLowerCase();
    const rpcMissing =
      rpcMessage.includes('could not find the function') ||
      rpcMessage.includes('schema cache') ||
      rpcMessage.includes('buscar_produtos_rotulo_cache');

    if (!rpcMissing) {
      return [];
    }

    const barcodeOnly = /^\d{8,14}$/.test(trimmed);
    let queryBuilder = supabase.from('produtos_rotulo_cache').select('*');

    if (barcodeOnly) {
      queryBuilder = queryBuilder.eq('code', trimmed);
    } else {
      queryBuilder = queryBuilder.or(
        `nome.ilike.%${trimmed}%,marca.ilike.%${trimmed}%,categoria.ilike.%${trimmed}%`
      );
    }

    const { data, error } = await queryBuilder
      .order('updated_at', { ascending: false })
      .limit(safeLimit);

    if (error) return [];
    return (Array.isArray(data) ? data : []).map(buildItemFromCacheRow).filter(Boolean);
  } catch (_error) {
    return [];
  }
}

async function salvarProdutosRotuloCache(rows) {
  const payload = (Array.isArray(rows) ? rows : []).filter((row) => row?.code);
  if (!payload.length) return;

  try {
    const { error: rpcError } = await supabase.rpc('upsert_produtos_rotulo_cache', {
      p_rows: payload,
    });

    if (!rpcError) {
      return;
    }

    const rpcMessage = String(rpcError?.message || '').toLowerCase();
    const rpcMissing =
      rpcMessage.includes('could not find the function') ||
      rpcMessage.includes('schema cache') ||
      rpcMessage.includes('upsert_produtos_rotulo_cache');

    if (!rpcMissing) {
      return;
    }

    await supabase.from('produtos_rotulo_cache').upsert(payload, { onConflict: 'code' });
  } catch (_error) {
    // Cache é melhoria de performance; falha aqui não deve quebrar a busca.
  }
}

async function buscarProdutoRotuloPorCodigo(code) {
  const safeCode = String(code || '').replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(safeCode)) return null;

  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(safeCode)}` +
    `?fields=${encodeURIComponent(OPEN_FOOD_FACTS_FIELDS)}`;

  try {
    const response = await fetchWithTimeout(url, { timeoutMs: 4500 });
    if (!response.ok) return null;

    const data = await response.json();
    const product = data?.product;
    if (!product || data?.status === 0) return null;

    const item = buildOpenFoodFactsItem({ ...product, code: product.code || safeCode });
    await salvarProdutosRotuloCache([buildCacheRowFromItem(item, product)]);

    return item;
  } catch (_error) {
    return null;
  }
}

async function fetchWithTimeout(url, { timeoutMs = 4500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca online de produtos com rótulo nutricional (Open Food Facts).
 * Mantém a busca atual (TACO + industrializados locais) e apenas complementa.
 */
export async function buscarProdutosRotuloBrasil(query = '', { limit = 12, page = 1 } = {}) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) {
    return { items: [], total: 0, hasMore: false };
  }

  const pageSize = Math.max(1, Math.min(Number(limit) || 12, 24));
  const safePage = Math.max(1, Number(page) || 1);

  const barcodeOnly = /^\d{8,14}$/.test(trimmed);

  const url =
    'https://world.openfoodfacts.org/api/v2/search' +
    `?search_terms=${encodeURIComponent(trimmed)}` +
    '&countries_tags_en=brazil' +
    '&sort_by=popularity_key' +
    `&page_size=${pageSize}` +
    `&page=${safePage}` +
    `&fields=${encodeURIComponent(OPEN_FOOD_FACTS_FIELDS)}`;

  try {
    const cachedItems = safePage === 1 ? await buscarProdutosRotuloCache(trimmed, { limit: pageSize }) : [];
    const exactBarcodeItem = barcodeOnly && safePage === 1 ? await buscarProdutoRotuloPorCodigo(trimmed) : null;

    if (barcodeOnly) {
      const barcodeItems = [exactBarcodeItem, ...cachedItems].filter(Boolean);
      return { items: barcodeItems, total: barcodeItems.length, hasMore: false };
    }

    const response = await fetchWithTimeout(url, { timeoutMs: 4500 });
    if (!response.ok) {
      return { items: cachedItems, total: cachedItems.length, hasMore: false };
    }

    const data = await response.json();
    const products = Array.isArray(data?.products) ? data.products : [];

    const brProducts = products.filter((p) =>
      Array.isArray(p?.countries_tags) ? p.countries_tags.includes('en:brazil') : true
    );

    const items = brProducts
      .map(buildOpenFoodFactsItem)
      .filter((item) => item && item.nome && item.base_quantidade_gramas);
    const cacheRows = items.map((item, index) => buildCacheRowFromItem(item, brProducts[index]));
    salvarProdutosRotuloCache(cacheRows);

    const total = Number(data?.count) || items.length;
    const hasMore = safePage * pageSize < total;

    const seen = new Set();
    const mergedItems = [...cachedItems, ...items].filter((item) => {
      const key = item.code || item.id || item.nome;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { items: mergedItems, total: Math.max(total, mergedItems.length), hasMore };
  } catch (error) {
    const cachedItems = await buscarProdutosRotuloCache(trimmed, { limit: pageSize });
    return { items: cachedItems, total: cachedItems.length, hasMore: false };
  }
}

function hasRealNutritionTable(item) {
  if (!item || item.origem !== 'rotulo') return false;
  const keys = [
    'base_calorias',
    'base_carboidratos',
    'base_proteinas',
    'base_gorduras',
    'base_acucares',
    'base_sodio',
  ];

  return keys.some((key) => item[key] !== null && typeof item[key] !== 'undefined');
}

function scoreRotuloMatch(item, query) {
  const queryText = normalizarTextoBusca(query);
  const name = normalizarTextoBusca(item?.nome);
  const brand = normalizarTextoBusca(item?.brands || item?.marca);
  const category = normalizarTextoBusca(item?.categoria);
  const tokens = tokenizarTextoLivre(queryText);

  if (!queryText || !name) return 0;

  let score = hasRealNutritionTable(item) ? 80 : 0;

  if (name === queryText) score += 220;
  if (brand && `${brand} ${name}`.includes(queryText)) score += 170;
  if (name.includes(queryText) || queryText.includes(name)) score += 120;

  tokens.forEach((token) => {
    if (name.includes(token)) score += 35;
    if (brand.includes(token)) score += 32;
    if (category.includes(token)) score += 8;
  });

  if (String(item?.code || '').trim() && queryText.includes(String(item.code).trim())) {
    score += 260;
  }

  return score;
}

export async function buscarMelhorProdutoRotuloBrasil(query = '', { minScore = 120 } = {}) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return null;

  const result = await buscarProdutosRotuloBrasil(trimmed, { limit: 12, page: 1 });
  const ranked = (Array.isArray(result?.items) ? result.items : [])
    .filter(hasRealNutritionTable)
    .map((item) => ({ item, score: scoreRotuloMatch(item, trimmed) }))
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.item || null;
}

function tokenizarBusca(query) {
  return normalizarTextoBusca(query)
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS_BUSCA.has(token))
    .slice(0, 16);
}

function expandirAliasToken(token) {
  const key = chaveAlias(token);
  const aliases = ALIASES_PALAVRA_TACO[key];
  if (!Array.isArray(aliases)) {
    return [token];
  }

  return [token, ...aliases.map((alias) => normalizarTextoBusca(alias)).filter(Boolean)];
}

function expandirPreparoToken(token) {
  const key = chaveAlias(token);
  const termos = PREPARO_BUSCA_TACO[key];
  if (!Array.isArray(termos)) {
    return [];
  }

  return termos.map((termo) => normalizarTextoBusca(termo)).filter(Boolean);
}

function montarContextoBusca(query) {
  const queryOriginal = String(query || '').trim();
  const queryNormalizada = normalizarTextoBusca(query);
  const queryChave = chaveAlias(queryNormalizada);
  const tokensBase = tokenizarBusca(query);

  const padrao = resolverPadraoPrato(queryNormalizada);

  const tokens = new Set();
  const termosNome = new Set();
  const preparo = new Set();
  const categorias = new Set();

  tokensBase.forEach((token) => {
    expandirAliasToken(token).forEach((termo) => {
      tokens.add(termo);
      termosNome.add(termo);
    });

    expandirPreparoToken(token).forEach((termo) => {
      tokens.add(termo);
      preparo.add(termo);
    });
  });

  if (padrao) {
    padrao.termosNome.forEach((termo) => {
      const normalizado = normalizarTextoBusca(termo);
      tokens.add(normalizado);
      termosNome.add(normalizado);
    });
    padrao.preparo.forEach((termo) => {
      const normalizado = normalizarTextoBusca(termo);
      tokens.add(normalizado);
      preparo.add(normalizado);
    });
    padrao.categorias.forEach((categoria) => categorias.add(categoria));
  }

  const buscaEspecifica =
    Boolean(padrao) ||
    tokensBase.length >= 3 ||
    (termosNome.size >= 1 && preparo.size >= 1);

  return {
    queryOriginal,
    queryNormalizada,
    queryChave,
    tokens: [...tokens],
    termosNome: [...termosNome],
    preparo: [...preparo],
    categorias: [...categorias],
    padrao,
    buscaEspecifica,
  };
}

function pontuarAlimento(item, contexto) {
  const { tokens, termosNome, preparo, categorias, queryNormalizada, queryChave } = contexto;
  let score = 0;
  let gruposAtivos = 0;

  if (queryNormalizada && item.nomeNormalizado === queryNormalizada) {
    score += 260;
  }

  if (queryChave && chaveAlias(item.nomeNormalizado) === queryChave) {
    score += 240;
  }

  item.aliasesNormalizados?.forEach((alias) => {
    if (!alias) return;

    if (alias === queryNormalizada) {
      score += 250;
      return;
    }

    if (queryChave && chaveAlias(alias) === queryChave) {
      score += 230;
    }

    if (queryNormalizada.includes(alias) || alias.includes(queryNormalizada)) {
      score += 120;
    }
  });

  tokens.forEach((token) => {
    if (token.length < 2) {
      return;
    }

    if (item.nomeNormalizado === token) {
      score += 140;
      return;
    }

    if (item.nomeNormalizado.startsWith(token)) {
      score += 90;
    } else if (item.nomeNormalizado.includes(token)) {
      score += 42;
    }

    if (item.partesNome.some((parte) => parte.includes(token))) {
      score += 38;
    }

    if (item.aliasesNormalizados?.some((alias) => alias.includes(token) || token.includes(alias))) {
      score += 75;
    }

    if (item.textoBusca?.includes(token)) {
      score += 28;
    }

    if (item.categoriaNormalizada.includes(token)) {
      score += 14;
    }
  });

  const matchProteina = termosNome.some(
    (termo) =>
      termo.length >= 3 &&
      (item.nomeNormalizado.includes(termo) ||
        item.partesNome.some((parte) => parte.includes(termo)) ||
        item.aliasesNormalizados?.some((alias) => alias.includes(termo)))
  );

  const matchPreparo = preparo.some(
    (termo) =>
      item.nomeNormalizado.includes(termo) ||
      item.partesNome.some((parte) => parte.includes(termo))
  );

  const matchCategoria = categorias.some((categoria) => item.categoria === categoria);

  if (matchProteina) {
    score += 55;
    gruposAtivos += 1;
  }

  if (matchPreparo) {
    score += 50;
    gruposAtivos += 1;
  }

  if (matchCategoria) {
    score += 28;
    gruposAtivos += 1;
  }

  if (gruposAtivos >= 2) {
    score += 70;
  }

  if (gruposAtivos >= 3) {
    score += 35;
  }

  if (item.origem === 'industrializado' && score >= 90) {
    score += 25;
  }

  return score;
}

function criarItemDestaqueBusca(contexto, melhorItem) {
  if (!contexto.buscaEspecifica || !melhorItem || contexto.tokens.length < 2) {
    return null;
  }

  if (melhorItem.origem === 'industrializado') {
    return null;
  }

  const nomeComercial = contexto.queryOriginal;
  const referencia = melhorItem.nome;

  return {
    ...melhorItem,
    id: `busca-inteligente-${melhorItem.id}`,
    nome: nomeComercial,
    nomeComercial,
    nomeTacoReferencia: referencia,
    categoria: `Sugestão · ${melhorItem.categoria}`,
    buscaInteligente: true,
    refTacoId: melhorItem.id,
  };
}

function montarDicaBusca(contexto, melhorItem) {
  if (contexto.padrao?.dica) {
    return contexto.padrao.dica;
  }

  if (melhorItem?.origem === 'industrializado') {
    return 'Produto pronto para registrar. Ajuste a porção (ml/g) se precisar.';
  }

  return '';
}

/**
 * Busca unificada: TACO + produtos industrializados (marcas comerciais).
 */
export function buscarAlimentosBrasil(query = '', { limit = 50, offset = 0 } = {}) {
  const contexto = montarContextoBusca(query);
  const tokens = contexto.tokens;

  let resultados = CATALOGO_UNIFICADO;
  let ranqueados = [];

  if (tokens.length) {
    ranqueados = CATALOGO_UNIFICADO.map((item) => ({
      item,
      score: pontuarAlimento(item, contexto),
    }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (left.item.origem !== right.item.origem) {
          return left.item.origem === 'industrializado' ? -1 : 1;
        }

        return left.item.nome.localeCompare(right.item.nome, 'pt-BR');
      });

    resultados = ranqueados.map((entry) => entry.item);
  } else {
    resultados = [...CATALOGO_UNIFICADO].sort((left, right) =>
      left.nome.localeCompare(right.nome, 'pt-BR')
    );
  }

  let destaque = null;
  const melhor = ranqueados[0];

  if (offset === 0 && melhor?.score >= 80) {
    destaque = criarItemDestaqueBusca(contexto, melhor.item);
  }

  const listaBase = destaque
    ? [destaque, ...resultados.filter((item) => item.id !== melhor.item.id)]
    : resultados;

  const total = listaBase.length;
  const slice = listaBase.slice(offset, offset + limit);

  return {
    items: slice,
    total,
    hasMore: offset + slice.length < total,
    nextOffset: offset + slice.length,
    searchHint: montarDicaBusca(contexto, melhor?.item),
    buscaEspecifica: contexto.buscaEspecifica,
    destaque: destaque && offset === 0 ? destaque : null,
  };
}

export function obterAlimentoBrasilPorId(id) {
  const rawId = String(id);

  if (rawId.startsWith('busca-inteligente-')) {
    const baseId = rawId.replace('busca-inteligente-', '');
    const numericId = Number(baseId);
    return CATALOGO_UNIFICADO.find((item) => item.id === numericId) || null;
  }

  const numericId = Number(id);
  return CATALOGO_UNIFICADO.find((item) => item.id === numericId) || null;
}

function nutrientesPreenchidos(item) {
  if (!item) {
    return false;
  }

  return (
    Number(item.calorias) > 0 ||
    Number(item.carboidratos) > 0 ||
    Number(item.proteinas) > 0 ||
    Number(item.gorduras) > 0
  );
}

/**
 * Garante macros completos ao adicionar um item da busca (TACO, industrializado ou sugestão inteligente).
 */
export function materializarAlimentoDaBusca(item) {
  if (!item || typeof item !== 'object') {
    return {};
  }

  const catalogoPorId = item.id != null ? obterAlimentoBrasilPorId(item.id) : null;
  const catalogoPorRef =
    item.refTacoId != null && item.refTacoId !== item.id
      ? obterAlimentoBrasilPorId(item.refTacoId)
      : null;
  const catalogo = catalogoPorId || catalogoPorRef;

  const nome = String(item.nomeComercial || item.nome || catalogo?.nome || 'Alimento').trim();

  if (!catalogo) {
    if (item.origem === 'industrializado') {
      return {
        ...item,
        ...resolverNutrientesIndustrial(item),
        nome,
      };
    }

    return { ...item, nome };
  }

  const merged = {
    ...catalogo,
    ...item,
    nome,
    quantidade_gramas: item.quantidade_gramas ?? catalogo.quantidade_gramas ?? 100,
    porcao: item.porcao ?? catalogo.porcao,
    categoria: item.categoria || catalogo.categoria,
    origem: item.origem || catalogo.origem,
    refTacoId: item.refTacoId ?? catalogo.refTacoId ?? null,
    referenciaTacoNome: item.referenciaTacoNome ?? catalogo.referenciaTacoNome ?? null,
  };

  if (!nutrientesPreenchidos(merged) || catalogo.origem === 'industrializado' || item.origem === 'industrializado') {
    const nutrientes = resolverNutrientesIndustrial({ ...catalogo, ...item });
    return {
      ...merged,
      ...nutrientes,
      nome,
    };
  }

  return merged;
}
