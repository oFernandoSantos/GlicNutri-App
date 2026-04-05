export const glucoseSparkline = [96, 101, 99, 103, 107, 104, 102, 105, 108, 106];

export const glucoseSeriesByRange = {
  Hoje: [
    { label: '06h', value: 94 },
    { label: '08h', value: 108, event: 'meal' },
    { label: '10h', value: 112 },
    { label: '12h', value: 104, event: 'water' },
    { label: '14h', value: 121, event: 'medication' },
    { label: '16h', value: 110 },
    { label: '18h', value: 115, event: 'activity' },
    { label: '20h', value: 102 },
  ],
  '7 dias': [
    { label: 'Seg', value: 111 },
    { label: 'Ter', value: 108, event: 'meal' },
    { label: 'Qua', value: 114 },
    { label: 'Qui', value: 106, event: 'activity' },
    { label: 'Sex', value: 117, event: 'medication' },
    { label: 'Sab', value: 110 },
    { label: 'Dom', value: 104, event: 'sleep' },
  ],
  '14 dias': [
    { label: 'D1', value: 112 },
    { label: 'D2', value: 116 },
    { label: 'D3', value: 108, event: 'meal' },
    { label: 'D4', value: 110 },
    { label: 'D5', value: 103, event: 'activity' },
    { label: 'D6', value: 106 },
    { label: 'D7', value: 113 },
    { label: 'D8', value: 118, event: 'medication' },
    { label: 'D9', value: 109 },
    { label: 'D10', value: 105 },
    { label: 'D11', value: 101 },
    { label: 'D12', value: 107, event: 'sleep' },
    { label: 'D13', value: 111 },
    { label: 'D14', value: 104 },
  ],
};

export const dailyTimelineEntries = [
  {
    id: 'meal-1',
    time: '07:20',
    kind: 'meal',
    title: 'Cafe da manha',
    description: 'Iogurte natural, aveia, chia e morangos.',
    glucoseNote: 'Impacto glicemico baixo',
    glucoseDelta: '+12 mg/dL',
    aiNote: 'Boa combinacao de fibras e proteina para segurar a curva.',
  },
  {
    id: 'water-1',
    time: '09:10',
    kind: 'water',
    title: 'Hidratacao',
    description: '2 copos de agua registrados.',
    glucoseNote: 'Rotina mantida',
    glucoseDelta: 'Estavel',
    aiNote: 'Seu ritmo de hidratacao esta consistente hoje.',
  },
  {
    id: 'meal-2',
    time: '12:40',
    kind: 'meal',
    title: 'Almoco',
    description: 'Arroz integral, feijao, frango grelhado e salada.',
    glucoseNote: 'Pico leve',
    glucoseDelta: '+18 mg/dL',
    aiNote: 'A curva subiu pouco e voltou rapido para a meta.',
  },
  {
    id: 'activity-1',
    time: '17:30',
    kind: 'activity',
    title: 'Caminhada',
    description: '25 minutos de caminhada em ritmo moderado.',
    glucoseNote: 'Queda suave',
    glucoseDelta: '-10 mg/dL',
    aiNote: 'Boa resposta metabolica apos atividade leve.',
  },
  {
    id: 'meal-3',
    time: '20:00',
    kind: 'meal',
    title: 'Jantar',
    description: 'Sopa de legumes com carne desfiada e torradas integrais.',
    glucoseNote: 'Resposta estavel',
    glucoseDelta: '+9 mg/dL',
    aiNote: 'Excelente escolha para o periodo noturno.',
  },
];

export const aiAlerts = [
  {
    id: 'alert-1',
    tag: 'Preditivo',
    title: 'Tendencia de queda suave',
    description:
      'Sua glicose esta caindo de forma continua. Se for treinar agora, leve um carboidrato rapido por perto.',
  },
  {
    id: 'alert-2',
    tag: 'Parabens',
    title: 'Meta de hidratacao quase completa',
    description:
      'Voce ja chegou a 6 copos hoje. Mais dois copos e fecha sua meta diaria.',
  },
  {
    id: 'alert-3',
    tag: 'Plano',
    title: 'Lembrete de lanche da tarde',
    description:
      'Seu plano sugere um lanche com fruta e castanhas nas proximas 30 minutos.',
  },
];

export const assistantQuickQuestions = [
  'Posso comer uma maca agora?',
  'Meu cafe da manha foi equilibrado?',
  'Vale a pena caminhar agora?',
  'Como melhorar meu jantar de hoje?',
];

export const symptomOptions = [
  { id: 'tired', label: 'Cansado', emoji: '😴' },
  { id: 'dizzy', label: 'Tonto', emoji: '😵' },
  { id: 'thirsty', label: 'Com sede', emoji: '🥤' },
  { id: 'focused', label: 'Bem disposto', emoji: '🙂' },
  { id: 'anxious', label: 'Ansioso', emoji: '😟' },
  { id: 'calm', label: 'Calmo', emoji: '🫶' },
];

