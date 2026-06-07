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
  fetchPatientById,
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
import {
  buildPatientMedicoChatPreview,
  fetchPatientMedicoChatThread,
  mergeMedicoChatMessageIntoThread,
} from '../../servicos/servicoChatMedico';
import { mapMedicoRealtimeChatRowToThreadEntry } from '../../servicos/servicoMensagensChatMedico';
import { getMedicoById, getMedicoEspecialidadeLabel } from '../../servicos/servicoMedicos';
import { listConsultasByPaciente } from '../../servicos/servicoConsultas';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import {
  garantirSessaoRpcClinicaComPerfil,
  normalizeRpcActorProfile,
} from '../../servicos/servicoSessaoRpc';
import {
  buildPatientChatPreview,
  CHAT_ACTIVE_POLL_MS,
  getPatientChatLastReadAt,
  getPatientMedicoChatLastReadAt,
  markPatientChatRead,
  markPatientMedicoChatRead,
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

function selectAssignedConsulta(consultas, { professionalKey = 'nutricionista_id' } = {}) {
  const priority = {
    confirmed: 0,
    scheduled: 1,
    done: 2,
    no_show: 3,
    cancelled: 9,
  };

  return [...(consultas || [])]
    .filter((item) => item?.[professionalKey] && item?.status !== 'cancelled')
    .sort((left, right) => {
      const priorityDiff = (priority[left?.status] ?? 5) - (priority[right?.status] ?? 5);
      if (priorityDiff !== 0) return priorityDiff;
      return String(right?.scheduled_at || '').localeCompare(String(left?.scheduled_at || ''));
    })[0] || null;
}

function buildFallbackMedico(routeMedico, thread) {
  const threadMedico = (thread || []).find((item) => item?.role === 'medico');
  const name =
    routeMedico?.nome_completo_medico ||
    routeMedico?.nome_medico ||
    threadMedico?.author ||
    'Medico de acompanhamento';

  return {
    nome_completo_medico: name,
    especialidade_medico: routeMedico?.especialidade_medico || 'Acompanhamento medico',
    crm_medico: routeMedico?.crm_medico || '',
    ...routeMedico,
  };
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
  const routeMedico = route?.params?.medico || null;
  const patientName = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);
  const patientFirstName = useMemo(
    () => String(patientName || 'Paciente').trim().split(/\s+/)[0] || 'Paciente',
    [patientName]
  );
  const hasLoadedRef = useRef(false);
  const loadRef = useRef(() => Promise.resolve());
  const loadInFlightRef = useRef(false);
  const rpcSessionEnsuredRef = useRef(false);
  const consultasCacheRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [nutritionist, setNutritionist] = useState(
    buildFallbackNutritionist(routeNutritionist, [])
  );
  const [chatLastReadAt, setChatLastReadAt] = useState(null);
  const [medico, setMedico] = useState(buildFallbackMedico(routeMedico, []));
  const [medicoThread, setMedicoThread] = useState([]);

  useEffect(() => {
    medicoThreadRef.current = medicoThread;
  }, [medicoThread]);
  const [medicoLastReadAt, setMedicoLastReadAt] = useState(null);
  const medicoIdRef = useRef(routeMedico?.id_medico_uuid || null);
  const medicoThreadRef = useRef([]);

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

  const loadMedicoPreview = useCallback(
    async ({
      patientActor,
      resolvedMedicoId,
      experiencePatient = null,
      silent = false,
    } = {}) => {
      let medicoId =
        resolvedMedicoId ||
        routeMedico?.id_medico_uuid ||
        experiencePatient?.id_medico_uuid ||
        usuarioLogado?.id_medico_uuid ||
        medicoIdRef.current ||
        null;

      if (!medicoId && patientId) {
        let patientRow = experiencePatient;
        if (!patientRow?.id_medico_uuid) {
          try {
            patientRow = await fetchPatientById(patientId, {
              patientContext: usuarioLogado,
              currentPatient: usuarioLogado,
            });
          } catch (error) {
            console.log('Erro ao carregar paciente para chat medico:', error);
          }
        }
        medicoId = patientRow?.id_medico_uuid || medicoIdRef.current || null;
      }

      if (!medicoId && patientId) {
        try {
          const consultas =
            consultasCacheRef.current ||
            (await listConsultasByPaciente(patientId, { limit: 40 }));
          consultasCacheRef.current = consultas;
          const assignedConsulta = selectAssignedConsulta(consultas, {
            professionalKey: 'medico_id',
          });
          medicoId = assignedConsulta?.medico_id || null;
        } catch (error) {
          console.log('Erro ao localizar medico vinculado:', error);
        }
      }

      medicoIdRef.current = medicoId;
      if (!medicoId || !patientId) {
        if (!silent) {
          setMedicoThread([]);
          setMedico(buildFallbackMedico(routeMedico, []));
        }
        return;
      }

      const medicoNamePreview =
        routeMedico?.nome_completo_medico || routeMedico?.nome_medico || 'Medico';
      let resolvedMedicoThread = medicoThreadRef.current;
      try {
        resolvedMedicoThread = await fetchPatientMedicoChatThread(patientId, medicoId, {
          patientContext: usuarioLogado,
          patientName,
          medicoName: medicoNamePreview,
          limit: 200,
          rpcActor: patientActor,
          fallbackThread: medicoThreadRef.current,
        });
      } catch (error) {
        console.log('Erro ao carregar preview chat medico:', error);
      }
      setMedicoThread(resolvedMedicoThread);

      if (!silent || !medico?.id_medico_uuid) {
        let resolvedMedico = routeMedico;
        if (medicoId) {
          try {
            resolvedMedico = await getMedicoById(medicoId);
          } catch (error) {
            console.log('Erro ao carregar medico vinculado:', error);
          }
        }
        setMedico(
          buildFallbackMedico(
            resolvedMedico || { id_medico_uuid: medicoId },
            resolvedMedicoThread
          )
        );
      }
    },
    [medico?.id_medico_uuid, patientId, patientName, routeMedico, usuarioLogado]
  );

  const load = useCallback(
    async ({ silent = false, forceRefresh = false } = {}) => {
      if (silent && loadInFlightRef.current) return;

      loadInFlightRef.current = true;
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

        const patientActor = normalizeRpcActorProfile(usuarioLogado);
        if (patientActor?.id_paciente_uuid && !rpcSessionEnsuredRef.current) {
          await garantirSessaoRpcClinicaComPerfil(patientActor).catch((error) => {
            console.log('Sessao RPC lista conversas paciente:', error?.message || error);
          });
          rpcSessionEnsuredRef.current = true;
        }

        const experience = await fetchPatientNutritionistChat(patientId, {
          ...mesclarLimitesDadosPaciente('chat'),
          patientContext: usuarioLogado,
          forceRefresh: silent ? false : forceRefresh,
        });

        setAppState(experience.appState || createDefaultAppState());

        if (silent && hasLoadedRef.current) {
          await loadMedicoPreview({
            patientActor,
            resolvedMedicoId: medicoIdRef.current,
            experiencePatient: experience?.patient || null,
            silent: true,
          });
          return;
        }

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

        if (!resolvedNutritionist?.id_nutricionista_uuid && linkedNutritionistId) {
          try {
            resolvedNutritionist = await getNutritionistById(linkedNutritionistId);
          } catch (error) {
            console.log('Erro ao carregar nutricionista vinculada ao paciente:', error);
          }
        }

        let consultas = consultasCacheRef.current;
        const hasKnownMedicoId = Boolean(
          routeMedico?.id_medico_uuid ||
            experience?.patient?.id_medico_uuid ||
            usuarioLogado?.id_medico_uuid ||
            medicoIdRef.current
        );
        const needsConsultasLookup =
          patientId &&
          (!resolvedNutritionist?.id_nutricionista_uuid || !hasKnownMedicoId);
        if (needsConsultasLookup && !consultas) {
          try {
            consultas = await listConsultasByPaciente(patientId, { limit: 40 });
            consultasCacheRef.current = consultas;
          } catch (error) {
            console.log('Erro ao localizar profissionais vinculados:', error);
          }
        }

        if (!resolvedNutritionist?.id_nutricionista_uuid && consultas?.length) {
          const assignedConsulta = selectAssignedConsulta(consultas);
          if (assignedConsulta?.nutricionista_id) {
            try {
              resolvedNutritionist = await getNutritionistById(assignedConsulta.nutricionista_id);
            } catch (error) {
              console.log('Erro ao localizar nutricionista vinculada:', error);
            }
          }
        }

        setNutritionist(
          buildFallbackNutritionist(
            resolvedNutritionist,
            experience.appState?.nutritionistThread || []
          )
        );

        const resolvedMedicoId =
          routeMedico?.id_medico_uuid ||
          experience?.patient?.id_medico_uuid ||
          usuarioLogado?.id_medico_uuid ||
          medicoIdRef.current ||
          null;

        await loadMedicoPreview({
          patientActor,
          resolvedMedicoId,
          experiencePatient: experience?.patient || null,
          silent: false,
        });
      } catch (error) {
        console.log('Erro ao carregar lista de conversas do paciente:', error);
      } finally {
        loadInFlightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [
      canResolvePatient,
      loadMedicoPreview,
      patientId,
      routeNutritionist,
      usuarioLogado,
    ]
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
      getPatientMedicoChatLastReadAt(patientId, medicoIdRef.current).then((readAt) => {
        if (active) setMedicoLastReadAt(readAt);
      });
      load({ silent: hasLoadedRef.current, forceRefresh: false });
      hasLoadedRef.current = true;
      const intervalId = setInterval(
        () => load({ silent: true, forceRefresh: false }),
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
  const medicoName = medico?.nome_completo_medico || medico?.nome_medico || 'Medico';

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

  useEffect(() => {
    if (!patientId) return undefined;

    const channel = supabase
      .channel(`patient-medico-chat-list-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagem_chat_medico',
          filter: `paciente_id=eq.${patientId}`,
        },
        (payload) => {
          const row = payload?.new;
          if (row?.texto && payload?.eventType === 'INSERT') {
            const entry = mapMedicoRealtimeChatRowToThreadEntry(row, patientFirstName, {
              medicoName,
            });
            if (entry) {
              setMedicoThread((current) => mergeMedicoChatMessageIntoThread(current, entry));
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
  }, [medicoName, patientFirstName, patientId]);

  const chatPreview = useMemo(
    () =>
      buildPatientChatPreview(appState?.nutritionistThread, {
        nutritionistName,
        patientName: patientFirstName,
        lastReadAt: chatLastReadAt,
      }),
    [appState?.nutritionistThread, nutritionistName, patientFirstName, chatLastReadAt]
  );

  const medicoChatPreview = useMemo(
    () => buildPatientMedicoChatPreview(medicoThread, { lastReadAt: medicoLastReadAt }),
    [medicoLastReadAt, medicoThread]
  );

  const chatItems = useMemo(() => {
    const items = [
      {
        id: `nutri-${nutritionist?.id_nutricionista_uuid || nutritionistName}`,
        type: 'nutri',
        professionalName: nutritionistName,
        professionalMeta: [
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

    if (medico?.id_medico_uuid || medicoIdRef.current || medicoThread.length > 0) {
      items.push({
        id: `medico-${medico?.id_medico_uuid || medicoIdRef.current || medicoName}`,
        type: 'medico',
        professionalName: medicoName,
        professionalMeta: [
          getMedicoEspecialidadeLabel(medico),
          medico?.crm_medico ? `CRM ${medico.crm_medico}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        preview: medicoChatPreview.lastMessage || 'Nenhuma mensagem ainda.',
        time: medicoChatPreview.lastMessageAt || '',
        unread: medicoChatPreview.unread,
        medico,
        medicoThread,
      });
    }

    return items;
  }, [chatPreview, medico, medicoChatPreview, medicoName, medicoThread, nutritionist, nutritionistName]);

  const filteredChats = useMemo(() => {
    const normalized = String(search || '').toLowerCase().trim();
    if (!normalized) return chatItems;
    return chatItems.filter((item) =>
      [item.professionalName, item.preview].some((field) =>
        String(field || '').toLowerCase().includes(normalized)
      )
    );
  }, [chatItems, search]);

  async function openChat(chat) {
    if (chat.type === 'medico') {
      const medicoId = chat.medico?.id_medico_uuid || medicoIdRef.current;
      const readAt = await markPatientMedicoChatRead(patientId, medicoId);
      if (readAt) setMedicoLastReadAt(readAt);

      navigation.navigate('PacienteChatMedicoDetalhe', {
        usuarioLogado,
        conversationId: chat.id,
        medico: chat.medico || medico,
        initialAppState: { medicoThread: chat.medicoThread || medicoThread },
        initialMedico: chat.medico || medico,
        initialReadAt: readAt,
      });
      return;
    }

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
                      <Text style={styles.avatarText}>{getInitials(chat.professionalName)}</Text>
                    </View>
                    <View style={styles.chatListCopy}>
                      <View style={styles.chatListTop}>
                        <Text style={styles.chatListName} numberOfLines={1}>
                          {chat.professionalName}
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
