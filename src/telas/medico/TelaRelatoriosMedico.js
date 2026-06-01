import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import { medicoTheme as theme } from '../../temas/temaVisualNutricionista';
import {
  buildDoctorReportBundle,
  exportDoctorReportCsv,
  exportDoctorReportSummary,
  getMedicoId,
} from '../../servicos/servicoRelatoriosMedico';

export default function TelaRelatoriosMedico({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bundle, setBundle] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setBundle(await buildDoctorReportBundle(medicoId, usuarioLogado));
    } finally {
      setLoading(false);
    }
  }, [medicoId, usuarioLogado]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'MedicoRelatorios'}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primaryDark} />
      ) : (
        <View style={styles.wrap}>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Pacientes</Text>
              <Text style={styles.metricValue}>{bundle?.totals?.patients ?? 0}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Alto risco</Text>
              <Text style={[styles.metricValue, { color: theme.colors.danger }]}>
                {bundle?.totals?.highRisk ?? 0}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Consultas</Text>
              <Text style={styles.metricValue}>{bundle?.totals?.upcomingConsultas ?? 0}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Média glicose</Text>
              <Text style={styles.metricValue}>{bundle?.totals?.avgPortfolioGlucose ?? '—'}</Text>
            </View>
          </View>

          <Text style={styles.note}>
            Foco médico: diabetes, glicemia, medicação e exames. Alimentação detalhada permanece com o nutricionista.
          </Text>

          <TouchableOpacity style={styles.exportBtn} onPress={() => exportDoctorReportCsv(bundle)}>
            <Ionicons name="download-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.exportText}>Exportar CSV clínico</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={() => exportDoctorReportSummary(bundle)}>
            <Ionicons name="document-text-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.exportText}>Exportar resumo TXT</Text>
          </TouchableOpacity>

          {(bundle?.patients || []).slice(0, 8).map((p) => (
            <View key={p.id} style={styles.row}>
              <Text style={styles.rowName}>{p.name}</Text>
              <Text style={styles.rowMeta}>
                Média {p.avgGlucose ?? '—'} mg/dL · {p.readingsCount} leituras
              </Text>
            </View>
          ))}
        </View>
      )}
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingBottom: 24 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  metricLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted },
  metricValue: { marginTop: 6, fontSize: 22, fontWeight: '900', color: theme.colors.text },
  note: { color: theme.colors.textMuted, lineHeight: 18, fontSize: 13 },
  exportBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: theme.colors.backgroundSoft, borderWidth: 1, borderColor: theme.colors.border },
  exportText: { fontWeight: '800', color: theme.colors.text },
  row: { padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  rowName: { fontWeight: '900', color: theme.colors.text },
  rowMeta: { marginTop: 4, color: theme.colors.textMuted, fontSize: 12 },
});
