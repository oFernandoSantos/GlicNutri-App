import AsyncStorage from '@react-native-async-storage/async-storage';
import { limparRpcSessionToken } from './servicoSessaoRpc';

export const NUTRI_SESSION_STORAGE_KEY = '@glicnutri:nutriSession';

export function sanitizeNutriUser(user) {
  if (!user || typeof user !== 'object') {
    return user;
  }
  const sanitized = { ...user };
  delete sanitized.senha_nutricionista;
  delete sanitized.senha;
  return sanitized;
}

export function isNutriUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (
    user?.tipo_perfil === 'paciente' ||
    user?.perfil === 'paciente' ||
    user?.id_paciente_uuid
  ) {
    return false;
  }
  return Boolean(
    user?.tipo_perfil === 'nutricionista' ||
      user?.perfil === 'nutricionista' ||
      user?.id_nutricionista_uuid
  );
}

export async function salvarSessaoNutricionista(user) {
  const sanitized = sanitizeNutriUser(user);
  await AsyncStorage.setItem(NUTRI_SESSION_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function carregarSessaoNutricionista() {
  try {
    const raw = await AsyncStorage.getItem(NUTRI_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = sanitizeNutriUser(JSON.parse(raw));
    return isNutriUser(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

export async function limparSessaoNutricionista() {
  try {
    await limparRpcSessionToken();
    await AsyncStorage.removeItem(NUTRI_SESSION_STORAGE_KEY);
  } catch (_error) {
    return null;
  }
}
