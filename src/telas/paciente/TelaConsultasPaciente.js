import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';
import { getPatientId } from '../../servicos/servicoDadosPaciente';
import { listNutritionists } from '../../servicos/servicoNutricionistas';
import { listNutriAvailability, generateSlotsForNextDays } from '../../servicos/servicoAgendaNutri';
import { createConsulta, listConsultasByPaciente, formatConsultaDateTime } from '../../servicos/servicoConsultas';

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
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingAgendar, setLoadingAgendar] = useState(false);
  const [nutricionistas, setNutricionistas] = useState([]);
  const [selectedNutri, setSelectedNutri] = useState(null);
  const [slots, setSlots] = useState([]);
  const [consultas, setConsultas] = useState([]);

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      const [nutris, cons] = await Promise.all([
        listNutritionists({ limit: 80 }),
        listConsultasByPaciente(patientId, { limit: 120 }),
      ]);
      setNutricionistas(nutris || []);
      setConsultas(cons || []);
      if (!selectedNutri && (nutris || []).length) {
        setSelectedNutri(nutris[0]);
      }
    } catch (error) {
      console.log('Erro ao carregar consultas/pacientes:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedNutri]);

  const loadSlots = useCallback(async () => {
    try {
      if (!selectedNutri?.id_nutricionista_uuid) {
        setSlots([]);
        return;
      }
      setLoadingSlots(true);
      const avail = await listNutriAvailability(selectedNutri.id_nutricionista_uuid);
      const generated = generateSlotsForNextDays(avail, { days: 14 });
      setSlots(generated);
    } catch (error) {
      console.log('Erro ao carregar slots:', error);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedNutri]);

  useEffect(() => {
    loadBase();
    const unsubscribe = navigation.addListener('focus', () => loadBase());
    return unsubscribe;
  }, [navigation, loadBase]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const consultasProximas = useMemo(() => {
    const now = Date.now();
    return (consultas || [])
      .slice()
      .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
      .filter((item) => {
        const dt = new Date(item.scheduled_at || 0);
        return !Number.isNaN(dt.getTime()) && dt.getTime() >= now && item.status !== 'cancelled';
      })
      .slice(0, 12);
  }, [consultas]);

  async function handleAgendar(slot) {
    try {
      if (!patientId) {
        return;
      }
      if (!selectedNutri?.id_nutricionista_uuid) {
        return;
      }
      setLoadingAgendar(true);
      await createConsulta({
        nutricionistaId: selectedNutri.id_nutricionista_uuid,
        pacienteId: patientId,
        scheduledAt: slot.scheduledAt,
        motivo: '',
        actor: usuarioLogado,
      });
      await loadBase();
    } catch (error) {
      console.log('Erro ao agendar:', error);
    } finally {
      setLoadingAgendar(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
    >
      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Ionicons name="people-outline" size={18} color={patientTheme.colors.primaryDark} />
          <Text style={styles.summaryText}>{nutricionistas.length} nutricionistas</Text>
        </View>
        <View style={styles.summaryPill}>
          <Ionicons name="calendar-outline" size={18} color={patientTheme.colors.primaryDark} />
          <Text style={styles.summaryText}>Agendar por slots</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando agenda...</Text>
        </View>
      ) : null}

      <View style={styles.nutriSelectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nutriSelectorScroll}>
          {nutricionistas.map((nutri) => {
            const active = selectedNutri?.id_nutricionista_uuid === nutri.id_nutricionista_uuid;
            return (
              <TouchableOpacity
                key={nutri.id_nutricionista_uuid}
                style={[styles.nutriPill, active && styles.nutriPillActive]}
                onPress={() => setSelectedNutri(nutri)}
              >
                <Text style={[styles.nutriPillText, active && styles.nutriPillTextActive]}>
                  {nutri.nome_completo_nutri || 'Nutricionista'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.professionalCard}>
        <View style={styles.professionalHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(selectedNutri?.nome_completo_nutri)}</Text>
          </View>
          <View style={styles.professionalInfo}>
            <Text style={styles.professionalName} numberOfLines={1}>
              {selectedNutri?.nome_completo_nutri || 'Selecione um nutricionista'}
            </Text>
            <Text style={styles.professionalCrn}>
              {selectedNutri?.crm_numero ? `CRN ${selectedNutri.crm_numero}` : 'CRN não informado'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshSlots} onPress={loadSlots} disabled={loadingSlots}>
            <Ionicons name="refresh-outline" size={18} color={patientTheme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.availabilityHeader}>
          <Ionicons name="time-outline" size={18} color={patientTheme.colors.primaryDark} />
          <Text style={styles.availabilityTitle}>Slots disponíveis (próximos 14 dias)</Text>
        </View>

        {loadingSlots ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Carregando slots...</Text>
          </View>
        ) : slots.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.slotList}
          >
            {slots.slice(0, 30).map((slot) => (
              <TouchableOpacity
                key={slot.scheduledAt}
                activeOpacity={0.78}
                style={styles.slotButton}
                onPress={() => handleAgendar(slot)}
                disabled={loadingAgendar}
              >
                <Text style={styles.slotText}>{slot.localLabel}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.focusText}>
            Este nutricionista ainda nao cadastrou disponibilidade.
          </Text>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Minhas consultas</Text>
        <TouchableOpacity style={styles.smallIcon} onPress={loadBase} disabled={loading}>
          <Ionicons name="refresh-outline" size={18} color={patientTheme.colors.text} />
        </TouchableOpacity>
      </View>

      {consultasProximas.length ? (
        consultasProximas.map((item) => (
          <View key={item.id} style={styles.consultaCard}>
            <Text style={styles.consultaTitle}>{formatConsultaDateTime(item.scheduled_at)}</Text>
            <Text style={styles.consultaMeta}>Status: {String(item.status || '')}</Text>
          </View>
        ))
      ) : (
        <View style={styles.consultaEmpty}>
          <Text style={styles.focusText}>Nenhuma consulta agendada.</Text>
        </View>
      )}
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
  loadingCard: {
    marginTop: 14,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    ...patientShadow,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
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
  nutriSelectorRow: {
    marginTop: 12,
  },
  nutriSelectorScroll: {
    gap: 8,
    paddingVertical: 6,
  },
  nutriPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    ...patientShadow,
  },
  nutriPillActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  nutriPillText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  nutriPillTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  refreshSlots: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
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
  sectionHeader: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  smallIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  consultaCard: {
    marginTop: 10,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 14,
    ...patientShadow,
  },
  consultaTitle: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  consultaMeta: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  consultaEmpty: {
    marginTop: 12,
    alignItems: 'center',
  },
});
