import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  addGlucoseReading,
  addMedicationEntry,
  buildMonitorSeries,
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import {
  fetchLibreViewReadings,
  isLibreViewSyncConfigured,
} from '../../servicos/servicoLibreView';
import { buscarMedicamentosAnvisa } from '../../servicos/servicoMedicamentosAnvisa';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  prependCachedGlucoseReading,
  removeCachedGlucoseReading,
  replaceCachedGlucoseReadings,
  subscribeToGlucoseReadings,
} from '../../servicos/centralGlicose';

const rangeOptions = ['Hoje', '7 dias', '14 dias'];

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
    id: 'premixed',
    title: 'Insulina pré-misturada',
    detail: '(basal + prandial)',
    helper: 'Formulação que combina componentes basal e prandial em uma mesma aplicação.',
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
  premixed: [
    'NPH/Regular 70/30',
    'NPL/Lispro 75/25',
    'NPL/Lispro 50/50',
    'NPA/Asparte 70/30',
  ],
  inhaled: ['Insulina humana inalável'],
};

const insulinUsageOptions = {
  basal: ['Rotina da manhã', 'Rotina da noite', 'Semanal', 'Outro horário fixo'],
  prandial: ['Antes da refeição', 'Correção', 'Antes da refeição e correção'],
  premixed: ['Antes da refeição', 'Rotina prescrita', 'Outro horário fixo'],
  inhaled: ['Antes da refeição', 'Correção', 'Antes da refeição e correção'],
};

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
    backgroundColor: '#E50914',
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

