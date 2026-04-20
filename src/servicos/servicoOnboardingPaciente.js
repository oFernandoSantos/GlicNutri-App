import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './configSupabase';

const PATIENT_ONBOARDING_PREFIX = '@glicnutri:patientOnboardingSeen';
const PATIENT_ONBOARDING_DATA_PREFIX = '@glicnutri:patientOnboardingData';

export function getPatientOnboardingId(usuario) {
  return (
    usuario?.id_paciente_uuid ||
    usuario?.user_metadata?.id_paciente_uuid ||
    usuario?.cpf_paciente ||
    usuario?.email_pac ||
    usuario?.email ||
    usuario?.id ||
    'paciente'
  );
}

function buildKey(prefix, usuario) {
  return `${prefix}:${String(getPatientOnboardingId(usuario)).toLowerCase()}`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function joinAnswers(value) {
  const answers = ensureArray(value).filter(Boolean);
  return answers.length ? answers.join(', ') : null;
}

function buildClinicalHistoryText(payload) {
  const situacoes = joinAnswers(payload.situacoes);
  const procedimentos = joinAnswers(payload.procedimentos);
  const outros = payload.procedimento_outros?.trim();
  const blocks = [];

  if (situacoes) {
    blocks.push(`Situações clínicas: ${situacoes}`);
  }

  if (procedimentos) {
    blocks.push(`Procedimentos: ${procedimentos}`);
  }

  if (outros) {
    blocks.push(`Outros procedimentos: ${outros}`);
  }

  return blocks.length ? blocks.join(' | ') : null;
}

function buildProfilePatchFromOnboarding(payload) {
  if (payload.skipped) {
    return {};
  }

  return {
    objetivo_principal_consulta: joinAnswers(payload.objetivos),
    comorbidades_texto: joinAnswers(payload.condicoes),
    historico_familiar_doencas: buildClinicalHistoryText(payload),
    data_hora_ultima_atualizacao: payload.completedAt,
  };
}

function parseJsonMaybe(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function hasCompletedOnboardingData(usuario) {
  const onboardingAnswers = parseJsonMaybe(usuario?.onboarding_respostas);

  return Boolean(
    usuario?.onboarding_concluido_em ||
      onboardingAnswers?.completedAt ||
      onboardingAnswers?.skipped === true
  );
}

export async function hasPatientOnboardingSeen(usuario) {
  if (hasCompletedOnboardingData(usuario)) {
    return true;
  }

  try {
    const value = await AsyncStorage.getItem(buildKey(PATIENT_ONBOARDING_PREFIX, usuario));
    return value === 'true';
  } catch (error) {
    console.log('Erro ao carregar onboarding do paciente:', error);
    return false;
  }
}

export async function getPatientLocalOnboardingData(usuario) {
  try {
    const value = await AsyncStorage.getItem(buildKey(PATIENT_ONBOARDING_DATA_PREFIX, usuario));
    return parseJsonMaybe(value);
  } catch (error) {
    console.log('Erro ao carregar dados locais do onboarding do paciente:', error);
    return null;
  }
}

export function mergePatientOnboardingData(patient, onboardingData) {
  if (!onboardingData) return patient || null;

  return {
    ...(patient || {}),
    onboarding_respostas: patient?.onboarding_respostas || onboardingData,
    onboarding_concluido_em:
      patient?.onboarding_concluido_em || onboardingData.completedAt || null,
    objetivo_principal_consulta:
      patient?.objetivo_principal_consulta ||
      buildProfilePatchFromOnboarding(onboardingData).objetivo_principal_consulta ||
      null,
    comorbidades_texto:
      patient?.comorbidades_texto ||
      buildProfilePatchFromOnboarding(onboardingData).comorbidades_texto ||
      null,
    historico_familiar_doencas:
      patient?.historico_familiar_doencas ||
      buildProfilePatchFromOnboarding(onboardingData).historico_familiar_doencas ||
      null,
  };
}

export async function markPatientOnboardingSeen(usuario, respostas = {}) {
  const payload = {
    ...respostas,
    completedAt: new Date().toISOString(),
  };

  try {
    await AsyncStorage.multiSet([
      [buildKey(PATIENT_ONBOARDING_PREFIX, usuario), 'true'],
      [buildKey(PATIENT_ONBOARDING_DATA_PREFIX, usuario), JSON.stringify(payload)],
    ]);
  } catch (error) {
    console.log('Erro ao salvar onboarding local do paciente:', error);
  }

  const pacienteId =
    usuario?.id_paciente_uuid ||
    usuario?.user_metadata?.id_paciente_uuid ||
    null;

  const localPatient = {
    ...(usuario || {}),
    onboarding_respostas: payload,
    onboarding_concluido_em: payload.completedAt,
    ...buildProfilePatchFromOnboarding(payload),
  };

  if (!pacienteId) return localPatient;

  try {
    const profilePatch = buildProfilePatchFromOnboarding(payload);
    const updatePayload = {
      onboarding_respostas: payload,
      onboarding_concluido_em: payload.completedAt,
      ...profilePatch,
    };

    const { data, error } = await supabase
      .from('paciente')
      .update(updatePayload)
      .eq('id_paciente_uuid', pacienteId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.log('Erro ao salvar onboarding no Supabase:', error.message);
      return localPatient;
    }

    return data || localPatient;
  } catch (error) {
    console.log('Erro inesperado ao salvar onboarding no Supabase:', error);
    return localPatient;
  }
}
