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
  const insulinProfiles = onboarding?.insulin_profiles || {};
  const legacyCategory = String(onboarding?.insulin_category_default || '').trim();
  const legacyProfile = {
    type: String(onboarding?.insulin_type_default || '').trim(),
    usage: String(onboarding?.insulin_usage_default || '').trim(),
    dose: String(onboarding?.insulin_dose_default || '').trim(),
    notes: String(onboarding?.insulin_notes_default || '').trim(),
  };
  const basalSummary = [
    insulinProfiles?.basal?.type || (legacyCategory === 'basal' ? legacyProfile.type : ''),
    insulinProfiles?.basal?.usage || (legacyCategory === 'basal' ? legacyProfile.usage : ''),
    insulinProfiles?.basal?.dose
      ? `${insulinProfiles.basal.dose} UI`
      : legacyCategory === 'basal' && legacyProfile.dose
        ? `${legacyProfile.dose} UI`
        : '',
  ]
    .filter((item) => String(item || '').trim())
    .join(', ');
  const bolusSummary = [
    insulinProfiles?.bolus?.type || (legacyCategory === 'prandial' ? legacyProfile.type : ''),
    insulinProfiles?.bolus?.usage || (legacyCategory === 'prandial' ? legacyProfile.usage : ''),
    insulinProfiles?.bolus?.dose
      ? `${insulinProfiles.bolus.dose} UI`
      : legacyCategory === 'prandial' && legacyProfile.dose
        ? `${legacyProfile.dose} UI`
        : '',
  ]
    .filter((item) => String(item || '').trim())
    .join(', ');

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
    { label: 'Uso atual de insulina', value: valueOrMissing(onboarding.insulinoterapia_atual) },
    { label: 'Perfil de insulina basal', value: valueOrMissing(basalSummary) },
    {
      label: 'Observacoes da insulina basal',
      value: valueOrMissing(
        insulinProfiles?.basal?.notes || (legacyCategory === 'basal' ? legacyProfile.notes : '')
      ),
    },
    { label: 'Perfil de insulina bolus', value: valueOrMissing(bolusSummary) },
    {
      label: 'Observacoes da insulina bolus',
      value: valueOrMissing(
        insulinProfiles?.bolus?.notes || (legacyCategory === 'prandial' ? legacyProfile.notes : '')
      ),
    },
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

export function buildPatientPharmacologyRows(patient) {
  const onboarding = getOnboardingAnswers(patient);
  const plans = Array.isArray(onboarding?.terapia_farmacologica_insulinas)
    ? onboarding.terapia_farmacologica_insulinas
    : [];

  if (!plans.length) {
    return [{ label: 'Plano farmacológico', value: MISSING_VALUE }];
  }

  return plans.map((plan, index) => {
    const timingSummary = Array.isArray(plan?.tabela_horarios)
      ? plan.tabela_horarios
          .map((item) =>
            [
              item?.dia_semana,
              item?.refeicao,
              item?.horario,
              item?.dose ? `${item.dose} ${item?.dose_unidade || 'UI'}` : '',
              item?.tipo_dose,
              item?.observacao,
            ]
              .filter(Boolean)
              .join(' - ')
          )
          .filter(Boolean)
          .join('; ')
      : '';

    return {
      label: `${index + 1}. ${valueOrMissing(plan?.categoria_funcional).toUpperCase()} - ${valueOrMissing(
        plan?.marca
      )}`,
      value: [
        plan?.molecula,
        plan?.classe_acao,
        plan?.dispositivo,
        plan?.apresentacao,
        plan?.via,
        plan?.dose ? `${plan.dose} ${plan?.dose_unidade || 'UI'}` : '',
        timingSummary ? `Horários: ${timingSummary}` : '',
        plan?.status,
      ]
        .filter(Boolean)
        .join(' | '),
    };
  });
}

function splitListItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/,|;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isIgnoredOnboardingOption(value) {
  const lower = String(value || '').trim().toLowerCase();
  return (
    lower === 'não possuo' ||
    lower === 'nao possuo' ||
    lower === 'não tive' ||
    lower === 'nao tive' ||
    lower === 'não realizei' ||
    lower === 'nao realizei'
  );
}

