import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PatientScreenLayout from '../components/PatientScreenLayout';
import { patientTheme, patientShadow } from '../theme/patientTheme';
import {
  addGlucoseReading,
  appendNewestEntry,
  buildMedicationEntry,
  buildMonitorSeries,
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../services/patientSupabaseService';

const rangeOptions = ['Hoje', '7 dias', '14 dias'];

const eventIcons = {
  meal: {
    library: 'material',
    icon: 'food-apple-outline',
    color: patientTheme.colors.primaryDark,
  },
  activity: {
    library: 'ion',
    icon: 'walk-outline',
    color: patientTheme.colors.warning,
  },
  medication: {
    library: 'ion',
    icon: 'medical-outline',
    color: '#d47a7a',
  },
  sleep: {
    library: 'ion',
    icon: 'moon-outline',
    color: '#8d9ae8',
  },
  water: {
    library: 'ion',
    icon: 'water-outline',
    color: '#6aaaf0',
  },
};

function EventBadge({ event }) {
  const meta = eventIcons[event];

  if (!meta) return null;

  return (
    <View style={styles.eventBadge}>
      {meta.library === 'material' ? (
        <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
      ) : (
        <Ionicons name={meta.icon} size={14} color={meta.color} />
      )}
    </View>
  );
}

export default function PacienteMonitoramentoScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [range, setRange] = useState('Hoje');
  const [loading, setLoading] = useState(true);
  const [savingGlucose, setSavingGlucose] = useState(false);
  const [savingMedication, setSavingMedication] = useState(false);
  const [newGlucoseValue, setNewGlucoseValue] = useState('');
  const [patient, setPatient] = useState(null);
  const [objectiveText, setObjectiveText] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [glucoseReadings, setGlucoseReadings] = useState([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!patientId) {
          if (!active) return;
          setAppState(createDefaultAppState());
          setGlucoseReadings([]);
          return;
        }

        const experience = await fetchPatientExperience(patientId);

        if (!active) return;

        setPatient(experience.patient);
        setObjectiveText(experience.clinicalObjective);
        setAppState(experience.appState);
        setGlucoseReadings(experience.glucoseReadings);
      } catch (error) {
        console.log('Erro ao carregar monitoramento:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId]);

  const eventEntries = useMemo(
    () => [
      ...(appState.mealEntries || []).map((item) => ({
        date: item.date || new Date().toISOString().slice(0, 10),
        time: item.time,
        kind: 'meal',
      })),
      ...(appState.activityEntries || []).map((item) => ({
        date: item.date || new Date().toISOString().slice(0, 10),
        time: item.time,
        kind: 'activity',
      })),
      ...(appState.medicationEntries || []).map((item) => ({
        date: item.date || new Date().toISOString().slice(0, 10),
        time: item.time,
        kind: 'medication',
      })),
      ...(appState.symptomEntries || []).map((item) => ({
        date: item.date,
        time: item.time,
        kind: 'sleep',
      })),
    ],
    [appState]
  );

  const series = useMemo(() => {
    const baseSeries = buildMonitorSeries(glucoseReadings, range);

    return baseSeries.map((item) => {
      const matchedEvent = eventEntries.find((event) => {
        if (range === 'Hoje') {
          return event.date === item.date && String(event.time || '').slice(0, 2) === String(item.time || '').slice(0, 2);
        }

        return event.date === item.date;
      });

      return {
        ...item,
        event: matchedEvent?.kind || null,
      };
    });
  }, [eventEntries, glucoseReadings, range]);

  const metrics = useMemo(() => {
    if (!glucoseReadings.length) {
      return {
        avg: '--',
        variability: '--',
        gmi: '--',
      };
    }

    const values = glucoseReadings.map((item) => item.value);
    const avg = Math.round(values.reduce((sum, item) => sum + item, 0) / values.length);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const variability = avg ? Math.round(((max - min) / avg) * 100) : 0;
    const gmi = (3.31 + 0.02392 * avg).toFixed(1);

    return {
      avg,
      variability,
      gmi,
    };
  }, [glucoseReadings]);

  const min = series.length ? Math.min(...series.map((item) => item.value)) : 0;
  const max = series.length ? Math.max(...series.map((item) => item.value)) : 0;
  const rangeSize = Math.max(max - min, 1);

  async function handleAddGlucose() {
    const parsedValue = Number(newGlucoseValue);

    if (!parsedValue || parsedValue <= 0) {
      Alert.alert('Atencao', 'Informe um valor de glicose valido.');
      return;
    }

    try {
      setSavingGlucose(true);
      await addGlucoseReading(patientId, parsedValue);
      const updatedReadings = await fetchPatientExperience(patientId);
      setGlucoseReadings(updatedReadings.glucoseReadings);
      setNewGlucoseValue('');
      Alert.alert('Leitura salva', 'A glicemia manual foi registrada no Supabase.');
    } catch (error) {
      console.log('Erro ao salvar glicemia:', error);
      Alert.alert('Erro', 'Nao foi possivel salvar a glicemia agora.');
    } finally {
      setSavingGlucose(false);
    }
  }

  async function handleRegisterMedication() {
    try {
      setSavingMedication(true);
      const nextState = {
        ...appState,
        medicationEntries: appendNewestEntry(
          appState.medicationEntries,
          buildMedicationEntry('Medicacao / insulina')
        ),
      };

      setAppState(nextState);

      const saved = await savePatientAppState({
        patientId,
        objectiveText,
        appState: nextState,
        currentPatient: patient,
      });

      setPatient(saved.patient || patient);
      setObjectiveText(saved.clinicalObjective || objectiveText);
      setAppState(saved.appState);
      Alert.alert('Registro salvo', 'Medicacao registrada com sucesso.');
    } catch (error) {
      console.log('Erro ao salvar medicacao:', error);
      Alert.alert('Erro', 'Nao foi possivel salvar a medicacao agora.');
    } finally {
      setSavingMedication(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Monitoramento"
      subtitle="Analise sua curva glicemica com contexto visual e eventos sobrepostos."
    >
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Novo registro manual</Text>
        <Text style={styles.formText}>
          Salve leituras e eventos para correlacionar refeicoes, atividade e medicacao.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ex: 108"
          placeholderTextColor="#8a9095"
          keyboardType="numeric"
          value={newGlucoseValue}
          onChangeText={setNewGlucoseValue}
        />

        <View style={styles.formActions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAddGlucose}
            disabled={savingGlucose || !patientId}
          >
            {savingGlucose ? (
              <ActivityIndicator color={patientTheme.colors.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Salvar glicemia</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleRegisterMedication}
            disabled={savingMedication || !patientId}
          >
            {savingMedication ? (
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
            ) : (
              <Text style={styles.secondaryButtonText}>Registrar medicacao</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        {rangeOptions.map((item) => {
          const active = item === range;

          return (
            <TouchableOpacity
              key={item}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setRange(item)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Curva glicemica</Text>
            <Text style={styles.chartSubtitle}>
              Role horizontalmente para observar melhor causa e efeito.
            </Text>
          </View>
          <View style={styles.chartRangePill}>
            <Text style={styles.chartRangeText}>{range}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
            </View>
          ) : series.length > 0 ? (
            <View style={styles.chartRow}>
              {series.map((item) => {
                const height = 56 + ((item.value - min) / rangeSize) * 92;

                return (
                  <View key={`${item.label}-${item.value}`} style={styles.barWrapper}>
                    {item.event ? (
                      <EventBadge event={item.event} />
                    ) : (
                      <View style={styles.eventSpacer} />
                    )}

                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height }]} />
                    </View>

                    <Text style={styles.barValue}>{item.value}</Text>
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyChartText}>
                Ainda nao ha leituras suficientes no Supabase para montar o grafico.
              </Text>
            </View>
          )}
        </ScrollView>

        <Text style={styles.chartHint}>
          Eventos de refeicao, atividade e medicacao ajudam a conectar comportamento e resposta metabolica.
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Media</Text>
          <Text style={styles.metricValue}>{metrics.avg}</Text>
          <Text style={styles.metricUnit}>mg/dL</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Variabilidade</Text>
          <Text style={styles.metricValue}>
            {metrics.variability === '--' ? '--' : `${metrics.variability}%`}
          </Text>
          <Text style={styles.metricUnit}>amplitude</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>GMI</Text>
          <Text style={styles.metricValue}>{metrics.gmi}</Text>
          <Text style={styles.metricUnit}>estimado</Text>
        </View>
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>Leitura guiada</Text>
        <Text style={styles.insightText}>
          Sua variabilidade esta em zona confortavel. O melhor padrao aparece quando voce combina
          refeicoes com fibras e uma caminhada leve nas horas seguintes.
        </Text>
      </View>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  formText: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
    paddingHorizontal: 14,
    color: patientTheme.colors.text,
  },
  formActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  tabRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    ...patientShadow,
  },
  tabActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  tabText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  tabTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  chartCard: {
    marginTop: 18,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  chartSubtitle: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 220,
  },
  chartRangePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  chartRangeText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingRight: 10,
  },
  loadingArea: {
    minWidth: 280,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChart: {
    minWidth: 280,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyChartText: {
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  barWrapper: {
    width: 54,
    alignItems: 'center',
  },
  eventBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  eventSpacer: {
    height: 36,
  },
  barTrack: {
    width: 30,
    height: 160,
    borderRadius: 16,
    backgroundColor: patientTheme.colors.surfaceMuted,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: patientTheme.colors.primary,
  },
  barValue: {
    marginTop: 10,
    fontSize: 12,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  barLabel: {
    marginTop: 4,
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  chartHint: {
    marginTop: 16,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  metricsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    ...patientShadow,
  },
  metricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    marginTop: 12,
    color: patientTheme.colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  metricUnit: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  insightCard: {
    marginTop: 18,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  insightText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
});
