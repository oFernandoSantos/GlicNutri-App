import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientShadow, patientTheme } from '../theme/patientTheme';

export default function BotaoMenuHamburguer({
  onPress,
  disabled = false,
  loading = false,
  style,
  iconColor = patientTheme.colors.text,
  iconSize = 24,
  accessibilityLabel = 'Abrir menu',
}) {
  const bloqueado = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, bloqueado ? styles.disabled : null, style]}
      onPress={onPress}
      disabled={bloqueado}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name="menu-outline" size={iconSize} color={iconColor} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    width: 46,
    ...patientShadow,
  },
  disabled: {
    opacity: 0.6,
  },
});
