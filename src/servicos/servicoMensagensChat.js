import { supabase } from './configSupabase';
import { stripRegistroMetaFromChatText } from '../utilitarios/registrosProntuarioNutri';
import {
  enrichRpcClinicalParams,
  garantirSessaoRpcClinicaComPerfil,
  normalizeRpcActorProfile,
  supabaseRpcClinica,
} from './servicoSessaoRpc';

/** Garante token RPC antes de listar/enviar chat (nutri ou paciente). */
export async function enrichChatRpcParams(
  params = {},
  pacienteId = null,
  sessionProfile = null,
  rpcActor = null
) {
  const actor = normalizeRpcActorProfile(rpcActor) || normalizeRpcActorProfile(sessionProfile);
  const profile = actor || sessionProfile;
  try {
    return await enrichRpcClinicalParams(params, pacienteId, profile);
  } catch (firstError) {
    if (!actor) throw firstError;
    await garantirSessaoRpcClinicaComPerfil(actor);
    return await enrichRpcClinicalParams(params, pacienteId, actor);
  }
}

function normalizeThreadEntry(
  item,
  { nutritionistName = 'Nutricionista', patientName = 'Paciente' } = {}
) {
  const role = item?.role === 'nutri' ? 'nutri' : 'user';
  const textRaw = String(
    item?.textRaw ?? item?.texto_bruto ?? item?.text ?? item?.texto ?? ''
  ).trim();
  const text = stripRegistroMetaFromChatText(textRaw).trim() || textRaw;

  return {
    id: item?.id || `thread-${role}-${Date.now()}`,
    author:
      String(item?.author || '').trim() ||
      (role === 'nutri' ? nutritionistName : patientName),
    role,
    time: String(item?.time || '').trim(),
    text,
    textRaw: textRaw || text,
    registroContext: item?.registroContext || item?.registroPayload || null,
    createdAt: item?.createdAt || item?.created_at || null,
  };
}

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

export function mapChatRowToThreadEntry(
  row,
  { nutritionistName = 'Nutricionista', patientName = 'Paciente' } = {}
) {
  const role = row?.autor_role === 'nutricionista' ? 'nutri' : 'user';
  const texto = String(row?.texto || '').trim();

  return {
    ...normalizeThreadEntry(
      {
        id: row?.id,
        role,
        author: role === 'nutri' ? nutritionistName : patientName,
        time: formatMessageTime(row?.created_at),
        text: texto,
        texto_bruto: texto,
      },
      { nutritionistName, patientName }
    ),
    createdAt: row?.created_at || null,
  };
}

export function sortChatThreadByCreatedAt(thread = []) {
  return [...(thread || [])].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || left?.time || 0).getTime();
    const rightTime = new Date(right?.createdAt || right?.time || 0).getTime();
    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
    if (!Number.isFinite(leftTime)) return -1;
    if (!Number.isFinite(rightTime)) return 1;
    return leftTime - rightTime;
  });
}

function resolveSessionProfile(rpcActor, { pacienteId, nutricionistaId, resolvedNutriId, autorRole }) {
  const normalized = normalizeRpcActorProfile(rpcActor);
  if (normalized?.id_nutricionista_uuid || normalized?.id_paciente_uuid) {
    return normalized;
  }

  const role =
    autorRole === 'nutri' || autorRole === 'nutricionista' ? 'nutricionista' : autorRole;
  const nutriId = nutricionistaId || resolvedNutriId;
  const email =
    rpcActor?.email_acesso ||
    rpcActor?.email ||
    rpcActor?.email_nutri ||
    '';

  if (role === 'nutricionista' && nutriId) {
    return {
      tipo_perfil: 'nutricionista',
      id_nutricionista_uuid: nutriId,
      email_acesso: email,
      email,
    };
  }
  if (pacienteId) {
    return { id_paciente_uuid: pacienteId };
  }
  if (nutriId) {
    return {
      tipo_perfil: 'nutricionista',
      id_nutricionista_uuid: nutriId,
      email_acesso: email,
      email,
    };
  }
  return normalized;
}

export async function resolveNutricionistaIdForPatient(pacienteId, fallbackNutriId = null) {
  if (!pacienteId) return fallbackNutriId || null;

  if (fallbackNutriId) return fallbackNutriId;

  const { data: patient } = await supabase
    .from('paciente')
    .select('id_nutricionista_uuid')
    .eq('id_paciente_uuid', pacienteId)
    .maybeSingle();

  if (patient?.id_nutricionista_uuid) return patient.id_nutricionista_uuid;

  const { data: consulta } = await supabase
    .from('consulta')
    .select('nutricionista_id')
    .eq('paciente_id', pacienteId)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return consulta?.nutricionista_id || null;
}

