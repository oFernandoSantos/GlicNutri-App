import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  AvatarBadge,
  FilterTabs,
  ProgressBar,
  RiskBadge,
  SearchInput,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  getNutritionistId,
  listPatientsByNutritionist,
  unlinkPatientNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

const filterItems = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Diabetes', label: 'Diabetes' },
  { value: 'Emagrecimento', label: 'Emagrecimento' },
  { value: 'Ganho de Massa', label: 'Ganho de Massa' },
  { value: 'Reeducacao', label: 'Reeducacao' },
  { value: 'Prioritarios', label: 'Prioritarios' },
];

export default function GerenciarPacientesStyled({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingPatientId, setUnlinkingPatientId] = useState('');
  const [loadError, setLoadError] = useState('');
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const items = await listPatientsByNutritionist(nutricionistaId);
      setPatients(items || []);
    } catch (error) {
      console.log('Erro ao carregar pacientes vinculados:', error);
      setLoadError('Nao foi possivel carregar os pacientes vinculados.');
    } finally {
      setLoading(false);
    }
  }, [nutricionistaId]);

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
        (activeFilter === 'Prioritarios' && (patient.risk === 'Alto' || patient.alerts >= 3));

      return matchesSearch && matchesFilter;
    });
  }, [patients, search, activeFilter]);

  const summary = useMemo(() => {
    const total = patients.length;
    const highRisk = patients.filter((item) => item.risk === 'Alto').length;
    const withAlerts = patients.filter((item) => item.alerts > 0).length;
    const avgAdherence = total
      ? Math.round(patients.reduce((sum, item) => sum + Number(item.adherence || 0), 0) / total)
      : 0;

    return [
      { id: 's1', label: 'Na carteira', value: total },
      { id: 's2', label: 'Alto risco', value: highRisk },
      { id: 's3', label: 'Com alertas', value: withAlerts },
      { id: 's4', label: 'Adesao media', value: `${avgAdherence}%` },
    ];
  }, [patients]);

  async function handleDesvincularPaciente(patient) {
    try {
      setUnlinkingPatientId(patient.id);
      setLoadError('');
      await unlinkPatientNutritionist({
        pacienteId: patient.id,
        nutricionistaId,
        actor: usuarioLogado,
        origin: 'nutricionista',
      });
      await loadPatients();
    } catch (error) {
      console.log('Erro ao desvincular paciente:', error);
      setLoadError(error?.message || 'Nao foi possivel desvincular o paciente.');
    } finally {
      setUnlinkingPatientId('');
    }
  }

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Pacientes"
      subtitle="CRM clinico com busca rapida, filtros por objetivo e triagem metabolica."
      showTabBar={route?.name === 'GerenciarPacientes'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome, objetivo, risco ou observacao"
        />

        <View style={styles.summaryGrid}>
          {summary.map((item) => (
            <SectionCard key={item.id} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </SectionCard>
          ))}
        </View>

        <FilterTabs items={filterItems} active={activeFilter} onChange={setActiveFilter} />

        {loading ? (
          <SectionCard style={styles.loadingCard}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.emptyText}>Carregando pacientes vinculados...</Text>
          </SectionCard>
        ) : loadError ? (
          <SectionCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPatients}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </SectionCard>
        ) : null}

        {!loading && !loadError && !filteredPatients.length ? (
          <SectionCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum paciente vinculado</Text>
            <Text style={styles.emptyText}>
              Quando um paciente agendar uma consulta com voce, ele aparecera aqui.
            </Text>
          </SectionCard>
        ) : null}

        <View style={styles.patientGrid}>
          {filteredPatients.map((patient) => (
            <TouchableOpacity
              key={patient.id}
              style={[styles.patientCard, patient.risk === 'Alto' && styles.patientCardAlert]}
              activeOpacity={0.92}
              onPress={() =>
                navigation.navigate('NutriProntuarioPaciente', {
                  usuarioLogado,
                  pacienteId: patient.id,
                  paciente: patient,
                })
              }
            >
              <View style={styles.patientHeader}>
                <AvatarBadge name={patient.name} size={48} subtle />
                <View style={styles.patientCopy}>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.patientMeta}>
                    {patient.specialtyTag} · {patient.age} anos · IMC {patient.bmi}
                  </Text>
                </View>
                <RiskBadge risk={`${patient.risk} risco`} />
              </View>

              <View style={styles.patientTags}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{patient.objective}</Text>
                </View>
                {patient.unread ? (
                  <View style={styles.tagPillGreen}>
                    <Text style={styles.tagTextGreen}>{patient.unread} mensagens</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.unlinkPill}
                  activeOpacity={0.9}
                  disabled={unlinkingPatientId === patient.id}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    handleDesvincularPaciente(patient);
                  }}
                >
                  <Text style={styles.unlinkPillText}>
                    {unlinkingPatientId === patient.id ? 'Removendo...' : 'Desvincular'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.patientNote}>{patient.notes}</Text>

              <View style={styles.metricInlineRow}>
                <Text style={styles.metricInlineLabel}>Adesao</Text>
                <Text style={styles.metricInlineValue}>{patient.adherence}%</Text>
              </View>
              <ProgressBar
                value={patient.adherence}
                tone={patient.adherence < 70 ? 'danger' : patient.adherence < 80 ? 'warning' : 'success'}
              />

              <View style={styles.bottomRow}>
                <View style={styles.bottomMetric}>
                  <Text style={styles.bottomMetricLabel}>Alertas</Text>
                  <Text style={styles.bottomMetricValue}>{patient.alerts}</Text>
                </View>
                <View style={styles.bottomMetric}>
                  <Text style={styles.bottomMetricLabel}>Glicose</Text>
                  <Text style={styles.bottomMetricValue}>{patient.latestGlucose} mg/dL</Text>
                </View>
                <View style={styles.bottomMetric}>
                  <Text style={styles.bottomMetricLabel}>Ultima atualizacao</Text>
                  <Text style={styles.bottomMetricValue}>{patient.updatedAt}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    minWidth: 160,
    flexGrow: 1,
    minHeight: 108,
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: patientTheme.colors.textMuted,
    fontWeight: '800',
  },
  summaryValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  patientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 10,
  },
  emptyCard: {
    gap: 10,
  },
  emptyTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
  },
  patientCard: {
    width: Platform.OS === 'web' ? '49%' : '100%',
    minWidth: 280,
    flexGrow: 1,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  patientCardAlert: {
    borderColor: '#f0d2d2',
    backgroundColor: '#faf5f5',
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  patientCopy: {
    flex: 1,
    minWidth: 0,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  patientMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  patientTags: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.background,
    ...patientShadow,
  },
  tagPillGreen: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  tagText: {
    color: patientTheme.colors.text,
    fontWeight: '800',
    fontSize: 12,
  },
  tagTextGreen: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
    fontSize: 12,
  },
  unlinkPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f0d2d2',
    backgroundColor: '#fff7f7',
  },
  unlinkPillText: {
    color: '#9f3d3d',
    fontWeight: '900',
    fontSize: 12,
  },
  patientNote: {
    marginTop: 12,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  metricInlineRow: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricInlineLabel: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  metricInlineValue: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  bottomRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bottomMetric: {
    flex: 1,
    minWidth: 110,
    padding: 12,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    ...patientShadow,
  },
  bottomMetricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bottomMetricValue: {
    marginTop: 6,
    color: patientTheme.colors.text,
    fontWeight: '900',
    fontSize: 13,
  },
});
