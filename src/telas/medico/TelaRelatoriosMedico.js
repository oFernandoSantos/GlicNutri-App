import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import { ScreenLoading } from '../../componentes/comum/ui';
import {
  AvatarBadge,
  DashboardKpiCard,
  KPI_ACCENTS,
  SectionCard,
  nutriDesktopStyles,
  dashboardKpiStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { medicoTheme as theme } from '../../temas/temaVisualNutricionista';
import {
  buildDoctorReportBundle,
  exportDoctorReportCsv,
  exportDoctorReportSummary,
  getMedicoId,
} from '../../servicos/servicoRelatoriosMedico';

function ExportCard({ icon, iconColor, title, helper, onPress, loading, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.exportCard, styles.flatCard, (loading || disabled) && styles.exportCardDisabled]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primaryDark} />
      ) : (
        <Ionicons name={icon} size={16} color={iconColor} />
      )}
      <Text style={styles.exportTitle}>{title}</Text>
      <Text style={styles.exportHelper}>{helper}</Text>
      <Ionicons name="download-outline" size={15} color={theme.colors.text} />
    </TouchableOpacity>
  );
}

export default function TelaRelatoriosMedico({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bundle, setBundle] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setBundle(await buildDoctorReportBundle(medicoId, usuarioLogado));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [medicoId, usuarioLogado]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const kpis = useMemo(
    () => [
      {
        id: 'patients',
        label: 'Pacientes',
        value: loading ? '—' : String(bundle?.totals?.patients ?? 0),
        icon: 'people-outline',
        accent: KPI_ACCENTS.blue,
      },
      {
        id: 'high-risk',
        label: 'Alto risco',
        value: loading ? '—' : String(bundle?.totals?.highRisk ?? 0),
        icon: 'alert-circle-outline',
        accent: KPI_ACCENTS.red,
      },
      {
        id: 'consultas',
        label: 'Consultas',
        value: loading ? '—' : String(bundle?.totals?.upcomingConsultas ?? 0),
        icon: 'calendar-outline',
        accent: theme.colors.primary,
      },
      {
        id: 'glucose',
        label: 'Média glicose',
        value: loading ? '—' : String(bundle?.totals?.avgPortfolioGlucose ?? '—'),
        icon: 'pulse-outline',
        accent: KPI_ACCENTS.orange,
      },
    ],
    [bundle, loading]
  );

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'MedicoRelatorios'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.primaryDark]}
        />
      }
    >
      {loading && !bundle ? (
        <ScreenLoading label="Carregando relatórios clínicos..." />
      ) : (
        <View style={nutriDesktopStyles.pageGap}>
          <View>
            <Text style={styles.pageTitle}>Relatórios clínicos</Text>
            <Text style={styles.pageSubtitle}>
              Diabetes, glicemia, medicação e exames da sua carteira.
            </Text>
          </View>

          <View style={dashboardKpiStyles.grid}>
            {kpis.map((item) => (
              <View key={item.id} style={dashboardKpiStyles.cell}>
                <DashboardKpiCard
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  accent={item.accent}
                />
              </View>
            ))}
          </View>

          <SectionCard>
            <Text style={styles.sectionTitle}>Exportar dados</Text>
            <Text style={styles.note}>
              Foco médico: diabetes, glicemia, medicação e exames. Alimentação detalhada permanece
              com o nutricionista.
            </Text>
            <View style={styles.exportGrid}>
              <ExportCard
                icon="document-text-outline"
                iconColor={theme.colors.primaryDark}
                title="CSV clínico"
                helper="Planilha com médias glicêmicas por paciente"
                onPress={() => exportDoctorReportCsv(bundle)}
                disabled={!bundle}
              />
              <ExportCard
                icon="reader-outline"
                iconColor={theme.colors.primaryDark}
                title="Resumo TXT"
                helper="Resumo consolidado da carteira"
                onPress={() => exportDoctorReportSummary(bundle)}
                disabled={!bundle}
              />
            </View>
          </SectionCard>

          <SectionCard>
            <Text style={styles.sectionTitle}>Pacientes recentes</Text>
            <Text style={styles.sectionHelper}>Média glicêmica e volume de leituras</Text>
            {(bundle?.patients || []).slice(0, 8).map((patient) => (
              <View key={patient.id} style={styles.patientRow}>
                <AvatarBadge name={patient.name} size={36} subtle theme={theme} />
                <View style={styles.patientCopy}>
                  <Text style={styles.rowName}>{patient.name}</Text>
                  <Text style={styles.rowMeta}>
                    Média {patient.avgGlucose ?? '—'} mg/dL · {patient.readingsCount} leituras
                  </Text>
                </View>
              </View>
            ))}
            {!bundle?.patients?.length ? (
              <Text style={styles.empty}>Nenhum paciente na carteira.</Text>
            ) : null}
          </SectionCard>

          <SectionCard>
            <Text style={styles.sectionTitle}>Próximas consultas</Text>
            {(bundle?.consultas || []).slice(0, 6).map((consulta) => (
              <View key={consulta.id} style={styles.consultaRow}>
                <Text style={styles.rowName}>{consulta.patientName}</Text>
                <Text style={styles.rowMeta}>
                  {consulta.when} · {consulta.status}
                </Text>
              </View>
            ))}
            {!bundle?.consultas?.length ? (
              <Text style={styles.empty}>Nenhuma consulta agendada.</Text>
            ) : null}
          </SectionCard>
        </View>
      )}
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  pageSubtitle: {
    marginTop: theme.spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  sectionHelper: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 10,
  },
  note: { color: theme.colors.textMuted, lineHeight: 18, fontSize: 13, marginBottom: 10 },
  flatCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
  },
  exportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  exportCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 160,
    padding: 14,
    gap: 6,
    minHeight: 96,
  },
  exportCardDisabled: {
    opacity: 0.6,
  },
  exportTitle: { fontWeight: '800', color: theme.colors.text, fontSize: 14 },
  exportHelper: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15, flex: 1 },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  patientCopy: { flex: 1, minWidth: 0 },
  consultaRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowName: { fontWeight: '900', color: theme.colors.text },
  rowMeta: { marginTop: 4, color: theme.colors.textMuted, fontSize: 12 },
  empty: { color: theme.colors.textMuted, marginTop: 8 },
});
