import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionCard } from '../nutricionista/NutriDesktopUI';
import { ChipFiltro } from './uiAgendamento';
import {
  buildSlotLabel,
  deleteNutriAvailability,
  listNutriAvailability,
  upsertNutriAvailability,
} from '../../servicos/servicoAgendaNutri';
import {
  buildMedicoSlotLabel,
  deleteMedicoAvailability,
  listMedicoAvailability,
  upsertMedicoAvailability,
} from '../../servicos/servicoAgendaMedico';
import { inputFocusBorder, inputWebFocusReset } from '../../temas/temaFocoCampo';

const WEEKDAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
];

const SLOT_MINUTES_OPTIONS = [15, 30, 45, 60];

const AVAILABILITY_ACTIVE_FILTERS = [
  { id: 'all', label: 'Todos', icon: 'apps-outline' },
  { id: 'active', label: 'Ativos', icon: 'checkmark-circle-outline' },
  { id: 'inactive', label: 'Inativos', icon: 'close-circle-outline' },
];

function isDefaultRow(row) {
  return row?.is_default === true || String(row?.id || '').startsWith('default-');
}

function resolvePersistedId(row) {
  if (!row?.id || isDefaultRow(row)) return null;
  return row.id;
}

const EMPTY_FORM = {
  weekday: 1,
  startTime: '08:00',
  endTime: '12:00',
  slotMinutes: 30,
  active: true,
};

