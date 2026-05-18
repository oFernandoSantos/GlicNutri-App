import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
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
import { patientTheme } from '../../temas/temaVisualPaciente';
import { getPatientId } from '../../servicos/servicoDadosPaciente';
import { formatValorConsulta } from '../../servicos/servicoGoogleMeet';
import {
  createConsulta,
  listConsultasByNutricionista,
  updateConsultaSchedule,
} from '../../servicos/servicoConsultas';
import {
  generateSlotsForNextDays,
  listNutriAvailability,
} from '../../servicos/servicoAgendaNutri';
import {
  formatTimeLabel,
  getNutriEspecialidadeLabel,
  getStableRating,
  groupSlotsByDay,
  markSlotsWithBooking,
} from '../../utilitarios/slotsTeleconsulta';

function getPacienteNome(usuario) {
  return usuario?.nome_completo || usuario?.nome_pac || usuario?.email_pac || 'Paciente';
}

function getNutriAvatarUri(nutri) {
  const seed = encodeURIComponent(
    String(nutri?.id_nutricionista_uuid || nutri?.nome_completo_nutri || 'nutri').trim()
  );
  return `https://api.dicebear.com/8.x/thumbs/png?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export default function PacientePerfilNutricionistaScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const nutricionista = route?.params?.nutricionista || null;
  const consultaEdicao = route?.params?.editingConsulta || null;
  const tipoConsulta = route?.params?.tipoConsulta || 'Teleconsulta';
  const convenio = route?.params?.convenio || 'Particular';
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const isEditing = Boolean(consultaEdicao?.id);

  const [agendaVisible, setAgendaVisible] = useState(Boolean(route?.params?.openSchedulePopup));
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [erroAgenda, setErroAgenda] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [selectorAberto, setSelectorAberto] = useState('');

  const rating = useMemo(
    () => getStableRating(nutricionista?.id_nutricionista_uuid),
    [nutricionista?.id_nutricionista_uuid]
  );

  const especialidade = getNutriEspecialidadeLabel(nutricionista);
  const valorLabel = formatValorConsulta(nutricionista?.valor_consulta_centavos);
  const calendarDays = useMemo(() => groupSlotsByDay(slots), [slots]);
  const availableDays = useMemo(
    () =>
      calendarDays.filter((day) =>
        (day.slots || []).some((slot) => slot.status === 'available')
      ),
    [calendarDays]
  );
  const selectedDay = useMemo(
    () => availableDays.find((day) => day.dateKey === selectedDayKey) || null,
    [availableDays, selectedDayKey]
  );
  const availableSlots = useMemo(
    () => (selectedDay?.slots || []).filter((slot) => slot.status === 'available'),
    [selectedDay]
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
    if (agendaVisible) {
      carregarAgenda();
    }
  }, [agendaVisible, carregarAgenda]);

  useEffect(() => {
    if (route?.params?.openSchedulePopup) {
      setAgendaVisible(true);
    }
  }, [route?.params?.openSchedulePopup]);

  function handleAbrirAgenda() {
    setAgendaVisible(true);
  }

  function handleFecharAgenda() {
    setAgendaVisible(false);
    setSelectedSlot(null);
    setObservacoes('');
    setErroAgenda('');
    setSelectorAberto('');
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
      await createConsulta({
        nutricionistaId: nutricionista.id_nutricionista_uuid,
        pacienteId: patientId,
        scheduledAt: selectedSlot.scheduledAt,
        motivo: [observacoes.trim(), `${tipoConsulta} · ${convenio} · ${especialidade}`]
          .filter(Boolean)
          .join(' · '),
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
                <Ionicons name="star" size={14} color={patientTheme.colors.warning} />
                <Text style={styles.rating}>{rating}</Text>
                <Text style={styles.dot}>•</Text>
                <Ionicons
                  name="videocam-outline"
                  size={14}
                  color={patientTheme.colors.primaryDark}
                />
                <Text style={styles.channel}>Google Meet</Text>
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

        <BotaoAgendamento
          label="Agendar horário"
          icon="calendar-outline"
          onPress={handleAbrirAgenda}
        />
        <BotaoAgendamento
          label="Voltar à lista"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>

      <Modal visible={agendaVisible} transparent animationType="fade" onRequestClose={handleFecharAgenda}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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
          </View>
        </View>
      </Modal>
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
    gap: 4,
    marginTop: 10,
  },
  rating: {
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  dot: {
    color: patientTheme.colors.textMuted,
  },
  channel: {
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  block: {
    gap: 8,
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
  modalCard: {
    backgroundColor: patientTheme.colors.background,
    borderRadius: 14,
    padding: 16,
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
    backgroundColor: '#f5f6fa',
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
    backgroundColor: '#f5f6fa',
    borderRadius: 10,
    color: patientTheme.colors.text,
    fontSize: 12,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingTop: 14,
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
