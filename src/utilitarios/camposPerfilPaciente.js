const MISSING_VALUE = 'Não informado';
const META_START = '[GLICNUTRI_APP_META_START]';
const META_END = '[GLICNUTRI_APP_META_END]';

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function valueOrMissing(value) {
  if (!hasValue(value)) return MISSING_VALUE;
  return String(value).trim();
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

export function getOnboardingAnswers(patient) {
  return parseJsonMaybe(patient?.onboarding_respostas) || {};
}

export function formatListValue(value) {
  if (!hasValue(value)) return MISSING_VALUE;

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : MISSING_VALUE;
  }

  return valueOrMissing(value);
}

export function formatCpfValue(value) {
  const numbers = String(value || '').replace(/\D/g, '');
  if (numbers.length !== 11) return valueOrMissing(value);

  return numbers
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCepValue(value) {
  const numbers = String(value || '').replace(/\D/g, '');
  if (numbers.length !== 8) return valueOrMissing(value);
  return numbers.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function formatDateValue(value) {
  if (!value) return MISSING_VALUE;

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return valueOrMissing(value);

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTimeValue(value) {
  if (!value) return MISSING_VALUE;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return valueOrMissing(value);

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumberValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return MISSING_VALUE;

  const number = Number(value);
  if (!Number.isFinite(number)) return valueOrMissing(value);

  const formatted = number.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  });

  return suffix ? `${formatted} ${suffix}` : formatted;
}

function cleanObjectiveText(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const startIndex = text.indexOf(META_START);
  const endIndex = text.indexOf(META_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return text;
  }

  return text.slice(0, startIndex).trim();
}

function findValueByPrefix(patient, prefixes) {
  if (!patient) return null;

  const key = Object.keys(patient).find((item) =>
    prefixes.some((prefix) => item.startsWith(prefix))
  );

  return key ? patient[key] : null;
}

export function buildPatientDataRows(patient) {
  return [
    { label: 'Nome completo', value: valueOrMissing(patient?.nome_completo) },
    { label: 'CPF', value: formatCpfValue(patient?.cpf_paciente) },
    { label: 'E-mail', value: valueOrMissing(patient?.email_pac) },
    { label: 'Telefone', value: valueOrMissing(patient?.telefone) },
    { label: 'Data de nascimento', value: formatDateValue(patient?.data_nascimento) },
    { label: 'Sexo biológico', value: valueOrMissing(patient?.sexo_biologico) },
    { label: 'ID do paciente', value: valueOrMissing(patient?.id_paciente_uuid) },
    { label: 'ID do nutricionista', value: valueOrMissing(patient?.id_nutricionista_uuid) },
    { label: 'Data de cadastro', value: formatDateTimeValue(patient?.data_hora_cadastro) },
    {
      label: 'Última atualização',
      value: formatDateTimeValue(patient?.data_hora_ultima_atualizacao),
    },
    { label: 'CEP', value: formatCepValue(patient?.cep) },
    { label: 'Logradouro', value: valueOrMissing(patient?.logradouro) },
    { label: 'Número', value: valueOrMissing(patient?.numero) },
    { label: 'Bairro', value: valueOrMissing(patient?.bairro) },
    { label: 'Cidade', value: valueOrMissing(patient?.cidade) },
    { label: 'UF', value: valueOrMissing(patient?.uf) },
  ];
}

export function buildPatientClinicalRows(patient) {
  const onboarding = getOnboardingAnswers(patient);
  const objectiveText = cleanObjectiveText(patient?.objetivo_principal_consulta);
  const onboardingObjectives = formatListValue(onboarding.objetivos);
  const bodyFat = findValueByPrefix(patient, ['percentual_gordura']);

  return [
    {
      label: 'Objetivo principal da consulta',
      value: objectiveText || onboardingObjectives,
    },
    { label: 'Objetivos nutricionais do onboarding', value: onboardingObjectives },
    { label: 'Condições clínicas informadas', value: formatListValue(onboarding.condicoes) },
    { label: 'Situações clínicas informadas', value: formatListValue(onboarding.situacoes) },
    { label: 'Procedimentos clínicos informados', value: formatListValue(onboarding.procedimentos) },
    { label: 'Outro procedimento descrito', value: valueOrMissing(onboarding.procedimento_outros) },
    { label: 'Percentual de gordura corporal', value: formatNumberValue(bodyFat, '%') },
    {
      label: 'Nível de atividade física atual',
      value: valueOrMissing(patient?.nivel_atividade_fisica_atual),
    },
    { label: 'Qualidade média do sono', value: valueOrMissing(patient?.qualidade_sono_media) },
    { label: 'Altura', value: formatNumberValue(patient?.altura_cm, 'cm') },
    { label: 'Peso atual', value: formatNumberValue(patient?.peso_atual_kg, 'kg') },
    { label: 'IMC calculado', value: formatNumberValue(patient?.imc_calculado) },
    { label: 'Alergias', value: valueOrMissing(patient?.alergias_texto) },
    { label: 'Comorbidades', value: valueOrMissing(patient?.comorbidades_texto) },
    {
      label: 'Histórico familiar/doenças',
      value: valueOrMissing(patient?.historico_familiar_doencas),
    },
  ];
}

export function buildPatientProfileSections(patient) {
  return [
    {
      key: 'patient',
      title: 'Dados do paciente',
      helper: 'Identificação e contato.',
      rows: buildPatientDataRows(patient),
    },
    {
      key: 'clinical',
      title: 'Dados clínicos',
      helper: 'Informações nutricionais, clínicas e respostas do onboarding.',
      rows: buildPatientClinicalRows(patient),
    },
  ];
}
