import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../temas/temaVisualPaciente';

/**
 * Cabeçalho padrão de modais do paciente — botão X sempre clicável (zIndex + hitSlop).
 */
export default function CabecalhoModalPaciente({
  title,
  subtitle,
  onClose,
  titleCentered = false,
  accessibilityLabel = 'Fechar',
}) {
  return (
    <View style={styles.header}>
      <View style={[styles.titleWrap, titleCentered && styles.titleWrapCentered]}>
        <Text
          style={[styles.title, titleCentered && styles.titleCentered]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, titleCentered && styles.subtitleCentered]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {typeof onClose === 'function' ? (
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const estilosCabecalhoModalPacienteLegado = StyleSheet.create({
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 36,
    position: 'relative',
  },
  modalTitle: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 44,
    textAlign: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 18,
    elevation: 4,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
    zIndex: 4,
  },
});

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 4,
    minHeight: 36,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  titleWrapCentered: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  titleCentered: {
    textAlign: 'center',
  },
  subtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  subtitleCentered: {
    textAlign: 'center',
  },
  closeBtn: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 18,
    elevation: 4,
    height: 36,
    justifyContent: 'center',
    width: 36,
    zIndex: 4,
  },
});
