import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import MedicoDrawer from '../../componentes/medico/MenuMedico';
import {
  AvatarBadge,
  formatPatientRiskLabel,
  getPatientRiskPalette,
  SectionCard,
  nutriDesktopStyles,
  dashboardKpiStyles,
  DashboardKpiCard,
  KPI_ACCENTS,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { medicoQuickActions } from '../../dados/dadosMedicoMock';
import {
  getMedicoId,
  listConsultasMedicoComPaciente,
  listPatientsByDoctor,
} from '../../servicos/servicoVinculosMedico';
import { getPriorityPatients } from '../../utilitarios/adesaoNutricional';
import { criarGuardiaoCarregamentoInicial } from '../../utilitarios/carregamentoTela';
import {
  MEDICO_MAIN_TAB_ROUTES,
  navigateMedicoTab,
} from '../../utilitarios/navegacaoAbas';
import { medicoTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import { nutriClinicalStatus } from '../../temas/designSystemNutricionista';

const PRIORITY_RED = '#FF3B30';

const PRIORITY_BOARD_ACCENT = {
  bg: nutriClinicalStatus.critical.bg,
  border: PRIORITY_RED,
  text: PRIORITY_RED,
  scheduleBorder: '#FECACA',
};

function isConsultaToday(scheduledAt) {
  if (!scheduledAt) return false;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function getActionAppearance(route) {
  const isMessages = route === 'MedicoMensagens';
  return {
    borderColor: patientTheme.colors.border,
    backgroundColor: '#FFFFFF',
    iconColor: patientTheme.colors.primaryDark,
    badgeColor: isMessages ? patientTheme.colors.danger : patientTheme.colors.primaryDark,
  };
}

export default function TelaInicioMedico({ route, navigation, onMedicoLogout }) {
  const { usuarioLogado } = route.params || {};
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [todayConsultasCount, setTodayConsultasCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const patientsLoadGuardRef = useRef(criarGuardiaoCarregamentoInicial());
  const medicoNome =
    usuarioLogado?.nome_completo_medico || usuarioLogado?.nome || usuarioLogado?.email || 'Medico';

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: () => setMenuVisible(true),
    });
  }, [navigation]);

  const loadPatients = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setLoadError('');
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const [items, consultas] = await Promise.all([
        listPatientsByDoctor(medicoId, { limit: 80 }),
        listConsultasMedicoComPaciente(medicoId, {
          from: startOfDay.toISOString(),
          to: endOfDay.toISOString(),
          limit: 80,
        }).catch(() => []),
        Promise.resolve({ naoLidas: 0 }),
      ]);

      const unreadTotal = (items || []).reduce(
        (sum, patient) => sum + Number(patient.unread || 0),
        0
      );

      setPatients(items || []);
      setTodayConsultasCount(
        (consultas || []).filter(
          (consulta) =>
            consulta?.status !== 'cancelled' && isConsultaToday(consulta?.scheduled_at)
        ).length
      );
      setUnreadChatCount(unreadTotal);
    } catch (error) {
      console.log('Erro ao carregar pacientes vinculados na home:', error);
      setLoadError('Nao foi possivel carregar sua carteira de pacientes.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [medicoId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPatients({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadPatients]);

  useEffect(() => {
    if (!medicoId) {
      navigation.replace('Login', { roleInicial: 'Medico' });
    }
  }, [navigation, medicoId]);

  useEffect(() => {
    (async () => {
      await loadPatients();
      patientsLoadGuardRef.current.marcarCarregado();
    })();
  }, [loadPatients]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (patientsLoadGuardRef.current.deveIgnorarCarregamentoFocus()) return;
      loadPatients();
    });
    return unsubscribe;
  }, [navigation, loadPatients]);

  const clinicalAlerts = useMemo(
    () =>
      patients
        .filter((patient) => Number(patient.alerts || 0) > 0)
        .slice(0, 5)
        .map((patient) => ({
          id: patient.id,
          titulo: patient.name,
          mensagem: `${patient.alerts} alerta(s) ativo(s) · Glicose ${patient.latestGlucose || '--'} mg/dL`,
        })),
    [patients]
  );

  const metrics = useMemo(() => {
    const total = patients.length;
    const highRisk = patients.filter((patient) => patient.risk === 'Alto').length;
    const withAlerts = clinicalAlerts.length;
    const avgAdherence = total
      ? Math.round(
          patients.reduce((sum, patient) => sum + Number(patient.adherence || 0), 0) / total
        )
      : 0;

    return [
      {
        id: 'patients-linked',
        icon: 'people-outline',
        label: 'Total Pacientes',
        value: String(total),
        accent: KPI_ACCENTS.blue,
      },
      {
        id: 'high-risk',
        icon: 'alert-circle-outline',
        label: 'Alto Risco',
        value: String(highRisk),
        accent: KPI_ACCENTS.red,
      },
      {
        id: 'alerts',
        icon: 'notifications-outline',
        label: 'Alertas Ativos',
        value: String(withAlerts),
        accent: KPI_ACCENTS.red,
      },
      {
        id: 'adherence',
        icon: 'trending-up-outline',
        label: 'Adesão Média',
        value: `${avgAdherence}%`,
        accent: patientTheme.colors.primary,
      },
    ];
  }, [clinicalAlerts.length, patients]);

  const priorityPatients = useMemo(() => getPriorityPatients(patients), [patients]);

  const quickActionCards = useMemo(() => {
    return medicoQuickActions.slice(0, 3).map((item) => {
      const appearance = getActionAppearance(item.route);
      return {
        ...item,
        ...appearance,
        dynamicSubtitle:
          item.route === 'MedicoAgenda'
            ? `${todayConsultasCount} consulta${todayConsultasCount === 1 ? '' : 's'} hoje`
            : item.route === 'MedicoMensagens'
              ? unreadChatCount
                ? `${unreadChatCount} mensagem${unreadChatCount === 1 ? '' : 'ens'} nao lida${unreadChatCount === 1 ? '' : 's'}`
                : 'Nenhuma mensagem pendente'
              : 'Gerar relatorios consolidados',
        count:
          item.route === 'MedicoMensagens'
            ? unreadChatCount
            : item.route === 'MedicoAgenda'
              ? todayConsultasCount
              : 0,
      };
    });
  }, [todayConsultasCount, unreadChatCount]);

  const recentUpdates = useMemo(() => {
    return [...patients]
      .sort((a, b) =>
        String(b.nextConsultaAt || b.lastConsultaAt || b.updatedAt || '').localeCompare(
          String(a.nextConsultaAt || a.lastConsultaAt || a.updatedAt || '')
        )
      )
      .slice(0, 5)
      .map((patient) => ({
        id: patient.id,
        patient,
        name: patient.name,
        age: patient.age,
        adherence: patient.adherence,
        alerts: Number(patient.alerts || 0),
        updatedTime: patient.appointmentTime || patient.updatedAt || '--',
      }));
  }, [patients]);

  function renderPatientListCard(patient, { cardKey, scheduleValue, onPress, accentPalette }) {
    const alerts = Number(patient?.alerts || 0);
    const riskPalette = getPatientRiskPalette(patient);

    return (
      <View key={cardKey} style={styles.patientRow}>
        <Pressable
          style={({ pressed }) => [
            styles.patientFlatCard,
            styles.patientCard,
            accentPalette && styles.patientCardPriority,
            { borderLeftColor: riskPalette.border, borderLeftWidth: 4 },
            pressed && styles.patientCardPressed,
            accentPalette && pressed && styles.patientCardPriorityPressed,
          ]}
          onPress={onPress}
        >
          <View style={styles.patientScheduleCol}>
            <Text style={styles.patientScheduleTime}>{scheduleValue || '--'}</Text>
            <Text style={styles.patientScheduleDate}>Atualizado</Text>
          </View>

          <View style={styles.patientBody}>
            <AvatarBadge name={patient.name} size={38} subtle theme={patientTheme} />
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
                  <Text style={[styles.patientStatusPillText, { color: riskPalette.text }]}>
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
                {alerts ? ` · ${alerts} ${alerts === 1 ? 'alerta' : 'alertas'}` : ''}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'HomeMedico'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[patientTheme.colors.primaryDark]}
        />
      }
    >
      {menuVisible ? (
        <MedicoDrawer
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={(screen, params) => {
            setMenuVisible(false);
            if (MEDICO_MAIN_TAB_ROUTES.has(screen)) {
              navigateMedicoTab(navigation, screen, usuarioLogado);
              return;
            }
            navigation.navigate(screen, { usuarioLogado, ...params });
          }}
          onLogout={onMedicoLogout}
          currentRoute={route?.name || 'HomeMedico'}
          userName={medicoNome}
          userSubtitle="Acompanhamento clinico — glicose, medicacao e exames"
        />
      ) : null}

      <View style={nutriDesktopStyles.pageGap}>
        {clinicalAlerts.length ? (
          <SectionCard style={styles.clinicalAlertsCard}>
            <View style={styles.clinicalAlertsHeader}>
              <Ionicons name="notifications-outline" size={18} color={patientTheme.colors.danger} />
              <Text style={styles.clinicalAlertsTitle}>
                {clinicalAlerts.length} alerta{clinicalAlerts.length === 1 ? '' : 's'} clinico
                {clinicalAlerts.length === 1 ? '' : 's'} na carteira
              </Text>
            </View>
            {clinicalAlerts.slice(0, 3).map((alert) => (
              <Text key={alert.id} style={styles.clinicalAlertsItem}>
                {alert.titulo}: {alert.mensagem}
              </Text>
            ))}
          </SectionCard>
        ) : null}

        <View style={dashboardKpiStyles.grid}>
          {metrics.map((item) => (
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

        <View style={styles.actionsRow}>
          {quickActionCards.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.actionCard,
                {
                  borderColor: item.borderColor,
                  backgroundColor: item.backgroundColor,
                },
              ]}
              onPress={() => navigateMedicoTab(navigation, item.route, usuarioLogado)}
              activeOpacity={0.9}
            >
              <View style={styles.actionTopRow}>
                <Ionicons name={item.icon} size={24} color={item.iconColor} />
                {item.count ? (
                  <View style={[styles.actionCountBadge, { backgroundColor: item.badgeColor }]}>
                    <Text style={styles.actionCountBadgeText}>{item.count}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.actionTitle}>{item.title}</Text>
              <Text style={styles.actionSubtitle}>{item.dynamicSubtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionCard style={styles.prioritySection}>
          <View style={styles.priorityBanner}>
            <View style={styles.priorityBannerLeft}>
              <Ionicons name="alert-circle-outline" size={16} color={PRIORITY_RED} />
              <Text style={styles.recentTitle}>Pacientes Prioritários</Text>
            </View>
            <View style={styles.priorityBannerCount}>
              <Text style={styles.priorityBannerCountText}>{priorityPatients.length}</Text>
            </View>
          </View>

          <View style={styles.priorityBody}>
            {loading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color={patientTheme.colors.primaryDark} />
                <Text style={styles.emptyText}>Carregando pacientes vinculados...</Text>
              </View>
            ) : null}

            {!loading && loadError ? (
              <View style={styles.inlineLoading}>
                <Text style={styles.emptyTitle}>{loadError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadPatients}>
                  <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!loading && !loadError && priorityPatients.length ? (
              <View style={styles.patientList}>
                {priorityPatients.map((patient) =>
                  renderPatientListCard(patient, {
                    cardKey: patient.id,
                    accentPalette: PRIORITY_BOARD_ACCENT,
                    scheduleValue: patient.updatedAt || patient.appointmentTime || '--',
                    onPress: () =>
                      navigation.navigate('MedicoProntuarioPaciente', {
                        usuarioLogado,
                        pacienteId: patient.id,
                        paciente: patient,
                      }),
                  })
                )}
              </View>
            ) : !loading && !loadError ? (
              <View style={styles.inlineLoading}>
                <Text style={styles.emptyText}>Nenhum paciente prioritário no momento.</Text>
              </View>
            ) : null}
          </View>
        </SectionCard>

        <SectionCard style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Atualizações Recentes</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              activeOpacity={0.9}
              onPress={() => navigateMedicoTab(navigation, 'MedicoPacientes', usuarioLogado)}
            >
              <Text style={styles.viewAllText}>Ver Todos</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.recentList}>
            {recentUpdates.length ? (
              <View style={styles.patientList}>
                {recentUpdates.map((item) =>
                  renderPatientListCard(
                    {
                      ...item.patient,
                      name: item.name,
                      age: item.age,
                      adherence: item.adherence,
                      alerts: item.alerts,
                    },
                    {
                      cardKey: item.id,
                      scheduleValue: item.patient?.updatedAt || item.updatedTime || '--',
                      onPress: () =>
                        navigation.navigate('MedicoProntuarioPaciente', {
                          usuarioLogado,
                          pacienteId: item.id,
                          paciente: item.patient,
                        }),
                    }
                  )
                )}
              </View>
            ) : (
              <View style={styles.inlineLoading}>
                <Text style={styles.emptyTitle}>Sem atualizações recentes</Text>
                <Text style={styles.emptyText}>A lista será preenchida pelos pacientes vinculados.</Text>
              </View>
            )}
          </View>
        </SectionCard>
      </View>
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  clinicalAlertsCard: {
    borderColor: patientTheme.colors.dangerSoft,
    backgroundColor: patientTheme.colors.dangerSoft,
    gap: 8,
  },
  clinicalAlertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clinicalAlertsTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  clinicalAlertsItem: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCell: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    minWidth: 180,
    flexGrow: 1,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    shadowColor: 'transparent',
    elevation: 0,
    backgroundColor: patientTheme.colors.surface,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
    fontWeight: '500',
  },
  metricValue: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  metricValueDefault: {
    color: patientTheme.colors.text,
  },
  metricValueHighRisk: {
    color: patientTheme.colors.danger,
  },
  metricValueAlerts: {
    color: patientTheme.colors.danger,
  },
  metricValueAdherence: {
    color: patientTheme.colors.primaryDark,
  },
  actionsRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  actionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCountBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  actionTitle: {
    marginTop: 10,
    fontSize: 14,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  actionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  prioritySection: {
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    shadowColor: 'transparent',
    elevation: 0,
    backgroundColor: '#FFFFFF',
  },
  priorityBanner: {
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: patientTheme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBannerCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PRIORITY_RED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  priorityBannerCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  priorityBody: {
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  patientCardPriority: {
    backgroundColor: '#FFFFFF',
  },
  patientCardPriorityPressed: {
    backgroundColor: '#FEE2E2',
  },
  patientList: {
    width: '100%',
    minWidth: 0,
    gap: 8,
  },
  patientRow: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  patientFlatCard: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    shadowColor: 'transparent',
    elevation: 0,
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
  recentSection: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    shadowColor: 'transparent',
    elevation: 0,
    backgroundColor: patientTheme.colors.surface,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTitle: {
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  viewAllButton: {
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: patientTheme.colors.primary,
  },
  viewAllText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    marginTop: 14,
    gap: 8,
  },
  inlineLoading: {
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
    fontWeight: '500',
    lineHeight: 20,
  },
  retryButton: {
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
