import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { useKeyboardHeight } from '../../componentes/comum/RolagemComTeclado';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  assistantQuickQuestions,
  sleepOptions,
  stressOptions,
  symptomOptions,
} from '../../dados/dadosExperienciaPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getCachedPatientExperience,
  getLatestGlucose,
  getPatientId,
  isPatientExperienceCacheFresh,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';

const assistantWelcome =
  'Analisei seus registros recentes para responder com base na sua glicose, alimentação, hidratação e bem-estar.';

const symptomLabelMap = Object.fromEntries(symptomOptions.map((item) => [item.id, item.label]));
const sleepLabelMap = Object.fromEntries(sleepOptions.map((item) => [item.id, item.label]));
const stressLabelMap = Object.fromEntries(stressOptions.map((item) => [String(item.id), item.label]));

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayMealEntries(mealEntries = []) {
  const today = getTodayDateString();
  return mealEntries.filter((entry) => !entry?.date || entry.date === today);
}

function formatSymptoms(symptomIds = []) {
  const labels = symptomIds.map((item) => symptomLabelMap[item]).filter(Boolean);
  if (!labels.length) return 'Sem sintomas registrados';
  return labels.join(', ');
}

function buildContextSummary({ currentGlucose, todayMealEntries, waterCount, lastSymptomEntry }) {
  const symptomText = lastSymptomEntry
    ? formatSymptoms(lastSymptomEntry.selectedSymptoms)
    : 'Sem check-in recente';

  return [
    {
      id: 'glucose',
      label: 'Glicose atual',
      value: `${currentGlucose} mg/dL`,
      helper: currentGlucose >= 140 ? 'Acima da meta' : currentGlucose <= 80 ? 'Atenção para queda' : 'Dentro da faixa esperada',
    },
    {
      id: 'meals',
      label: 'Refeições hoje',
      value: String(todayMealEntries.length),
      helper: todayMealEntries.length ? 'Registros encontrados hoje' : 'Nenhuma refeição registrada',
    },
    {
      id: 'water',
      label: 'Copos de água',
      value: String(Number(waterCount || 0)),
      helper: Number(waterCount || 0) >= 6 ? 'Boa hidratação' : 'Pode reforçar a hidratação',
    },
    {
      id: 'symptoms',
      label: 'Bem-estar',
      value: lastSymptomEntry?.sleep ? sleepLabelMap[lastSymptomEntry.sleep] || 'Registrado' : 'Sem registro',
      helper: symptomText,
    },
  ];
}

function buildDynamicAlerts({ currentGlucose, todayMealEntries, waterCount, lastMealEntry, lastSymptomEntry }) {
  const alerts = [];
  const stressLabel = stressLabelMap[String(lastSymptomEntry?.stress || '')];

  if (currentGlucose >= 180) {
    alerts.push({
      id: 'glucose-high',
      tag: 'Glicose',
      title: 'Leitura acima da meta',
      description: 'Sua glicose está elevada no momento. Priorize água, evite novo excesso de carboidrato e acompanhe a próxima leitura.',
    });
  } else if (currentGlucose <= 80) {
    alerts.push({
      id: 'glucose-low',
      tag: 'Glicose',
      title: 'Atenção para glicose em queda',
      description: 'A leitura atual pede atenção. Observe sintomas e siga sua orientação habitual caso perceba sinais de hipoglicemia.',
    });
  } else {
    alerts.push({
      id: 'glucose-steady',
      tag: 'Leitura',
      title: 'Glicose em faixa mais estável',
      description: 'A leitura atual está em uma zona mais segura. Vale manter refeições equilibradas e acompanhar a tendência ao longo do dia.',
    });
  }

  if (!todayMealEntries.length) {
    alerts.push({
      id: 'missing-meals',
      tag: 'Rotina',
      title: 'Ainda faltam registros de alimentação',
      description: 'Sem refeições registradas hoje, o assistente perde contexto. Registrar o próximo prato melhora os insights da tela.',
    });
  } else if (lastMealEntry?.summary) {
    alerts.push({
      id: 'latest-meal',
      tag: 'Refeição',
      title: 'Último registro encontrado',
      description: `${lastMealEntry.summary}. Esse contexto já está sendo usado nas próximas orientações.`,
    });
  }

  if (Number(waterCount || 0) < 4) {
    alerts.push({
      id: 'water-low',
      tag: 'Hidratação',
      title: 'Hidratação abaixo do ideal',
      description: 'Poucos copos de água foram registrados até agora. Aumentar a hidratação pode ajudar na rotina e no bem-estar geral.',
    });
  }

  if (stressLabel && lastSymptomEntry?.stress >= 3) {
    alerts.push({
      id: 'stress',
      tag: 'Bem-estar',
      title: `Nível de estresse: ${stressLabel}`,
      description: 'Seu último check-in mostrou estresse mais alto. Vale observar se isso está impactando fome, sono ou vontade de beliscar.',
    });
  }

  return alerts.slice(0, 3);
}

