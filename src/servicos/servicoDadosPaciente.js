import {
  buildLocalDateString,
  buildLocalTimeString,
  enrichGlucoseReadingDisplayFields,
  extractLocalDateTimeFromIsoTimestamp,
  filterGlucoseReadingsLastHours,
  getGlucoseReadingDisplayDate,
  normalizeLocalDateString,
  normalizeLocalTimeString,
  sortGlucoseReadingsChronologically,
} from '../utilitarios/dataLocal';
import { supabase } from './configSupabase';
import {
  enrichRpcClinicalParams,
  garantirSessaoRpcClinicaComPerfil,
  normalizeRpcActorProfile,
  supabaseRpcClinica,
} from './servicoSessaoRpc';
import { registrarLogAuditoria } from './servicoAuditoria';
import { syncGooglePatientRecord, isGoogleUser } from './sincronizarPacienteGoogle';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  replaceCachedGlucoseReadings,
} from './centralGlicose';
import { getCachedPatientAppState, replaceCachedPatientAppState } from './centralAppState';
import { validateGlucoseValue, validateInsulinDose, validateMedicationEntry } from '../utilitarios/validacoesPaciente';
import {
  fetchCachedPatientChat,
  fetchCachedPatientExperience,
  fetchCachedPatientProfile,
  getCachedPatientChat,
  getCachedPatientExperience,
  invalidatePatientChatCache,
  invalidatePatientExperienceCache,
  patchCachedPatientExperienceGlucose,
  replaceCachedPatientChat,
} from './cacheExperienciaPaciente';

export {
  getCachedPatientChat,
  getCachedPatientExperience,
  getCachedPatientProfile,
  invalidatePatientChatCache,
  invalidatePatientExperienceCache,
  isPatientExperienceCacheFresh,
  isPatientProfileCacheFresh,
  PROFILE_CACHE_TTL_MS,
  replaceCachedPatientChat,
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
  enrichChatRpcParams,
  fetchChatThreadFromDatabase,
  mapChatRowToThreadEntry as mapRpcChatRowToThreadEntry,
  migrateLegacyThreadToDatabase,
  resolveNutricionistaIdForPatient,
  sendChatMessage,
  sortChatThreadByCreatedAt,
} from './servicoMensagensChat';
import { syncGlucoseAlertsForPatient } from './servicoAlertasClinicos';
import { executarEmLotes } from '../utilitarios/carregamentoTela';
import {
  attachRegistroContextToThreadMessages,
  enrichRegistroThreadsWithMealCatalog,
  stripRegistroMetaFromChatText,
} from '../utilitarios/registrosProntuarioNutri';

const META_START = '[GLICNUTRI_APP_META_START]';
const META_END = '[GLICNUTRI_APP_META_END]';

export function getPatientId(usuario) {
  const directId = usuario?.id_paciente_uuid || usuario?.user_metadata?.id_paciente_uuid;
  if (directId) return directId;

  if (isGoogleUser(usuario) && usuario?.id) return usuario.id;
  if (usuario?.patient_id) return usuario.patient_id;

  const cardId = usuario?.id;
  if (typeof cardId === 'string' && /^[0-9a-f-]{36}$/i.test(cardId.trim())) {
    return cardId.trim();
  }

  return null;
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
  const textRaw = String(item?.textRaw ?? item?.texto_bruto ?? item?.text ?? item?.texto ?? '').trim();
  const sanitized = sanitizeChatMessageText(textRaw);
  const text =
    stripRegistroMetaFromChatText(sanitized).trim() || sanitized;

  return {
    id: item?.id || `thread-${role}-${Date.now()}`,
    author:
      String(item?.author || '').trim() ||
      (role === 'nutri' ? nutritionistName : patientName),
    role,
    time: String(item?.time || '').trim(),
    text,
    textRaw: textRaw || text,
    registroContext: item?.registroContext || item?.registroPayload || null,
    createdAt: item?.createdAt || item?.created_at || null,
  };
}

export function mergeChatMessageIntoThread(thread = [], message = null) {
  return ensureThreadContainsMessage(thread, message);
}

export function mapRealtimeChatRowToThreadEntry(row, patientName, options = {}) {
  if (!row?.texto) return null;
  return mapRpcChatRowToThreadEntry(row, {
    nutritionistName: options.nutritionistName || 'Nutricionista',
    patientName: patientName || 'Paciente',
  });
}

export function buildNutritionistThreadPreview(thread = [], { lastReadAt = null } = {}) {
  const normalized = sortChatThreadByCreatedAt(
    ensureArray(thread)
      .map((item) => normalizeNutritionistThreadEntry(item))
      .filter((item) => item.text)
  );
  const lastMessage = normalized[normalized.length - 1] || null;
  let unread = 0;
  const readTimestamp = lastReadAt ? new Date(lastReadAt).getTime() : 0;

  if (readTimestamp > 0) {
    unread = normalized.filter((message) => {
      if (message?.role !== 'user') return false;
      const createdAt = new Date(message.createdAt || message.time || 0).getTime();
      return Number.isFinite(createdAt) && createdAt > readTimestamp;
    }).length;
  } else {
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (normalized[index]?.role !== 'user') break;
      unread += 1;
    }
  }

  return {
    lastMessage: lastMessage?.text || 'Sem mensagens ainda.',
    lastMessageAt: lastMessage?.time || '',
    unread,
  };
}

function isOptimisticChatMessageId(id) {
  return /^(user|nutri|thread)-/.test(String(id || ''));
}