export const sleepOptions = [
  { id: 'poor', label: 'Ruim', helper: 'menos de 5h' },
  { id: 'ok', label: 'Regular', helper: 'sono interrompido' },
  { id: 'good', label: 'Boa', helper: '7h com despertares leves' },
  { id: 'great', label: 'Otima', helper: 'sono restaurador' },
];

export const stressOptions = [
  { id: 1, label: 'Baixo' },
  { id: 2, label: 'Leve' },
  { id: 3, label: 'Moderado' },
  { id: 4, label: 'Alto' },
];

export const mealPlanSections = [
  {
    id: 'breakfast',
    title: 'Cafe da manha',
    time: '07:00',
    objective: 'Comecar o dia com energia estavel.',
    foods: ['Iogurte natural', 'Aveia', 'Chia', 'Morangos'],
    substitutions: [
      {
        anchor: 'Iogurte natural',
        options: ['Kefir sem acucar', 'Leite fermentado sem adicao de acucar'],
      },
      {
        anchor: 'Aveia',
        options: ['Farelo de aveia', 'Granola sem acucar'],
      },
    ],
  },
  {
    id: 'lunch',
    title: 'Almoco',
    time: '12:30',
    objective: 'Garantir saciedade com boa distribuicao de carboidratos.',
    foods: ['Arroz integral', 'Feijao', 'Frango grelhado', 'Salada colorida'],
    substitutions: [
      {
        anchor: 'Arroz integral',
        options: ['Quinoa cozida', 'Batata-doce assada'],
      },
      {
        anchor: 'Frango grelhado',
        options: ['Peixe assado', 'Tofu grelhado'],
      },
    ],
  },
  {
    id: 'dinner',
    title: 'Jantar',
    time: '19:30',
    objective: 'Fechar o dia com digestao leve.',
    foods: ['Sopa de legumes', 'Carne desfiada', 'Torradas integrais'],
    substitutions: [
      {
        anchor: 'Torradas integrais',
        options: ['Pao de fermentacao natural', 'Biscoito integral sem acucar'],
      },
    ],
  },
];

export const nutritionistThread = [
  {
    id: 'nutri-1',
    author: 'Dra. Helena',
    role: 'nutri',
    time: '08:15',
    text: 'Bom dia! Vi que o cafe da manha ficou bem equilibrado. Continue priorizando fibras pela manha.',
  },
  {
    id: 'user-1',
    author: 'Voce',
    role: 'user',
    time: '09:02',
    text: 'Perfeito. Posso trocar a aveia por granola sem acucar nos dias corridos?',
  },
];

export function getTrendMeta(glucoseValue) {
  if (glucoseValue >= 140) {
    return {
      icon: 'trending-up-outline',
      label: 'Subindo',
      tone: 'warning',
      helper: 'Observe a proxima refeicao.',
    };
  }

  if (glucoseValue <= 80) {
    return {
      icon: 'trending-down-outline',
      label: 'Caindo',
      tone: 'info',
      helper: 'Vale monitorar a proxima hora.',
    };
  }

  return {
    icon: 'remove-outline',
    label: 'Estavel',
    tone: 'success',
    helper: 'Boa permanencia em faixa alvo.',
  };
}

export function buildHomeInsights(glucoseValue, mealCount) {
  const insights = [
    'A combinacao de fibras no cafe da manha ajudou a manter a curva suave.',
    'Sua glicose respondeu bem apos a ultima refeicao principal.',
    'Hidratacao e caminhada curta podem reforcar a estabilidade do resto do dia.',
  ];

  if (glucoseValue >= 135) {
    insights[0] =
      'Sua glicose esta um pouco acima da meta. Priorize agua e uma refeicao leve no proximo horario.';
  }

  if (mealCount === 0) {
    insights[1] =
      'Ainda nao encontramos refeicoes registradas hoje. Vale registrar o proximo prato para gerar insights mais precisos.';
  }

  return insights.map((text, index) => ({
    id: `insight-${index + 1}`,
    title: index === 0 ? 'IA Nutricional' : index === 1 ? 'Leitura do Dia' : 'Proximo Passo',
    text,
  }));
}

export function buildAssistantReply(question, glucoseValue) {
  const text = question.trim().toLowerCase();

  if (text.includes('maca')) {
    return `Com ${glucoseValue} mg/dL agora, uma maca pequena com castanhas e uma boa opcao para manter a curva estavel.`;
  }

  if (text.includes('caminh')) {
    return `Uma caminhada leve de 15 a 20 minutos tende a ajudar bastante neste momento. Leve agua e observe sua resposta nas proximas leituras.`;
  }

  if (text.includes('jantar')) {
    return 'Para o jantar, prefira base de legumes, uma proteina magra e um carboidrato de menor impacto para fechar o dia sem pico rapido.';
  }

  if (text.includes('cafe')) {
    return 'Seu cafe da manha fica melhor quando voce combina carboidrato com fibra e proteina. Iogurte, aveia, chia e fruta continuam sendo uma base segura.';
  }

  return `Com sua glicose atual em ${glucoseValue} mg/dL, a melhor decisao agora e manter a proxima refeicao equilibrada e observar a tendencia da proxima hora.`;
}
