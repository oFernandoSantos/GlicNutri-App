import {
  buscarMelhorProdutoRotuloBrasil,
  materializarAlimentoDaBusca,
  melhorAlimentoBrasilParaNome,
  montarContextoBusca,
  pareceProdutoComercial,
  pontuarAlimento,
  pontuarMatchRotuloBrasil,
} from './servicoBuscaAlimentosBrasil';

const FONTES_NUTRICIONAIS_LABEL = {
  rotulo: 'Rótulo real (Open Food Facts)',
  industrializado: 'Catálogo comercial brasileiro',
  taco: 'Tabela TACO',
  ia: 'Sem tabela — revise os valores',
};

function normalizarNumero(value) {
  if (value === null || typeof value === 'undefined' || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function extrairCodigoBarrasIA(item = {}) {
  const texto = [
    item.codigo_barras_lido,
    item.codigo_barras,
    item.ean,
    item.texto_rotulo_lido,
    item.quantidade_lida,
    item.nome,
  ]
    .map((parte) => String(parte || '').trim())
    .filter(Boolean)
    .join(' ');

  const matches = texto.match(/\b(\d{8,14})\b/g);
  if (!matches?.length) {
    return null;
  }

  return matches.sort((left, right) => right.length - left.length)[0];
}

export function classificarTipoItemIdentificadoIA(item = {}) {
  const tipoDeclarado = String(item.tipo_item || item.tipo || '').toLowerCase().trim();

  if (['embalagem', 'embalado', 'produto', 'industrializado'].includes(tipoDeclarado)) {
    return 'embalagem';
  }

  if (['prato', 'caseiro', 'natural', 'taco'].includes(tipoDeclarado)) {
    return 'prato';
  }

  if (item.quantidade_do_rotulo || item.texto_rotulo_lido || item.codigo_barras_lido) {
    return 'embalagem';
  }

  if (pareceProdutoComercial(item.nome)) {
    return 'embalagem';
  }

  return 'prato';
}

function montarConsultasNutricionais(item = {}) {
  const nome = String(item.nome || '').trim();
  const marca = String(item.marca_lida || item.marca || item.brands || '').trim();
  const texto = String(item.texto_rotulo_lido || item.texto_lido || '').trim();
  const codigo = extrairCodigoBarrasIA(item);

  const consultaRotulo = [codigo, nome, marca, texto].filter(Boolean).join(' ').trim() || nome;

  return {
    codigo,
    nome,
    marca,
    consultaRotulo,
    consultaCatalogo: nome,
  };
}

/**
 * Conecta item lido pela IA (nome + porção da embalagem) à melhor tabela nutricional disponível.
 */
export async function resolverNutricaoInteligenteParaItemIA(item = {}) {
  const nome = String(item.nome || '').trim();
  const grams = normalizarNumero(item.quantidade_gramas) > 0 ? item.quantidade_gramas : 100;
  const tipo = classificarTipoItemIdentificadoIA(item);
  const consultas = montarConsultasNutricionais(item);
  const contexto = montarContextoBusca(consultas.consultaCatalogo);

  let rotulo = null;
  let industrial = null;
  let taco = null;

  if (tipo === 'embalagem') {
    const queryRotulo = consultas.codigo || consultas.consultaRotulo;
    const [rotuloResult, industrialResult] = await Promise.all([
      buscarMelhorProdutoRotuloBrasil(queryRotulo, {
        minScore: consultas.codigo ? 75 : 85,
      }),
      Promise.resolve(
        melhorAlimentoBrasilParaNome(consultas.consultaCatalogo, { minScore: 52 })
      ),
    ]);
    rotulo = rotuloResult;
    industrial = industrialResult;
  } else {
    taco = melhorAlimentoBrasilParaNome(consultas.consultaCatalogo, {
      minScore: 62,
      preferTaco: true,
    });
  }

  const candidatos = [];

  if (rotulo?.origem === 'rotulo') {
    candidatos.push({
      item: rotulo,
      fonte: 'rotulo',
      score:
        pontuarMatchRotuloBrasil(rotulo, consultas.consultaRotulo) +
        (consultas.codigo ? 150 : 0) +
        (item.quantidade_do_rotulo ? 30 : 0),
    });
  }

  if (industrial) {
    candidatos.push({
      item: industrial,
      fonte: 'industrializado',
      score: pontuarAlimento(industrial, contexto) + (tipo === 'embalagem' ? 35 : 0),
    });
  }

  if (taco) {
    candidatos.push({
      item: taco,
      fonte: 'taco',
      score: pontuarAlimento(taco, contexto) + (tipo === 'prato' ? 45 : 0),
    });
  }

  candidatos.sort((left, right) => right.score - left.score);
  const melhor = candidatos[0];

  if (!melhor || melhor.score < 48) {
    return {
      alimento: { ...item, nome, quantidade_gramas: grams },
      fonte: 'ia',
      fonteLabel: FONTES_NUTRICIONAIS_LABEL.ia,
      tabelaNome: null,
      confianca: 'baixa',
      tipo,
    };
  }

  const materializado = materializarAlimentoDaBusca({
    ...melhor.item,
    quantidade_gramas: grams,
    nomeComercial: nome,
  });

  const confianca = melhor.score >= 130 ? 'alta' : melhor.score >= 85 ? 'media' : 'baixa';

  return {
    alimento: {
      ...materializado,
      nome,
      quantidade_gramas: grams,
      unidade_quantidade: item.unidade_quantidade || materializado.unidade_quantidade || 'g',
      quantidade_lida: item.quantidade_lida,
      quantidade_do_rotulo: item.quantidade_do_rotulo,
      texto_rotulo_lido: item.texto_rotulo_lido,
      codigo_barras_lido: consultas.codigo || item.codigo_barras_lido || null,
      origem: melhor.fonte,
      refTacoId:
        melhor.fonte === 'taco'
          ? melhor.item.id
          : melhor.item.refTacoId ?? (melhor.fonte === 'industrializado' ? melhor.item.id : null),
      nomeTabelaReferencia: melhor.item.nome,
      nomeTabelaConectada: melhor.item.nome,
    },
    fonte: melhor.fonte,
    fonteLabel: FONTES_NUTRICIONAIS_LABEL[melhor.fonte] || FONTES_NUTRICIONAIS_LABEL.ia,
    tabelaNome: melhor.item.nome,
    confianca,
    tipo,
  };
}
