import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { syncGooglePatientRecord, isGoogleUser } from './sincronizarPacienteGoogle';
import { mergeCachedGlucoseReadings } from './centralGlicose';
import { replaceCachedPatientAppState } from './centralAppState';
import { validateGlucoseValue, validateInsulinDose, validateMedicationEntry } from '../utilitarios/validacoesPaciente';
import {
  fetchCachedPatientChat,
  fetchCachedPatientExperience,
  fetchCachedPatientProfile,
  getCachedPatientChat,
  getCachedPatientExperience,
  invalidatePatientExperienceCache,
} from './cacheExperienciaPaciente';

export {
  getCachedPatientChat,
  getCachedPatientExperience,
  getCachedPatientProfile,
  invalidatePatientExperienceCache,
  isPatientExperienceCacheFresh,
  isPatientProfileCacheFresh,
  PROFILE_CACHE_TTL_MS,
} from './cacheExperienciaPaciente';
import {
  mealPlanSections,
} from '../dados/dadosExperienciaPaciente';
import { mesclarLimitesDadosPaciente } from './limitesDadosPaciente';
import { fetchActiveMealPlanForPatient } from './servicoPlanoAlimentar';
import {
  fetchPacienteAppStateFromTable,
  savePacienteAppStateToTable,
} from './servicoPacienteAppState';
import {
  fetchChatThreadFromDatabase,
  migrateLegacyThreadToDatabase,
  resolveNutricionistaIdForPatient,
  sendChatMessage,
} from './servicoMensagensChat';
import { syncGlucoseAlertsForPatient } from './servicoAlertasClinicos';
import { executarEmLotes } from '../utilitarios/carregamentoTela';

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
    nutritionistThread: [],
    planSections: mealPlanSections,
    wellness: {
      selectedSymptoms: ['focused'],
      selectedSleep: 'good',
      selectedStress: 2,
    },
  };
}

export function sanitizeChatMessageText(text) {
  let value = String(text || '').trim();
  if (!value) return '';

  value = value.replace(/\[hist-seed[^\]]*\]/gi, '').trim();
  value = value
    .replace(
      new RegExp(`${META_START}[\\s\\S]*?${META_END}`, 'g'),
      ''
    )
    .trim();

  return value;
}

export function normalizeNutritionistThreadEntry(
  item,
  { nutritionistName = 'Nutricionista', patientName = 'Paciente' } = {}
) {
  const role = item?.role === 'nutri' ? 'nutri' : 'user';
  const text = sanitizeChatMessageText(item?.text);

  return {
    id: item?.id || `thread-${role}-${Date.now()}`,
    author:
      String(item?.author || '').trim() ||
      (role === 'nutri' ? nutritionistName : patientName),
    role,
    time: String(item?.time || '').trim(),
    text,
  };
}

export function buildNutritionistThreadPreview(thread = []) {
  const normalized = ensureArray(thread)
    .map((item) => normalizeNutritionistThreadEntry(item))
    .filter((item) => item.text);
  const lastMessage = normalized[normalized.length - 1] || null;
  let unread = 0;

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    if (normalized[index]?.role !== 'user') break;
    unread += 1;
  }

  return {
    lastMessage: lastMessage?.text || 'Sem mensagens ainda.',
    lastMessageAt: lastMessage?.time || '',
    unread,
  };
}

