import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import MensagemInline from '../../componentes/comum/MensagemInline';
import DrilldownOpcoesPortal from '../../componentes/comum/DrilldownOpcoesPortal';
import {
  CampoFocoModal,
  ScrollModalPacienteTeclado,
  useFocoCampoModalPaciente,
} from '../../componentes/paciente/ModalPacienteComTeclado';
import { useKeyboardHeight } from '../../componentes/comum/RolagemComTeclado';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { inputFocusBorder, inputWebFocusReset } from '../../temas/temaFocoCampo';
import {
  DashboardMiniKpiCard,
  KPI_ACCENTS,
  dashboardKpiStyles,
} from '../../componentes/comum/CartaoKpiDashboard';
import {
  addGlucoseReading,
  addMedicationEntry,
  buildMonitorSeries,
  createDefaultAppState,
  fetchMedicationEntries,
  fetchPatientExperience,
  getCachedPatientExperience,
  getPatientId,
  isPatientExperienceCacheFresh,
  refreshPatientGlucoseReadings,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import { EsqueletoBloco } from '../../componentes/comum/EsqueletoCarregamento';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import {
  hasLibreLinkUpLinked,
} from '../../servicos/servicoLibreViewAutoSync';
import IconeSensorLibre from '../../componentes/paciente/IconeSensorLibre';
import CabecalhoModalPaciente from '../../componentes/paciente/CabecalhoModalPaciente';
import { LIBRE_BLUE, LIBRE_BLUE_SOFT, LIBRE_YELLOW } from '../../temas/coresLibre';
import { buscarMedicamentosAnvisa } from '../../servicos/servicoMedicamentosAnvisa';
import {
  buildGlucoseFingerprint,
  getCachedGlucoseReadings,
  isGlucoseCacheFresh,
  mergeCachedGlucoseReadings,
  prependCachedGlucoseReading,
  removeCachedGlucoseReading,
  replaceCachedGlucoseReadings,
  subscribeToGlucoseReadings,
} from '../../servicos/centralGlicose';
import {
  getCachedPatientAppState,
  replaceCachedPatientAppState,
  subscribeToPatientAppState,
} from '../../servicos/centralAppState';
import { registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import { mostrarToastPaciente } from '../../servicos/servicoToastPaciente';
import { AppLogger, MODULOS_LOG_SISTEMA } from '../../servicos/servicoLogSistema';

const rangeOptions = ['Hoje', '7 dias', '14 dias'];
const LIMITE_ALERTA_GLICEMIA_ALTA = 250;

const bolusMealOptions = ['Café da manhã', 'Almoço', 'Jantar', 'Ceia', 'Lanche'];
const BOLUS_MEAL_VALUE_TO_LABEL = {
  cafe_manha: 'Café da manhã',
  almoco: 'Almoço',
  jantar: 'Jantar',
  ceia: 'Ceia',
  lanche: 'Lanche',
  correcao: 'Correção',
  outro: 'Outro',
};
const BOLUS_APPLICATION_TYPES = [
  { id: 'refeicao', label: 'Refeição', usage: 'Antes da refeição' },
  { id: 'correcao', label: 'Correção', usage: 'Correção' },
  { id: 'refeicao_correcao', label: 'Refeição + Correção', usage: 'Antes da refeição e correção' },
];

function mapUsageToBolusApplicationType(usage) {
  const hit = BOLUS_APPLICATION_TYPES.find((x) => x.usage === String(usage || '').trim());
  return hit?.id || 'refeicao_correcao';
}

const glucoseTypeOptions = [
  'Antes do Café da Manhã',
  'Depois do Café da Manhã',
  'Antes do Almoço',
  'Depois do Almoço',
  'Antes do Jantar',
  'Depois do Jantar',
  'Antes de dormir/ Madrugada',
  'Outro Momento',
];

const medicationUnitOptions = [
  'Comprimido',
  'Cápsula',
  'Drágea',
  'Dose',
  'Gota',
  'mL',
  'UI',
  'Ampola',
  'Sachê',
  'Xarope',
  'Creme',
  'Pomada',
  'Spray',
];

const medicationUnitMeta = {
  Comprimido: {
    quantityLabel: 'Quantidade de comprimidos',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Informe quantos comprimidos serão tomados.',
    inputType: 'integer',
  },
  'Cápsula': {
    quantityLabel: 'Quantidade de cápsulas',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Informe quantas cápsulas serão tomadas.',
    inputType: 'integer',
  },
  'Drágea': {
    quantityLabel: 'Quantidade de drágeas',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Informe quantas drágeas serão tomadas.',
    inputType: 'integer',
  },
  Dose: {
    quantityLabel: 'Quantidade de doses',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Use quando a orientação vier em dose.',
    inputType: 'decimal',
  },
  Gota: {
    quantityLabel: 'Quantidade de gotas',
    quantityPlaceholder: 'Ex: 20',
    hint: 'Informe o número de gotas.',
    inputType: 'integer',
  },
  mL: {
    quantityLabel: 'Volume em mL',
    quantityPlaceholder: 'Ex: 5',
    hint: 'Informe o volume em mililitros.',
    inputType: 'decimal',
  },
  UI: {
    quantityLabel: 'Quantidade em UI',
    quantityPlaceholder: 'Ex: 10',
    hint: 'Use para unidades internacionais, comum em insulinas.',
    inputType: 'integer',
  },
  Ampola: {
    quantityLabel: 'Quantidade de ampolas',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Informe quantas ampolas foram usadas.',
    inputType: 'integer',
  },
  'Sachê': {
    quantityLabel: 'Quantidade de sachês',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Informe quantos sachês serão usados.',
    inputType: 'integer',
  },
  Xarope: {
    quantityLabel: 'Volume do xarope',
    quantityPlaceholder: 'Ex: 10 mL',
    hint: 'Prefira informar o volume em mL.',
    inputType: 'decimal',
  },
  Creme: {
    quantityLabel: 'Quantidade aplicada',
    quantityPlaceholder: 'Ex: 1 aplicação',
    hint: 'Informe aplicações ou quantidade orientada.',
    inputType: 'decimal',
  },
  Pomada: {
    quantityLabel: 'Quantidade aplicada',
    quantityPlaceholder: 'Ex: 1 aplicação',
    hint: 'Informe aplicações ou quantidade orientada.',
    inputType: 'decimal',
  },
  Spray: {
    quantityLabel: 'Quantidade de jatos',
    quantityPlaceholder: 'Ex: 2',
    hint: 'Informe quantos jatos foram usados.',
    inputType: 'integer',
  },
};

const insulinCategoryOptions = [
  {
    id: 'basal',
    title: 'Insulina basal',
    detail: '(fixa)',
    helper: 'Categoria usada para cobertura basal, em geral com rotina fixa diária.',
  },
  {
    id: 'prandial',
    title: 'Insulina bolus',
    detail: '(para refeição/correção)',
    helper: 'Categoria usada antes de refeição ou para correção da glicemia.',
  },
  {
    id: 'inhaled',
    title: 'Insulina inalável',
    detail: '(ação ultrarrápida)',
    helper: 'Insulina humana inalada de ação ultrarrápida, usada conforme prescrição.',
  },
];

const insulinTypeOptions = {
  basal: [
    'NPH',
    'Glargina U100',
    'Glargina U300',
    'Detemir',
    'Degludeca',
    'Icodec',
  ],
  prandial: [
    'Regular',
    'Lispro',
    'Asparte',
    'Glulisina',
    'Asparte ultrarrápida',
  ],
  inhaled: ['Insulina humana inalável'],
};

const basalInsulinOptions = [
  {
    label: 'Basaglar — Glargina (U-100)',
    brand: 'Basaglar',
    molecule: 'Glargina',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
  },
  {
    label: 'Densulin N — NPH (U-100)',
    brand: 'Densulin N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco'],
  },
  {
    label: 'Glargilin — Glargina (U-100)',
    brand: 'Glargilin',
    molecule: 'Glargina',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
  },
  {
    label: 'Humulin N — NPH (U-100)',
    brand: 'Humulin N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta'],
  },
  {
    label: 'Insulatard — NPH (U-100)',
    brand: 'Insulatard',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta', 'Cartucho/refil'],
  },
  {
    label: 'Insulex N — NPH (U-100)',
    brand: 'Insulex N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco'],
  },
  {
    label: 'Insuman Basal — NPH (U-100)',
    brand: 'Insuman Basal',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta'],
  },
  {
    label: 'Lantus — Glargina (U-100)',
    brand: 'Lantus',
    molecule: 'Glargina',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta', 'Cartucho/refil'],
  },
  {
    label: 'Levemir — Detemir (U-100)',
    brand: 'Levemir',
    molecule: 'Detemir',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
  },
  {
    label: 'Novolin N — NPH (U-100)',
    brand: 'Novolin N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta', 'Cartucho/refil'],
  },
  {
    label: 'Semglee — Glargina (U-100)',
    brand: 'Semglee',
    molecule: 'Glargina',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta'],
  },
  {
    label: 'Toujeo — Glargina (U-300)',
    brand: 'Toujeo',
    molecule: 'Glargina',
    concentration: 'U-300',
    actionClass: 'Ultra longa / longa duração concentrada',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta'],
  },
  {
    label: 'Tresiba — Degludeca (U-100)',
    brand: 'Tresiba',
    molecule: 'Degludeca',
    concentration: 'U-100',
    actionClass: 'Ultra longa duração',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
  },
  {
    label: 'Tresiba — Degludeca (U-200)',
    brand: 'Tresiba',
    molecule: 'Degludeca',
    concentration: 'U-200',
    actionClass: 'Ultra longa duração',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta'],
  },
];

const insulinUsageOptions = {
  basal: ['Rotina da manhã', 'Rotina da noite', 'Semanal', 'Outro horário fixo'],
  prandial: ['Antes da refeição', 'Correção', 'Antes da refeição e correção'],
  inhaled: ['Antes da refeição', 'Correção', 'Antes da refeição e correção'],
};

function parsePatientOnboardingAnswers(patient) {
  const raw = patient?.onboarding_respostas;

  if (!raw) return {};
  if (typeof raw === 'object') return raw;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return {};
  }
}

function normalizeInsulinCategoryDefault(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) return '';
  if (normalized.includes('basal')) return 'basal';
  if (
    normalized.includes('prandial') ||
    normalized.includes('bolus') ||
    normalized.includes('refeicao') ||
    normalized.includes('correc')
  ) {
    return 'prandial';
  }
  if (normalized.includes('inal')) return 'inhaled';

  return '';
}

function resolveBasalInsulinOption(rawType) {
  const normalized = normalizeText(rawType);
  if (!normalized) return null;

  return (
    basalInsulinOptions.find((option) => {
      const label = normalizeText(option.label);
      const brand = normalizeText(option.brand);
      return (
        normalized === label ||
        normalized === brand ||
        label.includes(normalized) ||
        normalized.includes(brand)
      );
    }) || null
  );
}

function mapTherapyDeviceValueToLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const map = {
    caneta: 'Caneta',
    seringa_frasco: 'Seringa + frasco',
    cartucho_refil: 'Cartucho/refil',
    inalador: 'Inalador',
  };

  return map[raw] || raw;
}

function getActiveBasalTherapyPlan(patient) {
  const onboarding = parsePatientOnboardingAnswers(patient);
  const plans = Array.isArray(onboarding?.terapia_farmacologica_insulinas)
    ? onboarding.terapia_farmacologica_insulinas
    : [];

  return (
    plans.find((plan) => {
      const cat = normalizeText(plan?.categoria_funcional || '');
      const st = normalizeText(plan?.status || 'ativo');
      return cat.includes('basal') && !st.includes('inativo');
    }) || null
  );
}

function mergeBasalSchedulesFromPatient(patient) {
  const onboarding = parsePatientOnboardingAnswers(patient);
  const fromProfiles = Array.isArray(onboarding?.insulin_profiles?.basal?.schedules)
    ? onboarding.insulin_profiles.basal.schedules
    : [];
  const basalPlan = getActiveBasalTherapyPlan(patient);
  const fromTherapy = Array.isArray(basalPlan?.tabela_horarios)
    ? basalPlan.tabela_horarios.map((row) => ({
        dia_semana: String(row?.dia_semana || '').trim(),
        horario: String(row?.horario || '').trim(),
        dose: row?.dose ?? '',
        observacao: String(row?.observacao || '').trim(),
      }))
    : [];

  const merged = [...fromTherapy];
  for (const row of fromProfiles) {
    const normalizedRow = {
      ...row,
      dia_semana: String(row?.dia_semana || '').trim(),
      horario: String(row?.horario || '').trim(),
      observacao: String(row?.observacao || '').trim(),
    };
    const dup = merged.some(
      (item) =>
        String(item?.dia_semana || '').trim() === normalizedRow.dia_semana &&
        String(item?.horario || '').slice(0, 5) === normalizedRow.horario.slice(0, 5) &&
        String(item?.dose ?? '').trim() === String(normalizedRow.dose ?? '').trim()
    );
    if (!dup) merged.push(normalizedRow);
  }
  return merged;
}

function getPatientInsulinDefaults(patient) {
  const onboarding = parsePatientOnboardingAnswers(patient);
  const profiles = onboarding?.insulin_profiles || {};
  const legacyCategory = normalizeInsulinCategoryDefault(onboarding?.insulin_category_default);
  const basalTherapyPlan = getActiveBasalTherapyPlan(patient);
  const basalProfileOption = resolveBasalInsulinOption(
    String(basalTherapyPlan?.marca || profiles?.basal?.type || '').trim()
  );
  const legacyProfile = {
    type: String(onboarding?.insulin_type_default || '').trim(),
    usage: String(onboarding?.insulin_usage_default || '').trim(),
    dose: String(onboarding?.insulin_dose_default || '').trim(),
    notes: String(onboarding?.insulin_notes_default || '').trim(),
  };

  return {
    therapy: String(onboarding?.insulinoterapia_atual || '').trim(),
    basal: {
      category: 'basal',
      type: String(
        basalProfileOption?.label ||
          basalTherapyPlan?.marca ||
          profiles?.basal?.type ||
          (legacyCategory === 'basal' ? legacyProfile.type : '')
      ).trim(),
      device: String(
        mapTherapyDeviceValueToLabel(basalTherapyPlan?.dispositivo) ||
          profiles?.basal?.device ||
          ''
      ).trim(),
      usage: String(
        basalTherapyPlan?.tabela_horarios?.[0]?.observacao ||
          profiles?.basal?.usage ||
          (legacyCategory === 'basal' ? legacyProfile.usage : '')
      ).trim(),
      dose: String(
        basalTherapyPlan?.dose ||
          basalTherapyPlan?.tabela_horarios?.[0]?.dose ||
          profiles?.basal?.dose ||
          (legacyCategory === 'basal' ? legacyProfile.dose : '')
      ).trim(),
      notes: String(
        basalTherapyPlan?.observacoes ||
          profiles?.basal?.notes ||
          (legacyCategory === 'basal' ? legacyProfile.notes : '')
      ).trim(),
      schedules: mergeBasalSchedulesFromPatient(patient),
    },
    prandial: {
      category: 'prandial',
      type: String(profiles?.bolus?.type || (legacyCategory === 'prandial' ? legacyProfile.type : '')).trim(),
      usage: String(profiles?.bolus?.usage || (legacyCategory === 'prandial' ? legacyProfile.usage : '')).trim(),
      dose: String(profiles?.bolus?.dose || (legacyCategory === 'prandial' ? legacyProfile.dose : '')).trim(),
      notes: String(profiles?.bolus?.notes || (legacyCategory === 'prandial' ? legacyProfile.notes : '')).trim(),
      schedules: Array.isArray(profiles?.bolus?.schedules) ? profiles.bolus.schedules : [],
    },
  };
}

const eventIcons = {
  meal: {
    library: 'material',
    icon: 'food-apple-outline',
    color: patientTheme.colors.primaryDark,
  },
  activity: {
    library: 'ion',
    icon: 'walk-outline',
    color: patientTheme.colors.warning,
  },
  medication: {
    library: 'material',
    icon: 'pill',
    color: '#ffffff',
    backgroundColor: patientTheme.colors.info,
  },
  sleep: {
    library: 'ion',
    icon: 'moon-outline',
    color: '#8d9ae8',
  },
  water: {
    library: 'ion',
    icon: 'water-outline',
    color: '#6aaaf0',
  },
};

function EventBadge({ event, compact = false }) {
  const meta = eventIcons[event];

  if (!meta) return null;

  return (
    <View
      style={[
        styles.eventBadge,
        meta.backgroundColor && { backgroundColor: meta.backgroundColor },
        compact && styles.eventBadgeCompact,
        compact && meta.backgroundColor && { backgroundColor: meta.backgroundColor },
      ]}
    >
      {meta.library === 'material' ? (
        <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
      ) : (
        <Ionicons name={meta.icon} size={14} color={meta.color} />
      )}
    </View>
  );
}

function getGlucoseStatus(value) {
  if (!value) {
    return {
      label: 'Sem leitura',
      helper: 'Registre uma glicemia para iniciar o acompanhamento.',
      color: '#5f656a',
      cardColor: patientTheme.colors.surface,
      softColor: '#ffffff',
      textColor: patientTheme.colors.text,
      mutedTextColor: patientTheme.colors.textMuted,
      badgeColor: '#6f7478',
      icon: 'remove-outline',
    };
  }

  if (value < 54) {
    return {
      label: 'Muito grave',
      helper: 'Glicose muito baixa. Siga imediatamente o plano de hipoglicemia orientado pela equipe de saúde.',
      color: '#E50914',
      cardColor: '#E50914',
      softColor: 'rgba(255,255,255,0.24)',
      textColor: '#ffffff',
      mutedTextColor: 'rgba(255,255,255,0.82)',
      badgeColor: '#b80710',
      icon: 'alert-circle-outline',
    };
  }

  if (value < 70) {
    return {
      label: 'Baixo',
      helper: 'Glicose abaixo da faixa ideal. Observe sintomas e siga sua orientação de correção.',
      color: '#f28c28',
      cardColor: '#f28c28',
      softColor: 'rgba(255,255,255,0.24)',
      textColor: '#ffffff',
      mutedTextColor: 'rgba(255,255,255,0.82)',
      badgeColor: '#d36f12',
      icon: 'trending-down-outline',
    };
  }

  if (value <= 180) {
    return {
      label: 'Ideal',
      helper: 'Leitura dentro da faixa de segurança usada no acompanhamento.',
      color: patientTheme.colors.primaryDark,
      cardColor: patientTheme.colors.primary,
      softColor: 'rgba(255,255,255,0.24)',
      textColor: patientTheme.colors.text,
      mutedTextColor: 'rgba(47,52,56,0.76)',
      badgeColor: '#0E8A5A',
      icon: 'checkmark-circle-outline',
    };
  }

  if (value <= 250) {
    return {
      label: 'Alto leve',
      helper: 'Observe refeição, estresse, medicação e hidratação próximos a esse horário.',
      color: '#FFD600',
      cardColor: '#FFD600',
      softColor: 'rgba(255,255,255,0.24)',
      textColor: '#ffffff',
      mutedTextColor: 'rgba(255,255,255,0.82)',
      badgeColor: '#e6bd00',
      icon: 'trending-up-outline',
    };
  }

  return {
    label: 'Grave',
    helper: 'Valor elevado. Siga o plano combinado com sua equipe de saúde.',
    color: '#E50914',
    cardColor: '#E50914',
    softColor: 'rgba(255,255,255,0.24)',
    textColor: '#ffffff',
    mutedTextColor: 'rgba(255,255,255,0.82)',
    badgeColor: '#b80710',
    icon: 'alert-circle-outline',
  };
}

