import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { medicoTheme as theme, medicoShadow as shadow } from '../../temas/temaVisualNutricionista';

export default function LayoutMedico({
  children,
  title,
  subtitle,
  usuarioLogado,
  onLogout,
  navigation,
}) {
  const name =
    usuarioLogado?.nome_completo_medico ||
    usuarioLogado?.nome ||
    'Médico';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Portal médico</Text>
          <Text style={styles.title}>{title || 'Pacientes'}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.user}>{name}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation?.navigate?.('MedicoPacientes')}
          >
            <Ionicons name="people-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          {onLogout ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.screen,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...shadow,
  },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 11, fontWeight: '800', color: theme.colors.info, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginTop: 4 },
  subtitle: { marginTop: 4, color: theme.colors.textMuted },
  user: { marginTop: 6, fontSize: 12, color: theme.colors.textMuted, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
});
