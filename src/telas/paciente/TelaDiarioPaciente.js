import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  appendNewestEntry,
  buildMealEntry,
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';

const inputModes = [
  { id: 'photo', label: 'Foto do prato', icon: 'camera-outline' },
  { id: 'text', label: 'Texto rapido', icon: 'create-outline' },
  { id: 'voice', label: 'Voz', icon: 'mic-outline' },
];

const kindStyles = {
  meal: {
    icon: 'restaurant-outline',
    color: patientTheme.colors.primaryDark,
    bg: patientTheme.colors.primarySoft,
  },
  water: {
    icon: 'water-outline',
    color: '#5f9fe6',
    bg: '#edf5ff',
  },
  activity: {
    icon: 'walk-outline',
    color: '#d3a047',
    bg: '#fff6e6',
  },
  medication: {
    icon: 'medical-outline',
    color: '#d47a7a',
    bg: '#fff1f1',
  },
};

export default function PacienteDiarioScreen({ navigation, route, usuarioLogado: usuarioProp }) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const canResolvePatient = useMemo(
    () =>
      Boolean(
        patientId ||
        usuarioLogado?.id_paciente_uuid ||
        usuarioLogado?.cpf_paciente ||
        usuarioLogado?.email_pac ||
        usuarioLogado?.email ||
        usuarioLogado?.id
      ),
    [patientId, usuarioLogado]
  );
  const [selectedMode, setSelectedMode] = useState('photo');
  const [mealText, setMealText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState(null);
  const [objectiveText, setObjectiveText] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          if (!active) return;
          setAppState(createDefaultAppState());
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
        });

        if (!active) return;

        setPatient(experience.patient);
        setObjectiveText(experience.clinicalObjective);
        setAppState(experience.appState);
      } catch (error) {
        console.log('Erro ao carregar diario:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId, canResolvePatient]);

  const todayScore = useMemo(() => {
    const entries = appState.mealEntries || [];

    if (!entries.length) {
      return 0;
    }

    const positiveMeals = entries.filter((item) =>
      String(item.glucoseNote || '').toLowerCase().includes('baixo') ||
      String(item.glucoseNote || '').toLowerCase().includes('estavel')
    ).length;

    return Math.round((positiveMeals / entries.length) * 100);
  }, [appState.mealEntries]);

  const timelineEntries = useMemo(() => {
    const mealEntries = (appState.mealEntries || []).map((item) => ({
      ...item,
      kind: item.kind || 'meal',
    }));

    const activityEntries = (appState.activityEntries || []).map((item) => ({
      id: item.id,
      time: item.time,
      kind: 'activity',
      title: item.label,
      description: 'Atividade registrada no dia.',
      glucoseNote: 'Efeito em observacao',
      glucoseDelta: 'Acompanhando resposta',
      aiNote: 'Movimento registrado. Observe a curva na proxima hora.',
    }));

    const medicationEntries = (appState.medicationEntries || []).map((item) => ({
      id: item.id,
      time: item.time,
      kind: 'medication',
      title: item.label,
      description: 'Medicacao ou insulina registrada.',
      glucoseNote: 'Contexto clinico salvo',
      glucoseDelta: 'Sem leitura vinculada',
      aiNote: 'Registro salvo para correlacionar com a glicose.',
    }));

    return [...mealEntries, ...activityEntries, ...medicationEntries].sort((a, b) =>
      String(b.time || '').localeCompare(String(a.time || ''))
    );
  }, [appState]);

  const modeHelper =
    selectedMode === 'photo'
      ? 'A IA estima ingredientes, macros e impacto glicemico a partir da imagem.'
      : selectedMode === 'voice'
        ? 'Fale sua refeicao como em uma mensagem de audio curta.'
        : 'Descreva rapidamente o prato, horario e quantidade.';

  async function handleAddMeal() {
    const description = mealText.trim();

    if (!description) {
      Alert.alert('Atencao', 'Descreva a refeicao antes de salvar.');
      return;
    }

    const mealEntry = buildMealEntry({
      mode: selectedMode,
      description,
      glucoseNote:
        selectedMode === 'photo' ? 'Impacto estimado pela IA' : 'Impacto glicemico em observacao',
      aiNote:
        selectedMode === 'photo'
          ? 'Imagem recebida. A IA vai usar a descricao para comparar a resposta glicemica das proximas horas.'
          : 'Refeicao salva. Nas proximas leituras, vamos comparar seu impacto na curva.',
    });

    const nextState = {
      ...appState,
      mealEntries: appendNewestEntry(appState.mealEntries, mealEntry),
    };

    setAppState(nextState);
    setMealText('');
    setSaving(true);

    try {
      if (canResolvePatient) {
        const saved = await savePatientAppState({
          patientId,
          objectiveText,
          appState: nextState,
          currentPatient: patient,
          patientContext: usuarioLogado,
        });

        setPatient(saved.patient || patient);
        setObjectiveText(saved.clinicalObjective || objectiveText);
        setAppState(saved.appState);
      }

      Alert.alert('Registro pronto', 'A refeicao foi salva no Supabase.');
    } catch (error) {
      console.log('Erro ao salvar refeicao:', error);
      Alert.alert('Erro', 'Nao foi possivel salvar a refeicao agora.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Input facilitado</Text>
        <Text style={styles.cardText}>{modeHelper}</Text>

        <View style={styles.modeRow}>
          {inputModes.map((mode) => {
            const active = selectedMode === mode.id;

            return (
              <TouchableOpacity
                key={mode.id}
                style={[styles.modeButton, active && styles.modeButtonActive]}
                onPress={() => setSelectedMode(mode.id)}
              >
                <Ionicons
                  name={mode.icon}
                  size={18}
                  color={active ? patientTheme.colors.onPrimary : patientTheme.colors.textMuted}
                />
                <Text style={[styles.modeText, active && styles.modeTextActive]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Ex: Almoco com arroz integral, feijao, frango e salada."
          placeholderTextColor="#8a9095"
          value={mealText}
          onChangeText={setMealText}
          multiline
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleAddMeal} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={patientTheme.colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Adicionar refeicao</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.scoreCard}>
        <View>
          <Text style={styles.scoreLabel}>Nota do dia</Text>
          <Text style={styles.scoreValue}>{todayScore}/100</Text>
        </View>

        <View style={styles.scoreBadge}>
          <MaterialCommunityIcons
            name="food-apple-outline"
            size={18}
            color={patientTheme.colors.primaryDark}
          />
          <Text style={styles.scoreBadgeText}>Curva equilibrada</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Timeline comida x glicose</Text>
      <View style={styles.timelineCard}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.emptyStateText}>Carregando registros do Supabase...</Text>
          </View>
        ) : timelineEntries.length > 0 ? (
          timelineEntries.map((entry, index) => {
            const meta = kindStyles[entry.kind] || kindStyles.meal;

            return (
              <View key={entry.id} style={styles.timelineRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{entry.time}</Text>
                  {index < timelineEntries.length - 1 ? <View style={styles.timeLine} /> : null}
                </View>

                <View style={[styles.kindIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>

                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{entry.title}</Text>
                  <Text style={styles.timelineDescription}>{entry.description}</Text>

                  <View style={styles.tagRow}>
                    <View style={styles.noteTag}>
                      <Text style={styles.noteTagText}>{entry.glucoseNote}</Text>
                    </View>
                    <Text style={styles.deltaText}>{entry.glucoseDelta}</Text>
                  </View>

                  <Text style={styles.aiFeedback}>{entry.aiNote}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Nenhum registro salvo ainda. Adicione sua primeira refeicao para iniciar a timeline.
            </Text>
          </View>
        )}
      </View>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  cardText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
  },
  modeRow: {
    marginTop: 16,
    gap: 10,
  },
  modeButton: {
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  modeText: {
    marginLeft: 10,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  modeTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  input: {
    marginTop: 16,
    minHeight: 110,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: patientTheme.colors.text,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primary,
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  scoreCard: {
    marginTop: 16,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    padding: patientTheme.spacing.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...patientShadow,
  },
  scoreLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scoreValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  scoreBadgeText: {
    marginLeft: 8,
    fontWeight: '700',
    color: patientTheme.colors.primaryDark,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  timelineCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 18,
  },
  timeColumn: {
    width: 50,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  timeLine: {
    marginTop: 8,
    width: 2,
    flex: 1,
    minHeight: 64,
    backgroundColor: patientTheme.colors.border,
  },
  kindIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 4,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  timelineDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
  },
  tagRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  noteTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  noteTagText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  deltaText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  aiFeedback: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: patientTheme.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  emptyStateText: {
    marginTop: 10,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
});
