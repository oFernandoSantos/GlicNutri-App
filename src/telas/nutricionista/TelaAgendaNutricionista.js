import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  AvatarBadge,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { updateConsultaStatus } from '../../servicos/servicoConsultas';
import {
  getNutritionistId,
  listConsultasNutricionistaComPaciente,
} from '../../servicos/servicoVinculosNutricionista';
import {
  listFollowUpRequestsByNutritionist,
  updateFollowUpRequestStatus,
} from '../../servicos/servicoSolicitacoesAcompanhamento';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import { ConsultaStatusBadge } from '../../componentes/comum/ui';

function startOfDay(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(offset = 0) {
  const date = startOfDay(offset);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatConsultaTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatSelectedDateLabel(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function isWithinRange(dateValue, start, end) {
  const time = new Date(dateValue || 0).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export default function TelaAgendaNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [selectedDay, setSelectedDay] = useState('hoje');
  const [consultas, setConsultas] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState('');
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);

  const loadAgenda = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [items, pendingRequests] = await Promise.all([
        listConsultasNutricionistaComPaciente(nutricionistaId, {
          from: startOfDay(0).toISOString(),
          to: endOfDay(30).toISOString(),
          limit: 120,
        }),
        listFollowUpRequestsByNutritionist(nutricionistaId, { status: 'pending' }),
      ]);
      setConsultas(items || []);
      setRequests(pendingRequests || []);
    } catch (error) {
      console.log('Erro ao carregar agenda do nutricionista:', error);
      setLoadError('Nao foi possivel carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [nutricionistaId]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAgenda);
    return unsubscribe;
  }, [navigation, loadAgenda]);

  const selectedStart = selectedDay === 'amanha' ? startOfDay(1) : startOfDay(0);
  const selectedEnd = selectedDay === 'amanha' ? endOfDay(1) : endOfDay(0);

  const consultasHoje = useMemo(() => {
    return consultas.filter((consulta) =>
      isWithinRange(consulta.scheduled_at, startOfDay(0), endOfDay(0))
    );
  }, [consultas]);

  const consultasSemana = useMemo(() => {
    const weekEnd = endOfDay(6);
    return consultas.filter((consulta) => isWithinRange(consulta.scheduled_at, startOfDay(0), weekEnd));
  }, [consultas]);

  const consultasMes = useMemo(() => {
    const monthEnd = endOfDay(29);
    return consultas.filter((consulta) => isWithinRange(consulta.scheduled_at, startOfDay(0), monthEnd));
  }, [consultas]);

  const dayItems = useMemo(() => {
    return consultas.filter((consulta) => isWithinRange(consulta.scheduled_at, selectedStart, selectedEnd));
  }, [consultas, selectedStart, selectedEnd]);

  const futureItems = useMemo(() => {
    return consultas
      .filter((consulta) => {
        const time = new Date(consulta.scheduled_at || 0).getTime();
        return time > selectedEnd.getTime();
      })
      .sort((a, b) => String(a.scheduled_at || '').localeCompare(String(b.scheduled_at || '')));
  }, [consultas, selectedEnd]);

  const summary = useMemo(() => {
    return [
      { id: 'today', label: 'Consultas Hoje', value: consultasHoje.length, valueStyle: styles.metricValueToday },
      { id: 'week', label: 'Esta Semana', value: consultasSemana.length, valueStyle: styles.metricValueWeek },
      { id: 'month', label: 'Este Mês', value: consultasMes.length, valueStyle: styles.metricValueMonth },
      { id: 'total', label: 'Total Agendadas', value: consultas.length, valueStyle: styles.metricValueTotal },
      { id: 'requests', label: 'Solicitações', value: requests.length, valueStyle: styles.metricValueRequests },
    ];
  }, [consultas, consultasHoje, consultasMes, consultasSemana, requests.length]);

  async function updateStatus(consultaId, nextStatus) {
    await updateConsultaStatus({
      consultaId,
      status: nextStatus,
      actor: usuarioLogado,
      origin: 'agenda_nutricionista',
    });
    await loadAgenda();
  }

  async function handleResponderSolicitacao(request, status) {
    try {
      setRespondingRequestId(request.id);
      await updateFollowUpRequestStatus({
        requestId: request.id,
        nutricionistaId,
        status,
        actor: usuarioLogado,
      });
      await loadAgenda();
    } catch (error) {
      console.log('Erro ao responder solicitacao de acompanhamento:', error);
      setLoadError(error?.message || 'Nao foi possivel responder a solicitacao.');
    } finally {
      setRespondingRequestId('');
    }
  }

  function renderConsultaCard(consulta) {
    const patient = consulta.paciente || {};
    const patientName =
      patient.nome_completo || patient.nome_pac || patient.email_pac || 'Paciente';

    return (
      <TouchableOpacity
        key={consulta.id}
        style={[styles.consultaCard, styles.flatCard]}
        activeOpacity={0.92}
        onPress={() =>
          navigation.navigate('NutriConsultaNutri', {
            usuarioLogado,
            consultaId: consulta.id,
            pacienteId: consulta.paciente_id,
          })
        }
      >
        <View style={styles.consultaLeft}>
          <AvatarBadge name={patientName} size={42} subtle />
          <View style={styles.consultaCopy}>
            <Text style={styles.consultaName}>{patientName}</Text>
            <Text style={styles.consultaMeta}>
              {consulta.tipo_consulta || 'Teleconsulta'} · {patient.email_pac || 'Paciente vinculado'}
            </Text>
            <Text style={styles.consultaStatusText}>
              {consulta.convenio || 'Particular'}
            </Text>
            <ConsultaStatusBadge status={consulta.status} persona="nutricionista" style={styles.consultaStatusBadge} />
          </View>
        </View>

        <View style={styles.consultaRight}>
          <Text style={styles.consultaTime}>{formatConsultaTime(consulta.scheduled_at)}</Text>
          <View style={styles.consultaActions}>
            <TouchableOpacity
              style={styles.inlineActionButton}
              onPress={(event) => {
                event?.stopPropagation?.();
                updateStatus(consulta.id, 'confirmed');
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.inlineActionButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'NutricionistaAgenda'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <View style={styles.summaryGrid}>
          {summary.map((item) => (
            <SectionCard key={item.id} style={[styles.summaryCard, styles.flatCard]}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={[styles.summaryValue, item.valueStyle]}>{item.value}</Text>
            </SectionCard>
          ))}
        </View>

        <View style={[nutriDesktopStyles.desktopRow, styles.topPanelsRow]}>
          <SectionCard style={[styles.calendarCard, styles.flatCard]}>
            <Text style={styles.panelTitle}>Calendário</Text>
            <Text style={styles.panelHelper}>Selecione uma data para ver os agendamentos</Text>

            <View style={styles.calendarButtonList}>
              <TouchableOpacity
                style={[styles.dateButton, selectedDay === 'hoje' && styles.dateButtonActive]}
                onPress={() => setSelectedDay('hoje')}
                activeOpacity={0.9}
              >
                <Ionicons name="calendar-outline" size={14} color={patientTheme.colors.text} />
                <Text style={styles.dateButtonText}>Hoje</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateButton, selectedDay === 'amanha' && styles.dateButtonActive]}
                onPress={() => setSelectedDay('amanha')}
                activeOpacity={0.9}
              >
                <Ionicons name="calendar-outline" size={14} color={patientTheme.colors.text} />
                <Text style={styles.dateButtonText}>Amanhã</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.selectedDateBlock}>
              <Text style={styles.selectedDateLabel}>Data selecionada:</Text>
              <Text style={styles.selectedDateValue}>
                {formatSelectedDateLabel(selectedStart)}
              </Text>
              <Text style={styles.selectedDateMeta}>
                {dayItems.length} {dayItems.length === 1 ? 'consulta' : 'consultas'}
              </Text>
            </View>
          </SectionCard>

          <SectionCard style={[styles.todayPanel, styles.flatCard]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Consultas de Hoje</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{consultasHoje.length}</Text>
              </View>
            </View>

            {loading ? (
              <View style={styles.emptyPanel}>
                <ActivityIndicator color={patientTheme.colors.primaryDark} />
                <Text style={styles.emptyText}>Carregando agenda...</Text>
              </View>
            ) : loadError ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>{loadError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadAgenda} activeOpacity={0.9}>
                  <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : consultasHoje.length ? (
              <View style={styles.consultaList}>{consultasHoje.map(renderConsultaCard)}</View>
            ) : (
              <View style={styles.emptyPanel}>
                <Ionicons name="calendar-outline" size={58} color={patientTheme.colors.border} />
                <Text style={styles.emptyMessageCenter}>Nenhuma consulta agendada para hoje</Text>
              </View>
            )}
          </SectionCard>
        </View>

        <SectionCard style={[styles.futurePanel, styles.flatCard]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Próximas Consultas</Text>
            <TouchableOpacity style={styles.primaryHeaderButton} activeOpacity={0.9}>
              <Ionicons name="add" size={14} color="#ffffff" />
              <Text style={styles.primaryHeaderButtonText}>Nova Consulta</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.emptyPanelLarge}>
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
              <Text style={styles.emptyText}>Carregando próximas consultas...</Text>
            </View>
          ) : futureItems.length ? (
            <View style={styles.consultaList}>{futureItems.map(renderConsultaCard)}</View>
          ) : (
            <View style={styles.emptyPanelLarge}>
              <Ionicons name="calendar-outline" size={58} color={patientTheme.colors.border} />
              <Text style={styles.emptyMessageCenter}>Nenhuma consulta futura agendada</Text>
              <TouchableOpacity style={styles.greenCenterButton} activeOpacity={0.9}>
                <Text style={styles.greenCenterButtonText}>Agendar Consulta</Text>
              </TouchableOpacity>
            </View>
          )}
        </SectionCard>

        <SectionCard style={[styles.requestsPanel, styles.flatCard]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Solicitações de Acompanhamento</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{requests.length}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.emptyPanel}>
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
              <Text style={styles.emptyText}>Carregando solicitações...</Text>
            </View>
          ) : requests.length ? (
            <View style={styles.requestsList}>
              {requests.map((request) => {
                const paciente = request.paciente || {};
                const pacienteNome =
                  paciente.nome_completo || paciente.nome_pac || paciente.email_pac || 'Paciente';
                const responding = respondingRequestId === request.id;

                return (
                  <View key={request.id} style={[styles.requestCard, styles.flatCard]}>
                    <View style={styles.requestLeft}>
                      <AvatarBadge name={pacienteNome} size={40} subtle />
                      <View style={styles.requestCopy}>
                        <Text style={styles.requestName}>{pacienteNome}</Text>
                        <Text style={styles.requestMeta}>
                          {request.mensagem || paciente.email_pac || 'Solicitação de acompanhamento pendente'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.requestButton, styles.requestButtonApprove]}
                        activeOpacity={0.9}
                        disabled={responding}
                        onPress={() => handleResponderSolicitacao(request, 'approved')}
                      >
                        <Text style={styles.requestButtonApproveText}>
                          {responding ? 'Salvando...' : 'Aceitar'}
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
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Ionicons name="people-outline" size={54} color={patientTheme.colors.border} />
              <Text style={styles.emptyMessageCenter}>Nenhuma solicitação pendente no momento</Text>
            </View>
          )}
        </SectionCard>
      </View>
    </LayoutNutricionista>
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: Platform.OS === 'web' ? '19%' : '48%',
    minWidth: 180,
    flexGrow: 1,
    minHeight: 72,
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
  metricValueToday: {
    color: patientTheme.colors.primaryDark,
  },
  metricValueWeek: {
    color: patientTheme.colors.primaryDark,
  },
  metricValueMonth: {
    color: patientTheme.colors.primaryDark,
  },
  metricValueTotal: {
    color: patientTheme.colors.text,
  },
  metricValueRequests: {
    color: patientTheme.colors.danger,
  },
  topPanelsRow: {
    alignItems: 'stretch',
  },
  calendarCard: {
    flex: Platform.OS === 'web' ? 0.82 : 1,
    minWidth: 0,
    minHeight: 206,
  },
  todayPanel: {
    flex: Platform.OS === 'web' ? 1.68 : 1,
    minWidth: 0,
    minHeight: 206,
  },
  futurePanel: {
    minHeight: 320,
  },
  requestsPanel: {
    minHeight: 180,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '500',
  },
  panelHelper: {
    marginTop: 16,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  calendarButtonList: {
    marginTop: 14,
    gap: 8,
  },
  dateButton: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButtonActive: {
    backgroundColor: patientTheme.colors.surface,
  },
  dateButtonText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  selectedDateBlock: {
    marginTop: 18,
  },
  selectedDateLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  selectedDateValue: {
    marginTop: 8,
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedDateMeta: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: patientTheme.colors.background,
  },
  countBadgeText: {
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  consultaList: {
    marginTop: 14,
    gap: 10,
  },
  requestsList: {
    marginTop: 14,
    gap: 10,
  },
  consultaCard: {
    minHeight: 66,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  consultaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  consultaCopy: {
    flex: 1,
    minWidth: 0,
  },
  consultaName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  consultaMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  consultaStatusText: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  consultaStatusBadge: {
    marginTop: 6,
  },
  consultaRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  consultaTime: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  consultaActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineActionButton: {
    minHeight: 28,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
  },
  inlineActionButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  primaryHeaderButton: {
    minHeight: 30,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryHeaderButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyPanel: {
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyPanelLarge: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyMessageCenter: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  greenCenterButton: {
    minHeight: 30,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCenterButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  requestCard: {
    minHeight: 70,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  requestCopy: {
    flex: 1,
    minWidth: 0,
  },
  requestName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  requestMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    minHeight: 32,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.background,
  },
  requestButtonApprove: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  requestButtonText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  requestButtonApproveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
});
