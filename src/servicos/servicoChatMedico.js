import { stripRegistroMetaFromChatText } from '../utilitarios/registrosProntuarioNutri';
import { sortChatThreadByCreatedAt } from './servicoMensagensChat';
import { supabase } from './configSupabase';
import {
  garantirSessaoRpcClinicaComPerfil,
  normalizeRpcActorProfile,
} from './servicoSessaoRpc';
import {
  fetchMedicoChatThreadFromDatabase,
  fetchMedicoInboxMessagesGrouped,
  mapMedicoChatRowToThreadEntry,
  resolveMedicoIdForPatient,
  sendMedicoChatMessage,
} from './servicoMensagensChatMedico';

const INBOX_TTL_MS = 45_000;
const inboxCache = new Map();
const inboxInFlight = new Map();

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatMessageTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractObjectiveText(patient) {
  const raw = String(patient?.objetivo_principal_consulta || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.objective || parsed?.objetivo || raw).trim();
  } catch {
    return raw;
  }
}

export function isMedicoProfessionalRole(role) {
  return role === 'medico' || role === 'nutri';
}

export function normalizeMedicoThreadEntry(
  item,
  { medicoName = 'Medico', patientName = 'Paciente' } = {}
) {
  const role = isMedicoProfessionalRole(item?.role) ? 'medico' : 'user';
  const textRaw = String(item?.textRaw ?? item?.texto_bruto ?? item?.text ?? item?.texto ?? '').trim();
  const sanitized = textRaw;
  const text = stripRegistroMetaFromChatText(sanitized).trim() || sanitized;

  return {
    id: item?.id || `thread-${role}-${Date.now()}`,
    author: String(item?.author || '').trim() || (role === 'medico' ? medicoName : patientName),
    role,
    time: String(item?.time || '').trim() || formatMessageTime(item?.createdAt || item?.created_at),
    text,
    textRaw: textRaw || text,
    registroContext: item?.registroContext || item?.registroPayload || null,
    createdAt: item?.createdAt || item?.created_at || null,
  };
}

export function buildMedicoThreadPreview(thread = [], { lastReadAt = null } = {}) {
  const normalized = sortChatThreadByCreatedAt(
    ensureArray(thread)
      .map((item) => normalizeMedicoThreadEntry(item))
      .filter((item) => item.text)
  );
  const lastMessage = normalized[normalized.length - 1] || null;
  let unread = 0;
  const readTimestamp = lastReadAt ? new Date(lastReadAt).getTime() : 0;

  if (readTimestamp > 0) {
    unread = normalized.filter((message) => {
      if (message?.role !== 'user') return false;
      const createdAt = new Date(message.createdAt || message.time || 0).getTime();
      return Number.isFinite(createdAt) && createdAt > readTimestamp;
    }).length;
  } else {
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (normalized[index]?.role !== 'user') break;
      unread += 1;
    }
  }

  return {
    lastMessage: lastMessage?.text || 'Sem mensagens ainda.',
    lastMessageAt: lastMessage?.time || '',
    unread,
  };
}

/** Preview do lado paciente: nao lidas = msgs do medico. */
export function buildPatientMedicoChatPreview(thread = [], { lastReadAt = null } = {}) {
  const normalized = sortChatThreadByCreatedAt(
    ensureArray(thread)
      .map((item) => normalizeMedicoThreadEntry(item))
      .filter((item) => item.text)
  );
  const lastMessage = normalized[normalized.length - 1] || null;
  let unread = 0;
  const readTimestamp = lastReadAt ? new Date(lastReadAt).getTime() : 0;

  if (readTimestamp > 0) {
    unread = normalized.filter((message) => {
      if (message?.role !== 'medico') return false;
      const createdAt = new Date(message.createdAt || message.time || 0).getTime();
      return Number.isFinite(createdAt) && createdAt > readTimestamp;
    }).length;
  } else {
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (normalized[index]?.role !== 'medico') break;
      unread += 1;
    }
  }

  return {
    lastMessage: lastMessage?.text || 'Sem mensagens ainda.',
    lastMessageAt: lastMessage?.time || '',
    unread,
  };
}

function isOptimisticMedicoChatMessageId(id) {
  return /^(user|medico|thread)-/.test(String(id || ''));
}

