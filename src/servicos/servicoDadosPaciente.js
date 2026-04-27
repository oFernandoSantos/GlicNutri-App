import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { syncGooglePatientRecord, isGoogleUser } from './sincronizarPacienteGoogle';
import { mergeCachedGlucoseReadings } from './centralGlicose';
import { replaceCachedPatientAppState } from './centralAppState';
import {
  mealPlanSections,
  nutritionistThread,
} from '../dados/dadosExperienciaPaciente';

const META_START = '[GLICNUTRI_APP_META_START]';
const META_END = '[GLICNUTRI_APP_META_END]';

export function getPatientId(usuario) {
  return (
    usuario?.id_paciente_uuid ||
    usuario?.user_metadata?.id_paciente_uuid ||
    (isGoogleUser(usuario) ? usuario?.id : null) ||
    usuario?.patient_id ||
    null
  );
}

export function getPatientDisplayName(usuario) {
  return (
    usuario?.nome_completo ||
    usuario?.user_metadata?.full_name ||
    usuario?.user_metadata?.name ||
    usuario?.email_pac ||
    usuario?.email ||
    'Paciente'
  );
}

export function sanitizeSensitivePatientData(patient) {
  if (!patient || typeof patient !== 'object') {
    return patient;
  }

  const sanitized = { ...patient };
  delete sanitized.senha_pac;
  delete sanitized.senha_nutri;

  return sanitized;
}

