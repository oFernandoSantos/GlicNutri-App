/**
 * Sinônimos e regras para busca inteligente na TACO (nomes comerciais + preparo).
 */

export const STOP_WORDS_BUSCA = new Set([
  'a',
  'o',
  'e',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'com',
  'sem',
  'ao',
  'aos',
  'para',
  'por',
  'um',
  'uma',
]);

/** Palavra comercial -> termos que existem nos nomes/categorias TACO */
export const ALIASES_PALAVRA_TACO = {
  tilapia: ['pescada', 'merluza', 'corvina', 'pintado', 'pescados'],
  peixe: ['pescados', 'pescada', 'merluza'],
  peixes: ['pescados', 'pescada'],
  file: ['file', 'peixe'],
  salmao: ['salmao', 'salmon'],
  camarao: ['camarao'],
  frango: ['frango'],
  galinha: ['frango', 'galinha'],
  carne: ['carne', 'bovina', 'boi'],
  bife: ['bife', 'carne', 'bovina'],
  maminha: ['bovina', 'vazio', 'contra'],
  picanha: ['bovina', 'vazio'],
  alcatra: ['alcatra', 'bovina'],
  contrafile: ['contra file', 'bovina'],
  patinho: ['patinho', 'bovina'],
  feijao: ['feijao'],
  arroz: ['arroz'],
  batata: ['batata'],
  mandioca: ['mandioca', 'aipim'],
  aipim: ['mandioca', 'aipim'],
  macarrao: ['massa', 'lasanha', 'macarrao'],
  massa: ['massa', 'lasanha'],
  pizza: ['pizza', 'preparados'],
  hamburguer: ['hamburguer', 'bovino'],
  ovo: ['ovo'],
  omelete: ['ovo'],
  queijo: ['queijo'],
  iogurte: ['iogurte'],
  banana: ['banana'],
  maca: ['maca'],
  laranja: ['laranja'],
  tomate: ['tomate'],
  alface: ['alface'],
  brocolis: ['brocolis'],
  cenoura: ['cenoura'],
  linguiça: ['linguica'],
  linguica: ['linguica'],
  salsicha: ['salsicha'],
  bacon: ['bacon'],
  presunto: ['presunto', 'fiambre'],
  mortadela: ['mortadela'],
  tofu: ['tofu', 'soja'],
  soja: ['soja'],

  // Bebidas e marcas industrializadas
  coca: ['cocacola', 'coca cola', 'refrigerante', 'cola'],
  cocacola: ['coca cola', 'coca', 'refrigerante', 'cola'],
  pepsi: ['pepsi', 'refrigerante', 'cola'],
  guarana: ['guarana', 'refrigerante'],
  fanta: ['fanta', 'refrigerante', 'laranja'],
  sprite: ['sprite', 'refrigerante', 'limao'],
  'red bull': ['redbull', 'energetico'],
  redbull: ['red bull', 'energetico'],
  monster: ['monster', 'energetico'],
  nescau: ['nescau', 'achocolatado'],
  toddy: ['toddy', 'achocolatado'],
  doritos: ['doritos', 'salgadinho'],
  cheetos: ['cheetos', 'salgadinho'],
  oreo: ['oreo', 'biscoito'],
  nutella: ['nutella', 'doce'],
  miojo: ['miojo', 'macarrao', 'instantaneo'],
  refri: ['refrigerante', 'bebidas'],
  refrigerante: ['refrigerante', 'cola', 'guarana'],
  energetico: ['energetico', 'red bull', 'monster'],
  salgadinho: ['salgadinho', 'salgadinhos'],
  biscoito: ['biscoito', 'maisena'],
};

/** Modo de preparo citado na busca -> termos no nome TACO */
export const PREPARO_BUSCA_TACO = {
  frita: ['frita', 'frito'],
  frito: ['frito', 'frita'],
  fritos: ['frito', 'frita'],
  fritas: ['frita', 'frito'],
  fritura: ['frito', 'frita'],
  milanesa: ['frito', 'frita', 'farinha'],
  milanesas: ['frito', 'frita', 'farinha'],
  empanado: ['frito', 'farinha'],
  empanada: ['frito', 'farinha'],
  grelhado: ['grelhado', 'grelhada'],
  grelhada: ['grelhada', 'grelhado'],
  assado: ['assado', 'assada'],
  assada: ['assada', 'assado'],
  cozido: ['cozido', 'cozida'],
  cozida: ['cozida', 'cozido'],
  cru: ['cru', 'crua'],
  crua: ['crua', 'cru'],
  refogado: ['refogado', 'refogada'],
  refogada: ['refogada', 'refogado'],
  congelado: ['congelado'],
  fresco: ['fresco', 'fresca'],
};

/**
 * Padrões de pratos compostos (busca específica).
 * @returns {{ termosNome: string[], preparo: string[], categorias: string[], dica: string } | null}
 */
export function resolverPadraoPrato(queryNormalizada) {
  const q = queryNormalizada;

  const tem = (...palavras) => palavras.every((p) => q.includes(p));
  const temAlgum = (...palavras) => palavras.some((p) => q.includes(p));

  if (temAlgum('tilapia') && temAlgum('milanes', 'frit', 'empan')) {
    return {
      termosNome: ['pescada', 'merluza', 'file'],
      preparo: ['frito', 'frita', 'farinha'],
      categorias: ['Pescados e frutos do mar'],
      dica: 'Sugestão: peixe frito/empanado parecido (pescada ou merluza).',
    };
  }

  if (temAlgum('tilapia', 'peixe') && temAlgum('grelh')) {
    return {
      termosNome: ['pescada', 'merluza', 'pintado', 'salmao'],
      preparo: ['grelhado', 'grelhada'],
      categorias: ['Pescados e frutos do mar'],
      dica: 'Peixe grelhado: escolha o tipo mais parecido na TACO.',
    };
  }

  if (temAlgum('frango', 'galinha') && temAlgum('milanes', 'frit', 'empan')) {
    return {
      termosNome: ['frango', 'peito', 'coxa'],
      preparo: ['frito', 'frita', 'farinha'],
      categorias: ['Carnes e derivados', 'Alimentos preparados'],
      dica: 'Frango empanado/frito: confira cortes de frango ou salgados na TACO.',
    };
  }

  if (temAlgum('frango', 'galinha') && temAlgum('grelh')) {
    return {
      termosNome: ['frango', 'peito'],
      preparo: ['grelhado', 'grelhada', 'assado'],
      categorias: ['Carnes e derivados'],
      dica: 'Frango grelhado: use peito ou coxa de frango na TACO.',
    };
  }

  if (tem('carne', 'moida') || tem('carne', 'moída') || q.includes('carne moida')) {
    return {
      termosNome: ['carne', 'bovina', 'patinho', 'moída', 'moida'],
      preparo: [],
      categorias: ['Carnes e derivados'],
      dica: 'Carne moída: veja cortes bovinos magros na TACO.',
    };
  }

  if (temAlgum('batata') && temAlgum('frit')) {
    return {
      termosNome: ['batata'],
      preparo: ['frita', 'frito'],
      categorias: ['Verduras, hortaliças e derivados', 'Alimentos preparados'],
      dica: 'Batata frita: busque batata ou preparações fritas na TACO.',
    };
  }

  if (temAlgum('ovo', 'omelete') && temAlgum('frit')) {
    return {
      termosNome: ['ovo'],
      preparo: ['frito', 'frita'],
      categorias: ['Ovos e derivados'],
      dica: 'Ovo frito: use ovo na TACO com preparo semelhante.',
    };
  }

  return null;
}