function ensureThreadContainsMessage(thread = [], message = null) {
  const normalizedThread = ensureArray(thread).map((item) => normalizeNutritionistThreadEntry(item));
  const normalizedMessage = message ? normalizeNutritionistThreadEntry(message) : null;

  if (!normalizedMessage?.text) {
    return normalizedThread;
  }

  if (normalizedMessage.id) {
    const byId = normalizedThread.some((item) => item.id === normalizedMessage.id);
    if (byId) return sortChatThreadByCreatedAt(normalizedThread);
  }

  let workingThread = normalizedThread;
  const hasServerId =
    normalizedMessage.id && !isOptimisticChatMessageId(normalizedMessage.id);

  if (hasServerId) {
    workingThread = normalizedThread.filter((item) => {
      if (
        item.role !== normalizedMessage.role ||
        item.text !== normalizedMessage.text
      ) {
        return true;
      }
      return !isOptimisticChatMessageId(item.id);
    });
  }

  const alreadyPresent = workingThread.some((item) => {
    if (item.role !== normalizedMessage.role || item.text !== normalizedMessage.text) {
      return false;
    }
    if (item.id === normalizedMessage.id) return true;

    const itemTime = new Date(item.createdAt || item.time || 0).getTime();
    const messageTime = new Date(normalizedMessage.createdAt || normalizedMessage.time || 0).getTime();
    if (Number.isFinite(itemTime) && Number.isFinite(messageTime)) {
      return Math.abs(itemTime - messageTime) < 120000;
    }

    return item.time === normalizedMessage.time;
  });

  if (alreadyPresent) {
    return sortChatThreadByCreatedAt(workingThread);
  }

  return sortChatThreadByCreatedAt([...workingThread, normalizedMessage]);
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

function resolveRpcActorFromOptions(options = {}, patient = null) {
  return options?.patientContext || patient || null;
}

async function buildRpcParams(params, patientId, rpcActor) {
  try {
    return await enrichRpcClinicalParams(params, patientId, rpcActor);
  } catch (error) {
    console.log('Sessao RPC indisponivel:', error?.message || error);
    return null;
  }
}

function buildTodayDateString() {
  return buildLocalDateString();
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

function normalizeInsulinCategoryForDatabase(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['basal'].includes(raw)) return 'basal';
  if (['bolus', 'prandial', 'prandial_bolus', 'correcao'].includes(raw)) return 'bolus';
  if (['rapida', 'ultrarrapida', 'ultra_rapida'].includes(raw)) return 'rapida';
  if (['intermediaria', 'nph'].includes(raw)) return 'intermediaria';
  if (['premisturada', 'mista', 'mixed'].includes(raw)) return 'premisturada';
  if (['basal', 'bolus', 'rapida', 'intermediaria', 'premisturada'].includes(raw)) return raw;

  return 'basal';
}

function isInsulinMedicationEntry(entry) {
  return normalizeMedicationType(entry?.medicationKind || entry?.tipo_registro) === 'insulin';
}

function normalizeInsulinEntry(item, storageOrigin = 'insulin_database', index = 0) {
  const observation = String(item?.observacao || '').trim();
  const parsedObservation = parseMedicationObservation(observation);

  return normalizeMedicationEntry(
    {
      id: item?.id,
      insulinDatabaseId: item?.id || item?.insulinDatabaseId || null,
      id_registro_medicacao_uuid: item?.id_registro_medicacao_origem || null,
      id_paciente_uuid: item?.id_paciente_uuid,
      medicationKind: 'insulin',
      tipo_registro: 'insulin',
      nome_medicamento: item?.nome_insulina,
      medicineName: item?.nome_insulina,
      quantidade: item?.dose_ui,
      medicineQuantity: item?.dose_ui,
      unidade_medida: item?.unidade_medida || 'UI',
      medicineUnit: item?.unidade_medida || 'UI',
      data: item?.data,
      hora: item?.hora,
      descricao: item?.descricao || 'Insulina',
      label: item?.descricao || item?.label || 'Insulina',
      observacao: observation,
      insulinCategory:
        item?.categoria_insulina ||
        item?.insulinCategory ||
        parsedObservation.insulinCategory,
      insulinUsage: item?.objetivo_uso || item?.insulinUsage || parsedObservation.insulinUsage,
      insulinNotes: item?.insulinNotes || parsedObservation.insulinNotes,
      local_aplicacao: item?.local_aplicacao,
    },
    storageOrigin,
    index
  );
}

function mergeInsulinEntries(dedicatedEntries, legacyMedicationInsulinEntries) {
  const migratedOriginIds = new Set(
    ensureArray(dedicatedEntries)
      .map((entry) => entry?.id_registro_medicacao_origem || entry?.databaseId)
      .filter(Boolean)
  );

  const legacyOnly = ensureArray(legacyMedicationInsulinEntries).filter((entry) => {
    const legacyMedicationId = entry?.databaseId || entry?.id_registro_medicacao_uuid;
    return !legacyMedicationId || !migratedOriginIds.has(legacyMedicationId);
  });

  return mergeMedicationEntries(dedicatedEntries, legacyOnly);
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
  const date = normalizeMedicationDate(
    item?.date || item?.data || item?.data_registro || item?.created_at
  );
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
  const insulinDatabaseId = item?.insulinDatabaseId || null;
  const databaseId = item?.id_registro_medicacao_uuid || null;
  const observation = String(item?.observacao || '').trim();
  const parsedObservation = parseMedicationObservation(observation);

  return {
    id:
      item?.id ||
      insulinDatabaseId ||
      databaseId ||
      item?.id_registro_legado ||
      `med-${date}-${time}-${index}`,
    kind: 'medication',
    label,
    date,
    time,
    medicationKind: normalizedType,
    tipo_registro: normalizedType,
    medicineName,
    medicineUnit,
    medicineQuantity,
    medicineQuantityNumber: normalizeMedicationNumber(medicineQuantity),
    medicineDays,
    medicineContinuousUse,
    patientId: item?.id_paciente_uuid || item?.patientId || null,
    insulinCategory: String(
      item?.insulinCategory ||
        item?.categoria_insulina ||
        parsedObservation.insulinCategory ||
        ''
    ).trim(),
    insulinUsage: String(item?.insulinUsage || item?.objetivo_uso || parsedObservation.insulinUsage || '').trim(),
    insulinNotes: String(item?.insulinNotes || parsedObservation.insulinNotes || '').trim(),
    localAplicacao: String(item?.local_aplicacao || item?.localAplicacao || '').trim(),
    observation,
    storageOrigin,
    databaseId,
    insulinDatabaseId,
    legacyId: item?.id_registro_legado || item?.legacyId || null,
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
  const localParts = extractLocalDateTimeFromIsoTimestamp(createdAt);
  const recordId = String(row?.id || '').trim();
  const fotoUrl = String(row?.foto_url || '').trim();
  const foods = Array.isArray(row?.alimentos) ? row.alimentos : [];
  const metadataFood = foods.find(
    (item) => item?.mealLabel || item?.mealTypeLabel || item?.planSectionId
  );
  const explicitDate = String(row?.data_refeicao || row?.data || metadataFood?.date || '').trim();
  const explicitTime = String(row?.hora_refeicao || row?.hora || metadataFood?.time || '').trim();
  const date =
    (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate.slice(0, 10)) ? explicitDate.slice(0, 10) : null) ||
    localParts?.date ||
    buildTodayDateString();
  const time =
    (/^\d{2}:\d{2}/.test(explicitTime) ? explicitTime.slice(0, 5) : null) ||
    localParts?.time ||
    buildCurrentTimeString().slice(0, 5);
  const description = foods
    .filter((item) => !item?.metadataOnly)
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
  const mealLabel =
    row?.tipo_refeicao ||
    row?.meal_label ||
    metadataFood?.mealLabel ||
    metadataFood?.mealTypeLabel ||
    'Refeição Registrada';
  const planSectionId = metadataFood?.planSectionId || null;
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
    patientId: row?.paciente_id || row?.id_paciente_uuid || null,
    mode: fotoUrl && !fotoUrl.startsWith('seed://') ? 'photo' : 'manual',
    date,
    time,
    title: mealLabel,
    mealLabel,
    mealTypeLabel: metadataFood?.mealTypeLabel || row?.tipo_refeicao || mealLabel,
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

function isMissingMealTotalColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('fibras_total') ||
    message.includes('acucares_total') ||
    message.includes('gorduras_saturadas_total') ||
    message.includes('sodio_total') ||
    message.includes('schema cache')
  );
}

function resolveMealDatabaseId(entry = {}) {
  const databaseId = String(entry?.databaseId || '').trim();
  const id = String(entry?.id || '').trim();
  return databaseId || (id.startsWith('meal-ia-') ? id.slice('meal-ia-'.length) : '');
}

function isGenericMealLabel(value) {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return !raw || raw === 'refeicao registrada' || raw === 'refeicao confirmada manualmente';
}

function mergeMealEntryPair(primary = {}, secondary = {}) {
  const pickLabel = (field) => {
    const primaryValue = primary?.[field];
    const secondaryValue = secondary?.[field];
    if (!isGenericMealLabel(primaryValue)) return primaryValue;
    if (!isGenericMealLabel(secondaryValue)) return secondaryValue;
    return primaryValue || secondaryValue || null;
  };

  const primaryFoods = Array.isArray(primary?.foods) ? primary.foods : [];
  const secondaryFoods = Array.isArray(secondary?.foods) ? secondary.foods : [];

  return {
    ...secondary,
    ...primary,
    id: primary?.id || secondary?.id,
    databaseId: primary?.databaseId || secondary?.databaseId || null,
    storageOrigin: primary?.storageOrigin || secondary?.storageOrigin || 'database',
    date: primary?.date || secondary?.date || buildTodayDateString(),
    time: primary?.time || secondary?.time || buildCurrentTimeString().slice(0, 5),
    title: pickLabel('title') || pickLabel('mealLabel') || 'Refeição Registrada',
    mealLabel: pickLabel('mealLabel') || pickLabel('title') || 'Refeição Registrada',
    mealTypeLabel: pickLabel('mealTypeLabel') || pickLabel('mealLabel') || pickLabel('title'),
    description: primary?.description || secondary?.description || '',
    foods: primaryFoods.length ? primaryFoods : secondaryFoods,
    kcal: Number(primary?.kcal) || Number(secondary?.kcal) || 0,
    carbsG: Number(primary?.carbsG) || Number(secondary?.carbsG) || 0,
    proteinG: Number(primary?.proteinG) || Number(secondary?.proteinG) || 0,
    fatG: Number(primary?.fatG) || Number(secondary?.fatG) || 0,
    foto_url: primary?.foto_url || secondary?.foto_url || null,
    kind: primary?.kind || secondary?.kind || 'meal',
  };
}

function mergeMealEntries(databaseEntries, legacyEntries) {
  const mergedByDbId = new Map();
  const mergedByEntryId = new Map();
  const legacyOnly = [];

  const registerEntry = (entry, index = 0) => {
    const normalized =
      entry?.storageOrigin === 'database' || entry?.databaseId
        ? entry
        : {
            ...entry,
            storageOrigin: entry?.storageOrigin || 'legacy',
          };
    const databaseId = resolveMealDatabaseId(normalized);
    const id = String(normalized?.id || '').trim() || (databaseId ? `meal-ia-${databaseId}` : `meal-${Date.now()}-${index}`);
    const shaped = {
      ...normalized,
      id,
      databaseId: databaseId || normalized?.databaseId || null,
      date: normalized?.date || buildTodayDateString(),
      time: normalized?.time || buildCurrentTimeString().slice(0, 5),
      kind: normalized?.kind || 'meal',
    };

    if (databaseId) {
      const existing = mergedByDbId.get(databaseId);
      mergedByDbId.set(databaseId, existing ? mergeMealEntryPair(shaped, existing) : shaped);
      return;
    }

    const existingById = mergedByEntryId.get(id);
    if (existingById) {
      mergedByEntryId.set(id, mergeMealEntryPair(shaped, existingById));
      return;
    }

    mergedByEntryId.set(id, shaped);
    legacyOnly.push(id);
  };

  ensureArray(databaseEntries).forEach(registerEntry);
  ensureArray(legacyEntries).forEach(registerEntry);

  return [...mergedByDbId.values(), ...legacyOnly.map((id) => mergedByEntryId.get(id)).filter(Boolean)].sort(
    (left, right) => {
      const leftStamp = `${left.date || '1970-01-01'}T${left.time || '00:00:00'}`;
      const rightStamp = `${right.date || '1970-01-01'}T${right.time || '00:00:00'}`;
      return rightStamp.localeCompare(leftStamp);
    }
  );
}

export function mergeAppStateMealEntries(appState, patientId) {
  const normalized = normalizeAppState(appState);
  if (!patientId) {
    return normalized;
  }

  const central = getCachedPatientAppState(patientId);
  return {
    ...normalized,
    mealEntries: mergeMealEntries(
      ensureArray(central?.mealEntries),
      ensureArray(normalized.mealEntries)
    ),
  };
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
  return normalizeLocalDateString(value);
}

function normalizeGlucoseTime(value) {
  return normalizeLocalTimeString(value);
}

