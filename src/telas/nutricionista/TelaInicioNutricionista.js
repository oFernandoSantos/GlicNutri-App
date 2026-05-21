import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  ActionCard,
  AvatarBadge,
  MetricCard,
  ProgressBar,
  RiskBadge,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  nutritionistQuickActions,
} from '../../dados/dadosNutricionistaMock';
import {
  getNutritionistId,
  listPatientsByNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import {
  listFollowUpRequestsByNutritionist,
  updateFollowUpRequestStatus,
} from '../../servicos/servicoSolicitacoesAcompanhamento';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

export default function NutricionistaHomeDashboardScreen({ route, navigation }) {
  const { usuarioLogado } = route.params || {};
  const [patients, setPatients] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingRequestId, setRespondingRequestId] = useState('');
  const [loadError, setLoadError] = useState('');
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [items, pendingRequests] = await Promise.all([
        listPatientsByNutritionist(nutricionistaId),
        listFollowUpRequestsByNutritionist(nutricionistaId, { status: 'pending' }),
      ]);
      setPatients(items || []);
      setRequests(pendingRequests || []);
    } catch (error) {
      console.log('Erro ao carregar pacientes vinculados na home:', error);
      setLoadError('Nao foi possivel carregar sua carteira de pacientes.');
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

  async function handleResponderSolicitacao(request, status) {
    try {
      setRespondingRequestId(request.id);
      await updateFollowUpRequestStatus({
        requestId: request.id,
        nutricionistaId,
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

  const metrics = useMemo(() => {
    const total = patients.length;
    const highRisk = patients.filter((patient) => patient.risk === 'Alto').length;
    const withAlerts = patients.filter((patient) => Number(patient.alerts || 0) > 0).length;
    const avgAdherence = total
      ? Math.round(
          patients.reduce((sum, patient) => sum + Number(patient.adherence || 0), 0) / total
        )
      : 0;

    return [
      {
        id: 'patients-linked',
        icon: 'people-outline',
        label: 'Pacientes vinculados',
        value: total,
        helper: 'Carteira associada ao seu perfil',
        tone: 'default',
      },
      {
        id: 'high-risk',
        icon: 'warning-outline',
        label: 'Alto risco',
        value: highRisk,
        helper: 'Pacientes que pedem atencao',
        tone: highRisk ? 'danger' : 'default',
      },
      {
        id: 'alerts',
        icon: 'notifications-outline',
        label: 'Com alertas',
        value: withAlerts,
        helper: 'Registros com sinal de acompanhamento',
        tone: withAlerts ? 'danger' : 'default',
      },
      {
        id: 'adherence',
        icon: 'checkmark-circle-outline',
        label: 'Adesao media',
        value: `${avgAdherence}%`,
        helper: 'Media da sua carteira vinculada',
        tone: 'default',
      },
    ];
  }, [patients]);

  const priorityPatients = useMemo(() => {
    return [...patients]
      .sort((a, b) => {
        if (b.alerts !== a.alerts) return b.alerts - a.alerts;
        return a.adherence - b.adherence;
      })
      .slice(0, 4);
  }, [patients]);

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
        time: patient.appointmentTime || patient.updatedAt || '--',
        title: patient.name,
        detail: patient.nextConsultaAt
          ? `Proxima consulta: ${patient.appointmentTime}`
          : patient.notes || 'Paciente vinculado ao seu acompanhamento.',
      }));
  }, [patients]);

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Dashboard da clinica"
      subtitle="Gestao rapida da carteira, risco metabolico e proximas acoes do dia."
      showTabBar={route?.name === 'HomeNutricionista'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <View style={styles.metricGrid}>
          {metrics.map((item) => (
            <MetricCard
              key={item.id}
              icon={item.icon}
              label={item.label}
              value={item.value}
              helper={item.helper}
              tone={item.tone}
              style={styles.metricCell}
            />
          ))}
        </View>

        <View>
          <Text style={nutriDesktopStyles.sectionTitle}>Acoes rapidas</Text>
          <Text style={nutriDesktopStyles.sectionHelper}>
            Acesse os pontos mais usados da rotina sem navegar por varios niveis.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {nutritionistQuickActions.map((item) => (
            <ActionCard
              key={item.id}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              helper={item.helper}
              onPress={() => navigation.navigate(item.route, { usuarioLogado })}
            />
          ))}
        </View>

        <View>
          <Text style={nutriDesktopStyles.sectionTitle}>Solicitacoes de acompanhamento</Text>
          <Text style={nutriDesktopStyles.sectionHelper}>
            Aprove o paciente antes de liberar o acompanhamento e os proximos agendamentos.
          </Text>

          <View style={styles.requestList}>
            {loading ? (
              <SectionCard style={styles.emptyCard}>
                <ActivityIndicator color={patientTheme.colors.primaryDark} />
                <Text style={styles.emptyText}>Carregando solicitacoes...</Text>
              </SectionCard>
            ) : null}

            {!loading && !requests.length ? (
              <SectionCard style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nenhuma solicitacao pendente</Text>
                <Text style={styles.emptyText}>
                  Novos pedidos de acompanhamento dos pacientes aparecerao aqui.
                </Text>
              </SectionCard>
            ) : null}

            {requests.map((request) => {
              const paciente = request.paciente || {};
              const pacienteNome =
                paciente.nome_completo || paciente.nome_pac || paciente.email_pac || 'Paciente';
              const responding = respondingRequestId === request.id;

              return (
                <SectionCard key={request.id} style={styles.requestCard}>
                  <View style={styles.requestIdentity}>
                    <AvatarBadge name={pacienteNome} size={44} />
                    <View style={styles.requestCopy}>
                      <Text style={styles.requestName}>{pacienteNome}</Text>
                      <Text style={styles.requestMeta}>{paciente.email_pac || 'Email nao informado'}</Text>
                      {request.mensagem ? (
                        <Text style={styles.requestMessage}>{request.mensagem}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.requestButton, styles.requestButtonPrimary]}
                      activeOpacity={0.9}
                      disabled={responding}
                      onPress={() => handleResponderSolicitacao(request, 'approved')}
                    >
                      <Text style={styles.requestButtonPrimaryText}>
                        {responding ? 'Salvando...' : 'Acompanhar'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.requestButton}
                      activeOpacity={0.9}
                      disabled={responding}
                      onPress={() => handleResponderSolicitacao(request, 'rejected')}
                    >
                      <Text style={styles.requestButtonText}>Recusar</Text>
                    </TouchableOpacity>
                  </View>
                </SectionCard>
              );
            })}
          </View>
        </View>

        <View style={nutriDesktopStyles.desktopRow}>
          <View style={styles.mainColumn}>
            <Text style={nutriDesktopStyles.sectionTitle}>Pacientes prioritarios</Text>
            <Text style={nutriDesktopStyles.sectionHelper}>
              Ordenados por alerta clinico e menor adesao recente.
            </Text>

            <View style={styles.priorityList}>
              {loading ? (
                <SectionCard style={styles.emptyCard}>
                  <ActivityIndicator color={patientTheme.colors.primaryDark} />
                  <Text style={styles.emptyText}>Carregando pacientes vinculados...</Text>
                </SectionCard>
              ) : null}

              {!loading && loadError ? (
                <SectionCard style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>{loadError}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={loadPatients}>
                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                  </TouchableOpacity>
                </SectionCard>
              ) : null}

              {!loading && !loadError && !priorityPatients.length ? (
                <SectionCard style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum paciente vinculado</Text>
                  <Text style={styles.emptyText}>
                    Quando um paciente solicitar e voce aprovar o acompanhamento, ele aparecera neste painel.
                  </Text>
                </SectionCard>
              ) : null}

              {priorityPatients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  style={[
                    styles.priorityCard,
                    patient.risk === 'Alto' && styles.priorityCardAlert,
                  ]}
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.navigate('NutriProntuarioPaciente', {
                      usuarioLogado,
                      pacienteId: patient.id,
                      paciente: patient,
                    })
                  }
                >
                  <View style={styles.priorityHeader}>
                    <View style={styles.priorityIdentity}>
                      <AvatarBadge name={patient.name} size={52} />
                      <View style={styles.priorityCopy}>
                        <View style={styles.priorityTopRow}>
                          <Text style={styles.priorityName}>{patient.name}</Text>
                          <RiskBadge risk={`${patient.risk} risco`} />
                        </View>
                        <Text style={styles.priorityMeta}>
                          {patient.specialtyTag} · IMC {patient.bmi} · {patient.age} anos
                        </Text>
                        <Text style={styles.priorityNote}>{patient.notes}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.priorityStats}>
                    <View style={styles.priorityPill}>
                      <Text style={styles.priorityPillLabel}>Alertas</Text>
                      <Text style={styles.priorityPillValue}>{patient.alerts}</Text>
                    </View>
                    <View style={styles.priorityPill}>
                      <Text style={styles.priorityPillLabel}>Glicose atual</Text>
                      <Text style={styles.priorityPillValue}>
                        {patient.latestGlucose === '--' ? '--' : `${patient.latestGlucose} mg/dL`}
                      </Text>
                    </View>
                    <View style={styles.priorityPill}>
                      <Text style={styles.priorityPillLabel}>Consulta</Text>
                      <Text style={styles.priorityPillValue}>{patient.appointmentTime}</Text>
                    </View>
                  </View>

                  <View style={styles.adherenceBlock}>
                    <View style={styles.adherenceRow}>
                      <Text style={styles.adherenceLabel}>Adesao geral</Text>
                      <Text style={styles.adherenceValue}>{patient.adherence}%</Text>
                    </View>
                    <ProgressBar
                      value={patient.adherence}
                      tone={patient.adherence < 70 ? 'danger' : patient.adherence < 80 ? 'warning' : 'success'}
                    />
                    <Text style={styles.adherenceHint}>{patient.trendText}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sideColumn}>
            <Text style={nutriDesktopStyles.sectionTitle}>Atualizacoes recentes</Text>
            <Text style={nutriDesktopStyles.sectionHelper}>
              Pacientes que preencheram o app ou responderam hoje.
            </Text>

            <SectionCard style={styles.timelineCard}>
              {recentUpdates.length ? recentUpdates.map((item, index) => (
                <View key={item.id} style={[styles.timelineItem, index !== recentUpdates.length - 1 && styles.timelineItemBorder]}>
                  <View style={styles.timelineTimeWrap}>
                    <Text style={styles.timelineTime}>{item.time}</Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    <Text style={styles.timelineDetail}>{item.detail}</Text>
                  </View>
                </View>
              )) : (
                <View style={styles.timelineItem}>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Sem pacientes vinculados</Text>
                    <Text style={styles.timelineDetail}>
                      A lista sera preenchida automaticamente pelos acompanhamentos aprovados.
                    </Text>
                  </View>
                </View>
              )}
            </SectionCard>
          </View>
        </View>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
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
  actionsRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  mainColumn: {
    flex: 1.2,
  },
  sideColumn: {
    flex: 0.82,
  },
  priorityList: {
    marginTop: 14,
    gap: 12,
  },
  requestList: {
    marginTop: 14,
    gap: 12,
  },
  requestCard: {
    gap: 14,
  },
  requestIdentity: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  requestCopy: {
    flex: 1,
    minWidth: 0,
  },
  requestName: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  requestMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  requestMessage: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  requestActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  requestButton: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  requestButtonPrimary: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  requestButtonText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '900',
  },
  requestButtonPrimaryText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
  },
  emptyCard: {
    alignItems: 'flex-start',
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
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
  },
  priorityCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  priorityCardAlert: {
    borderColor: '#f0d2d2',
    backgroundColor: '#faf5f5',
  },
  priorityHeader: {
    gap: 12,
  },
  priorityIdentity: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  priorityCopy: {
    flex: 1,
    minWidth: 0,
  },
  priorityTopRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 8,
  },
  priorityName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  priorityMeta: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  priorityNote: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  priorityStats: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priorityPill: {
    flex: 1,
    minWidth: 120,
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    ...patientShadow,
  },
  priorityPillLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  priorityPillValue: {
    marginTop: 6,
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  adherenceBlock: {
    marginTop: 16,
    gap: 8,
  },
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adherenceLabel: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  adherenceValue: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  adherenceHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  timelineCard: {
    marginTop: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  timelineItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: patientTheme.colors.border,
  },
  timelineTimeWrap: {
    width: 56,
  },
  timelineTime: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
    fontSize: 13,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    color: patientTheme.colors.text,
    fontWeight: '800',
    lineHeight: 20,
  },
  timelineDetail: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
});
