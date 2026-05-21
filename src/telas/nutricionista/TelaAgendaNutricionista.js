import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  AvatarBadge,
  FilterTabs,
  RiskBadge,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { updateConsultaStatus } from '../../servicos/servicoConsultas';
import {
  getNutritionistId,
  listConsultasNutricionistaComPaciente,
} from '../../servicos/servicoVinculosNutricionista';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

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

function statusLabel(value) {
  const labels = {
    scheduled: 'Agendada',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    done: 'Finalizada',
    no_show: 'Ausente',
  };
  return labels[value] || value || 'Agendada';
}

export default function TelaAgendaNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [selectedDay, setSelectedDay] = useState('hoje');
  const [consultas, setConsultas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);

  const loadAgenda = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const items = await listConsultasNutricionistaComPaciente(nutricionistaId, {
        from: startOfDay(0).toISOString(),
        to: endOfDay(1).toISOString(),
        limit: 120,
      });
      setConsultas(items || []);
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

  const dayItems = useMemo(() => {
    const targetStart = selectedDay === 'amanha' ? startOfDay(1) : startOfDay(0);
    const targetEnd = selectedDay === 'amanha' ? endOfDay(1) : endOfDay(0);
    return consultas.filter((consulta) => {
      const time = new Date(consulta.scheduled_at || 0).getTime();
      return time >= targetStart.getTime() && time <= targetEnd.getTime();
    });
  }, [consultas, selectedDay]);

  const summary = useMemo(() => {
    const hoje = consultas.filter((consulta) => {
      const time = new Date(consulta.scheduled_at || 0).getTime();
      return time >= startOfDay(0).getTime() && time <= endOfDay(0).getTime();
    });
    const confirmadas = hoje.filter((consulta) => consulta.status === 'confirmed').length;
    const pendentes = hoje.filter((consulta) => consulta.status === 'scheduled').length;

    return [
      { id: 's1', label: 'Hoje', value: hoje.length, helper: 'Consultas agendadas' },
      { id: 's2', label: 'Confirmadas', value: confirmadas, helper: 'Prontas para atendimento' },
      { id: 's3', label: 'Pendentes', value: pendentes, helper: 'Aguardando confirmacao' },
    ];
  }, [consultas]);

  async function updateStatus(consultaId, nextStatus) {
    await updateConsultaStatus({
      consultaId,
      status: nextStatus,
      actor: usuarioLogado,
      origin: 'agenda_nutricionista',
    });
    await loadAgenda();
  }

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Agenda"
      subtitle="Consultas do dia, blocos de tempo e acoes imediatas de confirmacao."
      showTabBar={route?.name === 'NutricionistaAgenda'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <View style={styles.summaryRow}>
          {summary.map((item) => (
            <SectionCard key={item.id} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryHelper}>{item.helper}</Text>
            </SectionCard>
          ))}
        </View>

        <View>
          <Text style={nutriDesktopStyles.sectionTitle}>Visualizacao do dia</Text>
          <Text style={nutriDesktopStyles.sectionHelper}>
            Alterna entre os atendimentos de hoje e amanha para agir sem sobrecarga.
          </Text>
        </View>

        <FilterTabs
          items={[
            { value: 'hoje', label: 'Hoje' },
            { value: 'amanha', label: 'Amanha' },
          ]}
          active={selectedDay}
          onChange={setSelectedDay}
          compact
        />

        <View style={styles.consultList}>
          {loading ? (
            <SectionCard style={styles.loadingCard}>
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
              <Text style={styles.emptyText}>Carregando agenda...</Text>
            </SectionCard>
          ) : null}

          {!loading && loadError ? (
            <SectionCard style={styles.loadingCard}>
              <Text style={styles.emptyTitle}>{loadError}</Text>
              <TouchableOpacity style={styles.secondaryAction} onPress={loadAgenda}>
                <Text style={styles.secondaryActionText}>Tentar novamente</Text>
              </TouchableOpacity>
            </SectionCard>
          ) : null}

          {!loading && !loadError && !dayItems.length ? (
            <SectionCard style={styles.loadingCard}>
              <Text style={styles.emptyTitle}>Sem consultas neste dia</Text>
              <Text style={styles.emptyText}>Os agendamentos dos pacientes aparecerao aqui.</Text>
            </SectionCard>
          ) : null}

          {dayItems.map((consulta) => {
            const patient = consulta.paciente || {};
            const patientName =
              patient.nome_completo || patient.nome_pac || patient.email_pac || 'Paciente';
            const status = consulta.status || 'scheduled';

            return (
              <SectionCard key={consulta.id} style={styles.consultCard}>
                <View style={styles.consultTop}>
                  <View style={styles.consultIdentity}>
                    <AvatarBadge name={patientName} size={48} subtle />
                    <View style={styles.consultCopy}>
                      <Text style={styles.consultName}>{patientName}</Text>
                      <Text style={styles.consultMeta}>
                        {consulta.tipo_consulta || 'Teleconsulta'} - Google Meet
                      </Text>
                      <Text style={styles.consultMetaSecondary}>
                        {patient.email_pac || consulta.motivo || 'Paciente vinculado'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.consultSide}>
                    <Text style={styles.consultTime}>{formatConsultaTime(consulta.scheduled_at)}</Text>
                    <RiskBadge risk={statusLabel(status)} />
                  </View>
                </View>

                <View style={styles.contextBox}>
                  <View style={styles.contextItem}>
                    <Text style={styles.contextLabel}>Status</Text>
                    <Text style={styles.contextValue}>{statusLabel(status)}</Text>
                  </View>
                  <View style={styles.contextItem}>
                    <Text style={styles.contextLabel}>Convenio</Text>
                    <Text style={styles.contextValue}>{consulta.convenio || 'Particular'}</Text>
                  </View>
                  <View style={styles.contextItem}>
                    <Text style={styles.contextLabel}>Paciente</Text>
                    <Text style={styles.contextValue}>
                      {patient.id_paciente_uuid ? 'Vinculado' : 'Sem cadastro'}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() =>
                      navigation.navigate('NutriConsultaNutri', {
                        usuarioLogado,
                        consultaId: consulta.id,
                        pacienteId: consulta.paciente_id,
                      })
                    }
                    activeOpacity={0.9}
                  >
                    <Ionicons name="videocam-outline" size={18} color={patientTheme.colors.onPrimary} />
                    <Text style={styles.primaryActionText}>Iniciar consulta</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() => updateStatus(consulta.id, 'confirmed')}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={patientTheme.colors.primaryDark} />
                    <Text style={styles.secondaryActionText}>Confirmar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelAction}
                    onPress={() => updateStatus(consulta.id, 'cancelled')}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#c55b5b" />
                    <Text style={styles.cancelActionText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </SectionCard>
            );
          })}
        </View>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minHeight: 126,
  },
  summaryLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  summaryValue: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  summaryHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  consultList: {
    gap: 12,
  },
  loadingCard: {
    alignItems: 'center',
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
  consultCard: {
    gap: 14,
  },
  consultTop: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 12,
  },
  consultIdentity: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  consultCopy: {
    flex: 1,
    minWidth: 0,
  },
  consultName: {
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  consultMeta: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  consultMetaSecondary: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
  },
  consultSide: {
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start',
    gap: 8,
  },
  consultTime: {
    fontSize: 28,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  contextBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextItem: {
    flex: 1,
    minWidth: 120,
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    ...patientShadow,
  },
  contextLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  contextValue: {
    marginTop: 6,
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
  },
  primaryAction: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...patientShadow,
  },
  secondaryActionText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  cancelAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#fff2f2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelActionText: {
    color: '#c55b5b',
    fontWeight: '900',
  },
});
