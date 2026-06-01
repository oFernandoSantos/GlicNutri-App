import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import CalendarioHorarios from '../../componentes/agendamento/CalendarioHorarios';
import {
  AvatarProfissional,
  BotaoAgendamento,
  CartaoAgendamento,
} from '../../componentes/agendamento/uiAgendamento';
import { patientTheme } from '../../temas/temaVisualPaciente';
import { fetchPatientById, getPatientId } from '../../servicos/servicoDadosPaciente';
import { getMedicoById, getMedicoEspecialidadeLabel } from '../../servicos/servicoMedicos';
import {
  generateSlotsForNextDays,
  listMedicoAvailability,
} from '../../servicos/servicoAgendaMedico';
import {
  createConsultaMedico,
  listConsultasByMedico,
} from '../../servicos/servicoConsultas';
import {
  getStableExperienceYears,
  getStableRating,
  getStableReviewCount,
  groupSlotsByDay,
  markSlotsWithBooking,
} from '../../utilitarios/slotsTeleconsulta';
import {
  isPatientLinkedToDoctor,
  unlinkPatientDoctor,
} from '../../servicos/servicoVinculosMedico';
import { createDoctorFollowUpRequest } from '../../servicos/servicoSolicitacoesAcompanhamento';

function getPacienteNome(usuario) {
  return usuario?.nome_completo || usuario?.nome_pac || usuario?.email_pac || 'Paciente';
}

