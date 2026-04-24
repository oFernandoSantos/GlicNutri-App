import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { inputFocusBorder } from '../../temas/temaFocoCampo';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';
import {
  fetchPatientById,
  getPatientDisplayName,
  getPatientId,
  updatePatientProfile,
} from '../../servicos/servicoDadosPaciente';
import {
  buildPatientProfileSections,
  getOnboardingAnswers,
} from '../../utilitarios/camposPerfilPaciente';
import { useKeyboardAwareScroll } from '../../utilitarios/rolagemComTeclado';
import {
  getPatientLocalOnboardingData,
  mergePatientOnboardingData,
} from '../../servicos/servicoOnboardingPaciente';
import {
  confirmarCodigoValidacaoEmailCadastro,
  solicitarCodigoValidacaoEmailCadastro,
} from '../../servicos/servicoVerificacaoEmail';

const EMPTY_PROFILE_FORM = {
  nome_completo: '',
  cpf_paciente: '',
  email_pac: '',
  telefone: '',
  data_nascimento: '',
  sexo_biologico: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
};

const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Não binário', 'Prefiro não informar'];
const DIABETES_TYPE_OPTIONS = ['Tipo 1', 'Tipo 2', 'Lada', 'Mody', 'Gestacional', 'Outros Tipos'];

const ONBOARDING_OBJECTIVE_OPTIONS = [
  'Perder peso',
  'Ganhar peso',
  'Melhorar a alimentação',
  'Controle do diabetes',
  'Controle da hipertensão arterial',
  'Melhorar o colesterol',
  'Cuidar da saúde mental',
  'Melhorar a qualidade de vida',
  'Cuidar de condições de saúde',
];

const ONBOARDING_CONDITION_OPTIONS = [
  'Colesterol alto',
  'Diabetes',
  'Doenças cardiovasculares',
  'Doença hepática (fígado)',
  'Doenças renais',
  'Obesidade',
  'Síndrome dos ovários policísticos',
  'Tireoide',
  'Triglicerídeos altos',
  'Não possuo',
];

const ONBOARDING_SITUATION_OPTIONS = [
  'Acidente vascular cerebral (AVC)',
  'Candidíase recorrente',
  'Infarto prévio',
  'Neuropatia diabética',
  'Pé diabético',
  'Retinopatia diabética',
  'Úlcera em alguma parte do corpo',
  'Não tive',
];

const ONBOARDING_PROCEDURE_OPTIONS = [
  'Amputação de membro',
  'Cateterismo prévio',
  'Cirurgia de revascularização (ponte de safena)',
  'Portador de marcapasso',
  'Não realizei',
  'Outros',
];

const ONBOARDING_OBJECTIVE_MAX = 3;
const ONBOARDING_CONDITION_NONE = 'Não possuo';
const ONBOARDING_SITUATION_NONE = 'Não tive';
const ONBOARDING_PROCEDURE_NONE = 'Não realizei';

const EMPTY_CLINICAL_FORM = {
  objetivos: '',
  condicoes: '',
  situacoes: '',
  procedimentos: '',
  procedimento_outros: '',
  diabetes: '',
  diabetes_status: '',
  diabetes_tipo: '',
  nivel_atividade_fisica_atual: '',
  qualidade_sono_media: '',
  altura_cm: '',
  peso_atual_kg: '',
  imc_calculado: '',
  alergias_texto: '',
  comorbidades_texto: '',
  historico_familiar_doencas: '',
};

const PATIENT_PROFILE_FIELDS = [
  {
    key: 'nome_completo',
    label: 'Nome completo',
    placeholder: 'Ex: Ana Silva',
    autoCapitalize: 'words',
  },
  {
    key: 'cpf_paciente',
    label: 'CPF',
    placeholder: '000.000.000-00',
    keyboardType: 'numeric',
    maxLength: 14,
    formatter: formatCpfInput,
  },
  {
    key: 'email_pac',
    label: 'E-mail',
    placeholder: 'email@exemplo.com',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
  },
  {
    key: 'telefone',
    label: 'Telefone',
    placeholder: '(00) 00000-0000',
    keyboardType: 'phone-pad',
    maxLength: 15,
    formatter: formatPhoneInput,
  },
  {
    key: 'data_nascimento',
    label: 'Data de nascimento',
    placeholder: 'DD/MM/AAAA',
    keyboardType: 'numeric',
    maxLength: 10,
    formatter: formatDateInput,
  },
  {
    key: 'sexo_biologico',
    label: 'Gênero',
    placeholder: 'Selecione',
    type: 'select',
  },
  {
    key: 'cep',
    label: 'CEP',
    placeholder: '00000-000',
    keyboardType: 'numeric',
    maxLength: 9,
    formatter: formatCepInput,
  },
  {
    key: 'logradouro',
    label: 'Logradouro',
    placeholder: 'Ex: Rua das Flores',
    autoCapitalize: 'words',
  },
  {
    key: 'numero',
    label: 'Número',
    placeholder: 'Ex: 123',
    keyboardType: 'numeric',
  },
  {
    key: 'bairro',
    label: 'Bairro',
    placeholder: 'Ex: Centro',
    autoCapitalize: 'words',
  },
  {
    key: 'cidade',
    label: 'Cidade',
    placeholder: 'Ex: Curitiba',
    autoCapitalize: 'words',
  },
  {
    key: 'uf',
    label: 'UF',
    placeholder: 'Ex: PR',
    autoCapitalize: 'characters',
    maxLength: 2,
    formatter: (value) => String(value || '').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
  },
];

