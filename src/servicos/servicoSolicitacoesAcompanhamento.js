import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { fetchPatientById } from './servicoDadosPaciente';
import {
  ensurePatientNutritionistLink,
  isPatientLinkedToNutritionist,
} from './servicoVinculosNutricionista';
import {
  ensurePatientDoctorLink,
  isPatientLinkedToDoctor,
} from './servicoVinculosMedico';

function isMissingFollowUpRequestTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();

  return code === 'PGRST205' || message.includes('could not find the table');
}

const FOLLOW_UP_PATIENT_COLUMNS =
  'id_paciente_uuid, nome_completo, nome_pac, email_pac';

async function hydrateFollowUpPatients(rows = []) {
  if (!rows.length) return [];

  const patientIds = [
    ...new Set(rows.map((row) => row?.paciente_id).filter(Boolean)),
  ];
  if (!patientIds.length) return rows;

  const { data, error } = await supabase
    .from('paciente')
    .select(FOLLOW_UP_PATIENT_COLUMNS)
    .in('id_paciente_uuid', patientIds);

  if (error) {
    console.log('Erro ao hidratar pacientes das solicitacoes:', error);
    return rows;
  }

  const patientsById = new Map(
    (data || []).map((patient) => [patient.id_paciente_uuid, patient])
  );

  return rows.map((row) => ({
    ...row,
    paciente: row.paciente || patientsById.get(row.paciente_id) || null,
  }));
}

function getPatientName(patient) {
  return patient?.nome_completo || patient?.nome_pac || patient?.email_pac || 'Paciente';
}

export async function createFollowUpRequest({
  nutricionistaId,
  pacienteId,
  mensagem,
  actor,
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador para acompanhamento.');
  if (!pacienteId) throw new Error('Paciente sem identificador para acompanhamento.');

  const paciente = await fetchPatientById(pacienteId, {
    currentPatient: actor,
    patientContext: actor,
  });
  const pacienteIdConfirmado = paciente?.id_paciente_uuid || null;

  if (!pacienteIdConfirmado) {
    throw new Error('Paciente nao encontrado no banco de dados.');
  }

  if (
    paciente?.id_nutricionista_uuid &&
    paciente.id_nutricionista_uuid !== nutricionistaId
  ) {
    throw new Error(
      'Voce ja possui um nutricionista vinculado. Desvincule o acompanhamento atual antes de solicitar outro.'
    );
  }

  const linked = await isPatientLinkedToNutritionist({
    pacienteId: pacienteIdConfirmado,
    nutricionistaId,
  });

  if (linked) {
    return {
      alreadyLinked: true,
      paciente,
      message: 'Este nutricionista ja acompanha voce. Agora voce pode agendar consultas.',
    };
  }

  const payload = {
    nutricionista_id: nutricionistaId,
    paciente_id: pacienteIdConfirmado,
    mensagem: mensagem ? String(mensagem).trim() : null,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('solicitacao_acompanhamento_nutri')
    .insert([payload])
    .select('*, paciente:paciente_id(*)')
    .maybeSingle();

  if (error) {
    if (isMissingFollowUpRequestTableError(error, 'solicitacao_acompanhamento_nutri')) {
      throw new Error(
        'A tabela de solicitacoes de acompanhamento ainda nao existe no Supabase. Aplique a migration 20260521000100_create_solicitacao_acompanhamento_nutri.sql.'
      );
    }
    const message = String(error.message || '').toLowerCase();
    if (message.includes('idx_solicitacao_acompanhamento_nutri_pending')) {
      return {
        alreadyPending: true,
        paciente,
        message: 'Voce ja possui uma solicitacao pendente para este nutricionista.',
      };
    }
    throw error;
  }

  try {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'paciente',
      targetPatientId: pacienteIdConfirmado,
      action: 'solicitacao_acompanhamento_criada',
      entity: 'solicitacao_acompanhamento_nutri',
      entityId: data?.id,
      origin: 'paciente',
      details: {
        nutricionistaId,
        pacienteNome: getPatientName(paciente),
      },
    });
  } catch (auditError) {
    console.log('Auditoria de solicitacao de acompanhamento falhou:', auditError);
  }

  return data;
}

