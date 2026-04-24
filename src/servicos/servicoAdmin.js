import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_SESSION_STORAGE_KEY = '@glicnutri:adminSession';

export function sanitizeAdminUser(user) {
  if (!user || typeof user !== 'object') {
    return user;
  }

  const sanitized = { ...user };
  delete sanitized.senha_admin;
  return sanitized;
}

export function isAdminUser(user) {
  return Boolean(
    user?.tipo_perfil === 'admin' ||
      user?.perfil === 'admin' ||
      user?.id_admin_uuid
  );
}

export async function salvarSessaoAdmin(user) {
  const sanitized = sanitizeAdminUser(user);
  await AsyncStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function carregarSessaoAdmin() {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeAdminUser(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
}

export async function limparSessaoAdmin() {
  try {
    await AsyncStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch (_error) {
    return null;
  }
}
