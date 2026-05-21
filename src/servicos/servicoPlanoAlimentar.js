import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { isPatientLinkedToNutritionist } from './servicoVinculosNutricionista';

export async function fetchActiveMealPlanForPatient(pacienteId) {
  if (!pacienteId) return null;

  const { data, error } = await supabase
    .from('plano_alimentar')
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('ativo', true)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data || [])[0] || null;
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