function LibreSensorIcon() {
  return (
    <View style={styles.libreSensorIconOuter}>
      <View style={styles.libreSensorIconMiddle}>
        <View style={styles.libreSensorIconCenter} />
      </View>
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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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
  const [range, setRange] = useState('Hoje');
  const [loading, setLoading] = useState(true);
  const [savingGlucose, setSavingGlucose] = useState(false);
  const [savingMedication, setSavingMedication] = useState(false);
  const [syncingLibreView, setSyncingLibreView] = useState(false);
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
  const [insulinDate, setInsulinDate] = useState('');
  const [insulinTime, setInsulinTime] = useState('');
  const [insulinNotes, setInsulinNotes] = useState('');
  const [insulinTypeVisible, setInsulinTypeVisible] = useState(false);
  const [insulinUsageVisible, setInsulinUsageVisible] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [medicineSearchQuery, setMedicineSearchQuery] = useState('');
  const [medicineUnit, setMedicineUnit] = useState('');
  const [medicineQuantity, setMedicineQuantity] = useState('');
  const [medicineDate, setMedicineDate] = useState('');
  const [medicineTime, setMedicineTime] = useState('');
  const [medicineDays, setMedicineDays] = useState('');
  const [medicineContinuousUse, setMedicineContinuousUse] = useState(false);
  const [patient, setPatient] = useState(null);
  const [objectiveText, setObjectiveText] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [glucoseReadings, setGlucoseReadings] = useState([]);
  const activePatientId = patient?.id_paciente_uuid || patientId || null;

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          if (!active) return;
          setAppState(createDefaultAppState());
          setGlucoseReadings([]);
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
        });

        if (!active) return;

        const mergedReadings = mergeCachedGlucoseReadings(
          experience.glucoseReadings,
          getCachedGlucoseReadings(experience.patient?.id_paciente_uuid || patientId)
        );

        setPatient(experience.patient);
        setObjectiveText(experience.clinicalObjective);
        setAppState(experience.appState);
        setGlucoseReadings(mergedReadings);
        replaceCachedGlucoseReadings(
          experience.patient?.id_paciente_uuid || patientId,
          mergedReadings
        );
      } catch (error) {
        console.log('Erro ao carregar monitoramento:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId, canResolvePatient]);

  useEffect(() => {
    if (!activePatientId) return undefined;

    return subscribeToGlucoseReadings(activePatientId, (nextReadings) => {
      setGlucoseReadings(nextReadings);
    });
  }, [activePatientId]);

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
  const canSubmitInsulin =
    medicationKind === 'insulin' &&
    Boolean(insulinCategory) &&
    Boolean(insulinType) &&
    Boolean(String(insulinDose || '').trim()) &&
    isValidManualDate(insulinDate) &&
    isValidManualTime(insulinTime) &&
    Boolean(insulinUsage);
  const selectedMedicineUnitMeta = medicationUnitMeta[medicineUnit] || {
    quantityLabel: 'Quantidade',
    quantityPlaceholder: 'Ex: 1',
    hint: 'Escolha a unidade para orientar o preenchimento.',
    inputType: 'decimal',
  };
  const selectedInsulinTypeOptions = insulinTypeOptions[insulinCategory] || [];
  const selectedInsulinUsageOptions = insulinUsageOptions[insulinCategory] || [];
  const selectedInsulinCategoryMeta =
    insulinCategoryOptions.find((option) => option.id === insulinCategory) || null;
  const timeInRange = metrics.tir === '--' ? 0 : metrics.tir;
  const manualModalLift =
    !glucoseTypeDropdownVisible && focusedManualField === 'glucose'
      ? isPreviousGlucoseEntry
        ? -10
        : -8
      : !glucoseTypeDropdownVisible && focusedManualField === 'date'
        ? -18
        : !glucoseTypeDropdownVisible && focusedManualField === 'time'
          ? -26
          : 0;
  const medicationModalLift = focusedManualField === 'medication' ? -12 : 0;
  const insulinModalLift =
    !insulinTypeVisible && !insulinUsageVisible && focusedManualField === 'insulinDose'
      ? -8
      : !insulinTypeVisible && !insulinUsageVisible && focusedManualField === 'insulinTime'
        ? -20
        : !insulinTypeVisible && !insulinUsageVisible && focusedManualField === 'insulinDate'
          ? -32
          : !insulinTypeVisible && !insulinUsageVisible && focusedManualField === 'insulinNotes'
            ? -44
            : 0;
  const medicineModalLift =
    !medicineSearchVisible && !medicineUnitVisible && focusedManualField === 'medicineQuantity'
      ? -10
      : !medicineSearchVisible && !medicineUnitVisible && focusedManualField === 'medicineTime'
        ? -22
        : !medicineSearchVisible && !medicineUnitVisible && focusedManualField === 'medicineDate'
          ? -34
          : !medicineSearchVisible && !medicineUnitVisible && focusedManualField === 'medicineDays'
            ? -46
            : 0;

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
    setInsulinDate('');
    setInsulinTime('');
    setInsulinNotes('');
    setInsulinTypeVisible(false);
    setInsulinUsageVisible(false);
  }

  function handleOpenManualChoice() {
    setManualChoiceVisible(true);
  }

  function handleCloseManualModal() {
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
    setMedicationModalVisible(false);
    setMedicationKind('');
    setMedicationLabel('');
    resetInsulinForm();
    resetMedicineForm();
    setFocusedManualField(null);
  }

  function handleCloseMedicationFlow() {
    setMedicationChoiceVisible(false);
    setInsulinChoiceVisible(false);
    setMedicationModalVisible(false);
    setMedicineFormVisible(false);
    setMedicationKind('');
    setMedicationLabel('');
    resetInsulinForm();
    resetMedicineForm();
    setFocusedManualField(null);
  }

  function handleOpenMedicationChoice() {
    setMedicationChoiceVisible(true);
    setInsulinChoiceVisible(false);
    setMedicationModalVisible(false);
    setMedicineFormVisible(false);
  }

  function handleSelectMedicationKind(kind) {
    if (kind === 'insulin') {
      setMedicationKind('insulin');
      setMedicationChoiceVisible(false);
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

  function handleSelectInsulinType(label) {
    setMedicationKind('insulin');
    setInsulinCategory(label);
    setInsulinType('');
    setInsulinUsage('');
    setInsulinDose('');
    setInsulinNotes('');
    setInsulinDate(formatDateForDisplay(buildLocalDateString()));
    setInsulinTime(formatManualTimeInput(buildLocalTimeString()));
    setInsulinChoiceVisible(false);
    setMedicationModalVisible(true);
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
      Alert.alert('Atenção', 'Paciente sem identificador para registrar glicemia.');
      return;
    }

    if (!hasValidNewGlucose) {
      Alert.alert('Atenção', 'Informe um valor de glicose válido.');
      return;
    }

    if (isPreviousGlucoseEntry && !hasValidManualDate) {
      Alert.alert('AtenÃƒÂ§ÃƒÂ£o', 'Informe uma data vÃƒÂ¡lida no formato DD/MM/AAAA.');
      return;
    }

    if (isPreviousGlucoseEntry && !hasValidManualTime) {
      Alert.alert('AtenÃƒÂ§ÃƒÂ£o', 'Informe uma hora vÃƒÂ¡lida no formato HH:MM.');
      return;
    }

    if (!hasSelectedGlucoseType) {
      Alert.alert('Atenção', 'Selecione o tipo da glicose.');
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
      Alert.alert('Atencao', 'Informe um valor de glicose valido.');
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
      setNewGlucoseValue('');
      setManualMeasurementDate('');
      setManualMeasurementTime('');
      setManualGlucoseType('');
      setGlucoseTypeDropdownVisible(false);
      setFocusedManualField(null);
      setManualMeasurementType('current');
      Alert.alert(
        'Glicemia registrada',
        `Leitura de ${parsedValue} mg/dL salva com sucesso. A leitura guiada foi enviada para notificacoes.`
      );
    } catch (error) {
      if (optimisticReading?.id) {
        setGlucoseReadings((current) =>
          current.filter((item) => item.id !== optimisticReading.id)
        );
        removeCachedGlucoseReading(activePatientId, optimisticReading.id);
      }
      console.log('Erro ao salvar glicemia:', error);
      Alert.alert(
        'Erro ao salvar glicemia',
        error?.message || 'Nao foi possivel salvar a glicemia agora.'
      );
    } finally {
      setSavingGlucose(false);
    }
  }

  function isKnownReading(reading, existingReadings) {
    return existingReadings.some(
      (item) =>
        item.value === reading.value &&
        item.date === reading.date &&
        String(item.time).slice(0, 5) === String(reading.time).slice(0, 5)
    );
  }

  async function handleSyncLibreView() {
    if (!activePatientId) {
      Alert.alert('Atenção', 'Paciente sem identificador para sincronizar o LibreView.');
      return;
    }

    if (!isLibreViewSyncConfigured()) {
      Alert.alert(
        'LibreView ainda não configurado',
        'A tela já está preparada, mas falta configurar a URL segura EXPO_PUBLIC_LIBRE_VIEW_SYNC_URL para buscar as leituras pelo backend.'
      );
      return;
    }

    try {
      setSyncingLibreView(true);

      const libreReadings = await fetchLibreViewReadings({
        patientId: activePatientId,
        patientEmail: patient?.email_pac || usuarioLogado?.email_pac || usuarioLogado?.email,
      });
      const newReadings = libreReadings.filter(
        (reading) => !isKnownReading(reading, glucoseReadings)
      );

      for (const reading of newReadings) {
        await addGlucoseReading(activePatientId, reading.value, {
          date: reading.date,
          time: reading.time,
        });
      }

      const updatedReadings = await fetchPatientExperience(activePatientId, {
        patientContext: usuarioLogado,
      });
      const mergedReadings = mergeCachedGlucoseReadings(
        updatedReadings.glucoseReadings,
        getCachedGlucoseReadings(activePatientId)
      );

      setPatient(updatedReadings.patient || patient);
      setObjectiveText(updatedReadings.clinicalObjective || objectiveText);
      setAppState(updatedReadings.appState);
      setGlucoseReadings(mergedReadings);
      replaceCachedGlucoseReadings(activePatientId, mergedReadings);

      Alert.alert(
        'LibreView sincronizado',
        newReadings.length
          ? `${newReadings.length} leitura(s) importada(s) para a glicose.`
          : 'Nenhuma leitura nova encontrada agora.'
      );
    } catch (error) {
      console.log('Erro ao sincronizar LibreView:', error);
      Alert.alert('Erro', 'Não foi possível sincronizar o LibreView agora.');
    } finally {
      setSyncingLibreView(false);
    }
  }

  async function handleRegisterMedication() {
    try {
      setSavingMedication(true);
      let entryDate = buildLocalDateString();
      let entryTime = buildLocalTimeString().slice(0, 5);
      let label = '';

      if (medicationKind === 'medicine') {
        const normalizedDate = normalizeManualDateInput(medicineDate);
        const normalizedTime = normalizeManualTimeInput(medicineTime);
        const quantity = String(medicineQuantity || '').trim();
        const days = String(medicineDays || '').trim();

        if (!medicineName || !medicineUnit || !quantity || !normalizedDate || !normalizedTime) {
          Alert.alert('Atenção', 'Informe medicamento, unidade, quantidade, data e hora.');
          return;
        }

        if (!medicineContinuousUse && !days) {
          Alert.alert('Atenção', 'Informe o número de dias ou marque uso contínuo.');
          return;
        }

        entryDate = normalizedDate;
        entryTime = normalizedTime.slice(0, 5);
        label = [
          medicineName,
          `${quantity} ${medicineUnit}`,
          `Hora ${entryTime}`,
          medicineContinuousUse ? 'Uso contínuo' : `${days} dia(s)`,
        ].join(' - ');
      } else {
        const normalizedDate = normalizeManualDateInput(insulinDate);
        const normalizedTime = normalizeManualTimeInput(insulinTime);
        const dose = String(insulinDose || '').trim();
        const notes = String(insulinNotes || '').trim();

        if (!insulinCategory || !insulinType || !dose || !normalizedDate || !normalizedTime || !insulinUsage) {
          Alert.alert(
            'Atenção',
            'Informe categoria, tipo, dose em UI, data, hora e objetivo do uso.'
          );
          return;
        }

        entryDate = normalizedDate;
        entryTime = normalizedTime.slice(0, 5);
        label = [
          insulinType,
          `${dose} UI`,
          insulinUsage,
          `Hora ${entryTime}`,
          notes ? `Obs. ${notes}` : '',
        ]
          .filter(Boolean)
          .join(' - ');
      }

      const medicationEntry = {
        id: `med-${Date.now()}`,
        kind: 'medication',
        label,
        date: entryDate,
        time: entryTime,
        medicationKind,
        medicineName: medicationKind === 'medicine' ? medicineName : insulinType,
        medicineUnit: medicationKind === 'medicine' ? medicineUnit : 'UI',
        medicineQuantity: medicationKind === 'medicine' ? medicineQuantity : insulinDose,
        medicineDays: medicationKind === 'medicine' ? medicineDays : '',
        medicineContinuousUse: medicationKind === 'medicine' ? medicineContinuousUse : false,
        insulinCategory: medicationKind === 'insulin' ? insulinCategory : '',
        insulinUsage: medicationKind === 'insulin' ? insulinUsage : '',
        insulinNotes: medicationKind === 'insulin' ? insulinNotes : '',
        storageOrigin: 'database',
      };

      if (!canResolvePatient) {
        throw new Error('Paciente sem contexto para salvar a medicação.');
      }

      const savedMedication = await addMedicationEntry(activePatientId, medicationEntry);
      setAppState((current) => ({
        ...current,
        medicationEntries: [savedMedication, ...(current.medicationEntries || [])],
      }));
      setMedicationLabel('');
      setMedicationKind('');
      handleCloseMedicationFlow();
      Alert.alert('Registro salvo', 'Medicação registrada com sucesso.');
    } catch (error) {
      console.log('Erro ao salvar medicação:', error);
      Alert.alert('Erro', 'Não foi possível salvar a medicação agora.');
    } finally {
      setSavingMedication(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
    >
      <View style={[styles.currentCard, { backgroundColor: latestStatus.cardColor }]}>
        <View style={styles.currentHeader}>
          <View>
            <Text style={[styles.currentEyebrow, styles.currentCardWhiteText]}>
              Glicose agora
            </Text>
            <Text style={[styles.currentValue, styles.currentCardWhiteText]}>
              {latestReading ? `${latestReading.value} mg/dL` : '-- mg/dL'}
            </Text>
            <Text style={[styles.currentTime, styles.currentCardWhiteText]}>
              {latestReading
                ? `Ãšltima leitura Ã s ${String(latestReading.time).slice(0, 5)}`
                : 'Sem leitura registrada'}
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: latestStatus.badgeColor }]}>
            <Ionicons name="alert-circle-outline" size={14} color="#ffffff" />
            <Text style={[styles.statusPillText, styles.currentCardWhiteText]}>
              {latestStatus.label}
            </Text>
          </View>
        </View>

        <View style={styles.currentActions}>
          <TouchableOpacity
            style={[
              styles.currentActionButton,
              styles.manualActionButton,
            ]}
            onPress={handleOpenManualChoice}
            disabled={!activePatientId}
          >
            <Text
              style={[
                styles.currentActionText,
                styles.manualActionText,
                { color: latestStatus.color },
              ]}
            >
              Registro manual
            </Text>
          </TouchableOpacity>
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

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Media</Text>
          <Text style={styles.metricValue}>{metrics.avg}</Text>
          <Text style={styles.metricUnit}>mg/dL</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Variabilidade</Text>
          <Text style={styles.metricValue}>
            {metrics.variability === '--' ? '--' : `${metrics.variability}%`}
          </Text>
          <Text style={styles.metricUnit}>amplitude</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>GMI</Text>
          <Text style={styles.metricValue}>{metrics.gmi}</Text>
          <Text style={styles.metricUnit}>estimado</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Tempo no alvo</Text>
          <Text style={styles.metricValue}>
            {metrics.tir === '--' ? '--' : `${metrics.tir}%`}
          </Text>
          <Text style={styles.metricUnit}>TIR</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Curva glicemica</Text>
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
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
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
        style={styles.libreViewStandaloneButton}
        onPress={handleSyncLibreView}
        disabled={syncingLibreView || !activePatientId}
      >
        {syncingLibreView ? (
          <ActivityIndicator color="#1F2F6B" />
        ) : (
          <>
            <View style={styles.libreViewStandaloneIcon}>
              <LibreSensorIcon />
            </View>
            <Text style={[styles.currentActionText, styles.libreViewActionText]}>
              FreeStyle Libre
            </Text>
          </>
        )}
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
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <View
              style={[
                styles.modalCard,
                styles.keyboardLiftCard,
                manualModalLift ? { transform: [{ translateY: manualModalLift }] } : null,
              ]}
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
                  focusedManualField === 'type' && styles.inputFocused,
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

            <View
              style={[
                styles.formField,
                styles.stackedFormField,
              ]}
            >
              <Text style={styles.fieldLabel}>Glicose</Text>
              <View
                style={[
                  styles.input,
                  styles.manualModalInput,
                  styles.glucoseInputWrap,
                  isPreviousGlucoseEntry && styles.labeledInput,
                  focusedManualField === 'glucose' && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.glucoseInput}
                  placeholder="Ex: 108"
                  placeholderTextColor="#8a9095"
                  keyboardType="numeric"
                  value={newGlucoseValue}
                  onChangeText={(value) => setNewGlucoseValue(formatGlucoseInput(value))}
                  onFocus={() => setFocusedManualField('glucose')}
                  onBlur={() => setFocusedManualField(null)}
                />
                {newGlucoseValue ? (
                  <Text style={styles.inputUnit}>mg/dL</Text>
                ) : null}
              </View>
            </View>

            {isPreviousGlucoseEntry ? (
              <View style={styles.previousMeasurementFields}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Data</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      focusedManualField === 'date' && styles.inputFocused,
                      showInvalidManualDate && styles.inputInvalid,
                    ]}
                    placeholder="Ex: 20/04/2026"
                    placeholderTextColor="#8a9095"
                    value={manualMeasurementDate}
                    onChangeText={(value) => setManualMeasurementDate(formatManualDateInput(value))}
                    onFocus={() => setFocusedManualField('date')}
                    onBlur={() => setFocusedManualField(null)}
                  />
                  {showInvalidManualDate ? (
                    <Text style={styles.fieldErrorText}>Data inválida</Text>
                  ) : null}
                </View>

                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Hora do uso</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.manualModalInput,
                      styles.labeledInput,
                      focusedManualField === 'time' && styles.inputFocused,
                    ]}
                    placeholder="Ex: 10:23"
                    placeholderTextColor="#8a9095"
                    value={manualMeasurementTime}
                    onChangeText={(value) => setManualMeasurementTime(formatManualTimeInput(value))}
                    onFocus={() => setFocusedManualField('time')}
                    onBlur={() => setFocusedManualField(null)}
                  />
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.modalPrimaryButton,
                savingGlucose && styles.modalPrimaryButtonDisabled,
              ]}
              onPress={handleOpenGlucoseConfirmation}
              disabled={savingGlucose}
            >
              {savingGlucose ? (
                <ActivityIndicator color={patientTheme.colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar glicemia</Text>
              )}
            </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

          {glucoseTypeDropdownVisible ? (
            <View style={styles.inlinePopupOverlay}>
              <View style={styles.glucoseTypeModalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Tipo da Glicose</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={handleCloseGlucoseTypeModal}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.glucoseTypeOptionList}>
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
                            color={patientTheme.colors.primaryDark}
                          />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {glucoseConfirmVisible ? (
            <View style={styles.inlinePopupOverlay}>
              <View style={styles.confirmCard}>
                <View style={styles.confirmIconWrap}>
                  <Ionicons
                    name="water-outline"
                    size={24}
                    color={patientTheme.colors.primaryDark}
                  />
                </View>

                <Text style={styles.confirmTitle}>Confirmar glicemia?</Text>
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
                      <Text style={styles.confirmSaveText}>Confirmar registro</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
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
        visible={medicineFormVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMedicationFlow}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <View
              style={[
                styles.modalCard,
                styles.keyboardLiftCard,
                medicineModalLift ? { transform: [{ translateY: medicineModalLift }] } : null,
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registrar medicamento</Text>
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

              <ScrollView
                style={styles.medicineFormScroll}
                contentContainerStyle={styles.medicineFormContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
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
                      setFocusedManualField('medicineName');
                      setMedicineSearchVisible(true);
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
                      setFocusedManualField('medicineUnit');
                      setMedicineUnitVisible(true);
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

                <View style={[styles.formField, styles.stackedFormField]}>
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
                    onFocus={() => setFocusedManualField('medicineQuantity')}
                    onBlur={() => setFocusedManualField(null)}
                  />
                  <Text style={styles.fieldHelperText}>{selectedMedicineUnitMeta.hint}</Text>
                </View>

                <View style={[styles.formField, styles.stackedFormField]}>
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
                    onFocus={() => setFocusedManualField('medicineTime')}
                    onBlur={() => setFocusedManualField(null)}
                  />
                </View>

                <View style={[styles.formField, styles.stackedFormField]}>
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
                    onFocus={() => setFocusedManualField('medicineDate')}
                    onBlur={() => setFocusedManualField(null)}
                  />
                </View>

                <View style={[styles.formField, styles.stackedFormField]}>
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
                    onFocus={() => setFocusedManualField('medicineDays')}
                    onBlur={() => setFocusedManualField(null)}
                  />
                </View>

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
              </ScrollView>

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
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={medicineSearchVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMedicineSearchVisible(false);
          setFocusedManualField(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Medicamento</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setMedicineSearchVisible(false);
                  setFocusedManualField(null);
                }}
              >
                <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Buscar medicamento"
              placeholderTextColor="#8a9095"
              value={medicineSearchQuery}
              onChangeText={setMedicineSearchQuery}
              autoFocus
            />

            <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={medicineUnitVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMedicineUnitVisible(false);
          setFocusedManualField(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Unidade de medida</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setMedicineUnitVisible(false);
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
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <View
              style={[
                styles.modalCard,
                styles.keyboardLiftCard,
                (medicationKind === 'insulin' ? insulinModalLift : medicationModalLift)
                  ? {
                      transform: [
                        {
                          translateY:
                            medicationKind === 'insulin' ? insulinModalLift : medicationModalLift,
                        },
                      ],
                    }
                  : null,
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {medicationKind === 'insulin' ? 'Registrar insulina' : 'Registrar medicamento'}
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
                  <Text style={styles.modalText}>
                    Registro estruturado de insulina com categoria, tipo, dose em UI, data, hora e
                    objetivo do uso.
                  </Text>

                  <ScrollView
                    style={styles.medicineFormScroll}
                    contentContainerStyle={styles.medicineFormContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={[styles.formField, styles.firstLabeledFormField]}>
                      <Text style={styles.fieldLabel}>Categoria clínica</Text>
                      <Text style={styles.fieldHelperText}>
                        {selectedInsulinCategoryMeta?.helper ||
                          'Selecione se o uso foi basal ou bolus.'}
                      </Text>
                    </View>

                    <View style={[styles.formField, styles.stackedFormField]}>
                      <Text style={styles.fieldLabel}>Tipo de insulina</Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                          styles.input,
                          styles.manualModalInput,
                          styles.labeledInput,
                          styles.dropdownButton,
                          focusedManualField === 'insulinType' && styles.inputFocused,
                        ]}
                        onPress={() => {
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
                          {insulinType || 'Selecione o tipo'}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={patientTheme.colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.formField, styles.stackedFormField]}>
                      <Text style={styles.fieldLabel}>Dose aplicada (UI)</Text>
                      <View
                        style={[
                          styles.input,
                          styles.manualModalInput,
                          styles.glucoseInputWrap,
                          styles.labeledInput,
                          focusedManualField === 'insulinDose' && styles.inputFocused,
                        ]}
                      >
                        <TextInput
                          style={styles.glucoseInput}
                          placeholder="Ex: 10"
                          placeholderTextColor="#8a9095"
                          keyboardType="numeric"
                          value={insulinDose}
                          onChangeText={(value) =>
                            setInsulinDose(formatMedicineQuantityInput(value, 'integer'))
                          }
                          onFocus={() => setFocusedManualField('insulinDose')}
                          onBlur={() => setFocusedManualField(null)}
                        />
                        {insulinDose ? <Text style={styles.inputUnit}>UI</Text> : null}
                      </View>
                    </View>

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

                    <View style={[styles.formField, styles.stackedFormField]}>
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
                        onFocus={() => setFocusedManualField('insulinTime')}
                        onBlur={() => setFocusedManualField(null)}
                      />
                    </View>

                    <View style={[styles.formField, styles.stackedFormField]}>
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
                        onFocus={() => setFocusedManualField('insulinDate')}
                        onBlur={() => setFocusedManualField(null)}
                      />
                    </View>

                    <View style={[styles.formField, styles.stackedFormField]}>
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
                        onFocus={() => setFocusedManualField('insulinNotes')}
                        onBlur={() => setFocusedManualField(null)}
                      />
                    </View>
                  </ScrollView>

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
                    Descreva o medicamento, dose ou horario para aparecer junto da curva.
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Metformina 850mg"
                    placeholderTextColor="#8a9095"
                    value={medicationLabel}
                    onChangeText={setMedicationLabel}
                    onFocus={() => setFocusedManualField('medication')}
                    onBlur={() => setFocusedManualField(null)}
                    autoFocus
                  />

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
            </View>
          </KeyboardAvoidingView>

          {insulinTypeVisible ? (
            <View style={styles.inlinePopupOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Tipo de insulina</Text>
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
      </Modal>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#FFE600',
  },
  libreViewStandaloneButton: {
    alignItems: 'center',
    backgroundColor: '#FFE600',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 46,
    position: 'relative',
    paddingHorizontal: 18,
  },
  libreViewStandaloneIcon: {
    left: 12,
    position: 'absolute',
  },
  libreViewActionText: {
    color: '#1F2F6B',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  libreSensorIconOuter: {
    alignItems: 'center',
    backgroundColor: '#E6CF00',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  libreSensorIconMiddle: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  libreSensorIconCenter: {
    backgroundColor: '#E6CF00',
    borderRadius: 4,
    height: 8,
    width: 8,
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
    backgroundColor: '#E50914',
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
    alignSelf: 'stretch',
    marginTop: 14,
    minHeight: 50,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.primary,
    borderWidth: 1,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 14,
    color: patientTheme.colors.text,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
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
    marginTop: 18,
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
  keyboardLiftCard: {
    alignSelf: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    alignSelf: 'center',
    maxWidth: 420,
    padding: 18,
    width: '100%',
    ...patientShadow,
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
    paddingHorizontal: 42,
    textAlign: 'center',
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
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
  manualModalInput: {
    alignSelf: 'stretch',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    width: '100%',
  },
  inputFocused: {
    borderColor: patientTheme.colors.primaryDark,
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
  medicineFormScroll: {
    marginTop: 10,
    maxHeight: 420,
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
    marginTop: 14,
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
    marginBottom: 10,
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
  inlinePopupOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 52, 56, 0.32)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: 22,
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
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  glucoseTypeOptionSelected: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
  },
  glucoseTypeOptionText: {
    color: patientTheme.colors.textMuted,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  glucoseTypeOptionSelectedText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
  },
  glucoseInputWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  glucoseInput: {
    color: patientTheme.colors.text,
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
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
  confirmCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    maxWidth: 420,
    padding: 20,
    width: '100%',
    ...patientShadow,
  },
  confirmIconWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  confirmTitle: {
    color: patientTheme.colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  confirmText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  confirmCancelButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmCancelText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '800',
  },
  confirmSaveButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 18,
    flex: 1.35,
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmSaveText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
  },
});
