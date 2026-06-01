/**
 * Tokens centrais do GlicNutri — fonte única para cores semânticas, tipografia e espaçamento.
 * Paciente e profissional compartilham a mesma paleta via temaVisualPaciente (nutri reexporta em temaVisualNutricionista).
 */

export const brand = {
  green: '#4FDFA3',
  greenDark: '#2F9D78',
  greenSoft: '#E8FFF5',
  slate: '#2F3438',
  slateMuted: '#5C6B75',
  border: '#D9E0E7',
  surface: '#F4F4F4',
  white: '#FFFFFF',
  warning: '#E8B84A',
  warningSoft: '#FFF8E8',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  info: '#5B8DEF',
  infoSoft: '#EEF4FF',
  success: '#4FDFA3',
  successSoft: '#E8FFF5',
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  subtitle: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16, letterSpacing: 0.3 },
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  screen: 20,
  card: 18,
};

export const radius = {
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

/** Status de consulta (inglês no banco → rótulos PT na UI) */
export const CONSULTA_STATUS = {
  scheduled: { label: 'Pendente', tone: 'warning' },
  confirmed: { label: 'Confirmada', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
  done: { label: 'Realizada', tone: 'info' },
  no_show: { label: 'Não compareceu', tone: 'danger' },
  rescheduled: { label: 'Reagendada', tone: 'info' },
};

export function getConsultaStatusMeta(status) {
  const key = String(status || 'scheduled')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (CONSULTA_STATUS[key]) return CONSULTA_STATUS[key];
  if (key.includes('cancel')) return CONSULTA_STATUS.cancelled;
  if (key.includes('confirm')) return CONSULTA_STATUS.confirmed;
  if (key.includes('realiz') || key.includes('done')) return CONSULTA_STATUS.done;
  if (key.includes('reagend')) return CONSULTA_STATUS.rescheduled;
  return CONSULTA_STATUS.scheduled;
}
