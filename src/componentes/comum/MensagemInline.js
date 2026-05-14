import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../temas/temaVisualPaciente';

const tipoCor = {
  erro: { bg: '#FFF5F5', border: 'rgba(229, 9, 20, 0.25)', icon: 'alert-circle-outline', fg: '#B80710' },
  sucesso: { bg: '#F2FBF7', border: 'rgba(79, 223, 163, 0.45)', icon: 'checkmark-circle-outline', fg: '#0d6b4a' },
  aviso: { bg: '#FFFBF0', border: 'rgba(200, 160, 40, 0.35)', icon: 'information-circle-outline', fg: '#8a6d1d' },
};

export default function MensagemInline({
  tipo = 'aviso',
  texto,
  onFechar,
  autoOcultarMs = 0,
}) {
  useEffect(() => {
    if (!autoOcultarMs || !texto || !onFechar) return undefined;
    const t = setTimeout(onFechar, autoOcultarMs);
    return () => clearTimeout(t);
  }, [autoOcultarMs, texto, onFechar]);

  if (!texto) return null;

  const cores = tipoCor[tipo] || tipoCor.aviso;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: cores.bg, borderColor: cores.border },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={cores.icon} size={20} color={cores.fg} style={styles.icon} />
      <Text style={[styles.texto, { color: patientTheme.colors.text }]}>{texto}</Text>
      {onFechar ? (
        <TouchableOpacity
          onPress={onFechar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Fechar mensagem"
        >
          <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'solid',
        }
      : {}),
  },
  icon: {
    marginTop: 1,
  },
  texto: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
