export const nutritionistDashboardData = {
  indicators: [
    { id: 'total', label: 'Total Pacientes', value: '4', icon: 'people-outline' },
    { id: 'risk', label: 'Alto Risco', value: '1', icon: 'warning-outline' },
    { id: 'alerts', label: 'Alertas Ativos', value: '6', icon: 'notifications-outline' },
    { id: 'adherence', label: 'Adesao Media', value: '77%', icon: 'trending-up-outline' },
  ],
  shortcuts: [
    {
      id: 'agenda',
      title: 'Agenda',
      subtitle: '0 consultas hoje',
      helper: 'Planeje retornos e encaixes',
      icon: 'calendar-outline',
      route: 'NutricionistaAgenda',
    },
    {
      id: 'mensagens',
      title: 'Mensagens',
      subtitle: '2 novas mensagens',
      helper: 'Centralize conversas recentes',
      icon: 'chatbubbles-outline',
      route: 'NutricionistaMensagens',
    },
    {
      id: 'relatorios',
      title: 'Relatorios',
      subtitle: 'Consolidado da carteira',
      helper: 'Gerar relatorios consolidados',
      icon: 'bar-chart-outline',
      route: 'NutricionistaRelatorios',
    },
  ],
  priorityPatient: {
    id: 'maria-silva',
    name: 'Maria Silva',
    risk: 'Alto Risco',
    alerts: 3,
    adherence: '65%',
    updatedAt: '08:30',
    age: 45,
  },
  recentUpdates: [
    {
      id: 'maria-silva',
      name: 'Maria Silva',
      risk: 'Alto Risco',
      alerts: 3,
      age: 45,
      adherence: '65%',
      updatedAt: '08:30',
    },
    {
      id: 'joao-santos',
      name: 'Joao Santos',
      risk: 'Baixo Risco',
      alerts: 0,
      age: 32,
      adherence: '92%',
      updatedAt: '09:10',
    },
    {
      id: 'ana-costa',
      name: 'Ana Costa',
      risk: 'Medio Risco',
      alerts: 1,
      age: 38,
      adherence: '81%',
      updatedAt: '10:05',
    },
  ],
};

export const nutritionistSectionContent = {
  NutricionistaAgenda: {
    title: 'Agenda',
    subtitle: 'Visualize retornos, encaixes e proximos atendimentos do dia.',
    heroValue: '0 consultas hoje',
    heroLabel: 'Agenda clinica',
    bullets: [
      'Nenhuma consulta marcada para hoje.',
      'Organize retornos por prioridade clinica.',
      'Abra a agenda completa para novos encaixes.',
    ],
  },
  NutricionistaMensagens: {
    title: 'Mensagens',
    subtitle: 'Acompanhe as conversas recentes e responda pacientes com rapidez.',
    heroValue: '2 novas mensagens',
    heroLabel: 'Comunicacao ativa',
    bullets: [
      '2 conversas aguardando resposta.',
      'Mensagens recentes destacam pacientes prioritarios.',
      'Use este painel para centralizar follow-ups.',
    ],
  },
  NutricionistaRelatorios: {
    title: 'Relatorios',
    subtitle: 'Gere visoes consolidadas da carteira e acompanhe indicadores-chave.',
    heroValue: 'Relatorio consolidado',
    heroLabel: 'Analise da carteira',
    bullets: [
      'Adesao media atual em 77%.',
      '6 alertas ativos exigem acompanhamento.',
      'Exporte visoes clinicas para rotina da equipe.',
    ],
  },
};
