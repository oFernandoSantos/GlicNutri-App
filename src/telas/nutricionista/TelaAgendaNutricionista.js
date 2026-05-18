import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import GavetaConsultaProfissional from '../../componentes/agendamento/GavetaConsultaProfissional';
import {
  AvatarProfissional,
  BadgeStatusConsulta,
  BotaoAgendamento,
  CampoBuscaAgendamento,
  CartaoAgendamento,
  ChipFiltro,
} from '../../componentes/agendamento/uiAgendamento';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import MensagemInline from '../../componentes/comum/MensagemInline';
import { supabase } from '../../servicos/configSupabase';
import {
  buildSlotLabel,
  deleteNutriAvailability,
  generateSlotsForNextDays,
  listNutriAvailability,
  upsertNutriAvailability,
} from '../../servicos/servicoAgendaNutri';
import {
  abrirLinkGoogleMeet,
  formatConsultaDateTime,
  listConsultasByNutricionista,
  updateConsultaStatus,
} from '../../servicos/servicoConsultas';
import { normalizeGoogleMeetUrl, resolveMeetLink } from '../../servicos/servicoGoogleMeet';
import { updateNutricionistaTeleconsultaPerfil } from '../../servicos/servicoNutricionistas';
import {
  marcarNotificacoesComoLidas,
  subscribeNotificacoesConsulta,
} from '../../servicos/servicoNotificacoesConsulta';
import {
  buildWeekDays,
  formatSlotDateKey,
  formatTimeLabel,
  groupConsultasForWeek,
  markSlotsWithBooking,
} from '../../utilitarios/slotsTeleconsulta';

const weekdayOptions = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
];

function getNutriId(usuarioLogado) {
  return (
    usuarioLogado?.id_nutricionista_uuid ||
    usuarioLogado?.user_metadata?.id_nutricionista_uuid ||
    usuarioLogado?.id ||
    null
  );
}

function MetricCard({ icon, label, value, helper }) {
  return (
    <CartaoAgendamento style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={18} color={patientTheme.colors.primaryDark} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </CartaoAgendamento>
  );
}