function buildPositiveMessage({ currentGlucose, todayMealEntries, waterCount, lastSymptomEntry }) {
  if (todayMealEntries.length >= 3 && currentGlucose >= 80 && currentGlucose <= 140) {
    return 'Hoje você já combinou registros consistentes com uma glicose em faixa mais estável. Esse padrão ajuda muito na leitura do seu progresso.';
  }

  if (Number(waterCount || 0) >= 6) {
    return 'Sua hidratação está bem encaminhada hoje. Esse cuidado costuma reforçar disposição e organização da rotina.';
  }

  if (lastSymptomEntry?.sleep === 'good' || lastSymptomEntry?.sleep === 'great') {
    return 'Seu último check-in mostrou uma noite melhor de sono. Esse é um bom sinal para sustentar escolhas mais consistentes ao longo do dia.';
  }

  return 'Mesmo com poucos registros, cada atualização no app melhora a qualidade dos próximos insights. Você já está construindo um acompanhamento mais útil.';
}

function buildSuggestedQuestions({ currentGlucose, todayMealEntries, lastMealEntry, lastSymptomEntry }) {
  const dynamicQuestions = [];

  if (currentGlucose >= 140) {
    dynamicQuestions.push('O que posso fazer agora para ajudar a baixar minha glicose?');
  } else if (currentGlucose <= 80) {
    dynamicQuestions.push('Minha glicose está baixa. Qual cuidado imediato faz sentido agora?');
  } else {
    dynamicQuestions.push('Minha glicose está boa agora. Como manter essa estabilidade?');
  }

  if (lastMealEntry?.summary) {
    dynamicQuestions.push(`A última refeição "${lastMealEntry.summary}" parece equilibrada?`);
  }

  if (!todayMealEntries.length) {
    dynamicQuestions.push('Ainda não registrei refeições hoje. Isso atrapalha meus insights?');
  }

  if (lastSymptomEntry?.stress >= 3) {
    dynamicQuestions.push('Meu estresse pode influenciar minha fome ou glicose hoje?');
  }

  return [...dynamicQuestions, ...assistantQuickQuestions].slice(0, 4);
}

