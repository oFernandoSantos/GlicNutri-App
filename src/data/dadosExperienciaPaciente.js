export const sparklineGlicose = [96, 101, 99, 103, 107, 104, 102, 105, 108, 106];

export const alertasAssistente = [
  {
    id: 'alerta-1',
    tag: 'Preditivo',
    titulo: 'Tendencia de queda suave',
    descricao:
      'Sua glicose esta descendo de forma continua. Se for treinar agora, deixe um carboidrato rapido por perto.',
  },
  {
    id: 'alerta-2',
    tag: 'Parabens',
    titulo: 'Meta de hidratacao quase completa',
    descricao:
      'Voce ja registrou boa parte da agua do dia. Mais alguns copos e fecha sua meta com folga.',
  },
  {
    id: 'alerta-3',
    tag: 'Plano',
    titulo: 'Lembrete do lanche da tarde',
    descricao:
      'Seu plano sugere fruta com gordura boa nas proximas horas para manter energia estavel.',
  },
];

export const perguntasRapidasAssistente = [
  'Posso comer uma maca agora?',
  'Meu cafe da manha foi equilibrado?',
  'Vale a pena caminhar agora?',
  'Como melhorar meu jantar de hoje?',
];

export const opcoesSintomas = [
  { id: 'disposto', label: 'Bem disposto', icone: 'sunny-outline' },
  { id: 'cansado', label: 'Cansado', icone: 'battery-dead-outline' },
  { id: 'tonto', label: 'Tonto', icone: 'sync-outline' },
  { id: 'com_sede', label: 'Com sede', icone: 'water-outline' },
  { id: 'ansioso', label: 'Ansioso', icone: 'pulse-outline' },
  { id: 'calmo', label: 'Calmo', icone: 'leaf-outline' },
];

export const opcoesSono = [
  { id: 'ruim', label: 'Ruim', helper: 'menos de 5h' },
  { id: 'regular', label: 'Regular', helper: 'sono interrompido' },
  { id: 'boa', label: 'Boa', helper: 'descanso ok' },
  { id: 'otima', label: 'Otima', helper: 'sono restaurador' },
];

export const opcoesEstresse = [
  { id: 1, label: 'Baixo' },
  { id: 2, label: 'Leve' },
  { id: 3, label: 'Moderado' },
  { id: 4, label: 'Alto' },
];

export const secoesPlanoAlimentar = [
  {
    id: 'cafe',
    titulo: 'Cafe da manha',
    horario: '07:00',
    objetivo: 'Energia estavel para comecar o dia.',
    alimentos: ['Iogurte natural', 'Aveia', 'Chia', 'Morangos'],
    substituicoes: [
      {
        ancora: 'Iogurte natural',
        opcoes: ['Kefir sem acucar', 'Iogurte vegetal sem acucar'],
      },
      {
        ancora: 'Aveia',
        opcoes: ['Farelo de aveia', 'Granola sem acucar'],
      },
    ],
  },
  {
    id: 'almoco',
    titulo: 'Almoco',
    horario: '12:30',
    objetivo: 'Saciedade com boa distribuicao de carboidratos.',
    alimentos: ['Arroz integral', 'Feijao', 'Frango grelhado', 'Salada colorida'],
    substituicoes: [
      {
        ancora: 'Arroz integral',
        opcoes: ['Quinoa cozida', 'Batata-doce assada'],
      },
      {
        ancora: 'Frango grelhado',
        opcoes: ['Peixe assado', 'Tofu grelhado'],
      },
    ],
  },
  {
    id: 'jantar',
    titulo: 'Jantar',
    horario: '19:30',
    objetivo: 'Fechar o dia com digestao leve.',
    alimentos: ['Sopa de legumes', 'Carne desfiada', 'Torradas integrais'],
    substituicoes: [
      {
        ancora: 'Torradas integrais',
        opcoes: ['Pao de fermentacao natural', 'Biscoito integral sem acucar'],
      },
    ],
  },
];

export const conversaNutricionistaPadrao = [
  {
    id: 'nutri-1',
    autor: 'Dra. Helena',
    papel: 'nutri',
    horario: '08:15',
    texto:
      'Bom dia! Vi que o cafe da manha ficou bem equilibrado. Continue priorizando fibras logo cedo.',
  },
  {
    id: 'user-1',
    autor: 'Voce',
    papel: 'user',
    horario: '09:02',
    texto: 'Perfeito. Posso trocar a aveia por granola sem acucar nos dias corridos?',
  },
];

