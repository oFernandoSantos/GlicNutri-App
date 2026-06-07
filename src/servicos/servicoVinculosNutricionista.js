import { supabase } from './configSupabase';
import { invalidatePatientExperienceCache } from './cacheExperienciaPaciente';
import { registrarLogAuditoria } from './servicoAuditoria';
import {
  normalizeRiskBucket,
  patientHasDiabetes,
  riskBucketLabel,
} from '../utilitarios/adesaoNutricional';
const PATIENT_LIST_COLUMNS =
  'id_paciente_uuid, nome_completo, email_pac, cpf_paciente, objetivo_principal_consulta, id_nutricionista_uuid, peso_atual_kg, imc_calculado, data_nascimento, data_hora_ultima_atualizacao, comorbidades_texto, excluido';

const CONSULTA_WITH_PATIENT_COLUMNS =
  `id, paciente_id, nutricionista_id, scheduled_at, status, motivo,
  paciente:paciente_id(${PATIENT_LIST_COLUMNS})`;

const MAX_PATIENTS_PER_NUTRI = 500;
const PATIENT_ID_CHUNK = 80;

export function getNutritionistId(usuario) {
  return (
    usuario?.id_nutricionista_uuid ||
    usuario?.user_metadata?.id_nutricionista_uuid ||
    null
  );
}