export async function hasPendingFollowUpRequestForPatient({
  pacienteId,
  nutricionistaId,
}) {
  if (!pacienteId || !nutricionistaId) return false;

  const { data, error } = await supabase
    .from('solicitacao_acompanhamento_nutri')
    .select('id')
    .eq('paciente_id', pacienteId)
    .eq('nutricionista_id', nutricionistaId)
    .eq('status', 'pending')
    .limit(1);

  if (error) {
    if (isMissingFollowUpRequestTableError(error)) return false;
    throw error;
  }

  return Boolean(data?.length);
}

export async function listFollowUpRequestsByNutritionist(
  nutricionistaId,
  { status = 'pending', limit = 40 } = {}
) {
  if (!nutricionistaId) return [];

  let query = supabase
    .from('solicitacao_acompanhamento_nutri')
    .select('*')
    .eq('nutricionista_id', nutricionistaId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    if (isMissingFollowUpRequestTableError(error)) return [];
    throw error;
  }

  return hydrateFollowUpPatients(data || []);
}

export async function updateFollowUpRequestStatus({
  requestId,
  nutricionistaId,
  status,
  actor,
}) {
  if (!requestId) throw new Error('Solicitacao sem identificador.');
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    throw new Error('Status de solicitacao invalido.');
  }

  const { data: request, error: fetchError } = await supabase
    .from('solicitacao_acompanhamento_nutri')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (fetchError) {
    if (isMissingFollowUpRequestTableError(fetchError, 'solicitacao_acompanhamento_nutri')) {
      throw new Error(
        'A tabela de solicitacoes de acompanhamento ainda nao existe no Supabase. Aplique a migration 20260521000100_create_solicitacao_acompanhamento_nutri.sql.'
      );
    }
    throw fetchError;
  }
  if (!request?.id) throw new Error('Solicitacao nao encontrada.');
  if (nutricionistaId && request.nutricionista_id !== nutricionistaId) {
    throw new Error('Esta solicitacao pertence a outro nutricionista.');
  }

  const { data, error } = await supabase
    .from('solicitacao_acompanhamento_nutri')
    .update({ status })
    .eq('id', requestId)
    .select('*, paciente:paciente_id(*)')
    .maybeSingle();

  if (error) {
    if (isMissingFollowUpRequestTableError(error, 'solicitacao_acompanhamento_nutri')) {
      throw new Error(
        'A tabela de solicitacoes de acompanhamento ainda nao existe no Supabase. Aplique a migration 20260521000100_create_solicitacao_acompanhamento_nutri.sql.'
      );
    }
    throw error;
  }

  if (status === 'approved') {
    await ensurePatientNutritionistLink({
      pacienteId: request.paciente_id,
      nutricionistaId: request.nutricionista_id,
      actor,
      origin: 'solicitacao_acompanhamento',
    });
  }

  try {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'nutricionista',
      targetPatientId: request.paciente_id,
      action:
        status === 'approved'
          ? 'solicitacao_acompanhamento_aprovada'
          : 'solicitacao_acompanhamento_recusada',
      entity: 'solicitacao_acompanhamento_nutri',
      entityId: requestId,
      origin: 'nutricionista',
      details: {
        nutricionistaId: request.nutricionista_id,
        status,
      },
    });
  } catch (auditError) {
    console.log('Auditoria de resposta da solicitacao falhou:', auditError);
  }

  return data;
}

