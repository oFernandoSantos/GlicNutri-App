import React, { useEffect, useMemo, useState } from 'react';
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
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientNutritionistChat,
  getPatientDisplayName,
  getPatientId,
  normalizeNutritionistThreadEntry,
} from '../../servicos/servicoDadosPaciente';
import { getNutritionistById } from '../../servicos/servicoNutricionistas';
import { listConsultasByPaciente } from '../../servicos/servicoConsultas';

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

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [nutritionist, setNutritionist] = useState(
    buildFallbackNutritionist(routeNutritionist, createDefaultAppState().nutritionistThread)
  );

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

  const load = useMemo(
    () => async () => {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          const fallbackThread = createDefaultAppState().nutritionistThread;
          setAppState(createDefaultAppState());
          setNutritionist(buildFallbackNutritionist(routeNutritionist, fallbackThread));
          return;
        }

        const experience = await fetchPatientNutritionistChat(patientId, {
          patientContext: usuarioLogado,
        });

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

        setNutritionist(
          buildFallbackNutritionist(
            resolvedNutritionist,
            experience.appState?.nutritionistThread || createDefaultAppState().nutritionistThread
          )
        );
      } catch (error) {
        console.log('Erro ao carregar lista de conversas do paciente:', error);
      } finally {
        setLoading(false);
      }
    },
    [canResolvePatient, patientId, routeNutritionist, usuarioLogado]
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      load();
      const intervalId = setInterval(load, 5000);
      return () => clearInterval(intervalId);
    }, [load])
  );

  const messages = useMemo(() => {
    const source = appState?.nutritionistThread?.length
      ? appState.nutritionistThread
      : createDefaultAppState().nutritionistThread;
    const nutriName =
      nutritionist?.nome_completo_nutri || nutritionist?.nome_nutri || 'Nutricionista';

    return source
      .map((item) =>
        normalizeNutritionistThreadEntry(item, {
          nutritionistName: nutriName,
          patientName: patientFirstName,
        })
      )
      .filter((item) => item.text);
  }, [appState?.nutritionistThread, nutritionist, patientFirstName]);

  const chatItems = useMemo(() => {
    const preview = messages[messages.length - 1] || null;
    const nutritionistName =
      nutritionist?.nome_completo_nutri || nutritionist?.nome_nutri || 'Nutricionista';

    return [
      {
        id: `nutri-${nutritionist?.id_nutricionista_uuid || nutritionistName}`,
        nutritionistName,
        nutritionistMeta: [
          nutritionist?.especialidade || 'Acompanhamento nutricional',
          nutritionist?.crm_numero ? `CRN ${nutritionist.crm_numero}` : '',
        ]
          .filter(Boolean)
          .join(' - '),
        preview: preview?.text || 'Abra a conversa para ver todas as mensagens.',
        time: preview?.time || '',
        unread: messages.length ? messages.filter((item) => item.role === 'nutri').length : 0,
      },
    ];
  }, [messages, nutritionist]);

  const filteredChats = useMemo(() => {
    const normalized = String(search || '').toLowerCase().trim();
    if (!normalized) return chatItems;
    return chatItems.filter((item) =>
      [item.nutritionistName, item.nutritionistMeta, item.preview]
        .some((field) => String(field || '').toLowerCase().includes(normalized))
    );
  }, [chatItems, search]);

  function openChat(chat) {
    navigation.navigate('PacienteChatNutricionistaDetalhe', {
      usuarioLogado,
      conversationId: chat.id,
      nutricionista: nutritionist,
    });
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.listSearch}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar profissional ou mensagem"
        />
      </View>

      <View>
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
                      <Text style={styles.chatListTag} numberOfLines={1}>
                        {chat.nutritionistMeta}
                      </Text>
                      <Text style={styles.chatListPreview} numberOfLines={2}>
                        {chat.preview}
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

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 28,
  },
  listSearch: {
    marginTop: 2,
    marginBottom: 12,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.xl,
    padding: 24,
    ...patientShadow,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    marginTop: 10,
  },
  chatList: {
    gap: 12,
  },
  chatListItem: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    padding: 16,
    ...patientShadow,
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
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  chatListTime: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  chatListTag: {
    marginTop: 4,
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  chatListPreview: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 19,
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
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.xl,
    padding: 24,
    ...patientShadow,
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
