import { storageSessaoPerfil, syncClearAbaPerfilSeAtivo } from './storageSessaoPerfil';
import { limparRpcSessionToken } from './servicoSessaoRpc';

export const MEDICO_SESSION_STORAGE_KEY = '@glicnutri:medicoSession';

export function sanitizeMedicoUser(user) {
  if (!user || typeof user !== 'object') return user;
  const sanitized = { ...user };
  delete sanitized.senha_medico;
  delete sanitized.senha;
  return sanitized;
}

export function isMedicoUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (user?.tipo_perfil === 'paciente' || user?.id_paciente_uuid) return false;
  if (user?.tipo_perfil === 'nutricionista' || user?.id_nutricionista_uuid) return false;
  return Boolean(
    user?.tipo_perfil === 'medico' ||
      user?.perfil === 'medico' ||
      user?.id_medico_uuid
  );
}

export async function salvarSessaoMedico(user) {
  const sanitized = {
    ...sanitizeMedicoUser(user),
    tipo_perfil: 'medico',
  };
  await storageSessaoPerfil.setItem(MEDICO_SESSION_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function carregarSessaoMedico() {
  try {
    const raw = await storageSessaoPerfil.getItem(MEDICO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = sanitizeMedicoUser(JSON.parse(raw));
    return isMedicoUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function limparSessaoMedico() {
  try {
    await limparRpcSessionToken();
    await storageSessaoPerfil.removeItem(MEDICO_SESSION_STORAGE_KEY);
    await syncClearAbaPerfilSeAtivo('medico');
  } catch {
    return null;
  }
}

export function getMedicoId(usuario) {
  return (
    usuario?.id_medico_uuid ||
    usuario?.user_metadata?.id_medico_uuid ||
    usuario?.id ||
    null
  );
}