export function createDefaultAppState() {
  return {
    version: 1,
    waterCount: 0,
    mealEntries: [],
    hiddenMealEntryIds: [],
    activityEntries: [],
    medicationEntries: [],
    hiddenMedicationEntryIds: [],
    symptomEntries: [],
    assistantMessages: [],
    patientNotifications: [],
    hiddenGlucoseReadingIds: [],
    nutritionistThread,
    planSections: mealPlanSections,
    wellness: {
      selectedSymptoms: ['focused'],
      selectedSleep: 'good',
      selectedStress: 2,
    },
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureWellness(value) {
  const defaults = createDefaultAppState().wellness;

  return {
    selectedSymptoms: ensureArray(value?.selectedSymptoms).length
      ? value.selectedSymptoms
      : defaults.selectedSymptoms,
    selectedSleep: value?.selectedSleep || defaults.selectedSleep,
    selectedStress: value?.selectedStress || defaults.selectedStress,
  };
}

function normalizeAppState(rawState) {
  const defaults = createDefaultAppState();
  const appState = rawState && typeof rawState === 'object' ? rawState : {};

  return {
    ...defaults,
    ...appState,
    waterCount: Number.isFinite(appState.waterCount) ? appState.waterCount : defaults.waterCount,
    mealEntries: ensureArray(appState.mealEntries),
    hiddenMealEntryIds: ensureArray(appState.hiddenMealEntryIds),
    activityEntries: ensureArray(appState.activityEntries),
    medicationEntries: ensureArray(appState.medicationEntries),
    hiddenMedicationEntryIds: ensureArray(appState.hiddenMedicationEntryIds),
    symptomEntries: ensureArray(appState.symptomEntries),
    assistantMessages: ensureArray(appState.assistantMessages),
    patientNotifications: ensureArray(appState.patientNotifications),
    hiddenGlucoseReadingIds: ensureArray(appState.hiddenGlucoseReadingIds),
    nutritionistThread: ensureArray(appState.nutritionistThread).length
      ? appState.nutritionistThread
      : defaults.nutritionistThread,
    planSections: ensureArray(appState.planSections).length
      ? appState.planSections
      : defaults.planSections,
    wellness: ensureWellness(appState.wellness),
  };
}

function prepareAppStateForStorage(appState) {
  const normalized = normalizeAppState(appState);

  return {
    ...normalized,
    medicationEntries: normalized.medicationEntries.filter(
      (entry) => entry?.storageOrigin !== 'database'
    ),
  };
}

function appendUniqueId(array, id) {
  if (!id) {
    return ensureArray(array);
  }

  return uniqueValues([id, ...ensureArray(array)]);
}

function mergeHiddenEntriesPreservingStorage({
  incomingEntries,
  storedEntries,
  hiddenIds,
  getEntryId,
}) {
  const normalizedIncoming = ensureArray(incomingEntries);
  const normalizedStored = ensureArray(storedEntries);
  const hiddenIdSet = new Set(ensureArray(hiddenIds).filter(Boolean));
  const visibleEntryIds = new Set(
    normalizedIncoming.map((entry) => getEntryId(entry)).filter(Boolean)
  );
  const hiddenEntriesToPreserve = normalizedStored.filter((entry) => {
    const entryId = getEntryId(entry);

    return Boolean(entryId) && hiddenIdSet.has(entryId) && !visibleEntryIds.has(entryId);
  });

  if (!hiddenEntriesToPreserve.length) {
    return normalizedIncoming;
  }

  return [...normalizedIncoming, ...hiddenEntriesToPreserve];
}

export function extractObjectiveAndAppState(rawText) {
  const text = rawText || '';
  const startIndex = text.indexOf(META_START);
  const endIndex = text.indexOf(META_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return {
      objectiveText: text.trim(),
      appState: createDefaultAppState(),
    };
  }

  const objectiveText = text.slice(0, startIndex).trim();
  const payload = text.slice(startIndex + META_START.length, endIndex).trim();

  try {
    return {
      objectiveText,
      appState: normalizeAppState(JSON.parse(payload)),
    };
  } catch (error) {
    console.log('Erro ao interpretar metadata do paciente:', error);

    return {
      objectiveText,
      appState: createDefaultAppState(),
    };
  }
}

function serializeObjectiveAndAppState(objectiveText, appState) {
  const baseText = (objectiveText || '').trim();
  const payload = JSON.stringify(prepareAppStateForStorage(appState));

  if (baseText) {
    return `${baseText}\n\n${META_START}\n${payload}\n${META_END}`;
  }

  return `${META_START}\n${payload}\n${META_END}`;
}

function buildTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildCurrentTimeString() {
  return new Date().toTimeString().slice(0, 8);
}

function buildUuid() {
  if (globalThis?.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}

function normalizeMedicationType(value) {
  return value === 'insulin' ? 'insulin' : 'medicine';
}

function normalizeMedicationDate(value) {
  return String(value || buildTodayDateString()).slice(0, 10);
}

function normalizeMedicationTime(value) {
  return String(value || buildCurrentTimeString()).slice(0, 5);
}

function normalizeMedicationNumber(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function parseMedicationObservation(value) {
  const observation = String(value || '').trim();
  const categoryMatch = observation.match(/Categoria da insulina:\s*(.+)$/im);
  const usageMatch = observation.match(/Objetivo do uso:\s*(.+)$/im);
  const notesMatch = observation.match(/Observacoes:\s*(.+)$/im);

  return {
    insulinCategory: categoryMatch?.[1]?.trim() || '',
    insulinUsage: usageMatch?.[1]?.trim() || '',
    insulinNotes: notesMatch?.[1]?.trim() || '',
  };
}

function buildMedicationObservation(entry) {
  const insulinCategory = String(entry?.insulinCategory || '').trim();
  const insulinUsage = String(entry?.insulinUsage || '').trim();
  const insulinNotes = String(entry?.insulinNotes || '').trim();
  const observationLines = [];

  if (insulinCategory) {
    observationLines.push(`Categoria da insulina: ${insulinCategory}`);
  }

  if (insulinUsage) {
    observationLines.push(`Objetivo do uso: ${insulinUsage}`);
  }

  if (insulinNotes) {
    observationLines.push(`Observacoes: ${insulinNotes}`);
  }

  return observationLines.length ? observationLines.join('\n') : null;
}

function buildMedicationSignature(entry) {
  return [
    normalizeMedicationDate(entry?.date),
    normalizeMedicationTime(entry?.time),
    normalizeMedicationType(entry?.medicationKind || entry?.tipo_registro),
    String(entry?.medicineName || entry?.nome_medicamento || '').trim().toLowerCase(),
    String(entry?.medicineUnit || entry?.unidade_medida || '').trim().toLowerCase(),
    String(entry?.medicineQuantity || entry?.quantidade || '').trim().toLowerCase(),
    entry?.medicineContinuousUse || entry?.uso_continuo ? 'continuous' : 'dated',
    String(entry?.medicineDays || entry?.dias_tratamento || '').trim().toLowerCase(),
    String(entry?.label || entry?.descricao || '').trim().toLowerCase(),
  ].join('|');
}

function normalizeMedicationEntry(item, storageOrigin = 'legacy', index = 0) {
  const normalizedType = normalizeMedicationType(item?.medicationKind || item?.tipo_registro);
  const date = normalizeMedicationDate(item?.date || item?.data);
  const time = normalizeMedicationTime(item?.time || item?.hora);
  const medicineName = String(item?.medicineName || item?.nome_medicamento || '').trim();
  const medicineUnit = String(item?.medicineUnit || item?.unidade_medida || '').trim();
  const medicineQuantity = String(item?.medicineQuantity || item?.quantidade || '').trim();
  const daysValue = item?.medicineDays ?? item?.dias_tratamento ?? '';
  const medicineDays = daysValue === null || typeof daysValue === 'undefined'
    ? ''
    : String(daysValue).trim();
  const medicineContinuousUse = Boolean(item?.medicineContinuousUse ?? item?.uso_continuo);
  const label = String(item?.label || item?.descricao || '').trim() || 'Medicacao / insulina';
  const databaseId = item?.id_registro_medicacao_uuid || null;
  const observation = String(item?.observacao || '').trim();
  const parsedObservation = parseMedicationObservation(observation);

  return {
    id:
      item?.id ||
      databaseId ||
      item?.id_registro_legado ||
      `med-${date}-${time}-${index}`,
    kind: 'medication',
    label,
    date,
    time,
    medicationKind: normalizedType,
    medicineName,
    medicineUnit,
    medicineQuantity,
    medicineDays,
    medicineContinuousUse,
    patientId: item?.id_paciente_uuid || item?.patientId || null,
    insulinCategory: String(item?.insulinCategory || parsedObservation.insulinCategory || '').trim(),
    insulinUsage: String(item?.insulinUsage || parsedObservation.insulinUsage || '').trim(),
    insulinNotes: String(item?.insulinNotes || parsedObservation.insulinNotes || '').trim(),
    observation,
    storageOrigin,
    databaseId,
    legacyId: item?.id || item?.id_registro_legado || null,
  };
}

function mergeMedicationEntries(databaseEntries, legacyEntries) {
  const merged = [];
  const seenIds = new Set();
  const seenSignatures = new Set();

  [...ensureArray(databaseEntries), ...ensureArray(legacyEntries)].forEach((entry, index) => {
    const normalized = normalizeMedicationEntry(entry, entry?.storageOrigin, index);
    const entryId = String(normalized.databaseId || normalized.id || '');
    const signature = buildMedicationSignature(normalized);

    if (entryId && seenIds.has(entryId)) {
      return;
    }

    if (signature && seenSignatures.has(signature)) {
      return;
    }

    if (entryId) {
      seenIds.add(entryId);
    }

    if (signature) {
      seenSignatures.add(signature);
    }

    merged.push(normalized);
  });

  return merged.sort((left, right) => {
    const leftStamp = `${left.date || '1970-01-01'}T${left.time || '00:00:00'}`;
    const rightStamp = `${right.date || '1970-01-01'}T${right.time || '00:00:00'}`;
    return rightStamp.localeCompare(leftStamp);
  });
}

function buildMedicationEntryFromPayload(payload) {
  return normalizeMedicationEntry(payload, 'database');
}

function buildGlucoseReadingFromPayload(payload, fallbackValue) {
  const symptoms = payload.sintomas_associados || payload.symptoms || '';
  const glucoseTypeMatch = String(symptoms).match(/Tipo da glicemia:\s*(.+)$/i);

  return {
    id: payload.id_glicemia_manual_uuid || `${payload.data}-${payload.hora}-${Date.now()}`,
    patientId: payload.id_paciente_uuid,
    value: Number(payload.valor_glicose_mgdl) || Number(fallbackValue) || 0,
    date: payload.data || buildTodayDateString(),
    time: payload.hora || buildCurrentTimeString(),
    glucoseType: payload.glucoseType || glucoseTypeMatch?.[1] || '',
  };
}

function normalizeGlucoseReadingRow(item, index = 0) {
  const symptoms = item.sintomas_associados || '';
  const glucoseTypeMatch = String(symptoms).match(/Tipo da glicemia:\s*(.+)$/i);

  return {
    id: item.id_glicemia_manual_uuid || `${item.data || 'sem-data'}-${item.hora || 'sem-hora'}-${index}`,
    patientId: item.id_paciente_uuid,
    value: Number(item.valor_glicose_mgdl) || 0,
    date: item.data || buildTodayDateString(),
    time: item.hora || buildCurrentTimeString(),
    glucoseType: item.glucoseType || glucoseTypeMatch?.[1] || '',
  };
}

function mapSleepToLabel(value) {
  const map = {
    poor: 'Ruim',
    ok: 'Regular',
    good: 'Boa',
    great: 'Otima',
  };

  return map[value] || 'Boa';
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEmail(value) {
  return value ? String(value).trim().toLowerCase() : '';
}

function normalizeCpf(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

function getContextEmails(...sources) {
  return uniqueValues(
    sources.flatMap((source) => [
      normalizeEmail(source?.email_pac),
      normalizeEmail(source?.email),
      normalizeEmail(source?.user_metadata?.email),
    ])
  );
}

function getContextCpfs(...sources) {
  return uniqueValues(
    sources.map((source) => normalizeCpf(source?.cpf_paciente))
  );
}

function getContextIds(...sources) {
  return uniqueValues(
    sources.flatMap((source) => [
      source?.id_paciente_uuid || null,
      source?.patient_id || null,
      source?.user_metadata?.id_paciente_uuid || null,
      isGoogleUser(source) ? source?.id || null : null,
    ])
  );
}

async function fetchPatientByEmail(email) {
  if (!email) return null;

  const { data, error } = await supabase
    .from('paciente')
    .select('*')
    .ilike('email_pac', email)
    .limit(1);

  if (error) {
    throw error;
  }

  return sanitizeSensitivePatientData((data || [])[0] || null);
}

async function fetchPatientByCpf(cpf) {
  if (!cpf) return null;

  const { data, error } = await supabase
    .from('paciente')
    .select('*')
    .eq('cpf_paciente', cpf)
    .limit(1);

  if (error) {
    throw error;
  }

  return sanitizeSensitivePatientData((data || [])[0] || null);
}

async function resolvePatientRecord({
  patientId,
  patientContext,
  currentPatient,
  allowGoogleSync = false,
}) {
  const candidateIds = uniqueValues([
    patientId,
    ...getContextIds(currentPatient, patientContext),
  ]);

  for (const candidateId of candidateIds) {
    const { data, error } = await supabase
      .from('paciente')
      .select('*')
      .eq('id_paciente_uuid', candidateId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return sanitizeSensitivePatientData(data);
    }
  }

  const candidateEmails = getContextEmails(currentPatient, patientContext);

  for (const email of candidateEmails) {
    const patientByEmail = await fetchPatientByEmail(email);

    if (patientByEmail) {
      return patientByEmail;
    }
  }

  const candidateCpfs = getContextCpfs(currentPatient, patientContext);

  for (const cpf of candidateCpfs) {
    const patientByCpf = await fetchPatientByCpf(cpf);

    if (patientByCpf) {
      return patientByCpf;
    }
  }

  if (allowGoogleSync && isGoogleUser(patientContext)) {
    return await syncGooglePatientRecord(patientContext);
  }

  return null;
}

export async function fetchPatientById(patientId, options = {}) {
  return await resolvePatientRecord({
    patientId,
    patientContext: options.patientContext,
    currentPatient: options.currentPatient,
    allowGoogleSync: true,
  });
}

export async function fetchPatientExperience(patientId, options = {}) {
  const patient = await fetchPatientById(patientId, options);
  const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
  const effectivePatientId = patient?.id_paciente_uuid || patientId;
  const normalizedAppState = normalizeAppState(parsed.appState);
  const [glucoseReadings, databaseMedicationEntries] = await Promise.all([
    fetchGlucoseReadings(effectivePatientId),
    fetchMedicationEntries(effectivePatientId),
  ]);
  const legacyMedicationEntries = ensureArray(normalizedAppState.medicationEntries).map(
    (entry, index) => normalizeMedicationEntry(entry, 'legacy', index)
  );
  const medicationEntries = mergeMedicationEntries(
    databaseMedicationEntries,
    legacyMedicationEntries
  );
  const includeHidden = Boolean(options.includeHidden);
  const visibleMealEntries = includeHidden
    ? normalizedAppState.mealEntries
    : normalizedAppState.mealEntries.filter(
        (entry) => !normalizedAppState.hiddenMealEntryIds.includes(entry?.id)
      );
  const visibleMedicationEntries = includeHidden
    ? medicationEntries
    : medicationEntries.filter(
        (entry) =>
          !normalizedAppState.hiddenMedicationEntryIds.includes(
            entry?.databaseId || entry?.legacyId || entry?.id
          )
      );
  const visibleGlucoseReadings = includeHidden
    ? glucoseReadings
    : glucoseReadings.filter(
        (entry) => !normalizedAppState.hiddenGlucoseReadingIds.includes(entry?.id)
      );

  return {
    patient,
    clinicalObjective: parsed.objectiveText,
    appState: {
      ...normalizedAppState,
      mealEntries: visibleMealEntries,
      medicationEntries: visibleMedicationEntries,
    },
    glucoseReadings: visibleGlucoseReadings,
  };
}

export async function savePatientAppState({
  patientId,
  objectiveText,
  appState,
  currentPatient,
  patientContext,
}) {
  const resolvedPatient = await resolvePatientRecord({
    patientId,
    currentPatient,
    patientContext,
    allowGoogleSync: true,
  });

  const effectivePatientId = resolvedPatient?.id_paciente_uuid || patientId;

  if (!effectivePatientId) {
    throw new Error('Paciente sem identificador valido para salvar.');
  }

  const storedPatientState = extractObjectiveAndAppState(
    resolvedPatient?.objetivo_principal_consulta
  ).appState;
  const normalized = normalizeAppState(appState);
  const normalizedWithHiddenPreserved = {
    ...normalized,
    mealEntries: mergeHiddenEntriesPreservingStorage({
      incomingEntries: normalized.mealEntries,
      storedEntries: storedPatientState?.mealEntries,
      hiddenIds: normalized.hiddenMealEntryIds,
      getEntryId: (entry) => entry?.id,
    }),
    medicationEntries: mergeHiddenEntriesPreservingStorage({
      incomingEntries: normalized.medicationEntries,
      storedEntries: storedPatientState?.medicationEntries,
      hiddenIds: normalized.hiddenMedicationEntryIds,
      getEntryId: (entry) => entry?.databaseId || entry?.legacyId || entry?.id,
    }),
  };
  const latestActivity =
    normalizedWithHiddenPreserved.activityEntries[0]?.label ||
    resolvedPatient?.nivel_atividade_fisica_atual ||
    currentPatient?.nivel_atividade_fisica_atual ||
    null;

  const patch = {
    objetivo_principal_consulta: serializeObjectiveAndAppState(
      objectiveText,
      normalizedWithHiddenPreserved
    ),
    qualidade_sono_media: mapSleepToLabel(normalizedWithHiddenPreserved.wellness.selectedSleep),
    nivel_atividade_fisica_atual: latestActivity,
    data_hora_ultima_atualizacao: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('paciente')
    .update(patch)
    .eq('id_paciente_uuid', effectivePatientId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id_paciente_uuid) {
    throw new Error('O banco nao confirmou a atualizacao dos dados do paciente.');
  }

  await registrarLogAuditoria({
    actor: currentPatient || patientContext || data,
    targetPatientId: data.id_paciente_uuid,
    action: 'paciente_app_state_atualizado',
    entity: 'paciente',
    entityId: data.id_paciente_uuid,
    origin: 'app_state',
    details: {
      waterCount: normalizedWithHiddenPreserved.waterCount,
      mealEntries: normalizedWithHiddenPreserved.mealEntries.length,
      medicationEntries: normalizedWithHiddenPreserved.medicationEntries.length,
      activityEntries: normalizedWithHiddenPreserved.activityEntries.length,
      symptomEntries: normalizedWithHiddenPreserved.symptomEntries.length,
      hiddenMealEntryIds: normalizedWithHiddenPreserved.hiddenMealEntryIds.length,
      hiddenMedicationEntryIds: normalizedWithHiddenPreserved.hiddenMedicationEntryIds.length,
      hiddenGlucoseReadingIds: normalizedWithHiddenPreserved.hiddenGlucoseReadingIds.length,
    },
  });

  replaceCachedPatientAppState(data.id_paciente_uuid, normalizedWithHiddenPreserved);

  return {
    patient: sanitizeSensitivePatientData(data),
    appState: normalizedWithHiddenPreserved,
    clinicalObjective: objectiveText,
  };
}

export async function updatePatientProfile({
  patientId,
  patch,
  currentPatient,
  patientContext,
}) {
  const resolvedPatient = await resolvePatientRecord({
    patientId,
    currentPatient,
    patientContext,
    allowGoogleSync: true,
  });

  const effectivePatientId = resolvedPatient?.id_paciente_uuid || patientId;

  if (!effectivePatientId) {
    throw new Error('Paciente sem identificador valido para salvar.');
  }

  const { data, error } = await supabase
    .from('paciente')
    .update({
      ...patch,
      data_hora_ultima_atualizacao: new Date().toISOString(),
    })
    .eq('id_paciente_uuid', effectivePatientId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id_paciente_uuid) {
    throw new Error('O banco nao confirmou a atualizacao dos dados do paciente.');
  }

  await registrarLogAuditoria({
    actor: currentPatient || patientContext || data,
    targetPatientId: data.id_paciente_uuid,
    action: 'paciente_perfil_atualizado',
    entity: 'paciente',
    entityId: data.id_paciente_uuid,
    origin: 'perfil',
    details: {
      camposAtualizados: Object.keys(patch || {}),
    },
  });

  return sanitizeSensitivePatientData(data);
}

export async function fetchGlucoseReadings(patientId, limit = 120) {
  if (!patientId) {
    return [];
  }

  let rpcReadings = [];
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'listar_glicemias_manuais_paciente',
    {
      p_id_paciente_uuid: patientId,
      p_limite: limit,
    }
  );

  if (!rpcError && Array.isArray(rpcData)) {
    rpcReadings = rpcData.map(normalizeGlucoseReadingRow);
  }

  const rpcMessage = String(rpcError?.message || '').toLowerCase();
  const rpcMissing =
    rpcMessage.includes('could not find the function') ||
    rpcMessage.includes('schema cache') ||
    rpcMessage.includes('listar_glicemias_manuais_paciente');

  if (rpcError && !rpcMissing) {
    console.log('Erro ao buscar glicemia por RPC:', rpcError.message);
  }

  let { data, error } = await supabase
    .from('registro_glicemia_manual')
    .select('id_glicemia_manual_uuid, id_paciente_uuid, valor_glicose_mgdl, data, hora, sintomas_associados')
    .eq('id_paciente_uuid', patientId)
    .order('data', { ascending: false })
    .order('hora', { ascending: false })
    .limit(limit);

  if (String(error?.message || '').toLowerCase().includes('sintomas_associados')) {
    const retry = await supabase
      .from('registro_glicemia_manual')
      .select('id_glicemia_manual_uuid, id_paciente_uuid, valor_glicose_mgdl, data, hora')
      .eq('id_paciente_uuid', patientId)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(limit);

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.log('Erro ao buscar glicemia:', error.message);
    return rpcReadings;
  }

  return mergeCachedGlucoseReadings(
    (data || []).map(normalizeGlucoseReadingRow),
    rpcReadings
  ).slice(0, limit);
}

export async function fetchMedicationEntries(patientId, limit = 120) {
  if (!patientId) {
    return [];
  }

  let rpcEntries = [];
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'listar_medicacoes_paciente',
    {
      p_id_paciente_uuid: patientId,
      p_limite: limit,
    }
  );

  if (!rpcError && Array.isArray(rpcData)) {
    rpcEntries = rpcData.map((item, index) =>
      normalizeMedicationEntry(item, 'database', index)
    );
  }

  const rpcMessage = String(rpcError?.message || '').toLowerCase();
  const rpcMissing =
    rpcMessage.includes('could not find the function') ||
    rpcMessage.includes('schema cache') ||
    rpcMessage.includes('listar_medicacoes_paciente');

  if (rpcError && !rpcMissing) {
    console.log('Erro ao buscar medicacoes por RPC:', rpcError.message);
  }

  const { data, error } = await supabase
    .from('registro_medicacao')
    .select([
      'id_registro_medicacao_uuid',
      'id_paciente_uuid',
      'tipo_registro',
      'descricao',
      'nome_medicamento',
      'unidade_medida',
      'quantidade',
      'data',
      'hora',
      'dias_tratamento',
      'uso_continuo',
      'observacao',
      'id_registro_legado',
    ].join(', '))
    .eq('id_paciente_uuid', patientId)
    .order('data', { ascending: false })
    .order('hora', { ascending: false })
    .limit(limit);

  if (error) {
    console.log('Erro ao buscar medicacoes:', error.message);
    return rpcEntries;
  }

  return mergeMedicationEntries(
    (data || []).map((item, index) => normalizeMedicationEntry(item, 'database', index)),
    rpcEntries
  ).slice(0, limit);
}

export async function addGlucoseReading(patientId, value, options = {}) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para registrar glicemia.');
  }

  const normalizedSymptoms = options.symptoms || 'Registro manual pelo app';
  const fallbackPayload = {
    id_glicemia_manual_uuid: options.id || buildUuid(),
    id_paciente_uuid: patientId,
    valor_glicose_mgdl: Number(value),
    data: options.date || buildTodayDateString(),
    hora: options.time || buildCurrentTimeString(),
    sintomas_associados: normalizedSymptoms,
  };

  const { data: rpcData, error: rpcError } = await supabase
    .rpc('registrar_glicemia_manual_paciente', {
      p_id_paciente_uuid: patientId,
      p_valor_glicose_mgdl: fallbackPayload.valor_glicose_mgdl,
      p_data: fallbackPayload.data,
      p_hora: fallbackPayload.hora,
      p_sintomas_associados: normalizedSymptoms,
    });

  if (!rpcError) {
    const saved = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const savedReading = saved
      ? buildGlucoseReadingFromPayload(
          {
            ...fallbackPayload,
            ...saved,
          },
          value
        )
      : buildGlucoseReadingFromPayload(fallbackPayload, value);

    await registrarLogAuditoria({
      actor: options.actor || null,
      targetPatientId: patientId,
      action: 'glicemia_manual_cadastrada',
      entity: 'registro_glicemia_manual',
      entityId: savedReading.id,
      origin: options.auditSource || 'monitoramento_manual',
      details: {
        valorMgDl: savedReading.value,
        data: savedReading.date,
        hora: savedReading.time,
        tipoGlicemia: savedReading.glucoseType || '',
      },
    });

    return savedReading;
  }

  const rpcMessage = String(rpcError?.message || '').toLowerCase();
  const rpcMissing =
    rpcMessage.includes('could not find the function') ||
    rpcMessage.includes('schema cache') ||
    rpcMessage.includes('registrar_glicemia_manual_paciente');

  if (!rpcMissing) {
    console.log('RPC de glicemia falhou; tentando insert direto:', rpcError?.message);
  }

  const payload = {
    ...fallbackPayload,
  };

  let { data, error } = await supabase
    .from('registro_glicemia_manual')
    .insert([payload])
    .select('id_glicemia_manual_uuid, id_paciente_uuid, valor_glicose_mgdl, data, hora')
    .maybeSingle();

  const columnMissing = String(error?.message || '').toLowerCase().includes('sintomas_associados');

  if (columnMissing) {
    const payloadWithoutSymptoms = { ...payload };
    delete payloadWithoutSymptoms.sintomas_associados;
    const retry = await supabase
      .from('registro_glicemia_manual')
      .insert([payloadWithoutSymptoms])
      .select('id_glicemia_manual_uuid, id_paciente_uuid, valor_glicose_mgdl, data, hora')
      .maybeSingle();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    const fallbackReading = buildGlucoseReadingFromPayload(payload, value);
    await registrarLogAuditoria({
      actor: options.actor || null,
      targetPatientId: patientId,
      action: 'glicemia_manual_cadastrada',
      entity: 'registro_glicemia_manual',
      entityId: fallbackReading.id,
      origin: options.auditSource || 'monitoramento_manual',
      details: {
        valorMgDl: fallbackReading.value,
        data: fallbackReading.date,
        hora: fallbackReading.time,
        tipoGlicemia: fallbackReading.glucoseType || '',
      },
    });
    return fallbackReading;
  }

  const savedReading = buildGlucoseReadingFromPayload(
    {
      ...payload,
      ...data,
    },
    value
  );

  await registrarLogAuditoria({
    actor: options.actor || null,
    targetPatientId: patientId,
    action: 'glicemia_manual_cadastrada',
    entity: 'registro_glicemia_manual',
    entityId: savedReading.id,
    origin: options.auditSource || 'monitoramento_manual',
    details: {
      valorMgDl: savedReading.value,
      data: savedReading.date,
      hora: savedReading.time,
      tipoGlicemia: savedReading.glucoseType || '',
    },
  });

  return savedReading;
}

export async function addMedicationEntry(patientId, entry) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para registrar medicacao.');
  }

  const normalizedEntry = normalizeMedicationEntry(entry, 'database');
  const normalizedQuantity = String(normalizedEntry.medicineQuantity || '').trim();
  const normalizedLegacyId = isUuidLike(normalizedEntry.legacyId)
    ? normalizedEntry.legacyId
    : isUuidLike(normalizedEntry.id)
      ? normalizedEntry.id
      : null;
  const fallbackPayload = {
    id_registro_medicacao_uuid: buildUuid(),
    id_paciente_uuid: patientId,
    tipo_registro: normalizeMedicationType(normalizedEntry.medicationKind),
    descricao: normalizedEntry.label,
    nome_medicamento: normalizedEntry.medicineName || null,
    unidade_medida: normalizedEntry.medicineUnit || null,
    quantidade: normalizedQuantity || null,
    data: normalizedEntry.date,
    hora: normalizedEntry.time,
    dias_tratamento: normalizedEntry.medicineContinuousUse
      ? null
      : normalizeMedicationNumber(normalizedEntry.medicineDays),
    uso_continuo: normalizedEntry.medicineContinuousUse,
    observacao: buildMedicationObservation(normalizedEntry),
    id_registro_legado: normalizedLegacyId,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'registrar_medicacao_paciente',
    {
      p_id_paciente_uuid: patientId,
      p_tipo_registro: fallbackPayload.tipo_registro,
      p_descricao: fallbackPayload.descricao,
      p_nome_medicamento: fallbackPayload.nome_medicamento,
      p_unidade_medida: fallbackPayload.unidade_medida,
      p_quantidade: fallbackPayload.quantidade,
      p_data: fallbackPayload.data,
      p_hora: fallbackPayload.hora,
      p_dias_tratamento: fallbackPayload.dias_tratamento,
      p_uso_continuo: fallbackPayload.uso_continuo,
      p_observacao: fallbackPayload.observacao,
      p_id_registro_legado: fallbackPayload.id_registro_legado,
    }
  );

  if (!rpcError) {
    const saved = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const savedEntry = buildMedicationEntryFromPayload({
      ...fallbackPayload,
      ...saved,
    });

    await registrarLogAuditoria({
      actor: entry?.actor || null,
      targetPatientId: patientId,
      action: normalizedEntry.medicationKind === 'insulin'
        ? 'insulina_cadastrada'
        : 'medicacao_cadastrada',
      entity: 'registro_medicacao',
      entityId: savedEntry.databaseId || savedEntry.id,
      origin: entry?.auditSource || 'monitoramento_manual',
      details: {
        tipoRegistro: normalizedEntry.medicationKind,
        nome: savedEntry.medicineName || '',
        quantidade: savedEntry.medicineQuantity || '',
        unidade: savedEntry.medicineUnit || '',
        data: savedEntry.date,
        hora: savedEntry.time,
      },
    });

    return savedEntry;
  }

  const rpcMessage = String(rpcError?.message || '').toLowerCase();
  const rpcMissing =
    rpcMessage.includes('could not find the function') ||
    rpcMessage.includes('schema cache') ||
    rpcMessage.includes('registrar_medicacao_paciente');

  if (!rpcMissing) {
    console.log('RPC de medicacao falhou; tentando insert direto:', rpcError?.message);
  }

  const { data, error } = await supabase
    .from('registro_medicacao')
    .insert([fallbackPayload])
    .select([
      'id_registro_medicacao_uuid',
      'id_paciente_uuid',
      'tipo_registro',
      'descricao',
      'nome_medicamento',
      'unidade_medida',
      'quantidade',
      'data',
      'hora',
      'dias_tratamento',
      'uso_continuo',
      'observacao',
      'id_registro_legado',
    ].join(', '))
    .maybeSingle();

  if (error) {
    throw error;
  }

  const savedEntry = buildMedicationEntryFromPayload({
    ...fallbackPayload,
    ...data,
  });

  await registrarLogAuditoria({
    actor: entry?.actor || null,
    targetPatientId: patientId,
    action: normalizedEntry.medicationKind === 'insulin'
      ? 'insulina_cadastrada'
      : 'medicacao_cadastrada',
    entity: 'registro_medicacao',
    entityId: savedEntry.databaseId || savedEntry.id,
    origin: entry?.auditSource || 'monitoramento_manual',
    details: {
      tipoRegistro: normalizedEntry.medicationKind,
      nome: savedEntry.medicineName || '',
      quantidade: savedEntry.medicineQuantity || '',
      unidade: savedEntry.medicineUnit || '',
      data: savedEntry.date,
      hora: savedEntry.time,
    },
  });

  return savedEntry;
}

export async function deleteGlucoseReading(patientId, reading) {
  throw new Error(
    'Exclusao fisica de glicemia desabilitada. Use hideGlucoseReadingForPatient para ocultar apenas na visao do paciente.'
  );
}

export async function deleteMedicationEntry(patientId, entry) {
  throw new Error(
    'Exclusao fisica de medicacao desabilitada. Use hideMedicationEntryForPatient para ocultar apenas na visao do paciente.'
  );
}

export async function hideGlucoseReadingForPatient({
  patientId,
  objectiveText,
  appState,
  reading,
  currentPatient,
  patientContext,
}) {
  const nextState = {
    ...normalizeAppState(appState),
    hiddenGlucoseReadingIds: appendUniqueId(appState?.hiddenGlucoseReadingIds, reading?.id),
  };

  const result = await savePatientAppState({
    patientId,
    objectiveText,
    appState: nextState,
    currentPatient,
    patientContext,
  });

  await registrarLogAuditoria({
    actor: currentPatient || patientContext || null,
    targetPatientId: patientId,
    action: 'glicemia_ocultada_historico',
    entity: 'registro_glicemia_manual',
    entityId: reading?.id || null,
    origin: 'historico',
    details: {
      valorMgDl: reading?.value || null,
      data: reading?.date || null,
      hora: reading?.time || null,
    },
  });

  return result;
}

export async function hideMedicationEntryForPatient({
  patientId,
  objectiveText,
  appState,
  entry,
  currentPatient,
  patientContext,
}) {
  const hiddenId = entry?.databaseId || entry?.legacyId || entry?.id;
  const nextState = {
    ...normalizeAppState(appState),
    hiddenMedicationEntryIds: appendUniqueId(appState?.hiddenMedicationEntryIds, hiddenId),
  };

  const result = await savePatientAppState({
    patientId,
    objectiveText,
    appState: nextState,
    currentPatient,
    patientContext,
  });

  await registrarLogAuditoria({
    actor: currentPatient || patientContext || null,
    targetPatientId: patientId,
    action: entry?.medicationKind === 'insulin'
      ? 'insulina_ocultada_historico'
      : 'medicacao_ocultada_historico',
    entity: 'registro_medicacao',
    entityId: hiddenId || null,
    origin: 'historico',
    details: {
      nome: entry?.medicineName || '',
      data: entry?.date || null,
      hora: entry?.time || null,
    },
  });

  return result;
}

export async function hideMealEntryForPatient({
  patientId,
  objectiveText,
  appState,
  entry,
  currentPatient,
  patientContext,
}) {
  const nextState = {
    ...normalizeAppState(appState),
    hiddenMealEntryIds: appendUniqueId(appState?.hiddenMealEntryIds, entry?.id),
  };

  const result = await savePatientAppState({
    patientId,
    objectiveText,
    appState: nextState,
    currentPatient,
    patientContext,
  });

  await registrarLogAuditoria({
    actor: currentPatient || patientContext || null,
    targetPatientId: patientId,
    action: 'alimentacao_ocultada_historico',
    entity: 'registro_alimentacao',
    entityId: entry?.id || null,
    origin: 'historico',
    details: {
      titulo: entry?.title || '',
      data: entry?.date || null,
      hora: entry?.time || null,
    },
  });

  return result;
}

export function buildMealEntry({ mode, description, glucoseNote, aiNote, time }) {
  return {
    id: `meal-${Date.now()}`,
    kind: 'meal',
    mode,
    time: time || buildCurrentTimeString().slice(0, 5),
    title: inferMealTitleFromTime(time || buildCurrentTimeString()),
    description,
    glucoseNote: glucoseNote || 'Impacto em observacao',
    glucoseDelta: 'Aguardando leitura',
    aiNote:
      aiNote ||
      'Refeicao registrada. Nas proximas leituras, vamos observar se a curva subiu rapido ou manteve estabilidade.',
  };
}

export function buildActivityEntry(label) {
  return {
    id: `activity-${Date.now()}`,
    kind: 'activity',
    label,
    time: buildCurrentTimeString().slice(0, 5),
  };
}

export function buildMedicationEntry(label) {
  return {
    id: `med-${Date.now()}`,
    kind: 'medication',
    label,
    date: buildTodayDateString(),
    time: buildCurrentTimeString().slice(0, 5),
  };
}

export function buildSymptomEntry(selectedSymptoms, sleep, stress) {
  return {
    id: `symptom-${Date.now()}`,
    selectedSymptoms,
    sleep,
    stress,
    time: buildCurrentTimeString().slice(0, 5),
    date: buildTodayDateString(),
  };
}

export function appendNewestEntry(array, entry, max = 30) {
  return [entry, ...ensureArray(array)].slice(0, max);
}

export function getLatestGlucose(glucoseReadings) {
  return glucoseReadings[0] || null;
}

export function buildMonitorSeries(glucoseReadings, range = 'Hoje') {
  const normalized = ensureArray(glucoseReadings).map((item) => ({
    label: range === 'Hoje' ? item.time.slice(0, 5) : item.date.slice(5),
    value: item.value,
    date: item.date,
    time: item.time,
  }));

  if (!normalized.length) {
    return [];
  }

  if (range === 'Hoje') {
    const todayReadings = normalized.filter((item) => item.date === buildTodayDateString());
    const latestDate = normalized[0]?.date || buildTodayDateString();
    const dayReadings = todayReadings.length
      ? todayReadings
      : normalized.filter((item) => item.date === latestDate);

    return dayReadings
      .slice(0, 12)
      .reverse();
  }

  if (range === '7 dias') {
    return groupReadingsByDate(normalized, 7);
  }

  return groupReadingsByDate(normalized, 14);
}

function groupReadingsByDate(readings, maxDays) {
  const map = new Map();

  readings.forEach((item) => {
    if (!map.has(item.date)) {
      map.set(item.date, []);
    }

    map.get(item.date).push(item.value);
  });

  return Array.from(map.entries())
    .sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate))
    .slice(0, maxDays)
    .reverse()
    .map(([date, values]) => ({
      label: date.slice(5),
      value: Math.round(values.reduce((sum, current) => sum + current, 0) / values.length),
      date,
    }));
}

function inferMealTitleFromTime(time) {
  const hour = Number(String(time).slice(0, 2));

  if (hour < 10) return 'Cafe da manha';
  if (hour < 15) return 'Almoco';
  if (hour < 19) return 'Lanche';
  return 'Jantar';
}
