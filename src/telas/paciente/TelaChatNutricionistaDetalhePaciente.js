import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
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
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientTheme } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientNutritionistChat,
  getPatientDisplayName,
  getPatientId,
  savePatientNutritionistChat,
} from '../../servicos/servicoDadosPaciente';
import { getNutritionistById } from '../../servicos/servicoNutricionistas';
import { listConsultasByPaciente } from '../../servicos/servicoConsultas';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import { normalizeChatMessages, scrollChatToEnd } from '../../utilitarios/chatConversa';

const READER_BAR_HEIGHT = 58;

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
      const priorityDiff = (priority[left?.status] ?? 5) - (priority[right?.status] ?? 5);
      if (priorityDiff !== 0) return priorityDiff;
      return String(right?.scheduled_at || '').localeCompare(String(left?.scheduled_at || ''));
    })[0] || null;
}

export default function TelaChatNutricionistaDetalhePaciente({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const insets = useSafeAreaInsets();
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
  const hasLoadedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [patient, setPatient] = useState(null);
  const [clinicalObjective, setClinicalObjective] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [nutritionist, setNutritionist] = useState(
    buildFallbackNutritionist(routeNutritionist, [])
  );
  const [draft, setDraft] = useState('');

  useEffect(() => {
    navigation.setOptions({ readerTitle: 'Conversa' });
    return () => navigation.setOptions({ readerTitle: null });
  }, [navigation]);

  const load = useCallback(
    async ({ silent = false, forceRefresh = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        if (!canResolvePatient) {
          setAppState(createDefaultAppState());
          setNutritionist(buildFallbackNutritionist(routeNutritionist, []));
          return;
        }

        const experience = await fetchPatientNutritionistChat(patientId, {
          ...mesclarLimitesDadosPaciente('chat'),
          patientContext: usuarioLogado,
          forceRefresh,
        });

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

        if (!resolvedNutritionist?.id_nutricionista_uuid && patientId) {
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

        setNutritionist(
          buildFallbackNutritionist(
            resolvedNutritionist,
            experience.appState?.nutritionistThread || []
          )
        );
      } catch (error) {
        console.log('Erro ao carregar detalhe do chat do paciente:', error);
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [canResolvePatient, patientId, routeNutritionist, usuarioLogado]
  );

  useFocusEffect(
    useCallback(() => {
      load({ silent: hasLoadedRef.current, forceRefresh: false });
      hasLoadedRef.current = true;
      const intervalId = setInterval(() => {
        if (sending || draft.trim()) return;
        load({ silent: true, forceRefresh: false });
      }, 25000);
      return () => clearInterval(intervalId);
    }, [draft, load, sending])
  );

  const nutritionistName =
    nutritionist?.nome_completo_nutri || nutritionist?.nome_nutri || 'Nutricionista';

  const messages = useMemo(
    () =>
      normalizeChatMessages(appState?.nutritionistThread, {
        nutritionistName,
        patientName: patientFirstName,
      }),
    [appState?.nutritionistThread, nutritionistName, patientFirstName]
  );

  const scrollToLatestMessage = useCallback((animated = false) => {
    scrollChatToEnd(scrollRef, {
      animated,
      delays: animated ? [0, 80] : [0, 80, 200, 400],
    });
  }, []);

  useEffect(() => {
    if (loading || !messages.length) return undefined;

    const interaction = InteractionManager.runAfterInteractions(() => {
      scrollToLatestMessage(sending);
    });

    return () => interaction.cancel();
  }, [loading, messages.length, sending, scrollToLatestMessage]);

  async function persistThread(nextThread, outgoingMessage = null) {
    const nextState = { ...appState, nutritionistThread: nextThread };
    setAppState(nextState);

    if (!canResolvePatient) return;

    const saved = await savePatientNutritionistChat({
      patientId,
      thread: nextThread,
      actor: usuarioLogado,
      patientContext: usuarioLogado,
      newMessage: outgoingMessage
        ? { ...outgoingMessage, patientName: patientFirstName, nutritionistName }
        : null,
    });

    setPatient(saved.patient || patient);
    setClinicalObjective(saved.clinicalObjective || clinicalObjective);
    setAppState(saved.appState || nextState);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    const nextMessage = {
      id: `user-${Date.now()}`,
      author: patientFirstName,
      role: 'user',
      time: formatTimeNow(),
      text,
    };
    const nextThread = [...messages, nextMessage];

    try {
      setSending(true);
      setDraft('');
      await persistThread(nextThread, nextMessage);
    } catch (error) {
      console.log('Erro ao enviar mensagem para nutricionista:', error);
      setDraft(text);
      setAppState((current) => ({ ...current, nutritionistThread: messages }));
      Alert.alert('Nao foi possivel enviar', 'Tente novamente em alguns instantes.');
    } finally {
      setSending(false);
    }
  }

  const nutritionistMeta = [
    nutritionist?.especialidade || 'Acompanhamento nutricional',
    nutritionist?.crm_numero ? `CRN ${nutritionist.crm_numero}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const keyboardOffset = Platform.OS === 'ios' ? insets.top + READER_BAR_HEIGHT : 0;
  const inputBottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 14) : 18;

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={false}
      scrollEnabled={false}
      lockFixedContent
      contentContainerStyle={styles.contentContainer}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(nutritionistName)}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerName}>{nutritionistName}</Text>
            <Text style={styles.headerMeta}>{nutritionistMeta}</Text>
          </View>
          {refreshing ? (
            <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
          ) : null}
        </View>

        <View style={styles.chatCard}>
          {loading ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
              <Text style={styles.loadingText}>Carregando conversa...</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollRef}
                style={styles.messagesScroll}
                contentContainerStyle={[
                  styles.messagesContent,
                  !messages.length && styles.messagesContentEmpty,
                  messages.length > 0 && styles.messagesContentWithThread,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                nestedScrollEnabled
                bounces={Platform.OS === 'ios'}
                overScrollMode="never"
                onContentSizeChange={() => {
                  if (!loading && messages.length) {
                    scrollToLatestMessage(false);
                  }
                }}
                onLayout={() => {
                  if (!loading && messages.length) {
                    scrollToLatestMessage(false);
                  }
                }}
              >
                {!messages.length ? (
                  <View style={styles.emptyThread}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={40}
                      color={patientTheme.colors.border}
                    />
                    <Text style={styles.emptyThreadTitle}>Nenhuma mensagem ainda</Text>
                    <Text style={styles.emptyThreadText}>
                      Envie a primeira mensagem para sua nutricionista.
                    </Text>
                  </View>
                ) : (
                  messages.map((message) => {
                    const isMine = message.role === 'user';
                    return (
                      <View
                        key={message.id}
                        style={[
                          styles.messageRow,
                          isMine ? styles.messageRowMine : styles.messageRowNutri,
                        ]}
                      >
                        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleNutri]}>
                          {!isMine ? (
                            <Text style={styles.bubbleAuthor}>{message.author}</Text>
                          ) : null}
                          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                            {message.text}
                          </Text>
                          <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                            {message.time}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={[styles.inputRow, { paddingBottom: inputBottomPadding }]}>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Escreva sua mensagem..."
                    placeholderTextColor={patientTheme.colors.textMuted}
                    multiline
                    maxLength={500}
                    editable={!sending}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!draft.trim() || sending) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  activeOpacity={0.9}
                  disabled={!draft.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
                  ) : (
                    <Ionicons name="send" size={18} color={patientTheme.colors.onPrimary} />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </PatientScreenLayout>
  );
}

const CHAT_BORDER_COLOR = '#D8E2EA';

const chatPanelBorder = {
  backgroundColor: patientTheme.colors.background,
  borderColor: CHAT_BORDER_COLOR,
  borderWidth: 1,
};

const styles = StyleSheet.create({
  contentContainer: {
    backgroundColor: patientTheme.colors.background,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingBottom: 0,
    paddingTop: 4,
  },
  keyboardWrap: {
    backgroundColor: patientTheme.colors.background,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    width: '100%',
  },
  loadingInline: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    marginTop: 10,
  },
  headerCard: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...chatPanelBorder,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
  },
  headerName: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  headerMeta: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  chatCard: {
    borderRadius: patientTheme.radius.xl,
    flex: 1,
    marginBottom: 14,
    minHeight: 0,
    overflow: 'hidden',
    ...chatPanelBorder,
  },
  messagesScroll: {
    flex: 1,
    minHeight: 0,
  },
  messagesContent: {
    gap: 10,
    padding: 14,
    paddingBottom: 8,
  },
  messagesContentWithThread: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messagesContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyThread: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyThreadTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyThreadText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleNutri: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  bubbleAuthor: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  bubbleText: {
    color: patientTheme.colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: patientTheme.colors.onPrimary,
  },
  bubbleTime: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.82)',
  },
  inputRow: {
    alignItems: 'flex-end',
    backgroundColor: patientTheme.colors.background,
    borderTopColor: CHAT_BORDER_COLOR,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 10,
    marginTop: -14,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  inputWrap: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: CHAT_BORDER_COLOR,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 0,
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