const CLINICAL_PROFILE_FIELDS = [
  {
    key: 'objetivos',
    label: 'Objetivos nutricionais',
    placeholder: 'Ex: Perder peso, Controle do diabetes',
    multiline: true,
  },
  {
    key: 'condicoes',
    label: 'Condições clínicas',
    placeholder: 'Ex: Colesterol alto, Diabetes',
    multiline: true,
  },
  {
    key: 'situacoes',
    label: 'Complicações clínicas',
    placeholder: 'Ex: Neuropatia diabética',
    multiline: true,
  },
  {
    key: 'procedimentos',
    label: 'Procedimentos clínicos',
    placeholder: 'Ex: Cateterismo prévio',
    multiline: true,
  },
  {
    key: 'procedimento_outros',
    label: 'Outro procedimento',
    placeholder: 'Descreva outro procedimento',
    multiline: true,
  },
  {
    key: 'diabetes',
    label: 'Diabetes',
    placeholder: 'Selecione',
    type: 'diabetes',
  },
  {
    key: 'nivel_atividade_fisica_atual',
    label: 'Atividade física atual',
    placeholder: 'Ex: Caminhada 3x por semana',
  },
  {
    key: 'qualidade_sono_media',
    label: 'Qualidade média do sono',
    placeholder: 'Ex: Boa',
  },
  {
    key: 'altura_cm',
    label: 'Altura',
    placeholder: 'Ex: 170',
    keyboardType: 'decimal-pad',
    formatter: formatDecimalInput,
  },
  {
    key: 'peso_atual_kg',
    label: 'Peso atual',
    placeholder: 'Ex: 72,5',
    keyboardType: 'decimal-pad',
    formatter: formatDecimalInput,
  },
  {
    key: 'imc_calculado',
    label: 'IMC calculado',
    placeholder: 'Calculado automaticamente',
    readOnly: true,
  },
  {
    key: 'alergias_texto',
    label: 'Alergias',
    placeholder: 'Ex: Lactose, frutos do mar',
    multiline: true,
  },
  {
    key: 'comorbidades_texto',
    label: 'Comorbidades',
    placeholder: 'Ex: Hipertensão arterial',
    multiline: true,
  },
  {
    key: 'historico_familiar_doencas',
    label: 'Histórico familiar/doenças',
    placeholder: 'Ex: Diabetes na família',
    multiline: true,
  },
];

function onlyDigits(value, maxLength) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

function formatCpfInput(value) {
  const numbers = onlyDigits(value, 11);

  return numbers
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function formatCepInput(value) {
  const numbers = onlyDigits(value, 8);
  return numbers.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatPhoneInput(value) {
  const numbers = onlyDigits(value, 11);

  if (numbers.length <= 2) return numbers ? `(${numbers}` : '';

  const ddd = numbers.slice(0, 2);
  const rest = numbers.slice(2);

  if (rest.length <= 4) return `(${ddd}) ${rest}`;

  const firstPartLength = numbers.length > 10 ? 5 : 4;
  const firstPart = rest.slice(0, firstPartLength);
  const secondPart = rest.slice(firstPartLength);

  return secondPart ? `(${ddd}) ${firstPart}-${secondPart}` : `(${ddd}) ${firstPart}`;
}

function formatDecimalInput(value) {
  const text = String(value || '').replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const [integerPart, ...decimalParts] = text.split(',');
  const integer = integerPart.slice(0, 4);
  const decimal = decimalParts.join('').slice(0, 2);

  return decimalParts.length ? `${integer},${decimal}` : integer;
}

function normalizeNumber(value) {
  const text = String(value || '').trim().replace(',', '.');
  if (!text) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function formatNumberForInput(value) {
  if (value === null || value === undefined || value === '') return '';

  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);

  return String(number).replace('.', ',');
}

function formatImcValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';

  return number.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 1,
  });
}

function calculateImcNumber(heightValue, weightValue) {
  const heightCm = normalizeNumber(heightValue);
  const weightKg = normalizeNumber(weightValue);

  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;

  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

function formatDateInput(value) {
  const text = String(value || '').trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  const numbers = onlyDigits(text, 8);

  return numbers
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

function buildIsoDate(year, month, day) {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const date = new Date(yearNumber, monthNumber - 1, dayNumber);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (
    yearNumber < 1900 ||
    date.getFullYear() !== yearNumber ||
    date.getMonth() !== monthNumber - 1 ||
    date.getDate() !== dayNumber ||
    date > today
  ) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

function isValidCpf(value) {
  const cpf = onlyDigits(value, 11);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf.charAt(index)) * (10 - index);
  }

  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cpf.charAt(9))) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf.charAt(index)) * (11 - index);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;

  return remainder === Number(cpf.charAt(10));
}

function normalizeDateForSave(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return buildIsoDate(year, month, day);
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return buildIsoDate(year, month, day);
  }

  return undefined;
}

function buildEditableProfileForm(patient) {
  return {
    ...EMPTY_PROFILE_FORM,
    nome_completo: patient?.nome_completo || '',
    cpf_paciente: formatCpfInput(patient?.cpf_paciente || ''),
    email_pac: patient?.email_pac || patient?.email || '',
    telefone: formatPhoneInput(patient?.telefone || ''),
    data_nascimento: formatDateInput(patient?.data_nascimento || ''),
    sexo_biologico: patient?.sexo_biologico || '',
    cep: formatCepInput(patient?.cep || ''),
    logradouro: patient?.logradouro || '',
    numero: patient?.numero || '',
    bairro: patient?.bairro || '',
    cidade: patient?.cidade || '',
    uf: (patient?.uf || '').toUpperCase(),
  };
}

function buildProfilePatch(form) {
  return {
    nome_completo: form.nome_completo.trim() || null,
    cpf_paciente: onlyDigits(form.cpf_paciente, 11) || null,
    email_pac: form.email_pac.trim().toLowerCase() || null,
    telefone: onlyDigits(form.telefone, 11) || null,
    data_nascimento: normalizeDateForSave(form.data_nascimento),
    sexo_biologico: form.sexo_biologico.trim() || null,
    cep: onlyDigits(form.cep, 8) || null,
    logradouro: form.logradouro.trim() || null,
    numero: form.numero.trim() || null,
    bairro: form.bairro.trim() || null,
    cidade: form.cidade.trim() || null,
    uf: form.uf.trim().toUpperCase() || null,
  };
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value || '').trim();
}

function splitListText(value) {
  return ensureArray(value);
}

function buildFullAddressText(form) {
  const streetParts = [
    form.logradouro.trim(),
    form.numero.trim(),
  ].filter(Boolean);
  const cityState = buildCityStateText(form);
  const cep = formatCepInput(form.cep);
  const addressParts = [
    streetParts.length ? streetParts.join(', ') : '',
    form.bairro.trim(),
    cityState,
    cep,
  ].filter(Boolean);

  return addressParts.join(' - ');
}

