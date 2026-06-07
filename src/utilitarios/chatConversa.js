import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildNutritionistThreadPreview,
  normalizeNutritionistThreadEntry,
} from '../servicos/servicoDadosPaciente';
import { sortChatThreadByCreatedAt } from '../servicos/servicoMensagensChat';

export const CHAT_COMPACT_BREAKPOINT = 900;
export const CHAT_ACTIVE_POLL_MS = 4000;
export const CHAT_REALTIME_BACKUP_POLL_MS = 12000;
const PATIENT_CHAT_READ_PREFIX = '@glicnutri:patientChatReadAt:';
const NUTRI_CHAT_READ_PREFIX = '@glicnutri:nutriChatReadAt:';

export function isChatCompactLayout(windowWidth) {
  if (Platform.OS !== 'web') return true;
  return Number(windowWidth || 0) < CHAT_COMPACT_BREAKPOINT;
}

function getThreadLastCreatedAt(thread = []) {
  const list = Array.isArray(thread) ? thread : [];
  const last = list[list.length - 1];
  const parsed = new Date(last?.createdAt || last?.created_at || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Evita que telas com skipChat apaguem o thread já carregado do RPC. */
export function resolveNutritionistThreadMerge(current = [], incoming = []) {
  const currentList = Array.isArray(current) ? current : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  if (!incomingList.length) return currentList;
  if (!currentList.length) return incomingList;

  const currentTime = getThreadLastCreatedAt(currentList);
  const incomingTime = getThreadLastCreatedAt(incomingList);

  if (incomingTime > currentTime) return incomingList;
  if (currentTime > incomingTime) return currentList;
  return incomingList.length >= currentList.length ? incomingList : currentList;
}

export function normalizeChatMessages(
  thread = [],
  { nutritionistName = 'Nutricionista', patientName = 'Paciente' } = {}
) {
  return sortChatThreadByCreatedAt(
    (Array.isArray(thread) ? thread : [])
      .map((item) => ({
        ...normalizeNutritionistThreadEntry(item, { nutritionistName, patientName }),
        createdAt: item?.createdAt || item?.created_at || null,
      }))
      .filter((item) => item.text)
  );
}

export function buildPatientChatPreview(thread = [], options = {}) {
  const messages = normalizeChatMessages(thread, options);
  const lastMessage = messages[messages.length - 1] || null;
  const lastReadAt = options.lastReadAt ? new Date(options.lastReadAt).getTime() : 0;
  let unread = 0;

  if (lastReadAt > 0) {
    unread = messages.filter((message) => {
      if (message?.role !== 'nutri') return false;
      const createdAt = new Date(message.createdAt || message.time || 0).getTime();
      return Number.isFinite(createdAt) && createdAt > lastReadAt;
    }).length;
  } else {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role !== 'nutri') break;
      unread += 1;
    }
  }

  return {
    messages,
    lastMessage: lastMessage?.text || '',
    lastMessageAt: lastMessage?.time || '',
    unread,
  };
}

function getPatientChatReadKey(patientId) {
  return patientId ? `${PATIENT_CHAT_READ_PREFIX}${patientId}` : '';
}

export async function getPatientChatLastReadAt(patientId) {
  const key = getPatientChatReadKey(patientId);
  if (!key) return null;

  try {
    return (await AsyncStorage.getItem(key)) || null;
  } catch (error) {
    console.log('Erro ao carregar leitura do chat:', error);
    return null;
  }
}

export async function markPatientChatRead(patientId, readAt = new Date().toISOString()) {
  const key = getPatientChatReadKey(patientId);
  if (!key) return null;

  try {
    await AsyncStorage.setItem(key, readAt);
    return readAt;
  } catch (error) {
    console.log('Erro ao salvar leitura do chat:', error);
    return null;
  }
}

function getNutriChatReadKey(nutricionistaId, patientId) {
  return nutricionistaId && patientId
    ? `${NUTRI_CHAT_READ_PREFIX}${nutricionistaId}:${patientId}`
    : '';
}

export async function getNutriChatLastReadAt(nutricionistaId, patientId) {
  const key = getNutriChatReadKey(nutricionistaId, patientId);
  if (!key) return null;

  try {
    return (await AsyncStorage.getItem(key)) || null;
  } catch (error) {
    console.log('Erro ao carregar leitura do chat (nutri):', error);
    return null;
  }
}

export async function markNutriChatRead(
  nutricionistaId,
  patientId,
  readAt = new Date().toISOString()
) {
  const key = getNutriChatReadKey(nutricionistaId, patientId);
  if (!key) return null;

  try {
    await AsyncStorage.setItem(key, readAt);
    return readAt;
  } catch (error) {
    console.log('Erro ao salvar leitura do chat (nutri):', error);
    return null;
  }
}

export async function loadNutriChatReadAtForPatients(nutricionistaId, patientIds = []) {
  const map = {};
  if (!nutricionistaId || !patientIds.length) return map;

  await Promise.all(
    patientIds.map(async (patientId) => {
      const readAt = await getNutriChatLastReadAt(nutricionistaId, patientId);
      if (readAt) map[patientId] = readAt;
    })
  );

  return map;
}

export function buildNutriChatPreview(thread = [], options = {}) {
  return buildNutritionistThreadPreview(normalizeChatMessages(thread, options), {
    lastReadAt: options.lastReadAt,
  });
}

export function getLastChatMessage(thread = [], options = {}) {
  const messages = normalizeChatMessages(thread, options);
  return messages[messages.length - 1] || null;
}

function shouldSubmitChatMessage(event) {
  const native = event?.nativeEvent || {};
  const key = native.key || event?.key;
  const shiftKey = Boolean(native.shiftKey || event?.shiftKey);
  return key === 'Enter' && !shiftKey;
}

/** Enter envia; Shift+Enter nova linha (web). */
export function handleChatInputKeyPress(event, onSend) {
  if (!shouldSubmitChatMessage(event)) return;
  if (typeof event?.preventDefault === 'function') {
    event.preventDefault();
  }
  onSend?.();
}

/** Props TextInput: Enter envia mensagem no chat. */
export function bindChatEnterToSend(onSend) {
  return {
    blurOnSubmit: false,
    returnKeyType: 'send',
    onSubmitEditing: onSend,
    onKeyPress: (event) => handleChatInputKeyPress(event, onSend),
    ...(Platform.OS === 'web'
      ? {
          onKeyDown: (event) => handleChatInputKeyPress(event, onSend),
        }
      : null),
  };
}

/** Garante scroll até a mensagem mais recente após layout (Android/iOS). */
export function scrollChatToEnd(scrollRef, { animated = false, delays = [0, 80, 200] } = {}) {
  if (!scrollRef?.current) return;

  delays.forEach((delay) => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated });
    }, delay);
  });
}
