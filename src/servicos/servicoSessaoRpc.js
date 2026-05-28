import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './configSupabase';

export const RPC_SESSION_STORAGE_KEY = '@glicnutri:rpcSessionToken';
export const RPC_SESSION_META_STORAGE_KEY = '@glicnutri:rpcSessionMeta';

let cachedRpcSessionToken = null;

export function getRpcSessionTokenSync() {
  return cachedRpcSessionToken;
}

export async function loadRpcSessionToken() {
  try {
    const token = await AsyncStorage.getItem(RPC_SESSION_STORAGE_KEY);
    cachedRpcSessionToken = token || null;
    return cachedRpcSessionToken;
  } catch (_error) {
    cachedRpcSessionToken = null;
    return null;
  }
}

function isSessaoRpcInvalidaMessage(message = '') {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('sessao rpc invalida') ||
    normalized.includes('sessao rpc ausente') ||
    normalized.includes('expirada') ||
    normalized.includes('revogad')
  );
}

export async function renovarSessaoRpc() {
  const current = cachedRpcSessionToken || (await loadRpcSessionToken());
  if (!current) return null;

  const { data, error } = await supabase.rpc('renovar_sessao_rpc', {
    p_token_sessao: current,
  });

  if (error) {
    console.log('Falha ao renovar sessao RPC:', error.message);
    if (isSessaoRpcInvalidaMessage(error.message)) {
      await limparRpcSessionToken();
      return null;
    }
    return current;
  }

  const token = Array.isArray(data) ? data[0] : data;
  if (!token) return current;

  await salvarRpcSessionToken(token);
  return token;
}

export async function garantirSessaoRpcAtiva() {
  const token = await loadRpcSessionToken();
  if (!token) return null;
  return renovarSessaoRpc();
}

function resolveActorFromProfile(user) {
  if (!user || typeof user !== 'object') {
    return { actorType: '', actorId: null, email: '' };
  }

  if (user.id_paciente_uuid) {
    return {
      actorType: 'paciente',
      actorId: user.id_paciente_uuid,
      email: String(user.email_pac || user.email || '').trim(),
    };
  }

  if (user.id_nutricionista_uuid) {
    return {
      actorType: 'nutricionista',
      actorId: user.id_nutricionista_uuid,
      email: String(user.email_acesso || user.email || '').trim(),
    };
  }

  if (user.id_medico_uuid) {
    return {
      actorType: 'medico',
      actorId: user.id_medico_uuid,
      email: String(user.email_medico || user.email || '').trim(),
    };
  }

  return { actorType: '', actorId: null, email: '' };
}

export async function restaurarSessaoRpcDoPerfil(user) {
  const { actorType, actorId, email } = resolveActorFromProfile(user);
  if (!actorType || !actorId || !email) return null;

  const { data, error } = await supabase.rpc('criar_sessao_rpc_restaurar_app', {
    p_actor_type: actorType,
    p_actor_id: actorId,
    p_email: email,
  });

  if (error) {
    console.log('Falha ao restaurar sessao RPC do perfil:', error.message);
    return null;
  }

  const token = Array.isArray(data) ? data[0] : data;
  if (!token) return null;

  await salvarRpcSessionToken(token, { actorType, metodo: 'restaurar_app' });
  return token;
}

export async function garantirSessaoRpcClinica(user = null) {
  let token = await loadRpcSessionToken();

  if (token) {
    const renewed = await renovarSessaoRpc();
    if (renewed) return renewed;
    token = await loadRpcSessionToken();
    if (token) return token;
  }

  try {
    const { data: authData } = await supabase.auth.getSession();
    if (authData?.session?.user) {
      const oauthToken = await emitirSessaoRpcOAuthPaciente();
      if (oauthToken) return oauthToken;
    }
  } catch (_error) {
    // noop
  }

  if (user) {
    return restaurarSessaoRpcDoPerfil(user);
  }

  return null;
}

export async function garantirSessaoRpcClinicaComPerfil(user) {
  return garantirSessaoRpcClinica(user);
}

export async function salvarRpcSessionToken(token, meta = {}) {
  const normalized = String(token || '').trim();
  if (!normalized) {
    await limparRpcSessionToken();
    return null;
  }

  cachedRpcSessionToken = normalized;
  await AsyncStorage.setItem(RPC_SESSION_STORAGE_KEY, normalized);
  await AsyncStorage.setItem(RPC_SESSION_META_STORAGE_KEY, JSON.stringify(meta || {}));
  return normalized;
}

export async function limparRpcSessionToken() {
  const token = cachedRpcSessionToken || (await loadRpcSessionToken());
  cachedRpcSessionToken = null;

  try {
    await AsyncStorage.multiRemove([RPC_SESSION_STORAGE_KEY, RPC_SESSION_META_STORAGE_KEY]);
  } catch (_error) {
    // noop
  }

  if (token) {
    try {
      await supabase.rpc('revogar_sessao_rpc', { p_token_sessao: token });
    } catch (_error) {
      // revogação best-effort
    }
  }
}

function mapActorType(roleOrUser) {
  const role = String(roleOrUser || '').trim();
  if (role === 'Paciente' || role === 'paciente') return 'paciente';
  if (role === 'Nutricionista' || role === 'nutricionista') return 'nutricionista';
  if (role === 'Medico' || role === 'medico') return 'medico';
  return '';
}

export async function emitirSessaoRpcPosCredencial({ role, identificador, senha }) {
  const actorType = mapActorType(role);
  const id = String(identificador || '').trim();
  const pass = String(senha || '');

  if (!actorType || !id || !pass) {
    return null;
  }

  const { data, error } = await supabase.rpc('criar_sessao_rpc_pos_credencial', {
    p_actor_type: actorType,
    p_identificador: id,
    p_senha: pass,
  });

  if (error) {
    console.log('Falha ao emitir sessao RPC:', error.message);
    return null;
  }

  const token = Array.isArray(data) ? data[0] : data;
  if (!token) return null;

  await salvarRpcSessionToken(token, { actorType, metodo: 'email_senha' });
  return token;
}

export async function emitirSessaoRpcOAuthPaciente() {
  const { data, error } = await supabase.rpc('criar_sessao_rpc_oauth_paciente');

  if (error) {
    console.log('Falha ao emitir sessao RPC OAuth:', error.message);
    return null;
  }

  const token = Array.isArray(data) ? data[0] : data;
  if (!token) return null;

  await salvarRpcSessionToken(token, { actorType: 'paciente', metodo: 'oauth' });
  return token;
}

export async function enrichRpcClinicalParams(params = {}, pacienteId = null, user = null) {
  const token = await garantirSessaoRpcClinica(user);
  if (!token) {
    throw new Error('Sessao clinica ausente. Saia do app e faca login novamente.');
  }

  const payload = { ...params, p_token_sessao: token };

  if (pacienteId && !payload.p_id_paciente_uuid && !payload.p_paciente_id) {
    payload.p_id_paciente_uuid = pacienteId;
    payload.p_paciente_id = pacienteId;
  }

  return payload;
}
