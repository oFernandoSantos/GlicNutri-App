/** Limites por contexto de tela — reduz payload e tempo de rede. */
export const LIMITES_DADOS_PACIENTE = {
  resumo: {
    homeOnly: true,
    skipChat: true,
    minimalProfile: true,
    allowGoogleSync: false,
    glucoseLimit: 7,
    medicationLimit: 0,
    mealLimit: 12,
    includeMealPlan: true,
    skipAlertSync: true,
  },
  diario: {
    skipChat: true,
    glucoseLimit: 40,
    medicationLimit: 30,
    mealLimit: 40,
    includeMealPlan: true,
    skipAlertSync: true,
  },
  monitoramento: {
    skipChat: true,
    skipAlertSync: true,
    glucoseLimit: 60,
    medicationLimit: 40,
    mealLimit: 30,
  },
  historico: {
    glucoseLimit: 100,
    medicationLimit: 80,
    mealLimit: 100,
    skipAlertSync: true,
    historicoPreset: true,
  },
  chat: {
    chatOnly: true,
    skipAlertSync: true,
  },
  plano: {
    planOnly: true,
    skipChat: true,
    minimalProfile: true,
    allowGoogleSync: false,
    glucoseLimit: 0,
    medicationLimit: 0,
    mealLimit: 32,
    skipAlertSync: true,
  },
  assistente: {
    skipChat: true,
    glucoseLimit: 20,
    medicationLimit: 16,
    mealLimit: 20,
    skipAlertSync: true,
  },
  progresso: {
    skipChat: true,
    glucoseLimit: 60,
    medicationLimit: 40,
    mealLimit: 40,
    includeMealPlan: true,
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
