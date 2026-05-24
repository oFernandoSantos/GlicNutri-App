import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import {
  AvatarProfissional,
  BotaoAgendamento,
  CartaoAgendamento,
} from '../../componentes/agendamento/uiAgendamento';
import CalendarioHorarios from '../../componentes/agendamento/CalendarioHorarios';
import { patientTheme } from '../../temas/temaVisualPaciente';
import { fetchPatientById, getPatientId } from '../../servicos/servicoDadosPaciente';
import { formatValorConsulta } from '../../servicos/servicoGoogleMeet';
import {
  createConsulta,
  listConsultasByNutricionista,
  updateConsultaSchedule,
} from '../../servicos/servicoConsultas';
import { createFollowUpRequest } from '../../servicos/servicoSolicitacoesAcompanhamento';
import {
  isPatientLinkedToNutritionist,
  unlinkPatientNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import {
  generateSlotsForNextDays,
  listNutriAvailability,
} from '../../servicos/servicoAgendaNutri';
import {
  formatTimeLabel,
  getNutriEspecialidadeLabel,
  getStableExperienceYears,
  getStableRating,
  getStableReviewCount,
  groupSlotsByDay,
  markSlotsWithBooking,
} from '../../utilitarios/slotsTeleconsulta';
import { getNutritionistById } from '../../servicos/servicoNutricionistas';

function getPacienteNome(usuario) {
  return usuario?.nome_completo || usuario?.nome_pac || usuario?.email_pac || 'Paciente';
}

function getNutriAvatarUri(nutri) {
  const seed = encodeURIComponent(
    String(nutri?.id_nutricionista_uuid || nutri?.nome_completo_nutri || 'nutri').trim()
  );
  return `https://api.dicebear.com/8.x/thumbs/png?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function uniqueSlotsByScheduledAt(items) {
  const seen = new Set();
  return (items || []).filter((slot) => {
    const key = String(slot?.scheduledAt || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function PacientePerfilNutricionistaScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const nutricionistaBase = route?.params?.nutricionista || null;
  const consultaEdicao = route?.params?.editingConsulta || null;
  const tipoConsulta = route?.params?.tipoConsulta || 'Teleconsulta';
  const convenio = route?.params?.convenio || 'Particular';
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const isEditing = Boolean(consultaEdicao?.id);
  const [nutricionista, setNutricionista] = useState(nutricionistaBase);

  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [linkedToNutri, setLinkedToNutri] = useState(false);
  const [linkedNutritionistId, setLinkedNutritionistId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [erroAgenda, setErroAgenda] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    setNutricionista(nutricionistaBase);
  }, [nutricionistaBase]);

  useEffect(() => {
    let ativo = true;

    async function carregarPerfilCompleto() {
      if (!nutricionistaBase?.id_nutricionista_uuid) return;

      try {
        const perfilCompleto = await getNutritionistById(nutricionistaBase.id_nutricionista_uuid);
        if (!ativo || !perfilCompleto) return;
        setNutricionista((anterior) => ({
          ...(anterior || {}),
          ...perfilCompleto,
        }));
      } catch (error) {
        console.log('Erro ao carregar perfil completo do profissional:', error);
      }
    }

    carregarPerfilCompleto();

    return () => {
      ativo = false;
    };
  }, [nutricionistaBase?.id_nutricionista_uuid]);

  const rating = useMemo(
    () => getStableRating(nutricionista?.id_nutricionista_uuid),
    [nutricionista?.id_nutricionista_uuid]
  );
  const totalAvaliacoes = useMemo(
    () =>
      Number.isFinite(Number(nutricionista?.total_avaliacoes)) &&
      Number(nutricionista?.total_avaliacoes) > 0
        ? Number(nutricionista.total_avaliacoes)
        : getStableReviewCount(nutricionista?.id_nutricionista_uuid),
    [nutricionista?.id_nutricionista_uuid, nutricionista?.total_avaliacoes]
  );
  const anosExperiencia = useMemo(
    () =>
      Number.isFinite(Number(nutricionista?.anos_experiencia)) &&
      Number(nutricionista?.anos_experiencia) > 0
        ? Number(nutricionista.anos_experiencia)
        : getStableExperienceYears(nutricionista?.id_nutricionista_uuid),
    [nutricionista?.id_nutricionista_uuid, nutricionista?.anos_experiencia]
  );

  const especialidade = getNutriEspecialidadeLabel(nutricionista);
  const valorLabel = formatValorConsulta(nutricionista?.valor_consulta_centavos);
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
    navigation.setOptions({
      readerTitle: 'Perfil do Profissional',
    });

    return () => {
      navigation.setOptions({
        readerTitle: null,
      });
    };
  }, [navigation]);

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
    if (!nutricionista?.id_nutricionista_uuid) return;

    try {
      setErroAgenda('');
      setLoadingAgenda(true);
      const [availability, consultas] = await Promise.all([
        listNutriAvailability(nutricionista.id_nutricionista_uuid),
        listConsultasByNutricionista(nutricionista.id_nutricionista_uuid, { limit: 200 }),
      ]);

      const generated = generateSlotsForNextDays(availability, { days: 21 });
      const occupiedBase = isEditing
        ? (consultas || []).filter((item) => item.id !== consultaEdicao?.id)
        : consultas;
      const marked = markSlotsWithBooking(generated, occupiedBase);
      setSlots(marked);
      setSelectedSlot(null);
    } catch (error) {
      console.log('Erro ao carregar agenda do profissional:', error);
      setSlots([]);
      setErroAgenda('Não foi possível carregar datas e horários deste profissional.');
    } finally {
      setLoadingAgenda(false);
    }
  }, [nutricionista?.id_nutricionista_uuid, isEditing, consultaEdicao?.id]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  useEffect(() => {
    let active = true;

    async function carregarVinculo() {
      if (!nutricionista?.id_nutricionista_uuid || !patientId) {
        setLinkedToNutri(false);
        return;
      }

      try {
        const pacienteAtual = await fetchPatientById(patientId, {
          currentPatient: usuarioLogado,
          patientContext: usuarioLogado,
        }).catch(() => null);
        const currentLinkedId = pacienteAtual?.id_nutricionista_uuid || null;
        const linked = await isPatientLinkedToNutritionist({
          pacienteId: patientId,
          nutricionistaId: nutricionista.id_nutricionista_uuid,
        });
        if (active) {
          setLinkedNutritionistId(currentLinkedId);
          setLinkedToNutri(linked);
        }
      } catch (error) {
        console.log('Erro ao verificar vinculo com nutricionista:', error);
        if (active) {
          setLinkedNutritionistId(null);
          setLinkedToNutri(false);
        }
      }
    }

    carregarVinculo();

    return () => {
      active = false;
    };
  }, [nutricionista?.id_nutricionista_uuid, patientId]);

  async function handleSolicitarAcompanhamento() {
    if (!nutricionista?.id_nutricionista_uuid || !patientId) {
      setFeedback('Nao foi possivel identificar o paciente ou nutricionista.');
      return;
    }

    if (
      linkedNutritionistId &&
      linkedNutritionistId !== nutricionista.id_nutricionista_uuid
    ) {
      setFeedback(
        'Voce ja possui um nutricionista vinculado. Desvincule o acompanhamento atual antes de solicitar outro.'
      );
      return;
    }

    try {
      setSolicitando(true);
      setFeedback('');
      const result = await createFollowUpRequest({
        nutricionistaId: nutricionista.id_nutricionista_uuid,
        pacienteId: patientId,
        mensagem: `${tipoConsulta} · ${convenio} · ${especialidade}`,
        actor: usuarioLogado,
      });

      setFeedback(
        result?.message ||
          'Solicitacao enviada. O nutricionista precisa aprovar o acompanhamento antes do agendamento.'
      );
      if (result?.alreadyLinked) setLinkedToNutri(true);
    } catch (error) {
      console.log('Erro ao solicitar acompanhamento:', error);
      setFeedback(error?.message || 'Nao foi possivel enviar a solicitacao. Tente novamente.');
    } finally {
      setSolicitando(false);
    }
  }

  async function handleDesvincularAcompanhamento() {
    if (!nutricionista?.id_nutricionista_uuid || !patientId) {
      setFeedback('Nao foi possivel identificar o acompanhamento para desvincular.');
      return;
    }

    try {
      setDesvinculando(true);
      setFeedback('');
      await unlinkPatientNutritionist({
        pacienteId: patientId,
        nutricionistaId: nutricionista.id_nutricionista_uuid,
        actor: usuarioLogado,
        origin: 'paciente',
      });
      setLinkedToNutri(false);
      setFeedback('Acompanhamento encerrado. Voce pode solicitar novamente quando precisar.');
    } catch (error) {
      console.log('Erro ao desvincular acompanhamento:', error);
      setFeedback(error?.message || 'Nao foi possivel desvincular o acompanhamento.');
    } finally {
      setDesvinculando(false);
    }
  }

  function handleFecharAgenda() {
    setSelectedSlot(null);
    setObservacoes('');
    setErroAgenda('');
    navigation.setParams({
      openSchedulePopup: false,
    });
  }

  async function handleConfirmarAgendamento() {
    if (!selectedSlot || !nutricionista?.id_nutricionista_uuid || !patientId) {
      setErroAgenda('Selecione um horário disponível para continuar.');
      return;
    }

    try {
      setConfirmando(true);
      const motivo = [observacoes.trim(), `${tipoConsulta} · ${convenio} · ${especialidade}`]
        .filter(Boolean)
        .join(' · ');

      if (isEditing) {
        await updateConsultaSchedule({
          consultaId: consultaEdicao.id,
          scheduledAt: selectedSlot.scheduledAt,
          motivo,
          tipoConsulta,
          convenio,
          especialidade,
          valorCentavos: nutricionista.valor_consulta_centavos,
          nutricionista,
          actor: usuarioLogado,
        });

        handleFecharAgenda();
        navigation.navigate('PacienteAgendamentos', {
          usuarioLogado,
          activeSection: 'consultas',
        });
        return;
      }
      if (!linkedToNutri) {
        setErroAgenda(
          'Solicite o acompanhamento primeiro. Depois da aprovacao do nutricionista, o agendamento fica liberado.'
        );
        return;
      }

      await createConsulta({
        nutricionistaId: nutricionista.id_nutricionista_uuid,
        pacienteId: patientId,
        scheduledAt: selectedSlot.scheduledAt,
        motivo,
        tipoConsulta,
        convenio,
        especialidade,
        valorCentavos: nutricionista.valor_consulta_centavos,
        nutricionista,
        pacienteNome: getPacienteNome(usuarioLogado),
        actor: usuarioLogado,
      });

      handleFecharAgenda();
      navigation.navigate('PacienteAgendamentos', {
        usuarioLogado,
        activeSection: 'consultas',
      });
    } catch (error) {
      console.log('Erro ao agendar consulta pelo perfil:', error);
      setErroAgenda(
        error?.message || 'Não foi possível confirmar o agendamento. Tente novamente.'
      );
    } finally {
      setConfirmando(false);
    }
  }

  if (!nutricionista) {
    return (
      <PatientScreenLayout
        navigation={navigation}
        route={route}
        usuarioLogado={usuarioLogado}
        title="Perfil do profissional"
        subtitle="Profissional não encontrado."
      >
        <Text style={styles.empty}>Volte e selecione um nutricionista na lista.</Text>
        <BotaoAgendamento label="Voltar" variant="ghost" onPress={() => navigation.goBack()} />
      </PatientScreenLayout>
    );
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      showTabBar={false}
    >
      <View style={styles.content}>
        <CartaoAgendamento style={styles.hero}>
          <View style={styles.heroRow}>
            <AvatarProfissional
              name={nutricionista.nome_completo_nutri}
              size={72}
              online
              imageUri={getNutriAvatarUri(nutricionista)}
            />
            <View style={styles.heroBody}>
              <Text style={styles.name}>{nutricionista.nome_completo_nutri}</Text>
              <Text style={styles.spec}>{especialidade}</Text>
              <Text style={styles.crn}>
                {nutricionista.crm_numero
                  ? `CRN ${nutricionista.crm_numero}`
                  : 'CRN não informado'}
              </Text>
              <View style={styles.ratingRow}>
                <View style={styles.metaGroup}>
                  <Ionicons name="star" size={14} color={patientTheme.colors.warning} />
                  <Text style={styles.rating}>{rating}</Text>
                </View>
                {anosExperiencia != null ? (
                  <>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.metaInfo}>{anosExperiencia} anos de experiÃªncia</Text>
                  </>
                ) : null}
                {totalAvaliacoes != null ? (
                  <Text style={styles.ratingCount}>({totalAvaliacoes} avaliações)</Text>
                ) : null}
                <Text style={styles.dot}>•</Text>
                <Ionicons
                  name="videocam-outline"
                  size={14}
                  color={patientTheme.colors.primaryDark}
                />
                <Text style={styles.channel}>Google Meet</Text>
              </View>
              <View style={styles.ratingRowCompact}>
                <View style={styles.metaGroup}>
                  <Ionicons name="star" size={14} color={patientTheme.colors.warning} />
                  <Text style={styles.rating}>{rating}</Text>
                </View>
                <Text style={styles.ratingCount}>({totalAvaliacoes})</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaInfo}>{anosExperiencia} anos de experiência</Text>
              </View>
            </View>
          </View>
        </CartaoAgendamento>

        <CartaoAgendamento style={styles.block}>
          <Text style={styles.blockTitle}>Sobre o profissional</Text>
          <Text style={styles.blockText}>
            {nutricionista.bio_resumo ||
              'Atendimento por teleconsulta com foco em controle glicêmico e plano alimentar personalizado.'}
          </Text>
          {nutricionista.formacao_resumo ? (
            <Text style={styles.blockText}>{nutricionista.formacao_resumo}</Text>
          ) : null}
        </CartaoAgendamento>

        <CartaoAgendamento style={styles.block}>
          <Text style={styles.blockTitle}>Especialidades</Text>
          <View style={styles.tags}>
            {(nutricionista.especialidades || [especialidade]).map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </CartaoAgendamento>

        <CartaoAgendamento style={styles.block}>
          <Text style={styles.blockTitle}>Detalhes da teleconsulta</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Valor da consulta</Text>
            <Text style={styles.detailValue}>{valorLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Canal</Text>
            <Text style={styles.detailValue}>Google Meet (link enviado após confirmação)</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Convênio</Text>
            <Text style={styles.detailValue}>
              {nutricionista.aceita_convenio ? convenio : 'Somente particular'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo selecionado</Text>
            <Text style={styles.detailValue}>{tipoConsulta}</Text>
          </View>
        </CartaoAgendamento>

        <CartaoAgendamento style={styles.block}>
          <View style={styles.scheduleHeader}>
            <View>
              <Text style={styles.blockTitle}>Calendário de horários</Text>
              <Text style={styles.scheduleSubtitle}>{nutricionista.nome_completo_nutri}</Text>
            </View>
            {loadingAgenda ? <ActivityIndicator color={patientTheme.colors.primaryDark} /> : null}
          </View>

          {loadingAgenda ? (
            <View style={styles.scheduleLoading}>
              <Text style={styles.blockText}>Carregando disponibilidade...</Text>
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

          {(linkedToNutri || isEditing) && calendarDays.length ? (
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

              {erroAgenda ? <Text style={styles.errorText}>{erroAgenda}</Text> : null}

              <View style={styles.inlineAgendaActions}>
                <BotaoAgendamento
                  label={isEditing ? 'Salvar novo horário' : 'Confirmar Agendamento'}
                  onPress={handleConfirmarAgendamento}
                  loading={confirmando}
                />
              </View>
            </>
          ) : null}
        </CartaoAgendamento>

        {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

        {!linkedToNutri && !isEditing ? (
          <BotaoAgendamento
            label="Solicitar acompanhamento"
            icon="person-add-outline"
            onPress={handleSolicitarAcompanhamento}
            loading={solicitando}
          />
        ) : null}

        {linkedToNutri && !isEditing ? (
          <BotaoAgendamento
            label="Desvincular nutricionista"
            icon="close-circle-outline"
            variant="ghost"
            onPress={handleDesvincularAcompanhamento}
            loading={desvinculando}
          />
        ) : null}
      </View>

      {false ? (
      <Modal visible={false} transparent animationType="fade" onRequestClose={handleFecharAgenda}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardWrap}
          >
            <View style={styles.modalCard}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {isEditing ? 'Editar Agendamento' : 'Agendar Consulta'}
                  </Text>
                  <TouchableOpacity onPress={handleFecharAgenda}>
                    <Ionicons name="close" size={18} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalProfile}>
                  <AvatarProfissional
                    name={nutricionista.nome_completo_nutri}
                    size={44}
                    imageUri={getNutriAvatarUri(nutricionista)}
                  />
                  <View style={styles.modalProfileBody}>
                    <Text style={styles.modalProfileName}>{nutricionista.nome_completo_nutri}</Text>
                    <Text style={styles.modalProfileSpec}>{especialidade}</Text>
                  </View>
                </View>

                <View style={styles.modalDivider} />

                {loadingAgenda ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator color={patientTheme.colors.primaryDark} />
                    <Text style={styles.modalLoadingText}>Carregando disponibilidade...</Text>
                  </View>
                ) : (
                  <>
                <Text style={styles.fieldLabel}>Dia da Semana</Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.selectField}
                  onPress={() => {
                    setErroAgenda('');
                    setSelectorAberto((prev) => (prev === 'dia' ? '' : 'dia'));
                  }}
                >
                  <Text style={[styles.selectValue, !selectedDay && styles.placeholderText]}>
                    {selectedDay ? selectedDay.label : 'Selecione um dia'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={patientTheme.colors.textMuted} />
                </TouchableOpacity>
                {selectorAberto === 'dia' ? (
                  <View style={styles.optionsPanel}>
                    <ScrollView nestedScrollEnabled style={styles.optionsScroll}>
                      {availableDays.length ? (
                        availableDays.map((day) => (
                          <TouchableOpacity
                            key={day.dateKey}
                            style={styles.optionRow}
                            onPress={() => {
                              setSelectedDayKey(day.dateKey);
                              setSelectedSlot(null);
                              setErroAgenda('');
                              setSelectorAberto('');
                            }}
                          >
                            <Text style={styles.optionText}>{day.label}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.emptyOptions}>
                          <Text style={styles.emptyOptionsText}>
                            Este profissional ainda não liberou dias na agenda.
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>Horário</Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.selectField}
                  onPress={() => {
                    setErroAgenda('');
                    if (!selectedDay) {
                      setSelectorAberto('dia');
                      setErroAgenda('Selecione primeiro um dia com disponibilidade.');
                      return;
                    }
                    setSelectorAberto((prev) => (prev === 'horario' ? '' : 'horario'));
                  }}
                >
                  <Text style={[styles.selectValue, !selectedSlot && styles.placeholderText]}>
                    {selectedSlot ? formatTimeLabel(selectedSlot.scheduledAt) : 'Selecione um horário'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={patientTheme.colors.textMuted} />
                </TouchableOpacity>
                {selectorAberto === 'horario' ? (
                  <View style={styles.optionsPanel}>
                    <ScrollView nestedScrollEnabled style={styles.optionsScroll}>
                      {availableSlots.length ? (
                        availableSlots.map((slot) => (
                          <TouchableOpacity
                            key={slot.scheduledAt}
                            style={styles.optionRow}
                            onPress={() => {
                              setSelectedSlot(slot);
                              setSelectorAberto('');
                            }}
                          >
                            <Text style={styles.optionText}>{formatTimeLabel(slot.scheduledAt)}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.emptyOptions}>
                          <Text style={styles.emptyOptionsText}>
                            Nenhum horário disponível no período.
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                ) : null}

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

                {erroAgenda ? <Text style={styles.errorText}>{erroAgenda}</Text> : null}

                <View style={styles.actionsRow}>
                  <BotaoAgendamento
                    label="Cancelar"
                    variant="ghost"
                    onPress={handleFecharAgenda}
                    style={styles.cancelButton}
                  />
                  <BotaoAgendamento
                    label={isEditing ? 'Salvar novo horário' : 'Confirmar Agendamento'}
                    onPress={handleConfirmarAgendamento}
                    loading={confirmando}
                    style={styles.confirmButton}
                  />
                </View>
                  </>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      ) : null}
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    gap: 12,
  },
  hero: {
    marginBottom: 4,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
  },
  heroBody: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  spec: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  crn: {
    marginTop: 4,
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
    fontSize: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    display: 'none',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 10,
  },
  ratingRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 10,
  },
  metaGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 4,
  },
  rating: {
    flexShrink: 0,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  ratingCount: {
    color: patientTheme.colors.textMuted,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '600',
  },
  metaInfo: {
    color: patientTheme.colors.textMuted,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    color: patientTheme.colors.textMuted,
    flexShrink: 0,
  },
  channel: {
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
    flexShrink: 0,
    fontSize: 12,
  },
  block: {
    gap: 8,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  scheduleSubtitle: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  scheduleLoading: {
    paddingVertical: 16,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  blockText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 22,
    fontWeight: '600',
  },
  feedbackText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
    fontSize: 12,
  },
  detailRow: {
    gap: 4,
    marginTop: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: patientTheme.colors.text,
    fontWeight: '700',
    lineHeight: 20,
  },
  empty: {
    color: patientTheme.colors.textMuted,
    marginBottom: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    backgroundColor: 'rgba(29, 35, 43, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  modalKeyboardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: patientTheme.colors.background,
    borderRadius: 14,
    maxHeight: '92%',
    padding: 16,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  modalProfile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  modalProfileBody: {
    flex: 1,
  },
  modalProfileName: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  modalProfileSpec: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  modalDivider: {
    backgroundColor: patientTheme.colors.border,
    height: 1,
    marginVertical: 14,
  },
  modalLoading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  modalLoadingText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  fieldLabel: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
  },
  selectField: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  selectValue: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  placeholderText: {
    color: patientTheme.colors.textMuted,
  },
  optionsPanel: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    maxHeight: 144,
  },
  optionsScroll: {
    maxHeight: 144,
  },
  optionRow: {
    borderBottomColor: patientTheme.colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyOptions: {
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  emptyOptionsText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: 10,
    color: patientTheme.colors.text,
    fontSize: 12,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  inlineAgendaActions: {
    marginTop: 12,
  },
  errorText: {
    color: '#c45b5b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    borderWidth: 1,
    flex: 0.9,
  },
  confirmButton: {
    flex: 2.4,
  },
});
