/**
 * Portal profissional (nutricionista e medico) com visual neutro/claro.
 */
import { brand, radius, spacing } from './designSystem';

export const nutriTheme = {
  colors: {
    background: '#FFFFFF',
    backgroundSoft: '#F7F9FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F7F9FB',
    primary: brand.green,
    primaryDark: brand.greenDark,
    primarySoft: brand.greenSoft,
    surfaceBorder: '#D8E0E7',
    onPrimary: brand.white,
    text: brand.slate,
    textMuted: '#687780',
    border: '#D8E0E7',
    warning: brand.warning,
    warningSoft: '#FFF6DD',
    info: '#4D7FD8',
    infoSoft: '#EAF1FF',
    danger: brand.danger,
    dangerSoft: brand.dangerSoft,
    success: brand.greenDark,
    successSoft: brand.greenSoft,
    shadow: 'rgba(47, 157, 120, 0.12)',
    overlay: 'rgba(24, 34, 31, 0.26)',
  },
  radius,
  spacing,
};

export const nutriShadow = {
  elevation: 2,
  shadowColor: brand.greenDark,
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  borderWidth: 1,
  borderColor: '#D8E0E7',
};

export const medicoTheme = nutriTheme;

export const medicoShadow = nutriShadow;
