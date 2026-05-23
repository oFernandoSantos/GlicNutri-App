import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import { NUTRI_TAB_BAR_HEIGHT, NUTRI_TAB_BAR_SPACE } from '../../componentes/nutricionista/BarraAbasNutricionista';
import {
  AvatarBadge,
  RiskBadge,
  SearchInput,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';
import {
  buildNutritionistThreadPreview,
  fetchNutritionistChatSummariesByPatientIds,
  normalizeNutritionistThreadEntry,
  savePatientNutritionistChat,
} from '../../servicos/servicoDadosPaciente';
import {
  getNutritionistId,
  listPatientsByNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import { isChatCompactLayout, scrollChatToEnd } from '../../utilitarios/chatConversa';

function formatTimeNow() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildChatItems(patients, summariesById) {
  return (patients || []).map((patient) => {
    const summary = summariesById.get(patient.id) || {};
    const thread = summary.thread || [];
    const preview = buildNutritionistThreadPreview(thread);
    return {
      id: `chat-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      specialtyTag: patient.specialtyTag || patient.objective || 'Acompanhamento',
      bmi: patient.bmi,
      risk: patient.risk,
      unread: preview.unread,
      lastMessageAt: preview.lastMessageAt || patient.updatedAt || '',
      lastMessage: preview.lastMessage,
      messages: thread.map((item) =>
        normalizeNutritionistThreadEntry(item, {
          nutritionistName: 'Nutricionista',
          patientName: patient.name,
        })
      ),
      patient,
    };
  });
}

const CHAT_PAGE_SIZE = 10;
const READER_BAR_HEIGHT = 58;

export default function TelaMensagensNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = isChatCompactLayout(windowWidth);
  const preselectedPatientId = route?.params?.pacienteId || route?.params?.patientId || null;
  const preselectedChatId = route?.params?.chatId || null;
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);
  const scrollRef = useRef(null);
  const hasLoadedChatsRef = useRef(false);
  const showTabBar = route?.name === 'NutricionistaMensagens';
  const chatPanelHeight = useMemo(() => {
    const readerHeader = insets.top + READER_BAR_HEIGHT;
    const tabBarSpace = showTabBar ? NUTRI_TAB_BAR_HEIGHT + NUTRI_TAB_BAR_SPACE + 16 : 16;
    const available = windowHeight - readerHeader - insets.bottom - tabBarSpace;
    if (isCompact) {
      return Math.max(360, available);
    }
    return Math.max(420, available - 120);
  }, [insets.bottom, insets.top, isCompact, showTabBar, windowHeight]);

  const keyboardOffset = Platform.OS === 'ios' ? insets.top + READER_BAR_HEIGHT : 0;

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [visibleChatCount, setVisibleChatCount] = useState(CHAT_PAGE_SIZE);

  const loadChats = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setLoadError('');

      if (!nutricionistaId) {
        setChats([]);
        setActiveChatId(null);
        setLoadError('Nutricionista sem identificador para abrir o chat.');
        return;
      }

      const patients = await listPatientsByNutritionist(nutricionistaId);
      const summaries = await fetchNutritionistChatSummariesByPatientIds(
        patients.map((patient) => patient.id),
        nutricionistaId
      );
      const summariesById = new Map(
        summaries.map((item) => [item?.patient?.id_paciente_uuid, item])
      );
      const nextChats = buildChatItems(patients, summariesById);
      const preferredChatId =
        preselectedChatId ||
        (preselectedPatientId ? `chat-${preselectedPatientId}` : null);

      setChats(nextChats);
      if (!silent) {
        setVisibleChatCount(CHAT_PAGE_SIZE);
      }
      setActiveChatId((current) => {
        if (preferredChatId && nextChats.some((item) => item.id === preferredChatId)) {
          return preferredChatId;
        }
        if (current && nextChats.some((item) => item.id === current)) {
          return current;
        }
        if (isCompact) return null;
        return nextChats[0]?.id || null;
      });
    } catch (error) {
      console.log('Erro ao carregar conversas da nutricionista:', error);
      setLoadError('Nao foi possivel carregar as conversas agora.');
      setChats([]);
      setActiveChatId(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isCompact, nutricionistaId, preselectedChatId, preselectedPatientId]);

  useFocusEffect(
    React.useCallback(() => {
      loadChats({ silent: hasLoadedChatsRef.current });
      hasLoadedChatsRef.current = true;
      const intervalId = setInterval(() => loadChats({ silent: true }), 30000);
      return () => clearInterval(intervalId);
    }, [loadChats])
  );

  const filteredChats = useMemo(() => {
    const normalized = String(search || '').toLowerCase().trim();
    if (!normalized) return chats;

    return chats.filter((chat) => {
      return [chat.patientName, chat.specialtyTag, chat.lastMessage]
        .some((field) => String(field || '').toLowerCase().includes(normalized));
    });
  }, [search, chats]);

  const visibleChats = useMemo(() => {
    return filteredChats.slice(0, visibleChatCount);
  }, [filteredChats, visibleChatCount]);

  const activeChat = useMemo(() => {
    return filteredChats.find((item) => item.id === activeChatId) || null;
  }, [filteredChats, activeChatId]);

  const showListColumn = !isCompact || !activeChatId;
  const showThreadColumn = !isCompact || Boolean(activeChatId);

  const metrics = useMemo(() => {
    const total = chats.length;
    const unread = chats.filter((chat) => Number(chat.unread || 0) > 0).length;
    const read = total - unread;
    const today = chats.filter((chat) => {
      const label = String(chat.lastMessageAt || '').toLowerCase();
      return label.includes('hoje') || label === formatTimeNow();
    }).length;

    return [
      { id: 'total', icon: 'chatbubbles-outline', label: 'Total Conversas', value: total, helper: 'Pacientes com chat', tone: 'default' },
      { id: 'unread', icon: 'mail-unread-outline', label: 'Nao Lidas', value: unread, helper: 'Aguardando resposta', tone: unread ? 'danger' : 'default' },
      { id: 'read', icon: 'checkmark-done-outline', label: 'Lidas', value: read, helper: 'Conversas revisadas', tone: 'default' },
      { id: 'today', icon: 'today-outline', label: 'Hoje', value: today, helper: 'Atualizadas hoje', tone: 'default' },
    ];
  }, [chats]);

  const scrollThreadToLatest = useCallback((animated = false) => {
    scrollChatToEnd(scrollRef, {
      animated,
      delays: animated ? [0, 80] : [0, 80, 200, 400],
    });
  }, []);

  useEffect(() => {
    if (!activeChat?.messages?.length) return undefined;
    scrollThreadToLatest(false);
    return undefined;
  }, [activeChat?.id, activeChat?.messages?.length, scrollThreadToLatest]);

  async function handleSend() {
    const text = draft.trim();
    if (!activeChat || !text || sending) return;

    const nutritionistName =
      usuarioLogado?.nome_completo_nutri ||
      usuarioLogado?.nome_nutri ||
      usuarioLogado?.nome_completo ||
      'Nutricionista';
    const nextMessage = normalizeNutritionistThreadEntry(
      {
        id: `nutri-${Date.now()}`,
        author: nutritionistName,
        role: 'nutri',
        time: formatTimeNow(),
        text,
      },
      {
        nutritionistName,
        patientName: activeChat.patientName,
      }
    );
    const nextThread = [...(activeChat.messages || []), nextMessage];

    setChats((current) =>
      current.map((chat) => {
        if (chat.id !== activeChat.id) return chat;
        const preview = buildNutritionistThreadPreview(nextThread);
        return {
          ...chat,
          messages: nextThread,
          lastMessage: preview.lastMessage,
          lastMessageAt: preview.lastMessageAt,
          unread: 0,
        };
      })
    );

    try {
      setSending(true);
      setDraft('');

      const saved = await savePatientNutritionistChat({
        patientId: activeChat.patientId,
        thread: nextThread,
        actor: usuarioLogado,
        patientContext: activeChat.patient,
        newMessage: {
          ...nextMessage,
          nutritionistName,
          patientName: activeChat.patientName,
        },
      });

      const savedThread = ensureArray(saved?.appState?.nutritionistThread).length
        ? saved.appState.nutritionistThread
        : nextThread;

      setChats((current) =>
        current.map((chat) => {
          if (chat.id !== activeChat.id) return chat;
          const preview = buildNutritionistThreadPreview(savedThread);
          return {
            ...chat,
            messages: savedThread,
            lastMessage: preview.lastMessage,
            lastMessageAt: preview.lastMessageAt,
            unread: 0,
          };
        })
      );
    } catch (error) {
      console.log('Erro ao enviar resposta da nutricionista:', error);
      setDraft(text);
      await loadChats({ silent: true });
      Alert.alert('Nao foi possivel enviar', 'Confira o vinculo com o paciente e tente novamente.');
    } finally {
      setSending(false);
    }
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function handleLoadMoreChats() {
    if (visibleChatCount >= filteredChats.length) return;
    setVisibleChatCount((current) => Math.min(current + CHAT_PAGE_SIZE, filteredChats.length));
  }

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={showTabBar}
      scrollEnabled={false}
      lockFixedContent={isCompact && Boolean(activeChatId)}
      contentContainerStyle={styles.layoutContent}
    >
      <View style={[nutriDesktopStyles.pageGap, styles.pageGap]}>
        {!isCompact ? (
          <View style={styles.metricGrid}>
            {metrics.map((item) => (
              <SectionCard key={item.id} style={[styles.metricCell, styles.metricCardCustom]}>
                <Text style={styles.metricLabelCustom}>{item.label}</Text>
                <Text
                  style={[
                    styles.metricValueCustom,
                    item.id === 'unread' && styles.metricValueUnread,
                    item.id === 'read' && styles.metricValueRead,
                    item.id === 'today' && styles.metricValueToday,
                  ]}
                >
                  {item.value}
                </Text>
                <Text style={styles.metricHelperCustom}>{item.helper}</Text>
              </SectionCard>
            ))}
          </View>
        ) : null}

        <View style={[styles.chatRow, isCompact && styles.chatRowCompact]}>
        {showListColumn ? (
        <SectionCard style={[styles.listColumn, { height: chatPanelHeight }]}>
          <View style={styles.listHeader}>
            <Text style={styles.columnTitle}>Mensagens</Text>
            {metrics[1]?.value ? (
              <View style={styles.listUnreadBadge}>
                <Text style={styles.listUnreadBadgeText}>{metrics[1].value}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.listSearch}>
            <SearchInput value={search} onChangeText={setSearch} placeholder="Buscar conversa..." />
          </View>

          {loading ? (
            <View style={styles.feedbackCard}>
              <ActivityIndicator color={patientTheme.colors.primaryDark} />
              <Text style={styles.feedbackText}>Carregando conversas...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>{loadError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadChats} activeOpacity={0.9}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : !filteredChats.length ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>Nenhuma conversa encontrada</Text>
              <Text style={styles.feedbackText}>Ajuste a busca ou aguarde um paciente iniciar contato.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.chatListScroll}
              contentContainerStyle={styles.chatList}
              showsVerticalScrollIndicator={false}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const isNearBottom =
                  layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
                if (isNearBottom) {
                  handleLoadMoreChats();
                }
              }}
              scrollEventThrottle={16}
            >
              {visibleChats.map((chat) => {
                const selected = activeChat?.id === chat.id;
                return (
                  <TouchableOpacity
                    key={chat.id}
                    style={[styles.chatListItem, selected && styles.chatListItemActive]}
                    onPress={() => setActiveChatId(chat.id)}
                    activeOpacity={0.9}
                  >
                    <AvatarBadge name={chat.patientName} size={42} subtle />
                    <View style={styles.chatListCopy}>
                      <View style={styles.chatListTop}>
                        <Text style={styles.chatListName} numberOfLines={1}>{chat.patientName}</Text>
                        <Text style={styles.chatListTime}>{chat.lastMessageAt}</Text>
                      </View>
                      <Text style={styles.chatListPreview} numberOfLines={2}>{chat.lastMessage}</Text>
                    </View>
                    {chat.unread ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{chat.unread}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              {visibleChatCount < filteredChats.length ? (
                <View style={styles.chatListFooter}>
                  <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                </View>
              ) : null}
            </ScrollView>
          )}
        </SectionCard>
        ) : null}

        {showThreadColumn ? (
        <SectionCard style={[styles.threadColumn, { height: chatPanelHeight }]}>
          {activeChat ? (
            <KeyboardAvoidingView
              style={styles.threadKeyboardWrap}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={keyboardOffset}
            >
              <View style={styles.threadInner}>
              {isCompact ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setActiveChatId(null)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chevron-back" size={20} color={patientTheme.colors.primaryDark} />
                  <Text style={styles.backButtonText}>Conversas</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.threadHeader}>
                <View style={styles.threadIdentity}>
                  <AvatarBadge name={activeChat.patientName} size={52} />
                  <View style={styles.threadIdentityCopy}>
                    <Text style={styles.threadName}>{activeChat.patientName}</Text>
                    <Text style={styles.threadMeta}>
                      {activeChat.specialtyTag} {activeChat?.bmi ? `- IMC ${activeChat.bmi}` : ''}
                    </Text>
                    {activeChat?.risk ? <RiskBadge risk={`${activeChat.risk} risco`} /> : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.chartShortcut}
                  onPress={() =>
                    navigation.navigate('NutriProntuarioPaciente', {
                      usuarioLogado,
                      pacienteId: activeChat.patientId,
                      paciente: activeChat.patient,
                    })
                  }
                >
                  <Ionicons name="document-text-outline" size={18} color={patientTheme.colors.primaryDark} />
                  <Text style={styles.chartShortcutText}>Abrir prontuario</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.threadBody}
                contentContainerStyle={[
                  styles.threadBodyContent,
                  !(activeChat.messages || []).length && styles.threadBodyContentEmpty,
                  (activeChat.messages || []).length > 0 && styles.threadBodyContentFilled,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                nestedScrollEnabled
                bounces={Platform.OS === 'ios'}
                overScrollMode="never"
                onContentSizeChange={() => {
                  if ((activeChat.messages || []).length) {
                    scrollThreadToLatest(false);
                  }
                }}
                onLayout={() => {
                  if ((activeChat.messages || []).length) {
                    scrollThreadToLatest(false);
                  }
                }}
              >
                {!(activeChat.messages || []).length ? (
                  <View style={styles.emptyThread}>
                    <Text style={styles.emptyText}>Nenhuma mensagem nesta conversa ainda.</Text>
                  </View>
                ) : (
                  (activeChat.messages || []).map((message) => {
                    const mine = message.role === 'nutri';
                    return (
                      <View
                        key={message.id}
                        style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowPatient]}
                      >
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePatient]}>
                          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
                          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{message.time}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                <View style={styles.threadInputWrap}>
                  <TextInput
                    style={styles.threadInput}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Responder paciente"
                    placeholderTextColor={patientTheme.colors.textMuted}
                    multiline
                    maxLength={500}
                    editable={!sending}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
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
              </View>
            </KeyboardAvoidingView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={72} color={patientTheme.colors.border} />
              <Text style={styles.emptyTitle}>Selecione uma conversa</Text>
              <Text style={styles.emptyText}>Escolha um paciente na lista para ver as mensagens</Text>
            </View>
          )}
        </SectionCard>
        ) : null}
      </View>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  layoutContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  pageGap: {
    flex: 1,
    minHeight: 0,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCell: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    minWidth: 180,
    flexGrow: 1,
  },
  metricCardCustom: {
    minHeight: 78,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderRadius: patientTheme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.background,
    shadowColor: 'transparent',
    elevation: 0,
  },
  metricLabelCustom: {
    fontSize: 11,
    lineHeight: 14,
    color: patientTheme.colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  metricValueCustom: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 22,
    color: patientTheme.colors.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  metricHelperCustom: {
    height: 0,
    opacity: 0,
    marginTop: 0,
    fontSize: 0,
  },
  metricValueUnread: {
    color: patientTheme.colors.danger,
  },
  metricValueRead: {
    color: patientTheme.colors.primaryDark,
  },
  metricValueToday: {
    color: patientTheme.colors.primaryDark,
  },
  chatRow: {
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
  },
  chatRowCompact: {
    flexDirection: 'column',
  },
  listColumnFlex: {
    flex: 1,
    minHeight: 320,
  },
  threadColumnFlex: {
    flex: 1,
    minHeight: 320,
  },
  threadKeyboardWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  threadInner: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  backButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  listColumn: {
    flex: Platform.OS === 'web' ? 1 : 1,
    minWidth: 0,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.background,
    shadowColor: 'transparent',
    elevation: 0,
    overflow: 'hidden',
  },
  threadColumn: {
    flex: Platform.OS === 'web' ? 2 : 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.background,
    shadowColor: 'transparent',
    elevation: 0,
    overflow: 'hidden',
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: patientTheme.colors.text,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  listSearch: {
    marginTop: 14,
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  listUnreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.warning,
    paddingHorizontal: 6,
  },
  listUnreadBadgeText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  feedbackCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.lg,
    gap: 10,
    padding: 20,
    ...patientShadow,
  },
  feedbackTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  feedbackText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  chatListScroll: {
    flex: 1,
    minHeight: 0,
  },
  chatList: {
    gap: 0,
  },
  chatListFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 0,
    backgroundColor: patientTheme.colors.background,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
    shadowColor: 'transparent',
    elevation: 0,
  },
  chatListItemActive: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  chatListCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatListTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chatListName: {
    flex: 1,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  chatListTime: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '500',
  },
  chatListPreview: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    lineHeight: 18,
    fontSize: 12,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: patientTheme.colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
    fontSize: 10,
  },
  threadHeader: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexShrink: 0,
    justifyContent: 'space-between',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: patientTheme.colors.border,
  },
  threadIdentity: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  threadIdentityCopy: {
    flex: 1,
    gap: 6,
  },
  threadName: {
    fontSize: 20,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  threadMeta: {
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  chartShortcut: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: patientTheme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...patientShadow,
  },
  chartShortcutText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  threadBody: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 18,
  },
  threadBodyContent: {
    gap: 10,
    paddingBottom: 8,
  },
  threadBodyContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  threadBodyContentFilled: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyThread: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    paddingHorizontal: 16,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowPatient: {
    justifyContent: 'flex-start',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubblePatient: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  bubbleText: {
    color: patientTheme.colors.text,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  bubbleTime: {
    marginTop: 8,
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.85)',
  },
  inputRow: {
    flexShrink: 0,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#B0BEC8',
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  threadInputWrap: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: '#B0BEC8',
    borderRadius: 22,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 44,
    overflow: 'hidden',
  },
  threadInput: {
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 0,
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 12,
  },
});