function ensureThreadContainsMessage(thread = [], message = null) {
  const normalizedThread = ensureArray(thread).map((item) => normalizeNutritionistThreadEntry(item));
  const normalizedMessage = message ? normalizeNutritionistThreadEntry(message) : null;

  if (!normalizedMessage?.text) {
    return normalizedThread;
  }

  const alreadyPresent = normalizedThread.some((item) => {
    return (
      item.role === normalizedMessage.role &&
      item.text === normalizedMessage.text &&
      item.time === normalizedMessage.time
    );
  });

  if (alreadyPresent) {
    return normalizedThread;
  }

  return [...normalizedThread, normalizedMessage];
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
    nutritionistThread: ensureArray(appState.nutritionistThread),
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

function getNormalizedSupabaseErrorMessage(error) {
  return String(error?.message || error?.details || error?.hint || '').trim().toLowerCase();
}

function isRowLevelSecurityError(error) {
  const message = getNormalizedSupabaseErrorMessage(error);
  const code = String(error?.code || '').trim().toLowerCase();

  return (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('violates row-level security policy') ||
    message.includes('permission denied')
  );
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

function normalizeMealEntryFromDatabase(row, index = 0) {
  const createdAt = String(row?.created_at || row?.createdAt || '').trim();
  const date = createdAt ? createdAt.slice(0, 10) : buildTodayDateString();
  const time = createdAt ? createdAt.slice(11, 16) : buildCurrentTimeString().slice(0, 5);
  const recordId = String(row?.id || '').trim();
  const foods = Array.isArray(row?.alimentos) ? row.alimentos : [];
  const description = foods
    .map((item) => {
      const nome = String(item?.nome || '').trim();
      const gramas = item?.quantidade_gramas ?? null;
      if (!nome) return '';
      if (gramas === null || typeof gramas === 'undefined' || Number.isNaN(Number(gramas))) {
        return nome;
      }
      return `${nome} (${Math.round(Number(gramas))} g)`;
    })
    .filter(Boolean)
    .join(', ');
  const carbs = Number(row?.carboidratos_total) || 0;
  const calories = Number(row?.calorias_total) || 0;
  const protein = Number(row?.proteinas_total) || 0;
  const fat = Number(row?.gorduras_total) || 0;
  const firstFoodWithMealMeta = foods.find(
    (item) => item?.mealLabel || item?.mealTypeLabel || item?.planSectionId
  );
  const mealLabel =
    firstFoodWithMealMeta?.mealLabel ||
    firstFoodWithMealMeta?.mealTypeLabel ||
    'Refeição Registrada';
  const planSectionId = firstFoodWithMealMeta?.planSectionId || null;
  const fiber =
    Number(row?.fibras_total) ||
    foods.reduce((sum, item) => sum + (Number(item?.fibras) || 0), 0);
  const sugars =
    Number(row?.acucares_total) ||
    foods.reduce((sum, item) => sum + (Number(item?.acucares) || 0), 0);
  const saturatedFat =
    Number(row?.gorduras_saturadas_total) ||
    foods.reduce((sum, item) => sum + (Number(item?.gorduras_saturadas) || 0), 0);
  const sodium =
    Number(row?.sodio_total) ||
    foods.reduce((sum, item) => sum + (Number(item?.sodio) || 0), 0);

  return {
    id: recordId ? `meal-ia-${recordId}` : `meal-db-${date}-${time}-${index}`,
    kind: 'meal',
    mode: row?.foto_url ? 'photo' : 'manual',
    date,
    time,
    title: mealLabel,
    mealLabel,
    mealTypeLabel: firstFoodWithMealMeta?.mealTypeLabel || mealLabel,
    planSectionId,
    mealId: planSectionId,
    description: description || 'Refeição registrada.',
    glucoseNote: 'Macros salvos no banco',
    glucoseDelta: `${Math.round(carbs)} g carbos`,
    aiNote: `Totais: ${Math.round(calories)} kcal, ${Math.round(protein)} g proteinas, ${Math.round(fat)} g gorduras.`,
    carbsG: carbs,
    kcal: calories,
    proteinG: protein,
    fatG: fat,
    fiberG: fiber,
    sugarsG: sugars,
    saturatedFatG: saturatedFat,
    sodiumMg: sodium,
    foods: foods.map((item) => ({
      name: String(item?.nome || '').trim(),
      alimento: String(item?.nome || '').trim(),
      grams: Math.round(Number(item?.quantidade_gramas) || 0),
      unit: item?.unidade_quantidade || null,
      calories: Number(item?.calorias) || 0,
      carbs: Number(item?.carboidratos) || 0,
      protein: Number(item?.proteinas) || 0,
      fat: Number(item?.gorduras) || 0,
      fiber: Number(item?.fibras) || 0,
      sugars: Number(item?.acucares) || 0,
      saturatedFat: Number(item?.gorduras_saturadas) || 0,
      sodium: Number(item?.sodio) || 0,
      mealLabel: item?.mealLabel || null,
      mealTypeLabel: item?.mealTypeLabel || null,
      planSectionId: item?.planSectionId || null,
    })),
    storageOrigin: 'database',
    databaseId: recordId || null,
    foto_url: row?.foto_url || null,
  };
}

function mergeMealEntries(databaseEntries, legacyEntries) {
  const merged = [];
  const seenDatabaseIds = new Set();
  const seenEntryIds = new Set();

  [...ensureArray(databaseEntries), ...ensureArray(legacyEntries)].forEach((entry, index) => {
    const normalized =
      entry?.storageOrigin === 'database' || entry?.databaseId
        ? entry
        : {
            ...entry,
            storageOrigin: entry?.storageOrigin || 'legacy',
          };
    const databaseId = String(normalized?.databaseId || '').trim();
    const id = String(normalized?.id || '').trim();
    const derivedDatabaseId =
      databaseId || (id.startsWith('meal-ia-') ? id.slice('meal-ia-'.length) : '');

    if (derivedDatabaseId && seenDatabaseIds.has(derivedDatabaseId)) {
      return;
    }

    if (id && seenEntryIds.has(id)) {
      return;
    }

    if (derivedDatabaseId) {
      seenDatabaseIds.add(derivedDatabaseId);
    }

    if (id) {
      seenEntryIds.add(id);
    }

    merged.push({
      ...normalized,
      id: id || (databaseId ? `meal-ia-${databaseId}` : `meal-${Date.now()}-${index}`),
      date: normalized?.date || buildTodayDateString(),
      time: normalized?.time || buildCurrentTimeString().slice(0, 5),
      kind: normalized?.kind || 'meal',
    });
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

function normalizeGlucoseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return buildTodayDateString();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return buildTodayDateString();
}

function normalizeGlucoseTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return buildCurrentTimeString();
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 8);
  return buildCurrentTimeString();
}

function normalizeGlucoseReadingRow(item, index = 0) {
  const symptoms = item.sintomas_associados || '';
  const glucoseTypeMatch = String(symptoms).match(/Tipo da glicemia:\s*(.+)$/i);

  return {
    id: item.id_glicemia_manual_uuid || `${item.data || 'sem-data'}-${item.hora || 'sem-hora'}-${index}`,
    patientId: item.id_paciente_uuid,
    value: Number(item.valor_glicose_mgdl) || 0,
    date: normalizeGlucoseDate(item.data),
    time: normalizeGlucoseTime(item.hora),
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

const PATIENT_HOME_PROFILE_COLUMNS =
  'id_paciente_uuid, nome_completo, email_pac, cpf_paciente, objetivo_principal_consulta, id_nutricionista_uuid, peso_atual_kg, data_nascimento, data_hora_ultima_atualizacao';

export async function fetchPatientProfileMinimal(patientId, options = {}) {
  if (!patientId) return null;

  return fetchCachedPatientProfile(patientId, options, async () => {
    const { data, error } = await supabase
      .from('paciente')
      .select(PATIENT_HOME_PROFILE_COLUMNS)
      .eq('id_paciente_uuid', patientId)
      .maybeSingle();

    if (error) throw error;
    return sanitizeSensitivePatientData(data || null);
  });
}

export function prefetchPatientHomeExperience(patientId, patientContext = null) {
  if (!patientId && !patientContext) return Promise.resolve(null);

  return resolveCanonicalPatientId(patientId, { patientContext })
    .then((resolvedId) => {
      if (!resolvedId) return null;

      return fetchPatientExperience(resolvedId, {
        patientContext,
        homeOnly: true,
        skipChat: true,
        minimalProfile: true,
        allowGoogleSync: false,
        glucoseLimit: 7,
        medicationLimit: 0,
        mealLimit: 0,
        skipAlertSync: true,
      });
    })
    .catch((error) => {
      console.log('Prefetch home paciente:', error?.message || error);
      return null;
    });
}

export function prefetchPatientPlanExperience(patientId, patientContext = null) {
  if (!patientId && !patientContext) return Promise.resolve(null);

  return resolveCanonicalPatientId(patientId, { patientContext })
    .then(async (resolvedId) => {
      if (!resolvedId) return null;

      const limits = mesclarLimitesDadosPaciente('plano');
      await Promise.all([
        fetchPatientExperience(resolvedId, {
          patientContext,
          ...limits,
        }),
        fetchActiveMealPlanForPatient(resolvedId).catch(() => null),
      ]);

      return true;
    })
    .catch((error) => {
      console.log('Prefetch plano paciente:', error?.message || error);
      return null;
    });
}

export function prefetchPatientScreenExperience(patientId, patientContext = null, preset = 'diario') {
  if (!patientId && !patientContext) return Promise.resolve(null);

  return resolveCanonicalPatientId(patientId, { patientContext })
    .then((resolvedId) => {
      if (!resolvedId) return null;

      return fetchPatientExperience(resolvedId, {
        patientContext,
        ...mesclarLimitesDadosPaciente(preset),
      });
    })
    .catch((error) => {
      console.log(`Prefetch ${preset} paciente:`, error?.message || error);
      return null;
    });
}

export function prefetchPatientProfileExperience(patientId, patientContext = null) {
  if (!patientId && !patientContext) return Promise.resolve(null);

  return resolveCanonicalPatientId(patientId, { patientContext })
    .then((resolvedId) => {
      if (!resolvedId) return null;

      return fetchPatientById(resolvedId, {
        patientContext,
        allowGoogleSync: false,
        forceRefresh: false,
      });
    })
    .catch((error) => {
      console.log('Prefetch perfil paciente:', error?.message || error);
      return null;
    });
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
  minimalProfile = false,
}) {
  const candidateIds = uniqueValues([
    patientId,
    ...getContextIds(currentPatient, patientContext),
  ]);

  if (minimalProfile && candidateIds[0]) {
    const minimal = await fetchPatientProfileMinimal(candidateIds[0], {
      patientContext,
      currentPatient,
    });
    if (minimal) return minimal;
  }

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
  return fetchCachedPatientProfile(patientId, options, () =>
    resolvePatientRecord({
      patientId,
      patientContext: options.patientContext,
      currentPatient: options.currentPatient,
      allowGoogleSync: options.allowGoogleSync !== false,
      minimalProfile: options.minimalProfile === true,
    })
  );
}

async function resolvePatientChatThread({
  effectivePatientId,
  patient,
  options,
  mergedLegacyState,
}) {
  const nutricionistaId = await resolveNutricionistaIdForPatient(
    effectivePatientId,
    patient?.id_nutricionista_uuid
  );
  const patientName = getPatientDisplayName(patient || options.patientContext);
  let chatThread = await fetchChatThreadFromDatabase({
    pacienteId: effectivePatientId,
    nutricionistaId,
    patientName,
    nutritionistName: 'Nutricionista',
  });

  if (chatThread === null) {
    chatThread = ensureArray(mergedLegacyState.nutritionistThread);
  } else if (!chatThread.length && ensureArray(mergedLegacyState.nutritionistThread).length) {
    const migrated = await migrateLegacyThreadToDatabase({
      pacienteId: effectivePatientId,
      nutricionistaId,
      legacyThread: mergedLegacyState.nutritionistThread,
      patientName,
    });
    chatThread = migrated === null ? mergedLegacyState.nutritionistThread : migrated || [];
  }

  return { chatThread, nutricionistaId };
}

async function loadPatientChatOnly(patientId, options = {}) {
  const patient = await fetchPatientById(patientId, options);
  const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
  const effectivePatientId = patient?.id_paciente_uuid || patientId;
  const tableAppState = await fetchPacienteAppStateFromTable(effectivePatientId);
  const mergedLegacyState = tableAppState
    ? { ...parsed.appState, ...tableAppState }
    : parsed.appState;
  const { chatThread, nutricionistaId } = await resolvePatientChatThread({
    effectivePatientId,
    patient,
    options,
    mergedLegacyState,
  });
  const normalizedAppState = normalizeAppState({
    ...mergedLegacyState,
    nutritionistThread: chatThread,
  });

  return {
    patient,
    clinicalObjective: parsed.objectiveText,
    appState: normalizedAppState,
    glucoseReadings: [],
    nutricionistaId,
  };
}

async function loadPatientHomeSummary(patientId, options = {}) {
  const effectivePatientId = patientId || getPatientId(options.patientContext);
  const glucoseLimit = options.glucoseLimit ?? 7;
  const mealLimit = options.mealLimit ?? 0;

  const [patient, tableAppState, glucoseReadings, databaseMealEntries, activeMealPlan] = await Promise.all([
    effectivePatientId
      ? fetchPatientById(effectivePatientId, options)
      : fetchPatientById(patientId, options),
    effectivePatientId
      ? fetchPacienteAppStateFromTable(effectivePatientId).catch(() => null)
      : Promise.resolve(null),
    glucoseLimit > 0 && effectivePatientId
      ? fetchGlucoseReadings(effectivePatientId, glucoseLimit)
      : Promise.resolve([]),
    mealLimit > 0 && effectivePatientId
      ? fetchMealEntries(effectivePatientId, mealLimit)
      : Promise.resolve([]),
    options.includeMealPlan && effectivePatientId
      ? fetchActiveMealPlanForPatient(effectivePatientId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
  const mergedLegacyState = tableAppState
    ? { ...parsed.appState, ...tableAppState }
    : parsed.appState;
  const normalizedAppState = normalizeAppState(mergedLegacyState);
  const legacyMealEntries = ensureArray(normalizedAppState.mealEntries);
  const mealEntries =
    mealLimit > 0
      ? mergeMealEntries(databaseMealEntries, legacyMealEntries)
      : legacyMealEntries;
  const includeHidden = Boolean(options.includeHidden);
  const visibleMealEntries = includeHidden
    ? mealEntries
    : mealEntries.filter((entry) => !normalizedAppState.hiddenMealEntryIds.includes(entry?.id));
  const mergedGlucoseReadings = mergeCachedGlucoseReadings(glucoseReadings);
  const visibleGlucoseReadings = includeHidden
    ? mergedGlucoseReadings
    : mergedGlucoseReadings.filter(
        (entry) => !normalizedAppState.hiddenGlucoseReadingIds.includes(entry?.id)
      );

  return {
    patient,
    clinicalObjective: parsed.objectiveText,
    appState: {
      ...normalizedAppState,
      activeMealPlan,
      mealEntries: visibleMealEntries,
      medicationEntries: ensureArray(normalizedAppState.medicationEntries),
    },
    glucoseReadings: visibleGlucoseReadings,
    nutricionistaId: patient?.id_nutricionista_uuid || null,
  };
}

async function loadPatientExperience(patientId, options = {}) {
  if (options.chatOnly === true) {
    return loadPatientChatOnly(patientId, options);
  }

  if (options.homeOnly === true || options.planOnly === true) {
    return loadPatientHomeSummary(patientId, options);
  }

  if (options.skipChat === true) {
    return loadPatientHomeSummary(patientId, options);
  }

  const patient = await fetchPatientById(patientId, options);
  const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
  const effectivePatientId = patient?.id_paciente_uuid || patientId;
  const tableAppState = await fetchPacienteAppStateFromTable(effectivePatientId);
  const mergedLegacyState = tableAppState
    ? { ...parsed.appState, ...tableAppState }
    : parsed.appState;
  const { chatThread, nutricionistaId } = await resolvePatientChatThread({
    effectivePatientId,
    patient,
    options,
    mergedLegacyState,
  });
  const normalizedAppState = normalizeAppState({
    ...mergedLegacyState,
    nutritionistThread: chatThread,
  });

  const glucoseLimit = options.glucoseLimit ?? 60;
  const medicationLimit = options.medicationLimit ?? 60;
  const mealLimit = options.mealLimit ?? 60;
  const [
    glucoseReadings,
    databaseMedicationEntries,
    databaseMealEntries,
    activeMealPlan,
  ] = await Promise.all([
    glucoseLimit > 0
      ? fetchGlucoseReadings(effectivePatientId, glucoseLimit)
      : Promise.resolve([]),
    medicationLimit > 0
      ? fetchMedicationEntries(effectivePatientId, medicationLimit)
      : Promise.resolve([]),
    mealLimit > 0
      ? fetchMealEntries(effectivePatientId, mealLimit)
      : Promise.resolve([]),
    options.includeMealPlan
      ? fetchActiveMealPlanForPatient(effectivePatientId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const legacyMedicationEntries = ensureArray(normalizedAppState.medicationEntries).map(
    (entry, index) => normalizeMedicationEntry(entry, 'legacy', index)
  );
  const medicationEntries = mergeMedicationEntries(
    databaseMedicationEntries,
    legacyMedicationEntries
  );
  const legacyMealEntries = ensureArray(normalizedAppState.mealEntries);
  const mealEntries = mergeMealEntries(databaseMealEntries, legacyMealEntries);
  const includeHidden = Boolean(options.includeHidden);
  const visibleMealEntries = includeHidden
    ? mealEntries
    : mealEntries.filter(
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
  const mergedGlucoseReadings = mergeCachedGlucoseReadings(glucoseReadings);
  const visibleGlucoseReadings = includeHidden
    ? mergedGlucoseReadings
    : mergedGlucoseReadings.filter(
        (entry) => !normalizedAppState.hiddenGlucoseReadingIds.includes(entry?.id)
      );

  if (effectivePatientId && !options.skipAlertSync) {
    syncGlucoseAlertsForPatient({
      pacienteId: effectivePatientId,
      nutricionistaId,
      glucoseReadings: visibleGlucoseReadings,
    }).catch((error) => console.log('Sync alertas glicemia:', error));
  }

  return {
    patient,
    clinicalObjective: parsed.objectiveText,
    appState: {
      ...normalizedAppState,
      activeMealPlan,
      mealEntries: visibleMealEntries,
      medicationEntries: visibleMedicationEntries,
    },
    glucoseReadings: visibleGlucoseReadings,
    nutricionistaId,
  };
}

/** UUID do paciente na tabela `paciente` (resolve por e-mail/CPF/Google antes de buscar dados). */
export async function resolveCanonicalPatientId(patientId, options = {}) {
  if (options.currentPatient?.id_paciente_uuid) {
    return options.currentPatient.id_paciente_uuid;
  }

  const patient = await fetchPatientById(patientId, {
    ...options,
    allowGoogleSync: options.allowGoogleSync !== false,
  });

  return (
    patient?.id_paciente_uuid ||
    patientId ||
    getPatientId(options.patientContext) ||
    null
  );
}

export async function fetchPatientExperience(patientId, options = {}) {
  const canonicalId = await resolveCanonicalPatientId(patientId, options);

  if (patientId && canonicalId && patientId !== canonicalId) {
    invalidatePatientExperienceCache(patientId);
  }

  const loader = () =>
    loadPatientExperience(canonicalId || patientId, {
      ...options,
      patientContext: options.patientContext,
    });

  if (!canonicalId) {
    return loader();
  }

  return fetchCachedPatientExperience(canonicalId, options, loader);
}

export async function fetchPatientNutritionistChat(patientId, options = {}) {
  const loader = () =>
    options.chatOnly === true
      ? loadPatientChatOnly(patientId, options)
      : loadPatientExperience(patientId, options);

  const experience =
    options.chatOnly === true
      ? await fetchCachedPatientChat(patientId, options, loader)
      : await fetchCachedPatientExperience(patientId, options, loader);

  return {
    ...experience,
    thread: ensureArray(experience?.appState?.nutritionistThread),
  };
}

const NUTRI_INBOX_MESSAGES_PER_PATIENT = 12;
const NUTRI_INBOX_FALLBACK_BATCH = 12;
const NUTRI_INBOX_ID_CHUNK = 60;
const NUTRI_THREAD_RECENT_LIMIT = 80;

function formatChatRowTime(createdAt) {
  const date = createdAt ? new Date(createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapChatRowToThreadEntry(row, patientName) {
  const entry = normalizeNutritionistThreadEntry(
    {
      id: row.id,
      role: row.autor_role === 'nutricionista' ? 'nutri' : 'user',
      author: row.autor_role === 'nutricionista' ? 'Nutricionista' : patientName,
      time: formatChatRowTime(row.created_at),
      text: row.texto,
    },
    { nutritionistName: 'Nutricionista', patientName }
  );

  return {
    ...entry,
    createdAt: row?.created_at || null,
  };
}

function groupRecentChatRows(messages = []) {
  const grouped = new Map();

  (messages || []).forEach((row) => {
    const patientId = row?.paciente_id;
    if (!patientId) return;
    const list = grouped.get(patientId) || [];
    list.push(row);
    grouped.set(patientId, list);
  });

  grouped.forEach((rows, patientId) => {
    rows.sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
    grouped.set(patientId, rows);
  });

  return grouped;
}

async function fetchInboxMessagesGrouped(nutricionistaId, patientIds = []) {
  if (!nutricionistaId || !patientIds.length) {
    return new Map();
  }

  const aggregated = [];

  for (let index = 0; index < patientIds.length; index += NUTRI_INBOX_ID_CHUNK) {
    const chunk = patientIds.slice(index, index + NUTRI_INBOX_ID_CHUNK);
    const { data, error } = await supabase.rpc('listar_mensagens_chat_inbox', {
      p_nutricionista_id: nutricionistaId,
      p_paciente_ids: chunk,
      p_mensagens_por_paciente: NUTRI_INBOX_MESSAGES_PER_PATIENT,
    });

    if (!error && Array.isArray(data)) {
      aggregated.push(...data);
      continue;
    }

    if (error && !isRpcFunctionMissing(error, 'listar_mensagens_chat_inbox')) {
      console.log('RPC listar_mensagens_chat_inbox:', error.message);
    }

    const fallbackChunk = await fetchInboxMessagesFallback(nutricionistaId, chunk);
    aggregated.push(...fallbackChunk);
  }

  if (aggregated.length) {
    return groupRecentChatRows(aggregated);
  }

  return new Map();
}

async function fetchInboxMessagesFallback(nutricionistaId, patientIds = []) {
  const aggregated = [];

  await executarEmLotes(patientIds, NUTRI_INBOX_FALLBACK_BATCH, async (patientId) => {
    const { data: rows, error: rowError } = await supabase
      .from('mensagem_chat')
      .select('id, paciente_id, nutricionista_id, autor_role, texto, created_at')
      .eq('nutricionista_id', nutricionistaId)
      .eq('paciente_id', patientId)
      .order('created_at', { ascending: false })
      .limit(NUTRI_INBOX_MESSAGES_PER_PATIENT);

    if (rowError) {
      console.log('Inbox fallback paciente:', rowError.message);
      return;
    }

    aggregated.push(...(rows || []));
  });

  return aggregated;
}

/** Inbox apenas para um subconjunto de pacientes (paginacao / scroll). */
export async function fetchNutritionistChatInboxForPatientIds(
  patientIds = [],
  nutricionistaId = null,
  patientCardsById = new Map()
) {
  const resolvedIds = uniqueValues(patientIds);
  if (!resolvedIds.length) return [];

  const resolvedNutriId = nutricionistaId || null;
  let messagesByPatient = new Map();

  if (resolvedNutriId) {
    try {
      messagesByPatient = await fetchInboxMessagesGrouped(resolvedNutriId, resolvedIds);
    } catch (chatError) {
      console.log('Chat inbox parcial indisponivel:', chatError);
    }
  }

  return resolvedIds
    .map((patientId) => {
      const card = patientCardsById.get(patientId);
      const patient = card?.raw || card || { id_paciente_uuid: patientId, nome_completo: card?.name };
      if (!patient) return null;

      const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
      const patientName = patient?.nome_completo || patient?.email_pac || card?.name || 'Paciente';
      const rows = messagesByPatient.get(patientId) || [];
      const thread = rows.map((row) => mapChatRowToThreadEntry(row, patientName)).filter((item) => item.text);
      const preview = buildNutritionistThreadPreview(thread);
      const lastRow = rows.length ? rows[rows.length - 1] : null;

      return {
        patient,
        clinicalObjective: parsed.objectiveText,
        preview,
        lastMessageCreatedAt: lastRow?.created_at || null,
        thread: [],
      };
    })
    .filter(Boolean);
}

/** Lista leve: ultima mensagem + nao lidas, sem thread completa nem app_state por paciente. */
export async function fetchNutritionistChatInbox(patientIds = [], nutricionistaId = null) {
  const resolvedIds = uniqueValues(patientIds);
  if (!resolvedIds.length) return [];

  const { data: patients, error } = await supabase
    .from('paciente')
    .select('id_paciente_uuid, nome_completo, email_pac, objetivo_principal_consulta, id_nutricionista_uuid')
    .in('id_paciente_uuid', resolvedIds);

  if (error) throw error;

  const resolvedNutriId =
    nutricionistaId ||
    patients?.find((item) => item?.id_nutricionista_uuid)?.id_nutricionista_uuid ||
    null;

  let messagesByPatient = new Map();

  if (resolvedNutriId) {
    try {
      messagesByPatient = await fetchInboxMessagesGrouped(resolvedNutriId, resolvedIds);
    } catch (chatError) {
      console.log('Chat inbox indisponivel:', chatError);
    }
  }

  const patientById = new Map(
    (patients || []).map((patient) => [patient.id_paciente_uuid, patient])
  );

  return resolvedIds.map((patientId) => {
    const patient = patientById.get(patientId);
    if (!patient) {
      return null;
    }

    const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
    const patientName = patient?.nome_completo || patient?.email_pac || 'Paciente';
    const rows = messagesByPatient.get(patientId) || [];
    const thread = rows.map((row) => mapChatRowToThreadEntry(row, patientName)).filter((item) => item.text);
    const preview = buildNutritionistThreadPreview(thread);
    const lastRow = rows.length ? rows[rows.length - 1] : null;

    return {
      patient,
      clinicalObjective: parsed.objectiveText,
      preview,
      lastMessageCreatedAt: lastRow?.created_at || null,
      thread: [],
    };
  }).filter(Boolean);
}

export async function fetchNutritionistChatThreadForPatient(
  patientId,
  nutricionistaId,
  { patientName = 'Paciente', limit = NUTRI_THREAD_RECENT_LIMIT } = {}
) {
  if (!patientId) return [];

  const thread = await fetchChatThreadFromDatabase({
    pacienteId: patientId,
    nutricionistaId,
    nutritionistName: 'Nutricionista',
    patientName,
    limit,
  });

  if (Array.isArray(thread)) {
    return thread.filter((item) => item.text);
  }

  return [];
}

export async function fetchNutritionistChatSummariesByPatientIds(
  patientIds = [],
  nutricionistaId = null,
  options = {}
) {
  if (options.inboxOnly === true) {
    return fetchNutritionistChatInbox(patientIds, nutricionistaId);
  }

  const resolvedIds = uniqueValues(patientIds);
  if (!resolvedIds.length) return [];

  const { data: patients, error } = await supabase
    .from('paciente')
    .select('id_paciente_uuid, nome_completo, email_pac, objetivo_principal_consulta, id_nutricionista_uuid')
    .in('id_paciente_uuid', resolvedIds);

  if (error) throw error;

  const resolvedNutriId =
    nutricionistaId ||
    patients?.find((item) => item?.id_nutricionista_uuid)?.id_nutricionista_uuid ||
    null;

  let messagesByPatient = new Map();

  if (resolvedNutriId) {
    try {
      const { data: messages, error: messagesError } = await supabase
        .from('mensagem_chat')
        .select('id, paciente_id, nutricionista_id, autor_role, texto, created_at')
        .in('paciente_id', resolvedIds)
        .eq('nutricionista_id', resolvedNutriId)
        .order('created_at', { ascending: true })
        .limit(Math.min(resolvedIds.length * NUTRI_INBOX_MESSAGES_PER_PATIENT, 2000));

      if (!messagesError) {
        (messages || []).forEach((row) => {
          const list = messagesByPatient.get(row.paciente_id) || [];
          list.push(row);
          messagesByPatient.set(row.paciente_id, list);
        });
      }
    } catch (chatError) {
      console.log('Chat summaries indisponivel (tabela/RPC):', chatError);
    }
  }

  const patientsWithMeta = await Promise.all(
    (patients || []).map(async (patient) => {
      const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
      const tableState = messagesByPatient.has(patient.id_paciente_uuid)
        ? null
        : await fetchPacienteAppStateFromTable(patient.id_paciente_uuid);
      return { patient, parsed, tableState };
    })
  );

  return patientsWithMeta.map(({ patient, parsed, tableState }) => {
    const patientName = patient?.nome_completo || patient?.email_pac || 'Paciente';
    const rows = messagesByPatient.get(patient.id_paciente_uuid) || [];
    let thread = [];

    if (rows.length) {
      thread = rows
        .map((row) => mapChatRowToThreadEntry(row, patientName))
        .filter((item) => item.text);
    } else {
      const legacy = ensureArray(
        tableState?.nutritionistThread || parsed?.appState?.nutritionistThread
      );
      thread = legacy.map((item, index) =>
        normalizeNutritionistThreadEntry(item, {
          nutritionistName: 'Nutricionista',
          patientName,
          index,
        })
      );
    }

    return {
      patient,
      clinicalObjective: parsed.objectiveText,
      appState: normalizeAppState({
        ...(tableState || parsed.appState),
        nutritionistThread: thread,
      }),
      lastMessageCreatedAt: rows[rows.length - 1]?.created_at || null,
      thread: ensureArray(thread),
    };
  });
}

export async function savePatientNutritionistChat({
  patientId,
  thread,
  actor,
  patientContext,
  newMessage,
}) {
  const effectivePatientId = patientId || getPatientId(patientContext || actor);
  const nutricionistaId = await resolveNutricionistaIdForPatient(
    effectivePatientId,
    actor?.id_nutricionista_uuid
  );

  if (newMessage?.text && effectivePatientId && nutricionistaId) {
    const sent = await sendChatMessage({
      pacienteId: effectivePatientId,
      nutricionistaId,
      autorRole: newMessage.role === 'nutri' ? 'nutricionista' : 'paciente',
      texto: newMessage.text,
      nutritionistName: newMessage.nutritionistName || 'Nutricionista',
      patientName: newMessage.patientName || getPatientDisplayName(patientContext || actor),
    });

    if (sent) {
      const cached =
        getCachedPatientExperience(effectivePatientId, {
          patientContext: patientContext || actor || null,
        }) ||
        getCachedPatientChat(effectivePatientId);

      const baseThread = ensureArray(thread).length
        ? thread
        : cached?.appState?.nutritionistThread || cached?.thread || [];
      const nextThread = ensureThreadContainsMessage(baseThread, sent);

      return {
        patient: cached?.patient || patientContext || actor || null,
        clinicalObjective: cached?.clinicalObjective || '',
        appState: {
          ...(cached?.appState || createDefaultAppState()),
          nutritionistThread: nextThread,
        },
        glucoseReadings: cached?.glucoseReadings || [],
        thread: nextThread,
      };
    }
  }

  const experience = await fetchPatientNutritionistChat(effectivePatientId || patientId, {
    patientContext: patientContext || actor || null,
    skipAlertSync: true,
    forceRefresh: true,
    chatOnly: true,
  });

  const nextState = {
    ...experience.appState,
    nutritionistThread: ensureArray(thread),
  };

  return savePatientAppState({
    patientId: effectivePatientId || patientId,
    objectiveText: experience.clinicalObjective,
    appState: nextState,
    currentPatient: null,
    patientContext: patientContext || actor || null,
  });
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

  const storedObjectiveBundle = extractObjectiveAndAppState(
    resolvedPatient?.objetivo_principal_consulta
  );
  const storedPatientState = storedObjectiveBundle.appState;
  const nextObjectiveText =
    String(objectiveText || '').trim() || String(storedObjectiveBundle.objectiveText || '').trim();
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

  const stateForTable = prepareAppStateForStorage({
    ...normalizedWithHiddenPreserved,
    nutritionistThread: [],
  });

  const tableSaved = await savePacienteAppStateToTable(effectivePatientId, stateForTable);

  const patch = {
    objetivo_principal_consulta: tableSaved
      ? nextObjectiveText
      : serializeObjectiveAndAppState(nextObjectiveText, normalizedWithHiddenPreserved),
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
  invalidatePatientExperienceCache(data.id_paciente_uuid);

  return {
    patient: sanitizeSensitivePatientData(data),
    appState: normalizedWithHiddenPreserved,
    clinicalObjective: nextObjectiveText,
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

  invalidatePatientExperienceCache(data.id_paciente_uuid);

  return sanitizeSensitivePatientData(data);
}

function isRpcFunctionMissing(error, functionName) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('could not find the function') ||
    message.includes('schema cache') ||
    message.includes(String(functionName || '').toLowerCase())
  );
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
    return mergeCachedGlucoseReadings(rpcReadings).slice(0, limit);
  } else if (rpcError && !isRpcFunctionMissing(rpcError, 'listar_glicemias_manuais_paciente')) {
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
    return rpcEntries.slice(0, limit);
  } else if (rpcError && !isRpcFunctionMissing(rpcError, 'listar_medicacoes_paciente')) {
    console.log('Erro ao buscar medicacoes por RPC:', rpcError.message);
  }

  let { data, error } = await supabase
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

  if (String(error?.message || '').toLowerCase().includes('id_registro_legado')) {
    const retry = await supabase
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
      ].join(', '))
      .eq('id_paciente_uuid', patientId)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(limit);

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.log('Erro ao buscar medicacoes:', error.message);
    return rpcEntries;
  }

  return mergeMedicationEntries(
    (data || []).map((item, index) => normalizeMedicationEntry(item, 'database', index)),
    rpcEntries
  ).slice(0, limit);
}

export async function fetchMealEntries(patientId, limit = 120) {
  if (!patientId) {
    return [];
  }

  const mealColumns =
    'id, paciente_id, foto_url, alimentos, carboidratos_total, calorias_total, proteinas_total, gorduras_total, fibras_total, acucares_total, gorduras_saturadas_total, sodio_total, confirmado, created_at';
  const legacyMealColumns =
    'id, paciente_id, foto_url, alimentos, carboidratos_total, calorias_total, proteinas_total, gorduras_total, confirmado, created_at';

  let { data, error } = await supabase
    .from('refeicao_ia')
    .select(mealColumns)
    .eq('paciente_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (String(error?.message || '').toLowerCase().includes('schema cache')) {
    const retry = await supabase
      .from('refeicao_ia')
      .select(legacyMealColumns)
      .eq('paciente_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.log('Erro ao buscar refeicoes IA:', error.message);
    return [];
  }

  return (data || []).map((row, index) => normalizeMealEntryFromDatabase(row, index));
}

export async function addGlucoseReading(patientId, value, options = {}) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para registrar glicemia.');
  }

  const glucoseCheck = validateGlucoseValue(value);

  if (!glucoseCheck.ok) {
    throw new Error(glucoseCheck.message);
  }

  const normalizedSymptoms = options.symptoms || 'Registro manual pelo app';
  const fallbackPayload = {
    id_glicemia_manual_uuid: options.id || buildUuid(),
    id_paciente_uuid: patientId,
    valor_glicose_mgdl: glucoseCheck.value,
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
          glucoseCheck.value
        )
      : buildGlucoseReadingFromPayload(fallbackPayload, glucoseCheck.value);

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

    invalidatePatientExperienceCache(patientId);
    return savedReading;
  }

  if (!isRpcFunctionMissing(rpcError, 'registrar_glicemia_manual_paciente')) {
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
    const fallbackReading = buildGlucoseReadingFromPayload(payload, glucoseCheck.value);
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
    invalidatePatientExperienceCache(patientId);
    return fallbackReading;
  }

  const savedReading = buildGlucoseReadingFromPayload(
    {
      ...payload,
      ...data,
    },
    glucoseCheck.value
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

  invalidatePatientExperienceCache(patientId);
  return savedReading;
}

export async function addMedicationEntry(patientId, entry) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para registrar medicacao.');
  }

  const normalizedEntry = normalizeMedicationEntry(entry, 'database');
  const medicationKind = normalizeMedicationType(normalizedEntry.medicationKind);

  if (medicationKind === 'insulin') {
    const insulinCheck = validateInsulinDose(normalizedEntry.medicineQuantity);

    if (!insulinCheck.ok) {
      throw new Error(insulinCheck.message);
    }
  } else {
    const medCheck = validateMedicationEntry(normalizedEntry);

    if (!medCheck.ok) {
      throw new Error(medCheck.message);
    }
  }
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

  const rpcAttempts = [
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
    },
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
    },
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
    },
    {
      p_id_paciente_uuid: patientId,
      p_tipo_registro: fallbackPayload.tipo_registro,
      p_descricao: fallbackPayload.descricao,
      p_nome_medicamento: fallbackPayload.nome_medicamento,
      p_unidade_medida: fallbackPayload.unidade_medida,
      p_quantidade: fallbackPayload.quantidade,
      p_data: fallbackPayload.data,
      p_hora: fallbackPayload.hora,
    },
  ];

  let rpcData = null;
  let rpcError = null;

  for (const rpcParams of rpcAttempts) {
    const response = await supabase.rpc('registrar_medicacao_paciente', rpcParams);
    rpcData = response.data;
    rpcError = response.error;

    if (!rpcError) {
      break;
    }

    const rpcAttemptMessage = String(rpcError?.message || '').toLowerCase();
    const isSignatureMismatch =
      rpcAttemptMessage.includes('could not find the function') ||
      rpcAttemptMessage.includes('function public.registrar_medicacao_paciente') ||
      rpcAttemptMessage.includes('no function matches') ||
      rpcAttemptMessage.includes('schema cache');

    if (!isSignatureMismatch) {
      break;
    }
  }

  if (!rpcError) {
    const saved = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const savedEntry = buildMedicationEntryFromPayload({
      ...fallbackPayload,
      ...saved,
    });

      try {
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
      } catch (auditError) {
        console.log('Auditoria de medicacao falhou apos salvar por RPC:', auditError);
      }

      invalidatePatientExperienceCache(patientId);
      return savedEntry;
    }

  if (rpcError && !isRpcFunctionMissing(rpcError, 'registrar_medicacao_paciente')) {
    console.log('RPC de medicacao falhou; tentando insert direto:', rpcError?.message);
  }

  let insertPayload = { ...fallbackPayload };
  let selectFields = [
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
  ];

  let { data, error } = await supabase
    .from('registro_medicacao')
    .insert([insertPayload])
    .select(selectFields.join(', '))
    .maybeSingle();

  if (String(error?.message || '').toLowerCase().includes('id_registro_legado')) {
    const payloadWithoutLegacyId = { ...insertPayload };
    delete payloadWithoutLegacyId.id_registro_legado;
    selectFields = selectFields.filter((field) => field !== 'id_registro_legado');

    const retry = await supabase
      .from('registro_medicacao')
      .insert([payloadWithoutLegacyId])
      .select(selectFields.join(', '))
      .maybeSingle();

    insertPayload = payloadWithoutLegacyId;
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (isRowLevelSecurityError(error)) {
      console.log(
        'Insert direto de medicacao bloqueado por RLS; mantendo registro no appState local:',
        error.message
      );

      return normalizeMedicationEntry(
        {
          ...insertPayload,
          id: insertPayload.id_registro_legado || insertPayload.id_registro_medicacao_uuid,
        },
        'local_shadow'
      );
    }

    throw error;
  }

  const savedEntry = buildMedicationEntryFromPayload({
    ...insertPayload,
    ...data,
  });

  try {
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
  } catch (auditError) {
    console.log('Auditoria de medicacao falhou apos insert direto:', auditError);
  }

  invalidatePatientExperienceCache(patientId);
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
  if (!entry) {
    return ensureArray(array).slice(0, max);
  }

  const entryId = String(entry?.id || '').trim();
  const databaseId = String(entry?.databaseId || '').trim();
  const filtered = ensureArray(array).filter((item) => {
    const itemId = String(item?.id || '').trim();
    const itemDatabaseId = String(item?.databaseId || '').trim();

    if (entryId && itemId === entryId) {
      return false;
    }

    if (databaseId && itemDatabaseId === databaseId) {
      return false;
    }

    if (databaseId && itemId === `meal-ia-${databaseId}`) {
      return false;
    }

    return true;
  });

  return [entry, ...filtered].slice(0, max);
}

export function getLatestGlucose(glucoseReadings) {
  return glucoseReadings[0] || null;
}

export function buildMonitorSeries(glucoseReadings, range = 'Hoje') {
  const normalized = mergeCachedGlucoseReadings(ensureArray(glucoseReadings)).map((item) => ({
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
