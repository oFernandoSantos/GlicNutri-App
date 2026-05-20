import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  AvatarBadge,
  RiskBadge,
  SearchInput,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { nutritionistMessagesMock, getNutritionistPatientById } from '../../dados/dadosNutricionistaMock';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

export default function TelaMensagensNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [search, setSearch] = useState('');
  const [activeChatId, setActiveChatId] = useState(nutritionistMessagesMock[0]?.id || null);
  const [draft, setDraft] = useState('');
  const [extraMessages, setExtraMessages] = useState({});

  const filteredChats = useMemo(() => {
    const normalized = String(search || '').toLowerCase().trim();
    if (!normalized) return nutritionistMessagesMock;

    return nutritionistMessagesMock.filter((chat) => {
      return [chat.patientName, chat.specialtyTag, chat.lastMessage]
        .some((field) => String(field || '').toLowerCase().includes(normalized));
    });
  }, [search]);

  const activeChat = useMemo(() => {
    return filteredChats.find((item) => item.id === activeChatId) || filteredChats[0] || null;
  }, [filteredChats, activeChatId]);

  const activePatient = useMemo(() => {
    return getNutritionistPatientById(activeChat?.patientId);
  }, [activeChat]);

  const mergedMessages = useMemo(() => {
    if (!activeChat) return [];
    return [...(activeChat.messages || []), ...(extraMessages[activeChat.id] || [])];
  }, [activeChat, extraMessages]);

  function handleSend() {
    if (!activeChat || !draft.trim()) return;

    setExtraMessages((current) => {
      const nextList = current[activeChat.id] || [];
      return {
        ...current,
        [activeChat.id]: [
          ...nextList,
          {
            id: `${activeChat.id}-local-${nextList.length + 1}`,
            from: 'nutri',
            text: draft.trim(),
            time: 'Agora',
          },
        ],
      };
    });
    setDraft('');
  }

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Mensagens"
      subtitle="Converse com pacientes prioritarios sem perder contexto clinico."
      showTabBar={route?.name === 'NutricionistaMensagens'}
    >
      <View style={[nutriDesktopStyles.desktopRow, styles.chatLayout]}>
        <SectionCard style={styles.listColumn}>
          <Text style={styles.columnTitle}>Conversas</Text>
          <Text style={styles.columnHelper}>Busca rapida por nome, contexto ou ultima mensagem.</Text>
          <View style={styles.listSearch}>
            <SearchInput value={search} onChangeText={setSearch} placeholder="Buscar paciente ou assunto" />
          </View>

          <View style={styles.chatList}>
            {filteredChats.map((chat) => {
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
                    <Text style={styles.chatListTag} numberOfLines={1}>{chat.specialtyTag}</Text>
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
          </View>
        </SectionCard>

        <SectionCard style={styles.threadColumn}>
          {activeChat ? (
            <>
              <View style={styles.threadHeader}>
                <View style={styles.threadIdentity}>
                  <AvatarBadge name={activeChat.patientName} size={52} />
                  <View style={styles.threadIdentityCopy}>
                    <Text style={styles.threadName}>{activeChat.patientName}</Text>
                    <Text style={styles.threadMeta}>
                      {activeChat.specialtyTag} {activePatient ? `· IMC ${activePatient.bmi}` : ''}
                    </Text>
                    {activePatient ? <RiskBadge risk={`${activePatient.risk} risco`} /> : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.chartShortcut}
                  onPress={() =>
                    navigation.navigate('NutriProntuarioPaciente', {
                      usuarioLogado,
                      pacienteId: activeChat.patientId,
                    })
                  }
                >
                  <Ionicons name="document-text-outline" size={18} color={patientTheme.colors.primaryDark} />
                  <Text style={styles.chartShortcutText}>Abrir prontuario</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.threadBody}>
                {mergedMessages.map((message) => {
                  const mine = message.from === 'nutri';
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
                })}
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.threadInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Responder paciente"
                  placeholderTextColor={patientTheme.colors.textMuted}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSend} activeOpacity={0.9}>
                  <Ionicons name="send" size={18} color={patientTheme.colors.onPrimary} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nenhuma conversa encontrada</Text>
              <Text style={styles.emptyText}>Ajuste a busca para localizar um paciente.</Text>
            </View>
          )}
        </SectionCard>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  chatLayout: {
    alignItems: 'stretch',
  },
  listColumn: {
    flex: Platform.OS === 'web' ? 1 : 1,
    minWidth: 0,
  },
  threadColumn: {
    flex: Platform.OS === 'web' ? 2 : 1,
    minWidth: 0,
    minHeight: 620,
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  columnHelper: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    fontSize: 13,
  },
  listSearch: {
    marginTop: 14,
    marginBottom: 12,
  },
  chatList: {
    gap: 10,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    ...patientShadow,
  },
  chatListItemActive: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
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
    minWidth: 26,
    height: 26,
    borderRadius: 13,
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
  threadHeader: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
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
    minHeight: 380,
    paddingVertical: 18,
    gap: 10,
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
    ...patientShadow,
  },
  bubbleMine: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  bubbleText: {
    color: patientTheme.colors.text,
    lineHeight: 20,
    fontWeight: '600',
  },
  bubbleTextMine: {
    color: patientTheme.colors.onPrimary,
  },
  bubbleTime: {
    marginTop: 8,
    fontSize: 11,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.78)',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
  },
  threadInput: {
    flex: 1,
    minHeight: 50,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.background,
    paddingHorizontal: 16,
    color: patientTheme.colors.text,
    ...patientShadow,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  emptyText: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
  },
});