export async function fetchChatThreadFromDatabase({
  pacienteId,
  nutricionistaId,
  nutritionistName = 'Nutricionista',
  patientName = 'Paciente',
  limit = 200,
  rpcActor = null,
}) {
  const resolvedNutriId = await resolveNutricionistaIdForPatient(pacienteId, nutricionistaId);
  if (!pacienteId || !resolvedNutriId) return [];

  const sessionProfile = resolveSessionProfile(rpcActor, {
    pacienteId,
    nutricionistaId,
    resolvedNutriId,
  });

  const baseRpcParams = {
    p_paciente_id: pacienteId,
    p_nutricionista_id: resolvedNutriId,
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
    console.log('Falha ao preparar sessao RPC do chat:', error?.message || error);
    try {
      const actor = rpcActor || sessionProfile;
      if (actor) {
        await garantirSessaoRpcClinicaComPerfil(actor);
      }
      rpcParams = await enrichChatRpcParams(
        baseRpcParams,
        pacienteId,
        sessionProfile,
        rpcActor || sessionProfile
      );
    } catch (retryError) {
      console.log('Retry sessao RPC do chat:', retryError?.message || retryError);
      return null;
    }
  }

  const { data, error } = await supabaseRpcClinica(
    'listar_mensagens_chat',
    baseRpcParams,
    { pacienteId, user: rpcActor || sessionProfile }
  );

  if (error) {
    console.log('RPC listar_mensagens_chat:', error.message);
    if (isMissingRpc(error, 'listar_mensagens_chat')) return null;
    throw error;
  }

  return sortChatThreadByCreatedAt(
    (data || []).map((row) => mapChatRowToThreadEntry(row, { nutritionistName, patientName }))
  );
}

export async function sendChatMessage({
  pacienteId,
  nutricionistaId,
  autorRole,
  texto,
  nutritionistName = 'Nutricionista',
  patientName = 'Paciente',
  rpcActor = null,
}) {
  const resolvedNutriId = await resolveNutricionistaIdForPatient(pacienteId, nutricionistaId);
  if (!pacienteId || !resolvedNutriId) {
    throw new Error('Vinculo com nutricionista necessario para enviar mensagem.');
  }

  const role = autorRole === 'nutri' || autorRole === 'nutricionista' ? 'nutricionista' : 'paciente';
  const sessionProfile = resolveSessionProfile(rpcActor, {
    pacienteId,
    nutricionistaId,
    resolvedNutriId,
    autorRole: role,
  });

  const { data, error } = await supabaseRpcClinica(
    'enviar_mensagem_chat',
    {
      p_paciente_id: pacienteId,
      p_nutricionista_id: resolvedNutriId,
      p_autor_role: role,
      p_texto: String(texto || '').trim(),
    },
    { pacienteId, user: rpcActor || sessionProfile }
  );

  if (error) {
    console.log('RPC enviar_mensagem_chat:', error.message);
    if (isMissingRpc(error, 'enviar_mensagem_chat')) {
      throw new Error('Chat indisponivel no servidor.');
    }
    throw error;
  }

  return mapChatRowToThreadEntry(data, { nutritionistName, patientName });
}

export async function migrateLegacyThreadToDatabase({
  pacienteId,
  nutricionistaId,
  legacyThread = [],
  nutritionistName = 'Nutricionista',
  patientName = 'Paciente',
  rpcActor = null,
}) {
  const resolvedNutriId = await resolveNutricionistaIdForPatient(pacienteId, nutricionistaId);
  if (!pacienteId || !resolvedNutriId || !legacyThread?.length) return [];

  const existing = await fetchChatThreadFromDatabase({
    pacienteId,
    nutricionistaId: resolvedNutriId,
    nutritionistName,
    patientName,
    limit: 5,
    rpcActor,
  });

  if (existing === null) return null;
  if (existing?.length) return existing;

  for (const item of legacyThread) {
    const textRaw = String(
      item?.textRaw ?? item?.texto_bruto ?? item?.text ?? item?.texto ?? ''
    ).trim();
    if (!textRaw) continue;
    const itemRole = item?.role === 'nutri' ? 'nutricionista' : 'paciente';
    try {
      await sendChatMessage({
        pacienteId,
        nutricionistaId: resolvedNutriId,
        autorRole: itemRole,
        texto: textRaw,
        nutritionistName,
        patientName,
        rpcActor,
      });
    } catch (error) {
      console.log('Erro ao migrar mensagem legada:', error);
    }
  }

  return fetchChatThreadFromDatabase({
    pacienteId,
    nutricionistaId: resolvedNutriId,
    nutritionistName,
    patientName,
    rpcActor,
  });
}
