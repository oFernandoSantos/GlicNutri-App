import { supabase } from './configSupabase';

function inferActorType(actor) {
  if (!actor || typeof actor !== 'object') {
    return 'anonimo';
  }

  if (actor.id_nutricionista_uuid || actor.crm_numero || actor.email_acesso) {
    return 'nutricionista';
  }

  if (actor.id_paciente_uuid || actor.cpf_paciente || actor.email_pac || actor.patient_id) {
    return 'paciente';
  }

  return 'anonimo';
}

function buildSafeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {};
  }

  const sanitized = { ...details };
  delete sanitized.senha;
  delete sanitized.senha_pac;
  delete sanitized.senha_nutri;
  delete sanitized.codigo;
  delete sanitized.code;
  delete sanitized.access_token;
  delete sanitized.refresh_token;

  return sanitized;
}

export async function registrarLogAuditoria({
  actor,
  actorType,
  targetPatientId,
  action,
  entity,
  entityId,
  origin = 'app',
  status = 'sucesso',
  details = {},
} = {}) {
  if (!action || !entity) {
    return null;
  }

  const resolvedActorType = actorType || inferActorType(actor);
  const actorPatientId =
    resolvedActorType === 'paciente'
      ? actor?.id_paciente_uuid || actor?.patient_id || actor?.user_metadata?.id_paciente_uuid || null
      : null;
  const actorNutritionistId =
    resolvedActorType === 'nutricionista' ? actor?.id_nutricionista_uuid || null : null;

  try {
    const { data, error } = await supabase.rpc('registrar_log_auditoria_app', {
      p_tipo_ator: resolvedActorType,
      p_id_paciente_ator: actorPatientId,
      p_id_nutricionista_ator: actorNutritionistId,
      p_id_paciente_alvo: targetPatientId || actorPatientId || null,
      p_acao: action,
      p_entidade: entity,
      p_id_entidade: entityId ? String(entityId) : null,
      p_origem: origin,
      p_status: status,
      p_detalhes: buildSafeDetails(details),
    });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data[0] || null : data || null;
  } catch (error) {
    console.log('Erro ao registrar log de auditoria:', error);
    return null;
  }
}
