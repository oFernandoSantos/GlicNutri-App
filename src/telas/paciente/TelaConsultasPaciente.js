import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';

const PROFESSIONALS = [
  {
    id: 'ana-paula',
    name: 'Dra. Ana Paula Martins',
    specialty: 'Nutricionista clinica',
    crn: 'CRN 12345',
    focus: 'Diabetes tipo 2, reeducacao alimentar e controle glicemico.',
    nextAvailable: 'Hoje',
    slots: ['09:30', '11:00', '14:30', '16:00'],
  },
  {
    id: 'rafael-lima',
    name: 'Dr. Rafael Lima',
    specialty: 'Endocrinologista',
    crn: 'CRM 45678',
    focus: 'Ajustes metabolicos, insulinoterapia e acompanhamento de exames.',
    nextAvailable: 'Amanha',
    slots: ['08:00', '10:30', '13:00', '17:30'],
  },
  {
    id: 'marina-costa',
    name: 'Dra. Marina Costa',
    specialty: 'Nutricionista esportiva',
    crn: 'CRN 98765',
    focus: 'Rotina alimentar, atividade fisica e perda de peso sustentavel.',
    nextAvailable: 'Quinta-feira',
    slots: ['07:30', '12:00', '15:30', '18:00'],
  },
  {
    id: 'bianca-rocha',
    name: 'Dra. Bianca Rocha',
    specialty: 'Educadora em diabetes',
    crn: 'COREN 24680',
    focus: 'Contagem de carboidratos, hipoglicemia e organizacao da rotina.',
    nextAvailable: 'Sexta-feira',
    slots: ['09:00', '10:00', '14:00', '15:00'],
  },
];

function getInitials(name) {
  return String(name || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}

export default function PacienteAgendamentosScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
    >
      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Ionicons name="people-outline" size={18} color={patientTheme.colors.primaryDark} />
          <Text style={styles.summaryText}>{PROFESSIONALS.length} profissionais</Text>
        </View>
        <View style={styles.summaryPill}>
          <Ionicons name="calendar-outline" size={18} color={patientTheme.colors.primaryDark} />
          <Text style={styles.summaryText}>Horarios proximos</Text>
        </View>
      </View>

      <View style={styles.professionalList}>
        {PROFESSIONALS.map((professional) => (
          <View key={professional.id} style={styles.professionalCard}>
            <View style={styles.professionalHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(professional.name)}</Text>
              </View>

              <View style={styles.professionalInfo}>
                <Text style={styles.professionalName} numberOfLines={1}>
                  {professional.name}
                </Text>
                <Text style={styles.professionalSpecialty}>{professional.specialty}</Text>
                <Text style={styles.professionalCrn}>{professional.crn}</Text>
              </View>
            </View>

            <Text style={styles.focusText}>{professional.focus}</Text>

            <View style={styles.availabilityHeader}>
              <Ionicons name="time-outline" size={18} color={patientTheme.colors.primaryDark} />
              <Text style={styles.availabilityTitle}>
                Proxima disponibilidade: {professional.nextAvailable}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slotList}
            >
              {professional.slots.map((slot) => (
                <TouchableOpacity
                  key={`${professional.id}-${slot}`}
                  activeOpacity={0.78}
                  style={styles.slotButton}
                >
                  <Text style={styles.slotText}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  summaryPill: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: '#d7f8ea',
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  summaryText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  professionalList: {
    gap: 14,
    marginTop: 16,
  },
  professionalCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    ...patientShadow,
  },
  professionalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    marginRight: 12,
    width: 46,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  professionalInfo: {
    flex: 1,
  },
  professionalName: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  professionalSpecialty: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  professionalCrn: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  focusText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 12,
  },
  availabilityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  availabilityTitle: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  slotList: {
    gap: 8,
    paddingTop: 10,
  },
  slotButton: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1.5,
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  slotText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
});
