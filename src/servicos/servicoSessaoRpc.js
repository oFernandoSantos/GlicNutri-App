import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './configSupabase';
import { isGoogleUser } from './sincronizarPacienteGoogle';

export const RPC_SESSION_STORAGE_KEY = '@glicnutri:rpcSessionToken';
export const RPC_SESSION_META_STORAGE_KEY = '@glicnutri:rpcSessionMeta';

let cachedRpcSessionToken = null;
let cachedRpcProfileKey = '';
let sessaoRpcEnsureInFlight = null;
let oauthEmitInFlight = null;
let recuperarSessaoInFlight = null;
let sessaoRpcLastEnsuredAt = 0;
let restaurarRpcCooldownUntil = 0;
const SESSAO_RPC_ENSURE_TTL_MS = 45 * 1000;
const RESTAURAR_RPC_COOLDOWN_MS = 60 * 1000;
const RPC_ACTOR_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidRpcActorId(actorId) {
  return RPC_ACTOR_UUID_PATTERN.test(String(actorId || '').trim());
}

function isPatientProfile(user) {
  if (!user || typeof user !== 'object') {
    return false;
  }

  return Boolean(
    user?.id_paciente_uuid ||
      user?.tipo_perfil === 'paciente' ||
      user?.perfil === 'paciente' ||
      user?.user_metadata?.tipo_perfil === 'paciente' ||
      isGoogleUser(user)
  );
}

function isRpcRestaurarRequestError(error) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  const code = String(error?.code || '').trim();
  return (
    code === 'P0001' ||
    message.includes('invalid input syntax for type uuid') ||
    message.includes('perfil invalido') ||
    message.includes('dados insuficientes') ||
    message.includes('nao foi possivel validar perfil')
  );
}

function aplicarChavePerfilRpcCache(actorType, actorId, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!actorType || !isValidRpcActorId(actorId) || !normalizedEmail) {
    return;
  }
  cachedRpcProfileKey = `${actorType}:${actorId}:${normalizedEmail}`;
}

export function getRpcSessionTokenSync() {
  return cachedRpcSessionToken;
}

