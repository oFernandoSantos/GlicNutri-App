import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ModalHorariosDiaPaciente from './ModalHorariosDiaPaciente';
import { mostrarToastPaciente } from '../../servicos/servicoToastPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  formatDayLabel,
  formatTimeLabel,
  isTodayKey,
} from '../../utilitarios/slotsTeleconsulta';
import { CAL_GREEN, CAL_OCCUPIED } from './coresCalendarioAgenda';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const OUTLINE = '#E4E8EC';

function dateFromKey(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPastDateKey(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function toDateKey(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function monthStart(year, monthIndex) {
  return new Date(year, monthIndex, 1);
}

function compareMonths(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function buildMonthCells(year, monthIndex) {
  const first = monthStart(year, monthIndex);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ inMonth: false, key: `pad-start-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      inMonth: true,
      day,
      dateKey: toDateKey(year, monthIndex, day),
      key: toDateKey(year, monthIndex, day),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ inMonth: false, key: `pad-end-${cells.length}` });
  }

  return cells;
}

export default function CalendarioHorarios({
  days = [],
  selectedDayKey,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
  variant = 'default',
  slotsInModal = false,
}) {
  const compact = variant === 'compact';
  const ui = compact ? compactStyles : defaultStyles;
  const fade = useRef(new Animated.Value(0)).current;
  const [slotsModalOpen, setSlotsModalOpen] = useState(false);

  const visibleDays = useMemo(() => {
    return (days || []).map((day) => {
      const seen = new Set();
      const uniqueSlots = (day?.slots || []).filter((slot) => {
        const key = String(slot?.scheduledAt || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        ...day,
        slots: uniqueSlots,
      };
    });
  }, [days]);

  const dayByKey = useMemo(() => {
    const map = new Map();
    visibleDays.forEach((day) => {
      const hasAvailable = (day.slots || []).some((slot) => slot.status === 'available');
      const hasOccupied = (day.slots || []).some((slot) => slot.status === 'occupied');
      map.set(day.dateKey, { ...day, hasAvailable, hasOccupied });
    });
    return map;
  }, [visibleDays]);

  const monthBounds = useMemo(() => {
    const keys = visibleDays.map((day) => day.dateKey).sort();
    if (!keys.length) return null;
    const minDate = dateFromKey(keys[0]);
    const maxDate = dateFromKey(keys[keys.length - 1]);
    if (!minDate || !maxDate) return null;
    return {
      min: { year: minDate.getFullYear(), month: minDate.getMonth() },
      max: { year: maxDate.getFullYear(), month: maxDate.getMonth() },
    };
  }, [visibleDays]);

  const initialViewMonth = useMemo(() => {
    const selected = dateFromKey(selectedDayKey);
    if (selected) {
      return { year: selected.getFullYear(), month: selected.getMonth() };
    }
    const firstAvailable = visibleDays.find((day) =>
      (day.slots || []).some((slot) => slot.status === 'available')
    );
    const anchor = dateFromKey(firstAvailable?.dateKey) || new Date();
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  }, [selectedDayKey, visibleDays]);

  const [viewMonth, setViewMonth] = useState(initialViewMonth);

  useEffect(() => {
    setViewMonth(initialViewMonth);
  }, [initialViewMonth.year, initialViewMonth.month]);

  useEffect(() => {
    if (!selectedDayKey) return;
    const selected = dateFromKey(selectedDayKey);
    if (!selected) return;
    setViewMonth({ year: selected.getFullYear(), month: selected.getMonth() });
  }, [selectedDayKey]);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [visibleDays, viewMonth.year, viewMonth.month, fade]);

  const monthLabel = useMemo(() => {
    const label = monthStart(viewMonth.year, viewMonth.month).toLocaleDateString('pt-BR', {
      month: compact ? 'short' : 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [compact, viewMonth.month, viewMonth.year]);

  const monthCells = useMemo(
    () => buildMonthCells(viewMonth.year, viewMonth.month),
    [viewMonth.month, viewMonth.year]
  );

  const canGoPrev = useMemo(() => {
    if (!monthBounds) return false;
    return compareMonths(viewMonth, monthBounds.min) > 0;
  }, [monthBounds, viewMonth]);

  const canGoNext = useMemo(() => {
    if (!monthBounds) return false;
    return compareMonths(viewMonth, monthBounds.max) < 0;
  }, [monthBounds, viewMonth]);

  const selectedDay = useMemo(
    () => (selectedDayKey ? dayByKey.get(selectedDayKey) || null : null),
    [dayByKey, selectedDayKey]
  );

  useEffect(() => {
    if (!selectedDayKey) setSlotsModalOpen(false);
  }, [selectedDayKey]);

  const handleSelectDay = (dateKey) => {
    const info = dayByKey.get(dateKey);
    const isNewDay = dateKey !== selectedDayKey;

    if (isPastDateKey(dateKey)) {
      mostrarToastPaciente({
        tipo: 'aviso',
        texto: 'Data passada',
        subtexto: 'Escolha um dia a partir de hoje.',
      });
      return;
    }

    if (!info?.hasAvailable) {
      if (info?.hasOccupied) {
        mostrarToastPaciente({
          tipo: 'aviso',
          texto: 'Dia sem horários livres',
          subtexto: 'Todos os horários deste dia já estão ocupados.',
        });
      } else if (isTodayKey(dateKey)) {
        mostrarToastPaciente({
          tipo: 'aviso',
          texto: 'Sem horários hoje',
          subtexto: 'O profissional não liberou vagas para esta data.',
        });
      }
      return;
    }

    onSelectDay?.(dateKey);
    if (isNewDay) onSelectSlot?.(null);
    if (slotsInModal) setSlotsModalOpen(true);
  };

  const handleSelectSlot = (slot) => {
    onSelectSlot?.(slot);
    if (slotsInModal) setSlotsModalOpen(false);
  };

  const handleCloseSlotsModal = () => {
    setSlotsModalOpen(false);
  };

  const goPrevMonth = () => {
    if (!canGoPrev) return;
    setViewMonth((current) => {
      const date = new Date(current.year, current.month - 1, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const goNextMonth = () => {
    if (!canGoNext) return;
    setViewMonth((current) => {
      const date = new Date(current.year, current.month + 1, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  if (!visibleDays.length) {
    return (
      <View style={ui.empty}>
        <Text style={ui.emptyText}>Nenhum horário disponível no período.</Text>
      </View>
    );
  }

  return (
    <Animated.View style={{ opacity: fade }}>
      <View style={ui.calendarCard}>
        <View style={ui.monthHeader}>
          <TouchableOpacity
            style={[ui.monthNavBtn, !canGoPrev && ui.monthNavBtnDisabled]}
            onPress={goPrevMonth}
            disabled={!canGoPrev}
            activeOpacity={0.8}
            accessibilityLabel="Mês anterior"
          >
            <Ionicons
              name="chevron-back"
              size={compact ? 16 : 20}
              color={canGoPrev ? patientTheme.colors.text : patientTheme.colors.textMuted}
            />
          </TouchableOpacity>
          <Text style={ui.monthTitle}>{monthLabel}</Text>
          <TouchableOpacity
            style={[ui.monthNavBtn, !canGoNext && ui.monthNavBtnDisabled]}
            onPress={goNextMonth}
            disabled={!canGoNext}
            activeOpacity={0.8}
            accessibilityLabel="Próximo mês"
          >
            <Ionicons
              name="chevron-forward"
              size={compact ? 16 : 20}
              color={canGoNext ? patientTheme.colors.text : patientTheme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <View style={ui.weekdayRow}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={ui.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={[ui.daysGrid, compact && ui.daysGridOutlined]}>
          {monthCells.map((cell) => {
            if (!cell.inMonth) {
              return (
                <View
                  key={cell.key}
                  style={[ui.dayCellEmpty, compact && ui.dayCellEmptyOutlined]}
                />
              );
            }

            const info = dayByKey.get(cell.dateKey);
            const hasAvailable = info?.hasAvailable;
            const hasOccupiedOnly = info?.hasOccupied && !hasAvailable;
            const isSelected = cell.dateKey === selectedDayKey;
            const isToday = isTodayKey(cell.dateKey);
            const isPast = isPastDateKey(cell.dateKey);
            const pressable =
              !isPast && (hasAvailable || hasOccupiedOnly || (isToday && !info));
            const cellHighlighted =
              isSelected ||
              hasOccupiedOnly ||
              (hasAvailable && !isPast);

            const DayCell = compact ? Pressable : TouchableOpacity;

            const occupiedDayCompact = compact && hasOccupiedOnly && !isSelected;

            return (
              <DayCell
                key={cell.key}
                style={[
                  ui.dayCell,
                  !occupiedDayCompact && compact && !cellHighlighted && ui.dayCellOutlined,
                  hasAvailable && !isPast && !occupiedDayCompact && ui.dayCellAvailable,
                  compact &&
                    hasAvailable &&
                    !isPast &&
                    !occupiedDayCompact &&
                    ui.dayCellAvailableCompact,
                  hasOccupiedOnly && !compact && ui.dayCellOccupiedOnly,
                  occupiedDayCompact && ui.dayCellOccupiedOnlyCompactFull,
                  isSelected && ui.dayCellSelected,
                  compact && isSelected && ui.dayCellSelectedCompact,
                  isToday &&
                    !isSelected &&
                    !hasAvailable &&
                    !hasOccupiedOnly &&
                    ui.dayCellToday,
                  isPast && ui.dayCellPast,
                ]}
                disabled={!pressable}
                onPress={() => handleSelectDay(cell.dateKey)}
                {...(compact ? {} : { activeOpacity: 0.85 })}
              >
                <Text
                  style={[
                    ui.dayNumber,
                    hasAvailable && !isSelected && ui.dayNumberAvailable,
                    hasOccupiedOnly && ui.dayNumberOccupied,
                    isSelected && ui.dayNumberSelected,
                    isToday &&
                      !isSelected &&
                      !hasAvailable &&
                      !hasOccupiedOnly &&
                      ui.dayNumberToday,
                  ]}
                >
                  {cell.day}
                </Text>
                {!compact && hasAvailable ? (
                  <View style={[ui.dayDot, isSelected && ui.dayDotSelected]} />
                ) : null}
              </DayCell>
            );
          })}
        </View>
      </View>

      <View style={ui.legendRow}>
        <View style={ui.legendItem}>
          <View style={[ui.legendDot, ui.legendAvailable]} />
          <Text style={ui.legendText}>Disponível</Text>
        </View>
        <View style={ui.legendItem}>
          <View style={[ui.legendDot, ui.legendSelected]} />
          <Text style={ui.legendText}>Selecionado</Text>
        </View>
        <View style={ui.legendItem}>
          <View style={[ui.legendDot, ui.legendOccupied]} />
          <Text style={ui.legendText}>Ocupado</Text>
        </View>
      </View>

      {!selectedDayKey ? (
        <Text style={ui.hintText}>
          {slotsInModal
            ? 'Toque em um dia disponível para escolher o horário.'
            : compact
              ? 'Selecione um dia disponível.'
              : 'Toque em um dia destacado no calendário para ver os horários.'}
        </Text>
      ) : null}

      {slotsInModal && selectedSlot?.scheduledAt ? (
        <TouchableOpacity
          style={ui.selectedSlotSummary}
          onPress={() => selectedDay?.hasAvailable && setSlotsModalOpen(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="time-outline" size={16} color={patientTheme.colors.primaryDark} />
          <Text style={ui.selectedSlotSummaryText}>
            {formatTimeLabel(selectedSlot.scheduledAt)}
            {selectedDayKey ? ` · ${formatDayLabel(selectedDayKey)}` : ''}
          </Text>
          <Text style={ui.selectedSlotSummaryAction}>Alterar</Text>
        </TouchableOpacity>
      ) : null}

      {!slotsInModal && selectedDay?.hasAvailable ? (
        <View style={[ui.slotsSection, compact && ui.slotsSectionCard]}>
          <Text style={ui.slotsSectionTitle}>
            {compact ? formatDayLabel(selectedDay.dateKey) : `Horários em ${formatDayLabel(selectedDay.dateKey)}`}
            {isTodayKey(selectedDay.dateKey) ? ' · Hoje' : ''}
          </Text>
          <View style={[ui.slotsGrid, compact && ui.slotsGridModern]}>
            {(selectedDay.slots || []).map((slot) => {
              const selected = selectedSlot?.scheduledAt === slot.scheduledAt;
              const occupied = slot.status === 'occupied';
              const unavailable = slot.status === 'unavailable';

              return (
                <TouchableOpacity
                  key={slot.scheduledAt}
                  style={[
                    ui.slot,
                    compact && ui.slotModern,
                    selected && ui.slotSelected,
                    compact && selected && ui.slotModernSelected,
                    occupied && ui.slotOccupied,
                    compact && occupied && ui.slotModernOccupied,
                    unavailable && ui.slotUnavailable,
                  ]}
                  disabled={occupied || unavailable}
                  onPress={() => onSelectSlot?.(slot)}
                  activeOpacity={0.82}
                >
                  <Text
                    style={[
                      ui.slotText,
                      compact && ui.slotTextModern,
                      selected && ui.slotTextSelected,
                      (occupied || unavailable) && ui.slotTextMuted,
                      compact && (occupied || unavailable) && ui.slotTextModernMuted,
                    ]}
                  >
                    {formatTimeLabel(slot.scheduledAt)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {!slotsInModal && selectedDayKey && !selectedDay?.hasAvailable ? (
        <Text style={ui.hintText}>Este dia não possui horários livres.</Text>
      ) : null}

      {slotsInModal ? (
        <ModalHorariosDiaPaciente
          visible={slotsModalOpen}
          onClose={handleCloseSlotsModal}
          dateKey={selectedDayKey}
          slots={selectedDay?.slots || []}
          selectedSlot={selectedSlot}
          onSelectSlot={handleSelectSlot}
        />
      ) : null}
    </Animated.View>
  );
}

const shared = {
  dayCellAvailable: {
    backgroundColor: CAL_GREEN.availableBg,
    borderWidth: 1.5,
    borderColor: CAL_GREEN.availableBorder,
  },
  dayCellOccupiedOnly: {
    backgroundColor: CAL_OCCUPIED.bg,
    borderWidth: 1.5,
    borderColor: CAL_OCCUPIED.border,
    opacity: 1,
  },
  dayCellSelected: {
    backgroundColor: CAL_GREEN.selectedBg,
    borderWidth: 2,
    borderColor: CAL_GREEN.selectedBorder,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: CAL_GREEN.idleBorder,
    backgroundColor: patientTheme.colors.surface,
  },
  dayNumberToday: {
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  dayCellPast: {
    opacity: 0.4,
  },
  dayNumberAvailable: {
    color: CAL_GREEN.availableText,
    fontWeight: '800',
  },
  dayNumberOccupied: {
    color: CAL_OCCUPIED.text,
    fontWeight: '700',
  },
  dayNumberMuted: {
    color: patientTheme.colors.textMuted,
  },
  dayNumberSelected: {
    color: patientTheme.colors.onPrimary,
  },
  slotSelected: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  slotOccupied: {
    backgroundColor: CAL_OCCUPIED.bg,
    borderColor: CAL_OCCUPIED.border,
    borderWidth: 1.5,
    opacity: 1,
  },
  slotUnavailable: {
    opacity: 0.35,
  },
  slotTextSelected: {
    color: patientTheme.colors.onPrimary,
  },
  slotTextMuted: {
    color: patientTheme.colors.textMuted,
  },
  legendAvailable: {
    backgroundColor: CAL_GREEN.availableBg,
    borderWidth: 1.5,
    borderColor: CAL_GREEN.availableBorder,
  },
  legendSelected: {
    backgroundColor: CAL_GREEN.selectedBg,
    borderWidth: 1.5,
    borderColor: CAL_GREEN.selectedBorder,
  },
  legendOccupied: {
    backgroundColor: CAL_OCCUPIED.bg,
    borderWidth: 1.5,
    borderColor: CAL_OCCUPIED.border,
  },
  dayCellAvailableCompact: {
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: CAL_GREEN.availableBorder,
  },
  dayCellOccupiedOnlyCompactFull: {
    backgroundColor: CAL_OCCUPIED.bg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: CAL_OCCUPIED.border,
    zIndex: 2,
    elevation: 1,
  },
  dayCellSelectedCompact: {
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: CAL_GREEN.selectedBorder,
  },
};

const defaultStyles = StyleSheet.create({
  ...shared,
  empty: {
    padding: 16,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    ...patientShadow,
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  calendarCard: {
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    padding: 12,
    ...patientShadow,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: patientTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  monthNavBtnDisabled: {
    opacity: 0.45,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: patientTheme.radius.md,
    paddingVertical: 2,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
  },
  dayDot: {
    marginTop: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  dayDotSelected: {
    backgroundColor: patientTheme.colors.onPrimary,
  },
  hintText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
    textAlign: 'center',
  },
  slotsSection: {
    marginTop: 14,
  },
  slotsSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: patientTheme.colors.text,
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    minWidth: '22%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1.5,
    borderColor: patientTheme.colors.border,
    alignItems: 'center',
  },
  slotText: {
    fontWeight: '800',
    color: patientTheme.colors.text,
    fontSize: 13,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
});

const compactStyles = StyleSheet.create({
  ...shared,
  empty: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: OUTLINE,
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  calendarCard: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderWidth: 1,
    borderColor: OUTLINE,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  monthNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: OUTLINE,
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: 1,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
    letterSpacing: 0.2,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  daysGridOutlined: {
    borderWidth: 1.5,
    borderColor: CAL_GREEN.idleBorder,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 30,
  },
  dayCellEmptyOutlined: {
    backgroundColor: '#FAFBFC',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: CAL_GREEN.idleBorder,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellOutlined: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: CAL_GREEN.idleBorder,
    backgroundColor: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  hintText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
    textAlign: 'center',
  },
  selectedSlotSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F4FBF7',
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
  },
  selectedSlotSummaryText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: patientTheme.colors.text,
    textTransform: 'capitalize',
  },
  selectedSlotSummaryAction: {
    fontSize: 11,
    fontWeight: '800',
    color: patientTheme.colors.primaryDark,
  },
  slotsSection: {
    marginTop: 10,
  },
  slotsSectionCard: {
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFB',
    borderWidth: 1,
    borderColor: OUTLINE,
  },
  slotsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: patientTheme.colors.text,
    marginBottom: 8,
    textTransform: 'capitalize',
    letterSpacing: -0.2,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotsGridModern: {
    gap: 8,
    justifyContent: 'flex-start',
  },
  slot: {
    minWidth: '22%',
    flexGrow: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: OUTLINE,
    alignItems: 'center',
  },
  slotModern: {
    width: '23%',
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  slotModernSelected: {
    shadowColor: patientTheme.colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  slotModernOccupied: {
    backgroundColor: CAL_OCCUPIED.bg,
    borderColor: CAL_OCCUPIED.border,
    borderWidth: 1.5,
    opacity: 1,
  },
  slotText: {
    fontWeight: '700',
    color: patientTheme.colors.text,
    fontSize: 12,
  },
  slotTextModern: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  slotTextModernMuted: {
    color: '#B0B8C1',
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
});
