import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { fetchPatientById } from './servicoDadosPaciente';
import {
  ensurePatientNutritionistLink,
  isPatientLinkedToNutritionist,
} from './servicoVinculosNutricionista';

function isMissingFollowUpRequestTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();

  return (
    code === 'PGRST205' ||
    message.includes('solicitacao_acompanhamento_nutri') ||
    message.includes('could not find the table')
  );
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
    if (isMissingFollowUpRequestTableError(error)) {
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

export async function listFollowUpRequestsByNutritionist(
  nutricionistaId,
  { status = 'pending', limit = 40 } = {}
) {
  if (!nutricionistaId) return [];

  let query = supabase
    .from('solicitacao_acompanhamento_nutri')
    .select('*, paciente:paciente_id(*)')
    .eq('nutricionista_id', nutricionistaId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    if (isMissingFollowUpRequestTableError(error)) return [];
    throw error;
  }
  return data || [];
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
    if (isMissingFollowUpRequestTableError(fetchError)) {
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
    if (isMissingFollowUpRequestTableError(error)) {
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
