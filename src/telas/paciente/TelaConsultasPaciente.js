import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import CalendarioHorarios from '../../componentes/agendamento/CalendarioHorarios';
import CabecalhoModalPaciente from '../../componentes/paciente/CabecalhoModalPaciente';
import FiltrosAgendamentoAvancado, {
  parseDateBrToKey,
} from '../../componentes/agendamento/FiltrosAgendamentoAvancado';
import {
  AvatarProfissional,
  BotaoAgendamento,
  CampoBuscaAgendamento,
  CartaoAgendamento,
  ChipFiltro,
  EsqueletoAgendamento,
} from '../../componentes/agendamento/uiAgendamento';
import { mostrarToastPaciente } from '../../servicos/servicoToastPaciente';
import { resolverMensagemPaciente } from '../../utilitarios/mensagensPaciente';
import { ConsultaStatusBadge } from '../../componentes/comum/ui';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import {
  CONVENIOS_OPCOES,
  TIPOS_CONSULTA_OPCOES,
} from '../../constantes/especialidadesTeleconsulta';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';
import { fetchPatientById, getPatientId } from '../../servicos/servicoDadosPaciente';
import { listNutritionists } from '../../servicos/servicoNutricionistas';
import { filterMedicos, getMedicoEspecialidadeLabel, listMedicos } from '../../servicos/servicoMedicos';
import {
  generateSlotsForNextDays,
  listNutriAvailability,
} from '../../servicos/servicoAgendaNutri';
import {
  abrirLinkGoogleMeet,
  createConsulta,
  formatConsultaDateTime,
  listConsultasByNutricionista,
  listConsultasByPaciente,
  updateConsultaStatus,
} from '../../servicos/servicoConsultas';
import {
  isPatientLinkedToNutritionist,
  resolveAssignedNutritionistIdFromRecords,
} from '../../servicos/servicoVinculosNutricionista';
import { resolveAssignedDoctorIdFromRecords } from '../../servicos/servicoVinculosMedico';
import { resolveNutricionistaIdForPatient } from '../../servicos/servicoMensagensChat';
import { formatValorConsulta, resolveMeetLink } from '../../servicos/servicoGoogleMeet';
import {
  listarNotificacoesConsulta,
  marcarNotificacoesComoLidas,
  subscribeNotificacoesConsulta,
} from '../../servicos/servicoNotificacoesConsulta';
import { criarGuardiaoCarregamentoInicial, executarEmLotes } from '../../utilitarios/carregamentoTela';
import { formatCrmMedico, formatCrnNutricionista } from '../../utilitarios/formatRegistroProfissional';
import {
  getMedicoFotoModeloUri,
  getNutricionistaFotoModeloUri,
} from '../../utilitarios/fotoModeloProfissional';
import {
  filterNutritionists,
  filterSlotsByDateRange,
  filterSlotsByQuick,
  formatDayLabel,
  formatSlotDateKey,
  formatTimeLabel,
  getNutriEspecialidadeLabel,
  getStableExperienceYears,
  getStableRating,
  getStableReviewCount,
  groupSlotsByDay,
  markSlotsWithBooking,
  nutritionistHasSlotsInRange,
} from '../../utilitarios/slotsTeleconsulta';