function uniqueListItems(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = item.toLowerCase();

    if (!item || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function cleanObjectiveItemsFromText(text) {
  const cleaned = cleanObjectiveText(text);
  if (!cleaned || cleaned === MISSING_VALUE) return [];

  return splitListItems(cleaned);
}

export function buildPatientIntroHealthOverview(patient, clinicalForm = {}) {
  const onboarding = getOnboardingAnswers(patient);

  const objectiveItems = uniqueListItems([
    ...splitListItems(onboarding?.objetivos),
    ...splitListItems(clinicalForm?.objetivos),
    ...cleanObjectiveItemsFromText(patient?.objetivo_principal_consulta),
  ]);

  const healthItems = uniqueListItems([
    ...splitListItems(onboarding?.condicoes),
    ...splitListItems(clinicalForm?.condicoes),
    ...splitListItems(clinicalForm?.comorbidades_texto),
    ...splitListItems(patient?.comorbidades_texto),
    ...splitListItems(onboarding?.situacoes),
    ...splitListItems(clinicalForm?.situacoes),
  ]).filter((item) => !isIgnoredOnboardingOption(item));

  const diabetesStatus = String(clinicalForm?.diabetes_status || onboarding?.diabetes_status || '').trim();
  const diabetesType = String(clinicalForm?.diabetes_tipo || onboarding?.diabetes_tipo || onboarding?.tipo_diabetes || '').trim();
  const diabetesLabel = String(clinicalForm?.diabetes || '').trim();

  if (diabetesLabel && !healthItems.some((item) => item.toLowerCase().includes('diabetes'))) {
    healthItems.unshift(diabetesLabel);
  } else if (diabetesStatus === 'Sim') {
    healthItems.unshift(diabetesType ? `Diabetes ${diabetesType}` : 'Diabetes');
  }

  const activity =
    String(clinicalForm?.nivel_atividade_fisica_atual || patient?.nivel_atividade_fisica_atual || '').trim();
  const sleep = String(clinicalForm?.qualidade_sono_media || patient?.qualidade_sono_media || '').trim();
  const routineParts = [activity, sleep].filter(Boolean);

  const metaItems = objectiveItems.slice(0, 3);

  return {
    objetivo: objectiveItems[0] || MISSING_VALUE,
    meta: metaItems.length ? metaItems.join(', ') : MISSING_VALUE,
    metaItems,
    saude: healthItems.length ? healthItems.join(', ') : MISSING_VALUE,
    saudeItems: healthItems.slice(0, 6),
    rotina: routineParts.length ? routineParts.join(' • ') : MISSING_VALUE,
    rotinaItems: routineParts,
    atividade: activity || MISSING_VALUE,
    sono: sleep || MISSING_VALUE,
  };
}

function formatDiabetesObjectiveValue(patient, clinicalForm, formattedDiabetes) {
  const onboarding = getOnboardingAnswers(patient);
  const diabetesType = String(
    clinicalForm?.diabetes_tipo || onboarding?.diabetes_tipo || onboarding?.tipo_diabetes || ''
  ).trim();

  if (diabetesType) {
    if (/^diabetes\s/i.test(diabetesType)) {
      return diabetesType;
    }

    if (/^tipo\s/i.test(diabetesType)) {
      return `Diabetes ${diabetesType}`;
    }

    return `Diabetes Tipo ${diabetesType}`;
  }

  const diabetesLabel = String(formattedDiabetes || clinicalForm?.diabetes || '').trim();
  if (diabetesLabel && diabetesLabel !== MISSING_VALUE && diabetesLabel !== 'Não') {
    return diabetesLabel;
  }

  const overview = buildPatientIntroHealthOverview(patient, clinicalForm);
  return overview.objetivo;
}

function formatObjectiveDisplay(patient, clinicalForm) {
  const overview = buildPatientIntroHealthOverview(patient, clinicalForm);
  const objectiveValue = String(overview.objetivo || '').trim();

  return objectiveValue && objectiveValue !== MISSING_VALUE ? objectiveValue : MISSING_VALUE;
}

function formatBloodPressureDisplay(value) {
  const text = String(value || '').trim();
  if (!text || text === MISSING_VALUE) return MISSING_VALUE;
  if (/mmhg/i.test(text)) return text;
  if (/^\d+\s*\/\s*\d+/.test(text)) return `${text} mmHg`;
  return text;
}

export function buildPatientHealthInfoRows(patient, clinicalForm = {}, formatted = {}) {
  return [
    {
      label: 'Objetivo',
      value: formatDiabetesObjectiveValue(patient, clinicalForm, formatted.diabetes),
    },
    { label: 'Altura', value: formatted.height || MISSING_VALUE },
    { label: 'IMC', value: formatted.imc || MISSING_VALUE },
    {
      label: 'Pressão Arterial',
      value: formatBloodPressureDisplay(formatted.bloodPressure),
    },
  ].map((row) => ({
    label: row.label,
    value: String(row.value || '').trim() || MISSING_VALUE,
  }));
}

export function buildPatientProfileSections(patient) {
  return [
    {
      key: 'patient',
      title: 'Identificação e contato',
      helper: 'Nome, documentos, telefone e endereço para consultas e lembretes.',
      rows: buildPatientDataRows(patient),
    },
    {
      key: 'clinical',
      title: 'Saúde, metas e rotina',
      helper: 'Diabetes, medidas corporais, objetivos e histórico clínico do onboarding.',
      rows: buildPatientClinicalRows(patient),
    },
    {
      key: 'pharmacology',
      title: 'Terapia com insulina',
      helper: 'Basal, bolus e mista — marcas, doses e horários do dia.',
      rows: buildPatientPharmacologyRows(patient),
    },
  ];
}
