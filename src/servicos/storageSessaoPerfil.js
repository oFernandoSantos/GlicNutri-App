import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STAFF_SESSION_KEYS = [
  '@glicnutri:adminSession',
  '@glicnutri:nutriSession',
  '@glicnutri:medicoSession',
];

/**
 * Sessoes de perfil (admin/nutri/medico/paciente/RPC) ficam isoladas por aba no web.
 * Supabase Auth continua em AsyncStorage (localStorage) — compartilhado entre abas.
 */
function createWebSessionStorage() {
  const hasSessionStorage =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.sessionStorage !== 'undefined';

  return {
    async getItem(key) {
      if (!hasSessionStorage) return null;
      try {
        return globalThis.sessionStorage.getItem(key);
      } catch (_error) {
        return null;
      }
    },
    async setItem(key, value) {
      if (!hasSessionStorage) return;
      try {
        globalThis.sessionStorage.setItem(key, value);
      } catch (_error) {
        /* noop */
      }
    },
    async removeItem(key) {
      if (!hasSessionStorage) return;
      try {
        globalThis.sessionStorage.removeItem(key);
      } catch (_error) {
        /* noop */
      }
    },
    async multiRemove(keys = []) {
      if (!hasSessionStorage) return;
      try {
        keys.forEach((key) => globalThis.sessionStorage.removeItem(key));
      } catch (_error) {
        /* noop */
      }
    },
  };
}

export const storageSessaoPerfil =
  Platform.OS === 'web' ? createWebSessionStorage() : AsyncStorage;

export async function hasSessaoStaffLocal() {
  const values = await Promise.all(
    STAFF_SESSION_KEYS.map((key) => storageSessaoPerfil.getItem(key))
  );
  return values.some(Boolean);
}
