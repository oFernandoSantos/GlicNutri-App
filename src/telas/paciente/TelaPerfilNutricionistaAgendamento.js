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
import {
  formatValorConsulta,
  VALOR_CONSULTA_PERFIL_CENTAVOS,
} from '../../servicos/servicoGoogleMeet';
import {
  createConsulta,
  listConsultasByNutricionista,
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
import { mostrarToastPaciente, mostrarToastPacienteErro } from '../../servicos/servicoToastPaciente';
import SecaoMeetConsultasProfissional from '../../componentes/paciente/SecaoMeetConsultasProfissional';
import CartaoPerfilProfissionalPaciente from '../../componentes/paciente/CartaoPerfilProfissionalPaciente';
import { abrirMensagensProfissionalVinculado } from '../../utilitarios/navegacaoMensagensProfissionalPaciente';
import { formatCrnNutricionista } from '../../utilitarios/formatRegistroProfissional';
import { getNutricionistaFotoModeloUri } from '../../utilitarios/fotoModeloProfissional';

function getPacienteNome(usuario) {
  return usuario?.nome_completo || usuario?.nome_pac || usuario?.email_pac || 'Paciente';
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
  const tipoConsulta = route?.params?.tipoConsulta || 'Teleconsulta';
  const convenio = route?.params?.convenio || 'Particular';
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [nutricionista, setNutricionista] = useState(nutricionistaBase);

  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [linkedToNutri, setLinkedToNutri] = useState(false);
  const [linkedNutritionistId, setLinkedNutritionistId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
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
  const valorLabel = formatValorConsulta(VALOR_CONSULTA_PERFIL_CENTAVOS);
  const normalizedSlots = useMemo(() => uniqueSlotsByScheduledAt(slots), [slots]);
  const calendarDays = useMemo(() => groupSlotsByDay(normalizedSlots), [normalizedSlots]);
  const availableDays = useMemo(
    () =>
      calendarDays.filter((day) =>
        (day.slots || []).some((slot) => slot.status === 'available')
      ),
    [calendarDays]
  );
  const abrirMensagensNutri = useCallback(() => {
    abrirMensagensProfissionalVinculado(navigation, {
      usuarioLogado,
      profissional: nutricionista,
      papel: 'nutricionista',
      vinculado: linkedToNutri,
    });
  }, [navigation, usuarioLogado, nutricionista, linkedToNutri]);

  useEffect(() => {
    navigation.setOptions({
      readerTitle: 'Perfil do Nutricionista',
      readerRightAction: abrirMensagensNutri,
      readerRightIcon: 'chatbubble-outline',
      readerRightAccessibilityLabel: 'Mensagem para a nutricionista',
      readerRightDisabled: !linkedToNutri,
    });

    return () => {
      navigation.setOptions({
        readerTitle: null,
        readerRightAction: undefined,
        readerRightIcon: undefined,
        readerRightAccessibilityLabel: undefined,
        readerRightDisabled: undefined,
      });
    };
  }, [navigation, abrirMensagensNutri, linkedToNutri]);

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
    if (!nutricionista?.id_nutricionista_uuid) return;

    try {
      setLoadingAgenda(true);
      const [availability, consultas] = await Promise.all([
        listNutriAvailability(nutricionista.id_nutricionista_uuid),
        listConsultasByNutricionista(nutricionista.id_nutricionista_uuid, { limit: 200 }),
      ]);

      const generated = generateSlotsForNextDays(availability, { days: 21 });
      const marked = markSlotsWithBooking(generated, consultas);
      setSlots(marked);
      setSelectedSlot(null);
    } catch (error) {
      console.log('Erro ao carregar agenda do profissional:', error);
      setSlots([]);
      mostrarToastPaciente({
        tipo: 'erro',
        texto: 'Agenda indisponível agora',
        subtexto: 'Não foi possível carregar horários desta nutricionista.',
      });
    } finally {
      setLoadingAgenda(false);
    }
  }, [nutricionista?.id_nutricionista_uuid]);

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
      mostrarToastPaciente({ tipo: 'erro', texto: 'Não encontramos seu cadastro ou a nutricionista' });
      return;
    }

    if (
      linkedNutritionistId &&
      linkedNutritionistId !== nutricionista.id_nutricionista_uuid
    ) {
      mostrarToastPaciente({
        tipo: 'aviso',
        texto: 'Você já tem nutricionista vinculada',
        subtexto: 'Encerre o acompanhamento atual antes de solicitar outra.',
      });
      return;
    }

    try {
      setSolicitando(true);
      const result = await createFollowUpRequest({
        nutricionistaId: nutricionista.id_nutricionista_uuid,
        pacienteId: patientId,
        mensagem: `${tipoConsulta} · ${convenio} · ${especialidade}`,
        actor: usuarioLogado,
      });

      mostrarToastPaciente({
        tipo: 'sucesso',
        texto: 'Solicitação enviada',
        subtexto:
          result?.message ||
          'A nutricionista precisa aprovar antes do agendamento.',
      });
      if (result?.alreadyLinked) setLinkedToNutri(true);
    } catch (error) {
      console.log('Erro ao solicitar acompanhamento:', error);
      mostrarToastPacienteErro(error, 'Não foi possível enviar sua solicitação agora.');
    } finally {
      setSolicitando(false);
    }
  }

  async function handleDesvincularAcompanhamento() {
    if (!nutricionista?.id_nutricionista_uuid || !patientId) {
      mostrarToastPaciente({ tipo: 'erro', texto: 'Não foi possível desvincular agora' });
      return;
    }

    try {
      setDesvinculando(true);
      await unlinkPatientNutritionist({
        pacienteId: patientId,
        nutricionistaId: nutricionista.id_nutricionista_uuid,
        actor: usuarioLogado,
        origin: 'paciente',
      });
      setLinkedToNutri(false);
      mostrarToastPaciente({
        tipo: 'sucesso',
        texto: 'Acompanhamento encerrado',
        subtexto: 'Você pode solicitar novamente quando quiser.',
      });
    } catch (error) {
      console.log('Erro ao desvincular acompanhamento:', error);
      mostrarToastPacienteErro(error, 'Não foi possível desvincular o acompanhamento agora.');
    } finally {
      setDesvinculando(false);
    }
  }

  function handleFecharAgenda() {
    setSelectedSlot(null);
    setObservacoes('');
    navigation.setParams({
      openSchedulePopup: false,
    });
  }

  async function handleConfirmarAgendamento() {
    if (!selectedSlot || !nutricionista?.id_nutricionista_uuid || !patientId) {
      mostrarToastPaciente({
        tipo: 'aviso',
        texto: 'Escolha um horário',
        subtexto: 'Selecione um horário livre na agenda.',
      });
      return;
    }

    if (!linkedToNutri) {
      mostrarToastPaciente({
        tipo: 'aviso',
        texto: 'Solicite acompanhamento primeiro',
        subtexto: 'Depois da aprovação da nutricionista, você poderá agendar.',
      });
      return;
    }

    try {
      setConfirmando(true);
      const motivo = [observacoes.trim(), `${tipoConsulta} · ${convenio} · ${especialidade}`]
        .filter(Boolean)
        .join(' · ');

      await createConsulta({
        nutricionistaId: nutricionista.id_nutricionista_uuid,
        pacienteId: patientId,
        scheduledAt: selectedSlot.scheduledAt,
        motivo,
        tipoConsulta,
        convenio,
        especialidade,
        valorCentavos: VALOR_CONSULTA_PERFIL_CENTAVOS,
        nutricionista,
        pacienteNome: getPacienteNome(usuarioLogado),
        actor: usuarioLogado,
      });

      mostrarToastPaciente({
        tipo: 'sucesso',
        texto: 'Consulta agendada',
        subtexto: 'Veja os detalhes em Minhas consultas.',
      });

      handleFecharAgenda();
      navigation.navigate('PacienteAgendamentos', {
        usuarioLogado,
        activeSection: 'consultas',
      });
    } catch (error) {
      console.log('Erro ao agendar consulta pelo perfil:', error);
      mostrarToastPacienteErro(error, 'Não foi possível confirmar seu agendamento agora.');
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
        title="Perfil do Nutricionista"
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
        <CartaoPerfilProfissionalPaciente
          linked={linkedToNutri}
          linkedLabel="Nutricionista vinculada"
          name={nutricionista.nome_completo_nutri}
          specialty={especialidade}
          registration={formatCrnNutricionista(nutricionista.crm_numero)}
          avatarName={nutricionista.nome_completo_nutri}
          avatarUri={getNutricionistaFotoModeloUri(nutricionista)}
          rating={rating}
          reviewCount={totalAvaliacoes}
          yearsExperience={anosExperiencia}
          bio={
            nutricionista.bio_resumo ||
            'Teleconsulta com foco em controle glicêmico e plano alimentar personalizado.'
          }
          tags={(nutricionista.especialidades || [especialidade]).slice(0, 4)}
          detailItems={[
            { label: 'Valor', value: valorLabel },
            { label: 'Tipo', value: tipoConsulta },
            {
              label: 'Convênio',
              value: nutricionista.aceita_convenio ? convenio : 'Particular',
            },
          ]}
        />

        <SecaoMeetConsultasProfissional
          patientId={patientId}
          profissionalId={nutricionista.id_nutricionista_uuid}
          profissionalTipo="nutricionista"
          profissional={nutricionista}
        />

        <CartaoAgendamento style={[styles.block, styles.cardWhite]}>
          <View style={styles.scheduleHeader}>
            <View>
              <Text style={styles.blockTitle}>Calendário de horários</Text>
              <Text style={styles.scheduleSubtitle}>{nutricionista.nome_completo_nutri}</Text>
            </View>
            {loadingAgenda ? <ActivityIndicator color={patientTheme.colors.primaryDark} /> : null}
          </View>

          <Text style={styles.scheduleHint}>
            {linkedToNutri
              ? 'Escolha dia e horário e confirme abaixo.'
              : 'Solicite acompanhamento para liberar o agendamento.'}
          </Text>

          {loadingAgenda ? (
            <View style={styles.scheduleLoading}>
              <Text style={styles.blockText}>Carregando disponibilidade...</Text>
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

          {linkedToNutri && calendarDays.length ? (
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

              <View style={styles.inlineAgendaActions}>
                <BotaoAgendamento
                  label="Confirmar agendamento"
                  onPress={handleConfirmarAgendamento}
                  loading={confirmando}
                />
              </View>
            </>
          ) : null}
        </CartaoAgendamento>

        {!linkedToNutri ? (
          <BotaoAgendamento
            label="Solicitar acompanhamento"
            icon="person-add-outline"
            onPress={handleSolicitarAcompanhamento}
            loading={solicitando}
          />
        ) : (
          <BotaoAgendamento
            label="Desvincular nutricionista"
            icon="close-circle-outline"
            variant="unlink"
            onPress={handleDesvincularAcompanhamento}
            loading={desvinculando}
          />
        )}
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
                    Agendar Consulta
                  </Text>
                  <TouchableOpacity onPress={handleFecharAgenda}>
                    <Ionicons name="close" size={18} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalProfile}>
                  <AvatarProfissional
                    name={nutricionista.nome_completo_nutri}
                    size={44}
                    imageUri={getNutricionistaFotoModeloUri(nutricionista)}
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
                    if (!selectedDay) {
                      setSelectorAberto('dia');
                      mostrarToastPaciente({
                        tipo: 'aviso',
                        texto: 'Escolha o dia primeiro',
                        subtexto: 'Selecione um dia com horários disponíveis.',
                      });
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

                <View style={styles.actionsRow}>
                  <BotaoAgendamento
                    label="Cancelar"
                    variant="ghost"
                    onPress={handleFecharAgenda}
                    style={styles.cancelButton}
                  />
                  <BotaoAgendamento
                    label="Confirmar Agendamento"
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
  cardWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8ECF0',
    borderWidth: 1,
    borderRadius: 16,
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
  scheduleHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
