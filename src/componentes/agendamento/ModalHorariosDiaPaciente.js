import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { CAL_GREEN, CAL_OCCUPIED } from './coresCalendarioAgenda';
import {
  formatDayLabel,
  formatTimeLabel,
  isTodayKey,
} from '../../utilitarios/slotsTeleconsulta';

const OUTLINE = '#E8ECF0';
const GREEN = {
  availableBorder: CAL_GREEN.availableBorder,
  selectedBg: CAL_GREEN.selectedBg,
  selectedBorder: CAL_GREEN.selectedBorder,
};
const OCCUPIED = CAL_OCCUPIED;

/**
 * Popup de horários do dia — padrão visual dos modais do paciente.
 */
export default function ModalHorariosDiaPaciente({
  visible = false,
  onClose,
  dateKey = '',
  slots = [],
  selectedSlot,
  onSelectSlot,
}) {
  const dayLabel = dateKey ? formatDayLabel(dateKey) : '';
  const todaySuffix = dateKey && isTodayKey(dateKey) ? ' · Hoje' : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Escolha o horário</Text>
              {dayLabel ? (
                <Text style={styles.subtitle}>
                  {dayLabel}
                  {todaySuffix}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.slotsGrid}>
              {(slots || []).map((slot) => {
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: patientTheme.colors.overlay,
  },
  card: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.xl,
    padding: 20,
    gap: 12,
    ...patientShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
    textTransform: 'capitalize',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F8FA',
    borderWidth: 1,
    borderColor: OUTLINE,
  },
  divider: {
    height: 1,
    backgroundColor: patientTheme.colors.border,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  slot: {
    width: '23%',
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: GREEN.availableBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: {
    backgroundColor: GREEN.selectedBg,
    borderColor: GREEN.selectedBorder,
    borderWidth: 2,
    shadowColor: GREEN.selectedBg,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  slotOccupied: {
    backgroundColor: OCCUPIED.bg,
    borderColor: OCCUPIED.border,
    borderWidth: 1.5,
    opacity: 1,
  },
  slotUnavailable: {
    opacity: 0.35,
  },
  slotText: {
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  slotTextSelected: {
    color: patientTheme.colors.onPrimary,
  },
  slotTextMuted: {
    color: OCCUPIED.text,
    fontWeight: '700',
  },
});