export default function PainelDisponibilidadeAgendaProfissional({
  variant = 'nutri',
  professionalId,
  actor,
  theme,
  origin,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [focusedField, setFocusedField] = useState('');
  const [listWeekdayFilter, setListWeekdayFilter] = useState('all');
  const [listActiveFilter, setListActiveFilter] = useState('all');

  const isMedico = variant === 'medico';
  const buildLabel = isMedico ? buildMedicoSlotLabel : buildSlotLabel;
  const listAvailability = isMedico ? listMedicoAvailability : listNutriAvailability;
  const upsertAvailability = isMedico ? upsertMedicoAvailability : upsertNutriAvailability;
  const deleteAvailability = isMedico ? deleteMedicoAvailability : deleteNutriAvailability;
  const professionalKey = isMedico ? 'medicoId' : 'nutricionistaId';
  const writeOrigin = origin || (isMedico ? 'agenda_medico' : 'agenda_nutricionista');
  const styles = useMemo(() => createStyles(theme), [theme]);

  const loadRows = useCallback(async () => {
    if (!professionalId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const items = await listAvailability(professionalId);
      setRows(items || []);
    } catch (loadError) {
      console.log('Erro ao carregar disponibilidade:', loadError);
      setError('Não foi possível carregar a disponibilidade da agenda.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listAvailability, professionalId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const activeRows = useMemo(
    () => (rows || []).filter((row) => row.active !== false),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return (rows || []).filter((row) => {
      if (listWeekdayFilter !== 'all' && Number(row.weekday) !== Number(listWeekdayFilter)) {
        return false;
      }
      if (listActiveFilter === 'active' && row.active === false) return false;
      if (listActiveFilter === 'inactive' && row.active !== false) return false;
      return true;
    });
  }, [rows, listWeekdayFilter, listActiveFilter]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback('');
  }

  function handleEditRow(row) {
    setEditingId(resolvePersistedId(row));
    setForm({
      weekday: row.weekday,
      startTime: String(row.start_time || '').slice(0, 5),
      endTime: String(row.end_time || '').slice(0, 5),
      slotMinutes: Number(row.slot_minutes) || 30,
      active: row.active !== false,
    });
    setFeedback('');
  }

  async function handleSaveRow() {
    if (!professionalId) return;

    try {
      setSaving(true);
      setError('');
      setFeedback('');

      const payload = {
        ...(editingId ? { id: editingId } : null),
        [professionalKey]: professionalId,
        weekday: form.weekday,
        startTime: form.startTime,
        endTime: form.endTime,
        slotMinutes: form.slotMinutes,
        active: form.active,
        actor,
        origin: writeOrigin,
      };

      await upsertAvailability(payload);
      await loadRows();
      resetForm();
      setFeedback('Disponibilidade salva. Os pacientes já podem visualizar esses horários.');
    } catch (saveError) {
      console.log('Erro ao salvar disponibilidade:', saveError);
      setError(saveError?.message || 'Não foi possível salvar a disponibilidade.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(row) {
    if (!professionalId) return;

    try {
      setSaving(true);
      setError('');
      await upsertAvailability({
        id: resolvePersistedId(row) || undefined,
        [professionalKey]: professionalId,
        weekday: row.weekday,
        startTime: String(row.start_time || '').slice(0, 5),
        endTime: String(row.end_time || '').slice(0, 5),
        slotMinutes: Number(row.slot_minutes) || 30,
        active: row.active === false,
        actor,
        origin: writeOrigin,
      });
      await loadRows();
    } catch (toggleError) {
      console.log('Erro ao atualizar disponibilidade:', toggleError);
      setError(toggleError?.message || 'Não foi possível atualizar a disponibilidade.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRow(row) {
    const rowId = resolvePersistedId(row);
    if (!rowId) {
      setRows((current) => current.filter((item) => item !== row));
      return;
    }

    try {
      setDeletingId(rowId);
      setError('');
      await deleteAvailability({ id: rowId, actor, origin: writeOrigin });
      await loadRows();
      if (editingId === rowId) resetForm();
    } catch (deleteError) {
      console.log('Erro ao excluir disponibilidade:', deleteError);
      setError(deleteError?.message || 'Não foi possível excluir o horário.');
    } finally {
      setDeletingId('');
    }
  }

  return (
    <SectionCard style={[styles.panel, styles.flatCard]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Disponibilidade para pacientes</Text>
          <Text style={styles.subtitle}>
            Configure os dias e horários em que pacientes podem ver vagas ao solicitar acompanhamento.
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{activeRows.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={theme.colors.primaryDark} />
          <Text style={styles.emptyText}>Carregando disponibilidade...</Text>
        </View>
      ) : (
        <>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? 'Editar faixa de horário' : 'Nova faixa de horário'}
            </Text>

            <Text style={styles.fieldLabel}>Dia da semana</Text>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((day) => {
                const active = Number(form.weekday) === day.value;
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.weekdayChip, active && styles.weekdayChipActive]}
                    activeOpacity={0.9}
                    onPress={() => setForm((current) => ({ ...current, weekday: day.value }))}
                  >
                    <Text style={[styles.weekdayChipText, active && styles.weekdayChipTextActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>Inicio</Text>
                <TextInput
                  value={form.startTime}
                  onChangeText={(value) => setForm((current) => ({ ...current, startTime: value }))}
                  placeholder="08:00"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.input, focusedField === 'startTime' ? styles.inputFocused : null]}
                  onFocus={() => setFocusedField('startTime')}
                  onBlur={() => setFocusedField('')}
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>Fim</Text>
                <TextInput
                  value={form.endTime}
                  onChangeText={(value) => setForm((current) => ({ ...current, endTime: value }))}
                  placeholder="12:00"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.input, focusedField === 'endTime' ? styles.inputFocused : null]}
                  onFocus={() => setFocusedField('endTime')}
                  onBlur={() => setFocusedField('')}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Duracao do slot</Text>
            <View style={styles.slotRow}>
              {SLOT_MINUTES_OPTIONS.map((minutes) => {
                const active = Number(form.slotMinutes) === minutes;
                return (
                  <TouchableOpacity
                    key={minutes}
                    style={[styles.slotChip, active && styles.slotChipActive]}
                    activeOpacity={0.9}
                    onPress={() => setForm((current) => ({ ...current, slotMinutes: minutes }))}
                  >
                    <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                      {minutes} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.activeRow}>
              <Text style={styles.fieldLabel}>Ativo para pacientes</Text>
              <Switch
                value={form.active !== false}
                onValueChange={(value) => setForm((current) => ({ ...current, active: value }))}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.formActions}>
              {editingId ? (
                <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={resetForm}>
                  <Text style={styles.secondaryButtonText}>Cancelar edicao</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                activeOpacity={0.9}
                disabled={saving}
                onPress={handleSaveRow}
              >
                <Ionicons name="save-outline" size={15} color={theme.colors.onPrimary} />
                <Text style={styles.primaryButtonText}>
                  {saving ? 'Salvando...' : editingId ? 'Atualizar horário' : 'Adicionar horário'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

          <Text style={styles.filterSectionLabel}>Filtros — Disponibilidade</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <ChipFiltro
              label="Todos os dias"
              icon="calendar-outline"
              active={listWeekdayFilter === 'all'}
              onPress={() => setListWeekdayFilter('all')}
              style={styles.filterChip}
            />
            {WEEKDAYS.map((day) => (
              <ChipFiltro
                key={`availability-day-${day.value}`}
                label={day.label}
                active={listWeekdayFilter === day.value}
                onPress={() => setListWeekdayFilter(day.value)}
                style={styles.filterChip}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {AVAILABILITY_ACTIVE_FILTERS.map((filter) => (
              <ChipFiltro
                key={`availability-active-${filter.id}`}
                label={filter.label}
                icon={filter.icon}
                active={listActiveFilter === filter.id}
                onPress={() => setListActiveFilter(filter.id)}
                style={styles.filterChip}
              />
            ))}
          </ScrollView>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Horarios publicados</Text>
            <Text style={styles.listMeta}>
              {filteredRows.length} de {rows.length}{' '}
              {rows.length === 1 ? 'faixa' : 'faixas'}
            </Text>
          </View>

          {filteredRows.length ? (
            <View style={styles.list}>
              {filteredRows.map((row, index) => {
                const rowKey = row.id || `${row.weekday}-${row.start_time}-${index}`;
                const label = buildLabel({
                  weekday: row.weekday,
                  startTime: String(row.start_time || '').slice(0, 5),
                  endTime: String(row.end_time || '').slice(0, 5),
                  slotMinutes: Number(row.slot_minutes) || 30,
                });
                const deleting = deletingId === resolvePersistedId(row);

                return (
                  <View key={rowKey} style={styles.rowCard}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{label}</Text>
                      <Text style={styles.rowMeta}>
                        {row.active === false ? 'Inativo para pacientes' : 'Visivel para pacientes'}
                        {isDefaultRow(row) ? ' · sugestao inicial (salve para publicar)' : ''}
                      </Text>
                    </View>

                    <View style={styles.rowActions}>
                      <Switch
                        value={row.active !== false}
                        disabled={saving}
                        onValueChange={() => handleToggleActive(row)}
                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        thumbColor="#ffffff"
                      />
                      <TouchableOpacity
                        style={styles.iconButton}
                        activeOpacity={0.9}
                        onPress={() => handleEditRow(row)}
                      >
                        <Ionicons name="create-outline" size={16} color={theme.colors.primaryDark} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        activeOpacity={0.9}
                        disabled={deleting}
                        onPress={() => handleDeleteRow(row)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={deleting ? theme.colors.textMuted : theme.colors.danger || '#DC2626'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : rows.length ? (
            <View style={styles.emptyState}>
              <Ionicons name="funnel-outline" size={42} color={theme.colors.border} />
              <Text style={styles.emptyText}>Nenhum horário corresponde aos filtros.</Text>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.9}
                onPress={() => {
                  setListWeekdayFilter('all');
                  setListActiveFilter('all');
                }}
              >
                <Text style={styles.secondaryButtonText}>Limpar filtros</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyText}>
                Nenhum horário cadastrado. Adicione a primeira faixa acima.
              </Text>
            </View>
          )}
        </>
      )}
    </SectionCard>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  panel: {
    gap: 16,
  },
  flatCard: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius?.xl || 16,
    shadowColor: 'transparent',
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft || '#E8F8F1',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primaryDark,
  },
  formCard: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface || '#FAFBFC',
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  weekdayChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft || '#E8F8F1',
  },
  weekdayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  weekdayChipTextActive: {
    color: theme.colors.primaryDark,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    ...inputWebFocusReset,
  },
  inputFocused: {
    ...inputFocusBorder,
    backgroundColor: theme.colors.background,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  slotChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft || '#E8F8F1',
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  slotChipTextActive: {
    color: theme.colors.primaryDark,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 48,
    borderRadius: theme.radius?.lg ?? 16,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder || theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  filterSectionLabel: {
    color: theme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: {
    gap: 6,
    paddingBottom: 2,
  },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 10,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  listMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  list: {
    gap: 10,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  rowMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.danger || '#DC2626',
  },
  feedbackText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.primaryDark,
  },
  });
}
