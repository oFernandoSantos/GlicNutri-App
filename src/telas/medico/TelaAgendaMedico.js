import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import {
  AvatarBadge,
  SectionCard,
  nutriDesktopStyles,
  dashboardKpiStyles,
  DashboardKpiCard,
  KPI_ACCENTS,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { abrirLinkGoogleMeet, createConsultaMedico, updateConsultaStatus } from '../../servicos/servicoConsultas';
import { resolveMeetLink } from '../../servicos/servicoGoogleMeet';
import {
  getMedicoId,
  listConsultasMedicoComPaciente,
  listPatientsByDoctor,
} from '../../servicos/servicoVinculosMedico';
import {
  listFollowUpRequestsByDoctor,
  updateDoctorFollowUpRequestStatus,
} from '../../servicos/servicoSolicitacoesAcompanhamento';
import { medicoTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import { ConsultaStatusBadge } from '../../componentes/comum/ui';
import PainelDisponibilidadeAgendaProfissional from '../../componentes/agendamento/PainelDisponibilidadeAgendaProfissional';

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

function formatDateInput(date) {
  const safeDate = date instanceof Date ? date : new Date();
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildScheduledAt(dateValue, timeValue) {
  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Informe a data no formato AAAA-MM-DD.');
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Informe o horario no formato HH:MM.');
  }
  const scheduled = new Date(`${date}T${time}:00`);
  if (Number.isNaN(scheduled.getTime())) {
    throw new Error('Data ou horario invalido.');
  }
  if (scheduled.getTime() <= Date.now()) {
    throw new Error('Escolha um horario futuro para agendar.');
  }
  const hour = scheduled.getHours();
  const minutes = scheduled.getMinutes();
  if (hour < 7 || hour > 20 || (hour === 20 && minutes > 0)) {
    throw new Error('Escolha um horario entre 07:00 e 20:00.');
  }
  if (minutes !== 0 && minutes !== 30) {
    throw new Error('Use horarios fechados em intervalos de 30 minutos, como 09:00 ou 09:30.');
  }
  return scheduled.toISOString();
}

function formatDateTimePreview(dateValue, timeValue) {
  try {
    const date = new Date(`${dateValue}T${timeValue}:00`);
    if (Number.isNaN(date.getTime())) return 'Data e horario ainda nao definidos';
    return date.toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Data e horario ainda nao definidos';
  }
}

const QUICK_DATES = [
  { id: 'today', label: 'Hoje', offset: 0 },
  { id: 'tomorrow', label: 'Amanha', offset: 1 },
  { id: 'week', label: '+7 dias', offset: 7 },
];

const QUICK_TIMES = ['08:00', '08:30', '09:00', '09:30', '10:00', '14:00', '14:30', '15:00', '15:30', '16:00'];

export default function TelaAgendaMedico({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [selectedDay, setSelectedDay] = useState('hoje');
  const [consultas, setConsultas] = useState([]);
  const [requests, setRequests] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [savingConsulta, setSavingConsulta] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({
    pacienteId: '',
    date: formatDateInput(startOfDay(1)),
    time: '09:00',
    tipoConsulta: 'Teleconsulta',
    convenio: 'Particular',
    meetLink: '',
    motivo: '',
  });
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);

  const loadAgenda = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [items, pendingRequests, linkedPatients] = await Promise.all([
        listConsultasMedicoComPaciente(medicoId, {
          from: startOfDay(0).toISOString(),
          to: endOfDay(30).toISOString(),
          limit: 120,
        }),
        listFollowUpRequestsByDoctor(medicoId, { status: 'pending' }),
        listPatientsByDoctor(medicoId, { limit: 120 }),
      ]);
      setConsultas(items || []);
      setRequests(pendingRequests || []);
      setPatients(linkedPatients || []);
      setForm((current) =>
        !current.pacienteId && linkedPatients?.[0]?.id
          ? { ...current, pacienteId: linkedPatients[0].id }
          : current
      );
    } catch (error) {
      console.log('Erro ao carregar agenda do medico:', error);
      setLoadError('Nao foi possivel carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [medicoId]);

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
      { id: 'today', label: 'Consultas Hoje', value: String(consultasHoje.length), icon: 'today-outline', accent: KPI_ACCENTS.greenBright },
      { id: 'week', label: 'Esta Semana', value: String(consultasSemana.length), icon: 'calendar-outline', accent: KPI_ACCENTS.greenBright },
      { id: 'month', label: 'Este Mês', value: String(consultasMes.length), icon: 'calendar-number-outline', accent: KPI_ACCENTS.greenBright },
      { id: 'total', label: 'Total Agendadas', value: String(consultas.length), icon: 'layers-outline', accent: KPI_ACCENTS.gray },
      { id: 'requests', label: 'Solicitações', value: String(requests.length), icon: 'mail-unread-outline', accent: KPI_ACCENTS.red },
    ];
  }, [consultas, consultasHoje, consultasMes, consultasSemana, requests.length]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === form.pacienteId) || null,
    [form.pacienteId, patients]
  );

  const occupiedSlots = useMemo(() => {
    return new Set(
      consultas
        .filter((consulta) => consulta?.status !== 'cancelled')
        .map((consulta) => {
          const date = new Date(consulta.scheduled_at || 0);
          if (Number.isNaN(date.getTime())) return '';
          return `${formatDateInput(date)}T${date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
        })
        .filter(Boolean)
    );
  }, [consultas]);

  const currentSlotKey = `${form.date}T${form.time}`;
  const currentSlotBusy = occupiedSlots.has(currentSlotKey);
  const canCreateConsulta = Boolean(patients.length && form.pacienteId && !savingConsulta && !currentSlotBusy);

  async function updateStatus(consultaId, nextStatus) {
    await updateConsultaStatus({
      consultaId,
      status: nextStatus,
      actor: usuarioLogado,
      origin: 'agenda_medico',
    });
    await loadAgenda();
  }

  async function handleResponderSolicitacao(request, status) {
    try {
      setRespondingRequestId(request.id);
      await updateDoctorFollowUpRequestStatus({
        requestId: request.id,
        medicoId,
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

  async function handleAbrirMeet(consulta) {
    const link = resolveMeetLink({ consulta, medico: usuarioLogado });
    try {
      await abrirLinkGoogleMeet(link);
    } catch (error) {
      setLoadError(error?.message || 'Nao foi possivel abrir o Google Meet.');
    }
  }

  async function handleCriarConsulta() {
    try {
      setSavingConsulta(true);
      setCreateError('');

      if (!form.pacienteId) {
        throw new Error('Selecione um paciente antes de agendar.');
      }
      if (currentSlotBusy) {
        throw new Error('Este horario ja tem consulta ativa. Escolha outro slot.');
      }
      const scheduledAt = buildScheduledAt(form.date, form.time);

      await createConsultaMedico({
        medicoId,
        pacienteId: form.pacienteId,
        scheduledAt,
        motivo: form.motivo,
        tipoConsulta: form.tipoConsulta,
        meetLink: form.meetLink,
        medico: usuarioLogado,
        pacienteNome: selectedPatient?.name,
        actor: usuarioLogado,
        origin: 'agenda_medico',
      });

      setShowCreateForm(false);
      setForm((current) => ({
        ...current,
        date: formatDateInput(startOfDay(1)),
        time: '09:00',
        motivo: '',
        meetLink: '',
      }));
      await loadAgenda();
    } catch (error) {
      console.log('Erro ao criar consulta pelo medico:', error);
      setCreateError(error?.message || 'Nao foi possivel agendar a consulta.');
    } finally {
      setSavingConsulta(false);
    }
  }

  function renderCreateConsultaForm() {
    return (
      <SectionCard style={[styles.flatCard, styles.createPanel]}>
        <View style={styles.panelHeader}>
          <View style={styles.createTitleBlock}>
            <Text style={styles.panelTitle}>Agendar consulta</Text>
            <Text style={styles.panelHelper}>Fluxo rapido com validacao de horario e sala Google Meet.</Text>
          </View>
          <TouchableOpacity
            style={styles.closeCreateButton}
            activeOpacity={0.9}
            onPress={() => {
              setShowCreateForm(false);
              setCreateError('');
            }}
          >
            <Ionicons name="close" size={18} color={patientTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {createError ? <Text style={styles.createError}>{createError}</Text> : null}

        <View style={styles.meetInfoCard}>
          <View style={styles.meetIconWrap}>
            <Ionicons name="videocam" size={20} color={patientTheme.colors.onPrimary} />
          </View>
          <View style={styles.meetInfoCopy}>
            <Text style={styles.meetInfoTitle}>Google Meet incluido</Text>
            <Text style={styles.meetInfoText}>
              Cole um link real do Google Meet ou deixe em branco para usar o link padrao do seu perfil.
            </Text>
          </View>
        </View>

        <View style={styles.formStepHeader}>
          <Text style={styles.stepBadge}>1</Text>
          <Text style={styles.formLabel}>Paciente</Text>
        </View>
        {patients.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.patientPicker}
          >
            {patients.map((patient) => {
              const selected = form.pacienteId === patient.id;
              return (
                <TouchableOpacity
                  key={patient.id}
                  style={[styles.patientChip, selected && styles.patientChipActive]}
                  activeOpacity={0.9}
                  onPress={() => setForm((current) => ({ ...current, pacienteId: patient.id }))}
                >
                  <Text style={[styles.patientChipText, selected && styles.patientChipTextActive]}>
                    {patient.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Nenhum paciente vinculado encontrado para agendar.</Text>
        )}

        <View style={styles.formStepHeader}>
          <Text style={styles.stepBadge}>2</Text>
          <Text style={styles.formLabel}>Data</Text>
        </View>
        <View style={styles.quickRow}>
          {QUICK_DATES.map((item) => {
            const date = formatDateInput(startOfDay(item.offset));
            const selected = form.date === date;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.quickButton, selected && styles.quickButtonActive]}
                activeOpacity={0.9}
                onPress={() => setForm((current) => ({ ...current, date }))}
              >
                <Text style={[styles.quickButtonText, selected && styles.quickButtonTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={form.date}
          onChangeText={(date) => setForm((current) => ({ ...current, date }))}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={patientTheme.colors.textMuted}
        />

        <View style={styles.formStepHeader}>
          <Text style={styles.stepBadge}>3</Text>
          <Text style={styles.formLabel}>Horario disponivel</Text>
        </View>
        <View style={styles.quickRow}>
          {QUICK_TIMES.map((time) => {
            const selected = form.time === time;
            const busy = occupiedSlots.has(`${form.date}T${time}`);
            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.quickButton,
                  selected && styles.quickButtonActive,
                  busy && styles.quickButtonBusy,
                ]}
                activeOpacity={0.9}
                disabled={busy}
                onPress={() => setForm((current) => ({ ...current, time }))}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    selected && styles.quickButtonTextActive,
                    busy && styles.quickButtonTextBusy,
                  ]}
                >
                  {busy ? `${time} ocupado` : time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={form.time}
          onChangeText={(time) => setForm((current) => ({ ...current, time }))}
          placeholder="HH:MM"
          placeholderTextColor={patientTheme.colors.textMuted}
        />
        {currentSlotBusy ? (
          <Text style={styles.slotWarning}>Este horario ja possui uma consulta ativa.</Text>
        ) : null}

        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Tipo</Text>
            <TextInput
              style={styles.input}
              value={form.tipoConsulta}
              onChangeText={(tipoConsulta) => setForm((current) => ({ ...current, tipoConsulta }))}
              placeholder="Teleconsulta"
              placeholderTextColor={patientTheme.colors.textMuted}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Convenio</Text>
            <TextInput
              style={styles.input}
              value={form.convenio}
              onChangeText={(convenio) => setForm((current) => ({ ...current, convenio }))}
              placeholder="Particular"
              placeholderTextColor={patientTheme.colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.formLabel}>Motivo</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.motivo}
          onChangeText={(motivo) => setForm((current) => ({ ...current, motivo }))}
          placeholder="Ex.: retorno mensal, ajuste de plano alimentar..."
          placeholderTextColor={patientTheme.colors.textMuted}
          multiline
        />

        <Text style={styles.formLabel}>Link do Google Meet</Text>
        <TextInput
          style={styles.input}
          value={form.meetLink}
          onChangeText={(meetLink) => setForm((current) => ({ ...current, meetLink }))}
          placeholder="https://meet.google.com/xxx-yyyy-zzz"
          placeholderTextColor={patientTheme.colors.textMuted}
          autoCapitalize="none"
        />

        <View style={styles.schedulePreview}>
          <View style={styles.previewRow}>
            <Ionicons name="person" size={16} color={patientTheme.colors.primaryDark} />
            <Text style={styles.previewText}>{selectedPatient?.name || 'Selecione um paciente'}</Text>
          </View>
          <View style={styles.previewRow}>
            <Ionicons name="time" size={16} color={patientTheme.colors.primaryDark} />
            <Text style={styles.previewText}>{formatDateTimePreview(form.date, form.time)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Ionicons name="videocam" size={16} color={patientTheme.colors.primaryDark} />
            <Text style={styles.previewText}>
              {form.meetLink || usuarioLogado?.meet_link_padrao
                ? 'Meet real sera anexado ao agendamento.'
                : 'Nenhum Meet real informado. A consulta sera salva sem link.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveConsultaButton, !canCreateConsulta && styles.disabledButton]}
          activeOpacity={0.9}
          disabled={!canCreateConsulta}
          onPress={handleCriarConsulta}
        >
          {savingConsulta ? (
            <ActivityIndicator color={patientTheme.colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="calendar" size={16} color={patientTheme.colors.onPrimary} />
              <Text style={styles.saveConsultaButtonText}>Agendar consulta</Text>
            </>
          )}
        </TouchableOpacity>
      </SectionCard>
    );
  }

  function renderConsultaCard(consulta) {
    const patient = consulta.paciente || {};
    const patientName =
      patient.nome_completo || patient.nome_pac || patient.email_pac || 'Paciente';
    const meetLink = resolveMeetLink({ consulta, medico: usuarioLogado });

    return (
      <TouchableOpacity
        key={consulta.id}
        style={[styles.consultaCard, styles.flatCard]}
        activeOpacity={0.92}
        onPress={() =>
          navigation.navigate('MedicoConsulta', {
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
            <ConsultaStatusBadge status={consulta.status} persona="medico" style={styles.consultaStatusBadge} />
            {meetLink ? (
              <Text style={styles.meetLinkText} numberOfLines={1}>
                Meet: {meetLink}
              </Text>
            ) : null}
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
            {meetLink ? (
              <TouchableOpacity
                style={styles.meetActionButton}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  handleAbrirMeet(consulta);
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="videocam-outline" size={14} color={patientTheme.colors.onPrimary} />
                <Text style={styles.meetActionButtonText}>Meet</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'MedicoAgenda'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <View style={styles.summaryGrid}>
          {summary.map((item) => (
            <View key={item.id} style={styles.summaryCell}>
              <DashboardKpiCard
                icon={item.icon}
                accent={item.accent}
                label={item.label}
                value={item.value}
              />
            </View>
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

        {showCreateForm ? renderCreateConsultaForm() : null}

        <SectionCard style={[styles.futurePanel, styles.flatCard]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Próximas Consultas</Text>
            <TouchableOpacity
              style={styles.primaryHeaderButton}
              activeOpacity={0.9}
              onPress={() => setShowCreateForm(true)}
            >
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
              <TouchableOpacity
                style={styles.greenCenterButton}
                activeOpacity={0.9}
                onPress={() => setShowCreateForm(true)}
              >
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

        <PainelDisponibilidadeAgendaProfissional
          variant="medico"
          professionalId={medicoId}
          actor={usuarioLogado}
          theme={patientTheme}
        />
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCell: {
    width: Platform.OS === 'web' ? '19%' : '48%',
    minWidth: 150,
    flexGrow: 1,
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
  createPanel: {
    gap: 14,
    backgroundColor: patientTheme.colors.surface,
  },
  createTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  closeCreateButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  createError: {
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.dangerSoft,
    padding: 10,
    color: patientTheme.colors.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  meetInfoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  meetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  meetInfoCopy: {
    flex: 1,
  },
  meetInfoTitle: {
    color: patientTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  meetInfoText: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  formStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: patientTheme.colors.text,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    fontSize: 12,
    fontWeight: '900',
  },
  formLabel: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  patientPicker: {
    gap: 8,
    paddingVertical: 2,
  },
  patientChip: {
    minHeight: 36,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  patientChipActive: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  patientChipText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  patientChipTextActive: {
    color: patientTheme.colors.text,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    minHeight: 34,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  quickButtonActive: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  quickButtonBusy: {
    backgroundColor: patientTheme.colors.dangerSoft,
    borderColor: patientTheme.colors.dangerSoft,
    opacity: 0.75,
  },
  quickButtonText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  quickButtonTextActive: {
    color: patientTheme.colors.text,
  },
  quickButtonTextBusy: {
    color: patientTheme.colors.danger,
  },
  slotWarning: {
    marginTop: -4,
    color: patientTheme.colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 44,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    backgroundColor: patientTheme.colors.surface,
    paddingHorizontal: 12,
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  schedulePreview: {
    gap: 8,
    padding: 14,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    flex: 1,
    color: patientTheme.colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  formColumn: {
    flex: 1,
    gap: 8,
  },
  saveConsultaButton: {
    minHeight: 44,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.55,
  },
  saveConsultaButtonText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '900',
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
  meetLinkText: {
    marginTop: 6,
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
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
    backgroundColor: '#4FDFA3',
    borderWidth: 0,
  },
  inlineActionButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  meetActionButton: {
    minHeight: 28,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  meetActionButtonText: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  primaryHeaderButton: {
    minHeight: 30,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryHeaderButtonText: {
    color: patientTheme.colors.text,
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
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCenterButtonText: {
    color: patientTheme.colors.text,
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
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  requestButtonText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  requestButtonApproveText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
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
