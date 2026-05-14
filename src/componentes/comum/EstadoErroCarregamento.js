import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../temas/temaVisualPaciente';

export default function EstadoErroCarregamento({
  titulo = 'Não foi possível carregar os dados',
  mensagem = 'Verifique sua conexão com a internet e tente novamente.',
  onTentarNovamente,
  loading,
}) {
  return (
    <View
      style={styles.wrap}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconCircle}>
        <Ionicons name="cloud-offline-outline" size={22} color={patientTheme.colors.primaryDark} />
      </View>
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.hint}>{mensagem}</Text>
      {onTentarNovamente ? (
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onTentarNovamente}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Ionicons name="refresh-outline" size={18} color={patientTheme.colors.onPrimary} />
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.18)',
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'solid',
        }
      : {}),
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 223, 163, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
    marginBottom: 6,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
    marginBottom: 14,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
});
