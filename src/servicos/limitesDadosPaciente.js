/** Limites por contexto de tela — reduz payload e tempo de rede. */
export const LIMITES_DADOS_PACIENTE = {
  resumo: {
    homeOnly: true,
    skipChat: true,
    minimalProfile: true,
    allowGoogleSync: false,
    glucoseLimit: 48,
    medicationLimit: 0,
    mealLimit: 56,
    includeMealPlan: true,
    skipAlertSync: true,
    experienceCachePreset: 'home',
  },
  diario: {
    skipChat: true,
    glucoseLimit: 40,
    medicationLimit: 30,
    mealLimit: 56,
    includeMealPlan: true,
    skipAlertSync: true,
    experienceCachePreset: 'diario',
  },
  monitoramento: {
    skipChat: true,
    skipAlertSync: true,
    glucoseLimit: 60,
    medicationLimit: 24,
    mealLimit: 16,
    experienceCachePreset: 'monitoramento',
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
    experienceCachePreset: 'plano',
  },
  assistente: {
    skipChat: true,
    glucoseLimit: 20,
    medicationLimit: 16,
    mealLimit: 20,
    skipAlertSync: true,
    experienceCachePreset: 'assistente',
  },
  progresso: {
    skipChat: true,
    glucoseLimit: 60,
    medicationLimit: 40,
    mealLimit: 40,
    includeMealPlan: true,
    skipAlertSync: true,
    experienceCachePreset: 'progresso',
  },
  prontuario: {
    glucoseLimit: 500,
    medicationLimit: 500,
    mealLimit: 500,
    skipAlertSync: true,
    experienceCachePreset: 'prontuario',
  },
  relatorio: {
    glucoseLimit: 500,
    medicationLimit: 500,
    mealLimit: 500,
    skipAlertSync: true,
    historicoPreset: true,
    experienceCachePreset: 'relatorio',
  },
};

export function mesclarLimitesDadosPaciente(preset, extras = {}) {
  const base = LIMITES_DADOS_PACIENTE[preset] || {};
  return { ...base, ...extras };
}
