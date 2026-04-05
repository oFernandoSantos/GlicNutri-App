import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../components/PatientScreenLayout';
import { patientTheme, patientShadow } from '../theme/patientTheme';
import {
  aiAlerts,
  assistantQuickQuestions,
  buildAssistantReply,
} from '../data/patientExperienceData';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
  getLatestGlucose,
  savePatientAppState,
} from '../services/patientSupabaseService';

const assistantWelcome =
  'Estou aqui para responder duvidas do dia a dia cruzando sua glicose, refeicoes e rotina.';

export default function PacienteAssistenteScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        console.log('Erro ao carregar assistente:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId]);

  const currentGlucose = getLatestGlucose(glucoseReadings)?.value || 105;
  const messages =
    appState.assistantMessages?.length > 0
      ? appState.assistantMessages
      : [{ id: 'assistant-1', role: 'assistant', text: assistantWelcome }];

  const positiveMessage = useMemo(
    () =>
      'Hoje voce ficou a maior parte do tempo na meta. Isso mostra consistencia e boas escolhas ao longo do dia.',
    []
  );

  async function sendQuestion(text) {
    const question = text.trim();
    if (!question) return;

    const nextMessages = [
      ...messages,
      { id: `user-${Date.now()}`, role: 'user', text: question },
      {
        id: `assistant-${Date.now() + 1}`,
        role: 'assistant',
        text: buildAssistantReply(question, currentGlucose),
      },
    ];
    const nextState = {
      ...appState,
      assistantMessages: nextMessages,
    };

    setAppState(nextState);
    setInput('');

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
    } catch (error) {
      console.log('Erro ao salvar conversa:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Assistente IA"
      subtitle="Alertas humanizados, reforcos positivos e um canal rapido para tirar duvidas."
    >
      <View style={styles.alertCard}>
        <Text style={styles.sectionTitle}>Alertas do momento</Text>
        {aiAlerts.map((alert) => (
          <View key={alert.id} style={styles.alertItem}>
            <View style={styles.alertTag}>
              <Text style={styles.alertTagText}>{alert.tag}</Text>
            </View>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertText}>{alert.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.positiveCard}>
        <View style={styles.positiveIcon}>
          <Ionicons name="checkmark-circle-outline" size={22} color={patientTheme.colors.primaryDark} />
        </View>
        <View style={styles.positiveCopy}>
          <Text style={styles.positiveTitle}>Reforco positivo</Text>
          <Text style={styles.positiveText}>{positiveMessage}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Tira-duvidas</Text>
      <View style={styles.quickQuestions}>
        {assistantQuickQuestions.map((question) => (
          <TouchableOpacity
            key={question}
            style={styles.questionChip}
            onPress={() => sendQuestion(question)}
          >
            <Text style={styles.questionChipText}>{question}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chatCard}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
          </View>
        ) : (
          messages.map((message) => {
          const isUser = message.role === 'user';

          return (
            <View
              key={message.id}
              style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}
            >
              <Text style={[styles.messageText, isUser && styles.userBubbleText]}>
                {message.text}
              </Text>
            </View>
          );
          })
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Ex: Posso comer uma maca agora?"
            placeholderTextColor="#8a9095"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => sendQuestion(input)}>
            {saving ? (
              <ActivityIndicator color={patientTheme.colors.onPrimary} />
            ) : (
              <Ionicons name="send" size={18} color={patientTheme.colors.onPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  alertCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  alertItem: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
  },
  alertTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  alertTagText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  alertTitle: {
    marginTop: 10,
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  alertText: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  positiveCard: {
    marginTop: 18,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...patientShadow,
  },
  positiveIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positiveCopy: {
    flex: 1,
  },
  positiveTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  positiveText: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  quickQuestions: {
    marginTop: 14,
    gap: 10,
  },
  questionChip: {
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: patientTheme.colors.surface,
    ...patientShadow,
  },
  questionChipText: {
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  chatCard: {
    marginTop: 18,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    marginBottom: 10,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: patientTheme.colors.primaryDark,
  },
  messageText: {
    color: patientTheme.colors.text,
    lineHeight: 20,
    fontSize: 14,
  },
  userBubbleText: {
    color: patientTheme.colors.onPrimary,
  },
  composer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.surfaceMuted,
    paddingHorizontal: 14,
    color: patientTheme.colors.text,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
