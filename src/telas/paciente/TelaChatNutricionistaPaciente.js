import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getPatientDisplayName,
  getPatientId,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import { getNutritionistById } from '../../servicos/servicoNutricionistas';
import { listConsultasByPaciente } from '../../servicos/servicoConsultas';

function formatTimeNow() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'N';
}

function normalizeThreadItem(item, index, nutriName, patientName) {
  const role = item?.role === 'nutri' ? 'nutri' : 'user';
  return {
    id: item?.id || `thread-${role}-${index}`,
    author: item?.author || (role === 'nutri' ? nutriName : patientName),
    role,
    time: item?.time || formatTimeNow(),
    text: String(item?.text || '').trim(),
  };
}

function buildFallbackNutritionist(routeNutri, thread) {
  const threadNutri = (thread || []).find((item) => item?.role === 'nutri');
  const name =
    routeNutri?.nome_completo_nutri ||
    routeNutri?.nome_nutri ||
    threadNutri?.author ||
    'Nutricionista de acompanhamento';

  return {
    nome_completo_nutri: name,
    especialidade: routeNutri?.especialidade || 'Acompanhamento nutricional',
    crm_numero: routeNutri?.crm_numero || '',
    ...routeNutri,
  };
}

function selectAssignedConsulta(consultas) {
  const priority = {
    confirmed: 0,
    scheduled: 1,
    done: 2,
    no_show: 3,
    cancelled: 9,
  };

  return [...(consultas || [])]
    .filter((item) => item?.nutricionista_id && item?.status !== 'cancelled')
    .sort((left, right) => {
      const priorityDiff =
        (priority[left?.status] ?? 5) - (priority[right?.status] ?? 5);
      if (priorityDiff !== 0) return priorityDiff;
      return String(right?.scheduled_at || '').localeCompare(String(left?.scheduled_at || ''));
    })[0] || null;
}

function buildAutoReply(nutriName, patientFirstName) {
  const nutriFirstName =
    String(nutriName || 'Nutricionista').trim().split(/\s+/)[0] || 'Nutricionista';
  return `${patientFirstName}, recebi sua mensagem. Sou ${nutriFirstName} e vou revisar seu acompanhamento pelo chat.`;
}