export async function resolveNutritionistId(usuario) {
  const direct = getNutritionistId(usuario);
  if (direct) return direct;

  const email = String(
    usuario?.email_acesso ||
      usuario?.email ||
      usuario?.email_nutri ||
      ''
  )
    .trim()
    .toLowerCase();

  if (!email) return null;

  const { data, error } = await supabase
    .from('nutricionista')
    .select('id_nutricionista_uuid')
    .ilike('email_acesso', email)
    .limit(1);

  if (error) {
    console.log('Erro ao resolver id do nutricionista por email:', error);
    return null;
  }

  return data?.[0]?.id_nutricionista_uuid || null;
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

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatDateShort(value) {
  const date = normalizeDate(value);
  if (!date) return 'Sem consulta';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatTimeShort(value) {
  const date = normalizeDate(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function pickObjective(patient) {
  return (
    patient?.objetivo_principal ||
    patient?.objetivo ||
    patient?.objetivo_principal_consulta ||
    patient?.diagnostico_principal ||
    'Acompanhamento'
  );
}

function normalizeRisk(patient, latestGlucose, objective) {
  const riskText = String(patient?.risco || patient?.nivel_risco || '').trim();
  let bucket = normalizeRiskBucket(riskText, latestGlucose);

  if (patientHasDiabetes({ raw: patient, objective })) {
    bucket = 'alto';
  }

  return riskBucketLabel(bucket);
}

function normalizePatientCard(patient, meta = {}) {
  const latestGlucose = Number(patient?.glicemia_atual || patient?.ultima_glicemia_mgdl) || 0;
  const adherence = Number(patient?.adesao_percentual || patient?.aderencia_percentual) || 78;
  const objective = pickObjective(patient);
  const age = calculateAge(patient?.data_nascimento);
  const risk = normalizeRisk(patient, latestGlucose, objective);

  return {
    id: patient?.id_paciente_uuid,
    raw: patient,
    name: patient?.nome_completo || patient?.nome_pac || patient?.email_pac || 'Paciente',
    email: patient?.email_pac || '',
    age: age ?? '--',
    bmi: patient?.imc_calculado || patient?.imc_atual || patient?.imc || '--',
    specialtyTag: String(objective).slice(0, 80),
    objective,
    risk,
    alerts: risk === 'Alto' ? 3 : risk === 'Moderado' ? 1 : 0,
    adherence,
    latestGlucose: latestGlucose || '--',
    updatedAt: formatDateShort(patient?.data_hora_ultima_atualizacao || meta.lastConsultaAt),
    appointmentTime: meta.nextConsultaAt ? formatTimeShort(meta.nextConsultaAt) : 'Sem horario',
    lastConsultaAt: meta.lastConsultaAt || null,
    nextConsultaAt: meta.nextConsultaAt || null,
    notes: patient?.observacoes || patient?.condicoes_saude || patient?.comorbidades_texto || 'Paciente vinculado por consulta.',
    trendText: patient?.tendencia_glicemica || 'Acompanhar evolucao nos proximos registros.',
    unread: 0,
  };
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

/** Nutricionista de acompanhamento: somente vínculo formal no paciente. */
export function resolveAssignedNutritionistIdFromRecords({ patient } = {}) {
  return patient?.id_nutricionista_uuid || null;
}

async function fetchPatientsByIds(ids) {
  const patientIds = uniq(ids);
  if (!patientIds.length) return [];

  const resultados = [];

  for (let index = 0; index < patientIds.length; index += PATIENT_ID_CHUNK) {
    const chunk = patientIds.slice(index, index + PATIENT_ID_CHUNK);
    const { data, error } = await supabase
      .from('paciente')
      .select(PATIENT_LIST_COLUMNS)
      .in('id_paciente_uuid', chunk);

    if (error) throw error;
    resultados.push(...(data || []));
  }

  return resultados;
}

async function fetchPatientsByDirectLink(nutricionistaId, { limit = MAX_PATIENTS_PER_NUTRI } = {}) {
  if (!nutricionistaId) return [];

  const { data, error } = await supabase
    .from('paciente')
    .select(PATIENT_LIST_COLUMNS)
    .eq('id_nutricionista_uuid', nutricionistaId)
    .or('excluido.is.null,excluido.eq.false')
    .order('data_hora_ultima_atualizacao', { ascending: false })
    .limit(limit);

  const message = String(error?.message || '').toLowerCase();
  if (error && message.includes('id_nutricionista_uuid')) return [];
  if (error) throw error;
  return data || [];
}

export async function ensurePatientNutritionistLink({
  pacienteId,
  nutricionistaId,
  consultaId,
  actor,
  origin = 'consulta',
}) {
  if (!pacienteId || !nutricionistaId) return false;

  const agendadaPeloNutri = origin === 'agenda_nutricionista';
  const origemVinculo = consultaId ? 'consulta' : 'manual';

  try {
    const { error: rpcError } = await supabase.rpc('vincular_paciente_profissional', {
      p_paciente_id: pacienteId,
      p_nutricionista_id: nutricionistaId,
      p_medico_id: null,
      p_origem: origemVinculo,
      p_consulta_id: consultaId || null,
    });
    if (rpcError) {
      console.log('RPC vincular_paciente_profissional:', rpcError.message || rpcError);
    }
  } catch (rpcError) {
    console.log('RPC vincular_paciente_profissional:', rpcError?.message || rpcError);
  }

  const { data: patient, error: patientError } = await supabase
    .from('paciente')
    .select('id_paciente_uuid, id_nutricionista_uuid')
    .eq('id_paciente_uuid', pacienteId)
    .maybeSingle();

  if (patientError) {
    if (agendadaPeloNutri) {
      console.log('Leitura paciente pos-agendamento nutri falhou:', patientError);
      return false;
    }
    throw patientError;
  }

  if (
    !agendadaPeloNutri &&
    patient?.id_nutricionista_uuid &&
    patient.id_nutricionista_uuid !== nutricionistaId
  ) {
    throw new Error(
      'Voce ja possui um nutricionista vinculado. Desvincule o acompanhamento atual antes de solicitar outro.'
    );
  }

  if (patient?.id_nutricionista_uuid === nutricionistaId) {
    return true;
  }

  if (agendadaPeloNutri && patient?.id_nutricionista_uuid) {
    return true;
  }

  const patch = {
    id_nutricionista_uuid: nutricionistaId,
    data_hora_ultima_atualizacao: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('paciente')
    .update(patch)
    .eq('id_paciente_uuid', pacienteId);

  const message = String(error?.message || '').toLowerCase();
  if (error && !message.includes('id_nutricionista_uuid')) {
    console.log('Erro ao vincular paciente ao nutricionista:', error);
  }

  registrarLogAuditoria({
    actor: actor || null,
    actorType: actor?.tipo_perfil || null,
    targetPatientId: pacienteId,
    action: 'paciente_nutricionista_vinculado',
    entity: 'paciente',
    entityId: pacienteId,
    origin,
    details: {
      nutricionistaId,
      consultaId: consultaId || null,
      vinculoPersistidoNoPaciente: !error,
    },
  }).catch((auditError) => {
    console.log('Auditoria de vinculo paciente/nutricionista falhou:', auditError);
  });

  return !error;
}

export async function listConsultasNutricionistaComPaciente(
  nutricionistaId,
  { limit = 160, from, to } = {}
) {
  if (!nutricionistaId) return [];

  let query = supabase
    .from('consulta')
    .select(CONSULTA_WITH_PATIENT_COLUMNS)
    .eq('nutricionista_id', nutricionistaId)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (from) query = query.gte('scheduled_at', from);
  if (to) query = query.lte('scheduled_at', to);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listPatientsByNutritionist(
  nutricionistaId,
  { limit = MAX_PATIENTS_PER_NUTRI, consultaLimit = limit } = {}
) {
  if (!nutricionistaId) return [];

  const [consultas, directPatients] = await Promise.all([
    listConsultasNutricionistaComPaciente(nutricionistaId, { limit: consultaLimit }).catch(() => []),
    fetchPatientsByDirectLink(nutricionistaId, { limit }).catch(() => []),
  ]);

  const patientMeta = new Map();
  const now = Date.now();

  consultas.forEach((consulta) => {
    if (!consulta?.paciente_id || consulta.status === 'cancelled') return;

    const current = patientMeta.get(consulta.paciente_id) || {};
    const scheduledAt = consulta.scheduled_at || null;
    const scheduledTime = normalizeDate(scheduledAt)?.getTime() || 0;

    patientMeta.set(consulta.paciente_id, {
      lastConsultaAt:
        !current.lastConsultaAt || String(scheduledAt).localeCompare(String(current.lastConsultaAt)) > 0
          ? scheduledAt
          : current.lastConsultaAt,
      nextConsultaAt:
        scheduledTime >= now &&
        (!current.nextConsultaAt ||
          String(scheduledAt).localeCompare(String(current.nextConsultaAt)) < 0)
          ? scheduledAt
          : current.nextConsultaAt,
    });
  });

  const byId = new Map();

  directPatients.forEach((patient) => {
    if (patient?.id_paciente_uuid) byId.set(patient.id_paciente_uuid, patient);
  });

  consultas.forEach((consulta) => {
    const embedded = consulta?.paciente;
    if (embedded?.id_paciente_uuid) {
      byId.set(embedded.id_paciente_uuid, embedded);
    }
  });

  const missingIds = [...patientMeta.keys()].filter((patientId) => !byId.has(patientId));
  let fetchedPatients = [];

  try {
    fetchedPatients = await fetchPatientsByIds(missingIds);
  } catch (fetchError) {
    console.log('Erro ao buscar pacientes da carteira:', fetchError?.message || fetchError);
  }

  fetchedPatients.forEach((patient) => {
    if (patient?.id_paciente_uuid) byId.set(patient.id_paciente_uuid, patient);
  });

  return [...byId.values()]
    .map((patient) => normalizePatientCard(patient, patientMeta.get(patient.id_paciente_uuid)))
    .sort((a, b) => {
      const nextA = a.nextConsultaAt || a.lastConsultaAt || '';
      const nextB = b.nextConsultaAt || b.lastConsultaAt || '';
      return String(nextB).localeCompare(String(nextA));
    });
}

export async function isPatientLinkedToNutritionist({ pacienteId, nutricionistaId }) {
  if (!pacienteId || !nutricionistaId) return false;

  const { data, error } = await supabase
    .from('paciente')
    .select('id_nutricionista_uuid')
    .eq('id_paciente_uuid', pacienteId)
    .maybeSingle();

  const message = String(error?.message || '').toLowerCase();
  if (error && !message.includes('id_nutricionista_uuid')) {
    throw error;
  }

  return data?.id_nutricionista_uuid === nutricionistaId;
}

export async function unlinkPatientNutritionist({
  pacienteId,
  nutricionistaId,
  actor,
  origin = 'desvinculo_manual',
}) {
  if (!pacienteId || !nutricionistaId) {
    throw new Error('Paciente ou nutricionista sem identificador para desvincular.');
  }

  const { error } = await supabase
    .from('paciente')
    .update({
      id_nutricionista_uuid: null,
      data_hora_ultima_atualizacao: new Date().toISOString(),
    })
    .eq('id_paciente_uuid', pacienteId)
    .eq('id_nutricionista_uuid', nutricionistaId);

  const message = String(error?.message || '').toLowerCase();
  if (error && !message.includes('id_nutricionista_uuid')) {
    throw error;
  }

  await supabase
    .from('solicitacao_acompanhamento_nutri')
    .update({ status: 'cancelled' })
    .eq('paciente_id', pacienteId)
    .eq('nutricionista_id', nutricionistaId)
    .eq('status', 'pending');

  await supabase
    .from('paciente_profissional_vinculo')
    .update({
      ativo: false,
      updated_at: new Date().toISOString(),
    })
    .eq('paciente_id', pacienteId)
    .eq('nutricionista_id', nutricionistaId)
    .eq('tipo_profissional', 'nutricionista');

  invalidatePatientExperienceCache(pacienteId);

  try {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || null,
      targetPatientId: pacienteId,
      action: 'paciente_nutricionista_desvinculado',
      entity: 'paciente',
      entityId: pacienteId,
      origin,
      details: {
        nutricionistaId,
      },
    });
  } catch (auditError) {
    console.log('Auditoria de desvinculo paciente/nutricionista falhou:', auditError);
  }

  return true;
}
