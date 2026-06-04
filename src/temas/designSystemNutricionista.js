/**
 * Design System — Acesso Nutricionista (somente tokens visuais).
 * Verde de marca alinhado ao acesso paciente (designSystem.brand).
 */
import { brand } from './designSystem';

/** Verde GlicNutri — RGB para PDF/gráficos (#4FDFA3) */
export const nutriGreenRgb = [79, 223, 163];
/** Hover / ênfase (#2F9D78) */
export const nutriGreenRgbDark = [47, 157, 120];
/** Borda / destaque suave */
export const nutriGreenRgbLight = [143, 230, 195];

export const nutriColors = {
  primary: brand.green,
  primaryDark: brand.greenDark,
  primaryActive: brand.greenDark,
  primaryLight: brand.greenSoft,
  primaryBorder: brand.green,
  success: brand.success,
  info: brand.info,
  warning: brand.warning,
  danger: brand.danger,
  background: '#F8FAFC',
  backgroundSoft: '#F1F5F9',
  surface: brand.white,
  surfaceMuted: '#F8FAFC',
  border: brand.border,
  textPrimary: brand.slate,
  textSecondary: brand.slateMuted,
  onPrimary: brand.white,
  overlay: 'rgba(29, 35, 43, 0.38)',
  shadow: 'rgba(79, 223, 163, 0.08)',
};

/** Alertas clínicos: verde / amarelo / vermelho / azul */
export const nutriClinicalStatus = {
  normal: {
    bg: brand.greenSoft,
    border: brand.green,
    text: brand.greenDark,
    icon: brand.success,
  },
  attention: {
    bg: '#FEF3C7',
    border: '#FCD34D',
    text: '#B45309',
    icon: nutriColors.warning,
  },
  critical: {
    bg: '#FEE2E2',
    border: '#FECACA',
    text: '#B91C1C',
    icon: nutriColors.danger,
  },
  info: {
    bg: brand.infoSoft,
    border: brand.info,
    text: '#0369A1',
    icon: nutriColors.info,
  },
};

export const nutriSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screen: 16,
  card: 16,
};

export const nutriRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
  card: 16,
  pill: 999,
};

export const nutriTypography = {
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: nutriColors.textPrimary },
  h2: { fontSize: 22, fontWeight: '700', lineHeight: 28, color: nutriColors.textPrimary },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24, color: nutriColors.textPrimary },
  subtitle: { fontSize: 15, fontWeight: '600', lineHeight: 22, color: nutriColors.textPrimary },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: nutriColors.textPrimary },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: nutriColors.textSecondary },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16, color: nutriColors.textSecondary },
};

export const nutriShadow = {
  card: {
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: nutriColors.border,
  },
  sm: {
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
};

export const nutriKpiAccents = {
  blue: nutriColors.info,
  green: nutriColors.primary,
  greenBright: nutriColors.primary,
  orange: '#F97316',
  red: nutriColors.danger,
  pink: '#EC4899',
  purple: '#8B5CF6',
  gray: '#94A3B8',
  yellow: nutriColors.warning,
};
