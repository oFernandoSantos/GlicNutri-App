import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildNutritionistThreadPreview,
  normalizeNutritionistThreadEntry,
} from '../servicos/servicoDadosPaciente';

export const CHAT_COMPACT_BREAKPOINT = 900;
const PATIENT_CHAT_READ_PREFIX = '@glicnutri:patientChatReadAt:';

export function isChatCompactLayout(windowWidth) {
  if (Platform.OS !== 'web') return true;
  return Number(windowWidth || 0) < CHAT_COMPACT_BREAKPOINT;
}

export function normalizeChatMessages(
  thread = [],
  { nutritionistName = 'Nutricionista', patientName = 'Paciente' } = {}
) {
  return (Array.isArray(thread) ? thread : [])
    .map((item) => ({
      ...normalizeNutritionistThreadEntry(item, { nutritionistName, patientName }),
      createdAt: item?.createdAt || item?.created_at || null,
    }))
    .filter((item) => item.text);
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

export function buildNutriChatPreview(thread = [], options = {}) {
  return buildNutritionistThreadPreview(normalizeChatMessages(thread, options));
}

export function getLastChatMessage(thread = [], options = {}) {
  const messages = normalizeChatMessages(thread, options);
  return messages[messages.length - 1] || null;
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