function inferDiabetesStatus(onboarding, patient) {
  if (onboarding?.diabetes_status) return onboarding.diabetes_status;
  if (onboarding?.diabetes === 'Não' || onboarding?.diabetes === 'Sim') return onboarding.diabetes;
  if (onboarding?.tipo_diabetes || onboarding?.diabetes_tipo) return 'Sim';

  const clinicalText = [
    listToText(onboarding?.condicoes),
    patient?.comorbidades_texto,
    patient?.objetivo_principal_consulta,
  ]
    .join(' ')
    .toLowerCase();

  return clinicalText.includes('diabetes') ? 'Sim' : '';
}

function buildDiabetesDisplay(status, type) {
  if (status === 'Não') return 'Não';
  if (status === 'Sim' && type) return `Sim - ${type}`;
  if (status === 'Sim') return 'Sim';
  return '';
}

function buildEditableClinicalForm(patient) {
  const onboarding = getOnboardingAnswers(patient);
  const diabetesStatus = inferDiabetesStatus(onboarding, patient);
  const diabetesType = onboarding?.tipo_diabetes || onboarding?.diabetes_tipo || '';
  const altura = formatNumberForInput(patient?.altura_cm);
  const peso = formatNumberForInput(patient?.peso_atual_kg);
  const calculatedImc = calculateImcNumber(altura, peso);
  const storedImc = patient?.imc_calculado;

  return {
    ...EMPTY_CLINICAL_FORM,
    objetivos: listToText(onboarding?.objetivos) || String(patient?.objetivo_principal_consulta || '').trim(),
    condicoes: listToText(onboarding?.condicoes) || String(patient?.comorbidades_texto || '').trim(),
    situacoes: listToText(onboarding?.situacoes),
    procedimentos: listToText(onboarding?.procedimentos),
    procedimento_outros: String(onboarding?.procedimento_outros || '').trim(),
    diabetes: buildDiabetesDisplay(diabetesStatus, diabetesType),
    diabetes_status: diabetesStatus,
    diabetes_tipo: diabetesType,
    nivel_atividade_fisica_atual: patient?.nivel_atividade_fisica_atual || '',
    qualidade_sono_media: patient?.qualidade_sono_media || '',
    altura_cm: altura,
    peso_atual_kg: peso,
    imc_calculado: formatImcValue(calculatedImc || storedImc),
    alergias_texto: patient?.alergias_texto || '',
    comorbidades_texto: patient?.comorbidades_texto || listToText(onboarding?.condicoes),
    historico_familiar_doencas: patient?.historico_familiar_doencas || '',
  };
}

function createClinicalFieldErrors() {
  return CLINICAL_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: '',
    }),
    {}
  );
}

function validateClinicalField(fieldKey, form) {
  const value = String(form[fieldKey] || '').trim();

  switch (fieldKey) {
    case 'altura_cm': {
      const height = normalizeNumber(value);
      return value && (!height || height < 50 || height > 260)
        ? 'Digite uma altura válida em cm.'
        : '';
    }
    case 'peso_atual_kg': {
      const weight = normalizeNumber(value);
      return value && (!weight || weight < 2 || weight > 500)
        ? 'Digite um peso válido em kg.'
        : '';
    }
    default:
      return '';
  }
}

function getClinicalFieldErrors(form) {
  return CLINICAL_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: validateClinicalField(field.key, form),
    }),
    {}
  );
}

function buildClinicalPatch(form, patient) {
  const imc = calculateImcNumber(form.altura_cm, form.peso_atual_kg);
  const rawConditions = splitListText(form.condicoes);
  const hasDiabetesCondition = rawConditions.some((item) => item.toLowerCase() === 'diabetes');
  const condicoes =
    form.diabetes_status === 'Sim' && !hasDiabetesCondition
      ? [...rawConditions, 'Diabetes']
      : form.diabetes_status === 'Não'
        ? rawConditions.filter((item) => item.toLowerCase() !== 'diabetes')
        : rawConditions;
  const onboarding = {
    ...getOnboardingAnswers(patient),
    objetivos: splitListText(form.objetivos),
    condicoes,
    situacoes: splitListText(form.situacoes),
    procedimentos: splitListText(form.procedimentos),
    procedimento_outros: form.procedimento_outros.trim(),
    diabetes_status: form.diabetes_status || null,
    tipo_diabetes: form.diabetes_tipo || null,
  };

  return {
    onboarding_respostas: onboarding,
    objetivo_principal_consulta: form.objetivos.trim() || null,
    comorbidades_texto: form.comorbidades_texto.trim() || listToText(condicoes) || null,
    historico_familiar_doencas: form.historico_familiar_doencas.trim() || null,
    nivel_atividade_fisica_atual: form.nivel_atividade_fisica_atual.trim() || null,
    qualidade_sono_media: form.qualidade_sono_media.trim() || null,
    altura_cm: normalizeNumber(form.altura_cm),
    peso_atual_kg: normalizeNumber(form.peso_atual_kg),
    imc_calculado: imc,
    alergias_texto: form.alergias_texto.trim() || null,
  };
}

function createProfileFieldErrors() {
  return PATIENT_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: '',
    }),
    {}
  );
}

function validateProfileField(fieldKey, form) {
  const value = String(form[fieldKey] || '').trim();

  switch (fieldKey) {
    case 'nome_completo':
      return value && value.split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : '';
    case 'cpf_paciente':
      return value && !isValidCpf(value) ? 'Digite um CPF válido.' : '';
    case 'email_pac':
      return value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase())
        ? 'Digite um e-mail válido.'
        : '';
    case 'telefone': {
      const phoneDigits = onlyDigits(value, 11);
      return phoneDigits && phoneDigits.length < 10
        ? 'Digite um telefone com DDD.'
        : '';
    }
    case 'data_nascimento':
      return value && normalizeDateForSave(value) === undefined
        ? 'Digite uma data válida no formato DD/MM/AAAA.'
        : '';
    case 'cep': {
      const cepDigits = onlyDigits(value, 8);
      return cepDigits && cepDigits.length !== 8 ? 'Digite um CEP com 8 dígitos.' : '';
    }
    case 'uf':
      return value && value.length !== 2 ? 'Digite a UF com 2 letras.' : '';
    default:
      return '';
  }
}

function getProfileFieldErrors(form) {
  return PATIENT_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: validateProfileField(field.key, form),
    }),
    {}
  );
}