export async function createDoctorFollowUpRequest({
  medicoId,
  pacienteId,
  mensagem,
  actor,
}) {
  if (!medicoId) throw new Error('Medico sem identificador para acompanhamento.');
  if (!pacienteId) throw new Error('Paciente sem identificador para acompanhamento.');

  const paciente = await fetchPatientById(pacienteId, {
    currentPatient: actor,
    patientContext: actor,
  });
  const pacienteIdConfirmado = paciente?.id_paciente_uuid || null;

  if (!pacienteIdConfirmado) {
    throw new Error('Paciente nao encontrado no banco de dados.');
  }

  if (paciente?.id_medico_uuid && paciente.id_medico_uuid !== medicoId) {
    throw new Error(
      'Voce ja possui um medico vinculado. Desvincule o acompanhamento atual antes de solicitar outro.'
    );
  }

  const linked = await isPatientLinkedToDoctor({
    pacienteId: pacienteIdConfirmado,
    medicoId,
  });

  if (linked) {
    return {
      alreadyLinked: true,
      paciente,
      message: 'Este medico ja acompanha voce clinicamente.',
    };
  }

  const payload = {
    medico_id: medicoId,
    paciente_id: pacienteIdConfirmado,
    mensagem: mensagem ? String(mensagem).trim() : null,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('solicitacao_acompanhamento_medico')
    .insert([payload])
    .select('*, paciente:paciente_id(*)')
    .maybeSingle();

  if (error) {
    if (isMissingFollowUpRequestTableError(error, 'solicitacao_acompanhamento_medico')) {
      throw new Error(
        'A tabela de solicitacoes medicas ainda nao existe no Supabase. Aplique a migration 20260601000400_solicitacao_acompanhamento_medico.sql.'
      );
    }
    const message = String(error.message || '').toLowerCase();
    if (message.includes('idx_solicitacao_acompanhamento_medico_pending')) {
      return {
        alreadyPending: true,
        paciente,
        message: 'Voce ja possui uma solicitacao pendente para este medico.',
      };
    }
    throw error;
  }

  try {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'paciente',
      targetPatientId: pacienteIdConfirmado,
      action: 'solicitacao_acompanhamento_medico_criada',
      entity: 'solicitacao_acompanhamento_medico',
      entityId: data?.id,
      origin: 'paciente',
      details: {
        medicoId,
        pacienteNome: getPatientName(paciente),
      },
    });
  } catch (auditError) {
    console.log('Auditoria de solicitacao medica falhou:', auditError);
  }

  return data;
}

export async function listFollowUpRequestsByDoctor(medicoId, { status = 'pending', limit = 40 } = {}) {
  if (!medicoId) return [];

  let query = supabase
    .from('solicitacao_acompanhamento_medico')
    .select('*')
    .eq('medico_id', medicoId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    if (isMissingFollowUpRequestTableError(error)) return [];
    throw error;
  }

  return hydrateFollowUpPatients(data || []);
}

export async function updateDoctorFollowUpRequestStatus({
  requestId,
  medicoId,
  status,
  actor,
}) {
  if (!requestId) throw new Error('Solicitacao sem identificador.');
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    throw new Error('Status de solicitacao invalido.');
  }

  const { data: request, error: fetchError } = await supabase
    .from('solicitacao_acompanhamento_medico')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (fetchError) {
    if (isMissingFollowUpRequestTableError(fetchError, 'solicitacao_acompanhamento_medico')) {
      throw new Error(
        'A tabela de solicitacoes medicas ainda nao existe no Supabase. Aplique a migration 20260601000400_solicitacao_acompanhamento_medico.sql.'
      );
    }
    throw fetchError;
  }
  if (!request?.id) throw new Error('Solicitacao nao encontrada.');
  if (medicoId && request.medico_id !== medicoId) {
    throw new Error('Esta solicitacao pertence a outro medico.');
  }

  const { data, error } = await supabase
    .from('solicitacao_acompanhamento_medico')
    .update({ status })
    .eq('id', requestId)
    .select('*, paciente:paciente_id(*)')
    .maybeSingle();

  if (error) {
    if (isMissingFollowUpRequestTableError(error, 'solicitacao_acompanhamento_medico')) {
      throw new Error(
        'A tabela de solicitacoes medicas ainda nao existe no Supabase. Aplique a migration 20260601000400_solicitacao_acompanhamento_medico.sql.'
      );
    }
    throw error;
  }

  if (status === 'approved') {
    await ensurePatientDoctorLink({
      pacienteId: request.paciente_id,
      medicoId: request.medico_id,
      actor,
      origin: 'solicitacao',
    });
  }

  try {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'medico',
      targetPatientId: request.paciente_id,
      action:
        status === 'approved'
          ? 'solicitacao_acompanhamento_medico_aprovada'
          : 'solicitacao_acompanhamento_medico_recusada',
      entity: 'solicitacao_acompanhamento_medico',
      entityId: requestId,
      origin: 'medico',
      details: {
        medicoId: request.medico_id,
        status,
      },
    });
  } catch (auditError) {
    console.log('Auditoria de resposta da solicitacao medica falhou:', auditError);
  }

  return data;
}
