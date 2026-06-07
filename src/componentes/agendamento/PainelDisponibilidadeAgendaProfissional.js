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
import {
  formatDateKeyToBr,
  parseDateBrToKey,
} from './FiltrosAgendamentoAvancado';

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

const DATE_MODE = {
  single: 'single',
  range: 'range',
};

const EMPTY_FORM = {
  dateMode: DATE_MODE.single,
  dateInput: '',
  startTime: '08:00',
  endTime: '12:00',
  slotMinutes: 30,
  active: true,
};

function formatBrDateFromDigits(digits) {
  const clean = String(digits || '').replace(/\D/g, '').slice(0, 8);
  if (clean.length <= 2) return clean;
  if (clean.length <= 4) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4)}`;
}

function extractFirstBrDate(value) {
  const match = String(value || '').trim().match(/^(\d{2}\/\d{2}\/\d{4})/);
  return match ? match[1] : '';
}

function maskAvailabilityDateInput(value, mode = DATE_MODE.single) {
  if (mode === DATE_MODE.range) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 16);
    const first = formatBrDateFromDigits(digits.slice(0, 8));
    const secondDigits = digits.slice(8);
    if (!secondDigits.length) return first;
    const second = formatBrDateFromDigits(secondDigits);
    return `${first} - ${second}`;
  }

  return formatBrDateFromDigits(value);
}

function expandDateRangeKeys(fromKey, toKey) {
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number);
  const [toYear, toMonth, toDay] = toKey.split('-').map(Number);
  const cursor = new Date(fromYear, fromMonth - 1, fromDay);
  const end = new Date(toYear, toMonth - 1, toDay);
  const dates = [];

  while (cursor.getTime() <= end.getTime()) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function parseAvailabilityDatesInput(value, mode = DATE_MODE.single) {
  const raw = String(value || '').trim();
  if (!raw) {
    return {
      error:
        mode === DATE_MODE.range
          ? 'Informe o intervalo no formato dd/mm/aaaa - dd/mm/aaaa.'
          : 'Informe a data no formato dd/mm/aaaa.',
    };
  }

  if (mode === DATE_MODE.range) {
    const rangeMatch = raw.match(/^(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})$/);
    if (!rangeMatch) {
      return { error: 'Intervalo invalido. Use dd/mm/aaaa - dd/mm/aaaa.' };
    }
    const fromKey = parseDateBrToKey(rangeMatch[1]);
    const toKey = parseDateBrToKey(rangeMatch[2]);
    if (!fromKey || !toKey) {
      return { error: 'Intervalo de datas invalido. Use dd/mm/aaaa - dd/mm/aaaa.' };
    }
    if (fromKey > toKey) {
      return { error: 'A data inicial deve ser anterior ou igual a data final.' };
    }
    const dates = expandDateRangeKeys(fromKey, toKey);
    if (dates.length > 120) {
      return { error: 'O intervalo pode ter no maximo 120 dias.' };
    }
    return { dates };
  }

  const singleKey = parseDateBrToKey(raw);
  if (!singleKey) {
    return { error: 'Data invalida. Use dd/mm/aaaa.' };
  }

  return { dates: [singleKey] };
}

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
      if (listActiveFilter === 'active' && row.active === false) return false;
      if (listActiveFilter === 'inactive' && row.active !== false) return false;
      return true;
    });
  }, [rows, listActiveFilter]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback('');
  }

  function handleEditRow(row) {
    setEditingId(resolvePersistedId(row));
    const availabilityDate = row.availability_date
      ? String(row.availability_date).slice(0, 10)
      : '';
    setForm({
      dateMode: DATE_MODE.single,
      dateInput: availabilityDate ? formatDateKeyToBr(availabilityDate) : '',
      startTime: String(row.start_time || '').slice(0, 5),
      endTime: String(row.end_time || '').slice(0, 5),
      slotMinutes: Number(row.slot_minutes) || 30,
      active: row.active !== false,
    });
    setFeedback('');
  }

  async function handleSaveRow() {
    if (!professionalId) return;

    const dateMode = editingId ? DATE_MODE.single : form.dateMode;
    const parsedDates = parseAvailabilityDatesInput(form.dateInput, dateMode);
    if (parsedDates.error) {
      setError(parsedDates.error);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setFeedback('');

      for (const availabilityDate of parsedDates.dates) {
        await upsertAvailability({
          ...(editingId ? { id: editingId } : null),
          [professionalKey]: professionalId,
          availabilityDate,
          startTime: form.startTime,
          endTime: form.endTime,
          slotMinutes: form.slotMinutes,
          active: form.active,
          actor,
          origin: writeOrigin,
        });
      }

      await loadRows();
      resetForm();
      const count = parsedDates.dates.length;
      setFeedback(
        count > 1
          ? `${count} dias publicados. Os pacientes ja podem visualizar esses horarios.`
          : 'Disponibilidade salva. Os pacientes ja podem visualizar esse horario.'
      );
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
        availabilityDate: row.availability_date
          ? String(row.availability_date).slice(0, 10)
          : null,
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
            Configure as datas e horarios em que pacientes podem ver vagas ao solicitar acompanhamento.
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

            <Text style={styles.fieldLabel}>Data</Text>
            {!editingId ? (
              <View style={styles.dateModeRow}>
                <TouchableOpacity
                  style={[
                    styles.dateModeChip,
                    form.dateMode === DATE_MODE.single && styles.dateModeChipActive,
                  ]}
                  activeOpacity={0.9}
                  onPress={() =>
                    setForm((current) => {
                      const firstDate = extractFirstBrDate(current.dateInput);
                      return {
                        ...current,
                        dateMode: DATE_MODE.single,
                        dateInput: firstDate || maskAvailabilityDateInput(current.dateInput, DATE_MODE.single),
                      };
                    })
                  }
                >
                  <Text
                    style={[
                      styles.dateModeChipText,
                      form.dateMode === DATE_MODE.single && styles.dateModeChipTextActive,
                    ]}
                  >
                    Por dia
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dateModeChip,
                    form.dateMode === DATE_MODE.range && styles.dateModeChipActive,
                  ]}
                  activeOpacity={0.9}
                  onPress={() =>
                    setForm((current) => ({
                      ...current,
                      dateMode: DATE_MODE.range,
                      dateInput: maskAvailabilityDateInput(current.dateInput, DATE_MODE.range),
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.dateModeChipText,
                      form.dateMode === DATE_MODE.range && styles.dateModeChipTextActive,
                    ]}
                  >
                    Em massa
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <TextInput
              value={form.dateInput}
              onChangeText={(value) =>
                setForm((current) => ({
                  ...current,
                  dateInput: maskAvailabilityDateInput(
                    value,
                    editingId ? DATE_MODE.single : current.dateMode
                  ),
                }))
              }
              placeholder={
                editingId || form.dateMode === DATE_MODE.single
                  ? 'dd/mm/aaaa'
                  : 'dd/mm/aaaa - dd/mm/aaaa'
              }
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              maxLength={editingId || form.dateMode === DATE_MODE.single ? 10 : 23}
              style={[styles.input, focusedField === 'dateInput' ? styles.inputFocused : null]}
              onFocus={() => setFocusedField('dateInput')}
              onBlur={() => setFocusedField('')}
            />
            <Text style={styles.fieldHint}>
              {editingId || form.dateMode === DATE_MODE.single
                ? 'Um dia no formato dd/mm/aaaa.'
                : 'Intervalo em massa: dd/mm/aaaa - dd/mm/aaaa (ate 120 dias).'}
            </Text>

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
                  availabilityDate: row.availability_date
                    ? String(row.availability_date).slice(0, 10)
                    : null,
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
                onPress={() => setListActiveFilter('all')}
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius?.xl || 16,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
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
    borderRadius: theme.radius?.card ?? theme.radius?.lg ?? 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
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
  fieldHint: {
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  dateModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateModeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  dateModeChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  dateModeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  dateModeChipTextActive: {
    color: theme.colors.onPrimary,
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
    borderRadius: theme.radius?.lg ?? 16,
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
    backgroundColor: theme.colors.primary,
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  slotChipTextActive: {
    color: theme.colors.onPrimary,
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
    borderRadius: theme.radius?.pill ?? 999,
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
    minHeight: 48,
    borderRadius: theme.radius?.pill ?? 999,
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