export default function TelaChatNutricionistaPaciente({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
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
  const routeNutritionist = route?.params?.nutricionista || null;
  const patientName = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);
  const patientFirstName = useMemo(
    () => String(patientName || 'Paciente').trim().split(/\s+/)[0] || 'Paciente',
    [patientName]
  );
  const scrollRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [patient, setPatient] = useState(null);
  const [clinicalObjective, setClinicalObjective] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [nutritionist, setNutritionist] = useState(
    buildFallbackNutritionist(routeNutritionist, createDefaultAppState().nutritionistThread)
  );
  const [draft, setDraft] = useState('');

  useEffect(() => {
    navigation.setOptions({
      readerTitle: 'Chat com nutricionista',
    });

    return () => {
      navigation.setOptions({
        readerTitle: null,
      });
    };
  }, [navigation]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          if (!active) return;
          const fallbackThread = createDefaultAppState().nutritionistThread;
          setAppState(createDefaultAppState());
          setNutritionist(buildFallbackNutritionist(routeNutritionist, fallbackThread));
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
        });

        if (!active) return;

        setPatient(experience.patient || null);
        setClinicalObjective(experience.clinicalObjective || '');
        setAppState(experience.appState || createDefaultAppState());

        let resolvedNutritionist = routeNutritionist;
        const routeNutritionistId = routeNutritionist?.id_nutricionista_uuid;

        if (routeNutritionistId) {
          try {
            resolvedNutritionist = await getNutritionistById(routeNutritionistId);
          } catch (error) {
            console.log('Erro ao carregar nutricionista da rota:', error);
          }
        }

        if (!resolvedNutritionist && patientId) {
          try {
            const consultas = await listConsultasByPaciente(patientId, { limit: 40 });
            const assignedConsulta = selectAssignedConsulta(consultas);
            if (assignedConsulta?.nutricionista_id) {
              resolvedNutritionist = await getNutritionistById(assignedConsulta.nutricionista_id);
            }
          } catch (error) {
            console.log('Erro ao localizar nutricionista vinculada:', error);
          }
        }

        if (!active) return;

        setNutritionist(
          buildFallbackNutritionist(
            resolvedNutritionist,
            experience.appState?.nutritionistThread || createDefaultAppState().nutritionistThread
          )
        );
      } catch (error) {
        console.log('Erro ao carregar chat com nutricionista:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [canResolvePatient, patientId, routeNutritionist, usuarioLogado]);

  const messages = useMemo(() => {
    const source = appState?.nutritionistThread?.length
      ? appState.nutritionistThread
      : createDefaultAppState().nutritionistThread;

    const nutriName =
      nutritionist?.nome_completo_nutri || nutritionist?.nome_nutri || 'Nutricionista';

    return source
      .map((item, index) => normalizeThreadItem(item, index, nutriName, patientFirstName))
      .filter((item) => item.text);
  }, [appState?.nutritionistThread, nutritionist, patientFirstName]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  async function persistThread(nextThread, nextObjective = clinicalObjective) {
    const nextState = {
      ...appState,
      nutritionistThread: nextThread,
    };

    if (!canResolvePatient) {
      setAppState(nextState);
      return;
    }

    const saved = await savePatientAppState({
      patientId,
      objectiveText: nextObjective,
      appState: nextState,
      currentPatient: patient,
      patientContext: usuarioLogado,
    });

    setPatient(saved.patient || patient);
    setClinicalObjective(saved.clinicalObjective || nextObjective);
    setAppState(saved.appState || nextState);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    const nutriName =
      nutritionist?.nome_completo_nutri || nutritionist?.nome_nutri || 'Nutricionista';
    const now = formatTimeNow();
    const userMessage = {
      id: `user-${Date.now()}`,
      author: patientFirstName,
      role: 'user',
      time: now,
      text,
    };
    const replyMessage = {
      id: `nutri-${Date.now() + 1}`,
      author: nutriName,
      role: 'nutri',
      time: now,
      text: buildAutoReply(nutriName, patientFirstName),
    };
    const nextThread = [...messages, userMessage, replyMessage];

    try {
      setSending(true);
      setDraft('');
      await persistThread(nextThread);
    } catch (error) {
      console.log('Erro ao enviar mensagem para nutricionista:', error);
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  const nutritionistName =
    nutritionist?.nome_completo_nutri || nutritionist?.nome_nutri || 'Nutricionista';
  const nutritionistMeta = [
    nutritionist?.especialidade || 'Acompanhamento nutricional',
    nutritionist?.crm_numero ? `CRN ${nutritionist.crm_numero}` : '',
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Chat com sua nutricionista"
      subtitle="Converse diretamente com a profissional responsavel pelo seu acompanhamento."
      showTabBar={false}
      scrollEnabled={false}
      contentContainerStyle={styles.contentContainer}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Carregando conversa...</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(nutritionistName)}</Text>
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.headerName}>{nutritionistName}</Text>
                <Text style={styles.headerMeta}>{nutritionistMeta}</Text>
                <Text style={styles.headerHelper}>
                  Tire duvidas do plano, relate sintomas e receba orientacoes no acompanhamento.
                </Text>
              </View>
            </View>

            <View style={styles.chatCard}>
              <ScrollView
                ref={scrollRef}
                style={styles.messagesScroll}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((message) => {
                  const isMine = message.role === 'user';
                  return (
                    <View
                      key={message.id}
                      style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowNutri]}
                    >
                      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleNutri]}>
                        <Text style={[styles.bubbleAuthor, isMine && styles.bubbleAuthorMine]}>
                          {isMine ? 'Voce' : message.author}
                        </Text>
                        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                          {message.text}
                        </Text>
                        <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                          {message.time}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Escreva sua mensagem para a nutricionista"
                  placeholderTextColor={patientTheme.colors.textMuted}
                  multiline
                  maxLength={280}
                />
                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  activeOpacity={0.9}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
                  ) : (
                    <Ionicons name="send" size={18} color={patientTheme.colors.onPrimary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingBottom: 24,
  },
  keyboardWrap: {
    flex: 1,
    minHeight: 0,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginTop: 8,
    padding: 24,
    ...patientShadow,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    marginTop: 10,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 999,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
  },
  headerName: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerMeta: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  headerHelper: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  chatCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    ...patientShadow,
  },
  messagesScroll: {
    flex: 1,
    minHeight: 0,
  },
  messagesContent: {
    gap: 10,
    padding: patientTheme.spacing.card,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowNutri: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleNutri: {
    backgroundColor: patientTheme.colors.background,
  },
  bubbleMine: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  bubbleAuthor: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  bubbleAuthorMine: {
    color: patientTheme.colors.onPrimary,
  },
  bubbleText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: patientTheme.colors.onPrimary,
  },
  bubbleTime: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.82)',
  },
  inputRow: {
    alignItems: 'flex-end',
    borderTopColor: patientTheme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  input: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: patientTheme.colors.text,
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
});
