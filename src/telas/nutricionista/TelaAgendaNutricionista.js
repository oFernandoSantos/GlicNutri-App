import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import { listNutriAvailability, upsertNutriAvailability, deleteNutriAvailability, buildSlotLabel } from '../../servicos/servicoAgendaNutri';
import { listConsultasByNutricionista, updateConsultaStatus, formatConsultaDateTime } from '../../servicos/servicoConsultas';

function SectionCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function getNutriId(usuarioLogado) {
  return (
    usuarioLogado?.id_nutricionista_uuid ||
    usuarioLogado?.user_metadata?.id_nutricionista_uuid ||
    usuarioLogado?.id ||
    null
  );
}

const weekdayOptions = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
];

export default function TelaAgendaNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const nutricionistaId = useMemo(() => getNutriId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [slotMinutes, setSlotMinutes] = useState('30');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [avail, cons] = await Promise.all([
        listNutriAvailability(nutricionistaId),
        listConsultasByNutricionista(nutricionistaId, { limit: 120 }),
      ]);
      setAvailability(avail || []);
      setConsultas(cons || []);
    } catch (error) {
      console.log('Erro ao carregar agenda nutri:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar sua agenda.');
    } finally {
      setLoading(false);
    }
  }, [nutricionistaId]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', () => load());
    return unsubscribe;
  }, [navigation, load]);

  const upcomingConsultas = useMemo(() => {
    const now = Date.now();
    return (consultas || [])
      .slice()
      .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
      .filter((item) => {
        const dt = new Date(item.scheduled_at || 0);
        return !Number.isNaN(dt.getTime()) && dt.getTime() >= now && item.status !== 'cancelled';
      })
      .slice(0, 30);
  }, [consultas]);

  function openCreateModal() {
    setEditRow(null);
    setWeekday(1);
    setStartTime('08:00');
    setEndTime('12:00');
    setSlotMinutes('30');
    setFormError('');
    setFormSuccess('');
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
      setFormSuccess('');
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
      await load();
      setFormSuccess(`Disponibilidade salva: ${buildSlotLabel(saved)}`);
    } catch (error) {
      console.log('Erro salvar disponibilidade:', error);
      setFormError(error?.message || 'Nao foi possivel salvar a disponibilidade.');
    }
  }

  async function handleDeleteAvailability(row) {
    Alert.alert('Excluir', 'Deseja excluir esta disponibilidade?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNutriAvailability({ id: row.id, actor: usuarioLogado });
            await load();
          } catch (error) {
            Alert.alert('Erro', 'Nao foi possivel excluir.');
          }
        },
      },
    ]);
  }

  async function handleConsultaAction(item, nextStatus) {
    try {
      await updateConsultaStatus({
        consultaId: item.id,
        status: nextStatus,
        actor: usuarioLogado,
      });
      await load();
    } catch (error) {
      console.log('Erro atualizar consulta:', error);
      Alert.alert('Erro', error?.message || 'Nao foi possivel atualizar a consulta.');
    }
  }

  return (
    <>
      <LayoutNutricionista
        navigation={navigation}
        route={route}
        usuarioLogado={usuarioLogado}
        title="Agenda"
        subtitle="Configure seus slots e acompanhe agendamentos."
        rightAction={
          <TouchableOpacity style={styles.iconButton} onPress={load} disabled={loading}>
            <Ionicons name="refresh-outline" size={20} color={patientTheme.colors.text} />
          </TouchableOpacity>
        }
        showTabBar={route?.name === 'NutricionistaAgenda'}
      >

        {!nutricionistaId ? (
          <SectionCard style={styles.warningCard}>
            <Text style={styles.warningTitle}>Seu perfil de nutricionista não foi identificado</Text>
            <Text style={styles.warningText}>
              Para salvar disponibilidade, o login precisa retornar `id_nutricionista_uuid` e a
              migration do Supabase precisa estar aplicada (tabela `nutri_disponibilidade`).
            </Text>
          </SectionCard>
        ) : null}

        {loading ? (
          <SectionCard style={styles.loadingCard}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Carregando agenda...</Text>
          </SectionCard>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Disponibilidade (slots)</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openCreateModal}>
            <Ionicons name="add" size={18} color={patientTheme.colors.onPrimary} />
            <Text style={styles.primaryButtonText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {availability.length ? (
          availability.map((row) => (
            <SectionCard key={row.id} style={styles.availRow}>
              <View style={styles.availRowTop}>
                <Text style={styles.availTitle}>
                  {buildSlotLabel({
                    weekday: row.weekday,
                    startTime: String(row.start_time).slice(0, 5),
                    endTime: String(row.end_time).slice(0, 5),
                    slotMinutes: row.slot_minutes,
                  })}
                </Text>
              </View>
              <View style={styles.availActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => openEditModal(row)}
                >
                  <Ionicons name="create-outline" size={18} color={patientTheme.colors.text} />
                  <Text style={styles.secondaryButtonText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={() => handleDeleteAvailability(row)}
                >
                  <Ionicons name="trash-outline" size={18} color={patientTheme.colors.onPrimary} />
                  <Text style={styles.dangerButtonText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>
          ))
        ) : (
          <SectionCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum slot configurado</Text>
            <Text style={styles.emptyText}>
              Adicione sua disponibilidade para o paciente conseguir agendar.
            </Text>
          </SectionCard>
        )}

        <Text style={styles.sectionTitle}>Próximas consultas</Text>
        {upcomingConsultas.length ? (
          upcomingConsultas.map((item) => (
            <SectionCard key={item.id} style={styles.consultaCard}>
              <Text style={styles.consultaTitle}>{formatConsultaDateTime(item.scheduled_at)}</Text>
              <Text style={styles.consultaMeta}>
                Status: <Text style={styles.consultaMetaStrong}>{String(item.status || '')}</Text>
              </Text>
              {item.motivo ? (
                <Text style={styles.consultaHelper}>Motivo: {item.motivo}</Text>
              ) : null}

              <View style={styles.consultaActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    navigation.navigate('NutriConsultaNutri', {
                      usuarioLogado,
                      consultaId: item.id,
                      pacienteId: item.paciente_id,
                      scheduledAt: item.scheduled_at,
                    })
                  }
                >
                  <Ionicons name="document-text-outline" size={18} color={patientTheme.colors.text} />
                  <Text style={styles.secondaryButtonText}>Prontuário</Text>
                </TouchableOpacity>
                {item.status !== 'confirmed' ? (
                  <TouchableOpacity
                    style={styles.primaryButtonSmall}
                    onPress={() => handleConsultaAction(item, 'confirmed')}
                  >
                    <Text style={styles.primaryButtonSmallText}>Confirmar</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.dangerButtonSmall}
                  onPress={() => handleConsultaAction(item, 'cancelled')}
                >
                  <Text style={styles.dangerButtonSmallText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>
          ))
        ) : (
          <SectionCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sem consultas futuras</Text>
            <Text style={styles.emptyText}>Assim que pacientes agendarem, aparecem aqui.</Text>
          </SectionCard>
        )}

        <View style={{ height: 26 }} />
      </LayoutNutricionista>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editRow ? 'Editar slot' : 'Novo slot'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={patientTheme.colors.text} />
              </TouchableOpacity>
            </View>

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
                <Text style={styles.modalLabel}>Início (HH:MM)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  placeholderTextColor={patientTheme.colors.textMuted}
                />
              </View>
              <View style={styles.modalCol}>
                <Text style={styles.modalLabel}>Fim (HH:MM)</Text>
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
              placeholder="30"
              placeholderTextColor={patientTheme.colors.textMuted}
              keyboardType="numeric"
            />

            {formError ? (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleSaveAvailability}>
              <Text style={styles.modalPrimaryText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  loadingCard: { marginTop: 16, alignItems: 'center', gap: 10 },
  loadingText: { color: patientTheme.colors.textMuted, fontWeight: '600' },
  warningCard: { marginTop: 16, borderWidth: 1, borderColor: '#f0d2d2', backgroundColor: '#fff4f4' },
  warningTitle: { color: patientTheme.colors.text, fontWeight: '900', fontSize: 16 },
  warningText: { marginTop: 8, color: patientTheme.colors.textMuted, lineHeight: 20, fontWeight: '600' },
  sectionHeaderRow: { marginTop: 22, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { marginTop: 22, marginBottom: 12, fontSize: 20, fontWeight: '800', color: patientTheme.colors.text },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  primaryButtonText: { color: patientTheme.colors.onPrimary, fontWeight: '800' },
  availRow: { marginBottom: 12 },
  availRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  availTitle: { color: patientTheme.colors.text, fontWeight: '800' },
  availActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: { fontWeight: '800', color: patientTheme.colors.text },
  dangerButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#d96666',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dangerButtonText: { fontWeight: '800', color: patientTheme.colors.onPrimary },
  emptyCard: { marginTop: 6, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: patientTheme.colors.text },
  emptyText: { marginTop: 8, textAlign: 'center', color: patientTheme.colors.textMuted, lineHeight: 20 },
  consultaCard: { marginBottom: 12 },
  consultaTitle: { fontWeight: '900', color: patientTheme.colors.text },
  consultaMeta: { marginTop: 8, color: patientTheme.colors.textMuted },
  consultaMetaStrong: { color: patientTheme.colors.text, fontWeight: '800' },
  consultaHelper: { marginTop: 8, color: patientTheme.colors.textMuted, lineHeight: 20 },
  consultaActions: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
  primaryButtonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  primaryButtonSmallText: { color: patientTheme.colors.onPrimary, fontWeight: '800' },
  dangerButtonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#fff4f4',
    borderWidth: 1,
    borderColor: '#f0d2d2',
  },
  dangerButtonSmallText: { color: '#d96666', fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: patientTheme.colors.surface, borderRadius: patientTheme.radius.xl, padding: 18, ...patientShadow },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: patientTheme.colors.text },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: patientTheme.colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  modalLabel: { marginTop: 14, marginBottom: 6, color: patientTheme.colors.text, fontWeight: '800' },
  modalInput: {
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: patientTheme.colors.backgroundSoft,
    color: patientTheme.colors.text,
  },
  modalRow: { flexDirection: 'row', gap: 10 },
  modalCol: { flex: 1 },
  modalPrimaryButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: { color: patientTheme.colors.onPrimary, fontWeight: '900' },
  formErrorBox: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#e57373',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formErrorText: {
    color: '#b23a48',
    fontWeight: '700',
    lineHeight: 19,
  },
  weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekdayPill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: patientTheme.radius.pill, backgroundColor: patientTheme.colors.backgroundSoft },
  weekdayPillActive: { backgroundColor: patientTheme.colors.primaryDark },
  weekdayText: { fontWeight: '900', color: patientTheme.colors.text },
  weekdayTextActive: { color: patientTheme.colors.onPrimary },
});

