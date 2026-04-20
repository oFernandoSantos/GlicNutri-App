import { supabase } from './configSupabase';
import { syncGooglePatientRecord, isGoogleUser } from './sincronizarPacienteGoogle';
import { mergeCachedGlucoseReadings } from './centralGlicose';
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

export function createDefaultAppState() {
  return {
    version: 1,
    waterCount: 0,
    mealEntries: [],
    activityEntries: [],
    medicationEntries: [],
    symptomEntries: [],
    assistantMessages: [],
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
    activityEntries: ensureArray(appState.activityEntries),
    medicationEntries: ensureArray(appState.medicationEntries),
    symptomEntries: ensureArray(appState.symptomEntries),
    assistantMessages: ensureArray(appState.assistantMessages),
    nutritionistThread: ensureArray(appState.nutritionistThread).length
      ? appState.nutritionistThread
      : defaults.nutritionistThread,
    planSections: ensureArray(appState.planSections).length
      ? appState.planSections
      : defaults.planSections,
    wellness: ensureWellness(appState.wellness),
  };
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
  const payload = JSON.stringify(normalizeAppState(appState));

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

  return (data || [])[0] || null;
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

  return (data || [])[0] || null;
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
      return data;
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
  const glucoseReadings = await fetchGlucoseReadings(effectivePatientId);

  return {
    patient,
    clinicalObjective: parsed.objectiveText,
    appState: parsed.appState,
    glucoseReadings,
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

  const normalized = normalizeAppState(appState);
  const latestActivity =
    normalized.activityEntries[0]?.label ||
    resolvedPatient?.nivel_atividade_fisica_atual ||
    currentPatient?.nivel_atividade_fisica_atual ||
    null;

  const patch = {
    objetivo_principal_consulta: serializeObjectiveAndAppState(objectiveText, normalized),
    qualidade_sono_media: mapSleepToLabel(normalized.wellness.selectedSleep),
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

  return {
    patient: data,
    appState: normalized,
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

  return data;
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

export async function addGlucoseReading(patientId, value, options = {}) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para registrar glicemia.');
  }

  const fallbackPayload = {
    id_glicemia_manual_uuid: options.id || buildUuid(),
    id_paciente_uuid: patientId,
    valor_glicose_mgdl: Number(value),
    data: options.date || buildTodayDateString(),
    hora: options.time || buildCurrentTimeString(),
  };

  const { data: rpcData, error: rpcError } = await supabase
    .rpc('registrar_glicemia_manual_paciente', {
      p_id_paciente_uuid: patientId,
      p_valor_glicose_mgdl: fallbackPayload.valor_glicose_mgdl,
      p_data: fallbackPayload.data,
      p_hora: fallbackPayload.hora,
      p_sintomas_associados: options.symptoms || 'Registro manual pelo app',
    });

  if (!rpcError) {
    const saved = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    if (!saved) {
      return buildGlucoseReadingFromPayload(fallbackPayload, value);
    }

    return buildGlucoseReadingFromPayload(
      {
        ...fallbackPayload,
        ...saved,
      },
      value
    );
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
    sintomas_associados: options.symptoms || 'Registro manual pelo app',
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
    return buildGlucoseReadingFromPayload(payload, value);
  }

  return buildGlucoseReadingFromPayload(
    {
      ...payload,
      ...data,
    },
    value
  );
}

export async function deleteGlucoseReading(patientId, reading) {
  if (!patientId || !reading?.id) {
    throw new Error('Registro de glicemia sem identificador para excluir.');
  }

  const { error } = await supabase
    .from('registro_glicemia_manual')
    .delete()
    .eq('id_paciente_uuid', patientId)
    .eq('id_glicemia_manual_uuid', reading.id);

  if (error) {
    throw error;
  }

  return true;
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
