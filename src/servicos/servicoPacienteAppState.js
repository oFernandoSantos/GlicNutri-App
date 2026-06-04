import { supabase } from './configSupabase';
import { enrichChatRpcParams } from './servicoMensagensChat';

function isMissingRpc(error, name) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(name.toLowerCase()) || error?.code === 'PGRST202';
}

export async function fetchPacienteAppStateFromTable(pacienteId, rpcActor = null) {
  if (!pacienteId) return null;

  let rpcParams;
  try {
    rpcParams = await enrichChatRpcParams(
      { p_paciente_id: pacienteId },
      pacienteId,
      rpcActor,
      rpcActor
    );
  } catch (error) {
    console.log('Sessao RPC ausente ao ler app_state:', error?.message || error);
    return null;
  }

  const { data, error } = await supabase.rpc('obter_paciente_app_state', rpcParams);

  if (error) {
    if (isMissingRpc(error, 'obter_paciente_app_state')) return null;
    console.log('Erro ao obter paciente_app_state:', error.message);
    return null;
  }

  if (!data || typeof data !== 'object' || !Object.keys(data).length) {
    return null;
  }

  return data;
}

export async function savePacienteAppStateToTable(pacienteId, estado, rpcActor = null) {
  if (!pacienteId) return null;

  const { data, error } = await supabase.rpc(
    'salvar_paciente_app_state',
    await enrichRpcClinicalParams(
      {
        p_paciente_id: pacienteId,
        p_estado: estado || {},
      },
      pacienteId,
      rpcActor
    )
  );

  if (error) {
    if (isMissingRpc(error, 'salvar_paciente_app_state')) return null;
    throw error;
  }

  return data;
}
