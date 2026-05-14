/**
 * Padrões alimentares frequentemente discutidos em diabetes (tipo 2) e educação nutricional.
 * Referências gerais: American Diabetes Association — Standards of Care (terapia nutricional);
 * Estrategias como prato do diabetes (ADA/plate); contagem de carboidratos (DCCT legacy / educação em diabetes).
 * Estes textos são informativos: decisão clínica e individualização ficam com o nutricionista.
 */
export const DIETAS_REFERENCIA_NUTRICIONAL = [
  {
    id: 'mediterranea',
    titulo: 'Padrão mediterrânico',
    resumo:
      'Ênfase em vegetais, leguminosas, frutas integrais, azeite, peixes e cereais integrais; carnes processadas reduzidas.',
    quandoConsiderar:
      'Bom perfil para controle glicêmico e fatores cardiometabólicos; costuma ser bem tolerado socialmente.',
    refs: 'ADA Standards of Care — Medical Nutrition Therapy; revisões sobre padrão mediterrânico em diabetes.',
  },
  {
    id: 'dash',
    titulo: 'Padrão DASH',
    resumo:
      'Rico em frutas, vegetais, laticínios com baixo teor de gordura e redução de sódio; útil quando há hipertensão associada.',
    quandoConsiderar:
      'Paciente com foco em pressão arterial e qualidade alimentar global, alinhado ao plano terapêutico.',
    refs: 'Programa DASH (NIH); diretrizes de hipertensão e nutrição em diabetes.',
  },
  {
    id: 'prato_metodo',
    titulo: 'Método do prato / prato do diabetes',
    resumo:
      'Distribuição visual: metade prato de vegetais não amiláceos, quarto proteína magra, quarto carboidrato.',
    quandoConsiderar:
      'Boa porta de entrada para quem não quer pesar alimentos; complementa educação em porções.',
    refs: 'Materiais ADA sobre Diabetes Plate Method.',
  },
  {
    id: 'contagem_carboidratos',
    titulo: 'Contagem / planejamento de carboidratos',
    resumo:
      'Distribuição planejada de gramas de carboidrato nas refeições e lanches, alinhada a insulina e metas glicêmicas.',
    quandoConsiderar:
      'Paciente com insulinoterapia ou variabilidade glicêmica ligada à carga de carboidratos.',
    refs: 'Educação em diabetes — planejamento de carboidratos (tradição DCCT / curriculos de diabetes).',
  },
  {
    id: 'baixo_carboidrato_moderado',
    titulo: 'Redução moderada de carboidratos',
    resumo:
      'Limitação moderada de carboidratos totais (definição operacional definida pelo nutricionista), com monitorização.',
    quandoConsiderar:
      'Apenas com acompanhamento profissional; avaliar medicamentos (ex.: insulina/sulfonilureias) e risco de hipoglicemia.',
    refs: 'ADA — posicionamento sobre padrões lower carbohydrate em contexto supervisionado.',
  },
  {
    id: 'vegetariana_flexivel',
    titulo: 'Ênfase vegetal / flexitariana',
    resumo:
      'Prioriza vegetais, leguminosas e integrais; proteína animal opcional e em menor frequência.',
    quandoConsiderar:
      'Aderência a padrões vegetais ricos em fibra e densidade nutricional.',
    refs: 'Diretrizes de padrões plant-based em prevenção e manejo de diabetes (visão geral).',
  },
  {
    id: 'distribuicao_horarios',
    titulo: 'Distribuição ao longo do dia',
    resumo:
      'Regularidade de horários e distribuição de carboidratos entre refeições para suavizar picos glicêmicos.',
    quandoConsiderar:
      'Paciente com picos pós-prandiais ou jejuns longos seguidos de refeições muito grandes.',
    refs: 'Consensos de terapia nutricional em diabetes (timing e distribuição).',
  },
];

export function getDietaById(id) {
  return DIETAS_REFERENCIA_NUTRICIONAL.find((d) => d.id === id) || null;
}
