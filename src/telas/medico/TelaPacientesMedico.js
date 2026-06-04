import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import {
  AvatarBadge,
  SearchInput,
  SectionCard,
  nutriDesktopStyles,
  dashboardKpiStyles,
  DashboardKpiCard,
  KPI_ACCENTS,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  getMedicoId,
  listPatientsByDoctor,
} from '../../servicos/servicoVinculosMedico';
import { medicoTheme as patientTheme } from '../../temas/temaVisualNutricionista';

function getRiskMeta(patient) {
  const risk = String(patient?.risk || '').toLowerCase();
  if (risk.includes('alto')) {
    return {
      label: 'Alto Risco',
      badgeStyle: styles.riskBadgeHigh,
      badgeTextStyle: styles.riskBadgeTextHigh,
    };
  }
  if (risk.includes('moderado') || risk.includes('medio')) {
    return {
      label: 'Médio Risco',
      badgeStyle: styles.riskBadgeMedium,
      badgeTextStyle: styles.riskBadgeTextMedium,
    };
  }
  return {
    label: 'Baixo Risco',
    badgeStyle: styles.riskBadgeLow,
    badgeTextStyle: styles.riskBadgeTextLow,
  };
}

const FILTER_ORDER = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Diabetes', label: 'Diabetes' },
  { value: 'Emagrecimento', label: 'Emagrecimento' },
  { value: 'Ganho de Massa', label: 'Ganho de Massa' },
  { value: 'Reeducacao', label: 'Reeducação Alimentar' },
  { value: 'Prioritarios', label: 'Prioritários' },
];