function maskDateBr(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskConsultaProfissionalFiltro(value) {
  return String(value || '')
    .replace(/[^A-Za-zÀ-ÿ0-9\s./-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 40);
}

function maskConsultaTipoFiltro(value) {
  return String(value || '')
    .replace(/[^A-Za-zÀ-ÿ\s-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 24);
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getNextAvailableSlot(slots) {
  return (slots || []).find((slot) => slot.status === 'available') || null;
}

function getPacienteNome(usuario) {
  return usuario?.nome_completo || usuario?.nome_pac || usuario?.email_pac || 'Paciente';
}

function resolveProfissionalDaConsulta(consulta, nutricionistas, medicos) {
  if (consulta?.medico_id) {
    const medico =
      medicos.find((item) => item.id_medico_uuid === consulta.medico_id) || null;
    return {
      nutri: null,
      medico,
      nome: medico?.nome_completo_medico || 'Médico',
      especialidade: getMedicoEspecialidadeLabel(medico),
      avatarUri: getMedicoFotoModeloUri(medico),
    };
  }

  const nutri =
    nutricionistas.find((item) => item.id_nutricionista_uuid === consulta?.nutricionista_id) ||
    null;

  return {
    nutri,
    medico: null,
    nome: nutri?.nome_completo_nutri || 'Profissional',
    especialidade: getNutriEspecialidadeLabel(nutri),
    avatarUri: getNutricionistaFotoModeloUri(nutri),
  };
}

export default function PacienteAgendamentosScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mensagensSessaoRef = useRef(new Set());

  const [nutricionistas, setNutricionistas] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [consultasPaciente, setConsultasPaciente] = useState([]);
  const [linkedNutricionistaId, setLinkedNutricionistaId] = useState(null);
  const [linkedMedicoId, setLinkedMedicoId] = useState(null);
  const [selectedNutri, setSelectedNutri] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [lastBooking, setLastBooking] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState(route?.params?.activeSection || 'agendar');
  const [consultasSearchQuery, setConsultasSearchQuery] = useState('');
  const [consultasSection, setConsultasSection] = useState('agendadas');
  const [consultasFiltrosAbertos, setConsultasFiltrosAbertos] = useState(false);
  const [consultasProfissionalFiltro, setConsultasProfissionalFiltro] = useState('');
  const [consultasTipoFiltro, setConsultasTipoFiltro] = useState('');
  const [consultasDataFiltro, setConsultasDataFiltro] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
  const [tipoConsulta, setTipoConsulta] = useState(TIPOS_CONSULTA_OPCOES[0]);
  const [convenio, setConvenio] = useState(CONVENIOS_OPCOES[0]);
  const [especialidadeFiltro, setEspecialidadeFiltro] = useState('Todas');
  const [dateFromBr, setDateFromBr] = useState('');
  const [dateToBr, setDateToBr] = useState('');
  const [maxValorReais, setMaxValorReais] = useState('');
  const [ratingMinimo, setRatingMinimo] = useState('');
  const [somenteConvenio, setSomenteConvenio] = useState(false);
  const [ordenacao, setOrdenacao] = useState('relevancia');

  const [notificacoes, setNotificacoes] = useState([]);
  const [notificacoesModal, setNotificacoesModal] = useState(false);
  const [nutrisComAgendaIds, setNutrisComAgendaIds] = useState(new Set());
  const [loadingNutrisDisponiveis, setLoadingNutrisDisponiveis] = useState(false);
  const loadGuardRef = React.useRef(criarGuardiaoCarregamentoInicial());

  useFocusEffect(
    useCallback(() => {
      mensagensSessaoRef.current = new Set();
      return undefined;
    }, [])
  );

  const exibirMensagemAgendamentos = useCallback((payload) => {
    const resolved = resolverMensagemPaciente(payload);
    const chave = `${resolved.tipo}|${resolved.texto}|${resolved.subtexto}`;
    if (mensagensSessaoRef.current.has(chave)) return;
    mensagensSessaoRef.current.add(chave);
    mostrarToastPaciente(resolved);
  }, []);

  const dateFromKey = useMemo(() => parseDateBrToKey(dateFromBr), [dateFromBr]);
  const dateToKey = useMemo(() => parseDateBrToKey(dateToBr), [dateToBr]);
  const maxValorCentavos = useMemo(() => {
    const reais = Number(String(maxValorReais).replace(',', '.'));
    if (!reais || Number.isNaN(reais)) return 0;
    return Math.round(reais * 100);
  }, [maxValorReais]);

  const filterParams = useMemo(
    () => ({
      query: searchQuery,
      quickFilter,
      especialidade: especialidadeFiltro,
      convenio,
      maxValorCentavos,
      ratingMinimo,
      somenteConvenio,
    }),
    [
      searchQuery,
      quickFilter,
      especialidadeFiltro,
      convenio,
      maxValorCentavos,
      ratingMinimo,
      somenteConvenio,
    ]
  );

  const filtrosAtivos = useMemo(
    () =>
      [
        quickFilter !== 'all',
        tipoConsulta !== TIPOS_CONSULTA_OPCOES[0],
        convenio !== CONVENIOS_OPCOES[0],
        especialidadeFiltro !== 'Todas',
        Boolean(dateFromBr),
        Boolean(dateToBr),
        Boolean(maxValorReais),
        Boolean(ratingMinimo),
        somenteConvenio,
        ordenacao !== 'relevancia',
      ].filter(Boolean).length,
    [
      quickFilter,
      tipoConsulta,
      convenio,
      especialidadeFiltro,
      dateFromBr,
      dateToBr,
      maxValorReais,
      ratingMinimo,
      somenteConvenio,
      ordenacao,
    ]
  );

  const loadBase = useCallback(async () => {
    try {
      setLoadError(null);
      const [nutris, meds, cons, pacienteAtual] = await Promise.all([
        listNutritionists(),
        listMedicos(),
        patientId ? listConsultasByPaciente(patientId, { limit: 60 }) : Promise.resolve([]),
        patientId
          ? fetchPatientById(patientId, {
              currentPatient: usuarioLogado,
              patientContext: usuarioLogado,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      let linkedId = resolveAssignedNutritionistIdFromRecords({
        patient: pacienteAtual,
        consultas: cons,
      });
      const linkedMedId = resolveAssignedDoctorIdFromRecords({
        patient: pacienteAtual,
        consultas: cons,
      });

      if (!linkedId && patientId) {
        linkedId = await resolveNutricionistaIdForPatient(patientId, null);
      }

      setNutricionistas(nutris || []);
      setMedicos(meds || []);
      setConsultasPaciente(cons || []);
      setLinkedNutricionistaId(linkedId);
      setLinkedMedicoId(linkedMedId);

      const routeNutriId = route?.params?.selectedNutriId;
      const preferredNutriId = linkedId || routeNutriId;
      if (preferredNutriId) {
        const found = (nutris || []).find((n) => n.id_nutricionista_uuid === preferredNutriId);
        if (found) setSelectedNutri(found);
      } else {
        setSelectedNutri((prev) => {
          if (!prev?.id_nutricionista_uuid) return null;
          return (
            (nutris || []).find(
              (item) => item.id_nutricionista_uuid === prev.id_nutricionista_uuid
            ) || null
          );
        });
      }

      if (route?.params?.tipoConsulta) {
        setTipoConsulta(route.params.tipoConsulta);
      }
      if (route?.params?.convenio) {
        setConvenio(route.params.convenio);
      }
    } catch (error) {
      console.log('Erro ao carregar agendamento:', error);
      setLoadError('Não foi possível carregar os profissionais. Verifique a conexão e tente novamente.');
    }
  }, [
    patientId,
    route?.params?.selectedNutriId,
    route?.params?.tipoConsulta,
    route?.params?.convenio,
    usuarioLogado,
  ]);

  const loadSlots = useCallback(async () => {
    if (!selectedNutri?.id_nutricionista_uuid) {
      setSlots([]);
      return;
    }

    try {
      setLoadingSlots(true);
      const nutriId = selectedNutri.id_nutricionista_uuid;
      const [avail, consultasNutri] = await Promise.all([
        listNutriAvailability(nutriId),
        listConsultasByNutricionista(nutriId, { limit: 60 }),
      ]);
      const generated = generateSlotsForNextDays(avail, { days: 21 });
      const marked = markSlotsWithBooking(generated, consultasNutri);
      const byQuick = filterSlotsByQuick(marked, quickFilter);
      const byDate = filterSlotsByDateRange(byQuick, {
        dateFrom: dateFromKey,
        dateTo: dateToKey,
      });
      setSlots(byDate);
    } catch (error) {
      console.log('Erro ao carregar horarios:', error);
      setSlots([]);
      exibirMensagemAgendamentos({
        tipo: 'erro',
        texto: 'Não foi possível carregar os horários deste profissional.',
      });
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedNutri, quickFilter, dateFromKey, dateToKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await loadBase();
      if (active) {
        setLoading(false);
        loadGuardRef.current.marcarCarregado();
      }
    })();
    return () => {
      active = false;
    };
  }, [loadBase]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (loadGuardRef.current.deveIgnorarCarregamentoFocus()) return;
      loadBase();
    });
    return unsubscribe;
  }, [navigation, loadBase]);

  useEffect(() => {
    if (route?.params?.activeSection) {
      setActiveSection(route.params.activeSection);
    }
  }, [route?.params?.activeSection]);

  useEffect(() => {
    loadSlots();
    setSelectedSlot(null);
  }, [loadSlots]);

  useEffect(() => {
    if (!patientId) return undefined;

    return subscribeNotificacoesConsulta({
      destinatarioTipo: 'paciente',
      destinatarioId: patientId,
      intervalMs: 18000,
      onChange: (items) => {
        setNotificacoes(items || []);
        const latest = items?.[0];
        if (latest && !latest._shown) {
          latest._shown = true;
          exibirMensagemAgendamentos({
            tipo: latest.evento === 'cancelada' ? 'aviso' : 'sucesso',
            texto: latest.mensagem || latest.titulo,
          });
        }
      },
    });
  }, [patientId]);

  async function abrirPainelNotificacoes() {
    if (!patientId) return;
    try {
      const items = await listarNotificacoesConsulta({
        destinatarioTipo: 'paciente',
        destinatarioId: patientId,
        limit: 30,
      });
      setNotificacoes(items || []);
      setNotificacoesModal(true);
      await marcarNotificacoesComoLidas({
        destinatarioTipo: 'paciente',
        destinatarioId: patientId,
      });
    } catch (error) {
      exibirMensagemAgendamentos({
        tipo: 'erro',
        texto: 'Não foi possível carregar as notificações.',
      });
    }
  }

  useEffect(() => {
    navigation.setOptions({
      readerTitle: 'Agendamentos',
      readerNotificationCount: notificacoes.length,
      readerNotificationDisabled: false,
      readerOnNotificationPress: abrirPainelNotificacoes,
    });
  }, [navigation, notificacoes.length, patientId]);

  const filteredNutrisBase = useMemo(() => {
    let list = filterNutritionists(nutricionistas, filterParams);

    if (ordenacao === 'preco') {
      list = [...list].sort(
        (a, b) =>
          Number(a.valor_consulta_centavos || 0) - Number(b.valor_consulta_centavos || 0)
      );
    } else if (ordenacao === 'avaliacao') {
      list = [...list].sort(
        (a, b) =>
          Number(getStableRating(b.id_nutricionista_uuid)) -
          Number(getStableRating(a.id_nutricionista_uuid))
      );
    }

    return list;
  }, [nutricionistas, filterParams, ordenacao, linkedNutricionistaId]);

  useEffect(() => {
    let active = true;

    async function carregarDisponibilidadeReal() {
      if (!filteredNutrisBase.length) {
        if (active) {
          setNutrisComAgendaIds(new Set());
          setLoadingNutrisDisponiveis(false);
        }
        return;
      }

      try {
        if (active) setLoadingNutrisDisponiveis(true);

        const checks = await executarEmLotes(filteredNutrisBase, 6, async (nutri) => {
          const nutriId = nutri?.id_nutricionista_uuid;
          if (!nutriId) return null;

          try {
            const [availabilityRows, consultasNutri] = await Promise.all([
              listNutriAvailability(nutriId),
              listConsultasByNutricionista(nutriId, { limit: 60 }),
            ]);

            const generated = generateSlotsForNextDays(availabilityRows, { days: 14 });
            const marked = markSlotsWithBooking(generated, consultasNutri);
            const byQuick = filterSlotsByQuick(marked, quickFilter);

            const hasAvailable = nutritionistHasSlotsInRange(byQuick, {
              dateFrom: dateFromKey,
              dateTo: dateToKey,
            });

            return hasAvailable ? nutriId : null;
          } catch (error) {
            console.log('Erro ao verificar disponibilidade do profissional:', error);
            return null;
          }
        });

        if (!active) return;
        setNutrisComAgendaIds(new Set(checks.filter(Boolean)));
      } finally {
        if (active) setLoadingNutrisDisponiveis(false);
      }
    }

    carregarDisponibilidadeReal();

    return () => {
      active = false;
    };
  }, [filteredNutrisBase, quickFilter, dateFromKey, dateToKey]);

  const assignedNutri = useMemo(() => {
    if (!linkedNutricionistaId) return null;
    return (
      (nutricionistas || []).find(
        (nutri) => nutri.id_nutricionista_uuid === linkedNutricionistaId
      ) ||
      filteredNutrisBase.find(
        (nutri) => nutri.id_nutricionista_uuid === linkedNutricionistaId
      ) ||
      null
    );
  }, [filteredNutrisBase, linkedNutricionistaId, nutricionistas]);

  const filteredNutris = useMemo(() => {
    const others = filteredNutrisBase.filter(
      (nutri) => nutri.id_nutricionista_uuid !== linkedNutricionistaId
    );

    if (assignedNutri) {
      return [assignedNutri, ...others];
    }

    return filteredNutrisBase;
  }, [assignedNutri, filteredNutrisBase, linkedNutricionistaId]);

  const outrosNutrisDisponiveis = useMemo(
    () =>
      filteredNutris.filter(
        (nutri) => nutri.id_nutricionista_uuid !== linkedNutricionistaId
      ),
    [filteredNutris, linkedNutricionistaId]
  );

  const filteredMedicosBase = useMemo(() => {
    let list = filterMedicos(medicos, filterParams);

    if (ordenacao === 'preco') {
      list = [...list].sort(
        (a, b) =>
          Number(a.valor_consulta_centavos || 0) - Number(b.valor_consulta_centavos || 0)
      );
    } else if (ordenacao === 'avaliacao') {
      list = [...list].sort(
        (a, b) =>
          Number(getStableRating(b.id_medico_uuid)) - Number(getStableRating(a.id_medico_uuid))
      );
    }

    return list;
  }, [medicos, filterParams, ordenacao]);

  const assignedMedico = useMemo(() => {
    if (!linkedMedicoId) return null;
    return (
      (medicos || []).find((medico) => medico.id_medico_uuid === linkedMedicoId) ||
      filteredMedicosBase.find((medico) => medico.id_medico_uuid === linkedMedicoId) ||
      null
    );
  }, [filteredMedicosBase, linkedMedicoId, medicos]);

  const filteredMedicos = useMemo(() => {
    const others = filteredMedicosBase.filter(
      (medico) => medico.id_medico_uuid !== linkedMedicoId
    );

    if (assignedMedico) {
      return [assignedMedico, ...others];
    }

    return filteredMedicosBase;
  }, [assignedMedico, filteredMedicosBase, linkedMedicoId]);

  const outrosMedicos = useMemo(
    () =>
      filteredMedicos.filter((medico) => medico.id_medico_uuid !== linkedMedicoId),
    [filteredMedicos, linkedMedicoId]
  );

  const calendarDays = useMemo(() => groupSlotsByDay(slots), [slots]);

  useEffect(() => {
    if (!calendarDays.length) {
      setSelectedDayKey('');
      return;
    }
    if (!selectedDayKey || !calendarDays.some((d) => d.dateKey === selectedDayKey)) {
      setSelectedDayKey(calendarDays[0].dateKey);
    }
  }, [calendarDays, selectedDayKey]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBase();
    await loadSlots();
    setRefreshing(false);
  }, [loadBase, loadSlots]);

  const proximasConsultas = useMemo(() => {
    const now = Date.now();
    return (consultasPaciente || [])
      .filter((item) => {
        const dt = new Date(item.scheduled_at || 0);
        return !Number.isNaN(dt.getTime()) && dt.getTime() >= now && item.status !== 'cancelled';
      })
      .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
      .slice(0, 8);
  }, [consultasPaciente]);

  const consultasAnteriores = useMemo(() => {
    const now = Date.now();
    return (consultasPaciente || [])
      .filter((item) => {
        const dt = new Date(item.scheduled_at || 0);
        if (Number.isNaN(dt.getTime())) return false;
        return dt.getTime() < now || item.status === 'cancelled';
      })
      .sort((a, b) => String(b.scheduled_at).localeCompare(String(a.scheduled_at)))
      .slice(0, 12);
  }, [consultasPaciente]);

  const consultasSearchNormalized = useMemo(
    () => normalizeSearchText(consultasSearchQuery),
    [consultasSearchQuery]
  );
  const consultasProfissionalNormalized = useMemo(
    () => normalizeSearchText(consultasProfissionalFiltro),
    [consultasProfissionalFiltro]
  );
  const consultasTipoNormalized = useMemo(
    () => normalizeSearchText(consultasTipoFiltro),
    [consultasTipoFiltro]
  );
  const consultasDataNormalized = useMemo(
    () => normalizeSearchText(consultasDataFiltro),
    [consultasDataFiltro]
  );

  const filterConsultasByQuery = useCallback(
    (items) =>
      (items || []).filter((item) => {
        const profissional = resolveProfissionalDaConsulta(item, nutricionistas, medicos);
        const profissionalText = normalizeSearchText(
          [profissional.nome, profissional.especialidade].join(' ')
        );
        const tipoText = normalizeSearchText(item?.tipo_consulta);
        const dataText = normalizeSearchText(formatConsultaDateTime(item?.scheduled_at));
        const searchable = normalizeSearchText(
          [profissionalText, tipoText, item?.convenio, item?.status, dataText].join(' ')
        );

        if (consultasSearchNormalized && !searchable.includes(consultasSearchNormalized)) return false;
        if (consultasProfissionalNormalized && !profissionalText.includes(consultasProfissionalNormalized)) return false;
        if (consultasTipoNormalized && !tipoText.includes(consultasTipoNormalized)) return false;
        if (consultasDataNormalized && !dataText.includes(consultasDataNormalized)) return false;
        return true;
      }),
    [
      consultasDataNormalized,
      consultasProfissionalNormalized,
      consultasSearchNormalized,
      consultasTipoNormalized,
      medicos,
      nutricionistas,
    ]
  );

  const proximasConsultasFiltradas = useMemo(
    () => filterConsultasByQuery(proximasConsultas),
    [filterConsultasByQuery, proximasConsultas]
  );

  const consultasAnterioresFiltradas = useMemo(
    () => filterConsultasByQuery(consultasAnteriores),
    [consultasAnteriores, filterConsultasByQuery]
  );

  const proximaConsultaResumo = proximasConsultas[0] || null;
  const resumoVisivel = activeSection === 'agendar' && Boolean(selectedNutri && selectedSlot);
  const showCalendar = Boolean(selectedNutri);
  const disponibilidadeDireta = Boolean(route?.params?.openCalendar && selectedNutri);

  function limparFiltrosAvancados() {
    setTipoConsulta(TIPOS_CONSULTA_OPCOES[0]);
    setConvenio(CONVENIOS_OPCOES[0]);
    setEspecialidadeFiltro('Todas');
    setDateFromBr('');
    setDateToBr('');
    setMaxValorReais('');
    setRatingMinimo('');
    setSomenteConvenio(false);
    setOrdenacao('relevancia');
  }

  function handleSelecionarProfissional(nutri, options = {}) {
    setSelectedSlot(null);
    setSelectedNutri(nutri);

    if (options.openCalendar) {
      navigation.setParams({
        selectedNutriId: nutri?.id_nutricionista_uuid || null,
        openCalendar: true,
      });
    }
  }

  function handleCancelarFluxoAgendamento() {
    setSelectedSlot(null);
    setSelectedDayKey('');
    setSelectedNutri(null);
    navigation.setParams({
      selectedNutriId: null,
      openCalendar: false,
    });
  }

  async function handleConfirmarConsulta() {
    if (!selectedSlot || !selectedNutri?.id_nutricionista_uuid || !patientId) {
      exibirMensagemAgendamentos({ tipo: 'aviso', texto: 'Selecione um horário disponível para continuar.' });
      return;
    }

    try {
      setConfirming(true);
      const linked = await isPatientLinkedToNutritionist({
        pacienteId: patientId,
        nutricionistaId: selectedNutri.id_nutricionista_uuid,
      });

      if (!linked) {
        exibirMensagemAgendamentos({
          tipo: 'aviso',
          texto:
            'Solicite o acompanhamento primeiro. Depois que a nutricionista aprovar, o agendamento fica liberado.',
        });
        return;
      }

      const saved = await createConsulta({
        nutricionistaId: selectedNutri.id_nutricionista_uuid,
        pacienteId: patientId,
        scheduledAt: selectedSlot.scheduledAt,
        motivo: `${tipoConsulta} · ${convenio} · ${getNutriEspecialidadeLabel(selectedNutri)}`,
        tipoConsulta,
        convenio,
        especialidade: getNutriEspecialidadeLabel(selectedNutri),
        valorCentavos: selectedNutri.valor_consulta_centavos,
        nutricionista: selectedNutri,
        pacienteNome: getPacienteNome(usuarioLogado),
        actor: usuarioLogado,
      });

      setLastBooking({
        consulta: saved,
        nutri: selectedNutri,
        slot: selectedSlot,
        tipoConsulta,
        convenio,
        meetLink: resolveMeetLink({ consulta: saved, nutricionista: selectedNutri }),
      });

      setConfirmModalVisible(true);
      setSelectedSlot(null);
      await loadBase();
      await loadSlots();
    } catch (error) {
      console.log('Erro ao confirmar:', error);
      exibirMensagemAgendamentos({
        tipo: 'erro',
        texto:
          error?.message ||
          'Não foi possível confirmar o agendamento. Verifique a conexão e tente novamente.',
      });
    } finally {
      setConfirming(false);
    }
  }

  async function handleAbrirMeet(consulta, nutri) {
    const link = resolveMeetLink({ consulta, nutricionista: nutri });
    try {
      await abrirLinkGoogleMeet(link);
    } catch (error) {
      exibirMensagemAgendamentos({
        tipo: 'erro',
        texto: error?.message || 'Não foi possível abrir o Google Meet.',
      });
    }
  }

  async function handleCancelarConsulta(item, nutri) {
    try {
      await updateConsultaStatus({
        consultaId: item.id,
        status: 'cancelled',
        nutricionista: nutri,
        actor: usuarioLogado,
        origin: 'agendamentos_paciente',
      });
      exibirMensagemAgendamentos({
        tipo: 'sucesso',
        texto: 'Consulta cancelada com sucesso.',
      });
      await loadBase();
      if (selectedNutri?.id_nutricionista_uuid === nutri?.id_nutricionista_uuid) {
        await loadSlots();
      }
    } catch (error) {
      exibirMensagemAgendamentos({
        tipo: 'erro',
        texto: error?.message || 'Não foi possível cancelar a consulta.',
      });
    }
  }

  async function handleConfirmarConsultaAgendada(item, nutri) {
    try {
      await updateConsultaStatus({
        consultaId: item.id,
        status: 'confirmed',
        nutricionista: nutri,
        actor: usuarioLogado,
        origin: 'agendamentos_paciente',
      });
      exibirMensagemAgendamentos({
        tipo: 'sucesso',
        texto: 'Consulta confirmada com sucesso.',
      });
      await loadBase();
      if (selectedNutri?.id_nutricionista_uuid === nutri?.id_nutricionista_uuid) {
        await loadSlots();
      }
    } catch (error) {
      exibirMensagemAgendamentos({
        tipo: 'erro',
        texto: error?.message || 'Não foi possível confirmar a consulta.',
      });
    }
  }

  const footerOverlay = resumoVisivel ? (
    <CartaoAgendamento style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Resumo do agendamento</Text>
      <Text style={styles.summaryLine}>
        {selectedNutri?.nome_completo_nutri} · {getNutriEspecialidadeLabel(selectedNutri)}
      </Text>
      <Text style={styles.summaryLine}>
        {formatDayLabel(formatSlotDateKey(selectedSlot.scheduledAt))} as{' '}
        {formatTimeLabel(selectedSlot.scheduledAt)}
      </Text>
      <Text style={styles.summaryLine}>{tipoConsulta} · {convenio} · Google Meet</Text>
      <Text style={styles.summaryLine}>
        {formatValorConsulta(selectedNutri?.valor_consulta_centavos)}
      </Text>
      <View style={styles.summaryActions}>
        <BotaoAgendamento
          label="Cancelar"
          variant="ghost"
          onPress={handleCancelarFluxoAgendamento}
          style={styles.summarySecondaryBtn}
        />
        <BotaoAgendamento
          label="Confirmar consulta"
          onPress={handleConfirmarConsulta}
          loading={confirming}
          icon="checkmark-circle-outline"
          style={styles.summaryPrimaryBtn}
        />
      </View>
    </CartaoAgendamento>
  ) : null;

  function renderNutriCard(nutri, options = {}) {
    const { forceLinked = false } = options;
    const spec = getNutriEspecialidadeLabel(nutri);
    const ratingReal =
      Number.isFinite(Number(nutri?.rating_media)) && Number(nutri?.rating_media) > 0
        ? Number(nutri.rating_media).toFixed(1)
        : getStableRating(nutri?.id_nutricionista_uuid);
    const totalAvaliacoesReal =
      Number.isFinite(Number(nutri?.total_avaliacoes)) && Number(nutri?.total_avaliacoes) > 0
        ? Number(nutri.total_avaliacoes)
        : getStableReviewCount(nutri?.id_nutricionista_uuid);
    const expAnosReal =
      Number.isFinite(Number(nutri?.anos_experiencia)) && Number(nutri?.anos_experiencia) > 0
        ? Number(nutri.anos_experiencia)
        : getStableExperienceYears(nutri?.id_nutricionista_uuid);
    const rating = ratingReal;
    const totalAvaliacoes = totalAvaliacoesReal;
    const expAnos = expAnosReal;
    const isLinkedNutri =
      forceLinked || linkedNutricionistaId === nutri.id_nutricionista_uuid;
    const hasAgenda = nutrisComAgendaIds.has(nutri.id_nutricionista_uuid);
    const bioPreview =
      nutri.bio_resumo ||
      'Especialista em teleconsulta com foco em estratégias nutricionais personalizadas.';

    return (
      <CartaoAgendamento
        key={nutri.id_nutricionista_uuid}
        style={[styles.proCard, isLinkedNutri && styles.proCardLinked]}
        onPress={() =>
          navigation.push('PacientePerfilNutricionista', {
            usuarioLogado,
            nutricionista: nutri,
            tipoConsulta,
            convenio,
          })
        }
      >
        {isLinkedNutri ? (
          <View style={styles.linkedBadge}>
            <Ionicons name="checkmark-circle" size={15} color={patientTheme.colors.primaryDark} />
            <Text style={styles.linkedBadgeText}>Nutricionista vinculado</Text>
          </View>
        ) : null}

        <View style={styles.proRow}>
          <AvatarProfissional
            name={nutri.nome_completo_nutri}
            size={56}
            online
            imageUri={getNutricionistaFotoModeloUri(nutri)}
          />
          <View style={styles.proBody}>
            <Text style={styles.proName}>{nutri.nome_completo_nutri}</Text>
            <Text style={styles.proSpec}>{spec} · Google Meet</Text>
            <Text style={styles.proCrn}>
              {formatCrnNutricionista(nutri.crm_numero)}
            </Text>

            <Text numberOfLines={1} style={styles.proSpecVisible}>
              {spec}
            </Text>
            <View style={styles.proMetaRow}>
              <Ionicons name="star" size={14} color={patientTheme.colors.warning} />
              <Text style={styles.proMeta}>{rating}</Text>
              <Text style={styles.proMetaDot}>·</Text>
              <Text style={styles.proMeta}>{totalAvaliacoes} avaliações</Text>
              <Text style={styles.proMetaDot}>·</Text>
              <Text style={styles.proMetaDot}>·</Text>
              <Text style={styles.proMetaDot}>·</Text>
              <Text style={styles.proMeta}>{expAnos} anos de experiência</Text>
            </View>
            <Text style={styles.proMetaSummary}>
              {totalAvaliacoes} avaliações · {expAnos} anos de experiência
            </Text>
            <View style={styles.proMetaRowCompact}>
              <Ionicons name="star" size={14} color={patientTheme.colors.warning} />
              <Text style={styles.proMeta}>{rating}</Text>
              <Text style={styles.proMeta}>({totalAvaliacoes})</Text>
              <Text style={styles.proMetaDot}>·</Text>
              <Text style={styles.proMeta}>{expAnos} anos de experiência</Text>
            </View>
            <Text numberOfLines={2} style={styles.proBio}>
              {bioPreview}
            </Text>
            <Text style={[styles.proAvailability, hasAgenda ? styles.proAvailabilityOpen : null]}>
              {hasAgenda ? 'Agenda disponível no período selecionado' : 'Sem agenda no período selecionado'}
            </Text>
          </View>
        </View>

        <View style={styles.proHighlights}>
          <View style={styles.highlightPill}>
            <Ionicons name="cash-outline" size={14} color={patientTheme.colors.primaryDark} />
            <Text style={styles.highlightText}>
              {formatValorConsulta(nutri.valor_consulta_centavos)}
            </Text>
          </View>
          <View style={styles.highlightPill}>
            <Ionicons
              name={nutri.aceita_convenio ? 'shield-checkmark-outline' : 'card-outline'}
              size={14}
              color={patientTheme.colors.primaryDark}
            />
            <Text style={styles.highlightText}>
              {nutri.aceita_convenio ? 'Aceita convênio' : 'Particular'}
            </Text>
          </View>
        </View>

        <View style={styles.proActions}>
          <BotaoAgendamento
            label={isLinkedNutri ? 'Ver acompanhamento' : 'Ver Perfil'}
            icon={isLinkedNutri ? 'checkmark-circle-outline' : 'person-circle-outline'}
            onPress={(event) => {
              event?.stopPropagation?.();
              navigation.push('PacientePerfilNutricionista', {
                usuarioLogado,
                nutricionista: nutri,
                tipoConsulta,
                convenio,
                openSchedulePopup: false,
              });
            }}
            style={styles.proScheduleBtn}
          />
        </View>
      </CartaoAgendamento>
    );
  }

  function renderMedicoCard(medico, options = {}) {
    const { forceLinked = false } = options;
    const spec = getMedicoEspecialidadeLabel(medico);
    const ratingReal =
      Number.isFinite(Number(medico?.rating_media)) && Number(medico?.rating_media) > 0
        ? Number(medico.rating_media).toFixed(1)
        : getStableRating(medico?.id_medico_uuid);
    const totalAvaliacoesReal =
      Number.isFinite(Number(medico?.total_avaliacoes)) && Number(medico?.total_avaliacoes) > 0
        ? Number(medico.total_avaliacoes)
        : getStableReviewCount(medico?.id_medico_uuid);
    const expAnosReal =
      Number.isFinite(Number(medico?.anos_experiencia)) && Number(medico?.anos_experiencia) > 0
        ? Number(medico.anos_experiencia)
        : getStableExperienceYears(medico?.id_medico_uuid);
    const rating = ratingReal;
    const totalAvaliacoes = totalAvaliacoesReal;
    const expAnos = expAnosReal;
    const isLinkedMedico = forceLinked || linkedMedicoId === medico.id_medico_uuid;
    const bioPreview =
      medico.bio_resumo ||
      'Acompanhamento clínico de diabetes, glicemia, medicação e insulina por teleconsulta.';

    return (
      <CartaoAgendamento
        key={medico.id_medico_uuid}
        style={[styles.proCard, isLinkedMedico && styles.proCardLinked]}
        onPress={() =>
          navigation.push('PacientePerfilMedico', {
            usuarioLogado,
            medico,
          })
        }
      >
        {isLinkedMedico ? (
          <View style={styles.linkedBadge}>
            <Ionicons name="checkmark-circle" size={15} color={patientTheme.colors.primaryDark} />
            <Text style={styles.linkedBadgeText}>Médico vinculado</Text>
          </View>
        ) : null}

        <View style={styles.proRow}>
          <AvatarProfissional
            name={medico.nome_completo_medico}
            size={56}
            online
            imageUri={getMedicoFotoModeloUri(medico)}
          />
          <View style={styles.proBody}>
            <Text style={styles.proName}>{medico.nome_completo_medico}</Text>
            <Text style={styles.proSpec}>{spec} · Teleconsulta</Text>
            <Text style={styles.proCrn}>
              {formatCrmMedico(medico.crm_medico)}
            </Text>

            <Text numberOfLines={1} style={styles.proSpecVisible}>
              {spec}
            </Text>
            <View style={styles.proMetaRowCompact}>
              <Ionicons name="star" size={14} color={patientTheme.colors.warning} />
              <Text style={styles.proMeta}>{rating}</Text>
              <Text style={styles.proMeta}>({totalAvaliacoes})</Text>
              <Text style={styles.proMetaDot}>·</Text>
              <Text style={styles.proMeta}>{expAnos} anos de experiência</Text>
            </View>
            <Text numberOfLines={2} style={styles.proBio}>
              {bioPreview}
            </Text>
            <Text style={[styles.proAvailability, styles.proAvailabilityOpen]}>
              {isLinkedMedico
                ? 'Médico responsável pelo seu acompanhamento clínico'
                : 'Disponível para vínculo de acompanhamento clínico'}
            </Text>
          </View>
        </View>

        <View style={styles.proHighlights}>
          <View style={styles.highlightPill}>
            <Ionicons name="cash-outline" size={14} color={patientTheme.colors.primaryDark} />
            <Text style={styles.highlightText}>
              {formatValorConsulta(medico.valor_consulta_centavos)}
            </Text>
          </View>
          <View style={styles.highlightPill}>
            <Ionicons
              name={medico.aceita_convenio ? 'shield-checkmark-outline' : 'card-outline'}
              size={14}
              color={patientTheme.colors.primaryDark}
            />
            <Text style={styles.highlightText}>
              {medico.aceita_convenio ? 'Aceita convênio' : 'Particular'}
            </Text>
          </View>
        </View>

        <View style={styles.proActions}>
          <BotaoAgendamento
            label={isLinkedMedico ? 'Ver acompanhamento' : 'Ver Perfil'}
            icon={isLinkedMedico ? 'checkmark-circle-outline' : 'person-circle-outline'}
            onPress={(event) => {
              event?.stopPropagation?.();
              navigation.push('PacientePerfilMedico', {
                usuarioLogado,
                medico,
              });
            }}
            style={styles.proScheduleBtn}
          />
        </View>
      </CartaoAgendamento>
    );
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      contentContainerStyle={[
        styles.screenContent,
        resumoVisivel && styles.screenContentWithFooter,
      ]}
      footerOverlay={footerOverlay}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {activeSection === 'consultas' ? (
        <>
          <CampoBuscaAgendamento
            value={consultasSearchQuery}
            onChangeText={setConsultasSearchQuery}
            placeholder="Buscar profissional, tipo ou data"
            trailingIcon="funnel-outline"
            onTrailingPress={() => setConsultasFiltrosAbertos((prev) => !prev)}
            trailingAccessibilityLabel="Abrir filtros de minhas consultas"
            trailingActive={consultasFiltrosAbertos}
          />

          {consultasFiltrosAbertos ? (
            <View style={styles.consultasDrilldownPanel}>
              <Text style={styles.consultasDrilldownTitle}>Filtrar minhas consultas</Text>

              <View style={styles.consultasFieldBlock}>
                <Text style={styles.consultasFieldLabel}>Profissional</Text>
                <TextInput
                  value={consultasProfissionalFiltro}
                  onChangeText={(value) =>
                    setConsultasProfissionalFiltro(maskConsultaProfissionalFiltro(value))
                  }
                  placeholder="Nome ou CRN"
                  placeholderTextColor={patientTheme.colors.textMuted}
                  style={styles.consultasFieldInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.consultasFieldBlock}>
                <Text style={styles.consultasFieldLabel}>Tipo</Text>
                <TextInput
                  value={consultasTipoFiltro}
                  onChangeText={(value) => setConsultasTipoFiltro(maskConsultaTipoFiltro(value))}
                  placeholder="Ex.: Teleconsulta"
                  placeholderTextColor={patientTheme.colors.textMuted}
                  style={styles.consultasFieldInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.consultasFieldBlock}>
                <Text style={styles.consultasFieldLabel}>Data</Text>
                <TextInput
                  value={consultasDataFiltro}
                  onChangeText={(value) => setConsultasDataFiltro(maskDateBr(value))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={patientTheme.colors.textMuted}
                  style={styles.consultasFieldInput}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          ) : null}

          <View style={styles.quickFiltersRow}>
            <ChipFiltro
              label={`Agendadas ${proximasConsultasFiltradas.length}`}
              icon="calendar-outline"
              active={consultasSection === 'agendadas'}
              onPress={() => setConsultasSection('agendadas')}
              style={styles.quickFilterChip}
              textStyle={styles.quickFilterChipText}
            />
            <ChipFiltro
              label={`Anteriores ${consultasAnterioresFiltradas.length}`}
              icon="time-outline"
              active={consultasSection === 'anteriores'}
              onPress={() => setConsultasSection('anteriores')}
              style={styles.quickFilterChip}
              textStyle={styles.quickFilterChipText}
            />
          </View>
        </>
      ) : null}

      {activeSection === 'agendar' ? (
        <>
          <CampoBuscaAgendamento
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por nome, CRN ou especialidade"
            trailingIcon="funnel-outline"
            onTrailingPress={() => setFiltrosAbertos((prev) => !prev)}
            trailingAccessibilityLabel="Abrir filtros da teleconsulta"
            trailingActive={filtrosAbertos}
          />

      <View style={styles.quickFiltersRow}>
        <ChipFiltro
          label="Todos"
          icon="apps-outline"
          active={quickFilter === 'all'}
          onPress={() => setQuickFilter('all')}
          style={styles.quickFilterChip}
          textStyle={styles.quickFilterChipText}
        />
        <ChipFiltro
          label="Hoje"
          icon="today-outline"
          active={quickFilter === 'today'}
          onPress={() => setQuickFilter('today')}
          style={styles.quickFilterChip}
          textStyle={styles.quickFilterChipText}
        />
        <ChipFiltro
          label="Amanhã"
          icon="sunny-outline"
          active={quickFilter === 'tomorrow'}
          onPress={() => setQuickFilter('tomorrow')}
          style={styles.quickFilterChip}
          textStyle={styles.quickFilterChipText}
        />
        <ChipFiltro
          label="Melhores"
          icon="star-outline"
          active={quickFilter === 'top'}
          onPress={() => setQuickFilter('top')}
          style={styles.quickFilterChip}
          textStyle={styles.quickFilterChipText}
        />
      </View>

      <FiltrosAgendamentoAvancado
        tipoConsulta={tipoConsulta}
        onTipoConsultaChange={setTipoConsulta}
        convenio={convenio}
        onConvenioChange={setConvenio}
        especialidade={especialidadeFiltro}
        onEspecialidadeChange={setEspecialidadeFiltro}
        dateFromBr={dateFromBr}
        dateToBr={dateToBr}
        onDateFromBrChange={(value) => setDateFromBr(maskDateBr(value))}
        onDateToBrChange={(value) => setDateToBr(maskDateBr(value))}
        maxValorReais={maxValorReais}
        onMaxValorReaisChange={setMaxValorReais}
        ordenacao={ordenacao}
        onOrdenacaoChange={setOrdenacao}
        ratingMinimo={ratingMinimo}
        onRatingMinimoChange={setRatingMinimo}
        somenteConvenio={somenteConvenio}
        onSomenteConvenioChange={setSomenteConvenio}
        filtrosAtivos={filtrosAtivos}
        onLimpar={limparFiltrosAvancados}
        abertoExterno={filtrosAbertos}
        onAbertoChange={setFiltrosAbertos}
        ocultarToggle
      />
        </>
      ) : null}

      {activeSection === 'medicos' ? (
        <>
          <CampoBuscaAgendamento
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por nome, CRM ou especialidade"
            trailingIcon="funnel-outline"
            onTrailingPress={() => setFiltrosAbertos((prev) => !prev)}
            trailingAccessibilityLabel="Abrir filtros de médicos"
            trailingActive={filtrosAbertos}
          />

          <View style={styles.quickFiltersRow}>
            <ChipFiltro
              label="Todos"
              icon="apps-outline"
              active={quickFilter === 'all'}
              onPress={() => setQuickFilter('all')}
              style={styles.quickFilterChip}
              textStyle={styles.quickFilterChipText}
            />
            <ChipFiltro
              label="Hoje"
              icon="today-outline"
              active={quickFilter === 'today'}
              onPress={() => setQuickFilter('today')}
              style={styles.quickFilterChip}
              textStyle={styles.quickFilterChipText}
            />
            <ChipFiltro
              label="Amanhã"
              icon="sunny-outline"
              active={quickFilter === 'tomorrow'}
              onPress={() => setQuickFilter('tomorrow')}
              style={styles.quickFilterChip}
              textStyle={styles.quickFilterChipText}
            />
            <ChipFiltro
              label="Melhores"
              icon="star-outline"
              active={quickFilter === 'top'}
              onPress={() => setQuickFilter('top')}
              style={styles.quickFilterChip}
              textStyle={styles.quickFilterChipText}
            />
          </View>

          <FiltrosAgendamentoAvancado
            tipoConsulta={tipoConsulta}
            onTipoConsultaChange={setTipoConsulta}
            convenio={convenio}
            onConvenioChange={setConvenio}
            especialidade={especialidadeFiltro}
            onEspecialidadeChange={setEspecialidadeFiltro}
            dateFromBr={dateFromBr}
            dateToBr={dateToBr}
            onDateFromBrChange={(value) => setDateFromBr(maskDateBr(value))}
            onDateToBrChange={(value) => setDateToBr(maskDateBr(value))}
            maxValorReais={maxValorReais}
            onMaxValorReaisChange={setMaxValorReais}
            ordenacao={ordenacao}
            onOrdenacaoChange={setOrdenacao}
            ratingMinimo={ratingMinimo}
            onRatingMinimoChange={setRatingMinimo}
            somenteConvenio={somenteConvenio}
            onSomenteConvenioChange={setSomenteConvenio}
            filtrosAtivos={filtrosAtivos}
            onLimpar={limparFiltrosAvancados}
            abertoExterno={filtrosAbertos}
            onAbertoChange={setFiltrosAbertos}
            ocultarToggle
          />
        </>
      ) : null}

      <View style={styles.segmentedWrap}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.segmentedOption, activeSection === 'agendar' && styles.segmentedOptionActive]}
          onPress={() => setActiveSection('agendar')}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={[styles.segmentedText, activeSection === 'agendar' && styles.segmentedTextActive]}
          >
            Nutricionistas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.segmentedOption, activeSection === 'medicos' && styles.segmentedOptionActive]}
          onPress={() => setActiveSection('medicos')}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={[styles.segmentedText, activeSection === 'medicos' && styles.segmentedTextActive]}
          >
            Médicos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.segmentedOption, activeSection === 'consultas' && styles.segmentedOptionActive]}
          onPress={() => setActiveSection('consultas')}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={[styles.segmentedText, activeSection === 'consultas' && styles.segmentedTextActive]}
          >
            Minhas{'\u00A0'}consultas
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <EsqueletoAgendamento rows={4} />
      ) : loadError ? (
        <EstadoErroCarregamento onTentarNovamente={loadBase} loading={loading} />
      ) : (
        <>
          {activeSection === 'agendar' ? (
            <>
          {disponibilidadeDireta ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Disponibilidade do profissional</Text>
                  <Text style={styles.sectionSubtitle}>
                    {selectedNutri?.nome_completo_nutri || 'Selecione um profissional'}
                  </Text>
                </View>
                {loadingSlots ? <ActivityIndicator color={patientTheme.colors.primaryDark} /> : null}
              </View>

              <CartaoAgendamento style={styles.selectedProCard}>
                <View style={styles.proRow}>
                  <AvatarProfissional
                    name={selectedNutri?.nome_completo_nutri}
                    size={42}
                    online
                    imageUri={getNutricionistaFotoModeloUri(selectedNutri)}
                  />
                  <View style={styles.proBody}>
                    <Text style={styles.proName}>{selectedNutri?.nome_completo_nutri}</Text>
                    <Text style={styles.proSpec}>
                      {getNutriEspecialidadeLabel(selectedNutri)} · Google Meet
                    </Text>
                  </View>
                </View>
                <BotaoAgendamento
                  label="Cancelar"
                  variant="ghost"
                  onPress={handleCancelarFluxoAgendamento}
                  style={styles.selectedProCancelBtn}
                />
              </CartaoAgendamento>

              {(dateFromKey || dateToKey) && !slots.length && !loadingSlots ? (
                <CartaoAgendamento style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Sem horários no período</Text>
                  <Text style={styles.emptyText}>
                    Tente outras datas ou remova parte dos filtros para ver novas opções.
                  </Text>
                </CartaoAgendamento>
              ) : null}

              <CartaoAgendamento style={styles.calendarCard}>
                <CalendarioHorarios
                  days={calendarDays}
                  selectedDayKey={selectedDayKey}
                  onSelectDay={setSelectedDayKey}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                />
              </CartaoAgendamento>
            </>
          ) : null}

          {assignedNutri ? (
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Sua nutricionista</Text>
                <Text style={styles.sectionSubtitle}>
                  {nutrisComAgendaIds.has(assignedNutri.id_nutricionista_uuid)
                    ? 'Vinculada. Toque em Agendar nos horários.'
                    : 'Vinculada. Sem horários no filtro — tente outras datas.'}
                </Text>
              </View>
            </View>
          ) : null}

          {assignedNutri ? (
            <View style={styles.assignedNutriWrap}>
              {renderNutriCard(assignedNutri, { forceLinked: true })}
            </View>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                {disponibilidadeDireta
                  ? 'Outros profissionais'
                  : assignedNutri
                    ? 'Outros profissionais'
                    : 'Profissionais cadastrados'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {linkedNutricionistaId
                  ? 'Para trocar, desvincule a atual antes.'
                  : loadingNutrisDisponiveis
                  ? 'Carregando agendas...'
                  : `${outrosNutrisDisponiveis.length} com agenda no período`}
              </Text>
            </View>
            {loadingNutrisDisponiveis ? (
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
            ) : null}
          </View>

          {!outrosNutrisDisponiveis.length && !assignedNutri ? (
            <CartaoAgendamento style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum profissional encontrado</Text>
              <Text style={styles.emptyText}>
                Ajuste especialidade, avaliação, valor ou período para ampliar os resultados.
              </Text>
            </CartaoAgendamento>
          ) : null}

          {!outrosNutrisDisponiveis.length && assignedNutri && !loadingNutrisDisponiveis ? (
            <CartaoAgendamento style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum outro profissional com agenda</Text>
              <Text style={styles.emptyText}>
                No momento, apenas seu nutricionista de acompanhamento está listado acima.
              </Text>
            </CartaoAgendamento>
          ) : null}

          {outrosNutrisDisponiveis.map((nutri) => renderNutriCard(nutri))}

          {false ? (
            <CartaoAgendamento style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Escolha um profissional para agendar</Text>
              <Text style={styles.emptyText}>
                Toque em <Text style={styles.emptyTextStrong}>Agendar</Text> para abrir os horários
                disponíveis.
              </Text>
            </CartaoAgendamento>
          ) : null}

          {false ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Calendário de horários</Text>
                  <Text style={styles.sectionSubtitle}>
                    {selectedNutri?.nome_completo_nutri || 'Selecione um profissional'}
                  </Text>
                </View>
                {loadingSlots ? <ActivityIndicator color={patientTheme.colors.primaryDark} /> : null}
              </View>

              {(dateFromKey || dateToKey) && !slots.length && !loadingSlots ? (
                <CartaoAgendamento style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Sem horários no período</Text>
                  <Text style={styles.emptyText}>
                    Tente outras datas ou remova parte dos filtros para ver novas opções.
                  </Text>
                </CartaoAgendamento>
              ) : null}

              <CartaoAgendamento style={styles.calendarCard}>
                <CalendarioHorarios
                  days={calendarDays}
                  selectedDayKey={selectedDayKey}
                  onSelectDay={setSelectedDayKey}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                />
              </CartaoAgendamento>
            </>
          ) : null}

            </>
          ) : null}

          {activeSection === 'medicos' ? (
            <>
              {assignedMedico ? (
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Seu médico</Text>
                    <Text style={styles.sectionSubtitle}>
                      Vinculado. Toque em Agendar nos horários.
                    </Text>
                  </View>
                </View>
              ) : null}

              {assignedMedico ? (
                <View style={styles.assignedNutriWrap}>
                  {renderMedicoCard(assignedMedico, { forceLinked: true })}
                </View>
              ) : null}

              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>
                    {assignedMedico ? 'Outros médicos' : 'Médicos cadastrados'}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    {linkedMedicoId
                      ? 'Para trocar, desvincule o atual antes.'
                      : `${filteredMedicosBase.length} médico(s) no período`}
                  </Text>
                </View>
              </View>

              {!outrosMedicos.length && !assignedMedico ? (
                <CartaoAgendamento style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum médico encontrado</Text>
                  <Text style={styles.emptyText}>
                    Ajuste especialidade, avaliacao, valor ou busca para ampliar os resultados.
                  </Text>
                </CartaoAgendamento>
              ) : null}

              {!outrosMedicos.length && assignedMedico ? (
                <CartaoAgendamento style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum outro médico listado</Text>
                  <Text style={styles.emptyText}>
                    No momento, apenas seu médico de acompanhamento está listado acima.
                  </Text>
                </CartaoAgendamento>
              ) : null}

              {outrosMedicos.map((medico) => renderMedicoCard(medico))}
            </>
          ) : null}

      {!loading && !loadError && activeSection === 'consultas' ? (
        <>
          {consultasSection === 'agendadas' ? (
            <>
              <View style={[styles.sectionHeaderRow, styles.bookingSectionHeaderRow]}>
                <View>
                  <Text style={styles.sectionTitle}>Minhas consultas agendadas</Text>
                  <Text style={styles.sectionSubtitle}>Confirme, cancele ou entre pelo Google Meet</Text>
                </View>
              </View>

              {proximasConsultasFiltradas.length ? (
                proximasConsultasFiltradas.map((item) => {
                  const profissional = resolveProfissionalDaConsulta(
                    item,
                    nutricionistas,
                    medicos
                  );
                  const meetLink = resolveMeetLink({
                    consulta: item,
                    nutricionista: profissional.nutri,
                  });

                  return (
                    <CartaoAgendamento key={`next-filtered-${item.id}`} style={styles.bookingCard}>
                      <View style={styles.bookingTopRow}>
                        <AvatarProfissional
                          name={profissional.nome}
                          size={48}
                          imageUri={profissional.avatarUri}
                        />
                        <View style={styles.bookingBody}>
                          <Text style={styles.bookingName}>{profissional.nome}</Text>
                          <Text style={styles.bookingSpec}>{profissional.especialidade}</Text>
                          <Text style={styles.bookingDate}>{formatConsultaDateTime(item.scheduled_at)}</Text>
                          <Text style={styles.bookingMeta}>
                            {item.tipo_consulta || 'Teleconsulta'} · {item.convenio || convenio}
                          </Text>
                          <ConsultaStatusBadge status={item.status} style={styles.bookingStatusBadge} />
                        </View>
                      </View>

                      <View style={styles.bookingActions}>
                        {String(item.status || 'scheduled') === 'scheduled' ? (
                          <BotaoAgendamento
                            label="Confirmar"
                            icon="checkmark-circle-outline"
                            onPress={() => handleConfirmarConsultaAgendada(item, profissional.nutri)}
                            style={styles.bookingActionPrimary}
                          />
                        ) : null}
                        <BotaoAgendamento
                          label="Cancelar"
                          variant="ghost"
                          onPress={() => handleCancelarConsulta(item, profissional.nutri)}
                          style={styles.bookingActionSecondary}
                        />
                        {meetLink ? (
                          <BotaoAgendamento
                            label="Entrar"
                            icon="videocam-outline"
                            onPress={() => handleAbrirMeet(item, profissional.nutri)}
                            style={styles.bookingActionPrimary}
                          />
                        ) : null}
                      </View>
                    </CartaoAgendamento>
                  );
                })
              ) : (
                <CartaoAgendamento style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Sem consultas agendadas</Text>
                  <Text style={styles.emptyText}>
                    {consultasSearchQuery
                      ? 'Nenhuma consulta agendada corresponde ao filtro informado.'
                      : 'Suas próximas teleconsultas vão aparecer aqui.'}
                  </Text>
                </CartaoAgendamento>
              )}
            </>
          ) : (
            <>
              <View style={[styles.sectionHeaderRow, styles.bookingSectionHeaderRow]}>
                <View>
                  <Text style={styles.sectionTitle}>Consultas anteriores</Text>
                  <Text style={styles.sectionSubtitle}>Histórico recente de atendimentos</Text>
                </View>
              </View>

              {consultasAnterioresFiltradas.length ? (
                consultasAnterioresFiltradas.map((item) => {
                  const profissional = resolveProfissionalDaConsulta(
                    item,
                    nutricionistas,
                    medicos
                  );

                  return (
                    <CartaoAgendamento key={`past-filtered-${item.id}`} style={styles.bookingCardPast}>
                      <View style={styles.bookingTopRow}>
                        <AvatarProfissional
                          name={profissional.nome}
                          size={44}
                          imageUri={profissional.avatarUri}
                        />
                        <View style={styles.bookingBody}>
                          <Text style={styles.bookingName}>{profissional.nome}</Text>
                          <Text style={styles.bookingSpec}>{profissional.especialidade}</Text>
                          <Text style={styles.bookingDate}>{formatConsultaDateTime(item.scheduled_at)}</Text>
                          <Text style={styles.bookingMeta}>
                            {item.tipo_consulta || 'Teleconsulta'} · {item.status || 'finalizada'}
                          </Text>
                        </View>
                      </View>
                    </CartaoAgendamento>
                  );
                })
              ) : (
                <CartaoAgendamento style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Sem histórico recente</Text>
                  <Text style={styles.emptyText}>
                    {consultasSearchQuery
                      ? 'Nenhuma consulta anterior corresponde ao filtro informado.'
                      : 'As consultas concluídas e canceladas aparecem nesta seção.'}
                  </Text>
                </CartaoAgendamento>
              )}
            </>
          )}
        </>
      ) : null}

        </>
      )}

      {resumoVisivel ? (
        <View style={[styles.summaryDock, Platform.OS === 'web' && styles.summaryDockWeb]}>
          <CartaoAgendamento style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumo do agendamento</Text>
            <Text style={styles.summaryLine}>
              {selectedNutri?.nome_completo_nutri} · {getNutriEspecialidadeLabel(selectedNutri)}
            </Text>
            <Text style={styles.summaryLine}>
              {formatDayLabel(formatSlotDateKey(selectedSlot.scheduledAt))} as{' '}
              {formatTimeLabel(selectedSlot.scheduledAt)}
            </Text>
            <Text style={styles.summaryLine}>{tipoConsulta} · {convenio} · Google Meet</Text>
            <Text style={styles.summaryLine}>
              {formatValorConsulta(selectedNutri?.valor_consulta_centavos)}
            </Text>
            <BotaoAgendamento
              label="Confirmar consulta"
              onPress={handleConfirmarConsulta}
              loading={confirming}
              icon="checkmark-circle-outline"
            />
          </CartaoAgendamento>
        </View>
      ) : null}

      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <CabecalhoModalPaciente
              title="Consulta confirmada"
              onClose={() => setConfirmModalVisible(false)}
              titleCentered
            />
            <View style={styles.modalIcon}>
              <Ionicons
                name="checkmark-circle"
                size={42}
                color={patientTheme.colors.primaryDark}
              />
            </View>
            <Text style={styles.modalText}>
              {lastBooking?.nutri?.nome_completo_nutri}
              {'\n'}
              {formatConsultaDateTime(lastBooking?.slot?.scheduledAt)}
              {'\n'}
              {lastBooking?.tipoConsulta} · {lastBooking?.convenio}
              {'\n'}
              Canal: Google Meet
            </Text>
            <BotaoAgendamento
              label="Entrar no Google Meet"
              icon="videocam-outline"
              onPress={async () => {
                try {
                  await abrirLinkGoogleMeet(lastBooking?.meetLink);
                } catch (error) {
                  exibirMensagemAgendamentos({
                    tipo: 'erro',
                    texto: error?.message || 'Link do Meet indisponível.',
                  });
                }
              }}
            />
            <BotaoAgendamento
              label="Fechar"
              variant="ghost"
              onPress={() => setConfirmModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={notificacoesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificacoesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.notifCard]}>
            <CabecalhoModalPaciente
              title="Notificações"
              onClose={() => setNotificacoesModal(false)}
            />
            <ScrollView style={styles.notifList}>
              {notificacoes.length ? (
                notificacoes.map((item) => (
                  <View key={item.id} style={styles.notifItem}>
                    <Text style={styles.notifTitle}>{item.titulo}</Text>
                    <Text style={styles.notifBody}>{item.mensagem}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Nenhuma notificação recente.</Text>
              )}
            </ScrollView>
            <BotaoAgendamento
              label="Fechar"
              variant="ghost"
              onPress={() => setNotificacoesModal(false)}
            />
          </View>
        </View>
      </Modal>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 112,
  },
  screenContentWithFooter: {
    paddingBottom: 340,
  },
  segmentedWrap: {
    alignSelf: 'stretch',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    minHeight: Platform.OS === 'web' ? 44 : 42,
    padding: 4,
    width: '100%',
  },
  segmentedOption: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.xl,
    flex: 1,
    justifyContent: 'center',
    minHeight: Platform.OS === 'web' ? 30 : 28,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  segmentedOptionActive: {
    backgroundColor: '#ffffff',
  },
  segmentedText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  segmentedTextActive: {
    color: patientTheme.colors.text,
    fontWeight: '800',
  },
  quickFiltersRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingVertical: 12,
    width: '100%',
  },
  quickFilterChip: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  quickFilterChipText: {
    fontWeight: '600',
  },
  consultasDrilldownPanel: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    gap: 10,
    marginTop: 10,
    padding: 12,
    width: '100%',
    ...patientShadow,
  },
  consultasDrilldownTitle: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  consultasFieldBlock: {
    gap: 6,
  },
  consultasFieldLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  consultasFieldInput: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionHeaderRow: {
    marginTop: 12,
    marginBottom: 10,
  },
  bookingSectionHeaderRow: {
    marginTop: 10,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyCard: {
    marginBottom: 12,
  },
  emptyTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 6,
  },
  emptyTextStrong: {
    color: patientTheme.colors.text,
    fontWeight: '800',
  },
  assignedNutriWrap: {
    marginBottom: 18,
  },
  proCard: {
    marginBottom: 10,
    borderRadius: 18,
    padding: 16,
  },
  proCardLinked: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
    borderWidth: 1,
  },
  linkedBadge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkedBadgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  proRow: {
    flexDirection: 'row',
    gap: 14,
  },
  proBody: {
    flex: 1,
  },
  proName: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  proSpec: {
    display: 'none',
  },
  proSpecVisible: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  proCrn: {
    display: 'none',
  },
  proMetaRow: {
    alignItems: 'center',
    display: 'none',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  proMetaRowCompact: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  proMeta: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  proMetaDot: {
    color: patientTheme.colors.textMuted,
  },
  proMetaSummary: {
    color: patientTheme.colors.textMuted,
    display: 'none',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  proNext: {
    display: 'none',
  },
  proBio: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 8,
  },
  proAvailability: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  proAvailabilityOpen: {
    color: patientTheme.colors.primaryDark,
  },
  proHighlights: {
    display: 'none',
  },
  highlightPill: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  highlightText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  proActions: {
    marginTop: 14,
  },
  proActionBtn: {
    borderWidth: 0,
    flex: 1,
  },
  proScheduleBtn: {
    width: '100%',
  },
  calendarCard: {
    marginBottom: 4,
  },
  selectedProCard: {
    gap: 10,
    marginBottom: 10,
  },
  selectedProCancelBtn: {
    borderWidth: 0,
  },
  bookingCard: {
    marginBottom: 10,
    gap: 12,
  },
  bookingCardPast: {
    marginBottom: 10,
    opacity: 0.94,
  },
  bookingTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bookingBody: {
    flex: 1,
  },
  bookingName: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  bookingSpec: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  bookingDate: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  bookingTitle: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  bookingMeta: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  bookingStatusBadge: {
    marginTop: 8,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bookingActionSecondary: {
    borderWidth: 1,
    flex: 1,
  },
  bookingActionPrimary: {
    flex: 1.15,
  },
  meetBtn: {
    marginTop: 10,
  },
  summaryDock: {
    display: 'none',
  },
  summaryDockWeb: {
    display: 'none',
  },
  summaryCard: {
    gap: 8,
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  summarySecondaryBtn: {
    borderWidth: 0,
    flex: 1,
  },
  summaryPrimaryBtn: {
    flex: 1,
  },
  summaryTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  summaryLine: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    backgroundColor: patientTheme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.xl,
    gap: 12,
    padding: 22,
    ...patientShadow,
  },
  notifCard: {
    maxHeight: '80%',
    width: '100%',
  },
  notifList: {
    maxHeight: 320,
    width: '100%',
  },
  notifItem: {
    borderBottomColor: patientTheme.colors.border,
    borderBottomWidth: 1,
    paddingVertical: 10,
    width: '100%',
  },
  notifTitle: {
    color: patientTheme.colors.text,
    fontWeight: '900',
    marginBottom: 4,
  },
  notifBody: {
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
    lineHeight: 20,
  },
  modalIcon: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  modalTitle: {
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  modalText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
});