function hasProfileErrors(errors) {
  return Object.values(errors).some(Boolean);
}

function buildCityStateText(form) {
  const city = form.cidade.trim();
  const uf = form.uf.trim().toUpperCase();

  if (city && uf) return `${city}/${uf}`;
  return city || uf || '';
}

function SectionCard({ children, onLayout, style }) {
  return <View onLayout={onLayout} style={[styles.sectionCard, style]}>{children}</View>;
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DrilldownHeader({ title, helper, open, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.drilldownHeader}>
      <View style={styles.drilldownHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHelper}>{helper}</Text>
      </View>

      <Ionicons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={patientTheme.colors.primaryDark}
      />
    </TouchableOpacity>
  );
}

export default function PacientePerfilScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const fallbackName = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);

  const [paciente, setPaciente] = useState(usuarioLogado || null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({
    patient: false,
    clinical: false,
  });
  const [profileForm, setProfileForm] = useState(() => buildEditableProfileForm(usuarioLogado || {}));
  const [savedProfileForm, setSavedProfileForm] = useState(() =>
    buildEditableProfileForm(usuarioLogado || {})
  );
  const [profileFieldErrors, setProfileFieldErrors] = useState(createProfileFieldErrors);
  const [focusedProfileField, setFocusedProfileField] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [clinicalForm, setClinicalForm] = useState(() => buildEditableClinicalForm(usuarioLogado || {}));
  const [savedClinicalForm, setSavedClinicalForm] = useState(() =>
    buildEditableClinicalForm(usuarioLogado || {})
  );
  const [clinicalFieldErrors, setClinicalFieldErrors] = useState(createClinicalFieldErrors);
  const [focusedClinicalField, setFocusedClinicalField] = useState('');
  const [savingClinical, setSavingClinical] = useState(false);
  const [clinicalFeedback, setClinicalFeedback] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFeedback, setCepFeedback] = useState(null);
  const [emailVerificationVisible, setEmailVerificationVisible] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailVerificationError, setEmailVerificationError] = useState('');
  const [emailVerificationLoading, setEmailVerificationLoading] = useState(false);
  const [emailPendingVerification, setEmailPendingVerification] = useState('');
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [diabetesModalVisible, setDiabetesModalVisible] = useState(false);
  const [diabetesTypeModalVisible, setDiabetesTypeModalVisible] = useState(false);
  const [objectiveModalVisible, setObjectiveModalVisible] = useState(false);
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [situationModalVisible, setSituationModalVisible] = useState(false);
  const [procedureModalVisible, setProcedureModalVisible] = useState(false);
  const lastFetchedCepRef = useRef(onlyDigits(usuarioLogado?.cep || '', 8));
  const {
    scrollViewRef,
    registerScrollContainer,
    registerFieldLayout,
    scrollToField,
  } = useKeyboardAwareScroll({ topOffset: 95 });

  useEffect(() => {
    let active = true;

    async function carregarPerfil() {
      try {
        setLoading(true);

        const registro = await fetchPatientById(patientId, {
          patientContext: usuarioLogado,
          currentPatient: paciente,
        });
        const onboardingLocal = await getPatientLocalOnboardingData(registro || usuarioLogado);
        const registroComOnboarding = mergePatientOnboardingData(
          registro || usuarioLogado || null,
          onboardingLocal
        );

        if (active) {
          setPaciente(registroComOnboarding || usuarioLogado || null);
        }
      } catch (error) {
        console.log('Erro ao carregar perfil do paciente:', error);

        if (active) {
          const onboardingLocal = await getPatientLocalOnboardingData(usuarioLogado);
          setPaciente(mergePatientOnboardingData(usuarioLogado, onboardingLocal) || usuarioLogado || null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    carregarPerfil();

    return () => {
      active = false;
    };
  }, [patientId, usuarioLogado]);

  useEffect(() => {
    const nextForm = buildEditableProfileForm(paciente || {});
    const nextClinicalForm = buildEditableClinicalForm(paciente || {});

    setProfileForm(nextForm);
    setSavedProfileForm(nextForm);
    setProfileFieldErrors(createProfileFieldErrors());
    setClinicalForm(nextClinicalForm);
    setSavedClinicalForm(nextClinicalForm);
    setClinicalFieldErrors(createClinicalFieldErrors());
    setCepFeedback(null);
    lastFetchedCepRef.current = onlyDigits(nextForm.cep, 8);
  }, [paciente]);

  useEffect(() => {
    let active = true;
    const cepDigits = onlyDigits(profileForm.cep, 8);

    if (cepDigits.length < 8) {
      setCepFeedback(null);
      setCepLoading(false);
      return undefined;
    }

    if (cepDigits.length !== 8 || cepDigits === lastFetchedCepRef.current) {
      return undefined;
    }

    const timeout = setTimeout(async () => {
      lastFetchedCepRef.current = cepDigits;
      setCepLoading(true);
      setCepFeedback(null);

      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await response.json();

        if (!active) return;

        if (data.erro) {
          setCepFeedback({ type: 'error', message: 'CEP não encontrado.' });
          return;
        }

        setProfileForm((current) => {
          if (onlyDigits(current.cep, 8) !== cepDigits) return current;

          return {
            ...current,
            logradouro: data.logradouro || current.logradouro,
            bairro: data.bairro || current.bairro,
            cidade: data.localidade || current.cidade,
            uf: (data.uf || current.uf).toUpperCase(),
          };
        });
        setCepFeedback({ type: 'success', message: 'Endereço preenchido pelo CEP.' });
      } catch (error) {
        console.log('Erro ao buscar CEP:', error);

        if (active) {
          setCepFeedback({ type: 'error', message: 'Não foi possível buscar esse CEP agora.' });
        }
      } finally {
        if (active) {
          setCepLoading(false);
        }
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [profileForm.cep]);

  function handleProfileFieldChange(fieldKey, value) {
    const field = PATIENT_PROFILE_FIELDS.find((item) => item.key === fieldKey);
    const nextValue = field?.formatter ? field.formatter(value) : value;
    const nextForm = {
      ...profileForm,
      [fieldKey]: nextValue,
    };

    setProfileForm(nextForm);
    setProfileFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateProfileField(fieldKey, nextForm),
    }));
    setProfileFeedback(null);

    if (fieldKey !== 'cep') {
      return;
    }

    setCepFeedback(null);
  }

  function focusProfileField(fieldKey) {
    setFocusedProfileField(fieldKey);
    scrollToField(`profile-${fieldKey}`);
  }

  function blurProfileField(fieldKey) {
    setFocusedProfileField((current) => (current === fieldKey ? '' : current));
    setProfileFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateProfileField(fieldKey, profileForm),
    }));
  }

  function selectGenderOption(option) {
    handleProfileFieldChange('sexo_biologico', option);
    setGenderModalVisible(false);
  }

  function getNormalizedProfileEmail(form = profileForm) {
    return form.email_pac.trim().toLowerCase();
  }

  function hasEmailChanged() {
    return getNormalizedProfileEmail(profileForm) !== getNormalizedProfileEmail(savedProfileForm);
  }

  function validateProfileFormBeforeSave() {
    const errors = getProfileFieldErrors(profileForm);
    const emailChanged = hasEmailChanged();

    if (emailChanged && !getNormalizedProfileEmail()) {
      errors.email_pac = 'Informe o e-mail.';
    }

    setProfileFieldErrors(errors);

    if (hasProfileErrors(errors)) {
      setProfileFeedback({
        type: 'error',
        message: 'Revise os campos destacados antes de salvar.',
      });
      return false;
    }

    return true;
  }

  async function persistProfileData() {
    try {
      setSavingProfile(true);
      setProfileFeedback(null);

      const updatedPatient = await updatePatientProfile({
        patientId,
        currentPatient: paciente,
        patientContext: usuarioLogado,
        patch: buildProfilePatch(profileForm),
      });

      setPaciente(updatedPatient);
      setProfileFeedback({ type: 'success', message: 'Dados atualizados com sucesso.' });
    } catch (error) {
      console.log('Erro ao salvar dados do paciente:', error);
      setProfileFeedback({
        type: 'error',
        message: 'Não foi possível salvar os dados agora. Tente novamente.',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function requestEmailVerification({ resend = false } = {}) {
    const emailToVerify = getNormalizedProfileEmail();

    try {
      setEmailVerificationLoading(true);
      setEmailVerificationError('');
      setProfileFeedback(null);
      setEmailPendingVerification(emailToVerify);
      setEmailVerificationCode('');
      setEmailVerificationVisible(true);

      await solicitarCodigoValidacaoEmailCadastro({
        role: 'Paciente',
        email: emailToVerify,
      });

      if (resend) {
        setEmailVerificationError('');
      }
    } catch (error) {
      const message = error?.message || 'Não foi possível enviar o código de validação.';
      setEmailVerificationError(message);
      setProfileFeedback({ type: 'error', message });
    } finally {
      setEmailVerificationLoading(false);
    }
  }

  async function saveProfileData() {
    if (!validateProfileFormBeforeSave()) return;

    if (hasEmailChanged()) {
      await requestEmailVerification();
      return;
    }

    await persistProfileData();
  }

  function cancelEmailVerification() {
    setEmailVerificationVisible(false);
    setEmailVerificationCode('');
    setEmailVerificationError('');
    setEmailPendingVerification('');
    setEmailVerificationLoading(false);
  }

  async function resendEmailVerificationCode() {
    await requestEmailVerification({ resend: true });
  }

  async function confirmEmailVerificationCode() {
    const code = emailVerificationCode.replace(/\D/g, '');
    const currentEmail = getNormalizedProfileEmail();
    const emailToVerify = emailPendingVerification || currentEmail;

    if (code.length !== 6) {
      setEmailVerificationError('Digite o código de 6 dígitos enviado por e-mail.');
      return;
    }

    if (currentEmail !== emailToVerify) {
      setEmailVerificationError(
        'O e-mail do formulário mudou. Solicite um novo código para validar o e-mail atual.'
      );
      return;
    }

    try {
      setEmailVerificationLoading(true);
      setEmailVerificationError('');

      await confirmarCodigoValidacaoEmailCadastro({
        role: 'Paciente',
        email: emailToVerify,
        code,
      });

      setEmailVerificationVisible(false);
      setEmailVerificationCode('');
      setEmailVerificationError('');
      setEmailPendingVerification('');

      await persistProfileData();
    } catch (error) {
      setEmailVerificationError(
        error?.message || 'Código inválido. Confira o código enviado por e-mail.'
      );
    } finally {
      setEmailVerificationLoading(false);
    }
  }

  function handleClinicalFieldChange(fieldKey, value) {
    const field = CLINICAL_PROFILE_FIELDS.find((item) => item.key === fieldKey);
    const nextValue = field?.formatter ? field.formatter(value) : value;
    const nextForm = {
      ...clinicalForm,
      [fieldKey]: nextValue,
    };
    const imc = calculateImcNumber(
      fieldKey === 'altura_cm' ? nextValue : nextForm.altura_cm,
      fieldKey === 'peso_atual_kg' ? nextValue : nextForm.peso_atual_kg
    );
    nextForm.imc_calculado = formatImcValue(imc);

    setClinicalForm(nextForm);
    setClinicalFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateClinicalField(fieldKey, nextForm),
    }));
    setClinicalFeedback(null);
  }

  function focusClinicalField(fieldKey) {
    setFocusedClinicalField(fieldKey);
    scrollToField(`clinical-${fieldKey}`);
  }

  function blurClinicalField(fieldKey) {
    setFocusedClinicalField((current) => (current === fieldKey ? '' : current));
    setClinicalFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateClinicalField(fieldKey, clinicalForm),
    }));
  }

  function validateClinicalFormBeforeSave() {
    const errors = getClinicalFieldErrors(clinicalForm);
    setClinicalFieldErrors(errors);

    if (hasProfileErrors(errors)) {
      setClinicalFeedback({
        type: 'error',
        message: 'Revise os campos clínicos destacados antes de salvar.',
      });
      return false;
    }

    return true;
  }

  async function saveClinicalData() {
    if (!validateClinicalFormBeforeSave()) return;

    try {
      setSavingClinical(true);
      setClinicalFeedback(null);

      const updatedPatient = await updatePatientProfile({
        patientId,
        currentPatient: paciente,
        patientContext: usuarioLogado,
        patch: buildClinicalPatch(clinicalForm, paciente || {}),
      });

      setPaciente(updatedPatient);
      setClinicalFeedback({ type: 'success', message: 'Dados clínicos atualizados com sucesso.' });
    } catch (error) {
      console.log('Erro ao salvar dados clínicos do paciente:', error);
      setClinicalFeedback({
        type: 'error',
        message: 'Não foi possível salvar os dados clínicos agora. Tente novamente.',
      });
    } finally {
      setSavingClinical(false);
    }
  }

  function selectDiabetesStatus(status) {
    if (status === 'Não') {
      const condicoes = splitListText(clinicalForm.condicoes)
        .filter((item) => item.toLowerCase() !== 'diabetes')
        .join(', ');
      const nextForm = {
        ...clinicalForm,
        condicoes,
        diabetes: 'Não',
        diabetes_status: 'Não',
        diabetes_tipo: '',
      };

      setClinicalForm(nextForm);
      setClinicalFeedback(null);
      setDiabetesModalVisible(false);
      setDiabetesTypeModalVisible(false);
      return;
    }

    setDiabetesModalVisible(false);
    setDiabetesTypeModalVisible(true);
  }

  function selectDiabetesType(type) {
    const condicoes = splitListText(clinicalForm.condicoes);
    const nextCondicoes = condicoes.some((item) => item.toLowerCase() === 'diabetes')
      ? condicoes
      : [...condicoes, 'Diabetes'];
    const nextForm = {
      ...clinicalForm,
      condicoes: nextCondicoes.join(', '),
      diabetes: buildDiabetesDisplay('Sim', type),
      diabetes_status: 'Sim',
      diabetes_tipo: type,
    };

    setClinicalForm(nextForm);
    setClinicalFeedback(null);
    setDiabetesTypeModalVisible(false);
  }

  function toggleClinicalSelection(fieldKey, option) {
    const fieldOptions = {
      objetivos: { options: ONBOARDING_OBJECTIVE_OPTIONS, max: ONBOARDING_OBJECTIVE_MAX },
      condicoes: { options: ONBOARDING_CONDITION_OPTIONS, noneOption: ONBOARDING_CONDITION_NONE },
      situacoes: { options: ONBOARDING_SITUATION_OPTIONS, noneOption: ONBOARDING_SITUATION_NONE },
      procedimentos: { options: ONBOARDING_PROCEDURE_OPTIONS, noneOption: ONBOARDING_PROCEDURE_NONE },
    };
    const config = fieldOptions[fieldKey];
    if (!config) return;

    const currentSelection = ensureArray(clinicalForm[fieldKey]);
    const isSelected = currentSelection.includes(option);
    let nextSelection = [];

    if (config.noneOption && option === config.noneOption) {
      nextSelection = isSelected ? [] : [option];
    } else {
      const withoutNone = config.noneOption
        ? currentSelection.filter((item) => item !== config.noneOption)
        : currentSelection;

      if (isSelected) {
        nextSelection = withoutNone.filter((item) => item !== option);
      } else if (config.max && withoutNone.length >= config.max) {
        nextSelection = withoutNone;
      } else {
        nextSelection = [...withoutNone, option];
      }
    }

    setClinicalForm((current) => ({
      ...current,
      [fieldKey]: nextSelection.join(', '),
      ...(fieldKey === 'procedimentos' && option === ONBOARDING_PROCEDURE_NONE
        ? { procedimento_outros: '' }
        : {}),
    }));
  }

  function closeClinicalModal(fieldKey) {
    if (fieldKey === 'objetivos') return setObjectiveModalVisible(false);
    if (fieldKey === 'condicoes') return setConditionModalVisible(false);
    if (fieldKey === 'situacoes') return setSituationModalVisible(false);
    if (fieldKey === 'procedimentos') return setProcedureModalVisible(false);
  }

  function toggleSection(sectionKey) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  const sections = useMemo(() => buildPatientProfileSections(paciente || {}), [paciente]);
  const nomePaciente = profileForm.nome_completo || paciente?.nome_completo || fallbackName;
  const isProfileFormDirty = useMemo(
    () => JSON.stringify(profileForm) !== JSON.stringify(savedProfileForm),
    [profileForm, savedProfileForm]
  );
  const isClinicalFormDirty = useMemo(
    () => JSON.stringify(clinicalForm) !== JSON.stringify(savedClinicalForm),
    [clinicalForm, savedClinicalForm]
  );
  const heroInlineDetails = useMemo(
    () =>
      [
        formatCpfInput(profileForm.cpf_paciente),
        formatPhoneInput(profileForm.telefone),
        profileForm.data_nascimento,
        buildFullAddressText(profileForm),
      ].filter((item) => String(item || '').trim()),
    [profileForm]
  );
  const isClinicalSelectFocused = (fieldKey) => {
    if (fieldKey === 'diabetes') return diabetesModalVisible || diabetesTypeModalVisible;
    if (fieldKey === 'objetivos') return objectiveModalVisible;
    if (fieldKey === 'condicoes') return conditionModalVisible;
    if (fieldKey === 'situacoes') return situationModalVisible;
    if (fieldKey === 'procedimentos') return procedureModalVisible;
    return false;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'web' && styles.webScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
        <SectionCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(nomePaciente || 'P').trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>{nomePaciente}</Text>
              <Text style={styles.heroEmail}>
                {profileForm.email_pac || paciente?.email_pac || usuarioLogado?.email || 'E-mail não informado'}
              </Text>
              {heroInlineDetails.length ? (
                <Text style={styles.heroInlineDetails} numberOfLines={3}>
                  {heroInlineDetails.join('  •  ')}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.heroBadgeText}>Perfil clínico protegido</Text>
          </View>
        </SectionCard>

        {sections.map((section) => (
          <SectionCard
            key={section.key}
            onLayout={section.key === 'patient' ? registerScrollContainer : undefined}
            style={styles.profileSection}
          >
            <DrilldownHeader
              title={section.title}
              helper={section.helper}
              open={openSections[section.key]}
              onPress={() => toggleSection(section.key)}
            />

            {openSections[section.key] ? (
              section.key === 'patient' ? (
                <View style={styles.editForm} onLayout={registerScrollContainer}>
                  {PATIENT_PROFILE_FIELDS.map((field) => (
                    <View
                      key={field.key}
                      onLayout={registerFieldLayout(`profile-${field.key}`)}
                      style={styles.editField}
                    >
                      <Text style={styles.infoLabel}>{field.label}</Text>
                      {field.type === 'select' ? (
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => setGenderModalVisible(true)}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            profileFieldErrors[field.key] ? styles.profileInputError : null,
                            genderModalVisible ? styles.profileInputFocused : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !profileForm[field.key] ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {profileForm[field.key] || field.placeholder}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : (
                        <TextInput
                          value={profileForm[field.key]}
                          onBlur={() => blurProfileField(field.key)}
                          onChangeText={(value) => handleProfileFieldChange(field.key, value)}
                          onFocus={() => focusProfileField(field.key)}
                          placeholder={field.placeholder}
                          placeholderTextColor={patientTheme.colors.textMuted}
                          keyboardType={field.keyboardType || 'default'}
                          autoCapitalize={field.autoCapitalize || 'sentences'}
                          maxLength={field.maxLength}
                          style={[
                            styles.profileInput,
                            profileFieldErrors[field.key] ? styles.profileInputError : null,
                            focusedProfileField === field.key ? styles.profileInputFocused : null,
                          ]}
                        />
                      )}

                      {profileFieldErrors[field.key] ? (
                        <Text style={styles.fieldErrorText}>{profileFieldErrors[field.key]}</Text>
                      ) : null}

                      {field.key === 'cep' && (cepLoading || cepFeedback) ? (
                        <View style={styles.cepStatus}>
                          {cepLoading ? (
                            <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                          ) : null}
                          {cepFeedback ? (
                            <Text
                              style={[
                                styles.statusText,
                                cepFeedback.type === 'error' ? styles.statusTextError : null,
                              ]}
                            >
                              {cepFeedback.message}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ))}

                  {profileFeedback ? (
                    <Text
                      style={[
                        styles.formFeedback,
                        profileFeedback.type === 'error' ? styles.formFeedbackError : null,
                      ]}
                    >
                      {profileFeedback.message}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={!isProfileFormDirty || savingProfile}
                    onPress={saveProfileData}
                    style={[
                      styles.saveProfileButton,
                      (!isProfileFormDirty || savingProfile) && styles.saveProfileButtonDisabled,
                    ]}
                  >
                    {savingProfile ? (
                      <ActivityIndicator color={patientTheme.colors.onPrimary} />
                    ) : (
                      <Text style={styles.saveProfileButtonText}>Salvar dados</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : section.key === 'clinical' ? (
                <View style={styles.editForm} onLayout={registerScrollContainer}>
                  {CLINICAL_PROFILE_FIELDS.map((field) => (
                    <View
                      key={field.key}
                      onLayout={registerFieldLayout(`clinical-${field.key}`)}
                      style={styles.editField}
                    >
                      <Text style={styles.infoLabel}>{field.label}</Text>

                      {field.type === 'diabetes' ? (
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => setDiabetesModalVisible(true)}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            clinicalFieldErrors[field.key] ? styles.profileInputError : null,
                            isClinicalSelectFocused(field.key) ? styles.profileInputFocused : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !clinicalForm[field.key] ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {clinicalForm[field.key] || field.placeholder}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : field.key === 'objetivos' || field.key === 'condicoes' || field.key === 'situacoes' || field.key === 'procedimentos' ? (
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => {
                            if (field.key === 'objetivos') return setObjectiveModalVisible(true);
                            if (field.key === 'condicoes') return setConditionModalVisible(true);
                            if (field.key === 'situacoes') return setSituationModalVisible(true);
                            if (field.key === 'procedimentos') return setProcedureModalVisible(true);
                          }}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            clinicalFieldErrors[field.key] ? styles.profileInputError : null,
                            isClinicalSelectFocused(field.key) ? styles.profileInputFocused : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !clinicalForm[field.key] ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {clinicalForm[field.key] || field.placeholder}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : (
                        <TextInput
                          value={clinicalForm[field.key]}
                          onBlur={() => blurClinicalField(field.key)}
                          onChangeText={(value) => handleClinicalFieldChange(field.key, value)}
                          onFocus={() => focusClinicalField(field.key)}
                          placeholder={field.placeholder}
                          placeholderTextColor={patientTheme.colors.textMuted}
                          keyboardType={field.keyboardType || 'default'}
                          autoCapitalize={field.autoCapitalize || 'sentences'}
                          editable={!field.readOnly}
                          multiline={field.multiline}
                          style={[
                            styles.profileInput,
                            field.multiline ? styles.profileTextArea : null,
                            field.readOnly ? styles.profileInputReadOnly : null,
                            clinicalFieldErrors[field.key] ? styles.profileInputError : null,
                            focusedClinicalField === field.key ? styles.profileInputFocused : null,
                          ]}
                        />
                      )}

                      {clinicalFieldErrors[field.key] ? (
                        <Text style={styles.fieldErrorText}>{clinicalFieldErrors[field.key]}</Text>
                      ) : null}
                    </View>
                  ))}

                  {clinicalFeedback ? (
                    <Text
                      style={[
                        styles.formFeedback,
                        clinicalFeedback.type === 'error' ? styles.formFeedbackError : null,
                      ]}
                    >
                      {clinicalFeedback.message}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={!isClinicalFormDirty || savingClinical}
                    onPress={saveClinicalData}
                    style={[
                      styles.saveProfileButton,
                      (!isClinicalFormDirty || savingClinical) && styles.saveProfileButtonDisabled,
                    ]}
                  >
                    {savingClinical ? (
                      <ActivityIndicator color={patientTheme.colors.onPrimary} />
                    ) : (
                      <Text style={styles.saveProfileButtonText}>Salvar dados clínicos</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.infoList}>
                  {section.rows.map((row) => (
                    <InfoRow key={`${section.key}-${row.label}`} label={row.label} value={row.value} />
                  ))}
                </View>
              )
            ) : null}
          </SectionCard>
        ))}

        <View style={styles.footerSpace} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={genderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGenderModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setGenderModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Gênero</Text>
                <Text style={styles.emailModalText}>Como você se identifica?</Text>

                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectGenderOption(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {profileForm.sexo_biologico === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={diabetesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiabetesModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDiabetesModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Diabetes</Text>
                <Text style={styles.emailModalText}>Você possui diagnóstico de diabetes?</Text>

                {['Não', 'Sim'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectDiabetesStatus(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {clinicalForm.diabetes_status === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={diabetesTypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiabetesTypeModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDiabetesTypeModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Tipo de diabetes</Text>
                <Text style={styles.emailModalText}>Selecione o diagnóstico informado.</Text>

                {DIABETES_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectDiabetesType(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {clinicalForm.diabetes_tipo === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={objectiveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setObjectiveModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setObjectiveModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Objetivos nutricionais</Text>
                <Text style={styles.emailModalText}>Selecione até 3 objetivos.</Text>
                {ONBOARDING_OBJECTIVE_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.objetivos).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('objetivos', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setObjectiveModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={conditionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConditionModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setConditionModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Condições clínicas</Text>
                <Text style={styles.emailModalText}>Selecione as condições que se aplicam.</Text>
                {ONBOARDING_CONDITION_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.condicoes).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('condicoes', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setConditionModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={situationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSituationModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSituationModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Situações clínicas</Text>
                <Text style={styles.emailModalText}>Selecione as situações que já ocorreram.</Text>
                {ONBOARDING_SITUATION_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.situacoes).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('situacoes', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setSituationModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={procedureModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProcedureModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setProcedureModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Procedimentos clínicos</Text>
                <Text style={styles.emailModalText}>Selecione procedimentos relevantes.</Text>
                {ONBOARDING_PROCEDURE_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.procedimentos).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('procedimentos', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setProcedureModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={emailVerificationVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelEmailVerification}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.emailModalCard}>
                  <Text style={styles.emailModalTitle}>Código enviado</Text>
                  <Text style={styles.emailModalText}>
                    Digite o código de 6 dígitos enviado para{' '}
                    {emailPendingVerification || getNormalizedProfileEmail()}.
                  </Text>

                  <TextInput
                    style={[
                      styles.profileInput,
                      styles.codeInput,
                      emailVerificationError ? styles.profileInputError : null,
                    ]}
                    value={emailVerificationCode}
                    onChangeText={(value) => {
                      const code = value.replace(/\D/g, '').slice(0, 6);
                      setEmailVerificationCode(code);
                      setEmailVerificationError(
                        code && code.length < 6 ? 'Digite os 6 dígitos enviados por e-mail.' : ''
                      );
                    }}
                    placeholder="000000"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!emailVerificationLoading && !savingProfile}
                  />

                  {emailVerificationError ? (
                    <Text style={styles.codeErrorText}>{emailVerificationError}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.emailModalPrimaryButton,
                      (emailVerificationLoading || savingProfile) && styles.emailModalButtonDisabled,
                    ]}
                    onPress={confirmEmailVerificationCode}
                    disabled={emailVerificationLoading || savingProfile}
                  >
                    {emailVerificationLoading || savingProfile ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.emailModalPrimaryButtonText}>Salvar dados</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emailModalSecondaryButton}
                    onPress={resendEmailVerificationCode}
                    disabled={emailVerificationLoading || savingProfile}
                  >
                    {emailVerificationLoading ? (
                      <ActivityIndicator color={patientTheme.colors.primaryDark} />
                    ) : (
                      <Text style={styles.emailModalSecondaryButtonText}>Reenviar código</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emailModalCancelButton}
                    onPress={cancelEmailVerification}
                    disabled={emailVerificationLoading || savingProfile}
                  >
                    <Text style={styles.emailModalCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: patientTheme.colors.background,
  },
  containerWeb: {
    minHeight: '100%',
    overflow: 'visible',
  },
  keyboard: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    marginTop: 12,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    overflowX: 'hidden',
    overflowY: 'visible',
  },
  scrollContent: {
    flexGrow: 1,
    padding: patientTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 32,
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroCard: {
    marginTop: 0,
    padding: 14,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
  },
  heroCopy: {
    flex: 1,
  },
  heroName: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  heroEmail: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  heroInlineDetails: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  profileSection: {
    marginTop: 16,
  },
  drilldownHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drilldownHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHelper: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  infoList: {
    gap: 10,
    marginTop: 16,
  },
  editForm: {
    gap: 12,
    marginTop: 16,
  },
  editField: {
    gap: 6,
  },
  profileInput: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1.5,
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileInputFocused: {
    ...inputFocusBorder,
    backgroundColor: '#ffffff',
  },
  profileInputError: {
    borderColor: patientTheme.colors.danger,
  },
  profileInputReadOnly: {
    backgroundColor: '#f0f2f3',
    color: patientTheme.colors.textMuted,
  },
  profileTextArea: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  profileSelect: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileSelectText: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  profileSelectPlaceholder: {
    color: patientTheme.colors.textMuted,
  },
  fieldErrorText: {
    color: patientTheme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: -2,
  },
  cepStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statusText: {
    color: patientTheme.colors.primaryDark,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  statusTextError: {
    color: patientTheme.colors.danger,
  },
  formFeedback: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 2,
  },
  formFeedbackError: {
    color: patientTheme.colors.danger,
  },
  saveProfileButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
  },
  saveProfileButtonDisabled: {
    backgroundColor: '#c8c8c8',
  },
  saveProfileButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
  },
  infoRow: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    ...patientShadow,
  },
  infoLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 6,
  },
  footerSpace: {
    height: 10,
  },
  modalKeyboard: {
    flex: 1,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  emailModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  genderModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  genderOptionItem: {
    alignItems: 'center',
    borderBottomColor: patientTheme.colors.surfaceBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: 12,
  },
  genderOptionText: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emailModalTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  emailModalText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'center',
  },
  codeInput: {
    borderColor: patientTheme.colors.primary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  codeErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emailModalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.pill,
    marginTop: 10,
    padding: 16,
  },
  emailModalButtonDisabled: {
    opacity: 0.6,
  },
  emailModalPrimaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emailModalSecondaryButton: {
    alignItems: 'center',
    borderColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    marginTop: 10,
    padding: 16,
  },
  emailModalSecondaryButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '800',
  },
  emailModalCancelButton: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 12,
  },
  emailModalCancelButtonText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
