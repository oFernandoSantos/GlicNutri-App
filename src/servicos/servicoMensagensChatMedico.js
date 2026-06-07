import { supabase } from './configSupabase';
import { stripRegistroMetaFromChatText } from '../utilitarios/registrosProntuarioNutri';
import {
  enrichChatRpcParams,
  garantirSessaoRpcClinicaComPerfil,
  normalizeRpcActorProfile,
  supabaseRpcClinica,
} from './servicoSessaoRpc';
import { sortChatThreadByCreatedAt } from './servicoMensagensChat';

const INBOX_ID_CHUNK = 40;
const INBOX_MESSAGES_PER_PATIENT = 12;

function isMissingRpc(error, name) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(name.toLowerCase()) || error?.code === 'PGRST202';
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

export function mapMedicoChatRowToThreadEntry(
  row,
  { medicoName = 'Medico', patientName = 'Paciente' } = {}
) {
  const role = row?.autor_role === 'medico' ? 'medico' : 'user';
  const texto = String(row?.texto || '').trim();

  return {
    id: row?.id,
    author: role === 'medico' ? medicoName : patientName,
    role,
    time: formatMessageTime(row?.created_at),
    text: stripRegistroMetaFromChatText(texto).trim() || texto,
    textRaw: texto,
    registroContext: null,
    createdAt: row?.created_at || null,
  };
}

function resolveMedicoSessionProfile(rpcActor, { pacienteId, medicoId, autorRole }) {
  const normalized = normalizeRpcActorProfile(rpcActor);
  if (normalized?.id_medico_uuid || normalized?.id_paciente_uuid) {
    return normalized;
  }

  const role = autorRole === 'medico' ? 'medico' : autorRole;
  const email =
    rpcActor?.email_medico ||
    rpcActor?.email_acesso ||
    rpcActor?.email ||
    '';

  if (role === 'medico' && medicoId) {
    return {
      tipo_perfil: 'medico',
      id_medico_uuid: medicoId,
      email_acesso: email,
      email,
    };
  }
  if (pacienteId) {
    return { id_paciente_uuid: pacienteId };
  }
  if (medicoId) {
    return {
      tipo_perfil: 'medico',
      id_medico_uuid: medicoId,
      email_acesso: email,
      email,
    };
  }
  return normalized;
}

export async function resolveMedicoIdForPatient(pacienteId, fallbackMedicoId = null) {
  if (!pacienteId) return fallbackMedicoId || null;
  if (fallbackMedicoId) return fallbackMedicoId;

  const { data: patient } = await supabase
    .from('paciente')
    .select('id_medico_uuid')
    .eq('id_paciente_uuid', pacienteId)
    .maybeSingle();

  if (patient?.id_medico_uuid) return patient.id_medico_uuid;

  const { data: consulta } = await supabase
    .from('consulta')
    .select('medico_id')
    .eq('paciente_id', pacienteId)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return consulta?.medico_id || null;
}

export async function fetchMedicoChatThreadFromDatabase({
  pacienteId,
  medicoId,
  medicoName = 'Medico',
  patientName = 'Paciente',
  limit = 200,
  rpcActor = null,
}) {
  const resolvedMedicoId = await resolveMedicoIdForPatient(pacienteId, medicoId);
  if (!pacienteId || !resolvedMedicoId) return [];

  const sessionProfile = resolveMedicoSessionProfile(rpcActor, {
    pacienteId,
    medicoId: resolvedMedicoId,
  });

  const baseRpcParams = {
    p_paciente_id: pacienteId,
    p_medico_id: resolvedMedicoId,
    p_limite: limit,
  };

  let rpcParams;
  try {
    rpcParams = await enrichChatRpcParams(
      baseRpcParams,
      pacienteId,
      sessionProfile,
      rpcActor || sessionProfile
    );
  } catch (error) {
    console.log('Falha ao preparar sessao RPC chat medico:', error?.message || error);
    try {
      const actor = rpcActor || sessionProfile;
      if (actor) await garantirSessaoRpcClinicaComPerfil(actor);
      rpcParams = await enrichChatRpcParams(
        baseRpcParams,
        pacienteId,
        sessionProfile,
        rpcActor || sessionProfile
      );
    } catch (retryError) {
      console.log('Retry sessao RPC chat medico:', retryError?.message || retryError);
      return null;
    }
  }

  const { data, error } = await supabaseRpcClinica(
    'listar_mensagens_chat_medico',
    baseRpcParams,
    { pacienteId, user: rpcActor || sessionProfile }
  );

  if (error) {
    console.log('RPC listar_mensagens_chat_medico:', error.message);
    if (isMissingRpc(error, 'listar_mensagens_chat_medico')) return null;
    throw error;
  }

  return sortChatThreadByCreatedAt(
    (data || []).map((row) => mapMedicoChatRowToThreadEntry(row, { medicoName, patientName }))
  );
}

