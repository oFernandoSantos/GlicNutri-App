/** Limites por contexto de tela — reduz payload e tempo de rede. */
export const LIMITES_DADOS_PACIENTE = {
  resumo: {
    glucoseLimit: 24,
    medicationLimit: 16,
    mealLimit: 16,
    skipAlertSync: true,
  },
  diario: {
    glucoseLimit: 40,
    medicationLimit: 30,
    mealLimit: 40,
    skipAlertSync: true,
  },
  monitoramento: {
    glucoseLimit: 120,
    medicationLimit: 80,
    mealLimit: 80,
  },
  historico: {
    glucoseLimit: 100,
    medicationLimit: 80,
    mealLimit: 100,
    skipAlertSync: true,
  },
  chat: {
    chatOnly: true,
    skipAlertSync: true,
  },
  plano: {
    glucoseLimit: 12,
    medicationLimit: 12,
    mealLimit: 24,
    skipAlertSync: true,
  },
  assistente: {
    glucoseLimit: 20,
    medicationLimit: 16,
    mealLimit: 20,
    skipAlertSync: true,
  },
  progresso: {
    glucoseLimit: 60,
    medicationLimit: 40,
    mealLimit: 40,
    skipAlertSync: true,
  },
  prontuario: {
    glucoseLimit: 80,
    medicationLimit: 60,
    mealLimit: 60,
    skipAlertSync: true,
  },
  relatorio: {
    glucoseLimit: 90,
    medicationLimit: 90,
    mealLimit: 40,
    skipAlertSync: true,
  },
};

export function mesclarLimitesDadosPaciente(preset, extras = {}) {
  const base = LIMITES_DADOS_PACIENTE[preset] || {};
  return { ...base, ...extras };
}
