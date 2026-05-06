import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';

export function normalizeConsultaStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  const allowed = new Set(['scheduled', 'confirmed', 'cancelled', 'done', 'no_show']);
  return allowed.has(status) ? status : 'scheduled';
}

export function formatConsultaDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export async function createConsulta({
  nutricionistaId,
  pacienteId,
  scheduledAt,
  motivo,
  actor,
  origin = 'agendamento_paciente',
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador para agendar.');
  if (!pacienteId) throw new Error('Paciente sem identificador para agendar.');
  if (!scheduledAt) throw new Error('Horario nao informado para agendamento.');

  const payload = {
    nutricionista_id: nutricionistaId,
    paciente_id: pacienteId,
    scheduled_at: scheduledAt,
    status: 'scheduled',
    motivo: motivo ? String(motivo).trim() : null,
  };

  const { data, error } = await supabase
    .from('consulta')
    .insert([payload])
    .select('*')
    .maybeSingle();

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('idx_consulta_unique_slot')) {
      throw new Error('Este horario ja foi reservado. Escolha outro slot.');
    }
    throw error;
  }

  if (data?.id) {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || null,
      targetPatientId: pacienteId,
      action: 'consulta_agendada',
      entity: 'consulta',
      entityId: data.id,
      origin,
      details: {
        nutricionistaId,
        scheduledAt,
        status: data.status,
      },
    });
  }

  return data;
}

export async function listConsultasByNutricionista(nutricionistaId, { limit = 120 } = {}) {
  if (!nutricionistaId) return [];

  const { data, error } = await supabase
    .from('consulta')
    .select('*')
    .eq('nutricionista_id', nutricionistaId)
    .order('scheduled_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function listConsultasByPaciente(pacienteId, { limit = 120 } = {}) {
  if (!pacienteId) return [];

  const { data, error } = await supabase
    .from('consulta')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('scheduled_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function updateConsultaStatus({
  consultaId,
  status,
  observacoesNutri,
  actor,
  origin = 'agenda_nutricionista',
}) {
  if (!consultaId) throw new Error('Consulta sem identificador para atualizar.');

  const nextStatus = normalizeConsultaStatus(status);
  const patch = {
    status: nextStatus,
    observacoes_nutri: typeof observacoesNutri === 'string' ? observacoesNutri : undefined,
  };

  const { data, error } = await supabase
    .from('consulta')
    .update(patch)
    .eq('id', consultaId)
    .select('*')
    .maybeSingle();

  if (error) throw error;

  if (data?.id) {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || null,
      targetPatientId: data.paciente_id || null,
      action: 'consulta_atualizada_status',
      entity: 'consulta',
      entityId: data.id,
      origin,
      details: {
        status: data.status,
        scheduledAt: data.scheduled_at,
      },
    });
  }

  return data;
}

