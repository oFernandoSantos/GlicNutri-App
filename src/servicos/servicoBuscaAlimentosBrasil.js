import catalogoTaco from '../dados/alimentosBrasilTaco.json';

const CATALOGO_BRASIL = Array.isArray(catalogoTaco) ? catalogoTaco : [];

const CATALOGO_INDEXADO = CATALOGO_BRASIL.map((item) => ({
  ...item,
  nomeNormalizado: normalizarTextoBusca(item.nome),
  categoriaNormalizada: normalizarTextoBusca(item.categoria),
}));

export const TOTAL_ALIMENTOS_BRASIL = CATALOGO_INDEXADO.length;
export const FONTE_ALIMENTOS_LABEL = 'TACO (NEPA/UNICAMP)';

function normalizarTextoBusca(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pontuarAlimento(item, tokens) {
  let score = 0;

  tokens.forEach((token) => {
    if (item.nomeNormalizado === token) {
      score += 120;
      return;
    }

    if (item.nomeNormalizado.startsWith(token)) {
      score += 80;
      return;
    }

    if (item.nomeNormalizado.includes(token)) {
      score += 40;
    }

    if (item.categoriaNormalizada.includes(token)) {
      score += 12;
    }
  });

  return score;
}

/**
 * Busca na Tabela Brasileira de Composição de Alimentos (TACO) — referência oficial
 * para alimentos consumidos no Brasil (~600 itens).
 */
export function buscarAlimentosBrasil(query = '', { limit = 50, offset = 0 } = {}) {
  const tokens = normalizarTextoBusca(query).split(/\s+/).filter(Boolean);

  let resultados = CATALOGO_INDEXADO;

  if (tokens.length) {
    resultados = CATALOGO_INDEXADO.map((item) => ({
      item,
      score: pontuarAlimento(item, tokens),
    }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.item.nome.localeCompare(right.item.nome, 'pt-BR');
      })
      .map((entry) => entry.item);
  } else {
    resultados = [...CATALOGO_INDEXADO].sort((left, right) =>
      left.nome.localeCompare(right.nome, 'pt-BR')
    );
  }

  const total = resultados.length;
  const slice = resultados.slice(offset, offset + limit);

  return {
    items: slice,
    total,
    hasMore: offset + slice.length < total,
    nextOffset: offset + slice.length,
  };
}

export function obterAlimentoBrasilPorId(id) {
  return CATALOGO_INDEXADO.find((item) => item.id === id) || null;
}