export function mergeMedicoChatMessageIntoThread(thread = [], message = null) {
  const normalizedThread = ensureArray(thread).map((item) => normalizeMedicoThreadEntry(item));
  const normalizedMessage = message ? normalizeMedicoThreadEntry(message) : null;
  if (!normalizedMessage?.text) return normalizedThread;

  if (normalizedMessage.id) {
    const byId = normalizedThread.some((item) => item.id === normalizedMessage.id);
    if (byId) return sortChatThreadByCreatedAt(normalizedThread);
  }

  let workingThread = normalizedThread;
  const hasServerId =
    normalizedMessage.id && !isOptimisticMedicoChatMessageId(normalizedMessage.id);

  if (hasServerId) {
    workingThread = normalizedThread.filter((item) => {
      if (item.role !== normalizedMessage.role || item.text !== normalizedMessage.text) {
        return true;
      }
      return !isOptimisticMedicoChatMessageId(item.id);
    });
  }

  const alreadyPresent = workingThread.some((item) => {
    if (item.role !== normalizedMessage.role || item.text !== normalizedMessage.text) {
      return false;
    }
    if (item.id === normalizedMessage.id) return true;

    const itemTime = new Date(item.createdAt || item.time || 0).getTime();
    const messageTime = new Date(
      normalizedMessage.createdAt || normalizedMessage.time || 0
    ).getTime();
    if (Number.isFinite(itemTime) && Number.isFinite(messageTime)) {
      return Math.abs(itemTime - messageTime) < 120000;
    }

    return item.time === normalizedMessage.time;
  });

  if (alreadyPresent) {
    return sortChatThreadByCreatedAt(workingThread);
  }

  return sortChatThreadByCreatedAt([...workingThread, normalizedMessage]);
}

function hashIdsForCache(ids = []) {
  return [...ids].sort().join(',');
}

export async function fetchCachedMedicoChatInbox(medicoId, patientIds, loader) {
  if (!medicoId) return loader();

  const cacheKey = `${medicoId}:inbox:${hashIdsForCache(patientIds)}`;
  const cached = inboxCache.get(cacheKey);
  if (cached && Date.now() - cached.at < INBOX_TTL_MS) {
    return cached.data;
  }

  if (inboxInFlight.has(cacheKey)) {
    return inboxInFlight.get(cacheKey);
  }

  const promise = loader()
    .then((data) => {
      inboxCache.set(cacheKey, { at: Date.now(), data });
      inboxInFlight.delete(cacheKey);
      return data;
    })
    .catch((error) => {
      inboxInFlight.delete(cacheKey);
      throw error;
    });

  inboxInFlight.set(cacheKey, promise);
  return promise;
}

export function invalidateMedicoChatInboxCache(medicoId) {
  if (!medicoId) {
    inboxCache.clear();
    inboxInFlight.clear();
    return;
  }

  [...inboxCache.keys()].forEach((key) => {
    if (key.startsWith(`${medicoId}:`)) inboxCache.delete(key);
  });
  [...inboxInFlight.keys()].forEach((key) => {
    if (key.startsWith(`${medicoId}:`)) inboxInFlight.delete(key);
  });
}

export async function fetchMedicoChatInboxForPatientIds(
  patientIds = [],
  medicoId = null,
  patientCardsById = new Map(),
  rpcActor = null
) {
  const resolvedIds = [...new Set((patientIds || []).filter(Boolean))];
  if (!resolvedIds.length || !medicoId) return [];

  let messagesByPatient = new Map();
  try {
    messagesByPatient = await fetchMedicoInboxMessagesGrouped(medicoId, resolvedIds, rpcActor);
  } catch (error) {
    console.log('Inbox chat medico indisponivel:', error);
  }

  return resolvedIds
    .map((patientId) => {
      const card = patientCardsById.get(patientId);
      const patient = card?.raw || card || { id_paciente_uuid: patientId, nome_completo: card?.name };
      if (!patient) return null;

      const patientName = patient?.nome_completo || patient?.email_pac || card?.name || 'Paciente';
      const rows = messagesByPatient.get(patientId) || [];
      const thread = rows
        .map((row) => mapMedicoChatRowToThreadEntry(row, { patientName }))
        .filter((item) => item.text);
      const preview = buildMedicoThreadPreview(thread);
      const lastRow = rows.length ? rows[rows.length - 1] : null;

      return {
        patient,
        clinicalObjective: extractObjectiveText(patient),
        preview,
        lastMessageCreatedAt: lastRow?.created_at || null,
        thread: ensureArray(thread),
      };
    })
    .filter(Boolean);
}

async function resolveMedicoChatThreadFallback(
  patientId,
  resolvedMedicoId,
  { patientName = 'Paciente', medicoName = 'Medico', rpcActor = null, limit = 200 } = {}
) {
  if (!patientId || !resolvedMedicoId) return [];

  try {
    const inboxMap = await fetchMedicoInboxMessagesGrouped(
      resolvedMedicoId,
      [patientId],
      rpcActor
    );
    const rows = inboxMap.get(patientId) || [];
    if (rows.length) {
      const inboxThread = rows
        .map((row) => mapMedicoChatRowToThreadEntry(row, { medicoName, patientName }))
        .filter((item) => item.text);
      if (inboxThread.length) {
        return sortChatThreadByCreatedAt(inboxThread).slice(-Math.max(1, limit));
      }
    }
  } catch (inboxError) {
    console.log('Fallback inbox chat medico:', inboxError?.message || inboxError);
  }

  return [];
}

