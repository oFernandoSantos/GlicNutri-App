import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import { nutriTheme as theme } from '../../temas/temaVisualNutricionista';
import { getMedicoId, listPatientsByDoctor } from '../../servicos/servicoVinculosMedico';
import { supabase } from '../../servicos/configSupabase';

export default function TelaInicioMedico({ navigation, route }) {
  const { usuarioLogado, onMedicoLogout } = route.params || {};
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [patientsCount, setPatientsCount] = useState(0);
  const [consultasFuturas, setConsultasFuturas] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const patients = await listPatientsByDoctor(medicoId);
      setPatientsCount(patients.length);

      const { count } = await supabase
        .from('consulta')
        .select('id', { count: 'exact', head: true })
        .eq('medico_id', medicoId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('scheduled_at', new Date().toISOString());

      setConsultasFuturas(count || 0);
    } catch {
      setPatientsCount(0);
    } finally {
      setLoading(false);
    }
  }, [medicoId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <LayoutMedico
      navigation={navigation}
      usuarioLogado={usuarioLogado}
      onLogout={onMedicoLogout}
      title="Início"
      subtitle="Dados clínicos: diabetes, glicose, medicação"
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primaryDark} />
      ) : (
        <View style={styles.content}>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pacientes vinculados</Text>
              <Text style={styles.statValue}>{patientsCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Consultas futuras</Text>
              <Text style={styles.statValue}>{consultasFuturas}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('MedicoPacientes', { usuarioLogado })}
          >
            <Ionicons name="people-outline" size={20} color={theme.colors.onPrimary} />
            <Text style={styles.primaryBtnText}>Ver pacientes</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Escopo médico: prontuário clínico, glicemia, insulina e medicação. Plano alimentar fica com o nutricionista.
          </Text>
        </View>
      )}
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing.screen, gap: 16 },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statLabel: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '700' },
  statValue: { marginTop: 8, fontSize: 28, fontWeight: '900', color: theme.colors.text },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primaryDark,
  },
  primaryBtnText: { color: theme.colors.onPrimary, fontWeight: '900' },
  hint: { color: theme.colors.textMuted, lineHeight: 20, fontSize: 13 },
});
