import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  AvatarBadge,
  FilterTabs,
  formatPatientRiskLabel,
  getPatientRiskPalette,
  SearchInput,
  SectionCard,
  nutriDesktopStyles,
  dashboardKpiStyles,
  DashboardKpiCard,
  KPI_ACCENTS,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  getNutritionistId,
  listPatientsByNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import {
  countPatientsByObjectiveFilter,
  patientMatchesObjectiveFilter,
} from '../../utilitarios/adesaoNutricional';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';
const FILTER_ORDER = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Diabetes', label: 'Diabetes' },
  { value: 'Emagrecimento', label: 'Emagrecimento' },
  { value: 'Ganho de Massa', label: 'Ganho de Massa' },
  { value: 'Reeducacao', label: 'Reeducação Alimentar' },
  { value: 'Prioritarios', label: 'Prioritários' },
];

export default function GerenciarPacientesStyled({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);

  const loadPatients = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setLoadError('');
      const items = await listPatientsByNutritionist(nutricionistaId);
      setPatients(items || []);
    } catch (error) {
      console.log('Erro ao carregar pacientes vinculados:', error);
      setLoadError('Nao foi possivel carregar os pacientes vinculados.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [nutricionistaId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPatients({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadPatients]);

  const hasActiveFilters = Boolean(search.trim()) || activeFilter !== 'Todos';

  const clearFilters = useCallback(() => {
    setSearch('');
    setActiveFilter('Todos');
  }, []);

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

      const matchesFilter = patientMatchesObjectiveFilter(patient, activeFilter, patients);

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

    const placeholder = loading ? '—' : null;

    return [
      { id: 'total', label: 'Total Pacientes', value: placeholder ?? String(total), icon: 'people-outline', accent: KPI_ACCENTS.blue },
      { id: 'high-risk', label: 'Alto Risco', value: placeholder ?? String(highRisk), icon: 'alert-circle-outline', accent: KPI_ACCENTS.red },
      { id: 'adherence', label: 'Adesão Média', value: placeholder ?? `${avgAdherence}%`, icon: 'trending-up-outline', accent: KPI_ACCENTS.green },
      { id: 'alerts', label: 'Pac. c/ Alerta', value: placeholder ?? String(withAlerts), icon: 'notifications-outline', accent: KPI_ACCENTS.yellow },
    ];
  }, [loading, patients]);

  const filterItems = useMemo(
    () =>
      FILTER_ORDER.map((item) => ({
        ...item,
        fullLabel: `${item.label} (${countPatientsByObjectiveFilter(patients, item.value)})`,
      })),
    [patients]
  );

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'GerenciarPacientes'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[patientTheme.colors.primaryDark]}
        />
      }
    >
      <View style={nutriDesktopStyles.pageGap}>
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

        <SectionCard style={[styles.patientsPanel, styles.patientsPanelCard]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderCopy}>
              <Text style={styles.panelTitle}>Pacientes</Text>
              <Text style={styles.panelHelper}>
                Carteira vinculada com busca e filtros clínicos
              </Text>
            </View>
            <View
              style={[
                styles.countBadge,
                filteredPatients.length > 0 && styles.countBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.countBadgeText,
                  filteredPatients.length > 0 && styles.countBadgeTextActive,
                ]}
              >
                {filteredPatients.length}
              </Text>
            </View>
          </View>

          <FilterTabs
            items={filterItems.map((item) => ({ value: item.value, label: item.fullLabel }))}
            active={activeFilter}
            onChange={setActiveFilter}
            compact
            fill
          />

          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar paciente por nome..."
          />

          <View style={styles.panelDivider} />

          {loading ? (
            <View style={styles.emptyPanel}>
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
              <Text style={styles.emptyText}>Carregando pacientes vinculados...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>{loadError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadPatients} activeOpacity={0.9}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : !filteredPatients.length ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>Nenhum paciente encontrado</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? 'Nenhum paciente corresponde aos filtros atuais.'
                  : 'Aguarde novos pacientes vinculados à sua carteira.'}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters} activeOpacity={0.9}>
                  <Text style={styles.clearFiltersButtonText}>Limpar filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.patientListPanel}>
              <View style={styles.patientList}>
                {filteredPatients.map((patient) => {
                  const alerts = Number(patient.alerts || 0);
                  const riskPalette = getPatientRiskPalette(patient);

                  return (
                    <View key={patient.id} style={styles.patientRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.flatCard,
                          styles.patientCard,
                          { borderLeftColor: riskPalette.border, borderLeftWidth: 4 },
                          pressed && styles.patientCardPressed,
                        ]}
                        onPress={() =>
                          navigation.navigate('NutriProntuarioPaciente', {
                            usuarioLogado,
                            pacienteId: patient.id,
                            paciente: patient,
                          })
                        }
                      >
                        <View style={styles.patientScheduleCol}>
                          <Text style={styles.patientScheduleTime}>
                            {patient.updatedAt || '--'}
                          </Text>
                          <Text style={styles.patientScheduleDate}>Atualizado</Text>
                        </View>

                        <View style={styles.patientBody}>
                          <AvatarBadge name={patient.name} size={38} subtle />
                          <View style={styles.patientCopy}>
                            <Text style={styles.patientName} numberOfLines={1}>
                              {patient.name}
                            </Text>
                            <View style={styles.patientMetaRow}>
                              <View
                                style={[
                                  styles.patientStatusPill,
                                  {
                                    backgroundColor: riskPalette.bg,
                                    borderColor: riskPalette.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.patientStatusPillText,
                                    { color: riskPalette.text },
                                  ]}
                                >
                                  {formatPatientRiskLabel(patient)}
                                </Text>
                              </View>
                              <Text style={styles.patientMeta} numberOfLines={1}>
                                {patient.specialtyTag} · {patient.age} anos
                              </Text>
                            </View>
                            {patient.email ? (
                              <Text style={styles.patientEmail} numberOfLines={1}>
                                {patient.email}
                              </Text>
                            ) : null}
                            <Text style={styles.patientDetailMeta}>
                              Adesão: {patient.adherence}%
                              {alerts
                                ? ` · ${alerts} ${alerts === 1 ? 'alerta' : 'alertas'}`
                                : ''}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </SectionCard>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  patientsPanel: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  patientsPanelCard: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'column',
    gap: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  panelHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  panelTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  panelHelper: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  countBadgeActive: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
  },
  countBadgeText: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  countBadgeTextActive: {
    color: patientTheme.colors.primaryDark,
  },
  panelDivider: {
    height: 1,
    backgroundColor: patientTheme.colors.border,
    marginTop: 2,
  },
  emptyPanel: {
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  flatCard: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
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
  patientListPanel: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    paddingBottom: 4,
  },
  patientList: {
    width: '100%',
    minWidth: 0,
    marginTop: 8,
    gap: 8,
  },
  patientRow: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  patientCard: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    minHeight: 64,
    backgroundColor: patientTheme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 10,
    paddingLeft: 0,
    gap: 8,
    alignSelf: 'stretch',
  },
  patientCardPressed: {
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  patientScheduleCol: {
    width: 68,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: patientTheme.colors.border,
  },
  patientScheduleTime: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  patientScheduleDate: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  patientBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  patientCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  patientName: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  patientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    marginTop: 2,
  },
  patientStatusPill: {
    flexShrink: 0,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  patientStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
  patientMeta: {
    flex: 1,
    minWidth: 0,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  patientEmail: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
  },
  patientDetailMeta: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
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
  clearFiltersButton: {
    marginTop: 14,
    minHeight: 44,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primary,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
  },
  clearFiltersButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 13,
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
