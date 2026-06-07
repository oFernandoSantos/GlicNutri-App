/**
 * Tema visual — Acesso Nutricionista (HealthTech / GlicNutri).
 */
import {
  nutriColors,
  nutriRadius,
  nutriShadow as nutriShadowTokens,
  nutriSpacing,
} from './designSystemNutricionista';

const MEDICO_BRAND = '#278EF5';
const MEDICO_BRAND_DARK = '#1D6FCC';
const MEDICO_BRAND_SOFT = '#E8F4FE';

const medicoColors = {
  background: nutriColors.background,
  backgroundSoft: nutriColors.backgroundSoft,
  surface: nutriColors.surface,
  surfaceMuted: nutriColors.surfaceMuted,
  primary: MEDICO_BRAND,
  primaryDark: MEDICO_BRAND_DARK,
  primaryActive: MEDICO_BRAND_DARK,
  primaryBorder: MEDICO_BRAND,
  primarySoft: MEDICO_BRAND_SOFT,
  primaryLight: MEDICO_BRAND_SOFT,
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
  successSoft: MEDICO_BRAND_SOFT,
  shadow: nutriColors.shadow,
  overlay: nutriColors.overlay,
  highlightSurface: nutriColors.surface,
  highlightBorder: nutriColors.border,
  actionPrimary: '#278EF5',
  actionPrimaryPressed: '#1D6FCC',
  actionPrimaryHover: '#2080E0',
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
  radius: nutriRadius,
  spacing: nutriSpacing,
  shadow: nutriShadowTokens.card,
};

export const medicoShadow = nutriShadowTokens.card;
