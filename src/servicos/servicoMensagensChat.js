import { supabase } from './configSupabase';
import { normalizeNutritionistThreadEntry } from './servicoDadosPaciente';

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
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function mapRowToThreadEntry(row, { nutritionistName, patientName }) {
  const role = row?.autor_role === 'nutricionista' ? 'nutri' : 'user';
  return normalizeNutritionistThreadEntry(
    {
      id: row?.id,
      role,
      author: role === 'nutri' ? nutritionistName : patientName,
      time: formatMessageTime(row?.created_at),
      text: row?.texto,
    },
    { nutritionistName, patientName }
  );
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
}) {
  const resolvedNutriId = await resolveNutricionistaIdForPatient(pacienteId, nutricionistaId);
  if (!pacienteId || !resolvedNutriId) return [];

  const { data, error } = await supabase.rpc('listar_mensagens_chat', {
    p_paciente_id: pacienteId,
    p_nutricionista_id: resolvedNutriId,
    p_limite: limit,
  });

  if (error) {
    if (isMissingRpc(error, 'listar_mensagens_chat')) return null;
    throw error;
  }

  return (data || []).map((row) => mapRowToThreadEntry(row, { nutritionistName, patientName }));
}

export async function sendChatMessage({
  pacienteId,
  nutricionistaId,
  autorRole,
  texto,
  nutritionistName = 'Nutricionista',
  patientName = 'Paciente',
}) {
  const resolvedNutriId = await resolveNutricionistaIdForPatient(pacienteId, nutricionistaId);
  if (!pacienteId || !resolvedNutriId) {
    throw new Error('Vinculo com nutricionista necessario para enviar mensagem.');
  }

  const role = autorRole === 'nutri' || autorRole === 'nutricionista' ? 'nutricionista' : 'paciente';

  const { data, error } = await supabase.rpc('enviar_mensagem_chat', {
    p_paciente_id: pacienteId,
    p_nutricionista_id: resolvedNutriId,
    p_autor_role: role,
    p_texto: String(texto || '').trim(),
  });

  if (error) {
    if (isMissingRpc(error, 'enviar_mensagem_chat')) return null;
    throw error;
  }

  return mapRowToThreadEntry(data, { nutritionistName, patientName });
}

export async function migrateLegacyThreadToDatabase({
  pacienteId,
  nutricionistaId,
  legacyThread = [],
  nutritionistName = 'Nutricionista',
  patientName = 'Paciente',
}) {
  const resolvedNutriId = await resolveNutricionistaIdForPatient(pacienteId, nutricionistaId);
  if (!pacienteId || !resolvedNutriId || !legacyThread?.length) return [];

  const existing = await fetchChatThreadFromDatabase({
    pacienteId,
    nutricionistaId: resolvedNutriId,
    nutritionistName,
    patientName,
    limit: 5,
  });

  if (existing === null) return null;
  if (existing?.length) return existing;

  for (const item of legacyThread) {
    const text = String(item?.text || '').trim();
    if (!text) continue;
    const role = item?.role === 'nutri' ? 'nutricionista' : 'paciente';
    try {
      await sendChatMessage({
        pacienteId,
        nutricionistaId: resolvedNutriId,
        autorRole: role,
        texto: text,
        nutritionistName,
        patientName,
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
  });
}
