import { supabase } from './configSupabase';
import { enrichRpcClinicalParams } from './servicoSessaoRpc';

function isMissingRpc(error, name) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(name.toLowerCase()) || error?.code === 'PGRST202';
}

export async function fetchPacienteAppStateFromTable(pacienteId) {
  if (!pacienteId) return null;

  const { data, error } = await supabase.rpc(
    'obter_paciente_app_state',
    await enrichRpcClinicalParams({ p_paciente_id: pacienteId }, pacienteId)
  );

  if (error) {
    if (isMissingRpc(error, 'obter_paciente_app_state')) return null;
    throw error;
  }

  if (!data || typeof data !== 'object' || !Object.keys(data).length) {
    return null;
  }

  return data;
}

export async function savePacienteAppStateToTable(pacienteId, estado) {
  if (!pacienteId) return null;

  const { data, error } = await supabase.rpc(
    'salvar_paciente_app_state',
    await enrichRpcClinicalParams(
      {
        p_paciente_id: pacienteId,
        p_estado: estado || {},
      },
      pacienteId
    )
  );

  if (error) {
    if (isMissingRpc(error, 'salvar_paciente_app_state')) return null;
    throw error;
  }

  return data;
}
