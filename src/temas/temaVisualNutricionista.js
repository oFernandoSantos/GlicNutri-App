/**
 * Tema visual — Acesso Nutricionista (HealthTech / GlicNutri).
 */
import {
  nutriColors,
  nutriRadius,
  nutriShadow as nutriShadowTokens,
  nutriSpacing,
} from './designSystemNutricionista';

const medicoColors = {
  background: '#FFFFFF',
  backgroundSoft: '#F7F9FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9FB',
  primary: '#4FDFA3',
  primaryDark: '#2F9D78',
  primarySoft: '#E8FFF5',
  surfaceBorder: '#D8E0E7',
  onPrimary: '#FFFFFF',
  text: '#2F3438',
  textMuted: '#687780',
  border: '#D8E0E7',
  warning: '#E8B84A',
  warningSoft: '#FFF6DD',
  info: '#4D7FD8',
  infoSoft: '#EAF1FF',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  success: '#2F9D78',
  successSoft: '#E8FFF5',
  shadow: 'rgba(47, 157, 120, 0.12)',
  overlay: 'rgba(24, 34, 31, 0.26)',
};

export const nutriTheme = {
  colors: {
    background: nutriColors.background,
    backgroundSoft: nutriColors.backgroundSoft,
    surface: nutriColors.surface,
    surfaceMuted: nutriColors.surfaceMuted,
    primary: nutriColors.primary,
    primaryDark: nutriColors.primaryDark,
    primaryActive: nutriColors.primaryActive,
    primaryBorder: nutriColors.primaryBorder,
    primarySoft: nutriColors.primaryLight,
    primaryLight: nutriColors.primaryLight,
    surfaceBorder: nutriColors.border,
    onPrimary: nutriColors.onPrimary,
    text: nutriColors.textPrimary,
    textMuted: nutriColors.textSecondary,
    border: nutriColors.border,
    warning: nutriColors.warning,
    warningSoft: '#FFFBEB',
    info: nutriColors.info,
    infoSoft: '#E0F2FE',
    danger: nutriColors.danger,
    dangerSoft: '#FEE2E2',
    success: nutriColors.success,
    successSoft: nutriColors.primaryLight,
    shadow: nutriColors.shadow,
    overlay: nutriColors.overlay,
    highlightSurface: nutriColors.surface,
    highlightBorder: nutriColors.border,
  },
  radius: nutriRadius,
  spacing: nutriSpacing,
  shadow: nutriShadowTokens.card,
};

export const nutriShadow = nutriShadowTokens.card;

export const medicoTheme = {
  colors: medicoColors,
  radius: {
    md: 14,
    lg: 18,
    xl: 24,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    screen: 20,
    card: 18,
  },
};

export const medicoShadow = {
  elevation: 2,
  shadowColor: '#2F9D78',
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  borderWidth: 1,
  borderColor: '#D8E0E7',
};