export async function fetchMedicoChatThreadForPatient(
  patientId,
  medicoId,
  { patientName = 'Paciente', medicoName = 'Medico', limit = 200, rpcActor = null } = {}
) {
  if (!patientId) return [];

  const resolvedMedicoId = medicoId || (await resolveMedicoIdForPatient(patientId));
  const sessionActor =
    normalizeRpcActorProfile(rpcActor) ||
    (resolvedMedicoId ? { tipo_perfil: 'medico', id_medico_uuid: resolvedMedicoId } : null);

  if (!resolvedMedicoId) {
    const fallbackOnly = await resolveMedicoChatThreadFallback(patientId, null, {
      patientName,
      medicoName,
      rpcActor: sessionActor,
      limit,
    });
    if (fallbackOnly.length) {
      return fallbackOnly.map((item) => normalizeMedicoThreadEntry(item, { medicoName, patientName }));
    }
    throw new Error('Paciente sem medico vinculado para abrir o chat.');
  }

  if (sessionActor) {
    await garantirSessaoRpcClinicaComPerfil(sessionActor).catch((error) => {
      console.log('Sessao RPC thread medico:', error?.message || error);
    });
  }

  let thread = await fetchMedicoChatThreadFromDatabase({
    pacienteId: patientId,
    medicoId: resolvedMedicoId,
    medicoName,
    patientName,
    limit,
    rpcActor: sessionActor || rpcActor,
  });

  if (thread === null) {
    thread = await resolveMedicoChatThreadFallback(patientId, resolvedMedicoId, {
      patientName,
      medicoName,
      rpcActor: sessionActor || rpcActor,
      limit,
    });
  }

  if (!Array.isArray(thread)) {
    throw new Error('Nao foi possivel carregar o historico do chat medico.');
  }

  return thread
    .filter((item) => item?.text)
    .map((item) => normalizeMedicoThreadEntry(item, { medicoName, patientName }));
}

export async function fetchPatientMedicoChatThread(
  patientId,
  medicoId,
  options = {}
) {
  const patientName = options.patientName || 'Paciente';
  const medicoName = options.medicoName || 'Medico';
  const rpcActor = options.rpcActor || options.patientContext || null;
  const fallbackThread = ensureArray(options.fallbackThread);

  try {
    const thread = await fetchMedicoChatThreadForPatient(patientId, medicoId, {
      patientName,
      medicoName,
      limit: options.limit || 200,
      rpcActor,
    });
    if (thread.length) return thread;
  } catch (error) {
    console.log('Erro ao carregar thread chat medico paciente:', error?.message || error);
  }

  if (fallbackThread.length) {
    return fallbackThread.map((item) =>
      normalizeMedicoThreadEntry(item, { medicoName, patientName })
    );
  }

  return [];
}

export async function fetchMedicoChatSummary(medicoId, patientIds = []) {
  if (!medicoId) {
    return { totalConversas: 0, naoLidas: 0, atualizadasHoje: 0 };
  }

  const { data, error } = await supabase.rpc('contar_resumo_chat_medico', {
    p_medico_id: medicoId,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row) {
    return {
      totalConversas: Number(row.total_conversas || patientIds.length || 0),
      naoLidas: Number(row.nao_lidas || 0),
      atualizadasHoje: Number(row.atualizadas_hoje || 0),
    };
  }

  if (error) {
    console.log('RPC contar_resumo_chat_medico:', error.message);
  }

  return {
    totalConversas: patientIds.length,
    naoLidas: 0,
    atualizadasHoje: 0,
  };
}

export async function savePatientMedicoChat({
  patientId,
  medicoId,
  thread,
  newMessage,
  medicoName = 'Medico',
  patientName = 'Paciente',
  rpcActor = null,
}) {
  if (!patientId || !medicoId) {
    throw new Error('Paciente ou medico sem identificador para salvar chat.');
  }

  if (newMessage?.text) {
    const isPatient = newMessage.role === 'user';
    const sent = await sendMedicoChatMessage({
      pacienteId: patientId,
      medicoId,
      autorRole: isPatient ? 'paciente' : 'medico',
      texto: newMessage.textRaw || newMessage.text,
      medicoName,
      patientName,
      rpcActor,
    });

    const baseThread = ensureArray(thread).filter((item) => item?.id !== newMessage?.id);
    const nextThread = mergeMedicoChatMessageIntoThread(baseThread, sent);
    invalidateMedicoChatInboxCache(medicoId);

    return {
      thread: nextThread,
      appState: { medicoThread: nextThread },
    };
  }

  const savedThread = await fetchMedicoChatThreadForPatient(patientId, medicoId, {
    patientName,
    medicoName,
    rpcActor,
  });

  return {
    thread: savedThread,
    appState: { medicoThread: savedThread },
  };
}
