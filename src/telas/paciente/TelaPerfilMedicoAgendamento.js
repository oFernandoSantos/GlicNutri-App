import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import CalendarioHorarios from '../../componentes/agendamento/CalendarioHorarios';
import { BotaoAgendamento, CartaoAgendamento } from '../../componentes/agendamento/uiAgendamento';
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
import { mostrarToastPaciente, mostrarToastPacienteErro } from '../../servicos/servicoToastPaciente';
import SecaoMeetConsultasProfissional from '../../componentes/paciente/SecaoMeetConsultasProfissional';
import CartaoPerfilProfissionalPaciente from '../../componentes/paciente/CartaoPerfilProfissionalPaciente';
import {
  formatValorConsulta,
  VALOR_CONSULTA_PERFIL_CENTAVOS,
} from '../../servicos/servicoGoogleMeet';
import { abrirMensagensProfissionalVinculado } from '../../utilitarios/navegacaoMensagensProfissionalPaciente';
import { formatCrmMedico } from '../../utilitarios/formatRegistroProfissional';
import { getMedicoFotoModeloUri } from '../../utilitarios/fotoModeloProfissional';

function getPacienteNome(usuario) {
  return usuario?.nome_completo || usuario?.nome_pac || usuario?.email_pac || 'Paciente';
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
  const [slots, setSlots] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    setMedico(medicoBase);
  }, [medicoBase]);

  const abrirMensagensMedico = useCallback(() => {
    abrirMensagensProfissionalVinculado(navigation, {
      usuarioLogado,
      profissional: medico,
      papel: 'medico',
      vinculado: linkedToMedico,
    });
  }, [navigation, usuarioLogado, medico, linkedToMedico]);

  useEffect(() => {
    navigation.setOptions({
      readerTitle: 'Perfil do Médico',
      readerRightAction: abrirMensagensMedico,
      readerRightIcon: 'chatbubble-outline',
      readerRightAccessibilityLabel: 'Mensagem para o médico',
      readerRightDisabled: !linkedToMedico,
    });
    return () =>
      navigation.setOptions({
        readerTitle: null,
        readerRightAction: undefined,
        readerRightIcon: undefined,
        readerRightAccessibilityLabel: undefined,
        readerRightDisabled: undefined,
      });
  }, [navigation, abrirMensagensMedico, linkedToMedico]);

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
  const valorLabel = formatValorConsulta(VALOR_CONSULTA_PERFIL_CENTAVOS);
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
  const canConfirmAgendamento = Boolean(selectedDayKey && selectedSlot?.scheduledAt);
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

    if (selectedDayKey && !calendarDays.some((day) => day.dateKey === selectedDayKey)) {
      setSelectedDayKey('');
      setSelectedSlot(null);
    }
  }, [calendarDays, selectedDayKey]);

  const carregarAgenda = useCallback(async () => {
    if (!medico?.id_medico_uuid) return;

    try {
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
      mostrarToastPaciente({
        tipo: 'erro',
        texto: 'Agenda indisponível agora',
        subtexto: 'Não foi possível carregar horários deste médico.',
      });
    } finally {
      setLoadingAgenda(false);
    }
  }, [medico?.id_medico_uuid]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  async function handleSolicitarAcompanhamento() {
    if (!medico?.id_medico_uuid || !patientId) {
      mostrarToastPaciente({
        tipo: 'erro',
        texto: 'Não encontramos seu cadastro ou o médico',
      });
      return;
    }

    if (linkedDoctorId && linkedDoctorId !== medico.id_medico_uuid) {
      mostrarToastPaciente({
        tipo: 'aviso',
        texto: 'Você já tem um médico vinculado',
        subtexto: 'Encerre o acompanhamento atual antes de solicitar outro.',
      });
      return;
    }

    try {
      setSolicitando(true);
      const result = await createDoctorFollowUpRequest({
        medicoId: medico.id_medico_uuid,
        pacienteId: patientId,
        mensagem: `${especialidade} · acompanhamento clínico diabetes`,
        actor: usuarioLogado,
      });

      mostrarToastPaciente({
        tipo: 'sucesso',
        texto: 'Solicitação enviada',
        subtexto:
          result?.message ||
          'O médico precisa aprovar antes do vínculo clínico.',
      });
      if (result?.alreadyLinked) {
        setLinkedToMedico(true);
        setLinkedDoctorId(medico.id_medico_uuid);
      }
    } catch (error) {
      console.log('Erro ao solicitar acompanhamento medico:', error);
      mostrarToastPacienteErro(error, 'Não foi possível enviar sua solicitação agora.');
    } finally {
      setSolicitando(false);
    }
  }

  async function handleDesvincularAcompanhamento() {
    if (!medico?.id_medico_uuid || !patientId) {
      mostrarToastPaciente({
        tipo: 'erro',
        texto: 'Não foi possível desvincular agora',
      });
      return;
    }

    try {
      setDesvinculando(true);
      await unlinkPatientDoctor({
        pacienteId: patientId,
        medicoId: medico.id_medico_uuid,
        actor: usuarioLogado,
      });
      setLinkedToMedico(false);
      setLinkedDoctorId(null);
      mostrarToastPaciente({
        tipo: 'sucesso',
        texto: 'Acompanhamento com médico encerrado',
        subtexto: 'Você pode vincular outro profissional quando quiser.',
      });
    } catch (error) {
      console.log('Erro ao desvincular medico:', error);
      mostrarToastPacienteErro(error, 'Não foi possível desvincular o médico agora.');
    } finally {
      setDesvinculando(false);
    }
  }

  async function handleConfirmarAgendamento() {
    if (!selectedSlot || !medico?.id_medico_uuid || !patientId) {
      mostrarToastPaciente({
        tipo: 'aviso',
        texto: 'Escolha um horário',
        subtexto: 'Selecione um horário livre na agenda.',
      });
      return;
    }

    if (!linkedToMedico) {
      mostrarToastPaciente({
        tipo: 'aviso',
        texto: 'Solicite acompanhamento primeiro',
        subtexto: 'Depois da aprovação do médico, você poderá agendar.',
      });
      return;
    }

    try {
      setConfirmando(true);
      const motivo = [observacoes.trim(), `${especialidade} · teleconsulta clínica`]
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

      mostrarToastPaciente({
        tipo: 'sucesso',
        texto: 'Consulta agendada',
        subtexto: 'Veja os detalhes em Minhas consultas.',
      });

      navigation.navigate('PacienteAgendamentos', {
        usuarioLogado,
        activeSection: 'consultas',
      });
    } catch (error) {
      console.log('Erro ao agendar consulta medica:', error);
      mostrarToastPacienteErro(error, 'Não foi possível confirmar seu agendamento agora.');
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
      <CartaoPerfilProfissionalPaciente
        linked={linkedToMedico}
        linkedLabel="Médico vinculado"
        name={medico.nome_completo_medico}
        specialty={especialidade}
        registration={formatCrmMedico(medico.crm_medico)}
        avatarName={medico.nome_completo_medico}
        avatarUri={getMedicoFotoModeloUri(medico)}
        rating={rating}
        reviewCount={totalAvaliacoes}
        yearsExperience={anosExperiencia}
        bio={
          medico.bio_resumo ||
          'Acompanhamento clínico de diabetes, glicemia e medicação por teleconsulta.'
        }
        detailItems={[
          { label: 'Valor', value: valorLabel },
          { label: 'Tipo', value: 'Teleconsulta clínica' },
          { label: 'Canal', value: 'Google Meet' },
        ]}
      />

      <SecaoMeetConsultasProfissional
        patientId={patientId}
        profissionalId={medico.id_medico_uuid}
        profissionalTipo="medico"
        profissional={medico}
      />

      <CartaoAgendamento style={[styles.calendarCard, styles.cardWhite]}>
        <View style={styles.scheduleHeader}>
          <View>
            <Text style={styles.blockTitle}>Calendário de horários</Text>
            <Text style={styles.scheduleSubtitle}>{medico.nome_completo_medico}</Text>
          </View>
          {loadingAgenda ? <ActivityIndicator color={patientTheme.colors.primaryDark} /> : null}
        </View>

        <Text style={styles.scheduleHint}>
          {linkedToMedico
            ? 'Escolha dia e horário e confirme abaixo.'
            : 'Solicite acompanhamento para liberar o agendamento.'}
        </Text>

        {loadingAgenda ? (
          <View style={styles.scheduleLoading}>
            <Text style={styles.scheduleLoadingText}>Carregando disponibilidade...</Text>
          </View>
        ) : (
          <CalendarioHorarios
            variant="compact"
            slotsInModal
            days={calendarDays}
            selectedDayKey={selectedDayKey}
            onSelectDay={(dayKey) => {
              setSelectedDayKey(dayKey);
              setSelectedSlot(null);
            }}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => {
              setSelectedSlot(slot);
            }}
          />
        )}

        {linkedToMedico && calendarDays.length ? (
          <>
            <Text style={styles.fieldLabel}>Observações (opcional)</Text>
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

            <BotaoAgendamento
              label="Confirmar agendamento"
              onPress={handleConfirmarAgendamento}
              loading={confirmando}
              disabled={!canConfirmAgendamento}
              style={[styles.primaryBtn, !canConfirmAgendamento ? styles.disabledConfirmButton : null]}
            />
          </>
        ) : null}
      </CartaoAgendamento>

      {linkedToMedico ? (
        <BotaoAgendamento
          label="Desvincular médico"
          icon="close-circle-outline"
          variant="unlink"
          loading={desvinculando}
          onPress={handleDesvincularAcompanhamento}
          style={styles.secondaryBtn}
        />
      ) : (
        <BotaoAgendamento
          label="Solicitar acompanhamento"
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
  cardWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8ECF0',
    borderWidth: 1,
    borderRadius: 16,
  },
  calendarCard: { gap: 12, marginBottom: 14 },
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
  disabledConfirmButton: {
    backgroundColor: '#C9D1D9',
    borderColor: '#C9D1D9',
  },
  secondaryBtn: { marginTop: 0 },
});