export function obterMetaTendencia(valorGlicose) {
  if (valorGlicose >= 140) {
    return {
      icone: 'trending-up-outline',
      rotulo: 'Subindo',
      ajuda: 'Observe a proxima refeicao e priorize agua.',
    };
  }

  if (valorGlicose <= 80) {
    return {
      icone: 'trending-down-outline',
      rotulo: 'Caindo',
      ajuda: 'Vale monitorar a proxima hora com atencao.',
    };
  }

  return {
    icone: 'remove-outline',
    rotulo: 'Estavel',
    ajuda: 'Boa permanencia na faixa alvo.',
  };
}

export function construirInsightsInicio(valorGlicose, totalRefeicoes) {
  const mensagens = [
    'A combinacao de fibras na primeira refeicao esta ajudando a segurar a curva.',
    'Sua glicose respondeu bem apos a ultima refeicao principal.',
    'Hidratacao e caminhada curta podem reforcar a estabilidade do resto do dia.',
  ];

  if (valorGlicose >= 135) {
    mensagens[0] =
      'Sua glicose esta um pouco acima da meta. Prefira agua, movimento leve e uma proxima refeicao mais simples.';
  }

  if (totalRefeicoes === 0) {
    mensagens[1] =
      'Ainda nao encontramos refeicoes registradas hoje. Vale registrar o proximo prato para gerar leituras mais uteis.';
  }

  return mensagens.map((texto, indice) => ({
    id: `insight-${indice + 1}`,
    titulo:
      indice === 0 ? 'Leitura da IA' : indice === 1 ? 'Comportamento do dia' : 'Proximo passo',
    texto,
  }));
}

export function construirRespostaAssistente(pergunta, valorGlicose) {
  const texto = pergunta.trim().toLowerCase();

  if (texto.includes('maca')) {
    return `Com ${valorGlicose} mg/dL agora, uma maca pequena com castanhas tende a ser uma boa combinacao para manter a curva estavel.`;
  }

  if (texto.includes('caminh')) {
    return 'Uma caminhada leve de 15 a 20 minutos pode ajudar bastante neste momento. Leve agua e observe a resposta nas proximas leituras.';
  }

  if (texto.includes('jantar')) {
    return 'Para o jantar, prefira base de legumes, uma proteina magra e um carboidrato de menor impacto para fechar o dia sem pico rapido.';
  }

  if (texto.includes('cafe')) {
    return 'Seu cafe da manha fica mais equilibrado quando voce combina carboidrato com fibra e proteina. Iogurte, aveia, chia e fruta continuam sendo uma base segura.';
  }

  return `Com sua glicose atual em ${valorGlicose} mg/dL, a melhor decisao agora e manter a proxima refeicao equilibrada e observar a tendencia da proxima hora.`;
}

export const glucoseSparkline = sparklineGlicose;
export const aiAlerts = alertasAssistente;
export const assistantQuickQuestions = perguntasRapidasAssistente;
export const sleepOptions = [
  { id: 'poor', label: 'Ruim', helper: 'menos de 5h' },
  { id: 'ok', label: 'Regular', helper: 'sono interrompido' },
  { id: 'good', label: 'Boa', helper: '7h com despertares leves' },
  { id: 'great', label: 'Otima', helper: 'sono restaurador' },
];
export const stressOptions = opcoesEstresse;
export const mealPlanSections = secoesPlanoAlimentar;
export const nutritionistThread = conversaNutricionistaPadrao;
export const getTrendMeta = obterMetaTendencia;
export const buildHomeInsights = construirInsightsInicio;
export const buildAssistantReply = construirRespostaAssistente;
export const symptomOptions = [
  { id: 'tired', label: 'Cansado', icon: 'battery-dead-outline' },
  { id: 'dizzy', label: 'Tonto', icon: 'sync-outline' },
  { id: 'thirsty', label: 'Com sede', icon: 'water-outline' },
  { id: 'focused', label: 'Bem disposto', icon: 'sunny-outline' },
  { id: 'anxious', label: 'Ansioso', icon: 'pulse-outline' },
  { id: 'calm', label: 'Calmo', icon: 'leaf-outline' },
];
