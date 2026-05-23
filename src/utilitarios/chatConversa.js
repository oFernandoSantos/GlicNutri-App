import { Platform } from 'react-native';
import {
  buildNutritionistThreadPreview,
  normalizeNutritionistThreadEntry,
} from '../servicos/servicoDadosPaciente';

export const CHAT_COMPACT_BREAKPOINT = 900;

export function isChatCompactLayout(windowWidth) {
  if (Platform.OS !== 'web') return true;
  return Number(windowWidth || 0) < CHAT_COMPACT_BREAKPOINT;
}

export function normalizeChatMessages(
  thread = [],
  { nutritionistName = 'Nutricionista', patientName = 'Paciente' } = {}
) {
  return (Array.isArray(thread) ? thread : [])
    .map((item) =>
      normalizeNutritionistThreadEntry(item, { nutritionistName, patientName })
    )
    .filter((item) => item.text);
}

export function buildPatientChatPreview(thread = [], options = {}) {
  const messages = normalizeChatMessages(thread, options);
  const lastMessage = messages[messages.length - 1] || null;
  let unread = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== 'nutri') break;
    unread += 1;
  }

  return {
    messages,
    lastMessage: lastMessage?.text || '',
    lastMessageAt: lastMessage?.time || '',
    unread,
  };
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