function normalizeGlucoseReadingRow(item, index = 0) {
  const symptoms = item.sintomas_associados || '';
  const glucoseTypeMatch = String(symptoms).match(/Tipo da glicemia:\s*(.+)$/i);
  const enriched = enrichGlucoseReadingDisplayFields({
    id: item.id,
    id_glicemia_manual_uuid: item.id_glicemia_manual_uuid,
    id_paciente_uuid: item.id_paciente_uuid,
    patientId: item.id_paciente_uuid || item.patientId || null,
    value: Number(item.valor_glicose_mgdl ?? item.value) || 0,
    readingTimeUtc: item.reading_time_utc || item.readingTimeUtc || null,
    syncedAt: item.synced_at || item.syncedAt || null,
    date: item.data || item.date,
    time: item.hora || item.time,
    fonte: item.fonte,
    source: item.source,
    raw_payload: item.raw_payload,
    glucoseType: item.glucoseType || glucoseTypeMatch?.[1] || '',
    sintomas_associados: symptoms,
  });
  const normalizedDate = enriched.date;
  const normalizedTime = enriched.time;

  return {
    id:
      enriched.id ||
      item.id_glicemia_manual_uuid ||
      item.id ||
      `reading-${normalizedDate}-${normalizedTime}-${index}`,
    patientId: enriched.id_paciente_uuid || enriched.patientId || null,
    value: enriched.value,
    readingTimeUtc: enriched.readingTimeUtc || null,
    syncedAt: enriched.syncedAt || null,
    date: normalizedDate,
    time: normalizedTime,
    glucoseType: enriched.glucoseType || '',
    source:
      enriched.source ||
      (enriched.fonte ? String(enriched.fonte) : symptoms.includes('Fonte:') ? 'cgm' : 'manual'),
  };
}

export function mapRemoteGlucoseReadingToEntry(
  reading,
  patientId,
  { source = 'librelinkup', index = 0 } = {}
) {
  const enriched = enrichGlucoseReadingDisplayFields({
    ...reading,
    fonte: reading?.fonte || source,
    source: reading?.source || source,
  });
  const date = enriched.date;
  const time = enriched.time;
  const readingTimeUtc = enriched.readingTimeUtc || null;
  const value = Number(reading?.value);

  if (
    !patientId ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !readingTimeUtc ||
    !date ||
    !time
  ) {
    return null;
  }

  return {
    id:
      reading?.id ||
      `cgm-${patientId}-${readingTimeUtc}-${value}-${index}`,
    patientId,
    value,
    readingTimeUtc,
    date,
    time,
    source,
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
    .or('excluido.is.null,excluido.eq.false')
    .order('data_hora_ultima_atualizacao', { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return sanitizeSensitivePatientData((data || [])[0] || null);
}

const PATIENT_HOME_PROFILE_COLUMNS =
  'id_paciente_uuid, nome_completo, email_pac, cpf_paciente, objetivo_principal_consulta, id_nutricionista_uuid, id_medico_uuid, peso_atual_kg, data_nascimento, data_hora_ultima_atualizacao';

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
        ...mesclarLimitesDadosPaciente('resumo'),
      });
    })
    .catch((error) => {
      console.log('Prefetch home paciente:', error?.message || error);
      return null;
    });
}

export function prefetchPatientAreaBootstrap(patientId, patientContext = null) {
  if (!patientId && !patientContext) return;

  prefetchPatientHomeExperience(patientId, patientContext);
  prefetchPatientProfileExperience(patientId, patientContext);

  const resolvedId = getPatientId(patientContext) || patientId;
  if (!resolvedId) return;

  setTimeout(() => {
    prefetchPatientScreenExperience(resolvedId, patientContext, 'diario');
    prefetchPatientScreenExperience(resolvedId, patientContext, 'monitoramento');
  }, 350);
}

export async function warmPatientHomeForLogin(patientId, patientContext = null) {
  const resolvedId =
    getPatientId(patientContext) ||
    patientId ||
    (await resolveCanonicalPatientId(patientId, { patientContext }));

  if (!resolvedId) return null;

  try {
    return await fetchPatientExperience(resolvedId, {
      patientContext,
      ...mesclarLimitesDadosPaciente('resumo'),
    });
  } catch (error) {
    console.log('Warm home paciente:', error?.message || error);
    return null;
  }
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
    .or('excluido.is.null,excluido.eq.false')
    .order('data_hora_ultima_atualizacao', { ascending: false })
    .limit(5);

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
  rpcActor = null,
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
    rpcActor: rpcActor || resolveRpcActorFromOptions(options, patient),
  });

  if (chatThread === null) {
    chatThread = ensureArray(mergedLegacyState.nutritionistThread);
  } else if (!chatThread.length && ensureArray(mergedLegacyState.nutritionistThread).length) {
    const migrated = await migrateLegacyThreadToDatabase({
      pacienteId: effectivePatientId,
      nutricionistaId,
      legacyThread: mergedLegacyState.nutritionistThread,
      patientName,
      rpcActor: rpcActor || resolveRpcActorFromOptions(options, patient),
    });
    chatThread = migrated === null ? mergedLegacyState.nutritionistThread : migrated || [];
  }

  return { chatThread, nutricionistaId };
}

