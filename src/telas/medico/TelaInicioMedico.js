import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import MedicoDrawer from '../../componentes/medico/MenuMedico';
import {
  AvatarBadge,
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
import {
  listFollowUpRequestsByDoctor,
  updateDoctorFollowUpRequestStatus,
} from '../../servicos/servicoSolicitacoesAcompanhamento';
import { criarGuardiaoCarregamentoInicial } from '../../utilitarios/carregamentoTela';
import {
  MEDICO_MAIN_TAB_ROUTES,
  navigateMedicoTab,
} from '../../utilitarios/navegacaoAbas';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';

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
  return {
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.background,
    iconColor: patientTheme.colors.primaryDark,
    badgeColor: patientTheme.colors.primaryDark,
  };
}

export default function TelaInicioMedico({ route, navigation, onMedicoLogout }) {
  const { usuarioLogado } = route.params || {};
  const [patients, setPatients] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingRequestId, setRespondingRequestId] = useState('');
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

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const [items, pendingRequests, consultas, chatSummary] = await Promise.all([
        listPatientsByDoctor(medicoId, { limit: 80 }),
        listFollowUpRequestsByDoctor(medicoId, { status: 'pending' }),
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
      setRequests(pendingRequests || []);
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
      setLoading(false);
    }
  }, [medicoId]);

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

  async function handleResponderSolicitacao(request, status) {
    try {
      setRespondingRequestId(request.id);
      await updateDoctorFollowUpRequestStatus({
        requestId: request.id,
        medicoId,
        status,
        actor: usuarioLogado,
      });
      await loadPatients();
    } catch (error) {
      console.log('Erro ao responder solicitacao de acompanhamento:', error);
      setLoadError(error?.message || 'Nao foi possivel responder a solicitacao.');
    } finally {
      setRespondingRequestId('');
    }
  }

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
        accent: KPI_ACCENTS.green,
      },
    ];
  }, [clinicalAlerts.length, patients]);

  const priorityPatients = useMemo(() => {
    return [...patients]
      .sort((a, b) => {
        if (b.alerts !== a.alerts) return b.alerts - a.alerts;
        return a.adherence - b.adherence;
      })
      .slice(0, 4);
  }, [patients]);

  const highlightedPatient = priorityPatients[0] || null;

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
        riskMeta: getRiskMeta(patient),
      }));
  }, [patients]);

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'HomeMedico'}
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
              <Ionicons name="alert-circle-outline" size={16} color="#ff3b30" />
              <Text style={styles.priorityBannerTitle}>Pacientes Prioritários</Text>
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

            {!loading && !loadError && highlightedPatient ? (
              <TouchableOpacity
                style={styles.priorityPatientCard}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate('MedicoProntuarioPaciente', {
                    usuarioLogado,
                    pacienteId: highlightedPatient.id,
                    paciente: highlightedPatient,
                  })
                }
              >
                <View style={styles.priorityPatientLeft}>
                  <AvatarBadge name={highlightedPatient.name} size={48} subtle />
                  <View style={styles.priorityPatientCopy}>
                    <View style={styles.priorityPatientTitleRow}>
                      <Text style={styles.priorityPatientName}>{highlightedPatient.name}</Text>
                      <View style={[styles.riskBadgePill, getRiskMeta(highlightedPatient).badgeStyle]}>
                        <Text
                          style={[
                            styles.riskBadgePillText,
                            getRiskMeta(highlightedPatient).badgeTextStyle,
                          ]}
                        >
                          {getRiskMeta(highlightedPatient).label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.priorityPatientMeta}>
                      {highlightedPatient.alerts} alertas ativos · Adesão: {highlightedPatient.adherence}%
                    </Text>
                  </View>
                </View>

                <View style={styles.priorityPatientRight}>
                  <Text style={styles.priorityPatientUpdateLabel}>Última atualização</Text>
                  <Text style={styles.priorityPatientUpdateTime}>
                    {highlightedPatient.appointmentTime || highlightedPatient.updatedAt || '--'}
                  </Text>
                </View>
              </TouchableOpacity>
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
              recentUpdates.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recentItemCard}
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.navigate('MedicoProntuarioPaciente', {
                      usuarioLogado,
                      pacienteId: item.id,
                      paciente: item.patient,
                    })
                  }
                >
                  <View style={styles.recentItemLeft}>
                    <AvatarBadge name={item.name} size={44} subtle />
                    <View style={styles.recentItemCopy}>
                      <View style={styles.recentItemTop}>
                        <Text style={styles.recentItemName}>{item.name}</Text>
                        <View style={[styles.riskBadgePill, item.riskMeta.badgeStyle]}>
                          <Text style={[styles.riskBadgePillText, item.riskMeta.badgeTextStyle]}>
                            {item.riskMeta.label}
                          </Text>
                        </View>
                        {item.alerts ? (
                          <View style={styles.alertsPill}>
                            <Text style={styles.alertsPillText}>{item.alerts} alertas</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.recentItemMeta}>
                        {item.age} anos · Adesão: {item.adherence}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.recentItemRight}>
                    <Text style={styles.recentItemUpdateLabel}>Atualizado</Text>
                    <Text style={styles.recentItemUpdateTime}>{item.updatedTime}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.inlineLoading}>
                <Text style={styles.emptyTitle}>Sem atualizações recentes</Text>
                <Text style={styles.emptyText}>A lista será preenchida pelos pacientes vinculados.</Text>
              </View>
            )}
          </View>
        </SectionCard>

        {!!requests.length ? (
          <SectionCard style={styles.pendingRequestsSection}>
            <Text style={styles.pendingRequestsTitle}>Solicitacoes Pendentes</Text>
            <View style={styles.pendingRequestsList}>
              {requests.map((request) => {
                const paciente = request.paciente || {};
                const pacienteNome =
                  paciente.nome_completo || paciente.nome_pac || paciente.email_pac || 'Paciente';
                const responding = respondingRequestId === request.id;

                return (
                  <View key={request.id} style={styles.pendingRequestCard}>
                    <View style={styles.pendingRequestIdentity}>
                      <AvatarBadge name={pacienteNome} size={42} subtle />
                      <View style={styles.pendingRequestCopy}>
                        <Text style={styles.pendingRequestName}>{pacienteNome}</Text>
                        <Text style={styles.pendingRequestMeta}>
                          {request.mensagem || paciente.email_pac || 'Solicitacao de acompanhamento medico'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.pendingRequestActions}>
                      <TouchableOpacity
                        style={[styles.pendingRequestButton, styles.pendingRequestButtonPrimary]}
                        activeOpacity={0.9}
                        disabled={responding}
                        onPress={() => handleResponderSolicitacao(request, 'approved')}
                      >
                        <Text style={styles.pendingRequestButtonPrimaryText}>
                          {responding ? 'Salvando...' : 'Acompanhar'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pendingRequestButton}
                        activeOpacity={0.9}
                        disabled={responding}
                        onPress={() => handleResponderSolicitacao(request, 'rejected')}
                      >
                        <Text style={styles.pendingRequestButtonText}>Recusar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </SectionCard>
        ) : null}
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
    backgroundColor: patientTheme.colors.background,
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
    backgroundColor: patientTheme.colors.surface,
  },
  priorityBanner: {
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: patientTheme.colors.surfaceMuted,
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
  priorityBannerTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  priorityBannerCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff0000',
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
  },
  priorityPatientCard: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  priorityPatientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  priorityPatientCopy: {
    flex: 1,
    minWidth: 0,
  },
  priorityPatientTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityPatientName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  priorityPatientMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  priorityPatientRight: {
    alignItems: 'flex-end',
  },
  priorityPatientUpdateLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  priorityPatientUpdateTime: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontSize: 13,
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
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: patientTheme.colors.surface,
  },
  viewAllText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    marginTop: 14,
    gap: 12,
  },
  recentItemCard: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  recentItemTop: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  recentItemName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  alertsPill: {
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alertsPillText: {
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  recentItemMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  recentItemRight: {
    alignItems: 'flex-end',
  },
  recentItemUpdateLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  recentItemUpdateTime: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  pendingRequestsSection: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    shadowColor: 'transparent',
    elevation: 0,
    backgroundColor: patientTheme.colors.background,
  },
  pendingRequestsTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  pendingRequestsList: {
    marginTop: 14,
    gap: 12,
  },
  pendingRequestCard: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.background,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  pendingRequestIdentity: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  pendingRequestCopy: {
    flex: 1,
    minWidth: 0,
  },
  pendingRequestName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pendingRequestMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  pendingRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingRequestButton: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: patientTheme.colors.background,
  },
  pendingRequestButtonPrimary: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  pendingRequestButtonText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  pendingRequestButtonPrimaryText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
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
