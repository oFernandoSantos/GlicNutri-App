import { Platform } from 'react-native';
import { brand, radius, spacing } from './designSystem';

/** Autocuidado diário — fundo claro, verde da marca, alertas com contraste WCAG-friendly. */
export const patientTheme = {
  colors: {
    background: brand.white,
    backgroundSoft: brand.white,
    surface: brand.surface,
    surfaceMuted: brand.white,
    primary: brand.green,
    primaryDark: brand.green,
    primarySoft: brand.greenSoft,
    surfaceBorder: brand.surface,
    onPrimary: brand.white,
    text: brand.slate,
    textMuted: brand.slateMuted,
    border: brand.border,
    warning: brand.warning,
    warningSoft: brand.warningSoft,
    info: brand.info,
    infoSoft: brand.infoSoft,
    danger: brand.danger,
    dangerSoft: brand.dangerSoft,
    success: brand.success,
    successSoft: brand.successSoft,
    shadow: 'rgba(79, 223, 163, 0)',
    overlay: 'rgba(29, 35, 43, 0.38)',
  },
  radius,
  spacing,
};

export const patientShadow = {
  ...(Platform.OS === 'web'
    ? {
        boxShadow: 'none',
      }
    : {
        elevation: 0,
        shadowColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
      }),
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};