async function loadPatientChatOnly(patientId, options = {}) {
  const patient = options.currentPatient || (await fetchPatientById(patientId, options));
  const rpcActor = resolveRpcActorFromOptions(options, patient);
  const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
  const effectivePatientId = patient?.id_paciente_uuid || patientId;
  const tableAppState = await fetchPacienteAppStateFromTable(effectivePatientId, rpcActor);
  const mergedLegacyState = tableAppState
    ? { ...parsed.appState, ...tableAppState }
    : parsed.appState;
  const { chatThread, nutricionistaId } = await resolvePatientChatThread({
    effectivePatientId,
    patient,
    options,
    mergedLegacyState,
    rpcActor,
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

async function fetchHomeClinicalBundle(resolvedPatientId, options = {}, rpcActor = null) {
  if (!resolvedPatientId) {
    return {
      tableAppState: null,
      glucoseReadings: [],
      databaseMedicationEntries: [],
      databaseMealEntries: [],
      activeMealPlan: null,
    };
  }

  const glucoseLimit = Math.max(options.glucoseLimit ?? 48, 48);
  const mealLimit = options.homeCritical === true ? 0 : options.mealLimit ?? 0;
  const medicationLimit = options.homeCritical === true ? 0 : options.medicationLimit ?? 0;
  const includeMealPlan = options.homeCritical === true ? false : Boolean(options.includeMealPlan);
  const includeAppState = options.homeCritical !== true;

  const baseParams = await buildRpcParams(
    {
      p_paciente_id: resolvedPatientId,
    },
    resolvedPatientId,
    rpcActor
  );

  if (!baseParams) {
    const glucoseReadings =
      glucoseLimit > 0
        ? await fetchGlucoseReadings(resolvedPatientId, glucoseLimit, rpcActor)
        : [];

    return {
      tableAppState: null,
      glucoseReadings,
      databaseMedicationEntries: [],
      databaseMealEntries: [],
      activeMealPlan: null,
    };
  }

  const rpcCall = (name, extraParams = {}) =>
    supabaseRpcClinica(
      name,
      { p_paciente_id: resolvedPatientId, ...extraParams },
      { pacienteId: resolvedPatientId, user: rpcActor }
    );
  const rpcCallSafe = async (name, extraParams = {}, fallback = { data: null, error: null }) => {
    try {
      return await rpcCall(name, extraParams);
    } catch (error) {
      return fallback;
    }
  };

  const [
    appStateResult,
    medsResult,
    mealsResult,
    activeMealPlan,
    glucoseReadings,
  ] = await Promise.all([
    includeAppState
      ? rpcCallSafe('obter_paciente_app_state', {})
      : Promise.resolve({ data: null, error: null }),
    medicationLimit > 0
      ? fetchMedicationEntries(resolvedPatientId, medicationLimit, rpcActor)
      : Promise.resolve([]),
    mealLimit > 0
      ? fetchMealEntries(resolvedPatientId, mealLimit, rpcActor)
      : Promise.resolve([]),
    includeMealPlan
      ? fetchActiveMealPlanForPatient(resolvedPatientId).catch(() => null)
      : Promise.resolve(null),
    glucoseLimit > 0
      ? fetchGlucoseReadings(resolvedPatientId, glucoseLimit, rpcActor)
      : Promise.resolve([]),
  ]);

  let tableAppState = null;
  if (includeAppState && !appStateResult.error && appStateResult.data) {
    if (typeof appStateResult.data === 'object' && Object.keys(appStateResult.data).length) {
      tableAppState = appStateResult.data;
    }
  }

  const databaseMealEntries = Array.isArray(mealsResult) ? mealsResult : [];

  return {
    tableAppState,
    glucoseReadings,
    databaseMedicationEntries: Array.isArray(medsResult) ? medsResult : [],
    databaseMealEntries,
    activeMealPlan,
  };
}

async function loadPatientHomeSummary(patientId, options = {}) {
  const candidatePatientId =
    options.currentPatient?.id_paciente_uuid ||
    patientId ||
    getPatientId(options.patientContext);
  const glucoseLimit = options.glucoseLimit ?? 7;
  const mealLimit = options.mealLimit ?? 0;
  const medicationLimit = options.medicationLimit ?? 0;
  const rpcActorSeed = resolveRpcActorFromOptions(options, options.currentPatient);

  const patientPromise = options.currentPatient
    ? Promise.resolve(options.currentPatient)
    : fetchPatientById(candidatePatientId || patientId, options);

  const clinicalPromise =
    candidatePatientId &&
    (options.homeCritical === true ||
      glucoseLimit > 0 ||
      mealLimit > 0 ||
      medicationLimit > 0 ||
      options.includeMealPlan)
      ? fetchHomeClinicalBundle(candidatePatientId, options, rpcActorSeed)
      : Promise.resolve(null);

  const [patient, clinicalBundle] = await Promise.all([patientPromise, clinicalPromise]);
  const rpcActor = resolveRpcActorFromOptions(options, patient);
  const resolvedPatientId = patient?.id_paciente_uuid || candidatePatientId || patientId;

  let bundle = clinicalBundle;
  if (!bundle && resolvedPatientId) {
    bundle = await fetchHomeClinicalBundle(resolvedPatientId, options, rpcActor);
  }
  if (!bundle) {
    bundle = {
      tableAppState: null,
      glucoseReadings: [],
      databaseMedicationEntries: [],
      databaseMealEntries: [],
      activeMealPlan: null,
    };
  }

  const {
    tableAppState,
    glucoseReadings,
    databaseMedicationEntries,
    databaseMealEntries,
    activeMealPlan,
  } = bundle;

  const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
  const mergedLegacyState = tableAppState
    ? { ...parsed.appState, ...tableAppState }
    : parsed.appState;
  const normalizedAppState = normalizeAppState(mergedLegacyState);
  const legacyMedicationEntries = ensureArray(normalizedAppState.medicationEntries).map(
    (entry, index) => normalizeMedicationEntry(entry, 'legacy', index)
  );
  const medicationEntries = mergeMedicationEntries(
    databaseMedicationEntries,
    legacyMedicationEntries
  );
  const legacyMealEntries = ensureArray(normalizedAppState.mealEntries);
  const mealEntries =
    mealLimit > 0
      ? mergeMealEntries(databaseMealEntries, legacyMealEntries)
      : legacyMealEntries;
  const includeHidden = Boolean(options.includeHidden);
  const visibleMealEntries = includeHidden
    ? mealEntries
    : mealEntries.filter((entry) => !normalizedAppState.hiddenMealEntryIds.includes(entry?.id));
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

  const prontuarioClinicalOnly = options.experienceCachePreset === 'prontuario';

  if (options.skipChat === true && !prontuarioClinicalOnly) {
    return loadPatientHomeSummary(patientId, options);
  }

  const patient = options.currentPatient || (await fetchPatientById(patientId, options));
  const rpcActor = resolveRpcActorFromOptions(options, patient);
  const parsed = extractObjectiveAndAppState(patient?.objetivo_principal_consulta);
  const effectivePatientId = patient?.id_paciente_uuid || patientId;
  const tableAppState = await fetchPacienteAppStateFromTable(effectivePatientId, rpcActor);
  const mergedLegacyState = tableAppState
    ? { ...parsed.appState, ...tableAppState }
    : parsed.appState;
  const { chatThread, nutricionistaId } = prontuarioClinicalOnly
    ? {
        chatThread: ensureArray(mergedLegacyState.nutritionistThread),
        nutricionistaId: patient?.id_nutricionista_uuid || null,
      }
    : await resolvePatientChatThread({
    effectivePatientId,
    patient,
    options,
    mergedLegacyState,
    rpcActor,
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
      ? fetchGlucoseReadings(effectivePatientId, glucoseLimit, rpcActor).catch(() => [])
      : Promise.resolve([]),
    medicationLimit > 0
      ? fetchMedicationEntries(effectivePatientId, medicationLimit, rpcActor).catch(() => [])
      : Promise.resolve([]),
    mealLimit > 0
      ? fetchMealEntries(effectivePatientId, mealLimit, rpcActor).catch(() => [])
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

function resolveCurrentPatientSeed(options = {}) {
  if (options.currentPatient?.id_paciente_uuid) {
    return options.currentPatient;
  }

  const context = options.patientContext;
  if (!context) {
    return null;
  }

  const contextId = context.id_paciente_uuid || getPatientId(context);
  if (!contextId) {
    return null;
  }

  return context.id_paciente_uuid
    ? context
    : { ...context, id_paciente_uuid: contextId };
}

export async function fetchPatientExperience(patientId, options = {}) {
  const mergedOptions = {
    ...options,
    patientContext: options.patientContext,
    minimalProfile:
      options.minimalProfile === true ||
      options.homeOnly === true ||
      options.planOnly === true,
  };

  const seededPatient = resolveCurrentPatientSeed(mergedOptions);

  const candidateId =
    seededPatient?.id_paciente_uuid ||
    patientId ||
    getPatientId(options.patientContext) ||
    null;

  if (candidateId && options.forceRefresh !== true) {
    const cached = getCachedPatientExperience(candidateId, mergedOptions);
    if (cached) {
      return cached;
    }
  }

  const patient =
    seededPatient ||
    (await fetchPatientById(patientId, {
      ...mergedOptions,
      currentPatient: seededPatient,
    }));

  const canonicalId =
    patient?.id_paciente_uuid ||
    candidateId ||
    null;

  if (patientId && canonicalId && patientId !== canonicalId) {
    invalidatePatientExperienceCache(patientId);
  }

  const loader = () =>
    loadPatientExperience(canonicalId || patientId, {
      ...mergedOptions,
      currentPatient: patient,
    });

  if (!canonicalId) {
    return loader();
  }

  return fetchCachedPatientExperience(
    canonicalId,
    { ...mergedOptions, currentPatient: patient },
    loader
  );
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
/** Evita RPC inbox 404 repetido quando PostgREST so expoe assinatura legada. */
let chatInboxRpcUnavailable = false;
const NUTRI_THREAD_RECENT_LIMIT = 200;

/** Thread do chat vinda do Supabase (texto completo + registroContext para cards). */
export async function fetchPatientChatThreadEnriched(patientId, options = {}) {
  const patient =
    options.patientContext ||
    options.currentPatient ||
    (patientId ? await fetchPatientById(patientId, options).catch(() => null) : null);
  const rpcActor = resolveRpcActorFromOptions(options, patient);
  const sessionActor =
    normalizeRpcActorProfile(rpcActor) ||
    (patient?.id_paciente_uuid ? { id_paciente_uuid: patient.id_paciente_uuid } : null);
  const nutritionistName = String(options.nutritionistName || 'Nutricionista').trim();
  const patientName =
    String(options.patientName || '').trim() || getPatientDisplayName(patient || options.patientContext);
  const nutricionistaId = await resolveNutricionistaIdForPatient(
    patientId,
    options.nutricionistaId || patient?.id_nutricionista_uuid
  );
  const limit = options.limit || NUTRI_THREAD_RECENT_LIMIT;

  if (sessionActor) {
    await garantirSessaoRpcClinicaComPerfil(sessionActor).catch((error) => {
      console.log('Sessao RPC thread paciente:', error?.message || error);
    });
  }

  let rawThread = [];
  let dbUnavailable = false;

  if (patientId && nutricionistaId) {
    const dbThread = await fetchChatThreadFromDatabase({
      pacienteId: patientId,
      nutricionistaId,
      nutritionistName,
      patientName,
      limit,
      rpcActor: sessionActor || rpcActor,
    });
    if (dbThread === null) {
      dbUnavailable = true;
    } else if (Array.isArray(dbThread)) {
      rawThread = dbThread;
    }
  } else {
    dbUnavailable = true;
  }

  if (!rawThread.length && dbUnavailable) {
    const fallback = await resolveNutritionistChatThreadFallback(patientId, nutricionistaId, {
      patientName,
      rpcActor: sessionActor || rpcActor,
      limit,
    });
    if (fallback.length) {
      rawThread = fallback;
    }
  }

  if (!rawThread.length && ensureArray(options.fallbackThread).length) {
    rawThread = ensureArray(options.fallbackThread).map((item) => ({
      ...item,
      text: item?.text ?? item?.texto ?? '',
      textRaw: item?.textRaw ?? item?.texto_bruto ?? item?.text ?? item?.texto ?? '',
    }));
  }

  const normalized = rawThread.map((item) =>
    normalizeNutritionistThreadEntry(item, { nutritionistName, patientName })
  );
  const previous =
    ensureArray(options.fallbackThread).length && dbUnavailable
      ? ensureArray(options.fallbackThread).map((item) =>
          normalizeNutritionistThreadEntry(item, { nutritionistName, patientName })
        )
      : normalized;

  const attached = attachRegistroContextToThreadMessages(normalized, previous);

  try {
    const meals = await fetchMealEntries(patientId, limit, sessionActor || rpcActor);
    return sortChatThreadByCreatedAt(enrichRegistroThreadsWithMealCatalog(attached, meals));
  } catch (mealError) {
    console.log('Enriquecimento refeicao thread paciente:', mealError?.message || mealError);
    return sortChatThreadByCreatedAt(attached);
  }
}

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

async function fetchInboxMessagesGrouped(nutricionistaId, patientIds = [], rpcActor = null) {
  if (!nutricionistaId || !patientIds.length) {
    return new Map();
  }

  const sessionActor =
    normalizeRpcActorProfile(rpcActor) ||
    (nutricionistaId ? { id_nutricionista_uuid: nutricionistaId } : null);

  const aggregated = [];

  for (let index = 0; index < patientIds.length; index += NUTRI_INBOX_ID_CHUNK) {
    const chunk = patientIds.slice(index, index + NUTRI_INBOX_ID_CHUNK);
    let rpcParams = null;

    try {
      rpcParams = await enrichChatRpcParams(
        {
          p_nutricionista_id: nutricionistaId,
          p_paciente_ids: chunk,
          p_mensagens_por_paciente: NUTRI_INBOX_MESSAGES_PER_PATIENT,
        },
        null,
        sessionActor,
        sessionActor
      );
    } catch (sessionError) {
      console.log('Sessao RPC indisponivel para inbox de chat:', sessionError?.message || sessionError);
      const fallbackChunk = await fetchInboxMessagesFallback(nutricionistaId, chunk, sessionActor);
      aggregated.push(...fallbackChunk);
      continue;
    }

    let data = null;
    let error = null;

    if (!chatInboxRpcUnavailable) {
      ({ data, error } = await supabase.rpc('listar_mensagens_chat_inbox', rpcParams));
    }

    if (!error && Array.isArray(data)) {
      chatInboxRpcUnavailable = false;
      aggregated.push(...data);
      continue;
    }

    if (error) {
      if (isRpcFunctionMissing(error, 'listar_mensagens_chat_inbox')) {
        chatInboxRpcUnavailable = true;
      } else {
        console.log('RPC listar_mensagens_chat_inbox:', error.message);
      }
    } else if (chatInboxRpcUnavailable) {
      // PostgREST sem RPC inbox — fallback direto, sem round-trip 404.
    }

    const fallbackChunk = await fetchInboxMessagesFallback(nutricionistaId, chunk, sessionActor);
    aggregated.push(...fallbackChunk);
  }

  if (aggregated.length) {
    return groupRecentChatRows(aggregated);
  }

  return new Map();
}

async function fetchInboxMessagesFallback(nutricionistaId, patientIds = [], rpcActor = null) {
  const aggregated = [];
  const sessionActor =
    normalizeRpcActorProfile(rpcActor) ||
    (nutricionistaId ? { id_nutricionista_uuid: nutricionistaId } : null);

  await executarEmLotes(patientIds, NUTRI_INBOX_FALLBACK_BATCH, async (patientId) => {
    let rpcParams = null;

    try {
      rpcParams = await enrichChatRpcParams(
        {
          p_paciente_id: patientId,
          p_nutricionista_id: nutricionistaId,
          p_limite: NUTRI_INBOX_MESSAGES_PER_PATIENT,
        },
        patientId,
        sessionActor,
        sessionActor
      );
    } catch (sessionError) {
      console.log('Sessao RPC indisponivel (fallback chat):', sessionError?.message || sessionError);
      return;
    }

    const { data: rows, error: rowError } = await supabase.rpc('listar_mensagens_chat', rpcParams);

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
  patientCardsById = new Map(),
  rpcActor = null
) {
  const resolvedIds = uniqueValues(patientIds);
  if (!resolvedIds.length) return [];

  const resolvedNutriId = nutricionistaId || null;
  let messagesByPatient = new Map();

  if (resolvedNutriId) {
    try {
      messagesByPatient = await fetchInboxMessagesGrouped(resolvedNutriId, resolvedIds, rpcActor);
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
        thread: ensureArray(thread),
      };
    })
    .filter(Boolean);
}

/** Lista leve: ultima mensagem + nao lidas, sem thread completa nem app_state por paciente. */
export async function fetchNutritionistChatInbox(
  patientIds = [],
  nutricionistaId = null,
  rpcActor = null
) {
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
      messagesByPatient = await fetchInboxMessagesGrouped(resolvedNutriId, resolvedIds, rpcActor);
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
      thread: ensureArray(thread),
    };
  }).filter(Boolean);
}

async function resolveNutritionistChatThreadFallback(
  patientId,
  resolvedNutriId,
  { patientName = 'Paciente', rpcActor = null, limit = NUTRI_INBOX_MESSAGES_PER_PATIENT } = {}
) {
  const cached = getCachedPatientChat(patientId);
  const cachedThread = ensureArray(cached?.thread || cached?.appState?.nutritionistThread).filter(
    (item) => item?.text
  );
  if (cachedThread.length) {
    return sortChatThreadByCreatedAt(cachedThread);
  }

  if (resolvedNutriId) {
    try {
      const inboxMap = await fetchInboxMessagesGrouped(resolvedNutriId, [patientId], rpcActor);
      const rows = inboxMap.get(patientId) || [];
      if (rows.length) {
        const inboxThread = rows
          .map((row) => mapChatRowToThreadEntry(row, patientName))
          .filter((item) => item.text);
        if (inboxThread.length) {
          return sortChatThreadByCreatedAt(inboxThread);
        }
      }
    } catch (inboxError) {
      console.log('Fallback inbox do chat:', inboxError?.message || inboxError);
    }
  }

  const tableState = await fetchPacienteAppStateFromTable(patientId, rpcActor).catch(() => null);
  const patientRow = await fetchPatientById(patientId, { patientContext: rpcActor }).catch(() => null);
  const parsed = extractObjectiveAndAppState(patientRow?.objetivo_principal_consulta);
  const legacy = ensureArray(
    tableState?.nutritionistThread || parsed?.appState?.nutritionistThread
  )
    .map((item, index) =>
      normalizeNutritionistThreadEntry(item, {
        nutritionistName: 'Nutricionista',
        patientName,
        index,
      })
    )
    .filter((item) => item.text);

  if (legacy.length) {
    return sortChatThreadByCreatedAt(legacy.slice(-Math.max(limit, 1)));
  }

  return [];
}

export async function fetchNutritionistChatThreadForPatient(
  patientId,
  nutricionistaId,
  { patientName = 'Paciente', limit = NUTRI_THREAD_RECENT_LIMIT, rpcActor = null } = {}
) {
  if (!patientId) return [];

  const resolvedNutriId =
    nutricionistaId || (await resolveNutricionistaIdForPatient(patientId, null));
  const sessionActor =
    normalizeRpcActorProfile(rpcActor) ||
    (resolvedNutriId ? { id_nutricionista_uuid: resolvedNutriId } : null);

  if (!resolvedNutriId) {
    const fallbackOnly = await resolveNutritionistChatThreadFallback(patientId, null, {
      patientName,
      rpcActor: sessionActor,
      limit,
    });
    if (fallbackOnly.length) return fallbackOnly;
    throw new Error('Paciente sem nutricionista vinculado para abrir o chat.');
  }

  if (sessionActor) {
    await garantirSessaoRpcClinicaComPerfil(sessionActor);
  }

  let thread = await fetchChatThreadFromDatabase({
    pacienteId: patientId,
    nutricionistaId: resolvedNutriId,
    nutritionistName: 'Nutricionista',
    patientName,
    limit,
    rpcActor: sessionActor,
  });

  if (thread === null) {
    thread = await resolveNutritionistChatThreadFallback(patientId, resolvedNutriId, {
      patientName,
      rpcActor: sessionActor,
      limit,
    });
  }

  if (Array.isArray(thread)) {
    const attached = attachRegistroContextToThreadMessages(
      thread.filter((item) => item.text),
      thread
    );

    try {
      const meals = await fetchMealEntries(patientId, Math.min(limit, 200), sessionActor);
      return sortChatThreadByCreatedAt(enrichRegistroThreadsWithMealCatalog(attached, meals));
    } catch (mealError) {
      console.log('Enriquecimento refeicao no chat:', mealError?.message || mealError);
      return sortChatThreadByCreatedAt(attached);
    }
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
      messagesByPatient = await fetchInboxMessagesGrouped(
        resolvedNutriId,
        resolvedIds,
        options?.rpcActor
      );
    } catch (chatError) {
      console.log('Chat summaries indisponivel (RPC):', chatError);
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

  const rpcActor = {
    ...(normalizeRpcActorProfile(actor) || {}),
    ...(nutricionistaId ? { id_nutricionista_uuid: nutricionistaId } : {}),
  };

  if (newMessage?.text && effectivePatientId && nutricionistaId) {
    const sent = await sendChatMessage({
      pacienteId: effectivePatientId,
      nutricionistaId,
      autorRole: newMessage.role === 'nutri' ? 'nutricionista' : 'paciente',
      texto: newMessage.textRaw || newMessage.text,
      nutritionistName: newMessage.nutritionistName || 'Nutricionista',
      patientName: newMessage.patientName || getPatientDisplayName(patientContext || actor),
      rpcActor,
    });

    const cached =
      getCachedPatientExperience(effectivePatientId, {
        patientContext: patientContext || actor || null,
      }) ||
      getCachedPatientChat(effectivePatientId);

    const baseThread = ensureArray(thread).length
      ? thread
      : cached?.appState?.nutritionistThread || cached?.thread || [];
    const nextThread = sortChatThreadByCreatedAt(ensureThreadContainsMessage(baseThread, sent));

    const payload = {
      patient: cached?.patient || patientContext || actor || null,
      clinicalObjective: cached?.clinicalObjective || '',
      appState: {
        ...(cached?.appState || createDefaultAppState()),
        nutritionistThread: nextThread,
      },
      glucoseReadings: cached?.glucoseReadings || [],
      thread: nextThread,
    };

    replaceCachedPatientChat(effectivePatientId, payload);
    return payload;
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

function mapCgmRowToGlucoseReading(row, index = 0) {
  return normalizeGlucoseReadingRow({
    id: row.id,
    id_glicemia_manual_uuid: row.id,
    id_paciente_uuid: row.id_paciente_uuid,
    valor_glicose_mgdl: row.valor_glicose_mgdl,
    data: row.data,
    hora: row.hora,
    fonte: row.fonte || 'librelinkup',
    reading_time_utc: row.reading_time_utc,
    synced_at: row.synced_at,
    raw_payload: row.raw_payload,
    sintomas_associados: row.tendencia
      ? `Fonte: ${row.fonte || 'librelinkup'} | Tendencia: ${row.tendencia}`
      : `Fonte: ${row.fonte || 'librelinkup'}`,
  }, index);
}

async function fetchCgmGlucoseRowsDirect(patientId, limit = 120) {
  const { data, error } = await supabase
    .from('registro_glicemia_cgm')
    .select(
      'id, id_paciente_uuid, valor_glicose_mgdl, data, hora, fonte, reading_time_utc, synced_at, raw_payload, tendencia'
    )
    .eq('id_paciente_uuid', patientId)
    .order('reading_time_utc', { ascending: false, nullsFirst: false })
    .limit(Math.max(limit, 1));

  if (error || !Array.isArray(data)) {
    if (error) {
      console.log('Erro ao buscar glicemia CGM direto:', error.message);
    }
    return [];
  }

  return data.map((row, index) => mapCgmRowToGlucoseReading(row, index));
}

async function fetchManualGlucoseRowsDirect(patientId, limit = 120) {
  const { data, error } = await supabase
    .from('registro_glicemia_manual')
    .select('id_glicemia_manual_uuid, id_paciente_uuid, valor_glicose_mgdl, data, hora, sintomas_associados')
    .eq('id_paciente_uuid', patientId)
    .order('data', { ascending: false })
    .order('hora', { ascending: false })
    .limit(Math.max(limit, 1));

  if (error || !Array.isArray(data)) {
    if (error) {
      console.log('Erro ao buscar glicemia manual direto:', error.message);
    }
    return [];
  }

  return data.map((row, index) => normalizeGlucoseReadingRow(row, index));
}

export async function fetchGlucoseReadings(patientId, limit = 120, rpcActor = null) {
  if (!patientId) {
    return [];
  }

  const safeLimit = Math.max(Number(limit) || 0, 1);
  const baseParams = await buildRpcParams(
    {
      p_id_paciente_uuid: patientId,
      p_limite: safeLimit,
    },
    patientId,
    rpcActor
  );

  let rpcReadings = [];
  let cgmReadings = [];

  if (baseParams) {
    const rpcOpts = { pacienteId: patientId, user: rpcActor };
    const [{ data: rpcData, error: rpcError }, { data: cgmData, error: cgmError }] =
      await Promise.all([
        supabaseRpcClinica(
          'listar_glicemias_manuais_paciente',
          { p_id_paciente_uuid: patientId, p_limite: safeLimit },
          rpcOpts
        ),
        supabaseRpcClinica(
          'listar_glicemias_cgm_paciente',
          { p_id_paciente_uuid: patientId, p_limite: safeLimit },
          rpcOpts
        ),
      ]);

    if (!rpcError && Array.isArray(rpcData)) {
      rpcReadings = rpcData.map(normalizeGlucoseReadingRow);
    } else if (rpcError && !isRpcFunctionMissing(rpcError, 'listar_glicemias_manuais_paciente')) {
      console.log('Erro ao buscar glicemia manual por RPC:', rpcError.message);
    }

    if (!cgmError && Array.isArray(cgmData)) {
      cgmReadings = cgmData.map((row, index) => mapCgmRowToGlucoseReading(row, index));
    } else if (cgmError && !isRpcFunctionMissing(cgmError, 'listar_glicemias_cgm_paciente')) {
      console.log('Erro ao buscar glicemia CGM por RPC:', cgmError.message);
    }
  } else {
    console.log('Sessao RPC indisponivel ao buscar glicose; usando leitura direta das tabelas.');
  }

  if (!rpcReadings.length) {
    rpcReadings = await fetchManualGlucoseRowsDirect(patientId, safeLimit);
  }

  if (!cgmReadings.length) {
    cgmReadings = await fetchCgmGlucoseRowsDirect(patientId, safeLimit);
  }

  const merged = mergeCachedGlucoseReadings(cgmReadings, rpcReadings);
  return merged.slice(0, safeLimit);
}

export async function refreshPatientGlucoseReadings(patientId, options = {}) {
  if (!patientId) return [];

  const limit = Math.max(Number(options.glucoseLimit) || 60, 60);
  const rpcActor = options.patientContext || options.actor || null;

  try {
    await garantirSessaoRpcClinicaComPerfil(rpcActor);
  } catch (error) {
    console.log('Sessao RPC ausente ao atualizar glicose:', error?.message || error);
  }

  const fetchedReadings = await fetchGlucoseReadings(patientId, limit, rpcActor).catch((error) => {
    console.log('Falha ao buscar glicose do paciente:', error?.message || error);
    return [];
  });
  replaceCachedGlucoseReadings(patientId, fetchedReadings);
  patchCachedPatientExperienceGlucose(patientId, getCachedGlucoseReadings(patientId));

  return getCachedGlucoseReadings(patientId);
}

export async function refreshPatientMealEntries(patientId, options = {}) {
  if (!patientId) {
    return [];
  }

  const limit = Math.max(Number(options.mealLimit) || 56, 7);
  const rpcActor = options.patientContext || options.actor || null;

  try {
    await garantirSessaoRpcClinicaComPerfil(rpcActor);
  } catch (error) {
    console.log('Sessao RPC ausente ao atualizar refeicoes:', error?.message || error);
  }

  const fetchedMeals = await fetchMealEntries(patientId, limit, rpcActor).catch((error) => {
    console.log('Falha ao buscar refeicoes do paciente:', error?.message || error);
    return [];
  });

  const central = getCachedPatientAppState(patientId) || createDefaultAppState();
  const mergedMeals = mergeMealEntries(fetchedMeals, ensureArray(central.mealEntries));
  const hiddenIds = ensureArray(central.hiddenMealEntryIds);
  const visibleMeals = options.includeHidden
    ? mergedMeals
    : mergedMeals.filter((entry) => !hiddenIds.includes(entry?.id));

  replaceCachedPatientAppState(patientId, {
    ...central,
    mealEntries: visibleMeals,
  });

  if (visibleMeals.length > 0) {
    invalidatePatientExperienceCache(patientId);
  }

  return visibleMeals;
}

export async function fetchMedicationEntriesOnly(patientId, limit = 120, rpcActor = null) {
  let rpcEntries = [];
  const rpcParams = await buildRpcParams(
    {
      p_id_paciente_uuid: patientId,
      p_limite: limit,
    },
    patientId,
    rpcActor
  );

  if (!rpcParams) {
    return rpcEntries;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'listar_medicacoes_paciente',
    rpcParams
  );

  if (!rpcError && Array.isArray(rpcData)) {
    rpcEntries = rpcData
      .filter((item) => !isInsulinMedicationEntry(item))
      .map((item, index) => normalizeMedicationEntry(item, 'database', index));
    return rpcEntries.slice(0, limit);
  }

  if (rpcError && !isRpcFunctionMissing(rpcError, 'listar_medicacoes_paciente')) {
    console.log('Erro ao buscar medicacoes por RPC:', rpcError.message);
  }

  return rpcEntries.slice(0, limit);
}

async function fetchLegacyInsulinFromMedicacaoTable(patientId, limit = 120, rpcActor = null) {
  const rpcParams = await buildRpcParams(
    {
      p_id_paciente_uuid: patientId,
      p_limite: limit,
    },
    patientId,
    rpcActor
  );

  if (!rpcParams) {
    return [];
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'listar_medicacoes_paciente',
    rpcParams
  );

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData
      .filter((item) => isInsulinMedicationEntry(item))
      .map((item, index) => normalizeMedicationEntry(item, 'legacy_medicacao', index));
  }

  if (rpcError && !isRpcFunctionMissing(rpcError, 'listar_medicacoes_paciente')) {
    console.log('Erro ao buscar insulina legada por RPC:', rpcError.message);
  }

  return [];
}

export async function fetchInsulinEntries(patientId, limit = 120, rpcActor = null) {
  if (!patientId) {
    return [];
  }

  let dedicatedEntries = [];
  const rpcParams = await buildRpcParams(
    {
      p_id_paciente_uuid: patientId,
      p_limite: limit,
    },
    patientId,
    rpcActor
  );

  if (rpcParams) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'listar_insulinas_paciente',
      rpcParams
    );

    if (!rpcError && Array.isArray(rpcData)) {
      dedicatedEntries = rpcData.map((item, index) => normalizeInsulinEntry(item, 'insulin_rpc', index));
    } else if (rpcError && !isRpcFunctionMissing(rpcError, 'listar_insulinas_paciente')) {
      console.log('Erro ao buscar insulina por RPC:', rpcError.message);
    }
  }

  const legacyEntries = await fetchLegacyInsulinFromMedicacaoTable(patientId, limit, rpcActor);
  return mergeInsulinEntries(dedicatedEntries, legacyEntries).slice(0, limit);
}

export async function fetchMedicationEntries(patientId, limit = 120, rpcActor = null) {
  if (!patientId) {
    return [];
  }

  const [medicines, insulins] = await Promise.all([
    fetchMedicationEntriesOnly(patientId, limit, rpcActor),
    fetchInsulinEntries(patientId, limit, rpcActor),
  ]);

  return mergeMedicationEntries(medicines, insulins).slice(0, limit);
}

async function fetchMealRowsDirect(patientId, limit = 120) {
  const safeLimit = Math.max(Number(limit) || 0, 1);
  const { data, error } = await supabase
    .from('refeicao_ia')
    .select('*')
    .eq('paciente_id', patientId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.log('Erro ao buscar refeicoes direto:', error.message);
    }
    return [];
  }

  return data.map((row, index) => normalizeMealEntryFromDatabase(row, index));
}

export async function fetchMealEntries(patientId, limit = 120, rpcActor = null) {
  if (!patientId) {
    return [];
  }

  const safeLimit = Math.max(Number(limit) || 0, 1);
  const rpcParams = await buildRpcParams(
    {
      p_paciente_id: patientId,
      p_limite: safeLimit,
    },
    patientId,
    rpcActor
  );

  let rpcEntries = [];

  if (rpcParams) {
    const { data: rpcData, error: rpcError } = await supabaseRpcClinica(
      'listar_refeicoes_ia_paciente',
      { p_paciente_id: patientId, p_limite: safeLimit },
      { pacienteId: patientId, user: rpcActor }
    );

    if (!rpcError && Array.isArray(rpcData)) {
      rpcEntries = rpcData.map((row, index) => normalizeMealEntryFromDatabase(row, index));
    } else if (rpcError && !isRpcFunctionMissing(rpcError, 'listar_refeicoes_ia_paciente')) {
      console.log('Erro ao buscar refeicoes IA por RPC:', rpcError.message);
      throw new Error(rpcError.message || 'Erro ao listar refeicoes do paciente.');
    }
  } else {
    console.log('Sessao RPC indisponivel ao listar refeicoes do paciente.');
    return [];
  }

  return rpcEntries.slice(0, safeLimit);
}

function pickFirstRpcErrorMessage(errors = []) {
  const first = (errors || []).find((item) => String(item || '').trim());
  return first ? String(first).trim() : '';
}

/**
 * Carrega todos os registros clinicos do paciente para o prontuario da nutricionista.
 */
export async function fetchPatientRegistrosForNutri(
  patientId,
  {
    rpcActor = null,
    limits = {},
    experience = null,
    currentPatient = null,
    forceRefresh = false,
  } = {}
) {
  const empty = {
    glicemias: [],
    medicacoes: [],
    insulinas: [],
    refeicoes: [],
    error: null,
  };

  if (!patientId) {
    return { ...empty, error: 'Paciente sem identificador.' };
  }

  const nutriProfile = normalizeRpcActorProfile(rpcActor);
  const nutriId = nutriProfile?.id_nutricionista_uuid;
  if (!nutriId) {
    return { ...empty, error: 'Nutricionista sem identificador para consultar registros.' };
  }

  const glucoseLimit = Math.max(Number(limits.glucoseLimit) || 500, 1);
  const medicationLimit = Math.max(Number(limits.medicationLimit) || 500, 1);
  const mealLimit = Math.max(Number(limits.mealLimit) || 500, 1);
  const includeHidden = limits.includeHidden !== false;
  const rpcErrors = [];

  const pushRpcError = (error) => {
    const message = String(error?.message || error || '').trim();
    if (!message) return;
    rpcErrors.push(message);
  };

  const rpcToken = await garantirSessaoRpcClinicaComPerfil(nutriProfile);
  if (!rpcToken) {
    return {
      ...empty,
      error:
        'Sessao clinica ausente. Saia do app, entre novamente como nutricionista e recarregue o prontuario.',
    };
  }

  const patientSeed =
    currentPatient?.id_paciente_uuid
      ? currentPatient
      : currentPatient?.raw?.id_paciente_uuid
        ? currentPatient.raw
        : { id_paciente_uuid: patientId };

  let patientRow = patientSeed;
  try {
    const fetchedPatient = await fetchPatientById(patientId, {
      patientContext: nutriProfile,
      currentPatient: patientSeed,
    });
    if (fetchedPatient?.id_paciente_uuid) {
      patientRow = fetchedPatient;
    }
  } catch (error) {
    console.log('Perfil paciente prontuario nutri:', error?.message || error);
  }

  const objectiveParsed = extractObjectiveAndAppState(patientRow?.objetivo_principal_consulta);
  const objectiveAppState = normalizeAppState(objectiveParsed.appState || {});

  const experienceOptions = {
    skipChat: true,
    skipAlertSync: true,
    includeHidden,
    patientContext: nutriProfile,
    currentPatient: patientRow,
    glucoseLimit,
    medicationLimit,
    mealLimit,
  };

  let exp = experience;
  if (!exp) {
    try {
      const fetched = await fetchPatientExperience(patientId, {
        ...experienceOptions,
        forceRefresh: Boolean(forceRefresh),
      });
      if (fetched) {
        exp = fetched;
      }
    } catch (error) {
      pushRpcError(error);
      console.log('Experiencia do paciente indisponivel no prontuario:', error?.message || error);
    }
  }

  const [
    clinicalBundle,
    meds,
    insulinasData,
    tableAppStateDirect,
    mealsFromDb,
    glucoseFromDb,
  ] = await Promise.all([
    fetchHomeClinicalBundle(
      patientId,
      {
        glucoseLimit,
        mealLimit,
        medicationLimit: 0,
        includeMealPlan: false,
        includeAppState: true,
        includeHidden,
      },
      nutriProfile
    ),
    fetchMedicationEntriesOnly(patientId, medicationLimit, nutriProfile).catch((error) => {
      pushRpcError(error);
      console.log('Medicacoes prontuario nutri:', error?.message || error);
      return [];
    }),
    fetchInsulinEntries(patientId, medicationLimit, nutriProfile).catch((error) => {
      pushRpcError(error);
      console.log('Insulina prontuario nutri:', error?.message || error);
      return [];
    }),
    fetchPacienteAppStateFromTable(patientId, nutriProfile).catch((error) => {
      pushRpcError(error);
      return null;
    }),
    fetchMealEntries(patientId, mealLimit, nutriProfile).catch((error) => {
      pushRpcError(error);
      console.log('Refeicoes prontuario nutri:', error?.message || error);
      return [];
    }),
    fetchGlucoseReadings(patientId, glucoseLimit, nutriProfile).catch((error) => {
      pushRpcError(error);
      console.log('Glicemia prontuario nutri:', error?.message || error);
      return [];
    }),
  ]);

  const tableAppState = clinicalBundle?.tableAppState
    ? normalizeAppState(clinicalBundle.tableAppState)
    : tableAppStateDirect
      ? normalizeAppState(tableAppStateDirect)
      : null;

  const expAppState = normalizeAppState(exp?.appState || {});
  const mergedAppState = normalizeAppState({
    ...objectiveAppState,
    ...expAppState,
    ...(tableAppState || {}),
  });

  const hiddenMealIds = includeHidden ? [] : ensureArray(mergedAppState.hiddenMealEntryIds);
  const hiddenMedIds = includeHidden ? [] : ensureArray(mergedAppState.hiddenMedicationEntryIds);
  const hiddenGlucoseIds = includeHidden ? [] : ensureArray(mergedAppState.hiddenGlucoseReadingIds);

  const legacyMeals = ensureArray(mergedAppState.mealEntries).filter(
    (entry) => !hiddenMealIds.includes(entry?.id)
  );
  const legacyMeds = ensureArray(mergedAppState.medicationEntries)
    .filter((item) => !isInsulinMedicationEntry(item))
    .filter(
      (entry) =>
        !hiddenMedIds.includes(entry?.databaseId || entry?.legacyId || entry?.id)
    );
  const legacyInsulin = ensureArray(mergedAppState.medicationEntries)
    .filter((item) => isInsulinMedicationEntry(item))
    .filter(
      (entry) =>
        !hiddenMedIds.includes(entry?.databaseId || entry?.legacyId || entry?.id)
    );

  const refeicoes = mergeMealEntries(
    mergeMealEntries(ensureArray(clinicalBundle?.databaseMealEntries), mealsFromDb),
    legacyMeals
  );
  const medicacoes = mergeMedicationEntries(meds, legacyMeds);
  const insulinas = mergeInsulinEntries(insulinasData, legacyInsulin);
  const glicemias = mergeCachedGlucoseReadings(
    ensureArray(clinicalBundle?.glucoseReadings),
    mergeCachedGlucoseReadings(glucoseFromDb, ensureArray(exp?.glucoseReadings))
  ).filter((entry) => !hiddenGlucoseIds.includes(entry?.id));

  const sessionHint = !rpcToken
    ? 'Sessao clinica ausente. Saia do app, entre novamente como nutricionista e recarregue o prontuario.'
    : '';
  const rpcHint = pickFirstRpcErrorMessage(rpcErrors);
  const hasAnyData =
    glicemias.length > 0 ||
    refeicoes.length > 0 ||
    medicacoes.length > 0 ||
    insulinas.length > 0;
  const authHint =
    rpcHint &&
    /sessao|vinculo|autoriz|login|expirad|nao vinculad|sem vinculo|stack depth|recurs/i.test(
      rpcHint
    )
      ? rpcHint
      : '';
  const emptyHint = !hasAnyData
    ? 'Nenhum registro clinico encontrado para este paciente.'
    : '';

  return {
    glicemias: glicemias.slice(0, glucoseLimit),
    medicacoes: medicacoes.slice(0, medicationLimit),
    insulinas: insulinas.slice(0, medicationLimit),
    refeicoes: refeicoes.slice(0, mealLimit),
    error:
      sessionHint ||
      authHint ||
      (rpcHint && !hasAnyData ? rpcHint : null) ||
      emptyHint ||
      null,
  };
}

export async function clearCgmGlucoseReadingsBySource(
  patientId,
  { fonte = 'librelinkup', actor = null } = {}
) {
  if (!patientId) {
    return { removidos: 0 };
  }

  const { data, error } = await supabase.rpc(
    'limpar_glicemia_cgm_fonte',
    await enrichRpcClinicalParams(
      {
        p_id_paciente_uuid: patientId,
        p_fonte: fonte,
      },
      patientId,
      actor
    )
  );

  if (error) {
    if (isRpcFunctionMissing(error, 'limpar_glicemia_cgm_fonte')) {
      return { removidos: 0 };
    }
    throw error;
  }

  invalidatePatientExperienceCache(patientId);
  replaceCachedGlucoseReadings(patientId, []);

  return {
    removidos: Number(data || 0),
  };
}

export async function syncCgmGlucoseReadings(
  patientId,
  readings = [],
  { fonte = 'librelinkup', actor = null } = {}
) {
  if (!patientId || !readings.length) {
    return { inseridos: 0, ignorados: 0 };
  }

  const payload = readings
    .map((reading) => ({
      value: Number(reading?.value),
      readingTimeUtc: reading?.readingTimeUtc,
      tendencia: reading?.tendencia || reading?.trend || null,
      fonte: reading?.fonte || fonte,
      device_serial: reading?.device_serial || null,
      raw:
        reading?.raw ||
        (reading?.Timestamp || reading?.FactoryTimestamp
          ? {
              value: Number(reading?.value),
              Timestamp: reading?.Timestamp ?? reading?.timestamp ?? null,
              FactoryTimestamp: reading?.FactoryTimestamp ?? reading?.factoryTimestamp ?? null,
            }
          : null),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.value) &&
        item.value > 0 &&
        Boolean(item.readingTimeUtc)
    );

  if (!payload.length) {
    return { inseridos: 0, ignorados: 0 };
  }

  let rpcParams;
  try {
    rpcParams = await enrichRpcClinicalParams(
      {
        p_id_paciente_uuid: patientId,
        p_readings: payload,
        p_fonte: fonte,
      },
      patientId,
      actor
    );
  } catch (error) {
    console.log('Sessao RPC ausente ao sincronizar CGM:', error?.message || error);
    throw error;
  }

  const { data, error } = await supabase.rpc('sincronizar_glicemia_cgm', rpcParams);

  if (error) {
    if (isRpcFunctionMissing(error, 'sincronizar_glicemia_cgm')) {
      return { inseridos: 0, ignorados: payload.length };
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  invalidatePatientExperienceCache(patientId);

  const rpcActor = actor || null;
  await refreshPatientGlucoseReadings(patientId, {
    actor: rpcActor,
    patientContext: rpcActor,
    glucoseLimit: Math.max(payload.length, 7),
  }).catch(() => {});

  return {
    inseridos: Number(row?.inseridos || 0),
    ignorados: Number(row?.ignorados || 0),
  };
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

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'registrar_glicemia_manual_paciente',
    await enrichRpcClinicalParams(
      {
        p_id_paciente_uuid: patientId,
        p_valor_glicose_mgdl: fallbackPayload.valor_glicose_mgdl,
        p_data: fallbackPayload.data,
        p_hora: fallbackPayload.hora,
        p_sintomas_associados: normalizedSymptoms,
      },
      patientId,
      options.actor || null
    )
  );

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

  if (isRpcFunctionMissing(rpcError, 'registrar_glicemia_manual_paciente')) {
    const fallbackReading = buildGlucoseReadingFromPayload(fallbackPayload, glucoseCheck.value);
    invalidatePatientExperienceCache(patientId);
    return fallbackReading;
  }

  throw rpcError || new Error('Nao foi possivel registrar glicemia. Faca login novamente.');
}

async function addInsulinEntry(patientId, normalizedEntry, sourceEntry = {}) {
  const doseValue = normalizeMedicationNumber(normalizedEntry.medicineQuantity);
  const rpcParams = {
    p_id_paciente_uuid: patientId,
    p_categoria: normalizeInsulinCategoryForDatabase(normalizedEntry.insulinCategory),
    p_nome_insulina: normalizedEntry.medicineName || null,
    p_dose_ui: doseValue,
    p_unidade_medida: normalizedEntry.medicineUnit || 'UI',
    p_local_aplicacao: normalizedEntry.localAplicacao || null,
    p_data: normalizedEntry.date,
    p_hora: normalizedEntry.time,
    p_objetivo_uso: normalizedEntry.insulinUsage || null,
    p_observacao: buildMedicationObservation(normalizedEntry),
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'registrar_insulina_paciente',
    await enrichRpcClinicalParams(rpcParams, patientId)
  );

  if (!rpcError) {
    const saved = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const savedEntry = normalizeInsulinEntry(saved, 'insulin_rpc');

    try {
      await registrarLogAuditoria({
        actor: sourceEntry?.actor || null,
        targetPatientId: patientId,
        action: 'insulina_cadastrada',
        entity: 'registro_insulina',
        entityId: savedEntry.insulinDatabaseId || savedEntry.id,
        origin: sourceEntry?.auditSource || 'monitoramento_manual',
        details: {
          categoria: savedEntry.insulinCategory || '',
          nome: savedEntry.medicineName || '',
          doseUi: savedEntry.medicineQuantity || '',
          data: savedEntry.date,
          hora: savedEntry.time,
        },
      });
    } catch (auditError) {
      console.log('Auditoria de insulina falhou apos salvar por RPC:', auditError);
    }

    invalidatePatientExperienceCache(patientId);
    return savedEntry;
  }

  const localPayload = {
    id: buildUuid(),
    id_paciente_uuid: patientId,
    categoria_insulina: rpcParams.p_categoria,
    nome_insulina: rpcParams.p_nome_insulina,
    dose_ui: rpcParams.p_dose_ui,
    unidade_medida: rpcParams.p_unidade_medida,
    local_aplicacao: rpcParams.p_local_aplicacao,
    data: rpcParams.p_data,
    hora: rpcParams.p_hora,
    objetivo_uso: rpcParams.p_objetivo_uso,
    observacao: rpcParams.p_observacao,
  };

  if (!isRpcFunctionMissing(rpcError, 'registrar_insulina_paciente')) {
    console.log('RPC de insulina falhou:', rpcError?.message);
    throw rpcError || new Error('Nao foi possivel registrar insulina. Faca login novamente.');
  }

  console.log('RPC registrar_insulina_paciente indisponivel; mantendo registro local.');
  return normalizeInsulinEntry(localPayload, 'local_shadow');
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

    try {
      return await addInsulinEntry(patientId, normalizedEntry, entry);
    } catch (insulinError) {
      console.log(
        'Falha ao salvar insulina em registro_insulina; usando fallback registro_medicacao:',
        insulinError?.message || insulinError
      );
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
    const response = await supabase.rpc(
      'registrar_medicacao_paciente',
      await enrichRpcClinicalParams(rpcParams, patientId)
    );
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
  const hiddenId = entry?.insulinDatabaseId || entry?.databaseId || entry?.legacyId || entry?.id;
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

  const isInsulinEntry = entry?.medicationKind === 'insulin' || entry?.insulinDatabaseId;

  await registrarLogAuditoria({
    actor: currentPatient || patientContext || null,
    targetPatientId: patientId,
    action: isInsulinEntry ? 'insulina_ocultada_historico' : 'medicacao_ocultada_historico',
    entity: isInsulinEntry ? 'registro_insulina' : 'registro_medicacao',
    entityId: entry?.insulinDatabaseId || hiddenId || null,
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
  const normalized = mergeCachedGlucoseReadings(ensureArray(glucoseReadings)).map((item) => {
    const enriched = enrichGlucoseReadingDisplayFields(item);

    return {
      label: range === 'Hoje' ? enriched.time.slice(0, 5) : enriched.date.slice(5),
      chartKey:
        enriched.readingTimeUtc ||
        `${enriched.date}T${enriched.time}|${enriched.value}`,
      value: enriched.value,
      date: enriched.date,
      time: enriched.time,
      readingTimeUtc: enriched.readingTimeUtc || null,
    };
  });

  if (!normalized.length) {
    return [];
  }

  if (range === 'Hoje') {
    const today = buildTodayDateString();
    const todayReadings = normalized.filter((item) => item.date === today);
    const lastDayReadings = filterGlucoseReadingsLastHours(normalized, 24);
    const latestDate = normalized[0]?.date || today;
    const dayReadings =
      todayReadings.length >= 2
        ? todayReadings
        : lastDayReadings.length >= 2
          ? lastDayReadings
          : normalized.filter((item) => item.date === latestDate);

    return sortGlucoseReadingsChronologically(dayReadings).slice(-12);
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
