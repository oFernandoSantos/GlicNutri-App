import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { patientTheme } from '../../temas/temaVisualPaciente';

const OUTLINE = '#E8ECF0';

/**
 * Informações-chave para o paciente (valor, tipo, convênio/canal).
 * @param {{ label: string, value: string }[]} items
 */
export default function QuadroDetalhesPerfilProfissional({ items = [] }) {
  const visiveis = items.filter((item) => item?.label && item?.value != null);

  if (!visiveis.length) return null;

  return (
    <View style={styles.wrap}>
      {visiveis.map((item, index) => (
        <View
          key={item.label}
          style={[styles.cell, index < visiveis.length - 1 && styles.cellDivider]}
        >
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={styles.value} numberOfLines={2}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OUTLINE,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
    minHeight: 34,
    backgroundColor: '#FFFFFF',
  },
  cellDivider: {
    borderRightWidth: 1,
    borderRightColor: OUTLINE,
  },
  label: {
    color: patientTheme.colors.textMuted,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
  },
  value: {
    color: patientTheme.colors.text,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
    textAlign: 'center',
    width: '100%',
  },
});