function buildAssistantReply(question, context) {
  const text = String(question || '').trim().toLowerCase();
  const {
    currentGlucose,
    todayMealEntries,
    waterCount,
    lastMealEntry,
    lastSymptomEntry,
  } = context;

  if (!text) return '';

  if (text.includes('baix') || text.includes('alta') || text.includes('glicose')) {
    if (currentGlucose >= 180) {
      return `Sua leitura atual está em ${currentGlucose} mg/dL. O melhor próximo passo é hidratar-se, evitar exageros na próxima refeição e observar a próxima medição.`;
    }

    if (currentGlucose <= 80) {
      return `Sua leitura atual está em ${currentGlucose} mg/dL. Fique atento a sintomas e siga a orientação que você já recebeu para episódios de glicose baixa.`;
    }

    return `Sua glicose atual está em ${currentGlucose} mg/dL e parece mais estável agora. Tente manter a próxima refeição equilibrada para sustentar essa faixa.`;
  }

  if (text.includes('refei') || text.includes('café') || text.includes('cafe') || text.includes('jantar') || text.includes('almoço') || text.includes('almoco')) {
    if (lastMealEntry?.summary) {
      return `Seu último registro foi "${lastMealEntry.summary}". Para manter uma resposta melhor da glicose, vale combinar carboidrato com proteína, fibras e boa distribuição de porções.`;
    }

    return 'Ainda não encontrei uma refeição recente no seu histórico de hoje. Registrar o próximo prato ajuda bastante a personalizar a orientação.';
  }

  if (text.includes('água') || text.includes('agua') || text.includes('hidr')) {
    if (Number(waterCount || 0) >= 6) {
      return `Você já registrou ${waterCount} copos de água hoje. A hidratação está bem encaminhada; tente manter esse ritmo até o fim do dia.`;
    }

    return `Até agora vejo ${waterCount || 0} copos de água registrados. Vale aumentar um pouco a hidratação para reforçar sua rotina nas próximas horas.`;
  }

  if (text.includes('estresse') || text.includes('sono') || text.includes('cansa') || text.includes('ans')) {
    if (lastSymptomEntry) {
      const sleepLabel = sleepLabelMap[lastSymptomEntry.sleep] || 'sem padrão definido';
      const stressLabel = stressLabelMap[String(lastSymptomEntry.stress || '')] || 'sem registro de estresse';
      return `Seu último check-in mostrou sono ${sleepLabel.toLowerCase()} e estresse ${stressLabel.toLowerCase()}. Esse contexto pode influenciar fome, disposição e constância ao longo do dia.`;
    }

    return 'Ainda não encontrei um check-in recente de bem-estar. Registrar sono, sintomas e estresse deixa as orientações mais fiéis ao seu momento.';
  }

  if (todayMealEntries.length === 0) {
    return `Ainda não há refeições registradas hoje e sua glicose atual está em ${currentGlucose} mg/dL. Vale registrar alimentação e próximas leituras para eu conseguir orientar com mais contexto.`;
  }

  return `Com ${currentGlucose} mg/dL no momento, ${todayMealEntries.length} refeição(ões) registrada(s) hoje e ${waterCount || 0} copos de água, a recomendação mais segura agora é manter uma rotina equilibrada e acompanhar a próxima leitura.`;
}

