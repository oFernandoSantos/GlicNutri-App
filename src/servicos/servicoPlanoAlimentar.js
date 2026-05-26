import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { isPatientLinkedToNutritionist } from './servicoVinculosNutricionista';

const ACTIVE_PLAN_COLUMNS =
  'id, titulo, descricao, metas, ativo, inicio_em, fim_em, updated_at, paciente_id, nutricionista_id';
const ACTIVE_PLAN_CACHE_TTL_MS = 5 * 60 * 1000;

const activePlanCache = new Map();
const activePlanInFlight = new Map();

export function getCachedActiveMealPlanForPatient(pacienteId) {
  return getCachedActivePlan(pacienteId);
}

function getCachedActivePlan(pacienteId) {
  if (!pacienteId || !activePlanCache.has(pacienteId)) {
    return undefined;
  }

  const entry = activePlanCache.get(pacienteId);
  if (Date.now() - entry.fetchedAt > ACTIVE_PLAN_CACHE_TTL_MS) {
    activePlanCache.delete(pacienteId);
    return undefined;
  }

  return entry.data;
}

export function invalidateActiveMealPlanCache(pacienteId) {
  if (!pacienteId) {
    activePlanCache.clear();
    activePlanInFlight.clear();
    return;
  }
  activePlanCache.delete(pacienteId);
  activePlanInFlight.delete(pacienteId);
}

export async function fetchActiveMealPlanForPatient(pacienteId, { forceRefresh = false } = {}) {
  if (!pacienteId) return null;

  if (!forceRefresh) {
    const cached = getCachedActivePlan(pacienteId);
    if (cached !== undefined) {
      return cached;
    }

    if (activePlanInFlight.has(pacienteId)) {
      return activePlanInFlight.get(pacienteId);
    }
  } else {
    activePlanCache.delete(pacienteId);
    activePlanInFlight.delete(pacienteId);
  }

  const promise = supabase
    .from('plano_alimentar')
    .select(ACTIVE_PLAN_COLUMNS)
    .eq('paciente_id', pacienteId)
    .eq('ativo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .then(({ data, error }) => {
      if (error) throw error;
      const plan = (data || [])[0] || null;
      activePlanCache.set(pacienteId, { data: plan, fetchedAt: Date.now() });
      activePlanInFlight.delete(pacienteId);
      return plan;
    })
    .catch((error) => {
      activePlanInFlight.delete(pacienteId);
      throw error;
    });

  activePlanInFlight.set(pacienteId, promise);
  return promise;
}

export async function listMealPlansForPatient(pacienteId, { limit = 20 } = {}) {
  if (!pacienteId) return [];

  const { data, error } = await supabase
    .from('plano_alimentar')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function upsertMealPlan({
  id,
  nutricionistaId,
  pacienteId,
  titulo,
  descricao,
  metas,
  inicioEm,
  fimEm,
  ativo = true,
  actor,
  origin = 'plano_alimentar_nutricionista',
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador para salvar plano.');
  if (!pacienteId) throw new Error('Paciente sem identificador para salvar plano.');

  const vinculado = await isPatientLinkedToNutritionist({ pacienteId, nutricionistaId });
  if (!vinculado) {
    throw new Error('Este paciente nao esta vinculado ao nutricionista logado.');
  }

  const payload = {
    ...(id ? { id } : null),
    nutricionista_id: nutricionistaId,
    paciente_id: pacienteId,
    titulo: String(titulo || 'Plano alimentar').trim() || 'Plano alimentar',
    descricao: String(descricao || '').trim(),
    metas: metas && typeof metas === 'object' ? metas : null,
    inicio_em: inicioEm || null,
    fim_em: fimEm || null,
    ativo: Boolean(ativo),
  };

  const query = id
    ? supabase
        .from('plano_alimentar')
        .update(payload)
        .eq('id', id)
    : supabase
        .from('plano_alimentar')
        .insert([payload]);

  const { data, error } = await query.select('*').maybeSingle();

  if (error) throw error;

  if (data?.id) {
    invalidateActiveMealPlanCache(pacienteId);
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'nutricionista',
      targetPatientId: pacienteId,
      action: id ? 'plano_alimentar_atualizado' : 'plano_alimentar_criado',
      entity: 'plano_alimentar',
      entityId: data.id,
      origin,
      details: {
        nutricionistaId,
        pacienteId,
        ativo: data.ativo,
        inicioEm: data.inicio_em,
        fimEm: data.fim_em,
      },
    });
  }

  return data;
}

export async function disableOtherMealPlansForPatient({
  pacienteId,
  exceptId,
  actor,
  origin = 'plano_alimentar_nutricionista',
}) {
  if (!pacienteId) return 0;

  let query = supabase
    .from('plano_alimentar')
    .update({ ativo: false })
    .eq('paciente_id', pacienteId)
    .eq('ativo', true);

  if (exceptId) {
    query = query.neq('id', exceptId);
  }

  const { data, error } = await query.select('id');
  if (error) throw error;

  const affected = (data || []).length;

  if (affected > 0) {
    invalidateActiveMealPlanCache(pacienteId);
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'nutricionista',
      targetPatientId: pacienteId,
      action: 'plano_alimentar_desativar_outros',
      entity: 'plano_alimentar',
      entityId: exceptId || null,
      origin,
      details: { affected },
    });
  }

  return affected;
}
