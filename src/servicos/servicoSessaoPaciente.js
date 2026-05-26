import AsyncStorage from '@react-native-async-storage/async-storage';
import { isPatientUser } from '../utilitarios/perfisApp';

export const PATIENT_SESSION_STORAGE_KEY = '@glicnutri:patientSession';

export function sanitizePatientUser(user) {
  if (!user || typeof user !== 'object') {
    return user;
  }

  const sanitized = { ...user };
  delete sanitized.senha_pac;
  delete sanitized.senha;
  delete sanitized.senha_nutri;
  return sanitized;
}

export async function salvarSessaoPaciente(user) {
  const sanitized = sanitizePatientUser(user);
  await AsyncStorage.setItem(PATIENT_SESSION_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function carregarSessaoPaciente() {
  try {
    const raw = await AsyncStorage.getItem(PATIENT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = sanitizePatientUser(JSON.parse(raw));
    return isPatientUser(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

export async function limparSessaoPaciente() {
  try {
    await AsyncStorage.removeItem(PATIENT_SESSION_STORAGE_KEY);
  } catch (_error) {
    return null;
  }
}