export default function PacienteAssistenteScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const insets = useSafeAreaInsets();
  const chatModalKeyboardHeight = useKeyboardHeight();
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
  const [input, setInput] = useState('');
  const assistenteFetchLimits = useMemo(
    () => mesclarLimitesDadosPaciente('assistente'),
    []
  );
  const cachedAssistenteInicial = useMemo(
    () =>
      patientId ? getCachedPatientExperience(patientId, assistenteFetchLimits) : null,
    [patientId, assistenteFetchLimits]
  );
  const [loading, setLoading] = useState(!cachedAssistenteInicial);
  const [saving, setSaving] = useState(false);
  const [assistantChatVisible, setAssistantChatVisible] = useState(false);
  const [hideSuggestedQuestions, setHideSuggestedQuestions] = useState(false);
  const [patient, setPatient] = useState(cachedAssistenteInicial?.patient || null);
  const [objectiveText, setObjectiveText] = useState(
    cachedAssistenteInicial?.clinicalObjective || ''
  );
  const [appState, setAppState] = useState(
    cachedAssistenteInicial?.appState || createDefaultAppState()
  );
  const [glucoseReadings, setGlucoseReadings] = useState(
    cachedAssistenteInicial?.glucoseReadings || []
  );
  const chatScrollRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      readerRightAction: () => setAssistantChatVisible(true),
      readerRightIcon: 'chatbubble-ellipses-outline',
      readerRightAccessibilityLabel: 'Abrir chat do assistente',
    });

    return () => {
      navigation.setOptions({
        readerRightAction: undefined,
        readerRightIcon: undefined,
        readerRightAccessibilityLabel: undefined,
      });
    };
  }, [navigation, usuarioLogado]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          if (!active) return;
          setPatient(null);
          setObjectiveText('');
          setAppState(createDefaultAppState());
          setGlucoseReadings([]);
          return;
        }

        const cachedExperience = patientId
          ? getCachedPatientExperience(patientId, assistenteFetchLimits)
          : null;
        const cacheFresco =
          patientId && isPatientExperienceCacheFresh(patientId, assistenteFetchLimits);

        if (cachedExperience) {
          if (!active) return;
          setPatient(cachedExperience.patient);
          setObjectiveText(cachedExperience.clinicalObjective);
          setAppState(cachedExperience.appState);
          setGlucoseReadings(cachedExperience.glucoseReadings);

          if (cacheFresco) {
            return;
          }

          fetchPatientExperience(patientId, {
            patientContext: usuarioLogado,
            ...assistenteFetchLimits,
          })
            .then((experience) => {
              if (!active || !experience) return;
              setPatient(experience.patient);
              setObjectiveText(experience.clinicalObjective);
              setAppState(experience.appState);
              setGlucoseReadings(experience.glucoseReadings);
            })
            .catch((error) => console.log('Refresh assistente:', error));
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
          ...assistenteFetchLimits,
        });

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
  }, [assistenteFetchLimits, patientId, canResolvePatient, usuarioLogado]);

  const mealEntries = Array.isArray(appState?.mealEntries) ? appState.mealEntries : [];
  const todayMealEntries = useMemo(() => getTodayMealEntries(mealEntries), [mealEntries]);
  const lastMealEntry = todayMealEntries[0] || mealEntries[0] || null;
  const lastSymptomEntry = Array.isArray(appState?.symptomEntries) ? appState.symptomEntries[0] || null : null;
  const currentGlucose = getLatestGlucose(glucoseReadings)?.value || 105;
  const waterCount = Number(appState?.waterCount || 0);

  const defaultMessage = useMemo(
    () => [{ id: 'assistant-1', role: 'assistant', text: assistantWelcome }],
    []
  );
  const messages =
    appState.assistantMessages?.length > 0 ? appState.assistantMessages : defaultMessage;
  const shouldShowSuggestedQuestions = !hideSuggestedQuestions;
  const modalTopOffset = Math.max(insets.top + 58, 84);

  function scrollChatToBottom(animated = true) {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd?.({ animated });
    });
  }

  useEffect(() => {
    if (!assistantChatVisible) return;
    setHideSuggestedQuestions(false);
    scrollChatToBottom(false);
  }, [assistantChatVisible]);

  const summaryCards = useMemo(
    () =>
      buildContextSummary({
        currentGlucose,
        todayMealEntries,
        waterCount,
        lastSymptomEntry,
      }),
    [currentGlucose, todayMealEntries, waterCount, lastSymptomEntry]
  );

  const alerts = useMemo(
    () =>
      buildDynamicAlerts({
        currentGlucose,
        todayMealEntries,
        waterCount,
        lastMealEntry,
        lastSymptomEntry,
      }),
    [currentGlucose, todayMealEntries, waterCount, lastMealEntry, lastSymptomEntry]
  );

  const positiveMessage = useMemo(
    () =>
      buildPositiveMessage({
        currentGlucose,
        todayMealEntries,
        waterCount,
        lastSymptomEntry,
      }),
    [currentGlucose, todayMealEntries, waterCount, lastSymptomEntry]
  );

  const suggestedQuestions = useMemo(
    () =>
      buildSuggestedQuestions({
        currentGlucose,
        todayMealEntries,
        lastMealEntry,
        lastSymptomEntry,
      }),
    [currentGlucose, todayMealEntries, lastMealEntry, lastSymptomEntry]
  );

  async function sendQuestion(text) {
    const question = String(text || '').trim();
    if (!question || saving) return;
    setHideSuggestedQuestions(true);

    const reply = buildAssistantReply(question, {
      currentGlucose,
      todayMealEntries,
      waterCount,
      lastMealEntry,
      lastSymptomEntry,
    });

    const timestamp = Date.now();
    const nextMessages = [
      ...messages,
      { id: `user-${timestamp}`, role: 'user', text: question },
      {
        id: `assistant-${timestamp + 1}`,
        role: 'assistant',
        text: reply,
      },
    ];
    const nextState = {
      ...appState,
      assistantMessages: nextMessages,
    };

    setAppState(nextState);
    setInput('');
    scrollChatToBottom();

    try {
      setSaving(true);

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
    } catch (error) {
      console.log('Erro ao salvar conversa:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PatientScreenLayout
        navigation={navigation}
        route={route}
        usuarioLogado={usuarioLogado}
      >
        <View style={styles.summaryGrid}>
          {summaryCards.map((item) => (
            <View key={item.id} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryHelper}>{item.helper}</Text>
            </View>
          ))}
        </View>

        <View style={styles.alertCard}>
          <Text style={styles.sectionTitle}>Leituras do momento</Text>
          {alerts.map((alert) => (
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
            <Ionicons
              name="checkmark-circle-outline"
              size={22}
              color={patientTheme.colors.primaryDark}
            />
          </View>
          <View style={styles.positiveCopy}>
            <Text style={styles.positiveTitle}>Resumo positivo</Text>
            <Text style={styles.positiveText}>{positiveMessage}</Text>
          </View>
        </View>

      </PatientScreenLayout>

      <Modal
        animationType="slide"
        transparent
        visible={assistantChatVisible}
        onRequestClose={() => setAssistantChatVisible(false)}
      >
        <View
          style={[
            styles.chatModalOverlay,
            { paddingTop: modalTopOffset },
            chatModalKeyboardHeight > 0 ? { paddingBottom: chatModalKeyboardHeight } : null,
          ]}
        >
          <SafeAreaView style={styles.chatModalCard} edges={['bottom']}>
            <View style={styles.chatModalHeader}>
              <View style={styles.chatModalHeaderText}>
                <Text style={styles.chatModalTitle}>Chat do assistente</Text>
                <Text style={styles.chatModalSubtitle}>
                  Tire dúvidas rápidas com base nos seus registros.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.chatModalCloseButton}
                onPress={() => setAssistantChatVisible(false)}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.primaryDark} />
              </TouchableOpacity>
            </View>

            {shouldShowSuggestedQuestions ? (
              <>
                <Text style={styles.chatModalSectionTitle}>Perguntas sugeridas</Text>
                <View style={styles.quickQuestions}>
                  {suggestedQuestions.map((question) => (
                    <TouchableOpacity
                      key={`modal-question-${question}`}
                      style={styles.questionChip}
                      onPress={() => {
                        setHideSuggestedQuestions(true);
                        sendQuestion(question);
                      }}
                    >
                      <Text style={styles.questionChipText}>{question}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.chatModalConversationHeader}>
              <Text style={styles.chatTitle}>Conversa com o assistente</Text>
              {loading ? (
                <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
              ) : null}
            </View>

            <ScrollView
              ref={chatScrollRef}
              style={styles.chatModalBody}
              contentContainerStyle={[
                styles.chatModalBodyContent,
                chatModalKeyboardHeight > 0 ? { paddingBottom: 12 } : null,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollChatToBottom()}
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';

                return (
                  <View
                    key={`modal-${message.id}`}
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text style={[styles.messageText, isUser && styles.userBubbleText]}>
                      {message.text}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="Escreva sua dúvida"
                placeholderTextColor="#8a9095"
                value={input}
                onChangeText={setInput}
                onFocus={() => scrollChatToBottom()}
                editable={!saving}
              />
              <TouchableOpacity style={styles.sendButton} onPress={() => sendQuestion(input)}>
                {saving ? (
                  <ActivityIndicator color={patientTheme.colors.onPrimary} />
                ) : (
                  <Ionicons name="send" size={18} color={patientTheme.colors.onPrimary} />
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  summaryCard: {
    width: '47%',
    minHeight: 132,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  summaryLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryValue: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryHelper: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  alertCard: {
    marginTop: 12,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  alertItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
  },
  alertTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F3F6F8',
  },
  alertTagText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  alertTitle: {
    marginTop: 8,
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  alertText: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  positiveCard: {
    marginTop: 12,
    backgroundColor: '#F8FBFA',
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  positiveIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  positiveCopy: {
    flex: 1,
  },
  positiveTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  positiveText: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  quickQuestions: {
    marginTop: 12,
    gap: 8,
  },
  questionChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  questionChipText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  chatModalCard: {
    backgroundColor: patientTheme.colors.background,
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chatModalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  chatModalTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  chatModalSubtitle: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  chatModalSectionTitle: {
    marginBottom: 10,
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chatModalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  chatModalBody: {
    flex: 1,
    marginBottom: 12,
  },
  chatModalBodyContent: {
    paddingBottom: 8,
  },
  chatModalConversationHeader: {
    marginTop: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 16,
    marginBottom: 8,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F6F7F9',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: patientTheme.colors.primaryDark,
  },
  messageText: {
    color: patientTheme.colors.text,
    lineHeight: 19,
    fontSize: 13,
  },
  userBubbleText: {
    color: patientTheme.colors.onPrimary,
  },
  composer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 14,
    color: patientTheme.colors.text,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
