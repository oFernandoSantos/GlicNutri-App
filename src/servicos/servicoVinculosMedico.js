import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { getMedicoId } from './servicoSessaoMedico';

const PATIENT_LIST_COLUMNS =
  'id_paciente_uuid, nome_completo, email_pac, cpf_paciente, objetivo_principal_consulta, id_medico_uuid, peso_atual_kg, imc_calculado, data_nascimento, data_hora_ultima_atualizacao, comorbidades_texto, excluido';

const CONSULTA_WITH_PATIENT_COLUMNS =
  `id, paciente_id, medico_id, nutricionista_id, scheduled_at, status, motivo, meet_link, tipo_consulta,
  paciente:paciente_id(${PATIENT_LIST_COLUMNS})`;

export { getMedicoId };

const ALLOWED_VINCULO_ORIGENS = new Set([
  'consulta',
  'solicitacao',
  'manual',
  'admin',
  'seed',
]);

export function normalizeVinculoOrigem(origin, { consultaId } = {}) {
  const value = String(origin || '').trim();
  if (ALLOWED_VINCULO_ORIGENS.has(value)) return value;
  if (consultaId) return 'consulta';
  if (value.includes('solicit')) return 'solicitacao';
  return 'manual';
}

function normalizeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function calculateAge(value) {
  const birth = normalizeDate(value);
  if (!birth) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function normalizePatientCard(patient, meta = {}) {
  const latestGlucose = Number(patient?.glicemia_atual || patient?.ultima_glicemia_mgdl) || 0;
  const objective =
    patient?.objetivo_principal_consulta ||
    patient?.comorbidades_texto ||
    'Acompanhamento clínico';

  return {
    id: patient?.id_paciente_uuid,
    raw: patient,
    name: patient?.nome_completo || patient?.email_pac || 'Paciente',
    email: patient?.email_pac || '',
    age: calculateAge(patient?.data_nascimento) ?? '--',
    bmi: patient?.imc_calculado || '--',
    specialtyTag: String(objective).slice(0, 80),
    objective,
    latestGlucose: latestGlucose || '--',
    vinculadoEm: meta.vinculadoEm || null,
  };
}

export async function isPatientLinkedToDoctor({ pacienteId, medicoId }) {
  if (!pacienteId || !medicoId) return false;

  const { data, error } = await supabase.rpc('paciente_vinculado_a_medico', {
    p_paciente_id: pacienteId,
    p_medico_id: medicoId,
  });

  if (!error) return Boolean(data);

  const direct = await supabase
    .from('paciente')
    .select('id_paciente_uuid, id_medico_uuid')
    .eq('id_paciente_uuid', pacienteId)
    .maybeSingle();

  if (direct.data?.id_medico_uuid === medicoId) return true;

  const { data: consultas } = await supabase
    .from('consulta')
    .select('id')
    .eq('paciente_id', pacienteId)
    .eq('medico_id', medicoId)
    .neq('status', 'cancelled')
    .limit(1);

  return Boolean(consultas?.length);
}

export async function ensurePatientDoctorLink({
  pacienteId,
  medicoId,
  consultaId,
  actor,
  origin = 'manual',
}) {
  if (!pacienteId || !medicoId) return false;

  const { data: patient, error: patientError } = await supabase
    .from('paciente')
    .select('id_paciente_uuid, id_medico_uuid')
    .eq('id_paciente_uuid', pacienteId)
    .maybeSingle();

  if (patientError) throw patientError;

  if (
    patient?.id_medico_uuid &&
    patient.id_medico_uuid !== medicoId
  ) {
    throw new Error(
      'Voce ja possui um medico vinculado. Desvincule o acompanhamento atual antes de solicitar outro.'
    );
  }

  const origemNormalizada = normalizeVinculoOrigem(origin, { consultaId });

  const { error } = await supabase.rpc('garantir_vinculo_medico_paciente', {
    p_paciente_id: pacienteId,
    p_medico_id: medicoId,
    p_origem: origemNormalizada,
    p_consulta_id: consultaId || null,
  });

  if (error) {
    const fallback = await supabase.rpc('vincular_paciente_profissional', {
      p_paciente_id: pacienteId,
      p_medico_id: medicoId,
      p_origem: origemNormalizada,
      p_consulta_id: consultaId || null,
    });
    if (fallback.error) throw fallback.error;
  }

  try {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: 'medico',
      targetPatientId: pacienteId,
      action: 'paciente_medico_vinculado',
      entity: 'paciente',
      entityId: pacienteId,
      origin,
      details: { medicoId, consultaId },
    });
  } catch {
    /* noop */
  }

  return true;
}

export function resolveAssignedDoctorIdFromRecords({ patient, consultas } = {}) {
  if (patient?.id_medico_uuid) {
    return patient.id_medico_uuid;
  }

  const assignedConsulta = [...(consultas || [])]
    .filter((item) => item?.medico_id && item?.status !== 'cancelled')
    .sort((left, right) =>
      String(right?.scheduled_at || '').localeCompare(String(left?.scheduled_at || ''))
    )[0];

  return assignedConsulta?.medico_id || null;
}

export async function linkPatientDoctor({ pacienteId, medicoId, actor, origin = 'manual' }) {
  return ensurePatientDoctorLink({
    pacienteId,
    medicoId,
    actor,
    origin,
  });
}

export async function unlinkPatientDoctor({
  pacienteId,
  medicoId,
  actor,
  origin = 'desvinculo_manual',
}) {
  if (!pacienteId || !medicoId) {
    throw new Error('Paciente ou medico sem identificador para desvincular.');
  }

  const { error } = await supabase.rpc('desvincular_paciente_medico', {
    p_paciente_id: pacienteId,
    p_medico_id: medicoId,
  });

  if (error) throw error;

  try {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'paciente',
      targetPatientId: pacienteId,
      action: 'paciente_medico_desvinculado',
      entity: 'paciente',
      entityId: pacienteId,
      origin,
      details: { medicoId },
    });
  } catch {
    /* noop */
  }

  return true;
}

export async function listPatientsByDoctor(medicoId, { limit = 200 } = {}) {
  if (!medicoId) return [];

  const { data: rpcRows, error: rpcError } = await supabase.rpc('listar_pacientes_medico', {
    p_medico_id: medicoId,
    p_limit: limit,
  });

  if (!rpcError && rpcRows?.length) {
    const ids = rpcRows.map((r) => r.id_paciente_uuid).filter(Boolean);
    const { data: patients } = await supabase
      .from('paciente')
      .select(PATIENT_LIST_COLUMNS)
      .in('id_paciente_uuid', ids);

    const byId = new Map((patients || []).map((p) => [p.id_paciente_uuid, p]));
    return rpcRows
      .map((row) => {
        const p = byId.get(row.id_paciente_uuid);
        if (!p) return null;
        return normalizePatientCard(p, { vinculadoEm: row.vinculado_em });
      })
      .filter(Boolean);
  }

  const { data: direct } = await supabase
    .from('paciente')
    .select(PATIENT_LIST_COLUMNS)
    .eq('id_medico_uuid', medicoId)
    .or('excluido.is.null,excluido.eq.false')
    .limit(limit);

  return (direct || []).map((p) => normalizePatientCard(p));
}

export async function listConsultasMedicoComPaciente(medicoId, { limit = 160, from, to } = {}) {
  if (!medicoId) return [];

  let query = supabase
    .from('consulta')
    .select(CONSULTA_WITH_PATIENT_COLUMNS)
    .eq('medico_id', medicoId)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (from) query = query.gte('scheduled_at', from);
  if (to) query = query.lte('scheduled_at', to);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