function getMedicoAvatarUri(medico) {
  const seed = encodeURIComponent(
    String(medico?.id_medico_uuid || medico?.nome_completo_medico || 'medico').trim()
  );
  return `https://api.dicebear.com/8.x/thumbs/png?seed=${seed}&backgroundColor=d1fae5,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function uniqueSlotsByScheduledAt(items) {
  const seen = new Set();
  return (items || []).filter((slot) => {
    const key = slot?.scheduledAt || slot?.scheduled_at;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function PacientePerfilMedicoScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const medicoBase = route?.params?.medico || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [medico, setMedico] = useState(medicoBase);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [linkedToMedico, setLinkedToMedico] = useState(false);
  const [linkedDoctorId, setLinkedDoctorId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [erroAgenda, setErroAgenda] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    setMedico(medicoBase);
  }, [medicoBase]);

  useEffect(() => {
    navigation.setOptions({ readerTitle: 'Perfil do Medico' });
    return () => navigation.setOptions({ readerTitle: null });
  }, [navigation]);

  useEffect(() => {
    let active = true;

    async function carregarPerfil() {
      if (!medicoBase?.id_medico_uuid) return;
      try {
        const perfil = await getMedicoById(medicoBase.id_medico_uuid);
        if (active && perfil) {
          setMedico((prev) => ({ ...(prev || {}), ...perfil }));
        }
      } catch (error) {
        console.log('Erro ao carregar medico:', error);
      }
    }

    carregarPerfil();
    return () => {
      active = false;
    };
  }, [medicoBase?.id_medico_uuid]);

  const carregarVinculo = useCallback(async () => {
    if (!patientId || !medico?.id_medico_uuid) return;

    try {
      const paciente = await fetchPatientById(patientId, {
        currentPatient: usuarioLogado,
        patientContext: usuarioLogado,
      });
      const assignedId = paciente?.id_medico_uuid || null;
      setLinkedDoctorId(assignedId);
      const linked = await isPatientLinkedToDoctor({
        pacienteId: patientId,
        medicoId: medico.id_medico_uuid,
      });
      setLinkedToMedico(linked);
    } catch (error) {
      console.log('Erro ao verificar vinculo medico:', error);
    }
  }, [medico?.id_medico_uuid, patientId, usuarioLogado]);

  useEffect(() => {
    carregarVinculo();
  }, [carregarVinculo]);

  const especialidade = getMedicoEspecialidadeLabel(medico);
  const rating = useMemo(
    () => getStableRating(medico?.id_medico_uuid),
    [medico?.id_medico_uuid]
  );
  const totalAvaliacoes = useMemo(
    () => getStableReviewCount(medico?.id_medico_uuid),
    [medico?.id_medico_uuid]
  );
  const anosExperiencia = useMemo(
    () => getStableExperienceYears(medico?.id_medico_uuid),
    [medico?.id_medico_uuid]
  );

  const normalizedSlots = useMemo(() => uniqueSlotsByScheduledAt(slots), [slots]);
  const calendarDays = useMemo(() => groupSlotsByDay(normalizedSlots), [normalizedSlots]);
  const availableDays = useMemo(
    () =>
      calendarDays.filter((day) =>
        (day.slots || []).some((slot) => slot.status === 'available')
      ),
    [calendarDays]
  );

  useEffect(() => {
    if (!availableDays.length) {
      setSelectedDayKey('');
      setSelectedSlot(null);
      return;
    }

    if (!selectedDayKey || !availableDays.some((day) => day.dateKey === selectedDayKey)) {
      setSelectedDayKey(availableDays[0].dateKey);
      setSelectedSlot(null);
    }
  }, [availableDays, selectedDayKey]);

  const carregarAgenda = useCallback(async () => {
    if (!medico?.id_medico_uuid) return;

    try {
      setErroAgenda('');
      setLoadingAgenda(true);
      const [availability, consultas] = await Promise.all([
        listMedicoAvailability(medico.id_medico_uuid),
        listConsultasByMedico(medico.id_medico_uuid, { limit: 200 }),
      ]);

      const generated = generateSlotsForNextDays(availability, { days: 21 });
      const marked = markSlotsWithBooking(generated, consultas);
      setSlots(marked);
      setSelectedSlot(null);
    } catch (error) {
      console.log('Erro ao carregar agenda do medico:', error);
      setSlots([]);
      setErroAgenda('Nao foi possivel carregar datas e horarios deste medico.');
    } finally {
      setLoadingAgenda(false);
    }
  }, [medico?.id_medico_uuid]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  async function handleSolicitarAcompanhamento() {
    if (!medico?.id_medico_uuid || !patientId) {
      setFeedback('Nao foi possivel identificar o paciente ou medico.');
      return;
    }

    if (linkedDoctorId && linkedDoctorId !== medico.id_medico_uuid) {
      setFeedback(
        'Voce ja possui um medico vinculado. Desvincule o acompanhamento atual antes de solicitar outro.'
      );
      return;
    }

    try {
      setSolicitando(true);
      setFeedback('');
      const result = await createDoctorFollowUpRequest({
        medicoId: medico.id_medico_uuid,
        pacienteId: patientId,
        mensagem: `${especialidade} · acompanhamento clinico diabetes`,
        actor: usuarioLogado,
      });

      setFeedback(
        result?.message ||
          'Solicitacao enviada. O medico precisa aprovar o acompanhamento antes do vinculo clinico.'
      );
      if (result?.alreadyLinked) {
        setLinkedToMedico(true);
        setLinkedDoctorId(medico.id_medico_uuid);
      }
    } catch (error) {
      console.log('Erro ao solicitar acompanhamento medico:', error);
      setFeedback(error?.message || 'Nao foi possivel enviar a solicitacao. Tente novamente.');
    } finally {
      setSolicitando(false);
    }
  }

  async function handleDesvincularAcompanhamento() {
    if (!medico?.id_medico_uuid || !patientId) {
      setFeedback('Nao foi possivel identificar o acompanhamento para desvincular.');
      return;
    }

    try {
      setDesvinculando(true);
      setFeedback('');
      await unlinkPatientDoctor({
        pacienteId: patientId,
        medicoId: medico.id_medico_uuid,
        actor: usuarioLogado,
      });
      setLinkedToMedico(false);
      setLinkedDoctorId(null);
      setFeedback('Acompanhamento medico encerrado. Voce pode vincular outro medico quando precisar.');
    } catch (error) {
      console.log('Erro ao desvincular medico:', error);
      setFeedback(error?.message || 'Nao foi possivel desvincular o medico.');
    } finally {
      setDesvinculando(false);
    }
  }

  async function handleConfirmarAgendamento() {
    if (!selectedSlot || !medico?.id_medico_uuid || !patientId) {
      setErroAgenda('Selecione um horario disponivel para continuar.');
      return;
    }

    if (!linkedToMedico) {
      setErroAgenda(
        'Solicite o acompanhamento primeiro. Depois da aprovacao do medico, o agendamento fica liberado.'
      );
      return;
    }

    try {
      setConfirmando(true);
      const motivo = [observacoes.trim(), `${especialidade} · teleconsulta clinica`]
        .filter(Boolean)
        .join(' · ');

      await createConsultaMedico({
        medicoId: medico.id_medico_uuid,
        pacienteId: patientId,
        scheduledAt: selectedSlot.scheduledAt,
        motivo,
        tipoConsulta: 'Teleconsulta clinica',
        medico,
        pacienteNome: getPacienteNome(usuarioLogado),
        actor: usuarioLogado,
      });

      navigation.navigate('PacienteAgendamentos', {
        usuarioLogado,
        activeSection: 'consultas',
      });
    } catch (error) {
      console.log('Erro ao agendar consulta medica:', error);
      setErroAgenda(error?.message || 'Nao foi possivel confirmar o agendamento. Tente novamente.');
    } finally {
      setConfirmando(false);
    }
  }

  if (!medico?.id_medico_uuid) {
    return (
      <PatientScreenLayout navigation={navigation} route={route} usuarioLogado={usuarioLogado}>
        <View style={styles.centered}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
        </View>
      </PatientScreenLayout>
    );
  }

  return (
    <PatientScreenLayout navigation={navigation} route={route} usuarioLogado={usuarioLogado}>
      <CartaoAgendamento style={[styles.card, linkedToMedico && styles.cardLinked]}>
        {linkedToMedico ? (
          <View style={styles.linkedBadge}>
            <Ionicons name="checkmark-circle" size={15} color={patientTheme.colors.primaryDark} />
            <Text style={styles.linkedBadgeText}>Medico vinculado</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <AvatarProfissional
            name={medico.nome_completo_medico}
            size={64}
            online
            imageUri={getMedicoAvatarUri(medico)}
          />
          <View style={styles.body}>
            <Text style={styles.name}>{medico.nome_completo_medico}</Text>
            <Text style={styles.spec}>{especialidade}</Text>
            <Text style={styles.crm}>
              {medico.crm_medico ? `CRM ${medico.crm_medico}` : 'CRM nao informado'}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={14} color={patientTheme.colors.warning} />
              <Text style={styles.meta}>{rating}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{totalAvaliacoes} avaliacoes</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{anosExperiencia} anos</Text>
            </View>
          </View>
        </View>

        <Text style={styles.bio}>
          {medico.bio_resumo ||
            'Acompanhamento clinico de diabetes, glicemia, medicacao e insulina.'}
        </Text>

        <View style={styles.scopeBox}>
          <Text style={styles.scopeTitle}>Escopo do acompanhamento medico</Text>
          <Text style={styles.scopeText}>
            Glicemia, medicacao, insulina e prontuario clinico. O plano alimentar continua com o
            nutricionista vinculado.
          </Text>
        </View>
      </CartaoAgendamento>

      <CartaoAgendamento style={styles.calendarCard}>
        <View style={styles.scheduleHeader}>
          <View>
            <Text style={styles.blockTitle}>Calendario de horarios</Text>
            <Text style={styles.scheduleSubtitle}>{medico.nome_completo_medico}</Text>
          </View>
          {loadingAgenda ? <ActivityIndicator color={patientTheme.colors.primaryDark} /> : null}
        </View>

        {!linkedToMedico ? (
          <Text style={styles.scheduleHint}>
            Visualize a disponibilidade do medico. Solicite acompanhamento para liberar o agendamento.
          </Text>
        ) : null}

        {loadingAgenda ? (
          <View style={styles.scheduleLoading}>
            <Text style={styles.scheduleLoadingText}>Carregando disponibilidade...</Text>
          </View>
        ) : (
          <CalendarioHorarios
            days={calendarDays}
            selectedDayKey={selectedDayKey}
            onSelectDay={(dayKey) => {
              setSelectedDayKey(dayKey);
              setSelectedSlot(null);
              setErroAgenda('');
            }}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => {
              setSelectedSlot(slot);
              setErroAgenda('');
            }}
          />
        )}

        {!loadingAgenda && !calendarDays.length && erroAgenda ? (
          <Text style={styles.errorText}>{erroAgenda}</Text>
        ) : null}

        {linkedToMedico && calendarDays.length ? (
          <>
            <Text style={styles.fieldLabel}>Observacoes (opcional)</Text>
            <TextInput
              value={observacoes}
              onChangeText={setObservacoes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="Descreva brevemente o motivo da consulta..."
              placeholderTextColor={patientTheme.colors.textMuted}
              style={styles.notesInput}
            />

            {erroAgenda ? <Text style={styles.errorText}>{erroAgenda}</Text> : null}

            <BotaoAgendamento
              label="Confirmar agendamento"
              onPress={handleConfirmarAgendamento}
              loading={confirmando}
              style={styles.primaryBtn}
            />
          </>
        ) : null}
      </CartaoAgendamento>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {linkedToMedico ? (
        <>
          <BotaoAgendamento
            label="Ver acompanhamento"
            icon="checkmark-circle-outline"
            onPress={() => navigation.navigate('PacienteMonitoramento', { usuarioLogado })}
            style={styles.primaryBtn}
          />
          <BotaoAgendamento
            label="Desvincular medico"
            variant="ghost"
            loading={desvinculando}
            onPress={handleDesvincularAcompanhamento}
            style={styles.secondaryBtn}
          />
        </>
      ) : (
        <BotaoAgendamento
          label="Solicitar acompanhamento medico"
          icon="medkit-outline"
          loading={solicitando}
          onPress={handleSolicitarAcompanhamento}
          style={styles.primaryBtn}
        />
      )}
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { gap: 14, marginBottom: 14 },
  calendarCard: { gap: 12, marginBottom: 14 },
  cardLinked: { borderColor: patientTheme.colors.primary, borderWidth: 1.5 },
  linkedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F8F1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  linkedBadgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  row: { flexDirection: 'row', gap: 14 },
  body: { flex: 1, gap: 4 },
  name: { fontSize: 18, fontWeight: '700', color: patientTheme.colors.text },
  spec: { fontSize: 13, color: patientTheme.colors.textMuted },
  crm: { fontSize: 12, color: patientTheme.colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  meta: { fontSize: 12, color: patientTheme.colors.textMuted },
  metaDot: { fontSize: 12, color: patientTheme.colors.textMuted },
  bio: { fontSize: 13, lineHeight: 19, color: patientTheme.colors.text },
  scopeBox: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  scopeTitle: { fontSize: 12, fontWeight: '700', color: patientTheme.colors.primaryDark },
  scopeText: { fontSize: 12, lineHeight: 18, color: patientTheme.colors.textMuted },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  scheduleSubtitle: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  scheduleHint: {
    fontSize: 12,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  scheduleLoading: {
    paddingVertical: 16,
  },
  scheduleLoadingText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: patientTheme.colors.text,
    backgroundColor: patientTheme.colors.background,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: patientTheme.colors.danger || '#DC2626',
  },
  feedback: { fontSize: 12, lineHeight: 18, color: patientTheme.colors.primaryDark, marginBottom: 8 },
  primaryBtn: { marginTop: 4 },
  secondaryBtn: { marginTop: 0 },
});
