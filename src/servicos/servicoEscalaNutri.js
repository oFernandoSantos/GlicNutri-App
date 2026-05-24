import { supabase } from './configSupabase';

function isMissingRpc(error, name) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(name.toLowerCase()) || error?.code === 'PGRST202';
}

/** Metricas de chat sem carregar inbox de todos os pacientes. */
export async function fetchNutritionistChatSummary(nutricionistaId) {
  if (!nutricionistaId) {
    return { totalConversas: 0, naoLidas: 0, atualizadasHoje: 0 };
  }

  const { data, error } = await supabase.rpc('contar_resumo_chat_nutri', {
    p_nutricionista_id: nutricionistaId,
  });

  if (!error && Array.isArray(data) && data[0]) {
    return {
      totalConversas: Number(data[0].total_conversas || 0),
      naoLidas: Number(data[0].nao_lidas || 0),
      atualizadasHoje: Number(data[0].atualizadas_hoje || 0),
    };
  }

  if (error && !isMissingRpc(error, 'contar_resumo_chat_nutri')) {
    console.log('RPC contar_resumo_chat_nutri:', error.message);
  }

  return { totalConversas: 0, naoLidas: 0, atualizadasHoje: 0 };
}

export async function countPatientsLinkedToNutritionist(nutricionistaId) {
  if (!nutricionistaId) return 0;

  const { data, error } = await supabase.rpc('contar_pacientes_nutricionista', {
    p_nutricionista_id: nutricionistaId,
  });

  if (!error && data != null) {
    return Number(data) || 0;
  }

  if (error && !isMissingRpc(error, 'contar_pacientes_nutricionista')) {
    console.log('RPC contar_pacientes_nutricionista:', error.message);
  }

  return 0;
}
