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
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../services/patientSupabaseService';

export default function PacientePlanoScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [expandedFood, setExpandedFood] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [patient, setPatient] = useState(null);
  const [objectiveText, setObjectiveText] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());

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
      } catch (error) {
        console.log('Erro ao carregar plano:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId]);

  const planSections = appState.planSections || [];
  const thread = appState.nutritionistThread || [];

  async function sendMessage() {
    const text = message.trim();
    if (!text) return;

    const nextThread = [
      ...thread,
      {
        id: `user-${Date.now()}`,
        author: 'Voce',
        role: 'user',
        time: 'Agora',
        text,
      },
    ];
    const nextState = {
      ...appState,
      nutritionistThread: nextThread,
    };

    setAppState(nextState);
    setMessage('');

    try {
      setSending(true);

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
      console.log('Erro ao salvar chat da nutricionista:', error);
    } finally {
      setSending(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Meu plano"
      subtitle="Veja o plano prescrito, trocas equivalentes e converse com sua nutricionista."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Area da nutricionista</Text>
        <Text style={styles.heroTitle}>Plano alimentar interativo</Text>
        <Text style={styles.heroText}>
          Toque em um alimento para ver substituicoes praticas com equivalencia semelhante.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando plano do Supabase...</Text>
        </View>
      ) : null}

      {planSections.map((section) => (
        <View key={section.id} style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planTitle}>{section.title}</Text>
              <Text style={styles.planTime}>{section.time}</Text>
            </View>
            <View style={styles.planObjectivePill}>
              <Text style={styles.planObjectiveText}>{section.objective}</Text>
            </View>
          </View>

          {section.foods.map((food) => {
            const substitution = section.substitutions.find((item) => item.anchor === food);
            const expandedKey = `${section.id}-${food}`;
            const isExpanded = expandedFood === expandedKey;

            return (
              <View key={food} style={styles.foodBlock}>
                <TouchableOpacity
                  style={styles.foodRow}
                  onPress={() => setExpandedFood(isExpanded ? null : expandedKey)}
                >
                  <Text style={styles.foodText}>{food}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={patientTheme.colors.textMuted}
                  />
                </TouchableOpacity>

                {isExpanded && substitution ? (
                  <View style={styles.substitutionBox}>
                    {substitution.options.map((option) => (
                      <Text key={option} style={styles.substitutionText}>
                        - {option}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.chatCard}>
        <Text style={styles.chatTitle}>Chat direto</Text>
        <Text style={styles.chatSubtitle}>
          Suporte assincrono para ajustes entre consultas.
        </Text>

        {thread.map((item) => {
          const isUser = item.role === 'user';

          return (
            <View
              key={item.id}
              style={[styles.messageBubble, isUser ? styles.messageUser : styles.messageNutri]}
            >
              <Text style={[styles.messageAuthor, isUser && styles.messageAuthorUser]}>
                {item.author} | {item.time}
              </Text>
              <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
                {item.text}
              </Text>
            </View>
          );
        })}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Escreva sua duvida para a nutricionista"
            placeholderTextColor="#8a9095"
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            {sending ? (
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
  heroCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroEyebrow: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  heroText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
  planCard: {
    marginTop: 16,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  planHeader: {
    marginBottom: 14,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  planTime: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
  },
  planObjectivePill: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: patientTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  planObjectiveText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  foodBlock: {
    marginTop: 8,
  },
  foodRow: {
    borderRadius: 16,
    backgroundColor: patientTheme.colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodText: {
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  substitutionBox: {
    marginTop: 8,
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f7fafc',
  },
  substitutionText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  chatCard: {
    marginTop: 18,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  chatSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  messageBubble: {
    marginTop: 14,
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  messageNutri: {
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  messageUser: {
    alignSelf: 'flex-end',
    backgroundColor: patientTheme.colors.primaryDark,
  },
  messageAuthor: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  messageAuthorUser: {
    color: 'rgba(255,255,255,0.82)',
  },
  messageText: {
    marginTop: 6,
    color: patientTheme.colors.text,
    lineHeight: 20,
  },
  messageTextUser: {
    color: patientTheme.colors.onPrimary,
  },
  composer: {
    marginTop: 16,
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
  loadingCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    alignItems: 'center',
    ...patientShadow,
  },
  loadingText: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
  },
});
