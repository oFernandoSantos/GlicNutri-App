import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const ABA_PERFIL_ATIVO_KEY = '@glicnutri:abaPerfilAtivo';

export const RPC_SESSION_STORAGE_KEY = '@glicnutri:rpcSessionToken';
export const RPC_SESSION_META_STORAGE_KEY = '@glicnutri:rpcSessionMeta';

const LEGACY_PROFILE_KEYS = {
  '@glicnutri:adminSession': 'admin',
  '@glicnutri:nutriSession': 'nutricionista',
  '@glicnutri:medicoSession': 'medico',
  '@glicnutri:patientSession': 'paciente',
};

const STAFF_TIPOS = new Set(['admin', 'nutricionista', 'medico']);

function tipoFromLegacyKey(key) {
  return LEGACY_PROFILE_KEYS[key] || null;
}

function rpcTokenKey(tipo) {
  return `@glicnutri:rpc:token:${tipo}`;
}

function rpcMetaKey(tipo) {
  return `@glicnutri:rpc:meta:${tipo}`;
}

function readSessionStorage(key) {
  if (typeof globalThis.sessionStorage === 'undefined') return null;
  try {
    return globalThis.sessionStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function writeSessionStorage(key, value) {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    if (value == null) {
      globalThis.sessionStorage.removeItem(key);
    } else {
      globalThis.sessionStorage.setItem(key, value);
    }
  } catch (_error) {
    /* noop */
  }
}

function readLocalStorage(key) {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try {
    return globalThis.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function writeLocalStorage(key, value) {
  if (typeof globalThis.localStorage === 'undefined') return;
  try {
    if (value == null) {
      globalThis.localStorage.removeItem(key);
    } else {
      globalThis.localStorage.setItem(key, value);
    }
  } catch (_error) {
    /* noop */
  }
}

export function getAbaPerfilAtivoSync() {
  if (Platform.OS !== 'web') return null;
  return readSessionStorage(ABA_PERFIL_ATIVO_KEY);
}

export async function getAbaPerfilAtivo() {
  return getAbaPerfilAtivoSync();
}

export async function setAbaPerfilAtivo(tipo) {
  if (Platform.OS !== 'web') return;
  writeSessionStorage(ABA_PERFIL_ATIVO_KEY, String(tipo || '').trim() || null);
}

export async function clearAbaPerfilAtivo() {
  if (Platform.OS !== 'web') return;
  writeSessionStorage(ABA_PERFIL_ATIVO_KEY, null);
}

function resolveRpcTipo(meta = null) {
  const fromMeta = String(meta?.actorType || '').trim();
  if (fromMeta) return fromMeta;
  return getAbaPerfilAtivoSync();
}

function clearProfileSessionStorage(tipo) {
  const legacyKey = Object.entries(LEGACY_PROFILE_KEYS).find(([, value]) => value === tipo)?.[0];
  if (legacyKey) {
    writeSessionStorage(legacyKey, null);
  }
}

function clearProfileRpcStorage(tipo) {
  if (!tipo) return;
  writeLocalStorage(rpcTokenKey(tipo), null);
  writeLocalStorage(rpcMetaKey(tipo), null);
}

export async function prepararLoginPerfilWeb(tipo) {
  if (Platform.OS !== 'web' || !tipo) return;

  await setAbaPerfilAtivo(tipo);
  clearProfileSessionStorage(tipo);
  clearProfileRpcStorage(tipo);
}

export function shouldIgnoreSupabaseAuthEventsOnWeb() {
  if (Platform.OS !== 'web') return false;
  return Boolean(getAbaPerfilAtivoSync());
}

function createWebProfileStorage() {
  return {
    async getItem(key) {
      const perfilKey = tipoFromLegacyKey(key);
      if (perfilKey) {
        const abaAtiva = getAbaPerfilAtivoSync();
        if (!abaAtiva || abaAtiva !== perfilKey) {
          return null;
        }
        return readSessionStorage(key);
      }

      if (key === RPC_SESSION_STORAGE_KEY) {
        const abaAtiva = getAbaPerfilAtivoSync();
        if (!abaAtiva) return null;
        return readLocalStorage(rpcTokenKey(abaAtiva));
      }

      if (key === RPC_SESSION_META_STORAGE_KEY) {
        const abaAtiva = getAbaPerfilAtivoSync();
        if (!abaAtiva) return null;
        return readLocalStorage(rpcMetaKey(abaAtiva));
      }

      return readSessionStorage(key);
    },

    async setItem(key, value) {
      const perfilKey = tipoFromLegacyKey(key);
      if (perfilKey) {
        writeSessionStorage(key, value);
        await setAbaPerfilAtivo(perfilKey);
        return;
      }

      if (key === RPC_SESSION_STORAGE_KEY) {
        const abaAtiva = getAbaPerfilAtivoSync();
        if (!abaAtiva) return;
        writeLocalStorage(rpcTokenKey(abaAtiva), value);
        return;
      }

      if (key === RPC_SESSION_META_STORAGE_KEY) {
        const tipo = resolveRpcTipo(safeParseMeta(value));
        if (tipo) {
          writeLocalStorage(rpcMetaKey(tipo), value);
        }
        return;
      }

      writeSessionStorage(key, value);
    },

    async removeItem(key) {
      const perfilKey = tipoFromLegacyKey(key);
      if (perfilKey) {
        writeSessionStorage(key, null);
        return;
      }

      if (key === RPC_SESSION_STORAGE_KEY) {
        const abaAtiva = getAbaPerfilAtivoSync();
        if (!abaAtiva) return;
        const token = readLocalStorage(rpcTokenKey(abaAtiva));
        clearProfileRpcStorage(abaAtiva);
        if (token) {
          try {
            const { supabase } = await import('./configSupabase');
            await supabase.rpc('revogar_sessao_rpc', { p_token_sessao: token });
          } catch (_error) {
            /* noop */
          }
        }
        return;
      }

      if (key === RPC_SESSION_META_STORAGE_KEY) {
        const abaAtiva = getAbaPerfilAtivoSync();
        if (!abaAtiva) return;
        writeLocalStorage(rpcMetaKey(abaAtiva), null);
        return;
      }

      writeSessionStorage(key, null);
    },

    async multiRemove(keys = []) {
      const keySet = new Set(keys);
      if (keySet.has(RPC_SESSION_STORAGE_KEY)) {
        await this.removeItem(RPC_SESSION_STORAGE_KEY);
        return;
      }
      for (const entry of keys) {
        await this.removeItem(entry);
      }
    },
  };
}

function safeParseMeta(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export const storageSessaoPerfil =
  Platform.OS === 'web' ? createWebProfileStorage() : AsyncStorage;

export async function hasSessaoStaffLocal() {
  if (Platform.OS !== 'web') {
    const values = await Promise.all(
      Object.keys(LEGACY_PROFILE_KEYS)
        .filter((key) => STAFF_TIPOS.has(LEGACY_PROFILE_KEYS[key]))
        .map((key) => AsyncStorage.getItem(key))
    );
    return values.some(Boolean);
  }

  const abaAtiva = getAbaPerfilAtivoSync();
  return Boolean(abaAtiva && STAFF_TIPOS.has(abaAtiva));
}

export async function syncClearAbaPerfilSeAtivo(tipo) {
  if (Platform.OS !== 'web') return;
  if ((await getAbaPerfilAtivo()) === tipo) {
    await clearAbaPerfilAtivo();
  }
}

export async function isAbaPerfilPaciente() {
  if (Platform.OS !== 'web') return true;
  const abaAtiva = getAbaPerfilAtivoSync();
  return !abaAtiva || abaAtiva === 'paciente';
}
