import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { SearchInput } from '../../componentes/nutricionista/NutriDesktopUI';
import { patientTheme } from '../../temas/temaVisualPaciente';
import { supabase } from '../../servicos/configSupabase';
import {
  createDefaultAppState,
  fetchPatientNutritionistChat,
  getPatientDisplayName,
  getPatientId,
  mapRealtimeChatRowToThreadEntry,
  mergeChatMessageIntoThread,
} from '../../servicos/servicoDadosPaciente';
import {
  getCachedPatientChat,
  invalidatePatientChatCache,
} from '../../servicos/cacheExperienciaPaciente';
import { getNutritionistById } from '../../servicos/servicoNutricionistas';
import { listConsultasByPaciente } from '../../servicos/servicoConsultas';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import {
  buildPatientChatPreview,
  CHAT_ACTIVE_POLL_MS,
  getPatientChatLastReadAt,
  markPatientChatRead,
} from '../../utilitarios/chatConversa';

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
  const hasLoadedRef = useRef(false);
  const loadRef = useRef(() => Promise.resolve());

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [nutritionist, setNutritionist] = useState(
    buildFallbackNutritionist(routeNutritionist, [])
  );
  const [chatLastReadAt, setChatLastReadAt] = useState(null);

  useEffect(() => {
    navigation.setOptions({
      readerTitle: 'Conversas',
    });

    return () => {
      navigation.setOptions({
        readerTitle: null,
      });
    };
  }, [navigation]);

  const load = useCallback(
    async ({ silent = false, forceRefresh = false } = {}) => {
      try {
        if (!silent) setLoading(true);

        if (!canResolvePatient) {
          setAppState(createDefaultAppState());
          setNutritionist(buildFallbackNutritionist(routeNutritionist, []));
          return;
        }

        const cached = !forceRefresh ? getCachedPatientChat(patientId) : null;
        if (cached?.appState && !silent) {
          setAppState(cached.appState);
          setNutritionist(
            buildFallbackNutritionist(
              routeNutritionist,
              cached.appState?.nutritionistThread || []
            )
          );
          setLoading(false);
        }

        const experience = await fetchPatientNutritionistChat(patientId, {
          ...mesclarLimitesDadosPaciente('chat'),
          patientContext: usuarioLogado,
          forceRefresh,
        });

        setAppState(experience.appState || createDefaultAppState());

        let resolvedNutritionist = routeNutritionist;
        const routeNutritionistId = routeNutritionist?.id_nutricionista_uuid;
        const linkedNutritionistId =
          experience?.patient?.id_nutricionista_uuid || experience?.nutricionistaId || null;

        if (routeNutritionistId) {
          try {
            resolvedNutritionist = await getNutritionistById(routeNutritionistId);
          } catch (error) {
            console.log('Erro ao carregar nutricionista da rota:', error);
          }
        }

        if (!resolvedNutritionist && linkedNutritionistId) {
          try {
            resolvedNutritionist = await getNutritionistById(linkedNutritionistId);
          } catch (error) {
            console.log('Erro ao carregar nutricionista vinculada ao paciente:', error);
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

        setNutritionist(
          buildFallbackNutritionist(
            resolvedNutritionist,
            experience.appState?.nutritionistThread || []
          )
        );
      } catch (error) {
        console.log('Erro ao carregar lista de conversas do paciente:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [canResolvePatient, patientId, routeNutritionist, usuarioLogado]
  );

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPatientChatLastReadAt(patientId).then((readAt) => {
        if (active) setChatLastReadAt(readAt);
      });
      load({ silent: hasLoadedRef.current, forceRefresh: false });
      hasLoadedRef.current = true;
      const intervalId = setInterval(
        () => load({ silent: true, forceRefresh: true }),
        CHAT_ACTIVE_POLL_MS
      );
      return () => {
        active = false;
        clearInterval(intervalId);
        if (patientId) {
          invalidatePatientChatCache(patientId);
        }
      };
    }, [load, patientId])
  );

  const nutritionistName =
    nutritionist?.nome_completo_nutri || nutritionist?.nome_nutri || 'Nutricionista';

  useEffect(() => {
    if (!patientId) return undefined;

    const channel = supabase
      .channel(`patient-chat-list-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagem_chat',
          filter: `paciente_id=eq.${patientId}`,
        },
        (payload) => {
          const row = payload?.new;
          if (row?.texto && payload?.eventType === 'INSERT') {
            const entry = mapRealtimeChatRowToThreadEntry(row, patientFirstName, {
              nutritionistName,
            });
            if (entry) {
              setAppState((current) => ({
                ...current,
                nutritionistThread: mergeChatMessageIntoThread(
                  current?.nutritionistThread || [],
                  entry
                ),
              }));
              return;
            }
          }
          loadRef.current({ silent: true, forceRefresh: false });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, patientFirstName, nutritionistName]);

  const chatPreview = useMemo(
    () =>
      buildPatientChatPreview(appState?.nutritionistThread, {
        nutritionistName,
        patientName: patientFirstName,
        lastReadAt: chatLastReadAt,
      }),
    [appState?.nutritionistThread, nutritionistName, patientFirstName, chatLastReadAt]
  );

  const chatItems = useMemo(() => {
    return [
      {
        id: `nutri-${nutritionist?.id_nutricionista_uuid || nutritionistName}`,
        nutritionistName,
        nutritionistMeta: [
          nutritionist?.especialidade || 'Acompanhamento nutricional',
          nutritionist?.crm_numero ? `CRN ${nutritionist.crm_numero}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        preview: chatPreview.lastMessage || 'Nenhuma mensagem ainda.',
        time: chatPreview.lastMessageAt || '',
        unread: chatPreview.unread,
      },
    ];
  }, [chatPreview, nutritionist, nutritionistName]);

  const filteredChats = useMemo(() => {
    const normalized = String(search || '').toLowerCase().trim();
    if (!normalized) return chatItems;
    return chatItems.filter((item) =>
      [item.nutritionistName, item.preview].some((field) =>
        String(field || '').toLowerCase().includes(normalized)
      )
    );
  }, [chatItems, search]);

  async function openChat(chat) {
    const readAt = await markPatientChatRead(patientId);
    if (readAt) setChatLastReadAt(readAt);

    navigation.navigate('PacienteChatNutricionistaDetalhe', {
      usuarioLogado,
      conversationId: chat.id,
      nutricionista: nutritionist,
      initialAppState: { ...appState, nutritionistThread: appState?.nutritionistThread || [] },
      initialNutritionist: nutritionist,
      initialReadAt: readAt,
    });
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.listSearch}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar profissional ou mensagem"
        />
      </View>

      <View style={styles.listSection}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Carregando conversas...</Text>
          </View>
        ) : !filteredChats.length ? (
          <View style={styles.emptyStateCard}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={42}
              color={patientTheme.colors.border}
            />
            <Text style={styles.emptyTitle}>Nenhuma conversa encontrada</Text>
            <Text style={styles.emptyText}>
              Ajuste a busca ou aguarde uma nova mensagem dos profissionais.
            </Text>
          </View>
        ) : (
          <View style={styles.chatList}>
            {filteredChats.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                style={styles.chatListItem}
                onPress={() => openChat(chat)}
                activeOpacity={0.9}
              >
                <View style={styles.chatRowTop}>
                  <View style={styles.identityRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(chat.nutritionistName)}</Text>
                    </View>
                    <View style={styles.chatListCopy}>
                      <View style={styles.chatListTop}>
                        <Text style={styles.chatListName} numberOfLines={1}>
                          {chat.nutritionistName}
                        </Text>
                        <Text style={styles.chatListTime}>{chat.time}</Text>
                      </View>
                      <Text style={styles.chatListPreview} numberOfLines={2}>
                        {`Ultima mensagem: ${chat.preview}`}
                      </Text>
                    </View>
                  </View>
                  {chat.unread ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{chat.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </PatientScreenLayout>
  );
}

const CHAT_CARD_BORDER_COLOR = '#EEF3F7';

const chatPanelBorder = {
  backgroundColor: patientTheme.colors.background,
  borderColor: CHAT_CARD_BORDER_COLOR,
  borderWidth: 1,
};

const styles = StyleSheet.create({
  contentContainer: {
    backgroundColor: patientTheme.colors.background,
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 32,
  },
  listSearch: {
    marginBottom: 12,
    marginTop: 2,
  },
  listSection: {
    flexGrow: 1,
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.xl,
    padding: 24,
    ...chatPanelBorder,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    marginTop: 10,
  },
  chatList: {
    gap: 12,
  },
  chatListItem: {
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    ...chatPanelBorder,
  },
  chatRowTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  identityRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
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
    fontSize: 16,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  chatListTime: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  chatListPreview: {
    marginTop: 5,
    color: '#5F6F7D',
    fontSize: 14,
    lineHeight: 20,
  },
  unreadBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
    fontSize: 12,
  },
  emptyStateCard: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: patientTheme.radius.xl,
    padding: 24,
    ...chatPanelBorder,
  },
  emptyTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
});
