import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
  dashboardKpiStyles,
  DashboardKpiCard,
  KPI_ACCENTS,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';
import { supabase } from '../../servicos/configSupabase';
import {
  buildNutritionistThreadPreview,
  fetchNutritionistChatInboxForPatientIds,
  fetchNutritionistChatThreadForPatient,
  mapRealtimeChatRowToThreadEntry,
  mergeChatMessageIntoThread,
  normalizeNutritionistThreadEntry,
  savePatientNutritionistChat,
} from '../../servicos/servicoDadosPaciente';
import { fetchNutritionistChatSummary } from '../../servicos/servicoEscalaNutri';
import {
  fetchCachedNutriChatInbox,
  invalidateNutriChatInboxCache,
  replaceCachedPatientChat,
} from '../../servicos/cacheExperienciaPaciente';
import {
  getNutritionistId,
  listPatientsByNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import {
  bindChatEnterToSend,
  CHAT_REALTIME_BACKUP_POLL_MS,
  isChatCompactLayout,
  loadNutriChatReadAtForPatients,
  markNutriChatRead,
  resolveChatThreadReload,
  scrollChatToEnd,
} from '../../utilitarios/chatConversa';
import { garantirSessaoRpcClinicaComPerfil } from '../../servicos/servicoSessaoRpc';
import { carregarSessaoNutricionista } from '../../servicos/servicoSessaoNutricionista';
import RegistroChatContextCard from '../../componentes/comum/RegistroChatContextCard';
import RegistroChatReplyPreview from '../../componentes/comum/RegistroChatReplyPreview';
import {
  attachRegistroContextToThreadMessages,
  buildRegistroChatMessageFromContext,
  buildRegistroPresentationFromSnapshot,
  registroContextForChatMessage,
  resolveRegistroChatPresentation,
  stripRegistroMetaFromChatText,
} from '../../utilitarios/registrosProntuarioNutri';

function formatTimeNow() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function countUnreadInChatList(chatList = []) {
  return (chatList || []).reduce((sum, chat) => sum + Number(chat.unread || 0), 0);
}

function formatUnreadBadgeCount(value = 0) {
  const total = Math.max(0, Number(value) || 0);
  return total > 99 ? '99+' : String(total);
}

function sortChatsByRecency(items = []) {
  return [...items].sort((left, right) => {
    const rightTimestamp = new Date(right.lastMessageTimestamp || 0).getTime() || 0;
    const leftTimestamp = new Date(left.lastMessageTimestamp || 0).getTime() || 0;
    if (rightTimestamp !== leftTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    const unreadDiff = Number(right.unread || 0) - Number(left.unread || 0);
    if (unreadDiff !== 0) return unreadDiff;

    return String(left.patientName || '').localeCompare(String(right.patientName || ''));
  });
}

function applyThreadPreviewToChat(
  chat,
  thread = [],
  { threadLoaded = true, lastReadAt = null } = {}
) {
  const preview = buildNutritionistThreadPreview(thread, { lastReadAt });
  const lastEntry = thread[thread.length - 1] || null;

  return {
    ...chat,
    messages: thread,
    threadLoaded,
    lastMessage: preview.lastMessage,
    lastMessageAt: preview.lastMessageAt || chat.lastMessageAt,
    lastMessageTimestamp: lastEntry?.createdAt || chat.lastMessageTimestamp || new Date().toISOString(),
    unread: preview.unread,
  };
}

function buildChatItems(
  patients,
  summariesById,
  { preserveMessagesById, nutriReadAtByPatientId = {} } = {}
) {
  const items = (patients || []).map((patient) => {
    const summary = summariesById.get(patient.id) || {};
    const inboxThread = ensureArray(summary.thread);
    const preview =
      summary.preview ||
      buildNutritionistThreadPreview(inboxThread, {
        lastReadAt: nutriReadAtByPatientId[patient.id],
      });
    const lastMessageTimestamp = summary.lastMessageCreatedAt || null;
    const preserved = preserveMessagesById?.get(patient.id);
    const seedMessages =
      preserved?.messages?.length > 0 ? preserved.messages : inboxThread;
    const hasCachedThread = seedMessages.length > 0;

    return {
      id: `chat-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      specialtyTag: patient.specialtyTag || patient.objective || 'Acompanhamento',
      bmi: patient.bmi,
      risk: patient.risk,
      unread: preview.unread,
      lastMessageAt: preview.lastMessageAt || patient.updatedAt || '',
      lastMessageTimestamp,
      lastMessage: preview.lastMessage,
      messages: seedMessages,
      threadLoaded: Boolean(preserved?.threadLoaded) || hasCachedThread,
      lastReadAt: nutriReadAtByPatientId[patient.id] || null,
      patient,
    };
  });

  return sortChatsByRecency(items);
}

function mergeChatsWithLocalState(currentChats, nextChats) {
  const currentById = new Map((currentChats || []).map((chat) => [chat.id, chat]));

  const merged = (nextChats || []).map((chat) => {
    const current = currentById.get(chat.id);
    if (!current) return chat;

    const currentMessages = Array.isArray(current.messages) ? current.messages : [];
    const nextMessages = Array.isArray(chat.messages) ? chat.messages : [];
    const currentTs = new Date(current.lastMessageTimestamp || 0).getTime() || 0;
    const nextTs = new Date(chat.lastMessageTimestamp || 0).getTime() || 0;
    const currentIsNewer = currentTs > nextTs;

    const keepLocalThread =
      current.threadLoaded &&
      currentMessages.length > 0 &&
      (currentMessages.length > nextMessages.length || currentIsNewer);

    if (keepLocalThread) {
      return applyThreadPreviewToChat(
        {
          ...chat,
          messages: currentMessages,
          threadLoaded: true,
        },
        currentMessages,
        { lastReadAt: current.lastReadAt || chat.lastReadAt }
      );
    }

    if (currentIsNewer && current.lastMessage) {
      return {
        ...chat,
        lastMessage: current.lastMessage,
        lastMessageAt: current.lastMessageAt,
        lastMessageTimestamp: current.lastMessageTimestamp,
        unread: Math.max(Number(chat.unread || 0), Number(current.unread || 0)),
      };
    }

    return chat;
  });

  return sortChatsByRecency(merged);
}

const CHAT_PAGE_SIZE = 10;
const INBOX_PREVIEW_BATCH = 40;
const READER_BAR_HEIGHT = 58;

export default function TelaMensagensNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = isChatCompactLayout(windowWidth);
  const preselectedPatientId = route?.params?.pacienteId || route?.params?.patientId || null;
  const preselectedChatId = route?.params?.chatId || null;
  const routeRegistroContext = route?.params?.registroContext || null;
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);
  const [nutriSessaoPersistida, setNutriSessaoPersistida] = useState(null);

  useEffect(() => {
    let active = true;
    carregarSessaoNutricionista()
      .then((sessao) => {
        if (active) setNutriSessaoPersistida(sessao || null);
      })
      .catch(() => {
        if (active) setNutriSessaoPersistida(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const scrollRef = useRef(null);
  const hasLoadedChatsRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const threadRequestRef = useRef(0);
  const threadLoadThrottleRef = useRef(new Map());
  const patientsRef = useRef([]);
  const chatsRef = useRef([]);
  const activeChatIdRef = useRef(null);
  const nutriReadAtRef = useRef({});
  const [nutriReadAtByPatientId, setNutriReadAtByPatientId] = useState({});
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
  const [inboxRefreshing, setInboxRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [visibleChatCount, setVisibleChatCount] = useState(CHAT_PAGE_SIZE);
  const [threadLoading, setThreadLoading] = useState(false);
  const [pendingRegistro, setPendingRegistro] = useState(routeRegistroContext);
  const [inboxPreviewLoadedCount, setInboxPreviewLoadedCount] = useState(0);
  const [chatSummaryMetrics, setChatSummaryMetrics] = useState({
    total: 0,
    unread: 0,
    today: 0,
  });
  const patientsByIdRef = useRef(new Map());
  const draftRef = useRef('');
  const sendingRef = useRef(false);
  const scheduleInboxRefreshRef = useRef(() => {});

  useEffect(() => {
    if (routeRegistroContext) {
      setPendingRegistro(routeRegistroContext);
      if (preselectedPatientId) {
        setActiveChatId(`chat-${preselectedPatientId}`);
      }
    }
  }, [preselectedPatientId, routeRegistroContext]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    nutriReadAtRef.current = nutriReadAtByPatientId;
  }, [nutriReadAtByPatientId]);

  const mergeInboxPreviews = useCallback((patients, summaries, readAtOverride = null) => {
    const summariesById = new Map(
      (summaries || []).map((item) => [item?.patient?.id_paciente_uuid, item])
    );
    const preserveMessagesById = new Map(
      (chatsRef.current || [])
        .filter((chat) => chat.threadLoaded && (chat.messages || []).length)
        .map((chat) => [chat.patientId, { messages: chat.messages, threadLoaded: true }])
    );
    const readAtMap = readAtOverride || nutriReadAtRef.current;

    return sortChatsByRecency(
      buildChatItems(patients, summariesById, {
        preserveMessagesById,
        nutriReadAtByPatientId: readAtMap,
      })
    );
  }, []);

  const buildChatRpcActor = useCallback(() => {
    const base = nutriSessaoPersistida || usuarioLogado || {};
    const resolvedNutriId =
      nutricionistaId || getNutritionistId(base) || getNutritionistId(usuarioLogado);
    const email =
      base?.email_acesso ||
      usuarioLogado?.email_acesso ||
      base?.email ||
      usuarioLogado?.email ||
      base?.email_nutri ||
      usuarioLogado?.email_nutri ||
      '';
    return {
      tipo_perfil: 'nutricionista',
      id_nutricionista_uuid: resolvedNutriId,
      email_acesso: email,
      email,
    };
  }, [nutriSessaoPersistida, nutricionistaId, usuarioLogado]);

  const ensureChatRpcSession = useCallback(async () => {
    const rpcActor = buildChatRpcActor();
    if (!rpcActor.id_nutricionista_uuid) {
      throw new Error('Nutricionista sem identificador para abrir o chat.');
    }

    const token = await garantirSessaoRpcClinicaComPerfil(rpcActor);
    if (!token) {
      throw new Error(
        'Sessao clinica ausente. Saia do app e faca login novamente para usar o chat.'
      );
    }

    return rpcActor;
  }, [buildChatRpcActor]);

  const loadInboxPreviewsForPatients = useCallback(
    async (patients, { fromIndex = 0, count = INBOX_PREVIEW_BATCH, rpcActor = null } = {}) => {
      if (!nutricionistaId || !patients?.length) return;

      const slice = patients.slice(fromIndex, fromIndex + count);
      const patientIds = slice.map((patient) => patient.id);
      if (!patientIds.length) return;

      const sessionActor = rpcActor || buildChatRpcActor();

      const [summaries, readMap] = await Promise.all([
        fetchCachedNutriChatInbox(nutricionistaId, patientIds, () =>
          fetchNutritionistChatInboxForPatientIds(
            patientIds,
            nutricionistaId,
            patientsByIdRef.current,
            sessionActor
          )
        ),
        loadNutriChatReadAtForPatients(nutricionistaId, patientIds),
      ]);

      if (Object.keys(readMap).length) {
        setNutriReadAtByPatientId((current) => ({ ...current, ...readMap }));
      }

      setChats((current) => {
        const mergedPatients = patientsRef.current || patients;
        const mergedReadAt = { ...nutriReadAtRef.current, ...readMap };
        const merged = mergeChatsWithLocalState(
          current,
          mergeInboxPreviews(mergedPatients, summaries, mergedReadAt)
        );
        const unreadFromChats = countUnreadInChatList(merged);
        setChatSummaryMetrics((prev) => ({
          ...prev,
          unread: Math.max(Number(prev.unread || 0), unreadFromChats),
        }));
        return merged;
      });
      setInboxPreviewLoadedCount((current) => Math.max(current, fromIndex + patientIds.length));
    },
    [buildChatRpcActor, mergeInboxPreviews, nutricionistaId]
  );

  const loadInbox = useCallback(
    async ({ silent = false, bustCache = false } = {}) => {
      let shellChats = [];

      try {
        if (!silent) setLoading(true);
        setLoadError('');

        if (!nutricionistaId) {
          setChats([]);
          setActiveChatId(null);
          setLoadError('Nutricionista sem identificador para abrir o chat.');
          return;
        }

        let rpcActor = null;
        let sessionLoadError = '';

        try {
          rpcActor = await ensureChatRpcSession();
        } catch (sessionError) {
          sessionLoadError =
            sessionError?.message ||
            'Sessao clinica ausente. Saia do app e faca login novamente.';
          console.log('Sessao RPC do chat (nutri):', sessionLoadError);
        }

        if (bustCache) {
          invalidateNutriChatInboxCache(nutricionistaId);
          setInboxPreviewLoadedCount(0);
        }

        let patients = [];

        try {
          patients = await listPatientsByNutritionist(nutricionistaId);
        } catch (patientError) {
          console.log('Erro ao listar pacientes do chat:', patientError);
        }

        const summary = await fetchNutritionistChatSummary(nutricionistaId);

        patientsRef.current = patients;
        patientsByIdRef.current = new Map((patients || []).map((patient) => [patient.id, patient]));
        setChatSummaryMetrics({
          total: Number(summary?.totalConversas || patients.length),
          unread: Number(summary?.naoLidas || 0),
          today: Number(summary?.atualizadasHoje || 0),
        });

        const preserveMessagesById = new Map(
          (chatsRef.current || [])
            .filter((chat) => chat.threadLoaded && (chat.messages || []).length)
            .map((chat) => [chat.patientId, { messages: chat.messages, threadLoaded: true }])
        );

        shellChats = sortChatsByRecency(
          buildChatItems(patients, new Map(), { preserveMessagesById })
        );
        const preferredChatId =
          preselectedChatId ||
          (preselectedPatientId ? `chat-${preselectedPatientId}` : null);

        setChats((current) => mergeChatsWithLocalState(current, shellChats));

        if (sessionLoadError) {
          setLoadError(sessionLoadError);
        } else if (!patients.length) {
          setLoadError('Nenhum paciente vinculado para exibir conversas.');
        } else {
          setLoadError('');
        }

        if (!silent) {
          setVisibleChatCount(CHAT_PAGE_SIZE);
          setLoading(false);
        }

        if (patients.length && rpcActor) {
          try {
            const initialPreviewCount = Math.min(patients.length, INBOX_PREVIEW_BATCH);
            await loadInboxPreviewsForPatients(patients, {
              fromIndex: 0,
              count: initialPreviewCount,
              rpcActor,
            });
          } catch (previewError) {
            console.log('Erro ao carregar preview do chat:', previewError);
            if (!sessionLoadError) {
              setLoadError(
                'Lista de pacientes carregada, mas o historico do chat falhou. Toque em Tentar novamente.'
              );
            }
          }
        }

        setActiveChatId((current) => {
          if (preferredChatId && shellChats.some((item) => item.id === preferredChatId)) {
            return preferredChatId;
          }
          if (current && shellChats.some((item) => item.id === current)) {
            return current;
          }
          if (isCompact) return null;
          return shellChats[0]?.id || null;
        });
      } catch (error) {
        console.log('Erro ao carregar conversas da nutricionista:', error);
        setLoadError(
          String(error?.message || '').trim() ||
            'Nao foi possivel carregar as conversas agora.'
        );
        if (!shellChats.length) {
          setChats([]);
          setActiveChatId(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [
      ensureChatRpcSession,
      isCompact,
      loadInboxPreviewsForPatients,
      nutricionistaId,
      preselectedChatId,
      preselectedPatientId,
    ]
  );

  const loadActiveThread = useCallback(
    async (patientId, { silent = false } = {}) => {
      if (!patientId || !nutricionistaId) return;

      if (silent) {
        const lastLoadAt = threadLoadThrottleRef.current.get(patientId) || 0;
        if (Date.now() - lastLoadAt < 2000) return;
        threadLoadThrottleRef.current.set(patientId, Date.now());
      }

      const requestId = threadRequestRef.current + 1;
      threadRequestRef.current = requestId;

      if (!silent) setThreadLoading(true);

      try {
        const activeSnapshot =
          chatsRef.current.find((chat) => chat.patientId === patientId) || null;
        const patientName = activeSnapshot?.patientName || 'Paciente';
        const rpcActor = buildChatRpcActor();

        await ensureChatRpcSession();

        const fetched = await fetchNutritionistChatThreadForPatient(patientId, nutricionistaId, {
          patientName,
          rpcActor,
          limit: 200,
        });
        const messages =
          Array.isArray(fetched) && fetched.some((item) => item?.registroContext?.type)
            ? fetched
            : attachRegistroContextToThreadMessages(
                fetched,
                activeSnapshot?.messages || []
              );

        if (threadRequestRef.current !== requestId) return;

        const viewingActive =
          activeChatIdRef.current &&
          chatsRef.current.find((chat) => chat.id === activeChatIdRef.current)?.patientId ===
            patientId;
        let readAt = nutriReadAtRef.current[patientId] || null;

        if (viewingActive && nutricionistaId) {
          readAt = (await markNutriChatRead(nutricionistaId, patientId)) || readAt;
          if (readAt) {
            setNutriReadAtByPatientId((current) => ({ ...current, [patientId]: readAt }));
          }
        }

        const mergedMessages = resolveChatThreadReload(
          ensureArray(activeSnapshot?.messages),
          ensureArray(messages)
        );

        setChats((current) =>
          sortChatsByRecency(
            current.map((chat) => {
              if (chat.patientId !== patientId) return chat;
              return applyThreadPreviewToChat(chat, mergedMessages, {
                threadLoaded: true,
                lastReadAt: viewingActive ? readAt : chat.lastReadAt,
              });
            })
          )
        );
      } catch (error) {
        console.log('Erro ao carregar thread do paciente:', error);
        if (threadRequestRef.current === requestId) {
          setChats((current) =>
            current.map((chat) => {
              if (chat.patientId !== patientId) return chat;
              const existing = ensureArray(chat.messages);
              if (existing.length) {
                return { ...chat, threadLoaded: true };
              }
              return applyThreadPreviewToChat(chat, existing, { threadLoaded: false });
            })
          );
        }
      } finally {
        if (threadRequestRef.current === requestId) {
          setThreadLoading(false);
        }
      }
    },
    [buildChatRpcActor, ensureChatRpcSession, nutricionistaId]
  );

  const scheduleInboxRefresh = useCallback(
    (patientId = null) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(async () => {
        if (patientId) {
          const patients = patientsRef.current || [];
          const index = patients.findIndex((patient) => patient.id === patientId);
          if (index >= 0) {
            await loadInboxPreviewsForPatients(patients, {
              fromIndex: index,
              count: 1,
            });
          }
          loadActiveThread(patientId, { silent: true });
          fetchNutritionistChatSummary(nutricionistaId).then((summary) => {
            setChatSummaryMetrics({
              total: Number(summary?.totalConversas || patientsRef.current.length),
              unread: Number(summary?.naoLidas || 0),
              today: Number(summary?.atualizadasHoje || 0),
            });
          });
          return;
        }

        loadInbox({ silent: true, bustCache: true });
      }, 500);
    },
    [loadActiveThread, loadInbox, loadInboxPreviewsForPatients, nutricionistaId]
  );

  useEffect(() => {
    scheduleInboxRefreshRef.current = scheduleInboxRefresh;
  }, [scheduleInboxRefresh]);

  useFocusEffect(
    React.useCallback(() => {
      loadInbox({ silent: hasLoadedChatsRef.current });
      hasLoadedChatsRef.current = true;
      return () => {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
      };
    }, [loadInbox])
  );

  useEffect(() => {
    if (!isCompact) {
      navigation.setOptions({ readerBackAction: undefined });
      return undefined;
    }

    navigation.setOptions({
      readerBackAction: activeChatId ? () => setActiveChatId(null) : undefined,
    });

    return () => navigation.setOptions({ readerBackAction: undefined });
  }, [activeChatId, isCompact, navigation]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isCompact && activeChatId) {
        setActiveChatId(null);
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [activeChatId, isCompact]);

  useEffect(() => {
    if (!nutricionistaId) return undefined;

    const channel = supabase
      .channel(`nutritionist-chat-${nutricionistaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagem_chat',
          filter: `nutricionista_id=eq.${nutricionistaId}`,
        },
        (payload) => {
          const row = payload?.new;
          const patientId = row?.paciente_id || payload?.old?.paciente_id || null;
          if (row?.texto && patientId && payload?.eventType === 'INSERT') {
            const activeChat = chatsRef.current.find(
              (chat) => chat.id === activeChatIdRef.current
            );
            const listChat =
              chatsRef.current.find((chat) => chat.patientId === patientId) || activeChat;
            const entry = mapRealtimeChatRowToThreadEntry(
              row,
              listChat?.patientName || 'Paciente',
              {
                nutritionistName:
                  usuarioLogado?.nome_completo_nutri ||
                  usuarioLogado?.nome_nutri ||
                  'Nutricionista',
              }
            );

            if (entry) {
              if (sendingRef.current && entry.role === 'nutri') {
                return;
              }

              const viewingThread = activeChat?.patientId === patientId;
              if (viewingThread && entry.role === 'user' && nutricionistaId) {
                markNutriChatRead(nutricionistaId, patientId).then((readAt) => {
                  if (!readAt) return;
                  setNutriReadAtByPatientId((current) => ({ ...current, [patientId]: readAt }));
                });
              }

              setChats((current) =>
                sortChatsByRecency(
                  current.map((chat) => {
                    if (chat.patientId !== patientId) return chat;
                    const nextThread = mergeChatMessageIntoThread(chat.messages || [], entry);
                    const lastReadAt =
                      viewingThread && entry.role === 'user'
                        ? new Date().toISOString()
                        : chat.lastReadAt;
                    return applyThreadPreviewToChat(
                      { ...chat, threadLoaded: true, lastReadAt },
                      nextThread,
                      { lastReadAt }
                    );
                  })
                )
              );

              if (!sendingRef.current) {
                scheduleInboxRefreshRef.current(patientId);
              }
              return;
            }
          }

          if (!sendingRef.current && !draftRef.current.trim()) {
            scheduleInboxRefreshRef.current(patientId);
          } else if (patientId) {
            loadActiveThread(patientId, { silent: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadActiveThread, nutricionistaId, usuarioLogado]);

  useEffect(() => {
    const activeChat = chatsRef.current.find((chat) => chat.id === activeChatId);
    const patientId = activeChat?.patientId;
    if (!patientId) return undefined;

    const hasCachedMessages = (activeChat?.messages || []).length > 0;
    loadActiveThread(patientId, { silent: hasCachedMessages });

    return undefined;
  }, [activeChatId, loadActiveThread]);

  useFocusEffect(
    useCallback(() => {
      const activeChat = chatsRef.current.find((chat) => chat.id === activeChatIdRef.current);
      if (!activeChat?.patientId || !nutricionistaId) return undefined;

      if (!sendingRef.current) {
        loadActiveThread(activeChat.patientId, { silent: true });
      }
      return undefined;
    }, [activeChatId, loadActiveThread, nutricionistaId])
  );

  useEffect(() => {
    const activeChat = chatsRef.current.find((chat) => chat.id === activeChatId);
    const patientId = activeChat?.patientId;
    if (!patientId || !nutricionistaId) return undefined;

    const intervalId = setInterval(() => {
      if (sendingRef.current) return;
      loadActiveThread(patientId, { silent: true });
    }, CHAT_REALTIME_BACKUP_POLL_MS);

    return () => clearInterval(intervalId);
  }, [activeChatId, loadActiveThread, nutricionistaId]);

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

  const listUnreadCount = useMemo(
    () => Math.max(Number(chatSummaryMetrics.unread || 0), countUnreadInChatList(chats)),
    [chatSummaryMetrics.unread, chats]
  );

  const metrics = useMemo(() => {
    const total = chatSummaryMetrics.total || chats.length;
    const unread = listUnreadCount;
    const read = Math.max(0, total - unread);
    const today = chatSummaryMetrics.today;

    return [
      { id: 'total', icon: 'chatbubbles-outline', label: 'Total Conversas', value: String(total), accent: KPI_ACCENTS.blue },
      { id: 'unread', icon: 'mail-unread-outline', label: 'Nao Lidas', value: formatUnreadBadgeCount(unread), accent: KPI_ACCENTS.red },
      { id: 'read', icon: 'checkmark-done-outline', label: 'Lidas', value: String(read), accent: KPI_ACCENTS.green },
      { id: 'today', icon: 'today-outline', label: 'Hoje', value: String(today), accent: KPI_ACCENTS.orange },
    ];
  }, [chatSummaryMetrics, chats.length, listUnreadCount]);

  const handleSelectChat = useCallback(
    async (chatId) => {
      setActiveChatId(chatId);
      const selected = chatsRef.current.find((chat) => chat.id === chatId);
      let readAt = selected?.lastReadAt || null;

      if (selected?.patientId && nutricionistaId) {
        readAt = (await markNutriChatRead(nutricionistaId, selected.patientId)) || readAt;
        if (readAt) {
          setNutriReadAtByPatientId((current) => ({
            ...current,
            [selected.patientId]: readAt,
          }));
        }
      }

      setChats((current) => {
        const next = sortChatsByRecency(
          current.map((chat) => {
            if (chat.id !== chatId) return chat;
            return applyThreadPreviewToChat(
              { ...chat, lastReadAt: readAt },
              chat.messages || [],
              { lastReadAt: readAt }
            );
          })
        );
        const unreadFromChats = countUnreadInChatList(next);
        setChatSummaryMetrics((prev) => ({
          ...prev,
          unread: unreadFromChats,
        }));
        return next;
      });
    },
    [nutricionistaId]
  );

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

  const nutritionistName = useMemo(
    () =>
      usuarioLogado?.nome_completo_nutri ||
      usuarioLogado?.nome_nutri ||
      usuarioLogado?.nome_completo ||
      'Nutricionista',
    [usuarioLogado]
  );

  const appendAndPersistMessage = useCallback(
    async (text, chatId, threadOverride = null, { registroContext = null } = {}) => {
      const trimmed = String(text || '').trim();
      const chatSnapshot = chatsRef.current.find((chat) => chat.id === chatId);
      if (!trimmed || !chatSnapshot) {
        throw new Error('Conversa indisponivel para enviar mensagem.');
      }

      const rpcActor = buildChatRpcActor();
      if (!rpcActor.id_nutricionista_uuid) {
        throw new Error('Nutricionista sem identificador para enviar mensagem.');
      }

      const baseThread = ensureArray(threadOverride || chatSnapshot.messages);
      const sentAt = new Date().toISOString();
      const parsedForContext = resolveRegistroChatPresentation({ text: trimmed });
      const snapshotPresentation = registroContext
        ? buildRegistroPresentationFromSnapshot(registroContext)
        : null;
      const registroPayload = snapshotPresentation
        ? registroContextForChatMessage(
            snapshotPresentation,
            parsedForContext?.comment || snapshotPresentation.comment || ''
          )
        : parsedForContext
          ? registroContextForChatMessage(parsedForContext, parsedForContext.comment)
          : null;
      const nextMessage = {
        ...normalizeNutritionistThreadEntry(
          {
            id: `nutri-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            author: nutritionistName,
            role: 'nutri',
            time: formatTimeNow(),
            text: trimmed,
            texto_bruto: trimmed,
            registroContext: registroPayload,
          },
          {
            nutritionistName,
            patientName: chatSnapshot.patientName,
          }
        ),
        createdAt: sentAt,
      };
      const optimisticThread = [...baseThread, nextMessage];

      setChats((current) =>
        sortChatsByRecency(
          current.map((chat) => {
            if (chat.id !== chatSnapshot.id) return chat;
            return applyThreadPreviewToChat(
              { ...chat, threadLoaded: true },
              optimisticThread
            );
          })
        )
      );

      await ensureChatRpcSession();

      const saved = await savePatientNutritionistChat({
        patientId: chatSnapshot.patientId,
        thread: optimisticThread,
        actor: {
          ...rpcActor,
          id_nutricionista_uuid: nutricionistaId || rpcActor.id_nutricionista_uuid,
        },
        patientContext: chatSnapshot.patient?.raw || chatSnapshot.patient,
        newMessage: {
          ...nextMessage,
          nutritionistName,
          patientName: chatSnapshot.patientName,
        },
      });

      const savedThread = ensureArray(saved?.appState?.nutritionistThread).length
        ? saved.appState.nutritionistThread
        : optimisticThread;

      const normalizedThread = attachRegistroContextToThreadMessages(
        savedThread.map((item) =>
          normalizeNutritionistThreadEntry(item, {
            nutritionistName,
            patientName: chatSnapshot.patientName,
          })
        ),
        optimisticThread
      );

      setChats((current) =>
        sortChatsByRecency(
          current.map((chat) => {
            if (chat.id !== chatSnapshot.id) return chat;
            return applyThreadPreviewToChat(
              { ...chat, threadLoaded: true },
              normalizedThread
            );
          })
        )
      );

      replaceCachedPatientChat(chatSnapshot.patientId, {
        patient: chatSnapshot.patient?.raw || chatSnapshot.patient,
        clinicalObjective: '',
        appState: { nutritionistThread: normalizedThread },
        thread: normalizedThread,
      });
      invalidateNutriChatInboxCache(rpcActor.id_nutricionista_uuid);

      return normalizedThread;
    },
    [buildChatRpcActor, ensureChatRpcSession, nutritionistName, nutricionistaId]
  );

  async function handleSend() {
    const text = draft.trim();
    const registroSnapshot = pendingRegistro;
    const hasRegistro = Boolean(registroSnapshot?.entry);
    if (!activeChat || sending || (!text && !hasRegistro)) return;

    const chatSnapshot = activeChat;
    const rpcActor = buildChatRpcActor();

    if (!rpcActor.id_nutricionista_uuid) {
      Alert.alert(
        'Nao foi possivel enviar',
        'Sua conta de nutricionista nao foi identificada. Saia e entre novamente.'
      );
      return;
    }

    const outboundText = hasRegistro
      ? buildRegistroChatMessageFromContext(registroSnapshot, { comment: text })
      : text;

    if (!String(outboundText || '').trim()) return;

    try {
      setSending(true);

      await appendAndPersistMessage(outboundText, chatSnapshot.id, null, {
        registroContext: hasRegistro ? registroSnapshot : null,
      });

      setDraft('');
      setPendingRegistro(null);
      if (navigation?.setParams) {
        navigation.setParams({ registroContext: undefined });
      }
      invalidateNutriChatInboxCache(nutricionistaId);
    } catch (error) {
      console.log('Erro ao enviar resposta da nutricionista:', error);
      const message = String(error?.message || '').trim();
      Alert.alert(
        'Nao foi possivel enviar',
        message || 'Confira o vinculo com o paciente e tente novamente.'
      );
      await loadActiveThread(chatSnapshot.patientId, { silent: true });
    } finally {
      setSending(false);
    }
  }

  function dismissPendingRegistro() {
    setPendingRegistro(null);
    if (navigation?.setParams) {
      navigation.setParams({ registroContext: undefined });
    }
  }

  function handleLoadMoreChats() {
    const nextVisible = Math.min(visibleChatCount + CHAT_PAGE_SIZE, filteredChats.length);
    setVisibleChatCount(nextVisible);

    const patients = patientsRef.current || [];
    if (inboxPreviewLoadedCount < nextVisible + CHAT_PAGE_SIZE) {
      loadInboxPreviewsForPatients(patients, {
        fromIndex: inboxPreviewLoadedCount,
        count: INBOX_PREVIEW_BATCH,
      });
    }
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
        <View style={[dashboardKpiStyles.grid, isCompact && styles.compactKpiGrid]}>
          {metrics.map((item) => (
            <View key={item.id} style={dashboardKpiStyles.cell}>
              <DashboardKpiCard
                icon={item.icon}
                accent={item.accent}
                label={item.label}
                value={item.value}
              />
            </View>
          ))}
        </View>

        <View style={[styles.chatRow, isCompact && styles.chatRowCompact]}>
        {showListColumn ? (
        <SectionCard style={[styles.listColumn, { height: chatPanelHeight }]}>
          <View style={styles.listHeader}>
            <Text style={styles.columnTitle}>Mensagens</Text>
            <View style={styles.listUnreadBadge}>
              <Text style={styles.listUnreadBadgeText}>
                {formatUnreadBadgeCount(listUnreadCount)}
              </Text>
            </View>
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
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadInbox({ bustCache: true })}
                activeOpacity={0.9}
              >
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
              refreshControl={
                <RefreshControl
                  refreshing={inboxRefreshing}
                  onRefresh={async () => {
                    setInboxRefreshing(true);
                    try {
                      await loadInbox({ silent: true, bustCache: true });
                    } finally {
                      setInboxRefreshing(false);
                    }
                  }}
                  colors={[patientTheme.colors.primaryDark]}
                />
              }
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
                    onPress={() => handleSelectChat(chat.id)}
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
                  <Ionicons name="document-text-outline" size={18} color={patientTheme.colors.primary} />
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
                {threadLoading && !(activeChat.messages || []).length ? (
                  <View style={styles.emptyThread}>
                    <ActivityIndicator color={patientTheme.colors.primaryDark} />
                    <Text style={styles.emptyThreadText}>Carregando mensagens...</Text>
                  </View>
                ) : !(activeChat.messages || []).length ? (
                  <View style={styles.emptyThread}>
                    <Text style={styles.emptyText}>
                      {activeChat.threadLoaded
                        ? 'Nenhuma mensagem nesta conversa ainda.'
                        : 'Nao foi possivel carregar o historico. Toque em Tentar novamente.'}
                    </Text>
                    {!activeChat.threadLoaded ? (
                      <TouchableOpacity
                        style={styles.retryThreadButton}
                        onPress={() => loadActiveThread(activeChat.patientId)}
                      >
                        <Text style={styles.retryThreadButtonText}>Tentar novamente</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  (activeChat.messages || []).map((message) => {
                    const mine = message.role === 'nutri';
                    const registroParsed = resolveRegistroChatPresentation(message);
                    if (registroParsed) {
                      return (
                        <View
                          key={message.id}
                          style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowPatient]}
                        >
                          <View
                            style={[
                              styles.registroMessageWrap,
                              mine ? styles.registroMessageWrapMine : styles.registroMessageWrapPatient,
                            ]}
                          >
                            <RegistroChatContextCard parsedMessage={registroParsed} variant="chat" />
                            {registroParsed.comment ? (
                              <View style={[styles.bubble, styles.bubbleMine, styles.registroCommentBubble]}>
                                <Text style={[styles.bubbleText, styles.bubbleTextMine]}>
                                  {registroParsed.comment}
                                </Text>
                              </View>
                            ) : null}
                            <Text
                              style={[
                                styles.registroMessageTime,
                                mine && styles.registroMessageTimeMine,
                              ]}
                            >
                              {message.time}
                            </Text>
                          </View>
                        </View>
                      );
                    }
                    return (
                      <View
                        key={message.id}
                        style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowPatient]}
                      >
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePatient]}>
                          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                            {stripRegistroMetaFromChatText(message.text)}
                          </Text>
                          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{message.time}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View
                style={[
                  styles.composerPanel,
                  { paddingBottom: Math.max(insets.bottom, 8) },
                ]}
              >
                {pendingRegistro ? (
                  <RegistroChatReplyPreview
                    context={pendingRegistro}
                    onDismiss={dismissPendingRegistro}
                  />
                ) : null}

                <View style={styles.inputRow}>
                <View style={styles.threadInputWrap}>
                  <TextInput
                    style={styles.threadInput}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={
                      pendingRegistro
                        ? 'Escreva sua mensagem...'
                        : 'Responder paciente'
                    }
                    placeholderTextColor={patientTheme.colors.textMuted}
                    multiline
                    maxLength={500}
                    editable={!sending}
                    {...bindChatEnterToSend(handleSend)}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    ((!draft.trim() && !pendingRegistro?.entry) || sending) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  activeOpacity={0.9}
                  disabled={(!draft.trim() && !pendingRegistro?.entry) || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
                  ) : (
                    <Ionicons name="send" size={18} color={patientTheme.colors.onPrimary} />
                  )}
                </TouchableOpacity>
                </View>
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
  compactKpiGrid: {
    marginBottom: 4,
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
    flexDirection: 'row',
    gap: 16,
    minHeight: 0,
  },
  chatRowCompact: {
    flexDirection: 'column',
    gap: 12,
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
    flex: Platform.OS === 'web' ? 0.95 : 1,
    minWidth: 0,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    shadowColor: 'transparent',
    elevation: 0,
    overflow: 'hidden',
  },
  threadColumn: {
    flex: Platform.OS === 'web' ? 1.45 : 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
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
    backgroundColor: patientTheme.colors.danger,
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
    backgroundColor: patientTheme.colors.backgroundSoft,
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
    backgroundColor: patientTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
    shadowColor: 'transparent',
    elevation: 0,
  },
  chatListItemActive: {
    backgroundColor: patientTheme.colors.primaryLight,
    borderLeftWidth: 3,
    borderLeftColor: patientTheme.colors.primary,
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
    backgroundColor: patientTheme.colors.danger,
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
    backgroundColor: patientTheme.colors.primaryLight,
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 8,
  },
  emptyThreadText: {
    fontSize: 14,
    color: patientTheme.colors.textMuted,
    textAlign: 'center',
  },
  retryThreadButton: {
    backgroundColor: patientTheme.colors.primary,
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryThreadButtonText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
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
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubblePatient: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
    borderWidth: 1,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    color: patientTheme.colors.text,
    lineHeight: 21,
    fontSize: 15,
  },
  bubbleTextMine: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '600',
  },
  bubbleTime: {
    marginTop: 6,
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  bubbleTimeMine: {
    color: patientTheme.colors.textMuted,
  },
  registroMessageWrap: {
    maxWidth: '88%',
  },
  registroMessageWrapMine: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  registroMessageWrapPatient: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  registroMessageTime: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'left',
  },
  registroMessageTimeMine: {
    textAlign: 'right',
  },
  composerPanel: {
    borderTopColor: patientTheme.colors.border,
    borderTopWidth: 1,
    flexShrink: 0,
    marginTop: 8,
  },
  registroCommentBubble: {
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  threadInputWrap: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
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
    backgroundColor: patientTheme.colors.primary,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
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
