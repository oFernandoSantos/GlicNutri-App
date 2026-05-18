import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { formatTimeLabel, isTodayKey } from '../../utilitarios/slotsTeleconsulta';

export default function CalendarioHorarios({
  days = [],
  selectedDayKey,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
}) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [days, fade]);

  const activeDay = useMemo(
    () => days.find((day) => day.dateKey === selectedDayKey) || days[0] || null,
    [days, selectedDayKey]
  );

  if (!days.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum horário disponível no período.</Text>
      </View>
    );
  }

  return (
    <Animated.View style={{ opacity: fade }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daysRow}
      >
        {days.map((day) => {
          const active = day.dateKey === (selectedDayKey || activeDay?.dateKey);
          const hasAvailable = day.slots?.some((slot) => slot.status === 'available');

          return (
            <TouchableOpacity
              key={day.dateKey}
              style={[
                styles.dayPill,
                active && styles.dayPillActive,
                !hasAvailable && styles.dayPillMuted,
              ]}
              onPress={() => onSelectDay?.(day.dateKey)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dayWeek, active && styles.dayWeekActive]}>
                {day.label.split(',')[0]}
              </Text>
              <Text style={[styles.dayDate, active && styles.dayDateActive]}>
                {day.label.split(',')[1]?.trim() || day.dateKey.slice(-2)}
              </Text>
              {isTodayKey(day.dateKey) ? (
                <Text style={[styles.dayTag, active && styles.dayTagActive]}>Hoje</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.slotsGrid}>
        {(activeDay?.slots || []).map((slot) => {
          const selected = selectedSlot?.scheduledAt === slot.scheduledAt;
          const occupied = slot.status === 'occupied';
          const unavailable = slot.status === 'unavailable';

          return (
            <TouchableOpacity
              key={slot.scheduledAt}
              style={[
                styles.slot,
                selected && styles.slotSelected,
                occupied && styles.slotOccupied,
                unavailable && styles.slotUnavailable,
              ]}
              disabled={occupied || unavailable}
              onPress={() => onSelectSlot?.(slot)}
              activeOpacity={0.82}
            >
              <Text
                style={[
                  styles.slotText,
                  selected && styles.slotTextSelected,
                  (occupied || unavailable) && styles.slotTextMuted,
                ]}
              >
                {formatTimeLabel(slot.scheduledAt)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendAvailable]} />
          <Text style={styles.legendText}>Disponível</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendSelected]} />
          <Text style={styles.legendText}>Selecionado</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendOccupied]} />
          <Text style={styles.legendText}>Ocupado</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  daysRow: {
    gap: 8,
    paddingVertical: 4,
  },
  dayPill: {
    minWidth: 72,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    ...patientShadow,
  },
  dayPillActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  dayPillMuted: {
    opacity: 0.65,
  },
  dayWeek: {
    fontSize: 11,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
    textTransform: 'capitalize',
  },
  dayWeekActive: {
    color: patientTheme.colors.onPrimary,
  },
  dayDate: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  dayDateActive: {
    color: patientTheme.colors.onPrimary,
  },
  dayTag: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '800',
    color: patientTheme.colors.primaryDark,
  },
  dayTagActive: {
    color: patientTheme.colors.onPrimary,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
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
  slotSelected: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  slotOccupied: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    opacity: 0.55,
  },
  slotUnavailable: {
    opacity: 0.35,
  },
  slotText: {
    fontWeight: '800',
    color: patientTheme.colors.text,
    fontSize: 13,
  },
  slotTextSelected: {
    color: patientTheme.colors.onPrimary,
  },
  slotTextMuted: {
    color: patientTheme.colors.textMuted,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendAvailable: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.primaryDark,
  },
  legendSelected: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  legendOccupied: {
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  legendText: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
});
