import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getConsultaStatusMeta } from '../../../temas/designSystem';
import { patientTheme } from '../../../temas/temaVisualPaciente';

const toneColors = (theme) => ({
  success: { bg: theme.colors.successSoft, fg: theme.colors.primaryDark },
  warning: { bg: theme.colors.warningSoft, fg: '#8A6A1A' },
  danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger },
  info: { bg: theme.colors.infoSoft, fg: theme.colors.info },
  default: { bg: theme.colors.surface, fg: theme.colors.textMuted },
});

export default function ConsultaStatusBadge({ status, persona = 'paciente', style }) {
  const theme = patientTheme;
  const meta = getConsultaStatusMeta(status);
  const palette = toneColors(theme)[meta.tone] || toneColors(theme).default;

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.text, { color: palette.fg }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