export async function sendMedicoChatMessage({
  pacienteId,
  medicoId,
  autorRole,
  texto,
  medicoName = 'Medico',
  patientName = 'Paciente',
  rpcActor = null,
}) {
  const resolvedMedicoId = await resolveMedicoIdForPatient(pacienteId, medicoId);
  if (!pacienteId || !resolvedMedicoId) {
    throw new Error('Vinculo com medico necessario para enviar mensagem.');
  }

  const role =
    autorRole === 'medico' || autorRole === 'nutri'
      ? 'medico'
      : 'paciente';
  const sessionProfile = resolveMedicoSessionProfile(rpcActor, {
    pacienteId,
    medicoId: resolvedMedicoId,
    autorRole: role,
  });

  const { data, error } = await supabaseRpcClinica(
    'enviar_mensagem_chat_medico',
    {
      p_paciente_id: pacienteId,
      p_medico_id: resolvedMedicoId,
      p_autor_role: role,
      p_texto: String(texto || '').trim(),
    },
    { pacienteId, user: rpcActor || sessionProfile }
  );

  if (error) {
    console.log('RPC enviar_mensagem_chat_medico:', error.message);
    if (isMissingRpc(error, 'enviar_mensagem_chat_medico')) {
      throw new Error('Chat medico indisponivel no servidor.');
    }
    throw error;
  }

  return mapMedicoChatRowToThreadEntry(data, { medicoName, patientName });
}

export async function fetchMedicoInboxMessagesGrouped(medicoId, patientIds = [], rpcActor = null) {
  if (!medicoId || !patientIds.length) return new Map();

  const sessionActor =
    normalizeRpcActorProfile(rpcActor) ||
    (medicoId ? { tipo_perfil: 'medico', id_medico_uuid: medicoId } : null);

  const aggregated = [];

  for (let index = 0; index < patientIds.length; index += INBOX_ID_CHUNK) {
    const chunk = patientIds.slice(index, index + INBOX_ID_CHUNK);
    let rpcParams = null;

    try {
      await enrichChatRpcParams(
        {
          p_medico_id: medicoId,
          p_paciente_ids: chunk,
          p_mensagens_por_paciente: INBOX_MESSAGES_PER_PATIENT,
        },
        null,
        sessionActor,
        sessionActor
      );
    } catch (sessionError) {
      console.log('Sessao RPC inbox chat medico:', sessionError?.message || sessionError);
      continue;
    }

    const { data, error } = await supabaseRpcClinica(
      'listar_mensagens_chat_medico_inbox',
      {
        p_medico_id: medicoId,
        p_paciente_ids: chunk,
        p_mensagens_por_paciente: INBOX_MESSAGES_PER_PATIENT,
      },
      { user: sessionActor }
    );

    if (!error && Array.isArray(data)) {
      aggregated.push(...data);
      continue;
    }

    if (error && !isMissingRpc(error, 'listar_mensagens_chat_medico_inbox')) {
      console.log('RPC listar_mensagens_chat_medico_inbox:', error.message);
    }
  }

  const map = new Map();
  aggregated.forEach((row) => {
    const pid = row?.paciente_id;
    if (!pid) return;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push(row);
  });

  map.forEach((rows, pid) => {
    map.set(
      pid,
      [...rows].sort(
        (a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime()
      )
    );
  });

  return map;
}

export function mapMedicoRealtimeChatRowToThreadEntry(row, patientName, options = {}) {
  if (!row?.texto) return null;
  return mapMedicoChatRowToThreadEntry(row, {
    medicoName: options.medicoName || 'Medico',
    patientName: patientName || 'Paciente',
  });
}
