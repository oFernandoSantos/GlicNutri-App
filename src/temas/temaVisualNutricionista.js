/**
 * Portal do nutricionista com visual neutro/claro.
 * Tema medico preserva acento antigo para nao impactar esse fluxo.
 */
import { brand, radius, spacing } from './designSystem';

export const nutriTheme = {
  colors: {
    background: '#FFFFFF',
    backgroundSoft: '#F7F9FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F7F9FB',
    primary: '#FFFFFF',
    primaryDark: '#24302C',
    primarySoft: '#F7F9FB',
    surfaceBorder: '#D8E0E7',
    onPrimary: brand.white,
    text: '#24302C',
    textMuted: '#687780',
    border: '#D8E0E7',
    warning: brand.warning,
    warningSoft: '#FFF6DD',
    info: '#4D7FD8',
    infoSoft: '#EAF1FF',
    danger: brand.danger,
    dangerSoft: '#FCECEC',
    success: '#24302C',
    successSoft: '#F3F6F8',
    shadow: 'rgba(36, 48, 44, 0.08)',
    overlay: 'rgba(24, 34, 31, 0.26)',
  },
  radius,
  spacing,
};

export const nutriShadow = {
  elevation: 2,
  shadowColor: '#24302C',
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  borderWidth: 1,
  borderColor: '#D8E0E7',
};

export const medicoTheme = {
  colors: {
    background: '#F3F7F5',
    backgroundSoft: '#EAF2EE',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF5F1',
    primary: brand.green,
    primaryDark: '#227E64',
    primarySoft: '#DFF8ED',
    surfaceBorder: '#DDE9E3',
    onPrimary: brand.white,
    text: '#24302C',
    textMuted: '#60726B',
    border: '#D6E3DD',
    warning: brand.warning,
    warningSoft: '#FFF6DD',
    info: '#4D7FD8',
    infoSoft: '#EAF1FF',
    danger: brand.danger,
    dangerSoft: '#FCECEC',
    success: '#2F9D78',
    successSoft: '#E2F7EC',
    shadow: 'rgba(36, 48, 44, 0.12)',
    overlay: 'rgba(24, 34, 31, 0.44)',
  },
  radius,
  spacing,
};

export const medicoShadow = {
  elevation: 2,
  shadowColor: '#24302C',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  borderWidth: 1,
  borderColor: '#DDE9E3',
};