async function mostrarPopupAlertaGlicemiaAlta(reading) {
  const titulo = 'Alerta de glicose alta';
  const mensagem = `Glicemia de ${reading?.value} mg/dL registrada. Siga o plano orientado pela equipe de saúde.`;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
    try {
      let permission = window.Notification.permission;
      if (permission === 'default') {
        permission = await window.Notification.requestPermission();
      }

      if (permission === 'granted') {
        new window.Notification(titulo, {
          body: mensagem,
          tag: `glicnutri-alerta-glicemia-${reading?.id || Date.now()}`,
        });
        return;
      }
    } catch (_error) {
      // Se o navegador bloquear notificacao, o alerta interno continua funcionando.
    }
  }

  mostrarToastPaciente({
    tipo: 'aviso',
    texto: titulo,
    subtexto: mensagem,
  });
}

function GlucoseLineChart({ series }) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 300;
  const chartPaddingHorizontal = 44;
  const chartPaddingTop = 34;
  const chartPaddingBottom = 38;
  const chartMarks = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600];
  const chartContentWidth = Math.max(
    chartWidth,
    chartPaddingHorizontal * 2 + Math.max(series.length - 1, 1) * 62
  );
  const min = 50;
  const max = 600;
  const rangeSize = Math.max(max - min, 1);
  const contentWidth = Math.max(chartContentWidth - chartPaddingHorizontal * 2, 1);
  const contentHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const getTopForValue = (value) =>
    chartPaddingTop +
    (1 - (Math.min(Math.max(value, min), max) - min) / rangeSize) * contentHeight;
  const safeRangeTop = getTopForValue(180);
  const safeRangeHeight = getTopForValue(70) - safeRangeTop;
  const points = series.map((item, index) => {
    const x =
      chartPaddingHorizontal +
      (series.length === 1 ? contentWidth : (index / (series.length - 1)) * contentWidth);
    const y = getTopForValue(item.value);

    return { ...item, x, y };
  });

  return (
    <View
      onLayout={({ nativeEvent }) => setChartWidth(nativeEvent.layout.width)}
      style={styles.lineChartViewport}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lineChartScrollContent}
      >
      <View style={[styles.lineChart, { width: chartContentWidth }]}>
      <View style={[styles.safeRangeBand, { top: safeRangeTop, height: safeRangeHeight }]} />

      {chartMarks.map((lineValue) => {
        const top = getTopForValue(lineValue);

        return (
          <View key={lineValue} style={[styles.chartGridLine, { top }]}>
            <Text style={styles.chartGridLabel}>{lineValue}</Text>
          </View>
        );
      })}

      {chartWidth > 0
        ? points.slice(1).map((point, index) => {
            const previous = points[index];
            const dx = point.x - previous.x;
            const dy = point.y - previous.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = `${Math.atan2(dy, dx)}rad`;
            const status = getGlucoseStatus(point.value);

            return (
              <View
                key={`${point.label}-${point.value}-${index}`}
                style={[
                  styles.lineSegment,
                  {
                    backgroundColor: status.color,
                    left: previous.x + dx / 2 - length / 2,
                    top: previous.y + dy / 2 - 1.5,
                    width: length,
                    transform: [{ rotate: angle }],
                  },
                ]}
              />
            );
          })
        : null}

      {chartWidth > 0
        ? points.map((point, index) => (
            <Text
              key={`value-${point.label}-${point.value}-${index}`}
              style={[
                styles.linePointValue,
                {
                  left: Math.min(Math.max(point.x - 22, 4), chartContentWidth - 48),
                  top: Math.max(point.y - 24, 6),
                },
              ]}
            >
              {point.value}
            </Text>
          ))
        : null}

      {chartWidth > 0
        ? points.map((point) => {
            const status = getGlucoseStatus(point.value);

            return (
              <View
                key={`${point.label}-${point.date}-${point.time}`}
                style={[
                  styles.linePoint,
                  {
                    backgroundColor: status.color,
                    borderColor: status.color,
                    left: point.x - 7,
                    top: point.y - 7,
                  },
                ]}
              >
                {point.event ? <EventBadge event={point.event} compact /> : null}
              </View>
            );
          })
        : null}

      <View style={styles.chartLabelsRow}>
        {points.map((item, index) => (
          <Text
            key={`label-${item.label}-${item.value}-${index}`}
            style={[
              styles.lineChartLabel,
              {
                left: Math.min(Math.max(item.x - 24, 4), chartContentWidth - 52),
              },
            ]}
          >
            {item.label}
          </Text>
        ))}
      </View>
      </View>
      </ScrollView>
    </View>
  );
}

function buildLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildLocalTimeString(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

function buildOptimisticReading(patientId, value, options = {}) {
  const now = new Date();

  return {
    id: `manual-${now.getTime()}`,
    patientId,
    value: Number(value) || 0,
    date: options.date || buildLocalDateString(now),
    time: options.time || buildLocalTimeString(now),
    glucoseType: options.glucoseType || '',
  };
}

function parseGlucoseInput(value) {
  const match = String(value || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function formatGlucoseInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4);
}

function parseLooseNumber(value) {
  const normalized = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : Number.NaN;
}

function extractTargetGlucoseFromText(text) {
  const match = String(text || '').match(/\b(?:alvo|meta|objetivo)\s*[:=]?\s*(\d{2,3})\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeRefeicaoLabel(ref) {
  const s = String(ref ?? '').trim();
  if (!s) return '';
  return BOLUS_MEAL_VALUE_TO_LABEL[s] || s;
}

function refeicaoMatches(rowRefeicao, mealLabel) {
  const a = normalizeText(normalizeRefeicaoLabel(rowRefeicao));
  const b = normalizeText(normalizeRefeicaoLabel(mealLabel));
  return Boolean(a && b && a === b);
}

function tipoDoseEhCarbo(t) {
  const x = normalizeText(t);
  return x.includes('carbo') || x.includes('dose_carboidrato');
}

function tipoDoseEhFixa(t) {
  const x = normalizeText(t);
  return x.includes('fixa') || x.includes('dose_fixa');
}

function tipoDoseEhCorrecao(t) {
  const x = normalizeText(t);
  return x.includes('correcao') || x.includes('correc') || x.includes('dose_correcao');
}

function firstMealFromSchedules(schedules) {
  const rows = Array.isArray(schedules) ? schedules : [];
  for (const row of rows) {
    const hit = bolusMealOptions.find((m) => refeicaoMatches(row?.refeicao, m));
    if (hit) return hit;
  }
  if (rows[0]?.refeicao) {
    const lbl = normalizeRefeicaoLabel(rows[0].refeicao);
    return bolusMealOptions.find((m) => refeicaoMatches(lbl, m)) || lbl;
  }
  return 'Almoço';
}

function mergeBolusSchedulesFromPatient(patient) {
  const onboarding = parsePatientOnboardingAnswers(patient);
  const fromProfiles = Array.isArray(onboarding?.insulin_profiles?.bolus?.schedules)
    ? onboarding.insulin_profiles.bolus.schedules
    : [];

  const plans = Array.isArray(onboarding?.terapia_farmacologica_insulinas)
    ? onboarding.terapia_farmacologica_insulinas
    : [];

  const bolusPlan = plans.find((p) => {
    const cat = normalizeText(p?.categoria_funcional || '');
    const st = normalizeText(p?.status || 'ativo');
    return cat.includes('bolus') && !st.includes('inativo');
  });

  const fromTherapy = Array.isArray(bolusPlan?.tabela_horarios)
    ? bolusPlan.tabela_horarios.map((row) => ({
        refeicao: normalizeRefeicaoLabel(row?.refeicao),
        horario: String(row?.horario || '').trim(),
        dose: row?.dose ?? '',
        tipo_dose: String(row?.tipo_dose ?? '').trim(),
      }))
    : [];

  const merged = [...fromTherapy];
  for (const row of fromProfiles) {
    const normalizedRow = {
      ...row,
      refeicao: normalizeRefeicaoLabel(row?.refeicao),
      tipo_dose: String(row?.tipo_dose ?? '').trim(),
      horario: String(row?.horario || '').trim(),
    };
    const dup = merged.some(
      (m) =>
        refeicaoMatches(m.refeicao, normalizedRow.refeicao) &&
        normalizeText(String(m.tipo_dose || '')) === normalizeText(String(normalizedRow.tipo_dose || '')) &&
        String(m.horario || '').slice(0, 5) === String(normalizedRow.horario || '').slice(0, 5)
    );
    if (!dup) merged.push(normalizedRow);
  }
  return merged;
}

function parseTimeToMinutes(timeStr) {
  const t = String(timeStr || '').trim().slice(0, 8);
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function pickBolusSchedule(schedules, mealLabel) {
  const rows = Array.isArray(schedules) ? schedules : [];
  const matched = rows.filter((item) => refeicaoMatches(item?.refeicao, mealLabel));
  if (!matched.length) return { primary: null, correction: null, all: [] };

  const primary =
    matched.find((r) => tipoDoseEhCarbo(r?.tipo_dose)) ||
    matched.find((r) => tipoDoseEhFixa(r?.tipo_dose)) ||
    matched[0];
  const correction = matched.find((r) => tipoDoseEhCorrecao(r?.tipo_dose)) || null;
  return { primary, correction, all: matched };
}

function computeBolusSuggestion(params) {
  const {
    applicationType,
    mealLabel,
    glucoseMgDl,
    carbsG,
    schedules,
    notesText,
    manualTarget,
  } = params;

  const wantsMeal = applicationType === 'refeicao' || applicationType === 'refeicao_correcao';
  const wantsCorrection = applicationType === 'correcao' || applicationType === 'refeicao_correcao';

  const selectedMeal = wantsMeal ? mealLabel : 'Correção';
  const mealSchedule = pickBolusSchedule(schedules, selectedMeal);
  const correctionSchedule = pickBolusSchedule(schedules, 'Correção');
  const schedulePrimary = applicationType === 'correcao' ? correctionSchedule.primary : mealSchedule.primary;
  const scheduleCorrection =
    applicationType === 'correcao'
      ? correctionSchedule.correction
      : mealSchedule.correction || correctionSchedule.primary || correctionSchedule.correction;

  const dosePrimary = parseLooseNumber(schedulePrimary?.dose);
  const doseCorr = parseLooseNumber(scheduleCorrection?.dose);

  const targetFromNotes = extractTargetGlucoseFromText(notesText);
  const targetFromManual = parseLooseNumber(manualTarget);
  const target =
    targetFromNotes != null
      ? targetFromNotes
      : Number.isFinite(targetFromManual) && targetFromManual > 0
        ? targetFromManual
        : null;

  let doseMeal = 0;
  let doseCorrection = 0;
  const warnings = [];

  if (wantsMeal) {
    if (!schedulePrimary) {
      warnings.push('Configure o bolus no Perfil (refeição, dose e tipo) para calcular automaticamente.');
    } else if (tipoDoseEhCarbo(schedulePrimary?.tipo_dose)) {
      if (!Number.isFinite(dosePrimary) || dosePrimary <= 0) {
        warnings.push('Relação insulina/carboidrato inválida no perfil.');
      } else if (!Number.isFinite(carbsG) || carbsG < 0) {
        warnings.push('Informe os carboidratos (g) para calcular a dose da refeição.');
      } else {
        doseMeal = carbsG / dosePrimary;
      }
    } else if (tipoDoseEhFixa(schedulePrimary?.tipo_dose)) {
      if (!Number.isFinite(dosePrimary) || dosePrimary <= 0) {
        warnings.push('Dose fixa inválida no perfil.');
      } else {
        doseMeal = dosePrimary;
      }
    } else {
      warnings.push('Tipo de dose do perfil não permite cálculo automático para refeição.');
    }
  }

  if (wantsCorrection) {
    if (!Number.isFinite(glucoseMgDl) || glucoseMgDl <= 0) {
      warnings.push('Informe a glicemia atual para calcular correção.');
    } else if (target == null) {
      warnings.push('Meta glicêmica não definida. Informe a meta ou coloque no texto do bolus (ex.: \"alvo 100\").');
    } else {
      const delta = glucoseMgDl - target;
      if (delta <= 0) {
        doseCorrection = 0;
      } else if (tipoDoseEhCorrecao(scheduleCorrection?.tipo_dose) && Number.isFinite(doseCorr) && doseCorr > 0) {
        doseCorrection = delta / doseCorr;
      } else {
        warnings.push('Para correção automática, configure \"Dose de correção\" na linha \"Correção\" do perfil.');
      }
    }
  }

  const round1 = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0);
  doseMeal = round1(doseMeal);
  doseCorrection = round1(doseCorrection);
  const total = round1(doseMeal + doseCorrection);

  const ratioLabel =
    tipoDoseEhCarbo(schedulePrimary?.tipo_dose) && Number.isFinite(dosePrimary) && dosePrimary > 0
      ? `1 UI : ${String(dosePrimary).replace('.', ',')} g`
      : '—';
  const corrLabel =
    tipoDoseEhCorrecao(scheduleCorrection?.tipo_dose) && Number.isFinite(doseCorr) && doseCorr > 0
      ? `${String(doseCorr).replace('.', ',')} mg/dL por 1 UI`
      : '—';

  const scheduleTime = String(
    (applicationType === 'correcao' ? correctionSchedule : mealSchedule).primary?.horario || ''
  ).slice(0, 5);

  return {
    target,
    ratioLabel,
    corrLabel,
    doseMeal,
    doseCorrection,
    doseTotal: total,
    scheduleTime,
    warnings,
  };
}

function formatMedicineQuantityInput(value, inputType = 'decimal') {
  const rawValue = String(value || '');

  if (inputType === 'integer') {
    return rawValue.replace(/\D/g, '').slice(0, 4);
  }

  const normalizedValue = rawValue.replace(',', '.').replace(/[^\d.]/g, '');
  const [integerPart = '', decimalPart = ''] = normalizedValue.split('.');
  const safeInteger = integerPart.replace(/\D/g, '').slice(0, 4);
  const safeDecimal = decimalPart.replace(/\D/g, '').slice(0, 2);

  if (normalizedValue.includes('.')) {
    return safeDecimal ? `${safeInteger},${safeDecimal}` : `${safeInteger},`;
  }

  return safeInteger;
}

function formatManualDateInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatManualTimeInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeManualDateInput(value) {
  const rawValue = String(value || '').trim();
  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return '';
}

function normalizeManualTimeInput(value) {
  const rawValue = String(value || '').trim().replace(/h$/i, '');
  const match = rawValue.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) return '';

  const [, hours, minutes, seconds = '00'] = match;
  return `${hours}:${minutes}:${seconds}`;
}

function isValidManualDate(value) {
  const normalizedDate = normalizeManualDateInput(value);

  if (!normalizedDate) return false;

  const [year, month, day] = normalizedDate.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

function isValidManualTime(value) {
  const normalizedTime = normalizeManualTimeInput(value);

  if (!normalizedTime) return false;

  const [hours, minutes, seconds] = normalizedTime.split(':').map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
}

function formatDateForDisplay(value) {
  const normalizedDate = normalizeManualDateInput(value);
  if (!normalizedDate) return '--/--/----';

  const [year, month, day] = normalizedDate.split('-');
  return `${day}/${month}/${year}`;
}

export default function PacienteMonitoramentoScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const manualModalScrollRef = useRef(null);
  const manualModalFoco = useFocoCampoModalPaciente(manualModalScrollRef);
  const medicineFormScrollRef = useRef(null);
  const medicineFormFoco = useFocoCampoModalPaciente(medicineFormScrollRef);
  const medicineSearchScrollRef = useRef(null);
  const medicineSearchFoco = useFocoCampoModalPaciente(medicineSearchScrollRef);
  const medicationScrollRef = useRef(null);
  const medicationFoco = useFocoCampoModalPaciente(medicationScrollRef);
  const modalTecladoAltura = useKeyboardHeight();
  const estiloOverlayModalTeclado =
    modalTecladoAltura > 0 ? { paddingBottom: modalTecladoAltura } : null;
  const estiloConteudoScrollModalTeclado =
    modalTecladoAltura > 0 ? { paddingBottom: 24 } : null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const canResolvePatient = useMemo(
    () =>
      Boolean(
        patientId ||
        usuarioLogado?.id_paciente_uuid ||
        usuarioLogado?.cpf_paciente ||
        usuarioLogado?.email_pac ||
        usuarioLogado?.email ||
        usuarioLogado?.id
      ),
    [patientId, usuarioLogado]
  );
  const monitoramentoFetchLimits = useMemo(
    () => mesclarLimitesDadosPaciente('monitoramento'),
    []
  );
  const cachedMonitoramentoInicial = useMemo(
    () => (patientId ? getCachedPatientExperience(patientId, monitoramentoFetchLimits) : null),
    [patientId, monitoramentoFetchLimits]
  );
  const cachedMonitoramentoAppStateInicial = useMemo(
    () => (patientId ? getCachedPatientAppState(patientId) : null),
    [patientId]
  );
  const cachedMonitoramentoGlucoseInicial = useMemo(
    () => (patientId ? getCachedGlucoseReadings(patientId) : []),
    [patientId]
  );
  const monitoramentoCacheQuente = Boolean(
    cachedMonitoramentoInicial ||
      cachedMonitoramentoAppStateInicial ||
      cachedMonitoramentoGlucoseInicial.length
  );
  const [range, setRange] = useState('Hoje');
  const [loading, setLoading] = useState(!monitoramentoCacheQuente);
  const [savingGlucose, setSavingGlucose] = useState(false);
  const [savingMedication, setSavingMedication] = useState(false);
  const [libreLinkLinked, setLibreLinkLinked] = useState(false);
  const [newGlucoseValue, setNewGlucoseValue] = useState('');
  const [manualChoiceVisible, setManualChoiceVisible] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualMeasurementType, setManualMeasurementType] = useState('current');
  const [manualMeasurementDate, setManualMeasurementDate] = useState('');
  const [manualMeasurementTime, setManualMeasurementTime] = useState('');
  const [manualGlucoseType, setManualGlucoseType] = useState('');
  const [glucoseTypeDropdownVisible, setGlucoseTypeDropdownVisible] = useState(false);
  const [focusedManualField, setFocusedManualField] = useState(null);
  const [glucoseConfirmVisible, setGlucoseConfirmVisible] = useState(false);
  const [medicationChoiceVisible, setMedicationChoiceVisible] = useState(false);
  const [insulinChoiceVisible, setInsulinChoiceVisible] = useState(false);
  const [insulinTimingChoiceVisible, setInsulinTimingChoiceVisible] = useState(false);
  const [medicationModalVisible, setMedicationModalVisible] = useState(false);
  const [medicineFormVisible, setMedicineFormVisible] = useState(false);
  const [medicineSearchVisible, setMedicineSearchVisible] = useState(false);
  const [medicineUnitVisible, setMedicineUnitVisible] = useState(false);
  const [medicineOptions, setMedicineOptions] = useState([]);
  const [loadingMedicineOptions, setLoadingMedicineOptions] = useState(false);
  const [medicineOptionsLoaded, setMedicineOptionsLoaded] = useState(false);
  const [medicationKind, setMedicationKind] = useState('');
  const [medicationLabel, setMedicationLabel] = useState('');
  const [insulinCategory, setInsulinCategory] = useState('');
  const [insulinType, setInsulinType] = useState('');
  const [insulinUsage, setInsulinUsage] = useState('');
  const [insulinDose, setInsulinDose] = useState('');
  const [insulinMeasurementType, setInsulinMeasurementType] = useState('current');
  const [insulinDate, setInsulinDate] = useState('');
  const [insulinTime, setInsulinTime] = useState('');
  const [insulinNotes, setInsulinNotes] = useState('');
  const [insulinDevice, setInsulinDevice] = useState('');
  const [insulinTypeVisible, setInsulinTypeVisible] = useState(false);
  const [insulinUsageVisible, setInsulinUsageVisible] = useState(false);
  const [insulinDeviceVisible, setInsulinDeviceVisible] = useState(false);
  const [bolusApplicationType, setBolusApplicationType] = useState('refeicao_correcao');
  const [bolusMeal, setBolusMeal] = useState('Almoço');
  const [bolusGlucoseNow, setBolusGlucoseNow] = useState('');
  const [bolusCarbs, setBolusCarbs] = useState('');
  const [bolusTargetManual, setBolusTargetManual] = useState('');
  const [bolusDoseEdited, setBolusDoseEdited] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [medicineSearchQuery, setMedicineSearchQuery] = useState('');
  const [medicineUnit, setMedicineUnit] = useState('');
  const [medicineQuantity, setMedicineQuantity] = useState('');
  const [medicineDate, setMedicineDate] = useState('');
  const [medicineTime, setMedicineTime] = useState('');
  const [medicineDays, setMedicineDays] = useState('');
  const [medicineContinuousUse, setMedicineContinuousUse] = useState(false);
  const [patient, setPatient] = useState(cachedMonitoramentoInicial?.patient || null);
  const [objectiveText, setObjectiveText] = useState(
    () => cachedMonitoramentoInicial?.clinicalObjective || ''
  );
  const [appState, setAppState] = useState(
    () =>
      cachedMonitoramentoInicial?.appState ||
      cachedMonitoramentoAppStateInicial ||
      createDefaultAppState()
  );
  const [glucoseReadings, setGlucoseReadings] = useState(() => {
    const id = cachedMonitoramentoInicial?.patient?.id_paciente_uuid || patientId;
    return mergeCachedGlucoseReadings(
      cachedMonitoramentoInicial?.glucoseReadings || [],
      id ? getCachedGlucoseReadings(id) : cachedMonitoramentoGlucoseInicial
    );
  });
  const [loadError, setLoadError] = useState(null);
  const [technicalLoadLog, setTechnicalLoadLog] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [avisoUsuario, setAvisoUsuario] = useState(null);
  const activePatientId = patient?.id_paciente_uuid || patientId || null;
  const insulinDefaults = useMemo(() => getPatientInsulinDefaults(patient), [patient]);
  const mergedBolusSchedules = useMemo(() => mergeBolusSchedulesFromPatient(patient), [patient]);

  const bolusSuggestion = useMemo(() => {
    if (insulinCategory !== 'prandial') return null;
    return computeBolusSuggestion({
      applicationType: bolusApplicationType,
      mealLabel: bolusMeal,
      glucoseMgDl: parseGlucoseInput(bolusGlucoseNow),
      carbsG: parseLooseNumber(String(bolusCarbs || '').replace(',', '.')),
      schedules: mergedBolusSchedules,
      notesText: `${insulinDefaults.prandial?.notes || ''}`,
      manualTarget: bolusTargetManual,
    });
  }, [
    insulinCategory,
    bolusApplicationType,
    bolusMeal,
    bolusGlucoseNow,
    bolusCarbs,
    bolusTargetManual,
    mergedBolusSchedules,
    insulinDefaults.prandial?.notes,
  ]);

  const bolusOverlapAlerts = useMemo(() => {
    if (insulinCategory !== 'prandial') return [];
    const entryDate =
      insulinMeasurementType === 'current'
        ? buildLocalDateString()
        : normalizeManualDateInput(insulinDate);
    const entryTimeStr =
      insulinMeasurementType === 'current'
        ? buildLocalTimeString().slice(0, 5)
        : normalizeManualTimeInput(insulinTime)?.slice(0, 5);
    const newMins = parseTimeToMinutes(entryTimeStr);
    if (!entryDate || newMins == null) return [];
    const windowMin = 120;
    const hits = (appState.medicationEntries || []).filter((e) => {
      if (String(e.insulinCategory || '') !== 'prandial') return false;
      if (e.date !== entryDate) return false;
      const em = parseTimeToMinutes(e.time);
      if (em == null) return false;
      return Math.abs(em - newMins) <= windowMin && Math.abs(em - newMins) > 0;
    });
    return hits.length
      ? ['Possível sobreposição de bolus: há outro registro de bolus próximo neste horário.']
      : [];
  }, [insulinCategory, insulinMeasurementType, insulinDate, insulinTime, appState.medicationEntries]);

  const bolusSafetyAlerts = useMemo(() => {
    if (insulinCategory !== 'prandial') return [];
    const alerts = [];
    const g = parseGlucoseInput(bolusGlucoseNow);
    if (Number.isFinite(g)) {
      if (g < 70) alerts.push('Glicemia abaixo de 70 mg/dL: avalie carboidrato antes do bolus.');
      if (g > 250) alerts.push('Glicemia acima de 250 mg/dL: confira orientação médica.');
    }
    const doseNum = parseLooseNumber(insulinDose);
    if (Number.isFinite(doseNum) && doseNum > 30) {
      alerts.push('Dose aplicada elevada: confira o valor antes de salvar.');
    }
    return alerts;
  }, [insulinCategory, bolusGlucoseNow, insulinDose]);

  const bolusAllAlerts = useMemo(
    () => [...(bolusSuggestion?.warnings || []), ...bolusOverlapAlerts, ...bolusSafetyAlerts],
    [bolusSuggestion, bolusOverlapAlerts, bolusSafetyAlerts]
  );

  const registrarLogTecnicoCarga = useCallback(
    (stage, error) => {
      const message =
        String(error?.message || error?.details || error?.hint || error || 'erro_desconhecido').trim();
      const code = String(error?.code || '').trim();
      const email = String(usuarioLogado?.email_pac || usuarioLogado?.email || '').trim() || 'sem-email';
      setTechnicalLoadLog(
        [
          `stage=${stage}`,
          `patientId=${patientId || 'sem-id'}`,
          `email=${email}`,
          code ? `code=${code}` : null,
          `message=${message}`,
        ]
          .filter(Boolean)
          .join('\n')
      );
    },
    [patientId, usuarioLogado]
  );

  const aplicarMonitoramentoExperience = useCallback(
    function aplicarMonitoramentoExperience(experience) {
      if (!experience) return;

      const patientUuid = experience.patient?.id_paciente_uuid || patientId;

      setPatient(experience.patient);
      setObjectiveText(experience.clinicalObjective);
      setAppState(experience.appState);
      replaceCachedPatientAppState(patientUuid, experience.appState);
    },
    [patientId]
  );

  const refreshGlucoseForMonitor = useCallback(async () => {
    if (!patientId) return [];

    return refreshPatientGlucoseReadings(patientId, {
      patientContext: usuarioLogado,
      glucoseLimit: monitoramentoFetchLimits.glucoseLimit || 60,
    });
  }, [monitoramentoFetchLimits.glucoseLimit, patientId, usuarioLogado]);

  const loadMonitoringData = useCallback(async (options = {}) => {
    try {
      setLoadError(null);
      setTechnicalLoadLog('');

      if (!canResolvePatient) {
        setAppState(createDefaultAppState());
        setGlucoseReadings([]);
        return;
      }

      const forceRefresh = options.forceRefresh === true;
      const cachedExperience =
        !forceRefresh && patientId
          ? getCachedPatientExperience(patientId, monitoramentoFetchLimits)
          : null;
      const cacheIsFresh =
        patientId && isPatientExperienceCacheFresh(patientId, monitoramentoFetchLimits);

      if (cachedExperience) {
        aplicarMonitoramentoExperience(cachedExperience);

        const glucoseCacheFresco =
          patientId && isGlucoseCacheFresh(patientId);

        if ((cacheIsFresh || glucoseCacheFresco) && !forceRefresh) {
          return;
        }

        if (!glucoseCacheFresco) {
          await refreshGlucoseForMonitor();
        }

        if (!cacheIsFresh) {
          fetchPatientExperience(patientId, {
            patientContext: usuarioLogado,
            ...monitoramentoFetchLimits,
          })
            .then((experience) => {
              aplicarMonitoramentoExperience(experience);
            })
            .catch((error) => {
              registrarLogTecnicoCarga('monitoramento_refresh_background', error);
              console.log('Refresh monitoramento:', error);
            });
        }
        return;
      }

      const experience = await fetchPatientExperience(patientId, {
        patientContext: usuarioLogado,
        forceRefresh,
        ...monitoramentoFetchLimits,
      });

      aplicarMonitoramentoExperience(experience);
      await refreshGlucoseForMonitor();
    } catch (error) {
      registrarLogTecnicoCarga('monitoramento_load', error);
      console.log('Erro ao carregar monitoramento:', error);
      setLoadError(
        'Não foi possível carregar o monitoramento. Verifique sua conexão com a internet e tente novamente.'
      );
    }
  }, [
    aplicarMonitoramentoExperience,
    canResolvePatient,
    monitoramentoFetchLimits,
    patientId,
    refreshGlucoseForMonitor,
    registrarLogTecnicoCarga,
    usuarioLogado,
  ]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        if (!monitoramentoCacheQuente) {
          setLoading(true);
        }
        await loadMonitoringData({ forceRefresh: false });
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [loadMonitoringData, monitoramentoCacheQuente]);

  const onRefreshMonitoramento = useCallback(async () => {
    setRefreshing(true);
    await loadMonitoringData({ forceRefresh: true });
    setRefreshing(false);
  }, [loadMonitoringData]);

  useEffect(() => {
    if (!activePatientId) return undefined;

    return subscribeToPatientAppState(activePatientId, (nextAppState) => {
      if (nextAppState) {
        setAppState(nextAppState);
      }
    });
  }, [activePatientId]);

  useEffect(() => {
    if (!activePatientId) return undefined;

    return subscribeToGlucoseReadings(activePatientId, (nextReadings) => {
      setGlucoseReadings(nextReadings);
    });
  }, [activePatientId]);

  useEffect(() => {
    if (!activePatientId) return undefined;

    let active = true;

    hasLibreLinkUpLinked(activePatientId).then((linked) => {
      if (!active) return;
      setLibreLinkLinked(linked);
    });

    return () => {
      active = false;
    };
  }, [activePatientId]);

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.openQuickRegister !== 'glucose') {
        setManualChoiceVisible(false);
      }

      if (!activePatientId) {
        return undefined;
      }

      const cacheFresco =
        isPatientExperienceCacheFresh(activePatientId, monitoramentoFetchLimits) ||
        isGlucoseCacheFresh(activePatientId);

      let active = true;

      if (!cacheFresco) {
        refreshPatientGlucoseReadings(activePatientId, {
          patientContext: usuarioLogado,
          glucoseLimit: monitoramentoFetchLimits.glucoseLimit || 60,
        }).catch(() => {});
      }

      hasLibreLinkUpLinked(activePatientId).then((linked) => {
        if (!active) return;
        setLibreLinkLinked(linked);
      });

      return () => {
        active = false;
      };
    }, [activePatientId, monitoramentoFetchLimits, patient, route?.params?.openQuickRegister, usuarioLogado])
  );

  useEffect(() => {
    if (insulinCategory !== 'basal') {
      if (insulinDevice) {
        setInsulinDevice('');
      }
      return;
    }

    const selectedOption = resolveBasalInsulinOption(insulinType);
    const allowedDevices = selectedOption?.allowedDevices || [];

    if (
      insulinDevice &&
      allowedDevices.length &&
      !allowedDevices.includes(insulinDevice)
    ) {
      setInsulinDevice('');
    }
  }, [insulinCategory, insulinDevice, insulinType]);

  useEffect(() => {
    if (insulinCategory !== 'prandial') return;
    const opt = BOLUS_APPLICATION_TYPES.find((x) => x.id === bolusApplicationType);
    if (opt) setInsulinUsage(opt.usage);
  }, [insulinCategory, bolusApplicationType]);

  useEffect(() => {
    if (insulinCategory !== 'prandial' || bolusDoseEdited) return;
    const total = bolusSuggestion?.doseTotal;
    if (Number.isFinite(total) && total > 0) {
      setInsulinDose(formatMedicineQuantityInput(String(total).replace('.', ','), 'decimal'));
    }
  }, [insulinCategory, bolusDoseEdited, bolusSuggestion]);

  useEffect(() => {
    const quickRegister = route?.params?.openQuickRegister;
    const shouldOpenMedicationChoice = route?.params?.openMedication;

    if (!quickRegister && !shouldOpenMedicationChoice) {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (quickRegister === 'glucose') {
        handleOpenManualChoice();
      } else if (quickRegister === 'insulin') {
        handleSelectMedicationKind('insulin');
      } else if (quickRegister === 'medicine') {
        handleSelectMedicationKind('medicine');
      } else if (shouldOpenMedicationChoice) {
        handleOpenMedicationChoice();
      }

      if (navigation?.setParams) {
        navigation.setParams({
          openMedication: undefined,
          openQuickRegister: undefined,
        });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [navigation, route?.params?.openMedication, route?.params?.openQuickRegister]);

  useEffect(() => {
    if (!medicineSearchVisible) return undefined;

    let active = true;
    const searchTimeout = setTimeout(async () => {
      setLoadingMedicineOptions(true);
      setMedicineOptionsLoaded(false);

      try {
        const options = await buscarMedicamentosAnvisa(medicineSearchQuery, 40);
        if (active) {
          setMedicineOptions(options);
          setMedicineOptionsLoaded(true);
        }
      } catch (error) {
        console.log('Erro ao buscar medicamentos:', error);
        if (active) {
          setMedicineOptions([]);
          setMedicineOptionsLoaded(true);
        }
      } finally {
        if (active) setLoadingMedicineOptions(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(searchTimeout);
    };
  }, [medicineSearchQuery, medicineSearchVisible]);

  const eventEntries = useMemo(
    () => [
      ...(appState.mealEntries || []).map((item) => ({
        date: item.date || new Date().toISOString().slice(0, 10),
        time: item.time,
        kind: 'meal',
      })),
      ...(appState.activityEntries || []).map((item) => ({
        date: item.date || new Date().toISOString().slice(0, 10),
        time: item.time,
        kind: 'activity',
      })),
      ...(appState.medicationEntries || []).map((item) => ({
        date: item.date || new Date().toISOString().slice(0, 10),
        time: item.time,
        kind: 'medication',
      })),
      ...(appState.symptomEntries || []).map((item) => ({
        date: item.date,
        time: item.time,
        kind: 'sleep',
      })),
    ],
    [appState]
  );

  const series = useMemo(() => {
    const baseSeries = buildMonitorSeries(glucoseReadings, range);

    return baseSeries.map((item) => {
      const matchedEvent = eventEntries.find((event) => {
        if (range === 'Hoje') {
          return event.date === item.date && String(event.time || '').slice(0, 2) === String(item.time || '').slice(0, 2);
        }

        return event.date === item.date;
      });

      return {
        ...item,
        event: matchedEvent?.kind || null,
      };
    });
  }, [eventEntries, glucoseReadings, range]);

  const metrics = useMemo(() => {
    if (!series.length) {
      return {
        avg: '--',
        variability: '--',
        gmi: '--',
        tir: '--',
      };
    }

    const values = series.map((item) => item.value);
    const avg = Math.round(values.reduce((sum, item) => sum + item, 0) / values.length);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const variability = avg ? Math.round(((max - min) / avg) * 100) : 0;
    const gmi = (3.31 + 0.02392 * avg).toFixed(1);
    const tir = Math.round(
      (values.filter((item) => item >= 70 && item <= 180).length / values.length) * 100
    );

    return {
      avg,
      variability,
      gmi,
      tir,
    };
  }, [series]);

  const latestReading = glucoseReadings[0] || null;
  const latestStatus = getGlucoseStatus(latestReading?.value);
  const parsedNewGlucose = parseGlucoseInput(newGlucoseValue);
  const hasValidNewGlucose = Number.isFinite(parsedNewGlucose) && parsedNewGlucose > 0;
  const isPreviousGlucoseEntry = manualMeasurementType === 'previous';
  const hasValidManualDate = !isPreviousGlucoseEntry || isValidManualDate(manualMeasurementDate);
  const hasValidManualTime = !isPreviousGlucoseEntry || isValidManualTime(manualMeasurementTime);
  const showInvalidManualDate =
    isPreviousGlucoseEntry && manualMeasurementDate.length === 10 && !hasValidManualDate;
  const hasSelectedGlucoseType = Boolean(manualGlucoseType);
  const canSubmitManualGlucose =
    hasValidNewGlucose && hasValidManualDate && hasValidManualTime && hasSelectedGlucoseType;
  const canSubmitMedicine =
    Boolean(medicineName) &&
    Boolean(medicineUnit) &&
    Boolean(String(medicineQuantity || '').trim()) &&
    isValidManualDate(medicineDate) &&
    isValidManualTime(medicineTime) &&
    (medicineContinuousUse || Boolean(String(medicineDays || '').trim()));
  const isPreviousInsulinEntry = insulinMeasurementType === 'previous';
  const hasValidInsulinDate = !isPreviousInsulinEntry || isValidManualDate(insulinDate);
  const hasValidInsulinTime = !isPreviousInsulinEntry || isValidManualTime(insulinTime);
  const parsedInsulinDose = parseLooseNumber(insulinDose);
  const canSubmitInsulin =
    medicationKind === 'insulin' &&
    Boolean(insulinCategory) &&
    Boolean(insulinType) &&
    Boolean(String(insulinDose || '').trim()) &&
    Number.isFinite(parsedInsulinDose) &&
    parsedInsulinDose > 0 &&
    hasValidInsulinDate &&
    hasValidInsulinTime &&
    (insulinCategory === 'basal' ? Boolean(insulinDevice) : Boolean(insulinUsage));
  const selectedMedicineUnitMeta = medicationUnitMeta[medicineUnit] || {
    quantityLabel: 'Quantidade',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Escolha a unidade para orientar o preenchimento.',
    inputType: 'decimal',
  };
  const selectedBasalInsulinOption =
    insulinCategory === 'basal'
      ? resolveBasalInsulinOption(insulinType)
      : null;
  const selectedInsulinTypeOptions =
    insulinCategory === 'basal'
      ? basalInsulinOptions.map((option) => option.label)
      : insulinTypeOptions[insulinCategory] || [];
  const selectedInsulinDeviceOptions = selectedBasalInsulinOption?.allowedDevices || [];
  const selectedInsulinUsageOptions = insulinUsageOptions[insulinCategory] || [];
  const selectedInsulinCategoryMeta =
    insulinCategoryOptions.find((option) => option.id === insulinCategory) || null;
  const configuredScheduleOptions = useMemo(() => {
    const schedules =
      insulinCategory === 'basal'
        ? insulinDefaults?.basal?.schedules || []
        : mergedBolusSchedules;

    return (Array.isArray(schedules) ? schedules : [])
      .map((item, index) => {
        const horario = String(item?.horario || '').slice(0, 5);
        const dose = item?.dose ?? null;
        const refeicao = String(item?.refeicao || '').trim();
        const tipoDose = String(item?.tipo_dose || '').trim();
        const diaSemana = String(item?.dia_semana || '').trim();

        return {
          key: `${insulinCategory}-schedule-${index}`,
          horario,
          dose: dose === null || typeof dose === 'undefined' ? '' : String(dose),
          refeicao,
          tipoDose,
          diaSemana,
        };
      })
      .filter((item) => item.horario || item.dose || item.refeicao || item.tipoDose || item.diaSemana);
  }, [insulinCategory, insulinDefaults?.basal?.schedules, mergedBolusSchedules]);
  const timeInRange = metrics.tir === '--' ? 0 : metrics.tir;
  function buildGuidedGlucoseNotification(reading, allReadings) {
    const tir = Math.round(
      (allReadings.filter((item) => item.value >= 70 && item.value <= 180).length /
        Math.max(allReadings.length, 1)) *
        100
    );
    const readingStatus = getGlucoseStatus(reading?.value);

    return {
      id: `glucose-guidance-${reading?.id || Date.now()}`,
      type: 'glucose-guidance',
      title: 'Leitura guiada',
      text: `${readingStatus.helper} A ultima leitura foi ${reading?.value} mg/dL as ${String(reading?.time || '').slice(0, 5)}. Hoje, ${tir}% das leituras analisadas ficaram na meta.`,
      createdAt: new Date().toISOString(),
    };
  }

  async function registrarAlertaGlicemiaAlta(reading) {
    if (!reading || Number(reading.value) <= LIMITE_ALERTA_GLICEMIA_ALTA) {
      return;
    }

    const complemento = `Alerta de glicemia alta | Valor: ${reading.value} mg/dL | Data: ${reading.date || ''} | Hora: ${String(reading.time || '').slice(0, 5)}`;

    await Promise.allSettled([
      registrarLogAuditoria({
        actor: patient || usuarioLogado,
        targetPatientId: activePatientId,
        action: 'alerta_glicemia_alta_gerado',
        entity: 'registro_glicemia_manual',
        entityId: reading.id,
        origin: 'monitoramento_manual',
        status: 'alerta',
        details: {
          valorMgDl: reading.value,
          limiteMgDl: LIMITE_ALERTA_GLICEMIA_ALTA,
          data: reading.date,
          hora: reading.time,
          tipoGlicemia: reading.glucoseType || manualGlucoseType || '',
        },
      }),
      AppLogger.alerta(MODULOS_LOG_SISTEMA.GLICEMIA, 'Alerta de glicemia alta', {
        usuario: patient || usuarioLogado,
        complemento,
        detalhes: {
          id: reading.id,
          valorMgDl: reading.value,
          limiteMgDl: LIMITE_ALERTA_GLICEMIA_ALTA,
          data: reading.date,
          hora: reading.time,
        },
      }),
      mostrarPopupAlertaGlicemiaAlta(reading),
    ]);
  }

  function resetMedicineForm() {
    setMedicineName('');
    setMedicineSearchQuery('');
    setMedicineUnit('');
    setMedicineQuantity('');
    setMedicineDate('');
    setMedicineTime('');
    setMedicineDays('');
    setMedicineContinuousUse(false);
    setMedicineSearchVisible(false);
    setMedicineUnitVisible(false);
  }

  function resetInsulinForm() {
    setInsulinCategory('');
    setInsulinType('');
    setInsulinUsage('');
    setInsulinDose('');
    setInsulinMeasurementType('current');
    setInsulinDate('');
    setInsulinTime('');
    setInsulinNotes('');
    setInsulinDevice('');
    setInsulinTypeVisible(false);
    setInsulinUsageVisible(false);
    setInsulinDeviceVisible(false);
    setBolusApplicationType('refeicao_correcao');
    setBolusMeal('Almoço');
    setBolusGlucoseNow('');
    setBolusCarbs('');
    setBolusTargetManual('');
    setBolusDoseEdited(false);
  }

  function applyInsulinDefaults(defaults, explicitCategory) {
    const categoryKey = explicitCategory || defaults?.category || '';
    setMedicationKind('insulin');
    setInsulinCategory(categoryKey);
    setInsulinType(
      categoryKey === 'basal' && !basalInsulinOptions.some((option) => option.label === defaults.type)
        ? ''
        : defaults.type || ''
    );
    setInsulinUsage(categoryKey === 'basal' ? '' : defaults.usage || '');
    setInsulinDose(defaults.dose || '');
    setInsulinNotes(categoryKey === 'basal' ? defaults.notes || defaults.usage || '' : defaults.notes || '');
    setInsulinDevice(categoryKey === 'basal' ? defaults.device || '' : '');
    setInsulinMeasurementType('current');
    setInsulinDate(formatDateForDisplay(buildLocalDateString()));
    setInsulinTime(formatManualTimeInput(buildLocalTimeString()));
    setInsulinTypeVisible(false);
    setInsulinUsageVisible(false);
    setInsulinDeviceVisible(false);
    if (categoryKey === 'prandial') {
      setBolusApplicationType(mapUsageToBolusApplicationType(defaults.usage));
      setBolusMeal(firstMealFromSchedules(defaults.schedules));
      setBolusGlucoseNow('');
      setBolusCarbs('');
      const tNote = extractTargetGlucoseFromText(defaults.notes);
      setBolusTargetManual(tNote != null ? String(Math.round(tNote)) : '');
      setBolusDoseEdited(false);
    }
  }

  function handleOpenManualChoice() {
    setManualChoiceVisible(true);
  }

  function handleCloseManualModal() {
    if (glucoseConfirmVisible) {
      setGlucoseConfirmVisible(false);
      return;
    }
    if (glucoseTypeDropdownVisible) {
      handleCloseGlucoseTypeModal();
      return;
    }
    setManualModalVisible(false);
    setGlucoseTypeDropdownVisible(false);
    setGlucoseConfirmVisible(false);
    setFocusedManualField(null);
  }

  function handleOpenGlucoseTypeModal() {
    setFocusedManualField('type');
    setGlucoseTypeDropdownVisible(true);
  }

  function handleCloseGlucoseTypeModal() {
    setGlucoseTypeDropdownVisible(false);
    setFocusedManualField(null);
  }

  function handleCloseMedicationModal() {
    if (insulinTypeVisible) {
      setInsulinTypeVisible(false);
      setFocusedManualField(null);
      return;
    }
    if (insulinDeviceVisible) {
      setInsulinDeviceVisible(false);
      setFocusedManualField(null);
      return;
    }
    if (insulinUsageVisible) {
      setInsulinUsageVisible(false);
      setFocusedManualField(null);
      return;
    }
    setInsulinTimingChoiceVisible(false);
    setMedicationModalVisible(false);
    setMedicationKind('');
    setMedicationLabel('');
    resetInsulinForm();
    resetMedicineForm();
    setFocusedManualField(null);
  }

  function handleCloseMedicationFlow() {
    if (medicineSearchVisible) {
      setMedicineSearchVisible(false);
      setFocusedManualField(null);
      return;
    }
    if (medicineUnitVisible) {
      setMedicineUnitVisible(false);
      setFocusedManualField(null);
      return;
    }
    setMedicationChoiceVisible(false);
    setInsulinChoiceVisible(false);
    setInsulinTimingChoiceVisible(false);
    setMedicationModalVisible(false);
    setMedicineFormVisible(false);
    setMedicationKind('');
    setMedicationLabel('');
    resetInsulinForm();
    resetMedicineForm();
    setFocusedManualField(null);
  }

  function handleOpenMedicineSearch() {
    setFocusedManualField('medicineName');
    setMedicineSearchVisible(true);
  }

  function handleCloseMedicineSearch() {
    setMedicineSearchVisible(false);
    setFocusedManualField(null);
  }

  function handleOpenMedicineUnitPicker() {
    setFocusedManualField('medicineUnit');
    setMedicineUnitVisible(true);
  }

  function handleCloseMedicineUnitPicker() {
    setMedicineUnitVisible(false);
    setFocusedManualField(null);
  }

  function handleOpenMedicationChoice() {
    setMedicationChoiceVisible(true);
    setInsulinChoiceVisible(false);
    setInsulinTimingChoiceVisible(false);
    setMedicationModalVisible(false);
    setMedicineFormVisible(false);
  }

  function handleSelectMedicationKind(kind) {
    if (kind === 'insulin') {
      setMedicationChoiceVisible(false);
      setMedicationKind('insulin');
      setInsulinChoiceVisible(true);
      return;
    }

    setMedicationKind('medicine');
    setMedicationLabel('');
    resetMedicineForm();
    setMedicineDate(formatDateForDisplay(buildLocalDateString()));
    setMedicineTime(formatManualTimeInput(buildLocalTimeString()));
    setMedicationChoiceVisible(false);
    setMedicineFormVisible(true);
  }

  function handleSelectInsulinTiming(measurementType) {
    setInsulinMeasurementType(measurementType);
    setInsulinDate(formatDateForDisplay(buildLocalDateString()));
    setInsulinTime(formatManualTimeInput(buildLocalTimeString()));
    setInsulinChoiceVisible(false);
    setInsulinTimingChoiceVisible(false);
    setMedicationModalVisible(true);
  }

  function handleSelectInsulinType(label) {
    const profileDefaults = label === 'basal' ? insulinDefaults.basal : insulinDefaults.prandial;
    const shouldUseDefaults = Boolean(
      profileDefaults?.type ||
        profileDefaults?.device ||
        profileDefaults?.usage ||
        profileDefaults?.dose ||
        profileDefaults?.notes ||
        (Array.isArray(profileDefaults?.schedules) && profileDefaults.schedules.length)
    );

    if (shouldUseDefaults) {
      applyInsulinDefaults(profileDefaults, label);
    } else {
      setMedicationKind('insulin');
      setInsulinCategory(label);
      setInsulinType('');
      setInsulinUsage('');
      setInsulinDose('');
      setInsulinNotes('');
      setInsulinDevice('');
      setInsulinDate(formatDateForDisplay(buildLocalDateString()));
      setInsulinTime(formatManualTimeInput(buildLocalTimeString()));
      setInsulinTypeVisible(false);
      setInsulinUsageVisible(false);
      setInsulinDeviceVisible(false);
      if (label === 'prandial') {
        const d = insulinDefaults.prandial;
        setBolusApplicationType(mapUsageToBolusApplicationType(d.usage));
        setBolusMeal(firstMealFromSchedules(d.schedules));
        const tNote = extractTargetGlucoseFromText(d.notes);
        setBolusTargetManual(tNote != null ? String(Math.round(tNote)) : '');
        setBolusGlucoseNow('');
        setBolusCarbs('');
        setBolusDoseEdited(false);
      }
    }
    setInsulinChoiceVisible(false);
    setInsulinTimingChoiceVisible(true);
  }

  function handleSelectMedicineName(name) {
    setMedicineName(name);
    setMedicineSearchQuery(name);
    setMedicineSearchVisible(false);
    setFocusedManualField(null);
  }

  function handleSelectMedicineUnit(unit) {
    setMedicineUnit(unit);
    setMedicineQuantity('');
    setMedicineUnitVisible(false);
    setFocusedManualField(null);
  }

  function handleSelectManualMeasurement(type) {
    setManualMeasurementType(type);

    setManualMeasurementDate('');
    setManualMeasurementTime('');
    setManualGlucoseType('');
    setGlucoseTypeDropdownVisible(false);
    setGlucoseConfirmVisible(false);
    setFocusedManualField(null);

    setManualChoiceVisible(false);
    setManualModalVisible(true);
  }

  function handleOpenGlucoseConfirmation() {
    if (!activePatientId) {
      setAvisoUsuario({
        tipo: 'aviso',
        texto: 'Paciente sem identificador para registrar glicemia.',
      });
      return;
    }

    if (!hasValidNewGlucose) {
      setAvisoUsuario({ tipo: 'aviso', texto: 'Informe um valor de glicose válido.' });
      return;
    }

    if (isPreviousGlucoseEntry && !hasValidManualDate) {
      setAvisoUsuario({
        tipo: 'aviso',
        texto: 'Informe uma data válida no formato DD/MM/AAAA.',
      });
      return;
    }

    if (isPreviousGlucoseEntry && !hasValidManualTime) {
      setAvisoUsuario({
        tipo: 'aviso',
        texto: 'Informe uma hora válida no formato HH:MM.',
      });
      return;
    }

    if (!hasSelectedGlucoseType) {
      setAvisoUsuario({ tipo: 'aviso', texto: 'Selecione o tipo da glicemia.' });
      return;
    }

    setGlucoseTypeDropdownVisible(false);
    setFocusedManualField(null);
    setGlucoseConfirmVisible(true);
  }

  async function handleAddGlucose() {
    const parsedValue = parseGlucoseInput(newGlucoseValue);
    const selectedDate = isPreviousGlucoseEntry
      ? normalizeManualDateInput(manualMeasurementDate)
      : buildLocalDateString();
    const selectedTime = isPreviousGlucoseEntry
      ? normalizeManualTimeInput(manualMeasurementTime)
      : buildLocalTimeString();
    let optimisticReading = null;

    if (!parsedValue || parsedValue <= 0) {
      setAvisoUsuario({ tipo: 'aviso', texto: 'Informe um valor de glicose válido.' });
      return;
    }

    if (isPreviousGlucoseEntry && !hasValidManualDate) {
      setAvisoUsuario({
        tipo: 'aviso',
        texto: 'Informe uma data válida no formato DD/MM/AAAA.',
      });
      return;
    }

    if (isPreviousGlucoseEntry && !hasValidManualTime) {
      setAvisoUsuario({
        tipo: 'aviso',
        texto: 'Informe uma hora válida no formato HH:MM.',
      });
      return;
    }

    if (!hasSelectedGlucoseType) {
      setAvisoUsuario({ tipo: 'aviso', texto: 'Selecione o tipo da glicemia.' });
      return;
    }

    const duplicateFingerprint = buildGlucoseFingerprint({
      patientId: activePatientId,
      date: selectedDate,
      time: selectedTime,
      value: parsedValue,
    });
    const hasDuplicateReading = mergeCachedGlucoseReadings(
      getCachedGlucoseReadings(activePatientId)
    ).some((item) => buildGlucoseFingerprint(item) === duplicateFingerprint);

    if (hasDuplicateReading) {
      setAvisoUsuario({
        tipo: 'aviso',
        texto: 'Ja existe um registro com a mesma data, hora e valor.',
      });
      return;
    }

    try {
      setGlucoseConfirmVisible(false);
      setManualModalVisible(false);
      setSavingGlucose(true);
      if (!activePatientId) {
        throw new Error('Paciente sem identificador para registrar glicemia.');
      }

      optimisticReading = buildOptimisticReading(activePatientId, parsedValue, {
        date: selectedDate,
        time: selectedTime,
        glucoseType: manualGlucoseType,
      });

      setGlucoseReadings((current) => mergeCachedGlucoseReadings([optimisticReading], current));
      prependCachedGlucoseReading(activePatientId, optimisticReading);

      const savedReading = await addGlucoseReading(activePatientId, parsedValue, {
        date: optimisticReading.date,
        time: optimisticReading.time,
        symptoms: `Tipo da glicemia: ${manualGlucoseType}`,
        actor: patient || usuarioLogado,
        auditSource: 'monitoramento_manual',
      });
      const confirmedReadings = mergeCachedGlucoseReadings(
        [savedReading],
        getCachedGlucoseReadings(activePatientId).filter(
          (item) => item.id !== optimisticReading.id
        )
      );
      const glucoseNotification = buildGuidedGlucoseNotification(
        savedReading,
        confirmedReadings
      );
      const nextAppState = {
        ...appState,
        patientNotifications: [
          glucoseNotification,
          ...((appState.patientNotifications || []).filter(
            (item) => item?.id !== glucoseNotification.id
          )),
        ].slice(0, 20),
      };

      setGlucoseReadings(confirmedReadings);
      replaceCachedGlucoseReadings(activePatientId, confirmedReadings);
      setAppState(nextAppState);
      await savePatientAppState({
        patientId: activePatientId,
        objectiveText,
        appState: nextAppState,
        currentPatient: patient,
        patientContext: usuarioLogado,
      });
      await registrarAlertaGlicemiaAlta(savedReading);
      setNewGlucoseValue('');
      setManualMeasurementDate('');
      setManualMeasurementTime('');
      setManualGlucoseType('');
      setGlucoseTypeDropdownVisible(false);
      setFocusedManualField(null);
      setManualMeasurementType('current');
      setAvisoUsuario({
        tipo: 'sucesso',
        texto: isPreviousGlucoseEntry
          ? `Glicemia registrada: ${parsedValue} mg/dL salva em ${formatDateForDisplay(manualMeasurementDate)} às ${String(manualMeasurementTime || '').slice(0, 5)}.`
          : `Glicemia registrada: ${parsedValue} mg/dL salva com sucesso.`,
      });
    } catch (error) {
      if (optimisticReading?.id) {
        setGlucoseReadings((current) =>
          current.filter((item) => item.id !== optimisticReading.id)
        );
        removeCachedGlucoseReading(activePatientId, optimisticReading.id);
      }
      console.log('Erro ao salvar glicemia:', error);
      setAvisoUsuario({
        tipo: 'erro',
        texto:
          error?.message ||
          'Não foi possível salvar a glicemia. Verifique a conexão e tente novamente.',
      });
      AppLogger.erro(MODULOS_LOG_SISTEMA.GLICEMIA, 'Registro de glicemia', error, {
        usuario: patient || usuarioLogado,
        complemento: `Falha ao salvar glicemia | Valor informado: ${parsedValue || 'n/a'} mg/dL`,
      });
    } finally {
      setSavingGlucose(false);
    }
  }

  async function handleRegisterMedication() {
    try {
      if (!activePatientId) {
        setAvisoUsuario({
          tipo: 'aviso',
          texto: 'Paciente sem identificador para registrar medicação.',
        });
        return;
      }

      setSavingMedication(true);
      let entryDate = buildLocalDateString();
      let entryTime = buildLocalTimeString().slice(0, 5);
      let label = '';
      const trimmedInsulinNotes = String(insulinNotes || '').trim();
      let successMessage = 'Medicação registrada com sucesso.';

      if (medicationKind === 'medicine') {
        const normalizedDate = normalizeManualDateInput(medicineDate);
        const normalizedTime = normalizeManualTimeInput(medicineTime);
        const quantity = String(medicineQuantity || '').trim();
        const parsedQuantity = Number(quantity.replace(',', '.'));
        const days = String(medicineDays || '').trim();
        const trimmedMedicineName = String(medicineName || '').trim();
        const trimmedMedicineUnit = String(medicineUnit || '').trim();

        if (!trimmedMedicineName || !trimmedMedicineUnit || !quantity) {
          setSavingMedication(false);
          setAvisoUsuario({ tipo: 'aviso', texto: 'Informe medicamento, unidade e quantidade.' });
          return;
        }

        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
          setSavingMedication(false);
          setAvisoUsuario({
            tipo: 'aviso',
            texto: 'Informe uma quantidade válida e positiva.',
          });
          return;
        }

        if (!isValidManualDate(medicineDate)) {
          setSavingMedication(false);
          setAvisoUsuario({
            tipo: 'aviso',
            texto: 'Informe uma data válida no formato DD/MM/AAAA.',
          });
          return;
        }

        if (!isValidManualTime(medicineTime)) {
          setSavingMedication(false);
          setAvisoUsuario({
            tipo: 'aviso',
            texto: 'Informe uma hora válida no formato HH:MM.',
          });
          return;
        }

        if (!medicineContinuousUse && !days) {
          setSavingMedication(false);
          setAvisoUsuario({
            tipo: 'aviso',
            texto: 'Informe o número de dias ou marque uso contínuo.',
          });
          return;
        }

        entryDate = normalizedDate;
        entryTime = normalizedTime.slice(0, 5);
        label = [
          trimmedMedicineName,
          `${quantity} ${trimmedMedicineUnit}`,
          `Hora ${entryTime}`,
          medicineContinuousUse ? 'Uso contínuo' : `${days} dia(s)`,
        ].join(' - ');
        successMessage = `Medicamento ${trimmedMedicineName} registrado com sucesso.`;
      } else {
        const normalizedDate = normalizeManualDateInput(insulinDate);
        const normalizedTime = normalizeManualTimeInput(insulinTime);
        const dose = String(insulinDose || '').trim();
        const parsedDose = parseLooseNumber(dose);
        if (
          !insulinCategory ||
          !insulinType ||
          !dose ||
          (insulinCategory === 'basal' ? !insulinDevice : !insulinUsage)
        ) {
          setSavingMedication(false);
          setAvisoUsuario({
            tipo: 'aviso',
            texto:
              insulinCategory === 'basal'
                ? 'Configure tipo e dispositivo da basal no Perfil e informe a dose em UI.'
                : 'Informe categoria, tipo, dose em UI e objetivo do uso.',
          });
          return;
        }

        if (!Number.isFinite(parsedDose) || parsedDose <= 0) {
          setSavingMedication(false);
          setAvisoUsuario({ tipo: 'aviso', texto: 'Informe uma dose positiva em UI.' });
          return;
        }

        if (isPreviousInsulinEntry) {
          if (!isValidManualDate(insulinDate)) {
            setSavingMedication(false);
            setAvisoUsuario({
              tipo: 'aviso',
              texto: 'Informe uma data válida no formato DD/MM/AAAA.',
            });
            return;
          }

          if (!isValidManualTime(insulinTime)) {
            setSavingMedication(false);
            setAvisoUsuario({
              tipo: 'aviso',
              texto: 'Informe uma hora válida no formato HH:MM.',
            });
            return;
          }

          entryDate = normalizedDate;
          entryTime = normalizedTime.slice(0, 5);
        } else {
          entryDate = buildLocalDateString();
          entryTime = buildLocalTimeString().slice(0, 5);
        }
        label =
          insulinCategory === 'basal'
            ? [
                insulinType,
                insulinDevice,
                `${dose} UI`,
                `Hora ${entryTime}`,
                trimmedInsulinNotes ? `Obs. ${trimmedInsulinNotes}` : '',
              ]
                .filter(Boolean)
                .join(' - ')
            : [
                insulinType,
                `${dose} UI`,
                insulinUsage,
                insulinCategory === 'prandial' && bolusMeal ? `Refeição ${bolusMeal}` : '',
                `Hora ${entryTime}`,
                trimmedInsulinNotes ? `Obs. ${trimmedInsulinNotes}` : '',
              ]
                .filter(Boolean)
                .join(' - ');
        successMessage = `Insulina ${insulinType} registrada com sucesso.`;
      }

      const medicationEntry = {
        id: `med-${Date.now()}`,
        kind: 'medication',
        label,
        date: entryDate,
        time: entryTime,
        medicationKind,
        medicineName:
          medicationKind === 'medicine'
            ? medicineName
            : selectedBasalInsulinOption?.label || insulinType,
        medicineUnit: medicationKind === 'medicine' ? medicineUnit : 'UI',
        medicineQuantity: medicationKind === 'medicine' ? medicineQuantity : insulinDose,
        medicineDays: medicationKind === 'medicine' ? medicineDays : '',
        medicineContinuousUse: medicationKind === 'medicine' ? medicineContinuousUse : false,
        insulinCategory: medicationKind === 'insulin' ? insulinCategory : '',
        insulinUsage:
          medicationKind === 'insulin'
            ? insulinCategory === 'basal'
              ? ''
              : insulinUsage
            : '',
        insulinNotes:
          medicationKind === 'insulin'
            ? insulinCategory === 'basal'
              ? [
                  selectedBasalInsulinOption?.molecule
                    ? `Molecula: ${selectedBasalInsulinOption.molecule}`
                    : '',
                  selectedBasalInsulinOption?.actionClass
                    ? `Classe de ação: ${selectedBasalInsulinOption.actionClass}`
                    : '',
                  insulinDevice ? `Dispositivo: ${insulinDevice}` : '',
                  selectedBasalInsulinOption?.suggestedRoute
                    ? `Via sugerida: ${selectedBasalInsulinOption.suggestedRoute}`
                    : '',
                  trimmedInsulinNotes
                    ? `Observação adicional: ${trimmedInsulinNotes}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' | ')
              : [
                  insulinCategory === 'prandial' && bolusSuggestion
                    ? [
                        `Sug. refeição ${bolusSuggestion.doseMeal} UI`,
                        `Sug. correção ${bolusSuggestion.doseCorrection} UI`,
                        `Sug. total ${bolusSuggestion.doseTotal} UI`,
                        bolusSuggestion.target != null ? `Meta ${bolusSuggestion.target} mg/dL` : '',
                      ]
                        .filter(Boolean)
                        .join(' | ')
                    : '',
                  trimmedInsulinNotes || '',
                ]
                  .filter(Boolean)
                  .join(' | ')
            : '',
        storageOrigin: 'database',
        actor: patient || usuarioLogado,
        auditSource: 'monitoramento_manual',
      };

      if (!canResolvePatient) {
        throw new Error('Paciente sem contexto para salvar a medicação.');
      }

      const savedMedication = await addMedicationEntry(activePatientId, medicationEntry);
      const historyMedicationEntry = {
        ...savedMedication,
        storageOrigin: 'local_shadow',
      };

      setAppState((current) => ({
        ...current,
        medicationEntries: [historyMedicationEntry, ...(current.medicationEntries || [])],
      }));

      let savedStateSnapshot = appState;

      try {
        const savedState = await savePatientAppState({
          patientId: activePatientId,
          objectiveText,
          appState: {
            ...appState,
            medicationEntries: [historyMedicationEntry, ...(appState.medicationEntries || [])],
          },
          currentPatient: patient,
          patientContext: usuarioLogado,
        });

        savedStateSnapshot = savedState.appState || savedStateSnapshot;
        setPatient(savedState.patient || patient);
        setObjectiveText(savedState.clinicalObjective || objectiveText);
        setAppState(savedState.appState);
      } catch (appStateError) {
        console.log('Erro ao salvar sombra da medicacao no appState:', appStateError);
      }

      try {
        const monitorLimits = mesclarLimitesDadosPaciente('monitoramento');
        const medicationLimit = monitorLimits.medicationLimit || 80;
        const medicationEntries = await fetchMedicationEntries(
          activePatientId,
          medicationLimit
        );

        setAppState((current) => ({
          ...current,
          medicationEntries,
        }));
        replaceCachedPatientAppState(activePatientId, {
          ...savedStateSnapshot,
          medicationEntries,
        });
      } catch (refreshError) {
        console.log('Erro ao recarregar medicacoes apos salvar:', refreshError);
        setAppState((current) => {
          const existing = current.medicationEntries || [];
          const savedId = savedMedication?.databaseId || savedMedication?.id;
          const alreadyListed = existing.some(
            (item) => (item?.databaseId || item?.id) === savedId
          );
          return {
            ...current,
            medicationEntries: alreadyListed
              ? existing
              : [savedMedication, ...existing],
          };
        });
      }
      setMedicationLabel('');
      setMedicationKind('');
      handleCloseMedicationFlow();
      setAvisoUsuario({ tipo: 'sucesso', texto: successMessage });
    } catch (error) {
      console.log('Erro ao salvar medicação:', error);
      setAvisoUsuario({
        tipo: 'erro',
        texto:
          error?.message ||
          'Não foi possível salvar a medicação. Verifique a conexão e tente novamente.',
      });
    } finally {
      setSavingMedication(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefreshMonitoramento} />
      }
      footerOverlay={
        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.fixedPrimaryButton,
            !activePatientId && styles.buttonDisabled,
          ]}
          onPress={handleOpenManualChoice}
          disabled={!activePatientId}
        >
          <Ionicons name="water-outline" size={18} color={patientTheme.colors.onPrimary} />
          <Text style={styles.primaryButtonText}>Registrar Glicose</Text>
        </TouchableOpacity>
      }
    >
      {avisoUsuario?.texto ? (
        <MensagemInline
          tipo={avisoUsuario.tipo || 'aviso'}
          texto={avisoUsuario.texto}
          onFechar={() => setAvisoUsuario(null)}
        />
      ) : null}
      {!loading && loadError ? (
        <>
          <EstadoErroCarregamento
            onTentarNovamente={async () => {
              setLoading(true);
              await loadMonitoringData();
              setLoading(false);
            }}
            loading={loading}
          />
          {technicalLoadLog ? (
            <MensagemInline
              tipo="aviso"
              texto={`Log tecnico\n${technicalLoadLog}`}
              onFechar={() => setTechnicalLoadLog('')}
            />
          ) : null}
        </>
      ) : null}
      <View style={[styles.currentCard, { backgroundColor: latestStatus.cardColor }]}>
        <View style={styles.currentHeader}>
          <View>
            <Text style={[styles.currentEyebrow, { color: patientTheme.colors.onPrimary }]}>
              Glicose Agora
            </Text>
            <Text style={[styles.currentValue, { color: patientTheme.colors.onPrimary }]}>
              {latestReading ? `${latestReading.value} mg/dL` : '-- mg/dL'}
            </Text>
            <Text style={[styles.currentTime, { color: patientTheme.colors.onPrimary }]}>
              {latestReading
                ? `Última leitura às ${String(latestReading.time).slice(0, 5)}`
                : 'Sem leitura registrada'}
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: latestStatus.badgeColor }]}>
            <Ionicons name="alert-circle-outline" size={14} color={patientTheme.colors.onPrimary} />
            <Text style={[styles.statusPillText, { color: patientTheme.colors.onPrimary }]}>
              {latestStatus.label}
            </Text>
          </View>
        </View>

      </View>

      <TouchableOpacity
        style={styles.medicationQuickCard}
        onPress={handleOpenMedicationChoice}
        disabled={!canResolvePatient}
      >
        <View style={styles.medicationIcon}>
          <MaterialCommunityIcons name="pill" size={20} color="#ffffff" />
        </View>
        <View style={styles.medicationCopy}>
          <Text style={styles.medicationTitle}>Registrar medicação</Text>
          <Text style={styles.medicationText}>Insulina, comprimido ou ajuste de rotina</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={patientTheme.colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.evolutionSection}>
        <Text style={styles.evolutionTitle}>Sua Evolução</Text>

        <View style={styles.tabRow}>
          {rangeOptions.map((item) => {
            const active = item === range;

            return (
              <TouchableOpacity
                key={item}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setRange(item)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.evolutionMiniRow}>
        <View
          style={[
            dashboardKpiStyles.miniCell,
            styles.evolutionMiniCell,
          ]}
        >
          <DashboardMiniKpiCard
            label="Média"
            value={String(metrics.avg)}
            helper="mg/dL"
            accent={KPI_ACCENTS.greenBright}
            style={styles.evolutionMiniCard}
            labelStyle={styles.evolutionMiniLabel}
            valueStyle={styles.evolutionMiniValue}
            helperStyle={styles.evolutionMiniHelper}
            accentBarStyle={styles.evolutionMiniAccentBar}
          />
        </View>
        <View
          style={[
            dashboardKpiStyles.miniCell,
            styles.evolutionMiniCell,
          ]}
        >
          <DashboardMiniKpiCard
            label="Variabilidade"
            value={metrics.variability === '--' ? '--' : `${metrics.variability}%`}
            helper="amplitude"
            accent={KPI_ACCENTS.greenBright}
            style={styles.evolutionMiniCard}
            labelStyle={styles.evolutionMiniLabel}
            valueStyle={styles.evolutionMiniValue}
            helperStyle={styles.evolutionMiniHelper}
            accentBarStyle={styles.evolutionMiniAccentBar}
          />
        </View>
        <View
          style={[
            dashboardKpiStyles.miniCell,
            styles.evolutionMiniCell,
          ]}
        >
          <DashboardMiniKpiCard
            label="GMI"
            value={String(metrics.gmi)}
            helper="estimado"
            accent={KPI_ACCENTS.greenBright}
            style={styles.evolutionMiniCard}
            labelStyle={styles.evolutionMiniLabel}
            valueStyle={styles.evolutionMiniValue}
            helperStyle={styles.evolutionMiniHelper}
            accentBarStyle={styles.evolutionMiniAccentBar}
          />
        </View>
        <View
          style={[
            dashboardKpiStyles.miniCell,
            styles.evolutionMiniCell,
          ]}
        >
          <DashboardMiniKpiCard
            label="Tempo no alvo"
            value={metrics.tir === '--' ? '--' : `${metrics.tir}%`}
            helper="TIR"
            accent={KPI_ACCENTS.greenBright}
            style={styles.evolutionMiniCard}
            labelStyle={styles.evolutionMiniLabel}
            valueStyle={styles.evolutionMiniValue}
            helperStyle={styles.evolutionMiniHelper}
            accentBarStyle={styles.evolutionMiniAccentBar}
          />
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Curva glicêmica</Text>
            <Text style={styles.chartSubtitle}>
              Role horizontalmente para observar melhor causa e efeito.
            </Text>
          </View>
          <View style={styles.chartRangePill}>
            <Text style={styles.chartRangeText}>{range}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingArea}>
            <EsqueletoBloco width="100%" height={168} borderRadius={16} />
            <EsqueletoBloco
              width="72%"
              height={12}
              borderRadius={8}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : series.length > 0 ? (
          <GlucoseLineChart series={series} />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>
              Ainda não há leituras suficientes para montar o gráfico.
            </Text>
          </View>
        )}

        <Text style={styles.chartHint}>
          Eventos de refeição, atividade e medicação aparecem sobre a curva para ajudar a entender causa e efeito.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.historyButton}
        onPress={() =>
          navigation.navigate('PacienteHistoricoRegistros', {
            usuarioLogado,
          })
        }
      >
        <View style={styles.historyButtonIcon}>
          <Ionicons name="document-text-outline" size={20} color="#ffffff" />
        </View>
        <View style={styles.historyButtonCopy}>
          <Text style={styles.historyButtonText}>Histórico de Registros</Text>
          <Text style={styles.historyButtonSubtitle}>Glicemia, refeições e eventos salvos</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={patientTheme.colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.libreViewStandaloneButton,
          libreLinkLinked && styles.libreViewStandaloneButtonLinked,
        ]}
        onPress={() =>
          navigation.navigate('PacientePerfilIntegracao', {
            usuarioLogado,
          })
        }
        disabled={!activePatientId}
      >
        <>
          <View style={styles.libreViewStandaloneIcon}>
            <IconeSensorLibre />
          </View>
          <View style={styles.libreViewStandaloneCopy}>
            <Text style={[styles.currentActionText, styles.libreViewActionText]}>
              FreeStyle Libre
            </Text>
            <Text style={styles.libreViewStandaloneSubtitle}>
              {libreLinkLinked
                ? 'Vinculado · toque para gerenciar integração'
                : 'Toque para integrar com LibreLinkUp'}
            </Text>
          </View>
          {libreLinkLinked ? (
            <Ionicons name="checkmark-circle" size={20} color={LIBRE_BLUE} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={LIBRE_BLUE} />
          )}
        </>
      </TouchableOpacity>

      <Modal
        visible={manualChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualChoiceVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registro da glicemia</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setManualChoiceVisible(false)}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>
              Escolha se a leitura foi feita agora ou se deseja registrar uma medição anterior.
            </Text>

            <View style={styles.measurementChoiceList}>
              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonCurrent,
                ]}
                onPress={() => handleSelectManualMeasurement('current')}
              >
                <Text style={styles.measurementChoiceTextCurrent}>Medição atual</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonPrevious,
                ]}
                onPress={() => handleSelectManualMeasurement('previous')}
              >
                <Text style={styles.measurementChoiceTextPrevious}>Medição anterior</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={manualModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseManualModal}
      >
        <View style={[styles.modalOverlay, estiloOverlayModalTeclado]}>
          <View
            style={[
              styles.modalCard,
              styles.modalHostRelative,
              glucoseTypeDropdownVisible && styles.modalCardBehindHidden,
            ]}
          >
            <ScrollModalPacienteTeclado
              ref={manualModalScrollRef}
              foco={manualModalFoco}
              keyboardPaddingBase={0}
              style={glucoseTypeDropdownVisible ? styles.modalContentHidden : null}
              contentContainerStyle={estiloConteudoScrollModalTeclado}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isPreviousGlucoseEntry ? 'Registro anterior' : 'Registro atual'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={handleCloseManualModal}
                >
                  <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>

            <Text style={styles.modalText}>
              {isPreviousGlucoseEntry
                ? 'Informe glicose, data e hora da medição.'
                : 'Informe a glicose em mg/dL. Ao salvar, a leitura entra no gráfico e no Início.'}
            </Text>

            <View
              style={[
                styles.formField,
                isPreviousGlucoseEntry && styles.firstLabeledFormField,
                !isPreviousGlucoseEntry && styles.currentFirstFormField,
              ]}
            >
              <Text style={styles.fieldLabel}>Tipo da Glicose</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.input,
                  styles.manualModalInput,
                  styles.labeledInput,
                  styles.dropdownButton,
                ]}
                onPress={handleOpenGlucoseTypeModal}
              >
                <Text
                  style={[
                    styles.dropdownButtonText,
                    !manualGlucoseType && styles.dropdownPlaceholderText,
                  ]}
                  numberOfLines={1}
                >
                  {manualGlucoseType || 'Selecione o tipo'}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={patientTheme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <CampoFocoModal fieldId="manual-glucose" style={[styles.formField, styles.stackedFormField]}>
              <Text style={styles.fieldLabel}>Glicose</Text>
              <View
                style={[
                  styles.input,
                  styles.manualModalInput,
                  styles.glucoseInputWrap,
                  isPreviousGlucoseEntry && styles.labeledInput,
                ]}
              >
                <TextInput
                  style={styles.glucoseInput}
                  placeholder="Ex: 108"
                  placeholderTextColor="#8a9095"
                  keyboardType="numeric"
                  value={newGlucoseValue}
                  onChangeText={(value) => setNewGlucoseValue(formatGlucoseInput(value))}
                  onFocus={manualModalFoco.criarOnFocus('manual-glucose', () =>
                    setFocusedManualField('glucose')
                  )}
                  onBlur={() => setFocusedManualField(null)}
                  underlineColorAndroid="transparent"
                  selectionColor={patientTheme.colors.textMuted}
                />
                {newGlucoseValue ? (
                  <Text style={styles.inputUnit}>mg/dL</Text>
                ) : null}
              </View>
            </CampoFocoModal>

            {isPreviousGlucoseEntry ? (
              <View style={styles.previousMeasurementFields}>
                <CampoFocoModal fieldId="manual-date" style={styles.formField}>
                  <Text style={styles.fieldLabel}>Data</Text>
                  <View
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      showInvalidManualDate && styles.inputInvalid,
                    ]}
                  >
                    <TextInput
                      style={styles.modalFieldTextInput}
                      placeholder="Ex: 20/04/2026"
                      placeholderTextColor="#8a9095"
                      value={manualMeasurementDate}
                      onChangeText={(value) => setManualMeasurementDate(formatManualDateInput(value))}
                      onFocus={manualModalFoco.criarOnFocus('manual-date', () =>
                        setFocusedManualField('date')
                      )}
                      onBlur={() => setFocusedManualField(null)}
                      underlineColorAndroid="transparent"
                      selectionColor={patientTheme.colors.textMuted}
                    />
                  </View>
                  {showInvalidManualDate ? (
                    <Text style={styles.fieldErrorText}>Data inválida</Text>
                  ) : null}
                </CampoFocoModal>

                <CampoFocoModal fieldId="manual-time" style={styles.formField}>
                  <Text style={styles.fieldLabel}>Hora do uso</Text>
                  <View
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                    ]}
                  >
                    <TextInput
                      style={styles.modalFieldTextInput}
                      placeholder="Ex: 10:23"
                      placeholderTextColor="#8a9095"
                      value={manualMeasurementTime}
                      onChangeText={(value) => setManualMeasurementTime(formatManualTimeInput(value))}
                      onFocus={manualModalFoco.criarOnFocus('manual-time', () =>
                        setFocusedManualField('time')
                      )}
                      onBlur={() => setFocusedManualField(null)}
                      underlineColorAndroid="transparent"
                      selectionColor={patientTheme.colors.textMuted}
                    />
                  </View>
                </CampoFocoModal>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.modalPrimaryButton,
                (!canSubmitManualGlucose || savingGlucose) && styles.modalPrimaryButtonDisabled,
              ]}
              onPress={handleOpenGlucoseConfirmation}
              disabled={!canSubmitManualGlucose || savingGlucose}
            >
              {savingGlucose ? (
                <ActivityIndicator color={patientTheme.colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar glicemia</Text>
              )}
            </TouchableOpacity>
            </ScrollModalPacienteTeclado>
          </View>
        </View>
      </Modal>

      <Modal
        visible={glucoseConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGlucoseConfirmVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <CabecalhoModalPaciente
              title="Confirmar glicemia?"
              onClose={() => setGlucoseConfirmVisible(false)}
            />
            <View style={styles.confirmIconWrap}>
              <Ionicons
                name="water-outline"
                size={26}
                color={patientTheme.colors.primaryDark}
              />
            </View>

            <Text style={styles.confirmText}>
              Deseja registrar {hasValidNewGlucose ? Math.round(parsedNewGlucose) : '--'} mg/dL
              {isPreviousGlucoseEntry
                ? ` em ${formatDateForDisplay(manualMeasurementDate)} as ${String(manualMeasurementTime || '').slice(0, 5)}?`
                : ' agora?'} {manualGlucoseType ? `Tipo: ${manualGlucoseType}. ` : ''}Essa leitura vai atualizar a tela de glicose e o Início.
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setGlucoseConfirmVisible(false)}
                disabled={savingGlucose}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmSaveButton}
                onPress={handleAddGlucose}
                disabled={savingGlucose}
              >
                {savingGlucose ? (
                  <ActivityIndicator color={patientTheme.colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmSaveText} numberOfLines={1}>
                    Confirmar registro
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={glucoseTypeDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseGlucoseTypeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.glucoseTypePickerCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tipo da Glicose</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseGlucoseTypeModal}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.unitOptionList}
              contentContainerStyle={styles.unitOptionListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {glucoseTypeOptions.map((option) => {
                const selected = option === manualGlucoseType;

                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.82}
                    style={[
                      styles.glucoseTypeOption,
                      selected && styles.glucoseTypeOptionSelected,
                    ]}
                    onPress={() => {
                      setManualGlucoseType(option);
                      handleCloseGlucoseTypeModal();
                    }}
                  >
                    <Text
                      style={[
                        styles.glucoseTypeOptionText,
                        selected && styles.glucoseTypeOptionSelectedText,
                      ]}
                    >
                      {option}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={patientTheme.colors.text}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={medicationChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicationFlow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar medicações</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseMedicationFlow}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Escolha se deseja registrar uma insulina ou outro medicamento.
            </Text>

            <View style={styles.measurementChoiceList}>
              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonCurrent,
                ]}
                onPress={() => handleSelectMedicationKind('insulin')}
              >
                <Text style={styles.measurementChoiceTextCurrent}>Insulina</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonPrevious,
                ]}
                onPress={() => handleSelectMedicationKind('medicine')}
              >
                <Text style={styles.measurementChoiceTextPrevious}>Outro medicamento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={insulinChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicationFlow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar medicações</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseMedicationFlow}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Escolha o tipo de insulina usado neste registro.
            </Text>

            <View style={styles.measurementChoiceList}>
              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonCurrent,
                ]}
                onPress={() => handleSelectInsulinType('basal')}
              >
                <Text style={styles.measurementChoiceTextCurrent}>Insulina basal</Text>
                <Text style={styles.insulinOptionDetailCurrent}>(fixa)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonPrevious,
                ]}
                onPress={() => handleSelectInsulinType('prandial')}
              >
                <Text style={styles.measurementChoiceTextPrevious}>Insulina bolus</Text>
                <Text style={styles.insulinOptionDetailPrevious}>(para correção)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={insulinTimingChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicationFlow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {insulinCategory === 'prandial'
                  ? 'Registrar Insulina Bolus'
                  : insulinCategory === 'basal'
                    ? 'Registrar Insulina Basal'
                    : 'Registrar Insulina'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseMedicationFlow}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Escolha se este registro de insulina é atual ou se deseja informar uma aplicação anterior.
            </Text>

            <View style={styles.measurementChoiceList}>
              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonCurrent,
                ]}
                onPress={() => handleSelectInsulinTiming('current')}
              >
                <Text style={styles.measurementChoiceTextCurrent}>Insulina Atual</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.measurementChoiceButton,
                  styles.measurementChoiceButtonPrevious,
                ]}
                onPress={() => handleSelectInsulinTiming('previous')}
              >
                <Text style={styles.measurementChoiceTextPrevious}>Insulina Anterior</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={medicineFormVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicationFlow}
      >
        <TouchableWithoutFeedback onPress={handleCloseMedicationFlow}>
          <View style={[styles.modalOverlay, estiloOverlayModalTeclado]}>
            <TouchableWithoutFeedback onPress={() => {}}>
                <View
                  style={[
                    styles.modalCard,
                    styles.modalHostRelative,
                    (medicineSearchVisible || medicineUnitVisible) && styles.modalCardBehindHidden,
                  ]}
                >
                  <ScrollModalPacienteTeclado
                    ref={medicineFormScrollRef}
                    foco={medicineFormFoco}
                    keyboardPaddingBase={0}
                    style={[
                      styles.medicineFormScroll,
                      (medicineSearchVisible || medicineUnitVisible) && styles.modalContentHidden,
                    ]}
                    contentContainerStyle={[
                      styles.medicineFormContent,
                      estiloConteudoScrollModalTeclado,
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
            <View style={styles.modalHeader}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.9}
                style={[styles.modalTitle, styles.modalTitleSingleLine]}
              >
                Registrar medicamento
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseMedicationFlow}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Informe o medicamento, dose e rotina para aparecer junto da curva.
            </Text>

                <View style={[styles.formField, styles.currentFirstFormField]}>
                  <Text style={styles.fieldLabel}>Medicamento</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      styles.dropdownButton,
                      focusedManualField === 'medicineName' && styles.inputFocused,
                    ]}
                    onPress={() => {
                      handleOpenMedicineSearch();
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        !medicineName && styles.dropdownPlaceholderText,
                      ]}
                    >
                      {medicineName || 'Buscar medicamento'}
                    </Text>
                    <Ionicons name="search-outline" size={18} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.formField, styles.stackedFormField]}>
                  <Text style={styles.fieldLabel}>Unidade de medida</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      styles.dropdownButton,
                      focusedManualField === 'medicineUnit' && styles.inputFocused,
                    ]}
                    onPress={() => {
                      handleOpenMedicineUnitPicker();
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownButtonText,
                        !medicineUnit && styles.dropdownPlaceholderText,
                      ]}
                    >
                      {medicineUnit || 'Selecione a unidade'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <CampoFocoModal fieldId="med-quantity" style={[styles.formField, styles.stackedFormField]}>
                  <Text style={styles.fieldLabel}>
                    {selectedMedicineUnitMeta.quantityLabel}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      focusedManualField === 'medicineQuantity' && styles.inputFocused,
                    ]}
                    placeholder={selectedMedicineUnitMeta.quantityPlaceholder}
                    placeholderTextColor="#8a9095"
                    keyboardType="numeric"
                    value={medicineQuantity}
                    onChangeText={(value) =>
                      setMedicineQuantity(
                        formatMedicineQuantityInput(value, selectedMedicineUnitMeta.inputType)
                      )
                    }
                    onFocus={medicineFormFoco.criarOnFocus('med-quantity', () =>
                      setFocusedManualField('medicineQuantity')
                    )}
                    onBlur={() => setFocusedManualField(null)}
                  />
                  <Text style={styles.fieldHelperText}>{selectedMedicineUnitMeta.hint}</Text>
                </CampoFocoModal>

                <CampoFocoModal fieldId="med-time" style={[styles.formField, styles.stackedFormField]}>
                  <Text style={styles.fieldLabel}>Hora</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      focusedManualField === 'medicineTime' && styles.inputFocused,
                    ]}
                    placeholder="Ex: 10:23"
                    placeholderTextColor="#8a9095"
                    keyboardType="numeric"
                    value={medicineTime}
                    onChangeText={(value) => setMedicineTime(formatManualTimeInput(value))}
                    onFocus={medicineFormFoco.criarOnFocus('med-time', () =>
                      setFocusedManualField('medicineTime')
                    )}
                    onBlur={() => setFocusedManualField(null)}
                  />
                </CampoFocoModal>

                <CampoFocoModal fieldId="med-date" style={[styles.formField, styles.stackedFormField]}>
                  <Text style={styles.fieldLabel}>Data do uso</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      focusedManualField === 'medicineDate' && styles.inputFocused,
                    ]}
                    placeholder="Ex: 20/04/2026"
                    placeholderTextColor="#8a9095"
                    keyboardType="numeric"
                    value={medicineDate}
                    onChangeText={(value) => setMedicineDate(formatManualDateInput(value))}
                    onFocus={medicineFormFoco.criarOnFocus('med-date', () =>
                      setFocusedManualField('medicineDate')
                    )}
                    onBlur={() => setFocusedManualField(null)}
                  />
                </CampoFocoModal>

                <CampoFocoModal fieldId="med-days" style={[styles.formField, styles.stackedFormField]}>
                  <Text style={styles.fieldLabel}>Número de dias</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      focusedManualField === 'medicineDays' && styles.inputFocused,
                      medicineContinuousUse && styles.inputDisabled,
                    ]}
                    placeholder="Ex: 7"
                    placeholderTextColor="#8a9095"
                    keyboardType="numeric"
                    editable={!medicineContinuousUse}
                    value={medicineDays}
                    onChangeText={(value) => setMedicineDays(String(value || '').replace(/\D/g, '').slice(0, 3))}
                    onFocus={medicineFormFoco.criarOnFocus('med-days', () =>
                      setFocusedManualField('medicineDays')
                    )}
                    onBlur={() => setFocusedManualField(null)}
                  />
                </CampoFocoModal>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.continuousUseRow}
                  onPress={() => {
                    const nextValue = !medicineContinuousUse;
                    setMedicineContinuousUse(nextValue);
                    if (nextValue) setMedicineDays('');
                  }}
                >
                  <View
                    style={[
                      styles.continuousUseFlag,
                      medicineContinuousUse && styles.continuousUseFlagActive,
                    ]}
                  >
                    {medicineContinuousUse ? (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    ) : null}
                  </View>
                  <Text style={styles.continuousUseText}>Uso contínuo</Text>
                </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalPrimaryButton,
                  (!canSubmitMedicine || savingMedication) && styles.modalPrimaryButtonDisabled,
                ]}
                onPress={handleRegisterMedication}
                disabled={!canSubmitMedicine || savingMedication || !canResolvePatient}
              >
                {savingMedication ? (
                  <ActivityIndicator color={patientTheme.colors.primaryDark} />
                ) : (
                  <Text
                    style={[
                      styles.primaryButtonText,
                      !canSubmitMedicine && styles.modalPrimaryButtonDisabledText,
                    ]}
                  >
                    Salvar medicamento
                  </Text>
                )}
              </TouchableOpacity>
                  </ScrollModalPacienteTeclado>

                  <DrilldownOpcoesPortal
                    embedded
                    visible={medicineSearchVisible}
                    onClose={handleCloseMedicineSearch}
                    embeddedPadding={0}
                    cardStyle={[styles.glucoseTypeModalCard, styles.medicineSearchModalCard]}
                  >
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Medicamento</Text>
                      <TouchableOpacity
                        style={styles.modalCloseButton}
                        onPress={handleCloseMedicineSearch}
                      >
                        <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <CampoFocoModal fieldId="medicine-search" style={styles.formField}>
                      <TextInput
                        style={[styles.input, styles.medicineSearchInput]}
                        placeholder="Buscar medicamento"
                        placeholderTextColor="#8a9095"
                        value={medicineSearchQuery}
                        onChangeText={setMedicineSearchQuery}
                        onFocus={medicineSearchFoco.criarOnFocus('medicine-search')}
                        autoFocus
                      />
                    </CampoFocoModal>

                    <View style={styles.medicineSearchResultsArea}>
                      {loadingMedicineOptions ? (
                        <View style={styles.optionLoadingItem}>
                          <ActivityIndicator color={patientTheme.colors.primaryDark} />
                          <Text style={styles.optionLoadingText}>Buscando na base da Anvisa...</Text>
                        </View>
                      ) : null}

                      {!loadingMedicineOptions && medicineOptionsLoaded ? (
                        <Text style={styles.optionResultCount}>
                          {medicineOptions.length
                            ? `${medicineOptions.length} resultado(s) encontrado(s) na base da Anvisa`
                            : `Nenhum resultado online para "${medicineSearchQuery.trim()}"`}
                        </Text>
                      ) : null}

                      {!loadingMedicineOptions ? (
                        <ScrollView
                          style={styles.optionList}
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                        >
                          {medicineOptions.map((item) => (
                            <TouchableOpacity
                              key={item}
                              activeOpacity={0.82}
                              style={styles.optionItem}
                              onPress={() => handleSelectMedicineName(item)}
                            >
                              <Text style={styles.optionItemText}>{item}</Text>
                            </TouchableOpacity>
                          ))}

                          {medicineOptions.length === 0 && medicineSearchQuery.trim() ? (
                            <>
                              <TouchableOpacity
                                activeOpacity={0.82}
                                style={styles.optionItem}
                                onPress={() => {
                                  const retryValue = medicineSearchQuery.trim();
                                  setMedicineSearchQuery('');
                                  setTimeout(() => setMedicineSearchQuery(retryValue), 0);
                                }}
                              >
                                <Text style={styles.optionItemText}>Tentar busca online novamente</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                activeOpacity={0.82}
                                style={styles.optionItem}
                                onPress={() => handleSelectMedicineName(medicineSearchQuery.trim())}
                              >
                                <Text style={styles.optionItemText}>
                                  Usar "{medicineSearchQuery.trim()}"
                                </Text>
                              </TouchableOpacity>
                            </>
                          ) : null}
                        </ScrollView>
                      ) : null}
                    </View>
                  </DrilldownOpcoesPortal>

                  <DrilldownOpcoesPortal
                    embedded
                    visible={medicineUnitVisible}
                    onClose={handleCloseMedicineUnitPicker}
                    embeddedPadding={0}
                    cardStyle={styles.glucoseTypeModalCard}
                  >
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Unidade de medida</Text>
                      <TouchableOpacity
                        style={styles.modalCloseButton}
                        onPress={handleCloseMedicineUnitPicker}
                      >
                        <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      style={styles.unitOptionList}
                      contentContainerStyle={styles.unitOptionListContent}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {medicationUnitOptions.map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={[
                            styles.measurementChoiceButton,
                            styles.measurementChoiceButtonPrevious,
                          ]}
                          onPress={() => handleSelectMedicineUnit(unit)}
                        >
                          <Text style={styles.measurementChoiceTextPrevious}>
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </DrilldownOpcoesPortal>
                </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={false}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicineSearch}
      >
        <TouchableWithoutFeedback onPress={handleCloseMedicineSearch}>
          <View style={[styles.modalOverlay, estiloOverlayModalTeclado]}>
            <TouchableWithoutFeedback onPress={() => {}}>
                <View style={[styles.modalCard, styles.modalHostRelative]}>
                  <ScrollModalPacienteTeclado
                    ref={medicineSearchScrollRef}
                    foco={medicineSearchFoco}
                    keyboardPaddingBase={0}
                    style={styles.optionList}
                    contentContainerStyle={estiloConteudoScrollModalTeclado}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Medicamento</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseMedicineSearch}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <CampoFocoModal fieldId="medicine-search" style={styles.formField}>
            <TextInput
              style={[styles.input, styles.medicineSearchInput]}
              placeholder="Buscar medicamento"
              placeholderTextColor="#8a9095"
              value={medicineSearchQuery}
              onChangeText={setMedicineSearchQuery}
              onFocus={medicineSearchFoco.criarOnFocus('medicine-search')}
              autoFocus
            />
            </CampoFocoModal>

              {loadingMedicineOptions ? (
                <View style={styles.optionLoadingItem}>
                  <ActivityIndicator color={patientTheme.colors.primaryDark} />
                  <Text style={styles.optionLoadingText}>Buscando na base da Anvisa...</Text>
                </View>
              ) : null}

              {!loadingMedicineOptions && medicineOptionsLoaded ? (
                <Text style={styles.optionResultCount}>
                  {medicineOptions.length
                    ? `${medicineOptions.length} resultado(s) encontrado(s) na base da Anvisa`
                    : `Nenhum resultado online para "${medicineSearchQuery.trim()}"`}
                </Text>
              ) : null}

              {!loadingMedicineOptions
                ? medicineOptions.map((item) => (
                    <TouchableOpacity
                      key={item}
                      activeOpacity={0.82}
                      style={styles.optionItem}
                      onPress={() => handleSelectMedicineName(item)}
                    >
                      <Text style={styles.optionItemText}>{item}</Text>
                    </TouchableOpacity>
                  ))
                : null}

              {!loadingMedicineOptions && medicineOptions.length === 0 && medicineSearchQuery.trim() ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={styles.optionItem}
                    onPress={() => {
                      const retryValue = medicineSearchQuery.trim();
                      setMedicineSearchQuery('');
                      setTimeout(() => setMedicineSearchQuery(retryValue), 0);
                    }}
                  >
                    <Text style={styles.optionItemText}>Tentar busca online novamente</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={styles.optionItem}
                    onPress={() => handleSelectMedicineName(medicineSearchQuery.trim())}
                  >
                    <Text style={styles.optionItemText}>
                      Usar "{medicineSearchQuery.trim()}"
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
                  </ScrollModalPacienteTeclado>
                </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={false}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicineUnitPicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Unidade de medida</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseMedicineUnitPicker}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.unitOptionList}
              contentContainerStyle={styles.unitOptionListContent}
              showsVerticalScrollIndicator={false}
            >
              {medicationUnitOptions.map((unit, index) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.measurementChoiceButton,
                    styles.measurementChoiceButtonPrevious,
                  ]}
                  onPress={() => handleSelectMedicineUnit(unit)}
                >
                  <Text style={styles.measurementChoiceTextPrevious}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={medicationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicationModal}
      >
        <View style={[styles.modalOverlay, estiloOverlayModalTeclado]}>
            <View style={styles.modalCard}>
              <ScrollModalPacienteTeclado
                ref={medicationScrollRef}
                foco={medicationFoco}
                keyboardPaddingBase={0}
                style={styles.medicineFormScroll}
                contentContainerStyle={[
                  styles.medicineFormContent,
                  estiloConteudoScrollModalTeclado,
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {medicationKind === 'insulin'
                    ? insulinCategory === 'prandial'
                      ? 'Registrar Insulina Bolus'
                      : insulinCategory === 'basal'
                        ? 'Registrar Insulina Basal'
                        : 'Registrar Insulina'
                    : 'Registrar medicamento'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={handleCloseMedicationModal}
                >
                  <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {medicationKind === 'insulin' ? (
                <>
                  {insulinCategory !== 'basal' && insulinCategory !== 'prandial' ? (
                    <Text style={styles.modalText}>
                      Registro estruturado de insulina com categoria, tipo, dose em UI, data, hora e objetivo do uso.
                    </Text>
                  ) : null}

                  {insulinCategory === 'basal' ? (
                    <View style={styles.bolusCalcCard}>
                      <Text style={styles.bolusCalcTitle}>Configurações do seu Perfil</Text>
                      <Text style={styles.bolusCalcLine}>Tipo/marca: {insulinType || '—'}</Text>
                      <Text style={styles.bolusCalcLine}>Dispositivo: {insulinDevice || '—'}</Text>
                      <Text style={styles.bolusCalcLine}>
                        Molécula: {selectedBasalInsulinOption?.molecule || '—'}
                      </Text>
                      <Text style={styles.bolusCalcLine}>
                        Classe de ação: {selectedBasalInsulinOption?.actionClass || '—'}
                      </Text>
                      <Text style={styles.bolusCalcLine}>
                        Via sugerida: {selectedBasalInsulinOption?.suggestedRoute || '—'}
                      </Text>
                      {!insulinType || !insulinDevice ? (
                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.bolusAlertText}>
                            Configure a basal no Perfil para puxar tipo e dispositivo automaticamente.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {insulinCategory === 'prandial' ? (
                    <View style={styles.bolusCalcCard}>
                      <Text style={styles.bolusCalcTitle}>Configurações do seu Perfil</Text>
                      <Text style={styles.bolusCalcLine}>
                        Tipo/marca: {insulinType || '—'}
                      </Text>
                      <Text style={styles.bolusCalcLine}>
                        Modo de uso: {insulinUsage || '—'}
                      </Text>
                      <Text style={styles.bolusCalcLine}>
                        Relação I:C: {bolusSuggestion?.ratioLabel || '—'}
                      </Text>
                      <Text style={styles.bolusCalcLine}>
                        Fator de correção: {bolusSuggestion?.corrLabel || '—'}
                      </Text>
                      <Text style={styles.bolusCalcLine}>
                        Meta glicêmica: {bolusSuggestion?.target != null ? `${bolusSuggestion.target} mg/dL` : '—'}
                      </Text>
                      {!!bolusAllAlerts.length && (
                        <View style={{ marginTop: 10 }}>
                          {bolusAllAlerts.slice(0, 3).map((w, i) => (
                            <Text key={`bolus-w-${i}`} style={styles.bolusAlertText}>
                              {w}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}

                    {insulinCategory === 'prandial' && configuredScheduleOptions.length ? (
                      <View style={[styles.formField, styles.stackedFormField]}>
                        <Text style={styles.fieldLabel}>Sugestões do seu perfil</Text>
                        <Text style={styles.fieldHelperText}>
                          Toque para preencher dose e hora com base no que você configurou no perfil.
                        </Text>
                        <View style={styles.schedulePillRow}>
                          {configuredScheduleOptions.slice(0, 6).map((item) => (
                            <TouchableOpacity
                              key={item.key}
                              style={styles.schedulePill}
                              activeOpacity={0.85}
                              onPress={() => {
                                if (item.horario) {
                                  setInsulinMeasurementType('previous');
                                  setInsulinTime(formatManualTimeInput(item.horario));
                                  setInsulinDate(formatDateForDisplay(buildLocalDateString()));
                                }
                                if (item.dose) {
                                  setInsulinDose(String(item.dose));
                                  if (insulinCategory === 'prandial') {
                                    setBolusDoseEdited(true);
                                  }
                                }
                                if (item.refeicao) {
                                  if (insulinCategory === 'prandial') {
                                    const mealHit = bolusMealOptions.find((m) =>
                                      refeicaoMatches(item.refeicao, m)
                                    );
                                    if (mealHit) {
                                      setBolusMeal(mealHit);
                                      setBolusDoseEdited(false);
                                    }
                                  } else {
                                    setInsulinUsage(item.refeicao);
                                  }
                                }
                              }}
                            >
                              <Text style={styles.schedulePillText}>
                                {item.horario ? item.horario : '--:--'}
                                {item.dose ? ` • ${item.dose} UI` : ''}
                                {item.refeicao ? ` • ${item.refeicao}` : ''}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {false ? (
                      <View style={[styles.formField, styles.firstLabeledFormField]}>
                        <Text style={styles.fieldLabel}>Insulina basal</Text>
                        <Text style={styles.fieldHelperText}>
                          Use esta seção para registrar a insulina basal com cobertura fixa. A via sugerida é sempre subcutânea.
                        </Text>
                      </View>
                    ) : null}

                    {insulinCategory !== 'prandial' && insulinCategory !== 'basal' ? (
                      <View style={[styles.formField, styles.stackedFormField]}>
                      <Text style={styles.fieldLabel}>
                        {insulinCategory === 'basal'
                          ? 'Marca/Tipo da Basal'
                          : insulinCategory === 'prandial'
                            ? 'Tipo/marca de insulina rápida'
                            : 'Tipo de insulina'}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                          styles.input,
                          styles.manualModalInput,
                          styles.labeledInput,
                          styles.dropdownButton,
                          focusedManualField === 'insulinType' && styles.inputFocused,
                          ((insulinCategory === 'prandial' && insulinDefaults?.prandial?.type) ||
                            (insulinCategory === 'basal' && insulinDefaults?.basal?.type))
                            ? styles.inputDisabled
                            : null,
                        ]}
                        onPress={() => {
                          if (
                            (insulinCategory === 'prandial' && insulinDefaults?.prandial?.type) ||
                            (insulinCategory === 'basal' && insulinDefaults?.basal?.type)
                          ) {
                            return;
                          }
                          setFocusedManualField('insulinType');
                          setInsulinTypeVisible(true);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownButtonText,
                            !insulinType && styles.dropdownPlaceholderText,
                          ]}
                        >
                          {insulinType ||
                            (insulinCategory === 'basal'
                              ? 'Selecione a basal configurada'
                              : 'Selecione o tipo')}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={patientTheme.colors.textMuted}
                        />
                      </TouchableOpacity>
                      </View>
                    ) : null}

                    {false ? (
                      <>
                        <View style={[styles.formField, styles.stackedFormField]}>
                          <Text style={styles.fieldLabel}>Molécula</Text>
                          <View style={[styles.input, styles.manualModalInput, styles.readOnlyField]}>
                            <Text style={styles.readOnlyFieldText}>
                              {selectedBasalInsulinOption?.molecule || 'Preenchido automaticamente'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.formField, styles.stackedFormField]}>
                          <Text style={styles.fieldLabel}>Classe de ação</Text>
                          <View style={[styles.input, styles.manualModalInput, styles.readOnlyField]}>
                            <Text style={styles.readOnlyFieldText}>
                              {selectedBasalInsulinOption?.actionClass || 'Preenchido automaticamente'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.formField, styles.stackedFormField]}>
                          <Text style={styles.fieldLabel}>Dispositivo</Text>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={[
                              styles.input,
                              styles.manualModalInput,
                              styles.labeledInput,
                              styles.dropdownButton,
                              focusedManualField === 'insulinDevice' && styles.inputFocused,
                              (!selectedBasalInsulinOption || insulinDefaults?.basal?.device) &&
                                styles.inputDisabled,
                            ]}
                            onPress={() => {
                              if (!selectedBasalInsulinOption || insulinDefaults?.basal?.device) {
                                return;
                              }

                              setFocusedManualField('insulinDevice');
                              setInsulinDeviceVisible(true);
                            }}
                            disabled={!selectedBasalInsulinOption || Boolean(insulinDefaults?.basal?.device)}
                          >
                            <Text
                              style={[
                                styles.dropdownButtonText,
                                !insulinDevice && styles.dropdownPlaceholderText,
                              ]}
                            >
                              {insulinDevice || 'Selecione o dispositivo'}
                            </Text>
                            <Ionicons
                              name="chevron-down"
                              size={18}
                              color={patientTheme.colors.textMuted}
                            />
                          </TouchableOpacity>
                        </View>

                        <View style={[styles.formField, styles.stackedFormField]}>
                          <Text style={styles.fieldLabel}>Via sugerida</Text>
                          <View style={[styles.input, styles.manualModalInput, styles.readOnlyField]}>
                            <Text style={styles.readOnlyFieldText}>
                              {selectedBasalInsulinOption?.suggestedRoute || 'Subcutânea'}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : null}

                    {false ? (
                      <>
                        <Text style={styles.bolusCalcTitle}>Configurações do seu Perfil</Text>
                        <Text style={styles.bolusCalcLine}>
                          Tipo/marca: {insulinType || '—'}
                        </Text>
                        <Text style={styles.bolusCalcLine}>
                          Modo de uso: {insulinUsage || '—'}
                        </Text>
                        <Text style={styles.bolusCalcLine}>
                          Relação I:C: {bolusSuggestion?.ratioLabel || '—'}
                        </Text>
                        <Text style={styles.bolusCalcLine}>
                          Fator de correção: {bolusSuggestion?.corrLabel || '—'}
                        </Text>
                        <Text style={styles.bolusCalcLine}>
                          Meta glicêmica: {bolusSuggestion?.target != null ? `${bolusSuggestion.target} mg/dL` : '—'}
                        </Text>
                        {!!bolusAllAlerts.length && (
                          <View style={{ marginTop: 10 }}>
                            {bolusAllAlerts.slice(0, 3).map((w, i) => (
                              <Text key={`bolus-w-${i}`} style={styles.bolusAlertText}>
                                {w}
                              </Text>
                            ))}
                          </View>
                        )}
                      </>
                    ) : null}

                    <CampoFocoModal fieldId="insulin-dose" style={[styles.formField, styles.stackedFormField]}>
                      <Text style={styles.fieldLabel}>Dose (UI)</Text>
                      <TextInput
                        style={[
                          styles.input,
                          styles.manualModalInput,
                          styles.labeledInput,
                          focusedManualField === 'insulinDose' && styles.inputFocused,
                        ]}
                        placeholder="Ex: 10"
                        placeholderTextColor="#8a9095"
                        keyboardType="numeric"
                        value={insulinDose}
                        onChangeText={(value) => {
                          if (insulinCategory === 'prandial') {
                            setBolusDoseEdited(true);
                          }
                          setInsulinDose(
                            formatMedicineQuantityInput(
                              value,
                              insulinCategory === 'prandial' ? 'decimal' : 'integer'
                            )
                          );
                        }}
                        onFocus={medicationFoco.criarOnFocus('insulin-dose', () =>
                          setFocusedManualField('insulinDose')
                        )}
                        onBlur={() => setFocusedManualField(null)}
                      />
                    </CampoFocoModal>

                    {insulinCategory !== 'basal' && insulinCategory !== 'prandial' ? (
                      <View style={[styles.formField, styles.stackedFormField]}>
                        <Text style={styles.fieldLabel}>Objetivo do uso</Text>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={[
                            styles.input,
                            styles.manualModalInput,
                            styles.labeledInput,
                            styles.dropdownButton,
                            focusedManualField === 'insulinUsage' && styles.inputFocused,
                          ]}
                          onPress={() => {
                            setFocusedManualField('insulinUsage');
                            setInsulinUsageVisible(true);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownButtonText,
                              !insulinUsage && styles.dropdownPlaceholderText,
                            ]}
                          >
                            {insulinUsage || 'Selecione o objetivo'}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={18}
                            color={patientTheme.colors.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <CampoFocoModal fieldId="insulin-time" style={[styles.formField, styles.stackedFormField]}>
                      <Text style={styles.fieldLabel}>Hora do uso</Text>
                      <TextInput
                        style={[
                          styles.input,
                          styles.manualModalInput,
                          styles.labeledInput,
                          focusedManualField === 'insulinTime' && styles.inputFocused,
                        ]}
                        placeholder="Ex: 07:30"
                        placeholderTextColor="#8a9095"
                        keyboardType="numeric"
                        value={insulinTime}
                        onChangeText={(value) => setInsulinTime(formatManualTimeInput(value))}
                        onFocus={medicationFoco.criarOnFocus('insulin-time', () =>
                          setFocusedManualField('insulinTime')
                        )}
                        onBlur={() => setFocusedManualField(null)}
                      />
                    </CampoFocoModal>

                    <CampoFocoModal fieldId="insulin-date" style={[styles.formField, styles.stackedFormField]}>
                      <Text style={styles.fieldLabel}>Data do uso</Text>
                      <TextInput
                        style={[
                          styles.input,
                          styles.manualModalInput,
                          styles.labeledInput,
                          focusedManualField === 'insulinDate' && styles.inputFocused,
                        ]}
                        placeholder="Ex: 21/04/2026"
                        placeholderTextColor="#8a9095"
                        keyboardType="numeric"
                        value={insulinDate}
                        onChangeText={(value) => setInsulinDate(formatManualDateInput(value))}
                        onFocus={medicationFoco.criarOnFocus('insulin-date', () =>
                          setFocusedManualField('insulinDate')
                        )}
                        onBlur={() => setFocusedManualField(null)}
                      />
                    </CampoFocoModal>

                    <CampoFocoModal fieldId="insulin-notes" style={[styles.formField, styles.stackedFormField]}>
                      <Text style={styles.fieldLabel}>Observação</Text>
                      <TextInput
                        style={[
                          styles.input,
                          styles.manualModalInput,
                          styles.labeledInput,
                          focusedManualField === 'insulinNotes' && styles.inputFocused,
                        ]}
                        placeholder="Ex: aplicado antes do jantar"
                        placeholderTextColor="#8a9095"
                        value={insulinNotes}
                        onChangeText={setInsulinNotes}
                        onFocus={medicationFoco.criarOnFocus('insulin-notes', () =>
                          setFocusedManualField('insulinNotes')
                        )}
                        onBlur={() => setFocusedManualField(null)}
                      />
                    </CampoFocoModal>

                  <TouchableOpacity
                    style={[
                      styles.modalSecondaryButton,
                      (!canSubmitInsulin || savingMedication || !canResolvePatient) &&
                        styles.modalPrimaryButtonDisabled,
                    ]}
                    onPress={handleRegisterMedication}
                    disabled={savingMedication || !canResolvePatient || !canSubmitInsulin}
                  >
                    {savingMedication ? (
                      <ActivityIndicator color={patientTheme.colors.primaryDark} />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Salvar insulina</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalText}>
                    Descreva o medicamento, dose ou horário para aparecer junto da curva.
                  </Text>

                  <CampoFocoModal fieldId="medication-label">
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Metformina 850mg"
                    placeholderTextColor="#8a9095"
                    value={medicationLabel}
                    onChangeText={setMedicationLabel}
                    onFocus={medicationFoco.criarOnFocus('medication-label', () =>
                      setFocusedManualField('medication')
                    )}
                    onBlur={() => setFocusedManualField(null)}
                    autoFocus
                  />
                  </CampoFocoModal>

                  <TouchableOpacity
                    style={styles.modalSecondaryButton}
                    onPress={handleRegisterMedication}
                    disabled={savingMedication || !canResolvePatient}
                  >
                    {savingMedication ? (
                      <ActivityIndicator color={patientTheme.colors.primaryDark} />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Salvar medicamento</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
              </ScrollModalPacienteTeclado>

          {insulinTypeVisible ? (
            <View style={styles.inlinePopupOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {insulinCategory === 'basal' ? 'Marca/Tipo da Basal' : 'Tipo de insulina'}
                  </Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setInsulinTypeVisible(false);
                      setFocusedManualField(null);
                    }}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.unitOptionList}
                  contentContainerStyle={styles.unitOptionListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedInsulinTypeOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.measurementChoiceButton, styles.measurementChoiceButtonPrevious]}
                      onPress={() => {
                        setInsulinType(option);
                        if (insulinCategory === 'basal') {
                          setInsulinDevice('');
                        }
                        setInsulinTypeVisible(false);
                        setFocusedManualField(null);
                      }}
                    >
                      <Text style={styles.measurementChoiceTextPrevious}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : null}

          {insulinDeviceVisible ? (
            <View style={styles.inlinePopupOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Dispositivo</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setInsulinDeviceVisible(false);
                      setFocusedManualField(null);
                    }}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.unitOptionList}
                  contentContainerStyle={styles.unitOptionListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedInsulinDeviceOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.measurementChoiceButton, styles.measurementChoiceButtonPrevious]}
                      onPress={() => {
                        setInsulinDevice(option);
                        setInsulinDeviceVisible(false);
                        setFocusedManualField(null);
                      }}
                    >
                      <Text style={styles.measurementChoiceTextPrevious}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : null}

          {insulinUsageVisible ? (
            <View style={styles.inlinePopupOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Objetivo do uso</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setInsulinUsageVisible(false);
                      setFocusedManualField(null);
                    }}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.unitOptionList}
                  contentContainerStyle={styles.unitOptionListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedInsulinUsageOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.measurementChoiceButton, styles.measurementChoiceButtonPrevious]}
                      onPress={() => {
                        setInsulinUsage(option);
                        setInsulinUsageVisible(false);
                        setFocusedManualField(null);
                      }}
                    >
                      <Text style={styles.measurementChoiceTextPrevious}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : null}
            </View>
        </View>
      </Modal>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 160,
  },
  currentCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  currentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentEyebrow: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  currentValue: {
    color: patientTheme.colors.text,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 8,
  },
  currentTime: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  currentCardWhiteText: {
    color: '#ffffff',
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  currentActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  currentActionButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 10,
  },
  manualActionButton: {
    backgroundColor: '#ffffff',
  },
  currentActionText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  manualActionText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  libreViewActionButton: {
    backgroundColor: LIBRE_YELLOW,
  },
  libreViewStandaloneButton: {
    alignItems: 'center',
    backgroundColor: LIBRE_YELLOW,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 14,
    minHeight: 62,
    overflow: 'visible',
    paddingLeft: 10,
    paddingRight: 18,
    paddingVertical: 12,
    gap: 12,
  },
  libreViewStandaloneButtonLinked: {
    borderWidth: 1.5,
    borderColor: LIBRE_BLUE,
  },
  libreViewStandaloneIcon: {
    alignItems: 'center',
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    marginLeft: -2,
    overflow: 'visible',
    width: 42,
  },
  libreViewStandaloneCopy: {
    flex: 1,
    paddingRight: 8,
  },
  libreViewStandaloneSubtitle: {
    color: LIBRE_BLUE_SOFT,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  libreViewActionText: {
    color: LIBRE_BLUE,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'left',
  },
  medicationQuickCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    marginTop: 14,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...patientShadow,
  },
  medicationIcon: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.info,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  medicationCopy: {
    flex: 1,
  },
  medicationTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  medicationText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  input: {
    ...inputWebFocusReset,
    WebkitAppearance: 'none',
    alignSelf: 'stretch',
    marginTop: 14,
    minHeight: 50,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.primary,
    borderWidth: 1,
    borderStyle: 'solid',
    boxShadow: 'none',
    elevation: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineOffset: 0,
    paddingHorizontal: 14,
    color: patientTheme.colors.text,
    width: '100%',
  },
  webTextInputReset: {
    ...inputWebFocusReset,
    WebkitAppearance: 'none',
    outlineOffset: 0,
  },
  medicineSearchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#EEF2F7',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedPrimaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...patientShadow,
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  evolutionSection: {
    marginTop: 18,
    marginBottom: 12,
  },
  evolutionMiniRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 6,
    marginHorizontal: 2,
    marginBottom: 4,
    paddingBottom: 2,
  },
  evolutionMiniCell: {
    flex: 1,
    minWidth: 0,
  },
  evolutionMiniCard: {
    minWidth: 0,
    minHeight: 94,
    paddingHorizontal: 9,
    paddingVertical: 11,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  evolutionMiniLabel: {
    minHeight: 22,
    fontSize: 10,
    lineHeight: 12,
  },
  evolutionMiniValue: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 21,
  },
  evolutionMiniHelper: {
    minHeight: 15,
    marginTop: 3,
    fontSize: 9,
    lineHeight: 10,
  },
  evolutionMiniAccentBar: {
    marginTop: 8,
    width: 20,
  },
  evolutionTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 0,
    alignItems: 'center',
    ...patientShadow,
    borderWidth: 0,
  },
  tabActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  tabText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  chartCard: {
    marginTop: 8,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  chartSubtitle: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 220,
  },
  chartRangePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  chartRangeText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingRight: 10,
  },
  loadingArea: {
    minWidth: 280,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChart: {
    minWidth: 280,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyChartText: {
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  barWrapper: {
    width: 54,
    alignItems: 'center',
  },
  eventBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  eventBadgeCompact: {
    backgroundColor: '#ffffff',
    height: 18,
    marginBottom: 0,
    width: 18,
  },
  eventSpacer: {
    height: 36,
  },
  barTrack: {
    width: 30,
    height: 160,
    borderRadius: 16,
    backgroundColor: patientTheme.colors.surfaceMuted,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: patientTheme.colors.primary,
  },
  barValue: {
    marginTop: 10,
    fontSize: 12,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  barLabel: {
    marginTop: 4,
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  chartHint: {
    marginTop: 16,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  lineChartViewport: {
    minWidth: 280,
  },
  lineChartScrollContent: {
    flexGrow: 1,
  },
  lineChart: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 300,
    overflow: 'hidden',
    position: 'relative',
  },
  safeRangeBand: {
    backgroundColor: patientTheme.colors.primarySoft,
    height: 60,
    left: 0,
    opacity: 0.36,
    position: 'absolute',
    right: 0,
    top: 198,
  },
  chartGridLine: {
    backgroundColor: patientTheme.colors.border,
    height: 1,
    left: 46,
    opacity: 0.7,
    position: 'absolute',
    right: 0,
  },
  chartGridLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    left: -38,
    position: 'absolute',
    top: -8,
  },
  lineSegment: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 2,
    height: 3,
    position: 'absolute',
  },
  linePoint: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    justifyContent: 'center',
    position: 'absolute',
    width: 14,
  },
  linePointValue: {
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '800',
    position: 'absolute',
    textAlign: 'center',
    width: 44,
  },
  chartLabelsRow: {
    bottom: 8,
    height: 18,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  lineChartLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    position: 'absolute',
    textAlign: 'center',
    width: 48,
  },
  metricsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    alignItems: 'center',
    flex: 1,
    aspectRatio: 1,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    ...patientShadow,
  },
  metricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 8.5,
    lineHeight: 11,
    minHeight: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  metricValue: {
    marginTop: 3,
    color: patientTheme.colors.text,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 25,
    textAlign: 'center',
  },
  metricUnit: {
    marginTop: 2,
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
  },
  historyButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    marginTop: 14,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...patientShadow,
  },
  historyButtonIcon: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  historyButtonCopy: {
    flex: 1,
  },
  historyButtonText: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  historyButtonSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  insightCard: {
    marginTop: 18,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  insightText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 52, 56, 0.32)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  modalKeyboard: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    alignSelf: 'center',
    flexShrink: 0,
    maxWidth: 420,
    padding: 18,
    width: '100%',
    ...patientShadow,
  },
  modalHostRelative: {
    overflow: 'hidden',
    position: 'relative',
  },
  modalCardBehindHidden: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  modalContentHidden: {
    opacity: 0,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 36,
    position: 'relative',
  },
  modalTitle: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 44,
    textAlign: 'center',
    zIndex: 1,
  },
  modalTitleSingleLine: {
    fontSize: 16,
    paddingHorizontal: 40,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 18,
    elevation: 4,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
    zIndex: 4,
  },
  modalText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  measurementChoiceList: {
    gap: 10,
    marginTop: 16,
  },
  measurementChoiceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  measurementChoiceButtonCurrent: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  measurementChoiceButtonPrevious: {
    backgroundColor: '#f1f3f5',
    borderColor: '#f1f3f5',
    borderWidth: 1,
  },
  measurementChoiceTextCurrent: {
    color: patientTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  measurementChoiceTextPrevious: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  insulinOptionDetailCurrent: {
    color: patientTheme.colors.onPrimary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  insulinOptionDetailPrevious: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  previousMeasurementFields: {
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  formField: {
    width: '100%',
  },
  currentFirstFormField: {
    marginTop: 14,
  },
  stackedFormField: {
    marginTop: 10,
  },
  firstLabeledFormField: {
    marginTop: 10,
  },
  fieldLabel: {
    color: '#4f565c',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  fieldErrorText: {
    color: '#c74747',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  fieldHelperText: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  labeledInput: {
    marginTop: 0,
  },
  readOnlyField: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyFieldText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    width: '100%',
  },
  manualModalInput: {
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderColor: '#EEF2F7',
    borderWidth: 1,
    width: '100%',
    ...inputWebFocusReset,
  },
  inputFocused: {
    ...inputFocusBorder,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderStyle: 'solid',
    elevation: 0,
  },
  inputInvalid: {
    borderColor: '#c74747',
  },
  dropdownButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
    width: '100%',
  },
  dropdownButtonText: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 10,
  },
  dropdownPlaceholderText: {
    color: '#8a9095',
    fontWeight: '500',
  },
  inputDisabled: {
    opacity: 0.55,
  },
  inlineChoiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  inlineChoiceButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  inlineChoiceButtonActive: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
  },
  inlineChoiceText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '800',
    fontSize: 12,
  },
  inlineChoiceTextActive: {
    color: patientTheme.colors.primaryDark,
  },
  schedulePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  schedulePill: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  schedulePillText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  bolusPillActive: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
  },
  bolusPillTextActive: {
    color: patientTheme.colors.primaryDark,
  },
  bolusCalcCard: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    borderColor: patientTheme.colors.primaryDark,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  bolusCalcTitle: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  bolusCalcLine: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  bolusCalcTotal: {
    color: patientTheme.colors.primaryDark,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  bolusAlertText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  medicineFormScroll: {
    marginTop: 10,
    maxHeight: 420,
    flexShrink: 0,
    width: '100%',
  },
  medicineFormContent: {
    paddingBottom: 2,
  },
  continuousUseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
    minHeight: 38,
  },
  continuousUseFlag: {
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderColor: patientTheme.colors.border,
    borderRadius: 7,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  continuousUseFlagActive: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  continuousUseText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  optionList: {
    marginTop: 8,
    maxHeight: 280,
  },
  unitOptionList: {
    marginTop: 16,
    maxHeight: 360,
  },
  unitOptionListContent: {
    gap: 10,
    paddingBottom: 2,
  },
  optionItem: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 14,
  },
  optionItemText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionLoadingItem: {
    alignItems: 'center',
    gap: 8,
    minHeight: 72,
    justifyContent: 'center',
  },
  optionLoadingText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionResultCount: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  glucoseTypeModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    maxWidth: 420,
    padding: 18,
    width: '100%',
    ...patientShadow,
  },
  medicineSearchModalCard: {
    minHeight: 360,
  },
  glucoseTypePickerCard: {
    alignSelf: 'center',
    maxHeight: 360,
    maxWidth: 420,
    padding: 16,
    width: '100%',
  },
  medicineSearchResultsArea: {
    minHeight: 230,
  },
  inlinePopupOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 52, 56, 0.18)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 14,
    paddingVertical: 18,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  glucoseTypeOptionList: {
    gap: 8,
    marginTop: 14,
  },
  glucoseTypeOption: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    borderColor: '#EEF2F7',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  glucoseTypeOptionSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#D9E2EC',
  },
  glucoseTypeOptionText: {
    color: patientTheme.colors.textMuted,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  glucoseTypeOptionSelectedText: {
    color: patientTheme.colors.text,
    fontWeight: '800',
  },
  glucoseInputWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  glucoseInput: {
    ...inputWebFocusReset,
    WebkitAppearance: 'none',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    boxShadow: 'none',
    color: patientTheme.colors.text,
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineOffset: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  glucoseInputFocused: {
    ...inputWebFocusReset,
    WebkitAppearance: 'none',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    outlineOffset: 0,
  },
  modalFieldTextInput: {
    ...inputWebFocusReset,
    WebkitAppearance: 'none',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    boxShadow: 'none',
    color: patientTheme.colors.text,
    minHeight: 48,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineOffset: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: '100%',
  },
  modalFieldTextInputFocused: {
    ...inputWebFocusReset,
    WebkitAppearance: 'none',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    boxShadow: 'none',
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineOffset: 0,
  },
  inputUnit: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    width: '100%',
  },
  modalPrimaryButtonDisabled: {
    backgroundColor: '#eeeeee',
  },
  modalPrimaryButtonDisabledText: {
    color: patientTheme.colors.text,
  },
  modalSecondaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    width: '100%',
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    ...patientShadow,
  },
  confirmIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    marginBottom: 14,
  },
  confirmText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  confirmCancelText: {
    color: patientTheme.colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmSaveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    paddingHorizontal: 12,
  },
  confirmSaveText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
