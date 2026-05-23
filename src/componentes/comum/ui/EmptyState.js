import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../../temas/temaVisualPaciente';
import AppCard from './AppCard';

const themes = { paciente: patientTheme, nutricionista: patientTheme };

export default function EmptyState({
  icon = 'document-text-outline',
  title = 'Nada por aqui ainda',
  message,
  persona = 'paciente',
  style,
}) {
  const theme = themes[persona] || patientTheme;

  return (
    <AppCard persona={persona} style={style}>
      <View style={styles.inner}>
        <Ionicons name={icon} size={32} color={theme.colors.textMuted} />
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        {message ? (
          <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
