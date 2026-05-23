import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { patientTheme } from '../../../temas/temaVisualPaciente';

const themes = { paciente: patientTheme, nutricionista: patientTheme };

export default function ScreenLoading({
  label = 'Carregando...',
  persona = 'paciente',
  style,
}) {
  const theme = themes[persona] || patientTheme;

  return (
    <View style={[styles.wrap, style]}>
      <ActivityIndicator size="large" color={theme.colors.primaryDark} />
      {label ? <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
  },
});
