import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  AvatarBadge,
  SectionCard,
  nutriDesktopStyles,
  dashboardKpiStyles,
  DashboardKpiCard,
  FilterTabs,
  KPI_ACCENTS,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  abrirLinkGoogleMeet,
  createConsulta,
  deleteConsulta,
  isConsultaPendenteConfirmacao,
  normalizeConsultaStatus,
  updateConsultaMeetLink,
  updateConsultaStatus,
} from '../../servicos/servicoConsultas';
import {
  isValidGoogleMeetUrl,
  normalizeGoogleMeetUrl,
  resolveMeetLink,
} from '../../servicos/servicoGoogleMeet';
import {
  getNutritionistId,
  listConsultasNutricionistaComPaciente,
  listPatientsByNutritionist,
  resolveNutritionistId,
} from '../../servicos/servicoVinculosNutricionista';
import { carregarSessaoNutricionista } from '../../servicos/servicoSessaoNutricionista';
import {
  listFollowUpRequestsByNutritionist,
  updateFollowUpRequestStatus,
} from '../../servicos/servicoSolicitacoesAcompanhamento';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import { getConsultaStatusMeta } from '../../temas/designSystem';
import { nutriClinicalStatus } from '../../temas/designSystemNutricionista';
import PainelDisponibilidadeAgendaProfissional from '../../componentes/agendamento/PainelDisponibilidadeAgendaProfissional';
import {
  formatDateKeyToBr,
  parseDateBrToKey,
} from '../../componentes/agendamento/FiltrosAgendamentoAvancado';
import { CampoBuscaAgendamento, ChipFiltro } from '../../componentes/agendamento/uiAgendamento';
import {
  generateSlotsForNextDays,
  listNutriAvailability,
} from '../../servicos/servicoAgendaNutri';
import {
  formatDayLabel,
  groupSlotsByDay,
  markSlotsWithBooking,
} from '../../utilitarios/slotsTeleconsulta';

const CONSULTA_ACTION_COPY = {
  confirmed: {
    title: 'Confirmar consulta',
    message: 'Marcar esta consulta como confirmada?',
    confirmLabel: 'Confirmar',
    destructive: false,
  },
  cancelled: {
    title: 'Cancelar consulta',
    message: 'Deseja cancelar este agendamento?',
    confirmLabel: 'Cancelar consulta',
    destructive: true,
  },
  delete: {
    title: 'Excluir consulta',
    message: 'Esta ação remove o agendamento permanentemente. Continuar?',
    confirmLabel: 'Excluir',
    destructive: true,
  },
};

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

function formatConsultaDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatConsultaTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getConsultaAsidePalette(tone) {
  const palettes = {
    success: nutriClinicalStatus.normal,
    warning: nutriClinicalStatus.attention,
    danger: nutriClinicalStatus.critical,
    info: nutriClinicalStatus.info,
  };
  const palette = palettes[tone] || nutriClinicalStatus.info;
  return { bg: palette.bg, border: palette.border, fg: palette.text };
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

function resolveDateKey(dateValue) {
  const raw = String(dateValue || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return parseDateBrToKey(raw);
}

function buildScheduledAt(dateValue, timeValue) {
  const date = resolveDateKey(dateValue);
  const time = String(timeValue || '').trim();
  if (!date) {
    throw new Error('Informe a data no formato DD/MM/AAAA.');
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
    const dateKey = resolveDateKey(dateValue);
    if (!dateKey) return 'Data e horario ainda nao definidos';
    const date = new Date(`${dateKey}T${timeValue}:00`);
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

const STATUS_FILTERS = [
  { id: 'all', label: 'Todas', icon: 'apps-outline' },
  { id: 'scheduled', label: 'Pendentes', icon: 'time-outline' },
  { id: 'confirmed', label: 'Confirmadas', icon: 'checkmark-circle-outline' },
  { id: 'cancelled', label: 'Canceladas', icon: 'close-circle-outline' },
];

const AGENDA_TABS = [
  { value: 'consultas', label: 'Consultas' },
  { value: 'solicitacoes', label: 'Solicitações' },
  { value: 'minha-agenda', label: 'Minha agenda' },
];

const PERIOD_FILTERS = [
  { id: 'week', label: 'Dias da semana', icon: 'today-outline' },
  { id: '15d', label: '15 dias', icon: 'calendar-outline' },
  { id: '30d', label: '30 dias', icon: 'calendar-number-outline' },
  { id: 'all', label: 'Todas', icon: 'layers-outline' },
];

function matchesPatientSearch(patient, query) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return true;
  const haystack = [patient?.name, patient?.email, patient?.specialtyTag]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function matchesConsultaSearch(consulta, query) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return true;
  const patient = consulta.paciente || {};
  const haystack = [
    patient.nome_completo,
    patient.nome_pac,
    patient.email_pac,
    consulta.tipo_consulta,
    consulta.convenio,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function filterConsultasByStatus(items, statusFilter) {
  if (statusFilter === 'all') return items;
  return items.filter((consulta) => normalizeConsultaStatus(consulta.status) === statusFilter);
}

function filterConsultasByPeriod(items, period) {
  if (period === 'all') return items;
  const start = startOfDay(0);
  if (period === 'week') {
    return items.filter((consulta) => isWithinRange(consulta.scheduled_at, start, endOfDay(6)));
  }
  const limitDays = period === '15d' ? 14 : 29;
  return items.filter((consulta) => isWithinRange(consulta.scheduled_at, start, endOfDay(limitDays)));
}

function formatPeriodScopeLabel(periodFilter, weekScope, selectedDayOffset) {
  if (periodFilter === 'week') {
    if (weekScope === 'day') {
      return formatSelectedDateLabel(startOfDay(selectedDayOffset));
    }
    return 'Próximos 7 dias';
  }
  if (periodFilter === '15d') return 'Próximos 15 dias';
  if (periodFilter === '30d') return 'Próximos 30 dias';
  return 'Todas as consultas carregadas';
}

const WEEK_FILTER_DAYS = 7;

function formatDayPanelTitle(offset) {
  if (offset === 0) return 'Consultas de Hoje';
  if (offset === 1) return 'Consultas de Amanhã';
  const date = startOfDay(offset);
  const label = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
  return `Consultas — ${label}`;
}

function formatEmptyDayMessage(offset, statusFilter) {
  const dayRef =
    offset === 0
      ? 'para hoje'
      : offset === 1
        ? 'para amanhã'
        : `para ${formatSelectedDateLabel(startOfDay(offset))}`;
  if (statusFilter !== 'all') {
    const statusMeta = getConsultaStatusMeta(statusFilter);
    return `Nenhuma consulta ${statusMeta.label.toLowerCase()} ${dayRef}`;
  }
  return `Nenhuma consulta agendada ${dayRef}`;
}

function formatEmptyConsultaMessage(periodFilter, weekScope, selectedDayOffset, statusFilter) {
  if (statusFilter !== 'all') {
    const statusMeta = getConsultaStatusMeta(statusFilter);
    return `Nenhuma consulta ${statusMeta.label.toLowerCase()} neste período`;
  }
  if (periodFilter === 'week') {
    return weekScope === 'day'
      ? formatEmptyDayMessage(selectedDayOffset, 'all')
      : 'Nenhuma consulta agendada nesta semana';
  }
  if (periodFilter === '15d') return 'Nenhuma consulta agendada nos próximos 15 dias';
  if (periodFilter === '30d') return 'Nenhuma consulta agendada nos próximos 30 dias';
  return 'Nenhuma consulta agendada';
}

function slotTimeKey(scheduledAt) {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateLabel(dateValue) {
  try {
    const dateKey = resolveDateKey(dateValue);
    if (!dateKey) return String(dateValue || '');
    const date = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return String(dateValue || '');
  }
}

export default function TelaAgendaNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('week');
  const [weekScope, setWeekScope] = useState('full');
  const [consultaDaySearch, setConsultaDaySearch] = useState('');
  const [consultas, setConsultas] = useState([]);
  const [requests, setRequests] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState('');
  const [actingConsultaId, setActingConsultaId] = useState('');
  const [consultaActionDialog, setConsultaActionDialog] = useState(null);
  const [consultaDetailModal, setConsultaDetailModal] = useState(null);
  const [consultaDetailMeetDraft, setConsultaDetailMeetDraft] = useState('');
  const [consultaDetailMeetError, setConsultaDetailMeetError] = useState('');
  const [savingConsultaDetailMeet, setSavingConsultaDetailMeet] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const consultaModalGuardRef = useRef(false);
  const consultaModalGuardTimerRef = useRef(null);
  const [activeAgendaTab, setActiveAgendaTab] = useState('consultas');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [savingConsulta, setSavingConsulta] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createPatientSearch, setCreatePatientSearch] = useState('');
  const [nutriAvailability, setNutriAvailability] = useState([]);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [form, setForm] = useState({
    pacienteId: '',
    date: formatDateKeyToBr(formatDateInput(startOfDay(1))),
    time: '09:00',
    tipoConsulta: 'Teleconsulta',
    convenio: 'Particular',
    meetLink: '',
    motivo: '',
  });
  const [nutricionistaId, setNutricionistaId] = useState(() => getNutritionistId(usuarioLogado));

  useEffect(() => {
    let active = true;

    async function resolverNutricionistaId() {
      const persisted = await carregarSessaoNutricionista().catch(() => null);
      const usuario = usuarioLogado || persisted || null;
      const resolved = (await resolveNutritionistId(usuario)) || getNutritionistId(usuario);
      if (active) setNutricionistaId(resolved || null);
    }

    resolverNutricionistaId();

    return () => {
      active = false;
    };
  }, [usuarioLogado]);

  const loadAgenda = useCallback(async () => {
    if (!nutricionistaId) return;

    try {
      setLoading(true);
      setLoadError('');
      const [items, pendingRequests, linkedPatients, availability] = await Promise.all([
        listConsultasNutricionistaComPaciente(nutricionistaId, {
          from: startOfDay(-30).toISOString(),
          to: endOfDay(120).toISOString(),
          limit: 200,
        }),
        listFollowUpRequestsByNutritionist(nutricionistaId, { status: 'pending' }),
        listPatientsByNutritionist(nutricionistaId, { limit: 120 }),
        listNutriAvailability(nutricionistaId),
      ]);
      setConsultas(items || []);
      setRequests(pendingRequests || []);
      setPatients(linkedPatients || []);
      setNutriAvailability(availability || []);
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

  useEffect(() => {
    if (activeAgendaTab !== 'solicitacoes' || !nutricionistaId) return;

    let active = true;

    listFollowUpRequestsByNutritionist(nutricionistaId, { status: 'pending' })
      .then((pendingRequests) => {
        if (active) setRequests(pendingRequests || []);
      })
      .catch((error) => {
        console.log('Erro ao recarregar solicitacoes na agenda:', error);
      });

    return () => {
      active = false;
    };
  }, [activeAgendaTab, nutricionistaId]);

  const selectedStart = useMemo(() => startOfDay(selectedDayOffset), [selectedDayOffset]);
  const selectedEnd = useMemo(() => endOfDay(selectedDayOffset), [selectedDayOffset]);

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

  const weekFilterDays = useMemo(() => {
    return Array.from({ length: WEEK_FILTER_DAYS }, (_, offset) => {
      const start = startOfDay(offset);
      const end = endOfDay(offset);
      const count = consultas.filter((consulta) => isWithinRange(consulta.scheduled_at, start, end)).length;
      return {
        offset,
        topLabel:
          offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : start.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        dayNumber: start.getDate(),
        count,
      };
    });
  }, [consultas]);

  const pendingConsultaItems = useMemo(
    () => consultas.filter((consulta) => isConsultaPendenteConfirmacao(consulta.status)),
    [consultas]
  );

  const periodScopedConsultaItems = useMemo(() => {
    if (periodFilter === 'week' && weekScope === 'day') return dayItems;
    return filterConsultasByPeriod(consultas, periodFilter);
  }, [consultas, dayItems, periodFilter, weekScope]);

  const scopedConsultaItems = useMemo(() => {
    if (statusFilter === 'scheduled') {
      return pendingConsultaItems;
    }
    return periodScopedConsultaItems;
  }, [pendingConsultaItems, periodScopedConsultaItems, statusFilter]);

  const searchScopedConsultaItems = useMemo(() => {
    return scopedConsultaItems.filter((consulta) => matchesConsultaSearch(consulta, consultaDaySearch));
  }, [scopedConsultaItems, consultaDaySearch]);

  const statusCounts = useMemo(() => {
    const periodScopedSearched = periodScopedConsultaItems.filter((consulta) =>
      matchesConsultaSearch(consulta, consultaDaySearch)
    );
    const pendingSearched = pendingConsultaItems.filter((consulta) =>
      matchesConsultaSearch(consulta, consultaDaySearch)
    );

    return STATUS_FILTERS.reduce((acc, filter) => {
      if (filter.id === 'all') {
        acc.all = periodScopedSearched.length;
        return acc;
      }
      if (filter.id === 'scheduled') {
        acc.scheduled = pendingSearched.length;
        return acc;
      }
      acc[filter.id] = periodScopedSearched.filter(
        (consulta) => normalizeConsultaStatus(consulta.status) === filter.id
      ).length;
      return acc;
    }, {});
  }, [consultaDaySearch, pendingConsultaItems, periodScopedConsultaItems]);

  const filteredConsultaItems = useMemo(() => {
    return filterConsultasByStatus(searchScopedConsultaItems, statusFilter).sort((a, b) =>
      String(a.scheduled_at || '').localeCompare(String(b.scheduled_at || ''))
    );
  }, [searchScopedConsultaItems, statusFilter]);

  const periodScopeLabel = useMemo(
    () => formatPeriodScopeLabel(periodFilter, weekScope, selectedDayOffset),
    [periodFilter, weekScope, selectedDayOffset]
  );

  const summary = useMemo(() => {
    const placeholder = loading ? '—' : null;
    return [
      { id: 'today', label: 'Consultas Hoje', value: placeholder ?? String(consultasHoje.length), icon: 'today-outline', accent: KPI_ACCENTS.greenBright },
      { id: 'week', label: 'Esta Semana', value: placeholder ?? String(consultasSemana.length), icon: 'calendar-outline', accent: KPI_ACCENTS.greenBright },
      { id: 'month', label: 'Este Mês', value: placeholder ?? String(consultasMes.length), icon: 'calendar-number-outline', accent: KPI_ACCENTS.greenBright },
      { id: 'total', label: 'Total Agendadas', value: placeholder ?? String(consultas.length), icon: 'layers-outline', accent: KPI_ACCENTS.gray },
      { id: 'requests', label: 'Solicitações', value: placeholder ?? String(requests.length), icon: 'mail-unread-outline', accent: KPI_ACCENTS.red },
    ];
  }, [consultas, consultasHoje, consultasMes, consultasSemana, loading, requests.length]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === form.pacienteId) || null,
    [form.pacienteId, patients]
  );

  const filteredCreatePatients = useMemo(() => {
    const term = String(createPatientSearch || '').trim();
    if (!term) return [];
    return patients.filter((patient) => matchesPatientSearch(patient, term)).slice(0, 8);
  }, [createPatientSearch, patients]);

  const nutriAgendaSlots = useMemo(() => {
    const generated = generateSlotsForNextDays(nutriAvailability, { days: 30 });
    return markSlotsWithBooking(generated, consultas);
  }, [consultas, nutriAvailability]);

  const availableDays = useMemo(
    () =>
      groupSlotsByDay(nutriAgendaSlots)
        .map((day) => ({
          ...day,
          slots: day.slots.filter((slot) => slot.status === 'available'),
        }))
        .filter((day) => day.slots.length > 0),
    [nutriAgendaSlots]
  );

  const formDateKey = useMemo(() => resolveDateKey(form.date), [form.date]);

  const slotsForSelectedDate = useMemo(() => {
    if (!formDateKey) return [];
    const day = groupSlotsByDay(nutriAgendaSlots).find((item) => item.dateKey === formDateKey);
    return day?.slots || [];
  }, [formDateKey, nutriAgendaSlots]);

  const availableTimeSlots = useMemo(
    () => slotsForSelectedDate.filter((slot) => slot.status === 'available').length,
    [slotsForSelectedDate]
  );

  const timeSlotGroupsForPicker = useMemo(() => {
    const morning = [];
    const afternoon = [];
    slotsForSelectedDate.forEach((slot) => {
      const time = slotTimeKey(slot.scheduledAt);
      if (!time) return;
      const entry = { time, busy: slot.status !== 'available' };
      if (Number(time.slice(0, 2)) < 12) morning.push(entry);
      else afternoon.push(entry);
    });
    return [
      { id: 'morning', label: 'Manhã', items: morning },
      { id: 'afternoon', label: 'Tarde', items: afternoon },
    ].filter((group) => group.items.length);
  }, [slotsForSelectedDate]);

  const selectedSlotValid = useMemo(
    () =>
      slotsForSelectedDate.some(
        (slot) => slotTimeKey(slot.scheduledAt) === form.time && slot.status === 'available'
      ),
    [slotsForSelectedDate, form.time]
  );

  const canCreateConsulta = Boolean(
    patients.length &&
      form.pacienteId &&
      !savingConsulta &&
      formDateKey &&
      selectedSlotValid
  );

  useEffect(() => {
    if (!showCreateForm || !availableDays.length) return;

    const currentDay = availableDays.find((day) => day.dateKey === formDateKey);
    if (!currentDay) {
      const firstDay = availableDays[0];
      const firstSlot = firstDay.slots[0];
      setForm((current) => ({
        ...current,
        date: formatDateKeyToBr(firstDay.dateKey),
        time: slotTimeKey(firstSlot.scheduledAt),
      }));
      return;
    }

    const timeStillValid = currentDay.slots.some(
      (slot) => slotTimeKey(slot.scheduledAt) === form.time
    );
    if (!timeStillValid) {
      const firstSlot = currentDay.slots[0];
      if (firstSlot) {
        setForm((current) => ({ ...current, time: slotTimeKey(firstSlot.scheduledAt) }));
      }
    }
  }, [showCreateForm, availableDays, formDateKey, form.time]);

  async function updateStatus(consultaId, nextStatus) {
    try {
      setActingConsultaId(consultaId);
      setLoadError('');
      await updateConsultaStatus({
        consultaId,
        status: nextStatus,
        nutricionista: usuarioLogado,
        actor: usuarioLogado,
        origin: 'agenda_nutricionista',
      });
      await loadAgenda();
      setActionFeedback({
        type: 'success',
        text:
          nextStatus === 'confirmed'
            ? 'Consulta confirmada com sucesso.'
            : 'Consulta cancelada com sucesso.',
      });
    } catch (error) {
      console.log('Erro ao atualizar status da consulta:', error);
      const message = error?.message || 'Nao foi possivel atualizar a consulta.';
      setActionFeedback({ type: 'error', text: message });
    } finally {
      setActingConsultaId('');
    }
  }

  async function excluirConsultaConfirmada(consulta) {
    try {
      setActingConsultaId(consulta.id);
      setActionFeedback(null);
      await deleteConsulta({
        consultaId: consulta.id,
        actor: usuarioLogado,
        origin: 'agenda_nutricionista',
      });
      await loadAgenda();
      setActionFeedback({ type: 'success', text: 'Consulta excluida com sucesso.' });
    } catch (error) {
      console.log('Erro ao excluir consulta:', error);
      const message = error?.message || 'Nao foi possivel excluir a consulta.';
      setActionFeedback({ type: 'error', text: message });
    } finally {
      setActingConsultaId('');
    }
  }

  useEffect(() => {
    return () => {
      if (consultaModalGuardTimerRef.current) {
        clearTimeout(consultaModalGuardTimerRef.current);
      }
    };
  }, []);

  function fecharDialogoAcaoConsulta() {
    if (consultaModalGuardRef.current) return;
    setConsultaActionDialog(null);
  }

  function abrirDialogoAcaoConsulta(kind, consulta) {
    if (actingConsultaId || !consulta?.id) return;
    consultaModalGuardRef.current = true;
    if (consultaModalGuardTimerRef.current) {
      clearTimeout(consultaModalGuardTimerRef.current);
    }
    setConsultaActionDialog({ kind, consulta });
    consultaModalGuardTimerRef.current = setTimeout(() => {
      consultaModalGuardRef.current = false;
      consultaModalGuardTimerRef.current = null;
    }, 400);
  }

  async function executarAcaoConsultaDialogo() {
    if (!consultaActionDialog || actingConsultaId) return;
    const { kind, consulta } = consultaActionDialog;
    consultaModalGuardRef.current = false;
    if (consultaModalGuardTimerRef.current) {
      clearTimeout(consultaModalGuardTimerRef.current);
      consultaModalGuardTimerRef.current = null;
    }
    setConsultaActionDialog(null);
    if (kind === 'delete') {
      await excluirConsultaConfirmada(consulta);
      return;
    }
    await updateStatus(consulta.id, kind);
  }

  function abrirDetalhesConsulta(consulta) {
    if (!consulta?.id) return;
    setConsultaDetailModal(consulta);
    setConsultaDetailMeetDraft(normalizeGoogleMeetUrl(consulta.meet_link) || '');
    setConsultaDetailMeetError('');
  }

  function fecharDetalhesConsulta() {
    setConsultaDetailModal(null);
    setConsultaDetailMeetDraft('');
    setConsultaDetailMeetError('');
    setSavingConsultaDetailMeet(false);
  }

  async function salvarMeetLinkDetalhes() {
    if (!consultaDetailModal?.id || savingConsultaDetailMeet) return;

    const draft = String(consultaDetailMeetDraft || '').trim();
    const atual = normalizeGoogleMeetUrl(consultaDetailModal.meet_link) || '';
    if (draft === atual) {
      fecharDetalhesConsulta();
      return;
    }

    try {
      setSavingConsultaDetailMeet(true);
      setConsultaDetailMeetError('');
      const updated = await updateConsultaMeetLink({
        consultaId: consultaDetailModal.id,
        meetLink: draft,
        nutricionista: usuarioLogado,
        actor: usuarioLogado,
      });
      setConsultas((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, ...updated, paciente: item.paciente } : item
        )
      );
      setActionFeedback({ type: 'success', text: 'Link do Google Meet salvo.' });
      fecharDetalhesConsulta();
    } catch (error) {
      setConsultaDetailMeetError(error?.message || 'Nao foi possivel salvar o link.');
    } finally {
      setSavingConsultaDetailMeet(false);
    }
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

  async function handleAbrirMeet(consulta) {
    const link = resolveMeetLink({ consulta, nutricionista: usuarioLogado });
    try {
      await abrirLinkGoogleMeet(link);
    } catch (error) {
      setLoadError(error?.message || 'Nao foi possivel abrir o Google Meet.');
    }
  }

  function fecharFormularioAgendamento() {
    if (savingConsulta) return;
    setShowCreateForm(false);
    setShowDatePickerModal(false);
    setShowTimePickerModal(false);
    setCreateError('');
    setCreatePatientSearch('');
    setForm((current) => ({ ...current, pacienteId: '' }));
  }

  function fecharSeletorData() {
    setShowDatePickerModal(false);
  }

  function fecharSeletorHorario() {
    setShowTimePickerModal(false);
  }

  function selecionarDataAgendamento(day) {
    if (!day?.dateKey || !day.slots?.length) return;
    const firstSlot = day.slots.find((slot) => slot.status === 'available') || day.slots[0];
    setForm((current) => ({
      ...current,
      date: formatDateKeyToBr(day.dateKey),
      time: slotTimeKey(firstSlot.scheduledAt),
    }));
    setShowDatePickerModal(false);
  }

  function selecionarHorarioAgendamento(time) {
    if (!time) return;
    setForm((current) => ({ ...current, time }));
    setShowTimePickerModal(false);
  }

  function selecionarPacienteAgendamento(patient) {
    if (!patient?.id) return;
    setForm((current) => ({ ...current, pacienteId: patient.id }));
    setCreatePatientSearch(patient.name || '');
  }

  function handleCreatePatientSearchChange(value) {
    setCreatePatientSearch(value);
    if (!String(value || '').trim()) {
      setForm((current) => ({ ...current, pacienteId: '' }));
      return;
    }
    if (!form.pacienteId) return;
    const selected = patients.find((patient) => patient.id === form.pacienteId);
    if (selected && !matchesPatientSearch(selected, value)) {
      setForm((current) => ({ ...current, pacienteId: '' }));
    }
  }

  async function handleCriarConsulta() {
    try {
      setSavingConsulta(true);
      setCreateError('');

      if (!form.pacienteId) {
        throw new Error('Selecione um paciente antes de agendar.');
      }
      if (!selectedSlotValid) {
        throw new Error('Escolha data e horario disponiveis na Minha agenda.');
      }
      const scheduledAt = buildScheduledAt(form.date, form.time);

      await createConsulta({
        nutricionistaId,
        pacienteId: form.pacienteId,
        scheduledAt,
        motivo: form.motivo,
        tipoConsulta: form.tipoConsulta,
        convenio: form.convenio,
        meetLink: form.meetLink,
        nutricionista: usuarioLogado,
        pacienteNome: selectedPatient?.name,
        actor: usuarioLogado,
        origin: 'agenda_nutricionista',
      });

      setShowCreateForm(false);
      setShowDatePickerModal(false);
      setShowTimePickerModal(false);
      setCreatePatientSearch('');
      setForm((current) => ({
        ...current,
        pacienteId: '',
        date: formatDateKeyToBr(formatDateInput(startOfDay(1))),
        time: '09:00',
        motivo: '',
        meetLink: '',
      }));
      loadAgenda().catch((refreshError) => {
        console.log('Erro ao atualizar agenda apos agendamento:', refreshError);
      });
    } catch (error) {
      console.log('Erro ao criar consulta pelo nutricionista:', error);
      setCreateError(error?.message || 'Nao foi possivel agendar a consulta.');
    } finally {
      setSavingConsulta(false);
    }
  }

  function renderCreateConsultaForm() {
    const meetDraft = normalizeGoogleMeetUrl(form.meetLink);
    const meetPadrao = normalizeGoogleMeetUrl(usuarioLogado?.meet_link_padrao);
    const meetResumo =
      (meetDraft && isValidGoogleMeetUrl(meetDraft) && meetDraft) ||
      (meetPadrao && isValidGoogleMeetUrl(meetPadrao) && meetPadrao) ||
      '';

    return (
      <View style={styles.createConsultaModalBody}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderCopy}>
            <Text style={styles.panelTitle}>Agendar consulta</Text>
            <Text style={styles.panelHelper}>
              Fluxo rápido com validação de horário e sala Google Meet
            </Text>
          </View>
          <View style={styles.panelHeaderActions}>
            <TouchableOpacity
              style={styles.panelCloseButton}
              activeOpacity={0.9}
              onPress={fecharFormularioAgendamento}
              disabled={savingConsulta}
            >
              <Ionicons name="close" size={16} color={patientTheme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {createError ? <Text style={styles.createError}>{createError}</Text> : null}

        <View style={styles.periodSummaryCard}>
          <Text style={styles.selectedDateLabel}>Google Meet</Text>
          <Text style={styles.selectedDateValue}>Incluído na teleconsulta</Text>
          <Text style={styles.selectedDateMeta}>
            Cole um link real ou deixe em branco para usar o link padrão do seu perfil.
          </Text>
        </View>

        <View style={styles.dayAgendaDivider} />

        <Text style={styles.filterSectionLabel}>Paciente</Text>
        {patients.length ? (
          <>
            <CampoBuscaAgendamento
              value={createPatientSearch}
              onChangeText={handleCreatePatientSearchChange}
              placeholder="Buscar paciente por nome ou e-mail"
            />
            {createPatientSearch.trim() ? (
              filteredCreatePatients.length ? (
                <View style={styles.patientSearchResults}>
                  {filteredCreatePatients.map((patient) => {
                    const selected = form.pacienteId === patient.id;
                    return (
                      <Pressable
                        key={patient.id}
                        style={[
                          styles.patientSearchResultRow,
                          selected && styles.patientSearchResultRowActive,
                        ]}
                        onPress={() => selecionarPacienteAgendamento(patient)}
                      >
                        <Text style={styles.patientSearchResultName}>{patient.name}</Text>
                        {patient.email ? (
                          <Text style={styles.patientSearchResultMeta}>{patient.email}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyText}>Nenhum paciente encontrado.</Text>
              )
            ) : selectedPatient ? (
              <View style={styles.periodSummaryCard}>
                <Text style={styles.selectedDateLabel}>Selecionado</Text>
                <Text style={styles.selectedDateValue}>{selectedPatient.name}</Text>
                {selectedPatient.email ? (
                  <Text style={styles.selectedDateMeta}>{selectedPatient.email}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.selectedDateMeta}>Digite para buscar um paciente vinculado.</Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>Nenhum paciente vinculado encontrado para agendar.</Text>
        )}

        <View style={styles.dayAgendaDivider} />

        <Text style={styles.filterSectionLabel}>Data</Text>
        {availableDays.length ? (
          <Pressable
            style={[styles.periodSummaryCard, styles.timePickerTrigger]}
            onPress={() => setShowDatePickerModal(true)}
          >
            <View style={styles.timePickerTriggerCopy}>
              <Text style={styles.selectedDateLabel}>Data selecionada</Text>
              <Text style={styles.selectedDateValue}>{form.date || '—'}</Text>
              <Text style={styles.selectedDateMeta}>
                {availableDays.length} dias com vaga na Minha agenda
              </Text>
            </View>
            <Ionicons name="calendar-outline" size={20} color={patientTheme.colors.primaryDark} />
          </Pressable>
        ) : (
          <View style={styles.periodSummaryCard}>
            <Text style={styles.selectedDateValue}>Sem vagas nos próximos 30 dias</Text>
            <Text style={styles.selectedDateMeta}>
              Configure horários na aba Minha agenda.
            </Text>
          </View>
        )}

        <View style={styles.dayAgendaDivider} />

        <Text style={styles.filterSectionLabel}>Horário disponível</Text>
        <Pressable
          style={[styles.periodSummaryCard, styles.timePickerTrigger]}
          onPress={() => {
            if (formDateKey && slotsForSelectedDate.length) setShowTimePickerModal(true);
          }}
          disabled={!formDateKey || !slotsForSelectedDate.length}
        >
          <View style={styles.timePickerTriggerCopy}>
            <Text style={styles.selectedDateLabel}>Horário selecionado</Text>
            <Text style={styles.selectedDateValue}>{form.time || '—'}</Text>
            <Text style={styles.selectedDateMeta}>
              {availableTimeSlots} de {slotsForSelectedDate.length} slots livres em{' '}
              {formatDateLabel(form.date)}
            </Text>
          </View>
          <Ionicons name="time-outline" size={20} color={patientTheme.colors.primaryDark} />
        </Pressable>
        {formDateKey && !selectedSlotValid ? (
          <Text style={styles.slotWarning}>Horário indisponível na Minha agenda.</Text>
        ) : null}

        <View style={styles.dayAgendaDivider} />

        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <Text style={styles.filterSectionLabel}>Tipo</Text>
            <TextInput
              style={styles.input}
              value={form.tipoConsulta}
              onChangeText={(tipoConsulta) => setForm((current) => ({ ...current, tipoConsulta }))}
              placeholder="Teleconsulta"
              placeholderTextColor={patientTheme.colors.textMuted}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.filterSectionLabel}>Convênio</Text>
            <TextInput
              style={styles.input}
              value={form.convenio}
              onChangeText={(convenio) => setForm((current) => ({ ...current, convenio }))}
              placeholder="Particular"
              placeholderTextColor={patientTheme.colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.filterSectionLabel}>Motivo</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.motivo}
          onChangeText={(motivo) => setForm((current) => ({ ...current, motivo }))}
          placeholder="Ex.: retorno mensal, ajuste de plano alimentar..."
          placeholderTextColor={patientTheme.colors.textMuted}
          multiline
        />

        <Text style={styles.filterSectionLabel}>Link do Google Meet</Text>
        <TextInput
          style={styles.input}
          value={form.meetLink}
          onChangeText={(meetLink) => setForm((current) => ({ ...current, meetLink }))}
          placeholder={
            usuarioLogado?.meet_link_padrao || 'https://meet.google.com/xxx-yyyy-zzz'
          }
          placeholderTextColor={patientTheme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.periodSummaryCard}>
          <Text style={styles.selectedDateLabel}>Resumo do agendamento</Text>
          <Text style={styles.selectedDateValue}>
            {selectedPatient?.name || 'Selecione um paciente'}
          </Text>
          <Text style={styles.selectedDateMeta}>{formatDateTimePreview(form.date, form.time)}</Text>
          <Text style={styles.selectedDateMeta}>
            {meetResumo
              ? `Meet: ${meetResumo}`
              : 'Sem link informado — paciente verá o botão Entrar após você confirmar e salvar o Meet.'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.greenCenterButton,
            styles.createSubmitButton,
            !canCreateConsulta && styles.disabledButton,
          ]}
          activeOpacity={0.9}
          disabled={!canCreateConsulta}
          onPress={handleCriarConsulta}
        >
          {savingConsulta ? (
            <ActivityIndicator color={patientTheme.colors.onPrimary} />
          ) : (
            <View style={styles.createSubmitContent}>
              <Ionicons name="calendar" size={16} color={patientTheme.colors.onPrimary} />
              <Text style={styles.greenCenterButtonText}>Agendar consulta</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  function renderConsultaCard(consulta) {
    const patient = consulta.paciente || {};
    const patientName =
      patient.nome_completo || patient.nome_pac || patient.email_pac || 'Paciente';
    const meetLink = resolveMeetLink({ consulta, nutricionista: usuarioLogado });
    const status = normalizeConsultaStatus(consulta.status);
    const canConfirm = status === 'scheduled';
    const canCancel = status !== 'cancelled' && status !== 'done';
    const canDelete = status !== 'done';

    const isActing = actingConsultaId === consulta.id;
    const statusMeta = getConsultaStatusMeta(consulta.status);
    const asidePalette = getConsultaAsidePalette(statusMeta.tone);

    return (
      <View key={consulta.id} style={styles.consultaRow}>
        <Pressable
          style={({ pressed }) => [
            styles.flatCard,
            styles.consultaCard,
            { borderLeftColor: asidePalette.border, borderLeftWidth: 4 },
            pressed && styles.consultaCardPressed,
          ]}
          onPress={() => abrirDetalhesConsulta(consulta)}
        >
          <View style={styles.consultaScheduleCol}>
            <Text style={styles.consultaScheduleTime}>{formatConsultaTime(consulta.scheduled_at)}</Text>
            <Text style={styles.consultaScheduleDate}>{formatConsultaDate(consulta.scheduled_at)}</Text>
          </View>

          <View style={styles.consultaBody}>
            <AvatarBadge name={patientName} size={38} subtle />
            <View style={styles.consultaCopy}>
              <Text style={styles.consultaName} numberOfLines={1}>
                {patientName}
              </Text>
              <View style={styles.consultaMetaRow}>
                <View
                  style={[
                    styles.consultaStatusPill,
                    { backgroundColor: asidePalette.bg, borderColor: asidePalette.border },
                  ]}
                >
                  <Text style={[styles.consultaStatusPillText, { color: asidePalette.fg }]}>
                    {statusMeta.label}
                  </Text>
                </View>
                <Text style={styles.consultaMeta} numberOfLines={1}>
                  {consulta.tipo_consulta || 'Teleconsulta'} · {consulta.convenio || 'Particular'}
                </Text>
              </View>
              {patient.email_pac ? (
                <Text style={styles.consultaEmail} numberOfLines={1}>
                  {patient.email_pac}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.consultaActions}>
            {meetLink ? (
              <Pressable
                style={[styles.meetActionButton, isActing && styles.actionButtonDisabled]}
                onPress={() => handleAbrirMeet(consulta)}
                disabled={isActing}
                accessibilityLabel="Abrir Google Meet"
                hitSlop={6}
              >
                <Ionicons name="videocam-outline" size={14} color={patientTheme.colors.primaryDark} />
              </Pressable>
            ) : null}
            {canConfirm ? (
              <Pressable
                style={[styles.inlineActionButton, isActing && styles.actionButtonDisabled]}
                onPress={() => abrirDialogoAcaoConsulta('confirmed', consulta)}
                disabled={isActing}
                accessibilityLabel="Confirmar consulta"
                hitSlop={6}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={14} color={patientTheme.colors.onPrimary} />
                )}
              </Pressable>
            ) : null}
            {canCancel ? (
              <Pressable
                style={[styles.cancelActionButton, isActing && styles.actionButtonDisabled]}
                onPress={() => abrirDialogoAcaoConsulta('cancelled', consulta)}
                disabled={isActing}
                accessibilityLabel="Cancelar consulta"
                hitSlop={6}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
                ) : (
                  <Ionicons name="close-circle-outline" size={14} color={patientTheme.colors.onPrimary} />
                )}
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                style={[styles.deleteActionButton, isActing && styles.actionButtonDisabled]}
                onPress={() => abrirDialogoAcaoConsulta('delete', consulta)}
                disabled={isActing}
                accessibilityLabel="Excluir consulta"
                hitSlop={6}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color={patientTheme.colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={14} color={patientTheme.colors.danger} />
                )}
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  }

  const consultaDetailPatientName = consultaDetailModal
    ? consultaDetailModal.paciente?.nome_completo ||
      consultaDetailModal.paciente?.nome_pac ||
      consultaDetailModal.paciente?.email_pac ||
      'Paciente'
    : '';
  const consultaDetailMeetDraftNormalized = normalizeGoogleMeetUrl(consultaDetailMeetDraft);
  const consultaDetailMeetDraftValid =
    Boolean(consultaDetailMeetDraftNormalized) &&
    isValidGoogleMeetUrl(consultaDetailMeetDraftNormalized);
  const consultaDetailMeetDirty = consultaDetailModal
    ? (consultaDetailMeetDraftNormalized || '') !==
      (normalizeGoogleMeetUrl(consultaDetailModal.meet_link) || '')
    : false;

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
        {actionFeedback ? (
          <View
            style={[
              styles.actionFeedbackBanner,
              actionFeedback.type === 'error'
                ? styles.actionFeedbackError
                : styles.actionFeedbackSuccess,
            ]}
          >
            <Text
              style={[
                styles.actionFeedbackText,
                actionFeedback.type === 'error'
                  ? styles.actionFeedbackTextError
                  : styles.actionFeedbackTextSuccess,
              ]}
            >
              {actionFeedback.text}
            </Text>
            <TouchableOpacity onPress={() => setActionFeedback(null)} hitSlop={8}>
              <Ionicons
                name="close"
                size={16}
                color={
                  actionFeedback.type === 'error'
                    ? patientTheme.colors.danger
                    : patientTheme.colors.primaryDark
                }
              />
            </TouchableOpacity>
          </View>
        ) : null}

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

        <FilterTabs
          items={AGENDA_TABS}
          active={activeAgendaTab}
          onChange={setActiveAgendaTab}
          compact
          fill
        />

        {activeAgendaTab === 'consultas' ? (
        loading ? (
          <SectionCard style={[styles.flatCard, styles.agendaLoadingCard]}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.emptyText}>Carregando agenda...</Text>
          </SectionCard>
        ) : (
        <>
        <SectionCard style={[styles.dayAgendaPanel, styles.agendaPanel]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderCopy}>
              <Text style={styles.panelTitle}>Consultas</Text>
              <Text style={styles.panelHelper}>
                Visualize e filtre todas as consultas agendadas
              </Text>
            </View>
            <View style={styles.panelHeaderActions}>
              <View
                style={[
                  styles.countBadge,
                  filteredConsultaItems.length > 0 && styles.countBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    filteredConsultaItems.length > 0 && styles.countBadgeTextActive,
                  ]}
                >
                  {filteredConsultaItems.length}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.primaryHeaderButton}
                activeOpacity={0.9}
                onPress={() => setShowCreateForm(true)}
              >
                <Ionicons name="add" size={14} color={patientTheme.colors.onPrimary} />
                <Text style={styles.primaryHeaderButtonText}>Nova Consulta</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.filterSectionLabel}>Período</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilterRow}
          >
            {PERIOD_FILTERS.map((filter) => (
              <ChipFiltro
                key={`period-${filter.id}`}
                label={filter.label}
                icon={filter.icon}
                active={periodFilter === filter.id}
                onPress={() => {
                  setPeriodFilter(filter.id);
                  if (filter.id === 'week') setWeekScope('full');
                }}
                style={styles.statusFilterChip}
              />
            ))}
          </ScrollView>

          {periodFilter === 'week' ? (
            <View style={[styles.periodSummaryCard, styles.weekPeriodPanel]}>
              <View style={styles.weekPeriodBody}>
                <View style={styles.weekPeriodHeader}>
                  <Text style={styles.selectedDateLabel}>Período ativo</Text>
                  <Text style={styles.selectedDateValue}>{periodScopeLabel}</Text>
                  <Text style={styles.selectedDateMeta}>
                    {statusFilter !== 'all'
                      ? `${filteredConsultaItems.length} de ${searchScopedConsultaItems.length} consultas`
                      : `${searchScopedConsultaItems.length} ${searchScopedConsultaItems.length === 1 ? 'consulta' : 'consultas'}`}
                  </Text>
                </View>
                <View style={styles.weekPeriodDaysOverlay}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.weekPeriodDaysScroll}
                  contentContainerStyle={styles.weekDayStripInPanel}
                >
                <TouchableOpacity
                  style={[
                    styles.weekScopeChipInPanel,
                    weekScope === 'full' && styles.weekScopeChipInPanelActive,
                  ]}
                  onPress={() => setWeekScope('full')}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.weekScopeChipText,
                      weekScope === 'full' && styles.weekScopeChipTextActive,
                    ]}
                  >
                    Semana inteira
                  </Text>
                </TouchableOpacity>
                {weekFilterDays.map((day) => {
                  const active = weekScope === 'day' && selectedDayOffset === day.offset;
                  return (
                    <TouchableOpacity
                      key={`week-day-${day.offset}`}
                      style={[
                        styles.weekDayChipInPanel,
                        active && styles.weekDayChipActive,
                        day.count > 0 && styles.weekDayChipInPanelWithBadge,
                      ]}
                      onPress={() => {
                        setSelectedDayOffset(day.offset);
                        setWeekScope('day');
                      }}
                      activeOpacity={0.9}
                    >
                      <Text
                        style={[
                          styles.weekDayChipLabel,
                          styles.weekDayChipInPanelLabel,
                          active && styles.weekDayChipLabelActive,
                        ]}
                      >
                        {day.topLabel}
                      </Text>
                      <Text
                        style={[
                          styles.weekDayChipNumber,
                          styles.weekDayChipInPanelNumber,
                          active && styles.weekDayChipNumberActive,
                        ]}
                      >
                        {day.dayNumber}
                      </Text>
                      {day.count > 0 ? (
                        <View
                          style={[
                            styles.weekDayChipBadge,
                            styles.weekDayChipBadgeInPanel,
                            active && styles.weekDayChipBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.weekDayChipBadgeText,
                              styles.weekDayChipBadgeTextInPanel,
                              active && styles.weekDayChipBadgeTextActive,
                            ]}
                          >
                            {day.count}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                </ScrollView>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.periodSummaryCard}>
              <Text style={styles.selectedDateLabel}>Período ativo</Text>
              <Text style={styles.selectedDateValue}>{periodScopeLabel}</Text>
              <Text style={styles.selectedDateMeta}>
                {statusFilter !== 'all'
                  ? `${filteredConsultaItems.length} de ${searchScopedConsultaItems.length} consultas`
                  : `${searchScopedConsultaItems.length} ${searchScopedConsultaItems.length === 1 ? 'consulta' : 'consultas'}`}
              </Text>
            </View>
          )}

          <View style={styles.dayAgendaDivider} />

          <Text style={styles.filterSectionLabel}>Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilterRow}
          >
            {STATUS_FILTERS.map((filter) => {
              const count = statusCounts[filter.id] ?? 0;
              const label = count > 0 ? `${filter.label} (${count})` : filter.label;
              return (
                <ChipFiltro
                  key={filter.id}
                  label={label}
                  icon={filter.icon}
                  active={statusFilter === filter.id}
                  onPress={() => setStatusFilter(filter.id)}
                  style={styles.statusFilterChip}
                />
              );
            })}
          </ScrollView>
          <CampoBuscaAgendamento
            value={consultaDaySearch}
            onChangeText={setConsultaDaySearch}
            placeholder="Buscar paciente, e-mail ou convênio"
          />

          <View style={styles.panelBody}>
            {loadError ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>{loadError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadAgenda} activeOpacity={0.9}>
                  <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : filteredConsultaItems.length ? (
              <View style={styles.consultaListPanel}>
                <View style={styles.consultaList}>{filteredConsultaItems.map(renderConsultaCard)}</View>
              </View>
            ) : (
              <View style={styles.emptyPanel}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="calendar-outline" size={32} color={patientTheme.colors.primaryDark} />
                </View>
                <Text style={styles.emptyMessageCenter}>
                  {scopedConsultaItems.length
                    ? 'Nenhuma consulta corresponde aos filtros'
                    : formatEmptyConsultaMessage(periodFilter, weekScope, selectedDayOffset, statusFilter)}
                </Text>
                {scopedConsultaItems.length ? (
                  <TouchableOpacity
                    style={styles.retryButton}
                    activeOpacity={0.9}
                    onPress={() => {
                      setStatusFilter('all');
                      setPeriodFilter('week');
                      setWeekScope('full');
                      setConsultaDaySearch('');
                    }}
                  >
                    <Text style={styles.retryButtonText}>Limpar filtros</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.greenCenterButton}
                    activeOpacity={0.9}
                    onPress={() => setShowCreateForm(true)}
                  >
                    <Text style={styles.greenCenterButtonText}>Agendar Consulta</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </SectionCard>
        </>
        )
        ) : null}

        {activeAgendaTab === 'solicitacoes' ? (
        <SectionCard style={[styles.requestsPanel, styles.flatCard]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Solicitações de Acompanhamento</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{requests.length}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.agendaLoadingInline}>
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
                  <View key={request.id} style={[styles.flatCard, styles.requestCard]}>
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
        ) : null}

        {activeAgendaTab === 'minha-agenda' ? (
        <PainelDisponibilidadeAgendaProfissional
          variant="nutri"
          professionalId={nutricionistaId}
          actor={usuarioLogado}
          theme={patientTheme}
        />
        ) : null}
      </View>

      <Modal
        visible={showCreateForm}
        transparent
        animationType="fade"
        onRequestClose={fecharFormularioAgendamento}
      >
        <View style={styles.confirmOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.confirmBackdrop}
            onPress={fecharFormularioAgendamento}
            disabled={savingConsulta}
          />
          <View style={styles.createConsultaModalCard}>
            <ScrollView
              style={styles.createConsultaModalScroll}
              contentContainerStyle={styles.createConsultaModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderCreateConsultaForm()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={fecharSeletorData}
      >
        <View style={styles.confirmOverlay} pointerEvents="box-none">
          <Pressable style={styles.confirmBackdrop} onPress={fecharSeletorData} />
          <View style={styles.timePickerModalCard}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderCopy}>
                <Text style={styles.panelTitle}>Escolher data</Text>
                <Text style={styles.panelHelper}>
                  Datas com vaga conforme Minha agenda
                </Text>
              </View>
              <TouchableOpacity
                style={styles.panelCloseButton}
                activeOpacity={0.9}
                onPress={fecharSeletorData}
              >
                <Ionicons name="close" size={16} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            {availableDays.length ? (
              <View style={styles.patientSearchResults}>
                {availableDays.map((day) => {
                  const selected = day.dateKey === formDateKey;
                  return (
                    <Pressable
                      key={day.dateKey}
                      style={[
                        styles.patientSearchResultRow,
                        selected && styles.patientSearchResultRowActive,
                      ]}
                      onPress={() => selecionarDataAgendamento(day)}
                    >
                      <Text style={styles.patientSearchResultName}>
                        {formatDateKeyToBr(day.dateKey)}
                      </Text>
                      <Text style={styles.patientSearchResultMeta}>
                        {formatDayLabel(day.dateKey)} · {day.slots.length}{' '}
                        {day.slots.length === 1 ? 'vaga' : 'vagas'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nenhuma data disponível na Minha agenda.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimePickerModal}
        transparent
        animationType="fade"
        onRequestClose={fecharSeletorHorario}
      >
        <View style={styles.confirmOverlay} pointerEvents="box-none">
          <Pressable style={styles.confirmBackdrop} onPress={fecharSeletorHorario} />
          <View style={styles.timePickerModalCard}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderCopy}>
                <Text style={styles.panelTitle}>Escolher horário</Text>
                <Text style={styles.panelHelper}>
                  {formatDateLabel(form.date)} · {availableTimeSlots} slots livres
                </Text>
              </View>
              <TouchableOpacity
                style={styles.panelCloseButton}
                activeOpacity={0.9}
                onPress={fecharSeletorHorario}
              >
                <Ionicons name="close" size={16} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            {availableTimeSlots === 0 ? (
              <Text style={styles.emptyText}>Nenhum horário disponível nesta data.</Text>
            ) : null}
            {timeSlotGroupsForPicker.map((group) => (
              <View key={group.id} style={styles.timeSlotGroupModal}>
                <Text style={styles.timeGroupLabelModal}>{group.label}</Text>
                <View style={styles.timeSlotGridModal}>
                  {group.items.map((item, index) => {
                    const selected = form.time === item.time;
                    return (
                      <Pressable
                        key={`${group.id}-${item.time}-${index}`}
                        style={[
                          styles.timeSlotChip,
                          styles.timeSlotChipModal,
                          selected && !item.busy && styles.timeSlotChipActive,
                          item.busy && styles.timeSlotChipBusy,
                        ]}
                        disabled={item.busy}
                        onPress={() => selecionarHorarioAgendamento(item.time)}
                      >
                        <Text
                          style={[
                            styles.timeSlotChipText,
                            selected && !item.busy && styles.timeSlotChipTextActive,
                            item.busy && styles.timeSlotChipTextBusy,
                          ]}
                        >
                          {item.time}
                        </Text>
                        {item.busy ? <Text style={styles.timeSlotChipBusyLabel}>Ocupado</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(consultaDetailModal)}
        transparent
        animationType="fade"
        onRequestClose={fecharDetalhesConsulta}
      >
        <View style={styles.confirmOverlay} pointerEvents="box-none">
          <Pressable style={styles.confirmBackdrop} onPress={fecharDetalhesConsulta} />
          <View style={styles.consultaDetailCard}>
            <Text style={styles.confirmTitle}>{consultaDetailPatientName}</Text>
            <Text style={styles.consultaDetailSubtitle}>
              {formatConsultaDate(consultaDetailModal?.scheduled_at)} ·{' '}
              {formatConsultaTime(consultaDetailModal?.scheduled_at)}
            </Text>

            <View style={styles.consultaDetailField}>
              <Text style={styles.consultaDetailLabel}>Tipo da consulta</Text>
              <Text style={styles.consultaDetailValue}>
                {consultaDetailModal?.tipo_consulta || 'Teleconsulta'}
              </Text>
            </View>
            <View style={styles.consultaDetailField}>
              <Text style={styles.consultaDetailLabel}>Convênio</Text>
              <Text style={styles.consultaDetailValue}>
                {consultaDetailModal?.convenio || 'Particular'}
              </Text>
            </View>
            <View style={styles.consultaDetailField}>
              <Text style={styles.consultaDetailLabel}>Motivo</Text>
              <Text style={styles.consultaDetailValueMultiline}>
                {consultaDetailModal?.motivo?.trim() || 'Não informado'}
              </Text>
            </View>
            <View style={styles.consultaDetailField}>
              <Text style={styles.consultaDetailLabel}>Link do Google Meet</Text>
              <TextInput
                style={styles.input}
                value={consultaDetailMeetDraft}
                onChangeText={(value) => {
                  setConsultaDetailMeetDraft(value);
                  if (consultaDetailMeetError) setConsultaDetailMeetError('');
                }}
                placeholder={
                  usuarioLogado?.meet_link_padrao
                    ? usuarioLogado.meet_link_padrao
                    : 'https://meet.google.com/xxx-yyyy-zzz'
                }
                placeholderTextColor={patientTheme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!savingConsultaDetailMeet}
              />
              {consultaDetailMeetError ? (
                <Text style={styles.consultaDetailMeetError}>{consultaDetailMeetError}</Text>
              ) : (
                <Text style={styles.consultaDetailMeetHint}>
                  Paciente ve o botao Entrar em Minhas consultas apos confirmacao.
                </Text>
              )}
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={fecharDetalhesConsulta}
                disabled={savingConsultaDetailMeet}
              >
                <Text style={styles.confirmCancelText}>Fechar</Text>
              </TouchableOpacity>
              {consultaDetailMeetDraftValid ? (
                <TouchableOpacity
                  style={styles.confirmSecondaryButton}
                  onPress={async () => {
                    try {
                      await abrirLinkGoogleMeet(consultaDetailMeetDraftNormalized);
                    } catch (error) {
                      setConsultaDetailMeetError(
                        error?.message || 'Nao foi possivel abrir o Google Meet.'
                      );
                    }
                  }}
                  disabled={savingConsultaDetailMeet}
                >
                  <Text style={styles.confirmSecondaryText}>Abrir Meet</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.confirmPrimaryButton,
                  (!consultaDetailMeetDirty || savingConsultaDetailMeet) &&
                    styles.confirmPrimaryButtonDisabled,
                ]}
                onPress={salvarMeetLinkDetalhes}
                disabled={!consultaDetailMeetDirty || savingConsultaDetailMeet}
              >
                {savingConsultaDetailMeet ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmPrimaryText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(consultaActionDialog)}
        transparent
        animationType="fade"
        onRequestClose={fecharDialogoAcaoConsulta}
      >
        <View style={styles.confirmOverlay} pointerEvents="box-none">
          <Pressable style={styles.confirmBackdrop} onPress={fecharDialogoAcaoConsulta} />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {CONSULTA_ACTION_COPY[consultaActionDialog?.kind]?.title || 'Confirmar ação'}
            </Text>
            <Text style={styles.confirmMessage}>
              {CONSULTA_ACTION_COPY[consultaActionDialog?.kind]?.message || ''}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={fecharDialogoAcaoConsulta}
              >
                <Text style={styles.confirmCancelText}>Não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmPrimaryButton,
                  CONSULTA_ACTION_COPY[consultaActionDialog?.kind]?.destructive
                    ? styles.confirmPrimaryButtonDanger
                    : null,
                ]}
                onPress={executarAcaoConsultaDialogo}
                disabled={Boolean(actingConsultaId)}
              >
                {actingConsultaId ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      CONSULTA_ACTION_COPY[consultaActionDialog?.kind]?.destructive
                        ? patientTheme.colors.onPrimary
                        : patientTheme.colors.onPrimary
                    }
                  />
                ) : (
                  <Text style={styles.confirmPrimaryText}>
                    {CONSULTA_ACTION_COPY[consultaActionDialog?.kind]?.confirmLabel || 'Confirmar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  flatCard: {
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
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
  dayAgendaPanel: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  agendaPanel: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'column',
    gap: 10,
    overflow: 'visible',
  },
  panelHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  weekPeriodPanel: {
    width: '100%',
    minWidth: 0,
  },
  weekPeriodBody: {
    position: 'relative',
    width: '100%',
    gap: Platform.OS === 'web' ? 0 : 8,
  },
  weekPeriodHeader: {
    position: 'relative',
    zIndex: 2,
    flexShrink: 0,
    width: Platform.OS === 'web' ? 168 : '100%',
    alignItems: 'flex-start',
    pointerEvents: 'none',
  },
  weekPeriodDaysOverlay: Platform.select({
    web: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
      pointerEvents: 'box-none',
    },
    default: {
      width: '100%',
      alignItems: 'center',
    },
  }),
  weekPeriodDaysScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: '100%',
    pointerEvents: 'auto',
  },
  weekDayStripInPanel: {
    gap: 4,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayChipInPanelWithBadge: {
    overflow: 'visible',
  },
  weekDayChipInPanel: {
    width: 34,
    height: 40,
    overflow: 'visible',
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
    gap: 0,
  },
  weekDayChipInPanelLabel: {
    fontSize: 7,
    lineHeight: 9,
  },
  weekDayChipInPanelNumber: {
    fontSize: 11,
    lineHeight: 13,
  },
  weekDayChipBadgeInPanel: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 3,
  },
  weekDayChipBadgeTextInPanel: {
    fontSize: 8,
    lineHeight: 10,
  },
  weekScopeChipInPanel: {
    height: 40,
    paddingHorizontal: 8,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekScopeChipInPanelActive: {
    backgroundColor: patientTheme.colors.primary,
    borderColor: patientTheme.colors.primaryDark,
  },
  periodSummaryCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
  },
  weekScopeChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  weekScopeChipTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  dayAgendaDivider: {
    height: 1,
    backgroundColor: patientTheme.colors.border,
    marginTop: 2,
  },
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  subsectionTitle: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  panelBody: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  consultaListPanel: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    paddingBottom: 4,
  },
  requestsPanel: {
    minHeight: 180,
    backgroundColor: patientTheme.colors.surface,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  createConsultaModalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: Platform.OS === 'web' ? '92vh' : '92%',
    zIndex: 2,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    overflow: 'hidden',
  },
  createConsultaModalScroll: {
    flexGrow: 0,
  },
  createConsultaModalScrollContent: {
    padding: 18,
  },
  createConsultaModalBody: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'column',
    gap: 10,
  },
  panelCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  chipBusyInactive: {
    opacity: 0.55,
    backgroundColor: patientTheme.colors.dangerSoft,
    borderColor: patientTheme.colors.dangerSoft,
  },
  timePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timePickerTriggerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  timePickerModalCard: {
    width: '100%',
    maxWidth: 420,
    zIndex: 2,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: 12,
  },
  timeSlotGroup: {
    gap: 6,
  },
  timeSlotGroupModal: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  timeGroupLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeGroupLabelModal: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
    alignSelf: 'center',
  },
  timeSlotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeSlotGridModal: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  timeSlotChip: {
    minWidth: 76,
    minHeight: 44,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 1,
  },
  timeSlotChipModal: {
    flexGrow: 1,
    flexBasis: Platform.OS === 'web' ? '22%' : '30%',
    maxWidth: Platform.OS === 'web' ? '24%' : '31%',
    minWidth: 72,
  },
  timeSlotChipActive: {
    backgroundColor: patientTheme.colors.primary,
    borderColor: patientTheme.colors.primaryDark,
  },
  timeSlotChipBusy: {
    backgroundColor: patientTheme.colors.dangerSoft,
    borderColor: patientTheme.colors.dangerSoft,
    opacity: 0.72,
  },
  timeSlotChipText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  timeSlotChipTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  timeSlotChipTextBusy: {
    color: patientTheme.colors.danger,
    textDecorationLine: 'line-through',
  },
  timeSlotChipBusyLabel: {
    color: patientTheme.colors.danger,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  patientSearchResults: {
    gap: 6,
  },
  patientSearchResultRow: {
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  patientSearchResultRowActive: {
    borderColor: patientTheme.colors.primary,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  patientSearchResultName: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '700',
  },
  patientSearchResultMeta: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  createSubmitButton: {
    alignSelf: 'stretch',
    marginTop: 2,
  },
  createSubmitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    borderColor: patientTheme.colors.border,
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
    gap: 8,
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  panelTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  panelTitleFlex: {
    flex: 1,
    paddingRight: 10,
  },
  panelHelper: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  weekDayStrip: {
    gap: 8,
    paddingRight: 4,
    alignItems: 'center',
  },
  weekDayChip: {
    width: 52,
    minHeight: 60,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
  },
  weekDayChipActive: {
    backgroundColor: patientTheme.colors.primary,
    borderColor: patientTheme.colors.primaryDark,
  },
  weekDayChipLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  weekDayChipLabelActive: {
    color: patientTheme.colors.onPrimary,
  },
  weekDayChipNumber: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  weekDayChipNumberActive: {
    color: patientTheme.colors.onPrimary,
  },
  weekDayChipBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
  },
  weekDayChipBadgeActive: {
    backgroundColor: patientTheme.colors.onPrimary,
    borderColor: patientTheme.colors.onPrimary,
  },
  weekDayChipBadgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 9,
    fontWeight: '800',
  },
  weekDayChipBadgeTextActive: {
    color: patientTheme.colors.primaryDark,
  },
  filterSectionLabel: {
    marginTop: 4,
    color: patientTheme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusFilterRow: {
    marginTop: 8,
    gap: 6,
    paddingBottom: 2,
  },
  statusFilterChip: {
    minHeight: 30,
    paddingHorizontal: 10,
  },
  selectedDateInfo: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
  },
  selectedDateLabel: {
    color: patientTheme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectedDateValue: {
    marginTop: 4,
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  selectedDateMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
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
  consultaList: {
    width: '100%',
    minWidth: 0,
    marginTop: 8,
    gap: 8,
  },
  requestsList: {
    marginTop: 14,
    gap: 10,
  },
  consultaRow: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  consultaCard: {
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
  consultaCardPressed: {
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  consultaDetailCard: {
    width: '100%',
    maxWidth: 420,
    zIndex: 2,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: 12,
  },
  consultaDetailSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  consultaDetailField: {
    gap: 4,
  },
  consultaDetailLabel: {
    color: patientTheme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  consultaDetailValue: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  consultaDetailValueMultiline: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  consultaScheduleCol: {
    width: 68,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: patientTheme.colors.border,
  },
  consultaScheduleTime: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  consultaScheduleDate: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  consultaBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  consultaCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  consultaName: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  consultaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    marginTop: 2,
  },
  consultaStatusPill: {
    flexShrink: 0,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  consultaStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
  consultaMeta: {
    flex: 1,
    minWidth: 0,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  consultaEmail: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
  },
  actionFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
  },
  actionFeedbackSuccess: {
    backgroundColor: patientTheme.colors.successSoft,
    borderColor: patientTheme.colors.border,
  },
  actionFeedbackError: {
    backgroundColor: patientTheme.colors.dangerSoft,
    borderColor: '#f0d2d2',
  },
  actionFeedbackText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  actionFeedbackTextSuccess: {
    color: patientTheme.colors.primaryDark,
  },
  actionFeedbackTextError: {
    color: patientTheme.colors.danger,
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    zIndex: 2,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: 12,
  },
  confirmTitle: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  confirmMessage: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  confirmCancelButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: patientTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  confirmCancelText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  confirmPrimaryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: patientTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primary,
  },
  confirmPrimaryButtonDanger: {
    backgroundColor: patientTheme.colors.danger,
  },
  confirmPrimaryButtonDisabled: {
    opacity: 0.45,
  },
  confirmSecondaryButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: patientTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
  },
  confirmSecondaryText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  confirmPrimaryText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  consultaDetailMeetError: {
    color: patientTheme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  consultaDetailMeetHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  consultaActions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
    paddingLeft: 2,
    maxWidth: Platform.OS === 'web' ? 148 : 132,
  },
  inlineActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primary,
    borderWidth: 0,
  },
  cancelActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.danger,
    borderWidth: 0,
  },
  deleteActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff4f4',
    borderWidth: 1,
    borderColor: '#f0d2d2',
  },
  meetActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  agendaLoadingCard: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  agendaLoadingInline: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryHeaderButton: {
    minHeight: 44,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.primary,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryHeaderButtonText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyPanel: {
    flex: 1,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
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
    minHeight: 44,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primary,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCenterButtonText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  requestCard: {
    backgroundColor: patientTheme.colors.surface,
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