async function loadRpcSessionMeta() {
  try {
    const raw = await AsyncStorage.getItem(RPC_SESSION_META_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function applyRpcSessionMeta(meta = null) {
  if (!meta || typeof meta !== 'object') {
    return;
  }
  if (meta.profileKey) {
    cachedRpcProfileKey = String(meta.profileKey);
    return;
  }
  if (meta.actorType && meta.actorId && meta.email) {
    cachedRpcProfileKey = `${meta.actorType}:${meta.actorId}:${String(meta.email).trim().toLowerCase()}`;
  }
}

export async function loadRpcSessionToken() {
  try {
    const token = await AsyncStorage.getItem(RPC_SESSION_STORAGE_KEY);
    cachedRpcSessionToken = token || null;
    if (cachedRpcSessionToken) {
      applyRpcSessionMeta(await loadRpcSessionMeta());
    }
    return cachedRpcSessionToken;
  } catch (_error) {
    cachedRpcSessionToken = null;
    return null;
  }
}

function buildRpcProfileKey(user) {
  const { actorType, actorId, email } = resolveActorFromProfile(user);
  if (!actorType || !actorId || !email) return '';
  return `${actorType}:${actorId}:${String(email).trim().toLowerCase()}`;
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

export function isSessaoRpcInvalidaError(error) {
  return isSessaoRpcInvalidaMessage(
    error?.message || error?.details || error?.hint || error
  );
}

/**
 * RPC clinica com um retry apos recuperar token quando o servidor rejeita a sessao.
 */
export async function supabaseRpcClinica(
  functionName,
  params = {},
  { pacienteId = null, user = null } = {}
) {
  const profile = await hydrateRpcActorProfile(resolveRpcActorProfile(user, pacienteId));

  const invoke = async () => {
    const payload = await enrichRpcClinicalParams(params, pacienteId, profile);
    return supabase.rpc(functionName, payload);
  };

  let result = await invoke();
  if (result?.error && isSessaoRpcInvalidaError(result.error)) {
    await recuperarSessaoRpcClinicaUrgente(profile);
    result = await invoke();
  }

  return result;
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

function isNutricionistaProfile(user) {
  if (isPatientProfile(user)) {
    return false;
  }

  return Boolean(
    user?.tipo_perfil === 'nutricionista' ||
      user?.perfil === 'nutricionista' ||
      (user?.id_nutricionista_uuid &&
        (user?.email_acesso || user?.crn || user?.crm_numero || user?.especialidade))
  );
}

function isMedicoProfile(user) {
  if (isPatientProfile(user)) {
    return false;
  }

  return Boolean(
    user?.tipo_perfil === 'medico' ||
      user?.perfil === 'medico' ||
      (user?.id_medico_uuid &&
        (user?.email_medico || user?.crm || user?.crm_numero || user?.especialidade))
  );
}

function resolveNutriEmail(user) {
  return String(
    user?.email_acesso ||
      user?.email ||
      user?.email_nutri ||
      user?.identificador ||
      ''
  ).trim();
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

  if (isPatientProfile(user)) {
    return {
      actorType: 'paciente',
      actorId: isGoogleUser(user) && isValidRpcActorId(user.id) ? user.id : null,
      email: String(user.email_pac || user.email || '').trim(),
    };
  }

  if (isNutricionistaProfile(user) && user.id_nutricionista_uuid) {
    return {
      actorType: 'nutricionista',
      actorId: user.id_nutricionista_uuid,
      email: resolveNutriEmail(user),
    };
  }

  if (isMedicoProfile(user) && user.id_medico_uuid) {
    return {
      actorType: 'medico',
      actorId: user.id_medico_uuid,
      email: String(user.email_medico || user.email || '').trim(),
    };
  }

  if (user.id_nutricionista_uuid) {
    return {
      actorType: 'nutricionista',
      actorId: user.id_nutricionista_uuid,
      email: resolveNutriEmail(user),
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

async function preservarTokenExistenteSeValido(user = null) {
  const token = cachedRpcSessionToken || (await loadRpcSessionToken());
  if (!token) return null;

  const { data, error } = await supabase.rpc('validar_sessao_rpc', {
    p_token_sessao: token,
  });

  if (error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.valida) return null;

  const hydratedUser = (await hydrateRpcActorProfile(user)) || user;
  const { email } = resolveActorFromProfile(hydratedUser);
  const meta = await loadRpcSessionMeta();
  const emailForKey = String(email || meta?.email || '').trim();
  aplicarChavePerfilRpcCache(row.actor_type, row.actor_id, emailForKey);

  sessaoRpcLastEnsuredAt = Date.now();
  return token;
}

async function reutilizarTokenSePerfilCompativel(user) {
  const token = cachedRpcSessionToken || (await loadRpcSessionToken());
  if (!token) return null;

  const { data, error } = await supabase.rpc('validar_sessao_rpc', {
    p_token_sessao: token,
  });

  if (error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.valida) return null;

  let { actorType, actorId, email } = resolveActorFromProfile(user);

  if (!actorType || !actorId) {
    if (
      user?.id_nutricionista_uuid &&
      row.actor_type === 'nutricionista' &&
      row.actor_id === user.id_nutricionista_uuid
    ) {
      actorType = 'nutricionista';
      actorId = user.id_nutricionista_uuid;
    } else if (
      user?.id_medico_uuid &&
      row.actor_type === 'medico' &&
      row.actor_id === user.id_medico_uuid
    ) {
      actorType = 'medico';
      actorId = user.id_medico_uuid;
    } else if (
      user?.id_paciente_uuid &&
      row.actor_type === 'paciente' &&
      row.actor_id === user.id_paciente_uuid
    ) {
      actorType = 'paciente';
      actorId = user.id_paciente_uuid;
    } else {
      sessaoRpcLastEnsuredAt = Date.now();
      return token;
    }
  }

  if (row.actor_type !== actorType || row.actor_id !== actorId) {
    return null;
  }

  if (!email) {
    const meta = await loadRpcSessionMeta();
    email = String(meta?.email || '').trim();
  }

  if (email) {
    aplicarChavePerfilRpcCache(actorType, actorId, email);
    await salvarRpcSessionToken(token, {
      actorType,
      actorId,
      email,
      metodo: 'reuse',
    });
  } else {
    aplicarChavePerfilRpcCache(row.actor_type, row.actor_id, (await loadRpcSessionMeta())?.email);
    sessaoRpcLastEnsuredAt = Date.now();
  }

  return token;
}

export async function hydrateRpcActorProfile(user = null) {
  const base = normalizeRpcActorProfile(user) || user;
  if (!base || typeof base !== 'object') {
    return null;
  }

  const { email } = resolveActorFromProfile(base);
  if (email) {
    return base;
  }

  const meta = await loadRpcSessionMeta();
  const metaEmail = String(meta?.email || '').trim();
  if (!metaEmail) {
    return base;
  }

  if (base.id_nutricionista_uuid && meta.actorType === 'nutricionista') {
    return { ...base, email_acesso: metaEmail, email: metaEmail };
  }

  if (base.id_medico_uuid && meta.actorType === 'medico') {
    return { ...base, email_medico: metaEmail, email: metaEmail };
  }

  if (base.id_paciente_uuid && meta.actorType === 'paciente') {
    return { ...base, email_pac: metaEmail, email: metaEmail };
  }

  return { ...base, email: metaEmail };
}

export async function restaurarSessaoRpcDoPerfil(user) {
  if (Date.now() < restaurarRpcCooldownUntil) {
    return null;
  }

  const hydratedUser = (await hydrateRpcActorProfile(user)) || user;
  const { actorType, actorId, email } = resolveActorFromProfile(hydratedUser);
  if (!actorType || !isValidRpcActorId(actorId) || !String(email || '').trim()) {
    return null;
  }

  const { data, error } = await supabase.rpc('criar_sessao_rpc_restaurar_app', {
    p_actor_type: actorType,
    p_actor_id: actorId,
    p_email: String(email).trim(),
  });

  if (error) {
    if (isRpcRestaurarRequestError(error)) {
      restaurarRpcCooldownUntil = Date.now() + RESTAURAR_RPC_COOLDOWN_MS;
    }
    if (__DEV__) {
      console.log('Falha ao restaurar sessao RPC do perfil:', error.message);
    }
    return null;
  }

  const token = Array.isArray(data) ? data[0] : data;
  if (!token) return null;

  await salvarRpcSessionToken(token, {
    actorType,
    actorId,
    email,
    metodo: 'restaurar_app',
  });
  return token;
}

function shouldUsePatientOAuthFallback(user = null) {
  const { actorType } = resolveActorFromProfile(user);
  if (actorType === 'nutricionista' || actorType === 'medico') {
    return false;
  }
  if (user?.id_paciente_uuid || isPatientProfile(user)) {
    return true;
  }
  return !user;
}

function canRestaurarSessaoRpcPorPerfil(user = null) {
  const { actorType } = resolveActorFromProfile(user);
  return actorType === 'nutricionista' || actorType === 'medico';
}

async function resolverPacienteOAuthMeta(user = null) {
  const hydrated = (await hydrateRpcActorProfile(user)) || user;
  let actorId = hydrated?.id_paciente_uuid || null;
  let email = String(hydrated?.email_pac || hydrated?.email || '').trim();

  if (isValidRpcActorId(actorId) && email) {
    return { actorId, email };
  }

  try {
    const { data: authData } = await supabase.auth.getSession();
    const authUser = authData?.session?.user;
    if (!authUser) {
      return { actorId: null, email: '' };
    }

    email = String(authUser.email || email || '').trim().toLowerCase();
    if (isValidRpcActorId(actorId)) {
      return { actorId, email };
    }

    if (email) {
      const { data: row } = await supabase
        .from('paciente')
        .select('id_paciente_uuid, email_pac')
        .ilike('email_pac', email)
        .maybeSingle();

      if (row?.id_paciente_uuid) {
        return {
          actorId: row.id_paciente_uuid,
          email: String(row.email_pac || email).trim().toLowerCase(),
        };
      }
    }
  } catch (_error) {
    return { actorId: null, email: '' };
  }

  return { actorId: isValidRpcActorId(actorId) ? actorId : null, email };
}

async function emitirSessaoRpcOAuthPacienteInternal(user = null) {
  const { data, error } = await supabase.rpc('criar_sessao_rpc_oauth_paciente');

  if (error) {
    if (__DEV__) {
      console.log('Falha ao emitir sessao RPC OAuth:', error.message);
    }
    return null;
  }

  const token = Array.isArray(data) ? data[0] : data;
  if (!token) return null;

  const { actorId, email } = await resolverPacienteOAuthMeta(user);
  await salvarRpcSessionToken(
    token,
    actorId && email
      ? { actorType: 'paciente', actorId, email, metodo: 'oauth' }
      : { actorType: 'paciente', metodo: 'oauth' }
  );
  return token;
}

async function tentarEmitirSessaoRpcOAuthPaciente(user = null) {
  if (!shouldUsePatientOAuthFallback(user)) {
    return null;
  }

  try {
    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session?.user) {
      return null;
    }

    if (oauthEmitInFlight) {
      return oauthEmitInFlight;
    }

    oauthEmitInFlight = emitirSessaoRpcOAuthPacienteInternal(user).finally(() => {
      oauthEmitInFlight = null;
    });

    return oauthEmitInFlight;
  } catch (_error) {
    return null;
  }
}

async function recuperarSessaoRpcClinicaUrgente(user = null) {
  if (recuperarSessaoInFlight) {
    return recuperarSessaoInFlight;
  }

  recuperarSessaoInFlight = (async () => {
    const hydratedUser = (await hydrateRpcActorProfile(user)) || user;
    await limparRpcSessionToken();

    const oauthToken = await tentarEmitirSessaoRpcOAuthPaciente(hydratedUser);
    if (oauthToken) {
      sessaoRpcLastEnsuredAt = Date.now();
      return oauthToken;
    }

    if (canRestaurarSessaoRpcPorPerfil(hydratedUser)) {
      const restored = await restaurarSessaoRpcDoPerfil(hydratedUser);
      if (restored) {
        sessaoRpcLastEnsuredAt = Date.now();
        return restored;
      }
    }

    return null;
  })().finally(() => {
    recuperarSessaoInFlight = null;
  });

  return recuperarSessaoInFlight;
}

async function resolverSessaoRpcClinica(user = null) {
  const hydratedUser = (await hydrateRpcActorProfile(user)) || user;
  const requestedProfileKey = buildRpcProfileKey(hydratedUser);
  const requestedActor = resolveActorFromProfile(hydratedUser);

  const earlyReuse = await reutilizarTokenSePerfilCompativel(hydratedUser);
  if (earlyReuse) {
    sessaoRpcLastEnsuredAt = Date.now();
    return earlyReuse;
  }

  const oauthToken = await tentarEmitirSessaoRpcOAuthPaciente(hydratedUser);
  if (oauthToken) {
    sessaoRpcLastEnsuredAt = Date.now();
    return oauthToken;
  }

  if (requestedProfileKey && requestedProfileKey !== cachedRpcProfileKey) {
    const preservedOnMismatch = await preservarTokenExistenteSeValido(hydratedUser);
    if (preservedOnMismatch) {
      return preservedOnMismatch;
    }

    if (canRestaurarSessaoRpcPorPerfil(hydratedUser)) {
      const restored = await restaurarSessaoRpcDoPerfil(hydratedUser);
      if (restored) {
        sessaoRpcLastEnsuredAt = Date.now();
        return restored;
      }
    }

    const renewedOnMismatch = await renovarSessaoRpc();
    if (renewedOnMismatch) {
      sessaoRpcLastEnsuredAt = Date.now();
      return renewedOnMismatch;
    }
  }

  if (hydratedUser?.id_nutricionista_uuid || hydratedUser?.id_medico_uuid) {
    const preservedProfissional = await preservarTokenExistenteSeValido(hydratedUser);
    if (preservedProfissional) {
      return preservedProfissional;
    }

    const restored = await restaurarSessaoRpcDoPerfil(hydratedUser);
    if (restored) {
      sessaoRpcLastEnsuredAt = Date.now();
      return restored;
    }

    const renewed = await renovarSessaoRpc();
    if (renewed) {
      sessaoRpcLastEnsuredAt = Date.now();
      return renewed;
    }
  }

  let token = cachedRpcSessionToken || (await loadRpcSessionToken());

  if (token && requestedProfileKey && requestedProfileKey === cachedRpcProfileKey) {
    const renewed = await renovarSessaoRpc();
    if (renewed) {
      sessaoRpcLastEnsuredAt = Date.now();
      return renewed;
    }

    const validAfterRenew = await preservarTokenExistenteSeValido(hydratedUser);
    if (validAfterRenew) {
      return validAfterRenew;
    }

    await limparRpcSessionToken();
    token = null;
  }

  if (hydratedUser && (requestedActor.actorType || hydratedUser.id_paciente_uuid)) {
    const preservedPaciente = await preservarTokenExistenteSeValido(hydratedUser);
    if (preservedPaciente) {
      return preservedPaciente;
    }
  }

  const preservedFinal = await preservarTokenExistenteSeValido(hydratedUser);
  if (preservedFinal) {
    return preservedFinal;
  }

  if (shouldUsePatientOAuthFallback(hydratedUser)) {
    const oauthRetry = await tentarEmitirSessaoRpcOAuthPaciente(hydratedUser);
    if (oauthRetry) {
      sessaoRpcLastEnsuredAt = Date.now();
      return oauthRetry;
    }
  }

  return null;
}

export async function garantirSessaoRpcClinica(user = null) {
  const hydratedUser = (await hydrateRpcActorProfile(user)) || user;
  const now = Date.now();
  const requestedProfileKey = buildRpcProfileKey(hydratedUser);
  const canReuseFastToken =
    cachedRpcSessionToken &&
    now - sessaoRpcLastEnsuredAt < SESSAO_RPC_ENSURE_TTL_MS &&
    (!requestedProfileKey || requestedProfileKey === cachedRpcProfileKey);

  if (canReuseFastToken) {
    return cachedRpcSessionToken;
  }

  if (cachedRpcSessionToken && now - sessaoRpcLastEnsuredAt < SESSAO_RPC_ENSURE_TTL_MS) {
    const reused = await reutilizarTokenSePerfilCompativel(hydratedUser);
    if (reused) {
      return reused;
    }
  }

  if (sessaoRpcEnsureInFlight) {
    return sessaoRpcEnsureInFlight;
  }

  sessaoRpcEnsureInFlight = resolverSessaoRpcClinica(hydratedUser)
    .finally(() => {
      sessaoRpcEnsureInFlight = null;
    });

  return sessaoRpcEnsureInFlight;
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
  cachedRpcProfileKey =
    meta?.profileKey ||
    (meta?.actorType && meta?.actorId && meta?.email
      ? `${meta.actorType}:${meta.actorId}:${String(meta.email).trim().toLowerCase()}`
      : '');
  sessaoRpcLastEnsuredAt = Date.now();
  await AsyncStorage.setItem(RPC_SESSION_STORAGE_KEY, normalized);
  await AsyncStorage.setItem(RPC_SESSION_META_STORAGE_KEY, JSON.stringify(meta || {}));
  return normalized;
}

export async function limparRpcSessionToken() {
  const token = cachedRpcSessionToken || (await loadRpcSessionToken());
  cachedRpcSessionToken = null;
  cachedRpcProfileKey = '';
  sessaoRpcLastEnsuredAt = 0;

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

export async function emitirSessaoRpcPosCredencial({
  role,
  identificador,
  senha,
  actorId = null,
  email = null,
}) {
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

  const resolvedActorId = actorId || null;
  const resolvedEmail = String(email || id || '').trim();
  await salvarRpcSessionToken(
    token,
    resolvedActorId && resolvedEmail
      ? { actorType, actorId: resolvedActorId, email: resolvedEmail, metodo: 'email_senha' }
      : { actorType, metodo: 'email_senha' }
  );
  return token;
}

export async function emitirSessaoRpcOAuthPaciente(user = null) {
  if (oauthEmitInFlight) {
    return oauthEmitInFlight;
  }

  oauthEmitInFlight = emitirSessaoRpcOAuthPacienteInternal(user).finally(() => {
    oauthEmitInFlight = null;
  });

  return oauthEmitInFlight;
}

export function normalizeRpcActorProfile(user = null) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    return null;
  }

  if (user.id_paciente_uuid || isPatientProfile(user)) {
    const email = String(user.email_pac || user.email || '').trim();
    return {
      ...user,
      id_paciente_uuid: user.id_paciente_uuid || null,
      email_pac: email,
      email,
      tipo_perfil: 'paciente',
    };
  }

  if (isNutricionistaProfile(user) && user.id_nutricionista_uuid) {
    const email = resolveNutriEmail(user);
    return {
      id_nutricionista_uuid: user.id_nutricionista_uuid,
      email_acesso: email,
      email,
      tipo_perfil: 'nutricionista',
    };
  }

  if (isMedicoProfile(user) && user.id_medico_uuid) {
    const email = String(user.email_medico || user.email || '').trim();
    return {
      id_medico_uuid: user.id_medico_uuid,
      email_medico: email,
      email,
      tipo_perfil: 'medico',
    };
  }

  if (user.id_nutricionista_uuid) {
    const email = resolveNutriEmail(user);
    return {
      id_nutricionista_uuid: user.id_nutricionista_uuid,
      email_acesso: email,
      email,
    };
  }

  if (user.id_medico_uuid) {
    const email = String(user.email_medico || user.email || '').trim();
    return { id_medico_uuid: user.id_medico_uuid, email_medico: email, email };
  }

  return user;
}

export function resolveRpcActorProfile(user = null, pacienteId = null) {
  const normalized = normalizeRpcActorProfile(user);
  if (normalized) return normalized;

  if (typeof pacienteId === 'string' && pacienteId.trim()) {
    return { id_paciente_uuid: pacienteId.trim() };
  }

  return null;
}

export async function enrichRpcClinicalParams(params = {}, pacienteId = null, user = null) {
  const profile = await hydrateRpcActorProfile(resolveRpcActorProfile(user, pacienteId));
  let token = await garantirSessaoRpcClinica(profile);

  if (!token) {
    token = await recuperarSessaoRpcClinicaUrgente(profile);
  }

  if (!token) {
    throw new Error('Sessao clinica ausente. Saia do app e faca login novamente.');
  }

  const payload = { ...params, p_token_sessao: token };
  const resolvedPatientId =
    (typeof pacienteId === 'string' && pacienteId.trim()) ||
    profile?.id_paciente_uuid ||
    null;

  if (resolvedPatientId) {
    const hasPacienteId = Object.prototype.hasOwnProperty.call(params, 'p_paciente_id');
    const hasIdPacienteUuid = Object.prototype.hasOwnProperty.call(params, 'p_id_paciente_uuid');

    if (hasPacienteId && !payload.p_paciente_id) {
      payload.p_paciente_id = resolvedPatientId;
    } else if (hasIdPacienteUuid && !payload.p_id_paciente_uuid) {
      payload.p_id_paciente_uuid = resolvedPatientId;
    } else if (!hasPacienteId && !hasIdPacienteUuid) {
      payload.p_id_paciente_uuid = resolvedPatientId;
    }
  }

  return payload;
}
