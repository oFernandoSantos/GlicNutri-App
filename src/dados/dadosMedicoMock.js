export const medicoQuickActions = [
  {
    id: 'agenda',
    title: 'Agenda',
    subtitle: 'Consultas e retornos clinicos',
    helper: 'Abra os atendimentos confirmados e os encaixes do dia.',
    icon: 'calendar-outline',
    route: 'MedicoAgenda',
  },
  {
    id: 'mensagens',
    title: 'Mensagens',
    subtitle: 'Orientacoes clinicas',
    helper: 'Responda pacientes sobre glicemia, medicacao e exames.',
    icon: 'chatbubbles-outline',
    route: 'MedicoMensagens',
  },
  {
    id: 'relatorios',
    title: 'Relatorios',
    subtitle: 'Indicadores da carteira',
    helper: 'Compare risco, glicemia e evolucao clinica.',
    icon: 'bar-chart-outline',
    route: 'MedicoRelatorios',
  },
];