export default function MedicoPacientesStyled({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const items = await listPatientsByDoctor(medicoId);
      setPatients(items || []);
    } catch (error) {
      console.log('Erro ao carregar pacientes vinculados:', error);
      setLoadError('Nao foi possivel carregar os pacientes vinculados.');
    } finally {
      setLoading(false);
    }
  }, [medicoId]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadPatients);
    return unsubscribe;
  }, [navigation, loadPatients]);

  const filteredPatients = useMemo(() => {
    const normalized = String(search || '').toLowerCase().trim();

    return patients.filter((patient) => {
      const matchesSearch =
        !normalized ||
        [patient.name, patient.specialtyTag, patient.objective, patient.notes]
          .some((field) => String(field || '').toLowerCase().includes(normalized));

      const matchesFilter =
        activeFilter === 'Todos' ||
        (activeFilter === 'Diabetes' && patient.objective === 'Diabetes') ||
        (activeFilter === 'Emagrecimento' && patient.objective === 'Emagrecimento') ||
        (activeFilter === 'Ganho de Massa' && patient.objective === 'Ganho de Massa') ||
        (activeFilter === 'Reeducacao' && patient.objective === 'Reeducacao') ||
        (activeFilter === 'Prioritarios' && (patient.risk === 'Alto' || Number(patient.alerts || 0) > 0));

      return matchesSearch && matchesFilter;
    });
  }, [patients, search, activeFilter]);

  const summary = useMemo(() => {
    const total = patients.length;
    const highRisk = patients.filter((item) => item.risk === 'Alto').length;
    const withAlerts = patients.filter((item) => Number(item.alerts || 0) > 0).length;
    const avgAdherence = total
      ? Math.round(patients.reduce((sum, item) => sum + Number(item.adherence || 0), 0) / total)
      : 0;

    return [
      { id: 'total', label: 'Total Pacientes', value: String(total), icon: 'people-outline', accent: KPI_ACCENTS.blue },
      { id: 'high-risk', label: 'Alto Risco', value: String(highRisk), icon: 'alert-circle-outline', accent: KPI_ACCENTS.red },
      { id: 'adherence', label: 'Adesão Média', value: `${avgAdherence}%`, icon: 'trending-up-outline', accent: KPI_ACCENTS.green },
      { id: 'alerts', label: 'Alertas Ativos', value: String(withAlerts), icon: 'notifications-outline', accent: KPI_ACCENTS.yellow },
    ];
  }, [patients]);

  const filterItems = useMemo(() => {
    const total = patients.length;
    const diabetes = patients.filter((patient) => patient.objective === 'Diabetes').length;
    const emagrecimento = patients.filter((patient) => patient.objective === 'Emagrecimento').length;
    const ganho = patients.filter((patient) => patient.objective === 'Ganho de Massa').length;
    const reeducacao = patients.filter((patient) => patient.objective === 'Reeducacao').length;
    const prioritarios = patients.filter(
      (patient) => patient.risk === 'Alto' || Number(patient.alerts || 0) > 0
    ).length;

    return FILTER_ORDER.map((item) => {
      const count =
        item.value === 'Todos'
          ? total
          : item.value === 'Diabetes'
            ? diabetes
            : item.value === 'Emagrecimento'
              ? emagrecimento
              : item.value === 'Ganho de Massa'
                ? ganho
                : item.value === 'Reeducacao'
                  ? reeducacao
                  : prioritarios;

      return {
        ...item,
        fullLabel: `${item.label} (${count})`,
      };
    });
  }, [patients]);

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'MedicoPacientes'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <SectionCard style={styles.searchCard}>
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar paciente por nome..."
          />
        </SectionCard>

        <View style={dashboardKpiStyles.grid}>
          {summary.map((item) => (
            <View key={item.id} style={dashboardKpiStyles.cell}>
              <DashboardKpiCard
                icon={item.icon}
                accent={item.accent}
                label={item.label}
                value={item.value}
              />
            </View>
          ))}
        </View>

        <SectionCard style={[styles.filtersCard, styles.flatCard]}>
          <View style={styles.filtersRow}>
            {filterItems.map((item) => {
              const selected = item.value === activeFilter;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.filterChip, selected && styles.filterChipActive]}
                  onPress={() => setActiveFilter(item.value)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                    {item.fullLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        {loading ? (
          <SectionCard style={[styles.emptyCard, styles.flatCard]}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.emptyText}>Carregando pacientes vinculados...</Text>
          </SectionCard>
        ) : loadError ? (
          <SectionCard style={[styles.emptyCard, styles.flatCard]}>
            <Text style={styles.emptyTitle}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPatients} activeOpacity={0.9}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </SectionCard>
        ) : null}

        {!loading && !loadError && !filteredPatients.length ? (
          <SectionCard style={[styles.emptyCard, styles.flatCard]}>
            <Text style={styles.emptyTitle}>Nenhum paciente encontrado</Text>
            <Text style={styles.emptyText}>
              Ajuste os filtros ou aguarde novos pacientes vinculados.
            </Text>
          </SectionCard>
        ) : null}

        <View style={styles.patientList}>
          {filteredPatients.map((patient) => {
            const riskMeta = getRiskMeta(patient);
            const alerts = Number(patient.alerts || 0);

            return (
              <TouchableOpacity
                key={patient.id}
                style={[styles.patientCard, styles.flatCard]}
                activeOpacity={0.92}
                onPress={() =>
                  navigation.navigate('MedicoProntuarioPaciente', {
                    usuarioLogado,
                    pacienteId: patient.id,
                    paciente: patient,
                  })
                }
              >
                <View style={styles.patientLeft}>
                  <AvatarBadge name={patient.name} size={40} subtle />
                  <View style={styles.patientCopy}>
                    <View style={styles.patientTopRow}>
                      <Text style={styles.patientName}>{patient.name}</Text>
                      <View style={[styles.riskBadgePill, riskMeta.badgeStyle]}>
                        <Text style={[styles.riskBadgePillText, riskMeta.badgeTextStyle]}>
                          {riskMeta.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.patientMeta}>
                      {patient.specialtyTag} · {patient.age} anos
                    </Text>

                    <View style={styles.patientStatusRow}>
                      <View style={styles.statusItem}>
                        <Ionicons name="trending-up-outline" size={10} color="#5c6e83" />
                        <Text style={styles.statusItemText}>Adesão: {patient.adherence}%</Text>
                      </View>
                      {alerts ? (
                        <View style={styles.statusItem}>
                          <Ionicons name="alert-circle-outline" size={10} color={patientTheme.colors.danger} />
                          <Text style={[styles.statusItemText, styles.statusItemAlertText]}>
                            {alerts} {alerts === 1 ? 'alerta' : 'alertas'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.patientRight}>
                  <Text style={styles.updatedLabel}>Atualizado</Text>
                  <Text style={styles.updatedTime}>{patient.updatedAt || '--'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  flatCard: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    shadowColor: 'transparent',
    elevation: 0,
  },
  searchCard: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    shadowColor: 'transparent',
    elevation: 0,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    minWidth: 160,
    flexGrow: 1,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  metricValueDefault: {
    color: patientTheme.colors.text,
  },
  metricValueHighRisk: {
    color: patientTheme.colors.danger,
  },
  metricValueAdherence: {
    color: patientTheme.colors.primaryDark,
  },
  metricValueAlerts: {
    color: patientTheme.colors.warning,
  },
  filtersCard: {
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 4,
  },
  filterChip: {
    minHeight: 24,
    paddingHorizontal: 14,
    borderRadius: patientTheme.radius.pill,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  filterChipText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    fontWeight: '700',
  },
  patientList: {
    gap: 10,
  },
  patientCard: {
    minHeight: 76,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  patientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  patientCopy: {
    flex: 1,
    minWidth: 0,
  },
  patientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  patientName: {
    fontSize: 14,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  patientMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  patientStatusRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusItemText: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  statusItemAlertText: {
    color: patientTheme.colors.warning,
  },
  patientRight: {
    alignItems: 'flex-end',
  },
  updatedLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  updatedTime: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  riskBadgePill: {
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  riskBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  riskBadgeHigh: {
    backgroundColor: patientTheme.colors.dangerSoft,
    borderColor: patientTheme.colors.danger,
  },
  riskBadgeTextHigh: {
    color: patientTheme.colors.text,
  },
  riskBadgeMedium: {
    backgroundColor: patientTheme.colors.warningSoft,
    borderColor: patientTheme.colors.warning,
  },
  riskBadgeTextMedium: {
    color: patientTheme.colors.text,
  },
  riskBadgeLow: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primary,
  },
  riskBadgeTextLow: {
    color: patientTheme.colors.primaryDark,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: 10,
  },
  emptyTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
});
