import React from 'react';
import { StyleSheet, View } from 'react-native';
import { patientTheme, patientShadow } from '../../../temas/temaVisualPaciente';

const personas = {
  paciente: { theme: patientTheme, shadow: patientShadow },
  nutricionista: { theme: patientTheme, shadow: patientShadow },
};

export default function AppCard({
  children,
  style,
  persona = 'paciente',
  padded = true,
  muted = false,
}) {
  const { theme, shadow } = personas[persona] || personas.paciente;

  return (
    <View
      style={[
        styles.card,
        shadow,
        {
          backgroundColor: muted ? theme.colors.backgroundSoft : theme.colors.surfaceMuted,
          borderRadius: theme.radius.xl,
          padding: padded ? theme.spacing.card : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
});