export default function TelaAgendaNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const nutricionistaId = useMemo(() => getNutriId(usuarioLogado), [usuarioLogado]);
  const nomeProfissional =
    usuarioLogado?.nome_completo_nutri || usuarioLogado?.nome_nutri || 'Profissional';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [bannerFluxo, setBannerFluxo] = useState(null);
  const [toastSucesso, setToastSucesso] = useState(null);

  const [availability, setAvailability] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [agendaView, setAgendaView] = useState('week');
  const [searchGlobal, setSearchGlobal] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [formError, setFormError] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [slotMinutes, setSlotMinutes] = useState('30');

  const [drawerConsulta, setDrawerConsulta] = useState(null);
  const [drawerPaciente, setDrawerPaciente] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [meetLinkPadrao, setMeetLinkPadrao] = useState('');
  const [bioResumo, setBioResumo] = useState('');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [notificacoesNutri, setNotificacoesNutri] = useState([]);

  const weekDays = useMemo(() => buildWeekDays(), []);
  const consultasSemana = useMemo(
    () => groupConsultasForWeek(consultas, weekDays),
    [consultas, weekDays]
  );

  const load = useCallback(
    async (options = {}) => {
      const { withBlockingSpinner = true } = options;
      try {
        if (withBlockingSpinner) setLoading(true);
        setLoadError(null);
        const [avail, cons] = await Promise.all([
          listNutriAvailability(nutricionistaId),
          listConsultasByNutricionista(nutricionistaId, { limit: 200 }),
        ]);
        setAvailability(avail || []);
        setConsultas(cons || []);
      } catch (error) {
        console.log('Erro ao carregar agenda nutri:', error);
        setLoadError(
          'Não foi possível carregar sua agenda. Verifique a conexão e tente novamente.'
        );
      } finally {
        if (withBlockingSpinner) setLoading(false);
      }
    },
    [nutricionistaId]
  );

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', () => load({ withBlockingSpinner: false }));
    return unsubscribe;
  }, [navigation, load]);

  useEffect(() => {
    setMeetLinkPadrao(normalizeGoogleMeetUrl(usuarioLogado?.meet_link_padrao || ''));
    setBioResumo(usuarioLogado?.bio_resumo || '');
  }, [usuarioLogado]);

  useEffect(() => {
    if (!nutricionistaId) return undefined;

    return subscribeNotificacoesConsulta({
      destinatarioTipo: 'nutricionista',
      destinatarioId: nutricionistaId,
      intervalMs: 18000,
      onChange: async (items) => {
        setNotificacoesNutri(items || []);
        const latest = items?.[0];
        if (!latest) return;

        setToastSucesso(latest.mensagem || latest.titulo);
        await marcarNotificacoesComoLidas({
          destinatarioTipo: 'nutricionista',
          destinatarioId: nutricionistaId,
          ids: [latest.id],
        });
        await load({ withBlockingSpinner: false });
      },
    });
  }, [nutricionistaId, load]);

  const onRefreshAgenda = useCallback(async () => {
    setRefreshing(true);
    await load({ withBlockingSpinner: false });
    setRefreshing(false);
  }, [load]);

  const metrics = useMemo(() => {
    const todayKey = formatSlotDateKey(new Date().toISOString());
    const consultasHoje = (consultas || []).filter(
      (item) =>
        formatSlotDateKey(item.scheduled_at) === todayKey && item.status !== 'cancelled'
    );
    const pendentes = (consultas || []).filter(
      (item) => item.status === 'scheduled' || item.status === 'pending'
    );
    const slots = markSlotsWithBooking(
      generateSlotsForNextDays(availability, { days: 1 }),
      consultas
    );
    const livresHoje = slots.filter(
      (slot) =>
        formatSlotDateKey(slot.scheduledAt) === todayKey && slot.status === 'available'
    ).length;

    return {
      consultasHoje: consultasHoje.length,
      horariosLivres: livresHoje,
      pendentes: pendentes.length,
      faturamento: `R$ ${(consultasHoje.length * 120).toFixed(0)}`,
    };
  }, [availability, consultas]);

  const filteredWeekConsultas = useMemo(() => {
    const q = searchGlobal.trim().toLowerCase();
    if (!q) return consultasSemana;

    const filtered = {};
    Object.keys(consultasSemana).forEach((key) => {
      filtered[key] = (consultasSemana[key] || []).filter((item) =>
        String(item.motivo || item.status || item.id || '')
          .toLowerCase()
          .includes(q)
      );
    });
    return filtered;
  }, [consultasSemana, searchGlobal]);

  async function openDrawer(consulta) {
    setDrawerConsulta(consulta);
    setDrawerPaciente(null);
    if (!consulta?.paciente_id) return;

    try {
      setDrawerLoading(true);
      const { data, error } = await supabase
        .from('paciente')
        .select('*')
        .eq('id_paciente_uuid', consulta.paciente_id)
        .maybeSingle();
      if (error) throw error;
      setDrawerPaciente(data || null);
    } catch (error) {
      console.log('Erro carregar paciente drawer:', error);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setDrawerConsulta(null);
    setDrawerPaciente(null);
  }

  async function handleSalvarPerfilTeleconsulta() {
    try {
      setSalvandoPerfil(true);
      await updateNutricionistaTeleconsultaPerfil({
        nutricionistaId,
        meetLinkPadrao: meetLinkPadrao,
        bioResumo,
      });
      setToastSucesso('Perfil de teleconsulta atualizado.');
    } catch (error) {
      setBannerFluxo(error?.message || 'Não foi possível salvar o perfil de teleconsulta.');
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function handleConsultaAction(item, nextStatus) {
    try {
      await updateConsultaStatus({
        consultaId: item.id,
        status: nextStatus,
        nutricionista: usuarioLogado,
        actor: usuarioLogado,
      });
      setToastSucesso(
        nextStatus === 'confirmed'
          ? 'Consulta confirmada com sucesso.'
          : nextStatus === 'cancelled'
            ? 'Consulta cancelada.'
            : 'Status atualizado.'
      );
      closeDrawer();
      await load({ withBlockingSpinner: false });
    } catch (error) {
      setBannerFluxo(
        error?.message ||
          'Não foi possível atualizar a consulta. Verifique a conexão e tente novamente.'
      );
    }
  }

  function openCreateModal() {
    setEditRow(null);
    setWeekday(1);
    setStartTime('08:00');
    setEndTime('12:00');
    setSlotMinutes('30');
    setFormError('');
    setModalVisible(true);
  }

  function openEditModal(row) {
    setEditRow(row);
    setWeekday(Number(row.weekday) || 0);
    setStartTime(String(row.start_time || '08:00').slice(0, 5));
    setEndTime(String(row.end_time || '12:00').slice(0, 5));
    setSlotMinutes(String(row.slot_minutes || 30));
    setModalVisible(true);
  }

  async function handleSaveAvailability() {
    try {
      setFormError('');
      const saved = await upsertNutriAvailability({
        id: editRow?.id,
        nutricionistaId,
        weekday,
        startTime,
        endTime,
        slotMinutes: Number(slotMinutes) || 30,
        active: true,
        actor: usuarioLogado,
      });
      setModalVisible(false);
      await load({ withBlockingSpinner: false });
      setToastSucesso(`Disponibilidade salva: ${buildSlotLabel(saved)}`);
    } catch (error) {
      setFormError(error?.message || 'Não foi possível salvar a disponibilidade.');
    }
  }

  async function handleDeleteAvailability(row) {
    Alert.alert('Excluir disponibilidade', 'Deseja excluir este bloco de horários?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNutriAvailability({ id: row.id, actor: usuarioLogado });
            await load({ withBlockingSpinner: false });
            setToastSucesso('Disponibilidade removida.');
          } catch (error) {
            setBannerFluxo('Não foi possível excluir. Verifique a conexão e tente novamente.');
          }
        },
      },
    ]);
  }

  return (
    <>
      <LayoutNutricionista
        navigation={navigation}
        route={route}
        usuarioLogado={usuarioLogado}
        title="Agenda profissional"
        subtitle="Teleconsultas, disponibilidade e consultas em um painel unificado."
        rightAction={
          <TouchableOpacity style={styles.iconButton} onPress={() => load()} disabled={loading}>
            <Ionicons name="refresh-outline" size={20} color={patientTheme.colors.text} />
          </TouchableOpacity>
        }
        showTabBar={route?.name === 'NutricionistaAgenda'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshAgenda} />
        }
      >
        {toastSucesso ? (
          <MensagemInline
            tipo="sucesso"
            texto={toastSucesso}
            onFechar={() => setToastSucesso(null)}
            autoOcultarMs={3800}
          />
        ) : null}
        {bannerFluxo ? (
          <MensagemInline tipo="erro" texto={bannerFluxo} onFechar={() => setBannerFluxo(null)} />
        ) : null}

        <View style={styles.proHeader}>
          <AvatarProfissional name={nomeProfissional} size={52} online />
          <View style={styles.proHeaderCopy}>
            <Text style={styles.proName}>{nomeProfissional}</Text>
            <Text style={styles.proRole}>Nutrição clínica · Google Meet</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlinePill} />
              <Text style={styles.onlineText}>
                {notificacoesNutri.length
                  ? `${notificacoesNutri.length} alerta(s) de consulta`
                  : 'Online para atendimentos'}
              </Text>
            </View>
          </View>
        </View>

        <CartaoAgendamento style={styles.meetCard}>
          <Text style={styles.meetTitle}>Sala Google Meet padrão</Text>
          <Text style={styles.meetHint}>
            Cole o link permanente da sua sala (ex.: https://meet.google.com/abc-defg-hij). Cada
            consulta usará este link ou um link exclusivo gerado automaticamente.
          </Text>
          <TextInput
            style={styles.meetInput}
            value={meetLinkPadrao}
            onChangeText={setMeetLinkPadrao}
            placeholder="https://meet.google.com/..."
            placeholderTextColor={patientTheme.colors.textMuted}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.meetInput, styles.bioInput]}
            value={bioResumo}
            onChangeText={setBioResumo}
            placeholder="Bio exibida no perfil para pacientes"
            placeholderTextColor={patientTheme.colors.textMuted}
            multiline
          />
          <BotaoAgendamento
            label="Salvar perfil de teleconsulta"
            icon="save-outline"
            onPress={handleSalvarPerfilTeleconsulta}
            loading={salvandoPerfil}
          />
        </CartaoAgendamento>

        <CampoBuscaAgendamento
          value={searchGlobal}
          onChangeText={setSearchGlobal}
          placeholder="Busca global por paciente, status ou motivo"
        />

        <View style={styles.headerActions}>
          <BotaoAgendamento
            label="Novo bloqueio"
            variant="ghost"
            icon="ban-outline"
            onPress={openCreateModal}
            style={styles.headerBtn}
          />
          <BotaoAgendamento
            label="Nova consulta"
            icon="add-circle-outline"
            onPress={() =>
              navigation.navigate('GerenciarPacientes', { usuarioLogado })
            }
            style={styles.headerBtn}
          />
        </View>

        {!nutricionistaId ? (
          <CartaoAgendamento style={styles.warningCard}>
            <Text style={styles.warningTitle}>Perfil profissional não identificado</Text>
            <Text style={styles.warningText}>
              O login precisa retornar `id_nutricionista_uuid` para gerenciar a agenda.
            </Text>
          </CartaoAgendamento>
        ) : null}

        {loading ? (
          <CartaoAgendamento style={styles.loadingCard}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Carregando painel...</Text>
          </CartaoAgendamento>
        ) : loadError ? (
          <EstadoErroCarregamento onTentarNovamente={() => load()} loading={loading} />
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="calendar-outline"
                label="Consultas hoje"
                value={String(metrics.consultasHoje)}
                helper="Agendadas para hoje"
              />
              <MetricCard
                icon="time-outline"
                label="Horários livres"
                value={String(metrics.horariosLivres)}
                helper="Slots disponíveis hoje"
              />
              <MetricCard
                icon="alert-circle-outline"
                label="Pendências"
                value={String(metrics.pendentes)}
                helper="Aguardando confirmação"
              />
              <MetricCard
                icon="cash-outline"
                label="Faturamento diário"
                value={metrics.faturamento}
                helper="Estimativa do dia"
              />
            </View>

            <View style={styles.viewTabs}>
              <ChipFiltro
                label="Semanal"
                active={agendaView === 'week'}
                onPress={() => setAgendaView('week')}
              />
              <ChipFiltro
                label="Disponibilidade"
                active={agendaView === 'availability'}
                onPress={() => setAgendaView('availability')}
              />
            </View>

            {agendaView === 'week' ? (
              <>
                <Text style={styles.sectionTitle}>Agenda da semana</Text>
                {weekDays.map((day) => {
                  const dayConsultas = filteredWeekConsultas[day.dateKey] || [];
                  return (
                    <CartaoAgendamento key={day.dateKey} style={styles.dayCard}>
                      <View style={styles.dayHeader}>
                        <View>
                          <Text style={styles.dayWeek}>{day.weekday}</Text>
                          <Text style={styles.dayDate}>
                            {day.day}
                            {day.isToday ? ' · Hoje' : ''}
                          </Text>
                        </View>
                        <Text style={styles.dayCount}>
                          {dayConsultas.length} consulta(s)
                        </Text>
                      </View>

                      {dayConsultas.length ? (
                        dayConsultas.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.consultaRow}
                            onPress={() => openDrawer(item)}
                            activeOpacity={0.85}
                          >
                            <View style={styles.consultaTimeCol}>
                              <Text style={styles.consultaTime}>
                                {formatTimeLabel(item.scheduled_at)}
                              </Text>
                            </View>
                            <View style={styles.consultaBody}>
                              <Text style={styles.consultaTitle}>
                                {formatConsultaDateTime(item.scheduled_at)}
                              </Text>
                              <BadgeStatusConsulta status={item.status} />
                              {item.motivo ? (
                                <Text style={styles.consultaMotivo}>{item.motivo}</Text>
                              ) : null}
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color={patientTheme.colors.textMuted}
                            />
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={styles.dayEmpty}>Sem consultas neste dia.</Text>
                      )}
                    </CartaoAgendamento>
                  );
                })}
              </>
            ) : (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Disponibilidade</Text>
                  <BotaoAgendamento label="Adicionar" icon="add" onPress={openCreateModal} />
                </View>

                {availability.length ? (
                  availability.map((row) => (
                    <CartaoAgendamento key={row.id} style={styles.availRow}>
                      <Text style={styles.availTitle}>
                        {buildSlotLabel({
                          weekday: row.weekday,
                          startTime: String(row.start_time).slice(0, 5),
                          endTime: String(row.end_time).slice(0, 5),
                          slotMinutes: row.slot_minutes,
                        })}
                      </Text>
                      <View style={styles.availActions}>
                        <BotaoAgendamento
                          label="Editar"
                          variant="ghost"
                          onPress={() => openEditModal(row)}
                          style={styles.availBtn}
                        />
                        <BotaoAgendamento
                          label="Excluir"
                          variant="danger"
                          onPress={() => handleDeleteAvailability(row)}
                          style={styles.availBtn}
                        />
                      </View>
                    </CartaoAgendamento>
                  ))
                ) : (
                  <CartaoAgendamento style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Nenhum horário configurado</Text>
                    <Text style={styles.emptyText}>
                      Abra sua disponibilidade para os pacientes agendarem teleconsultas.
                    </Text>
                  </CartaoAgendamento>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 28 }} />
      </LayoutNutricionista>

      <GavetaConsultaProfissional
        visible={Boolean(drawerConsulta)}
        consulta={drawerConsulta}
        paciente={drawerPaciente}
        onClose={closeDrawer}
        loading={drawerLoading}
        onIniciar={async () => {
          const link = resolveMeetLink({
            consulta: drawerConsulta,
            nutricionista: usuarioLogado,
          });
          try {
            await abrirLinkGoogleMeet(link);
            setToastSucesso('Abrindo Google Meet…');
          } catch (error) {
            setBannerFluxo(error?.message || 'Link do Google Meet indisponível.');
          }
        }}
        onProntuario={() => {
          if (!drawerConsulta?.paciente_id) return;
          closeDrawer();
          navigation.navigate('NutriProntuarioPaciente', {
            usuarioLogado,
            pacienteId: drawerConsulta.paciente_id,
            paciente: drawerPaciente,
          });
        }}
        onConfirmar={() => handleConsultaAction(drawerConsulta, 'confirmed')}
        onCancelar={() => handleConsultaAction(drawerConsulta, 'cancelled')}
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editRow ? 'Editar disponibilidade' : 'Abrir horários'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={patientTheme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              Configure recorrência semanal, pausas e bloqueios por dia da semana.
            </Text>

            <Text style={styles.modalLabel}>Dia da semana</Text>
            <View style={styles.weekdayRow}>
              {weekdayOptions.map((opt) => {
                const active = weekday === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.weekdayPill, active && styles.weekdayPillActive]}
                    onPress={() => setWeekday(opt.value)}
                  >
                    <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalRow}>
              <View style={styles.modalCol}>
                <Text style={styles.modalLabel}>Início</Text>
                <TextInput
                  style={styles.modalInput}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  placeholderTextColor={patientTheme.colors.textMuted}
                />
              </View>
              <View style={styles.modalCol}>
                <Text style={styles.modalLabel}>Fim</Text>
                <TextInput
                  style={styles.modalInput}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="12:00"
                  placeholderTextColor={patientTheme.colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>Duração do slot (min)</Text>
            <TextInput
              style={styles.modalInput}
              value={slotMinutes}
              onChangeText={setSlotMinutes}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor={patientTheme.colors.textMuted}
            />

            {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

            <BotaoAgendamento label="Salvar disponibilidade" onPress={handleSaveAvailability} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  proHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  proHeaderCopy: { flex: 1 },
  proName: {
    fontSize: 20,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  proRole: {
    marginTop: 2,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  onlinePill: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: patientTheme.colors.primaryDark,
  },
  meetCard: {
    marginBottom: 12,
    gap: 10,
  },
  meetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  meetHint: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
    fontSize: 13,
  },
  meetInput: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '600',
    color: patientTheme.colors.text,
    backgroundColor: patientTheme.colors.background,
  },
  bioInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  headerBtn: { flex: 1 },
  warningCard: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  warningTitle: { fontWeight: '900', color: patientTheme.colors.text, fontSize: 16 },
  warningText: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
  },
  loadingCard: { alignItems: 'center', gap: 10, marginTop: 12 },
  loadingText: { color: patientTheme.colors.textMuted, fontWeight: '600' },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  metricCard: {
    width: '48%',
    minWidth: 150,
    flexGrow: 1,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
  },
  metricValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  metricHelper: {
    marginTop: 4,
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  viewTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 20,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  dayCard: { marginBottom: 12 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayWeek: {
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
    textTransform: 'capitalize',
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  dayCount: {
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.primaryDark,
  },
  consultaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
  },
  consultaTimeCol: {
    minWidth: 52,
  },
  consultaTime: {
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  consultaBody: {
    flex: 1,
    gap: 4,
  },
  consultaTitle: {
    fontWeight: '800',
    color: patientTheme.colors.text,
    fontSize: 13,
  },
  consultaMotivo: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  dayEmpty: {
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  availRow: { marginBottom: 10 },
  availTitle: { fontWeight: '800', color: patientTheme.colors.text },
  availActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  availBtn: { flex: 1 },
  emptyCard: { alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: patientTheme.colors.text },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: patientTheme.colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 18,
    ...patientShadow,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: patientTheme.colors.text },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHint: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
  },
  modalLabel: { marginTop: 14, marginBottom: 6, fontWeight: '800', color: patientTheme.colors.text },
  modalInput: {
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: patientTheme.colors.backgroundSoft,
    color: patientTheme.colors.text,
  },
  modalRow: { flexDirection: 'row', gap: 10 },
  modalCol: { flex: 1 },
  formErrorText: { marginTop: 10, color: patientTheme.colors.danger, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekdayPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  weekdayPillActive: { backgroundColor: patientTheme.colors.primaryDark },
  weekdayText: { fontWeight: '900', color: patientTheme.colors.text },
  weekdayTextActive: { color: patientTheme.colors.onPrimary },
});
