import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../temas/temaVisualPaciente';
import RegistroChatContextCard from './RegistroChatContextCard';

/**
 * Pré-visualização do registro antes de enviar (acima do campo de mensagem).
 */
export default function RegistroChatReplyPreview({ context, onDismiss }) {
  if (!context) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.accent} />
      <View style={styles.body}>
        <RegistroChatContextCard context={context} variant="preview" />
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Remover registro da resposta"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: patientTheme.colors.surface,
    borderTopColor: patientTheme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accent: {
    backgroundColor: patientTheme.colors.primary,
    width: 4,
  },
  body: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    padding: 4,
  },
});
