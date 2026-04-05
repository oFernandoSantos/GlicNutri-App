import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../components/PatientScreenLayout';
import { patientTheme, patientShadow } from '../theme/patientTheme';
import {
  symptomOptions,
  sleepOptions,
  stressOptions,
} from '../data/patientExperienceData';
import {
  appendNewestEntry,
  buildActivityEntry,
  buildSymptomEntry,
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../services/patientSupabaseService';

export default function PacienteBemEstarScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState(null);
  const [objectiveText, setObjectiveText] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [selectedSymptoms, setSelectedSymptoms] = useState(['focused']);
  const [selectedSleep, setSelectedSleep] = useState('good');
  const [selectedStress, setSelectedStress] = useState(2);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!patientId) {
          if (!active) return;
          setAppState(createDefaultAppState());
          return;
        }

        const experience = await fetchPatientExperience(patientId);

        if (!active) return;

        setPatient(experience.patient);
        setObjectiveText(experience.clinicalObjective);
        setAppState(experience.appState);
        setSelectedSymptoms(experience.appState.wellness.selectedSymptoms);
        setSelectedSleep(experience.appState.wellness.selectedSleep);
        setSelectedStress(experience.appState.wellness.selectedStress);
      } catch (error) {
        console.log('Erro ao carregar bem-estar:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId]);

  const insight = useMemo(() => {
    const stressed = selectedStress >= 3;
    const sleptPoorly = selectedSleep === 'poor' || selectedSleep === 'ok';

    if (stressed && sleptPoorly) {
      return 'Sono irregular e estresse mais alto costumam deixar a curva mais reativa. Vale priorizar refeicoes simples, agua e pausas curtas hoje.';
    }

    if (stressed) {
      return 'Seu estresse esta acima do habitual. Respiracao guiada e uma caminhada curta podem ajudar a reduzir impacto metabolico.';
    }

    if (sleptPoorly) {
      return 'Com sono abaixo do ideal, sua resposta a carboidratos pode oscilar mais. Prefira combinacoes com fibras e proteina nas proximas refeicoes.';
    }

    return 'Seu contexto de bem-estar esta favoravel para um dia mais estavel. Continue registrando sintomas para refinar as correlacoes.';
  }, [selectedSleep, selectedStress]);

  function toggleSymptom(id) {
    setSelectedSymptoms((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleSaveWellness() {
    const nextState = {
      ...appState,
      wellness: {
        selectedSymptoms,
        selectedSleep,
        selectedStress,
      },
      symptomEntries: appendNewestEntry(
        appState.symptomEntries,
        buildSymptomEntry(selectedSymptoms, selectedSleep, selectedStress)
      ),
    };

    setAppState(nextState);

    try {
      setSaving(true);

      if (patientId) {
        const saved = await savePatientAppState({
          patientId,
          objectiveText,
          appState: nextState,
          currentPatient: patient,
        });

        setPatient(saved.patient || patient);
        setObjectiveText(saved.clinicalObjective || objectiveText);
        setAppState(saved.appState);
      }

      Alert.alert('Bem-estar salvo', 'Seus sinais do dia foram atualizados no Supabase.');
    } catch (error) {
      console.log('Erro ao salvar bem-estar:', error);
      Alert.alert('Erro', 'Nao foi possivel salvar seu bem-estar agora.');
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickActivity() {
    const nextState = {
      ...appState,
      activityEntries: appendNewestEntry(
        appState.activityEntries,
        buildActivityEntry('Caminhada leve')
      ),
      wellness: {
        selectedSymptoms,
        selectedSleep,
        selectedStress,
      },
    };

    setAppState(nextState);

    try {
      setSaving(true);

      if (patientId) {
        const saved = await savePatientAppState({
          patientId,
          objectiveText,
          appState: nextState,
          currentPatient: patient,
        });

        setPatient(saved.patient || patient);
        setObjectiveText(saved.clinicalObjective || objectiveText);
        setAppState(saved.appState);
      }

      Alert.alert('Atividade registrada', 'A caminhada foi salva no Supabase.');
    } catch (error) {
      console.log('Erro ao salvar atividade:', error);
      Alert.alert('Erro', 'Nao foi possivel registrar a atividade agora.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Bem-estar"
      subtitle="Registre sintomas, sono e estresse para entender melhor sua glicose."
    >
      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando dados do paciente...</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Como voce esta se sentindo?</Text>
        <View style={styles.symptomGrid}>
          {symptomOptions.map((item) => {
            const active = selectedSymptoms.includes(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.symptomChip, active && styles.symptomChipActive]}
                onPress={() => toggleSymptom(item.id)}
              >
                <Text style={styles.symptomEmoji}>{item.emoji}</Text>
                <Text style={[styles.symptomLabel, active && styles.symptomLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Qualidade do sono</Text>
        <View style={styles.optionColumn}>
          {sleepOptions.map((item) => {
            const active = selectedSleep === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => setSelectedSleep(item.id)}
              >
                <View>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.optionHelper, active && styles.optionHelperActive]}>
                    {item.helper}
                  </Text>
                </View>

                {active ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={patientTheme.colors.onPrimary}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nivel de estresse</Text>
        <View style={styles.stressRow}>
          {stressOptions.map((item) => {
            const active = selectedStress === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.stressChip, active && styles.stressChipActive]}
                onPress={() => setSelectedStress(item.id)}
              >
                <Text style={[styles.stressChipText, active && styles.stressChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.sectionTitle}>Correlacao do dia</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryAction} onPress={handleQuickActivity}>
          <Text style={styles.secondaryActionText}>Registrar caminhada leve</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryAction} onPress={handleSaveWellness}>
          {saving ? (
            <ActivityIndicator color={patientTheme.colors.onPrimary} />
          ) : (
            <Text style={styles.primaryActionText}>Salvar bem-estar</Text>
          )}
        </TouchableOpacity>
      </View>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginBottom: 16,
    ...patientShadow,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  symptomGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  symptomChip: {
    width: '48%',
    minHeight: 88,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symptomChipActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  symptomEmoji: {
    fontSize: 24,
  },
  symptomLabel: {
    marginTop: 8,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  symptomLabelActive: {
    color: patientTheme.colors.onPrimary,
  },
  optionColumn: {
    marginTop: 14,
    gap: 10,
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionRowActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  optionTitle: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  optionTitleActive: {
    color: patientTheme.colors.onPrimary,
  },
  optionHelper: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  optionHelperActive: {
    color: 'rgba(255,255,255,0.86)',
  },
  stressRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stressChip: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
  },
  stressChipActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  stressChipText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  stressChipTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  insightCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  insightText: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  loadingCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginBottom: 16,
    alignItems: 'center',
    ...patientShadow,
  },
  loadingText: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
  },
});
