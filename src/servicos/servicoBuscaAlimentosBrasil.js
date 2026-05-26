import catalogoTaco from '../dados/alimentosBrasilTaco.json';
import catalogoIndustrial from '../dados/alimentosIndustrializadosComerciais.json';
import {
  ALIASES_PALAVRA_TACO,
  PREPARO_BUSCA_TACO,
  STOP_WORDS_BUSCA,
  resolverPadraoPrato,
} from '../dados/sinonimosBuscaTaco';

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

function resolverNutrientesIndustrial(entry) {
  const ref = entry.refTacoId ? MAPA_TACO_POR_ID.get(entry.refTacoId) : null;

  return {
    quantidade_gramas: entry.quantidade_gramas ?? ref?.quantidade_gramas ?? 100,
    porcao: entry.porcao ?? ref?.porcao ?? '100 g',
    calorias: entry.calorias ?? ref?.calorias ?? 0,
    carboidratos: entry.carboidratos ?? ref?.carboidratos ?? 0,
    proteinas: entry.proteinas ?? ref?.proteinas ?? 0,
    gorduras: entry.gorduras ?? ref?.gorduras ?? 0,
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

export const TOTAL_ALIMENTOS_TACO = CATALOGO_TACO_INDEXADO.length;
export const TOTAL_ALIMENTOS_INDUSTRIALIZADOS = CATALOGO_INDUSTRIAL.length;
export const TOTAL_ALIMENTOS_BRASIL = CATALOGO_UNIFICADO.length;
export const FONTE_ALIMENTOS_LABEL = 'alimentos';

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
