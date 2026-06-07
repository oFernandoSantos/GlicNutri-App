import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(pacienteId, medicoId) {
  return `@glicnutri:documentos-medico:${medicoId}:${pacienteId}`;
}

export async function loadDocumentosClinicosMedico(pacienteId, medicoId) {
  if (!pacienteId || !medicoId) {
    return { receitas: [], atestados: [] };
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(pacienteId, medicoId));
    if (!raw) return { receitas: [], atestados: [] };
    const parsed = JSON.parse(raw);
    return {
      receitas: Array.isArray(parsed?.receitas) ? parsed.receitas : [],
      atestados: Array.isArray(parsed?.atestados) ? parsed.atestados : [],
    };
  } catch {
    return { receitas: [], atestados: [] };
  }
}

export async function saveDocumentosClinicosMedico(pacienteId, medicoId, { receitas = [], atestados = [] } = {}) {
  if (!pacienteId || !medicoId) {
    throw new Error('Paciente ou médico sem identificador.');
  }

  await AsyncStorage.setItem(
    storageKey(pacienteId, medicoId),
    JSON.stringify({
      receitas,
      atestados,
      updatedAt: new Date().toISOString(),
    })
  );

  return { receitas, atestados };
}
