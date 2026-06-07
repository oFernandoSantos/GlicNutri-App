import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import {
  DashboardMiniKpiCard,
  dashboardKpiStyles,
} from '../../componentes/comum/CartaoKpiDashboard';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  ensurePatientWeightHistoryPreview,
  fetchPatientExperience,
  getCachedPatientExperience,
  getPatientDisplayName,
  getPatientId,
  isPatientExperienceCacheFresh,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import { subscribeToPatientAppState } from '../../servicos/centralAppState';
import { exportPatientProgressReport, buildCountByDay, buildGlucoseDailyAverageSeries, buildGlycemicMetrics, filterReportEntriesByPeriod, getReportPeriodBounds, isInsulinMedicationEntry } from '../../servicos/servicoRelatorioPaciente';
import { alertPaciente, mostrarToastPacienteErro } from '../../servicos/servicoToastPaciente';
import {
  buildPlanAdherenceSeries,
  resolvePlanSections,
} from '../../utilitarios/vinculoPlanoRefeicao';

const WEEKDAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const PANEL_GAP = patientTheme.spacing.md;
const SECTION_INNER_GAP = patientTheme.spacing.sm;
const PROGRESS_CARD_PAD = 11;
/** Verde marca GlicNutri (#4FDFA3) — KPIs Progresso */
const GLIC_GREEN = patientTheme.colors.primary;
const PROGRESS_PERIOD_TABS = [
  { key: 'today', label: 'Hoje' },
  { key: '7days', label: '7 dias' },
  { key: '14days', label: '14 dias' },
  { key: 'search', label: 'Pesquisa' },
];

function toNumber(value, fallback = 0) {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatDecimal(value) {
  return toNumber(value).toFixed(1);
}

function formatSignedWeight(value) {
  const number = toNumber(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(1)}kg`;
}

function resolveWeightChangeRecords(periodRecords, chartRecords) {
  if (periodRecords.length >= 2) return periodRecords;
  if (chartRecords.length >= 2) return chartRecords;
  return periodRecords.length ? periodRecords : chartRecords;
}

function calculateWeightChange(records = []) {
  if (!Array.isArray(records) || records.length < 2) return 0;
  const first = toNumber(records[0]?.valueKg);
  const last = toNumber(records[records.length - 1]?.valueKg);
  return Number((first - last).toFixed(1));
}

function formatWeightChangeDisplay(change) {
  const number = toNumber(change);
  if (Math.abs(number) < 0.05) return '0.0kg';
  if (number > 0) return `-${number.toFixed(1)}kg`;
  return `+${Math.abs(number).toFixed(1)}kg`;
}

function getWeightChangeMeta(change) {
  const number = toNumber(change);
  if (Math.abs(number) < 0.05) {
    return { label: 'Peso estável', icon: 'remove-outline', color: GLIC_GREEN };
  }
  if (number > 0) {
    return { label: 'Perda de peso', icon: 'trending-down-outline', color: GLIC_GREEN };
  }
  return { label: 'Ganho de peso', icon: 'trending-up-outline', color: '#ff7a12' };
}

function getBarTone(value) {
  if (value >= 80) return patientTheme.colors.primaryDark;
  if (value >= 60) return '#ff7a12';
  return '#ff5a6b';
}

function formatDateInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function normalizeDateInput(value) {
  const rawValue = String(value || '').trim();
  const brMatch = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year = '';
  let month = '';
  let day = '';

  if (brMatch) {
    [, day, month, year] = brMatch;
  } else if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else {
    return '';
  }

  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  const validDate =
    parsedDate.getFullYear() === Number(year) &&
    parsedDate.getMonth() === Number(month) - 1 &&
    parsedDate.getDate() === Number(day);

  if (!validDate) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  const normalized = normalizeDateInput(value) || String(value || '').slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '--/--';
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function formatShortDateLabel(value) {
  const normalized = normalizeDateInput(value) || String(value || '').slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '--/--';
  const [, , month, day] = match;
  return `${day}/${month}`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(dateString, amount) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getPeriodBounds(period, startDateInput, endDateInput) {
  const today = getTodayDateString();
  let startDate = today;
  let endDate = today;

  if (period === '7days') {
    startDate = addDays(today, -6);
  } else if (period === '14days') {
    startDate = addDays(today, -13);
  } else if (period === 'search') {
    startDate = normalizeDateInput(startDateInput) || normalizeDateInput(endDateInput) || today;
    endDate = normalizeDateInput(endDateInput) || normalizeDateInput(startDateInput) || today;
  }

  if (startDate > endDate) {
    return { startDate: endDate, endDate: startDate };
  }

  return { startDate, endDate };
}

function buildDateRange(startDate, endDate) {
  const items = [];
  let current = startDate;

  while (current <= endDate) {
    items.push(current);
    current = addDays(current, 1);
  }

  return items;
}

function extractIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = normalizeDateInput(raw);
  if (normalized) return normalized;
  return normalizeDateInput(raw.slice(0, 10));
}

function filterEntriesByPeriod(items, period, startDateInput, endDateInput, getDate) {
  const { startDate, endDate } = getPeriodBounds(period, startDateInput, endDateInput);
  return (Array.isArray(items) ? items : []).filter((item) => {
    const itemDate = extractIsoDate(getDate(item));
    if (!itemDate) return false;
    return itemDate >= startDate && itemDate <= endDate;
  });
}

function ensureWeightArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildWeightHistoryRecords(weightEntries = []) {
  const byDate = new Map();

  ensureWeightArray(weightEntries).forEach((entry, index) => {
    const date = extractIsoDate(entry?.date || entry?.recordedAt || entry?.createdAt);
    const valueKg = toNumber(entry?.valueKg ?? entry?.value ?? entry?.peso_kg);
    if (!date || !(valueKg > 0)) return;

    const next = {
      id: entry?.id || `weight-entry-${date}-${index}`,
      date,
      valueKg: Number(valueKg.toFixed(1)),
      recordedAt: entry?.recordedAt || entry?.createdAt || null,
    };
    const existing = byDate.get(date);
    if (!existing || String(next.recordedAt || '') >= String(existing.recordedAt || '')) {
      byDate.set(date, next);
    }
  });

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function resolvePeriodWeightLoss(historyRecords, period, searchStartDate, searchEndDate) {
  const filtered = filterEntriesByPeriod(
    historyRecords,
    period,
    searchStartDate,
    searchEndDate,
    (item) => item?.date
  );

  if (filtered.length >= 2) {
    return filtered;
  }

  if (filtered.length === 1) {
    const { startDate } = getPeriodBounds(period, searchStartDate, searchEndDate);
    const prior = historyRecords.filter((record) => record.date < startDate);
    if (prior.length) {
      return [prior[prior.length - 1], filtered[0]];
    }
    return filtered;
  }

  const recent = historyRecords.slice(-30);
  return recent.length ? recent : filtered;
}

function buildWeightSeries({
  weightEntries = [],
  currentWeight = 0,
  period = 'today',
  searchStartDate = '',
  searchEndDate = '',
}) {
  const historyRecords = buildWeightHistoryRecords(weightEntries);
  const chartRecords = historyRecords.slice(-30);
  const lossRecords = resolvePeriodWeightLoss(
    historyRecords,
    period,
    searchStartDate,
    searchEndDate
  );
  const changeRecords = resolveWeightChangeRecords(lossRecords, chartRecords);
  const displayRecords = lossRecords.length ? lossRecords : chartRecords;

  const latestHistoryWeight = chartRecords.length
    ? toNumber(chartRecords[chartRecords.length - 1]?.valueKg)
    : 0;
  const current =
    currentWeight > 0
      ? currentWeight
      : latestHistoryWeight > 0
        ? latestHistoryWeight
        : null;
  const hasHistory = chartRecords.length > 0;
  const hasData = Number(current) > 0;

  if (!hasData) {
    return {
      initial: null,
      current: null,
      goal: null,
      loss: 0,
      hasData: false,
      hasHistory: false,
      points: [],
    };
  }

  const initial = toNumber(displayRecords[0]?.valueKg, current);
  const goal = Math.max(Number(current) - 4.8, 50);
  const weightChange = calculateWeightChange(changeRecords);
  const changeMeta = getWeightChangeMeta(weightChange);

  return {
    initial,
    current,
    goal,
    loss: weightChange,
    weightChange,
    changeLabel: changeMeta.label,
    changeIcon: changeMeta.icon,
    changeColor: changeMeta.color,
    hasData: true,
    hasHistory,
    points: chartRecords.map((record, index) => ({
      id: record.id || `weight-point-${index}`,
      label: formatShortDateLabel(record.date),
      fullLabel: formatDateLabel(record.date),
      date: record.date,
      value: Number(toNumber(record.valueKg).toFixed(1)),
    })),
  };
}

function shouldShowWeightChartLabel(index, total) {
  if (total <= 6) return true;
  if (index === 0 || index === total - 1) return true;
  const step = Math.max(Math.ceil(total / 5), 1);
  return index % step === 0;
}

function formatWeightChartValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)}kg`;
}

function countMealsByDate(mealEntries) {
  const counts = new Map();
  (Array.isArray(mealEntries) ? mealEntries : []).forEach((entry) => {
    const date = String(entry?.date || '').trim();
    const entryId = String(entry?.databaseId || entry?.id || '').trim();
    if (!date) return;
    const bucket = counts.get(date) || { total: 0, ids: new Set() };
    if (entryId && bucket.ids.has(entryId)) {
      return;
    }
    if (entryId) {
      bucket.ids.add(entryId);
    }
    bucket.total += 1;
    counts.set(date, bucket);
  });
  return counts;
}

function buildAdherenceSeries(mealEntries, targetMeals, period, startDateInput, endDateInput) {
  const safeTarget = Math.max(targetMeals || 3, 1);
  const mealCountsByDate = countMealsByDate(mealEntries);
  const { startDate, endDate } = getPeriodBounds(period, startDateInput, endDateInput);
  const range = buildDateRange(startDate, endDate);
  const items = [];
  let hasRealData = false;

  range.forEach((isoDate, index) => {
    const total = mealCountsByDate.get(isoDate)?.total || 0;
    if (total > 0) {
      hasRealData = true;
    }

    items.push({
      id: `adherence-${isoDate}`,
      label:
        period === 'today'
          ? 'Hoje'
          : period === '7days'
            ? WEEKDAY_LABELS[index % WEEKDAY_LABELS.length]
            : formatShortDateLabel(isoDate),
      value: clamp(Math.round((total / safeTarget) * 100), 0, 100),
    });
  });

  if (!hasRealData) {
    return items.map((item, index) => ({
      id: `adherence-empty-${index}`,
      label: item.label,
      value: 0,
    }));
  }

  return items;
}

function buildAchievements(weeklyAdherence, weightSeries, mealEntries, glucoseReadings) {
  let streak = 0;
  for (let index = weeklyAdherence.length - 1; index >= 0; index -= 1) {
    if (weeklyAdherence[index].value >= 80) {
      streak += 1;
    } else {
      break;
    }
  }

  const achievedWeightChange = Math.abs(weightSeries.weightChange ?? weightSeries.loss);
  const activeDays = new Set(
    (Array.isArray(mealEntries) ? mealEntries : []).map((entry) => entry?.date).filter(Boolean)
  ).size;
  const readingsCount = Array.isArray(glucoseReadings) ? glucoseReadings.length : 0;

  return [
    {
      id: 'achievement-streak',
      icon: 'trophy-outline',
      iconColor: '#d99a00',
      title: streak >= 7 ? '7 dias consecutivos' : `${Math.max(streak, 1)} dias consistentes`,
      description:
        streak >= 7
          ? 'Rotina forte de registros e adesão ao plano.'
          : 'Continue registrando refeições para aumentar sua sequência.',
      badge: streak >= 7 ? 'Novo' : null,
      tone: '#fff8e6',
      border: '#f4c86c',
    },
    {
      id: 'achievement-weight',
      icon: 'star-outline',
      iconColor: patientTheme.colors.primaryDark,
      title: achievedWeightChange >= 3 ? 'Meta em andamento' : 'Meta iniciada',
      description:
        achievedWeightChange >= 3
          ? `${formatWeightChangeDisplay(weightSeries.weightChange ?? weightSeries.loss)} de evolução no período.`
          : 'Seu plano já está gerando os primeiros sinais de progresso.',
      badge: null,
      tone: patientTheme.colors.primarySoft,
      border: patientTheme.colors.primary,
    },
    {
      id: 'achievement-glycemia',
      icon: 'flash-outline',
      iconColor: '#8a6df0',
      title: readingsCount >= 7 ? 'Controle glicêmico ativo' : 'Monitoramento em construção',
      description:
        readingsCount >= 7
          ? `${readingsCount} leituras recentes ajudando a IA a refinar os insights.`
          : 'Quanto mais leituras você fizer, melhor fica a leitura do seu padrão glicêmico.',
      badge: activeDays >= 5 ? 'Consistente' : null,
      tone: '#f7f2ff',
      border: '#d8c8ff',
    },
  ];
}

function buildMonthlySummary(appState, glucoseReadings, weeklyAdherence) {
  const mealEntries = Array.isArray(appState?.mealEntries) ? appState.mealEntries : [];
  const activeDays = new Set(mealEntries.map((entry) => entry?.date).filter(Boolean)).size;
  const notificationCount = Array.isArray(appState?.patientNotifications)
    ? appState.patientNotifications.length
    : 0;
  const readingsCount = Array.isArray(glucoseReadings) ? glucoseReadings.length : 0;
  const adherenceAverage = Math.round(
    weeklyAdherence.reduce((sum, item) => sum + item.value, 0) / Math.max(weeklyAdherence.length, 1)
  );

  return [
    {
      id: 'summary-meals',
      label: 'Refeições registradas',
      value: mealEntries.length || 0,
    },
    {
      id: 'summary-days',
      label: 'Dias ativos',
      value: activeDays || 0,
    },
    {
      id: 'summary-glucose',
      label: 'Leituras de glicose',
      value: readingsCount || 0,
    },
    {
      id: 'summary-insights',
      label: 'Adesão média',
      value: `${adherenceAverage}%`,
    },
    {
      id: 'summary-notifications',
      label: 'Alertas recebidos',
      value: notificationCount || 0,
    },
    {
      id: 'summary-water',
      label: 'Copos de água',
      value: Number(appState?.waterCount || 0),
    },
  ];
}

function buildMealRecords(mealEntries) {
  const entries = (Array.isArray(mealEntries) ? mealEntries : [])
    .slice()
    .sort((left, right) => {
      const leftStamp = `${left?.date || '1970-01-01'}T${left?.time || '00:00:00'}`;
      const rightStamp = `${right?.date || '1970-01-01'}T${right?.time || '00:00:00'}`;
      return rightStamp.localeCompare(leftStamp);
    });

  return entries.slice(0, 4).map((entry, index) => {
    const foods = Array.isArray(entry?.foods) ? entry.foods : [];
    const foodSummary = foods
      .map((item) => item?.name || item?.alimento || item?.title || '')
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');

    return {
      id: entry?.id || `meal-record-${index}`,
      date: entry?.date || '',
      time: String(entry?.time || entry?.hora || '--:--').slice(0, 5),
      title: entry?.mealLabel || entry?.mealTypeLabel || entry?.typeLabel || entry?.title || 'Refeição',
      summary: foodSummary || 'Registro alimentar do dia',
      calories: Math.round(Number(entry?.calories || entry?.kcal || 0)) || 0,
      fiber: Math.round(Number(entry?.fiberG || 0)) || 0,
      sugars: Math.round(Number(entry?.sugarsG || 0)) || 0,
      sodium: Math.round(Number(entry?.sodiumMg || 0)) || 0,
    };
  });
}

function WeightChart({ points }) {
  const chartHeight = 136;
  const [chartWidth, setChartWidth] = useState(0);
  const max = Math.max(...points.map((point) => point.value)) + 1;
  const min = Math.min(...points.map((point) => point.value)) - 1;
  const range = Math.max(max - min, 1);
  const innerWidth = Math.max(chartWidth - 32, 1);
  const innerHeight = chartHeight - 50;

  const positioned = points.map((point, index) => {
    const x =
      16 + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = 12 + (1 - (point.value - min) / range) * innerHeight;
    return { ...point, x, y };
  });

  return (
    <View
      style={styles.chartCardFrame}
      onLayout={({ nativeEvent }) => setChartWidth(nativeEvent.layout.width)}
    >
      {[0, 1, 2].map((line) => (
        <View
          key={`grid-${line}`}
          style={[
            styles.chartGridLine,
            {
              top: 20 + line * 28,
            },
          ]}
        />
      ))}

      {chartWidth > 0 &&
        positioned.slice(1).map((point, index) => {
        const previous = positioned[index];
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = `${Math.atan2(dy, dx)}rad`;

        return (
          <View
            key={`${point.id}-line`}
            style={[
              styles.weightLine,
              {
                left: previous.x + dx / 2 - length / 2,
                top: previous.y + dy / 2 - 1,
                width: length,
                transform: [{ rotate: angle }],
              },
            ]}
          />
        );
      })}

      {chartWidth > 0 &&
        positioned.map((point, index) => (
        <React.Fragment key={point.id}>
          <Text
            style={[
              styles.weightValueTag,
              {
                left: point.x - 22,
                top: Math.max(4, point.y - 24),
              },
            ]}
          >
            {formatWeightChartValue(point.value)}
          </Text>
          <View style={[styles.weightDot, { left: point.x - 3, top: point.y - 3 }]} />
          {shouldShowWeightChartLabel(index, positioned.length) ? (
            <Text style={[styles.weightLabel, { left: point.x - 14 }]}>{point.label}</Text>
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function CountBars({ items, emptyLabel = 'Sem registros no período.' }) {
  if (!items?.length) {
    return <Text style={styles.emptyStateText}>{emptyLabel}</Text>;
  }

  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);

  return (
    <View style={[styles.adherenceChartWrap, styles.chartBlock]}>
      <View style={styles.adherenceBarsRow}>
        {items.map((item) => (
          <View key={item.id || item.label} style={styles.adherenceBarColumn}>
            <View style={styles.adherenceBarTrack}>
              <View
                style={[
                  styles.adherenceBarFill,
                  {
                    height: `${Math.max(8, (Number(item.value) / max) * 100)}%`,
                    backgroundColor: item.color || patientTheme.colors.primaryDark,
                  },
                ]}
              />
            </View>
            <Text style={styles.adherenceBarLabel}>{item.label}</Text>
            <Text style={styles.adherenceBarPercent}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AdherenceBars({ items }) {
  if (!items?.length) {
    return <Text style={styles.emptyStateText}>Sem dados de adesão no período.</Text>;
  }

  return (
    <View style={[styles.adherenceChartWrap, styles.chartBlock]}>
      <View style={styles.adherenceBarsRow}>
        {items.map((item) => (
          <View key={item.id} style={styles.adherenceBarColumn}>
            <View style={styles.adherenceBarTrack}>
              <View
                style={[
                  styles.adherenceBarFill,
                  {
                    height: `${item.value}%`,
                    backgroundColor: getBarTone(item.value),
                  },
                ]}
              />
            </View>
            <Text style={styles.adherenceBarLabel}>{item.label}</Text>
            <Text style={styles.adherenceBarPercent}>{item.value}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PacienteProgressoScreen({
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
  const progressoFetchLimits = useMemo(() => mesclarLimitesDadosPaciente('progresso'), []);
  const cachedProgressoInicial = useMemo(
    () => (patientId ? getCachedPatientExperience(patientId, progressoFetchLimits) : null),
    [patientId, progressoFetchLimits]
  );

  const [loading, setLoading] = useState(!cachedProgressoInicial);
  const [patient, setPatient] = useState(cachedProgressoInicial?.patient || null);
  const [appState, setAppState] = useState(
    cachedProgressoInicial?.appState || createDefaultAppState()
  );
  const [glucoseReadings, setGlucoseReadings] = useState(
    cachedProgressoInicial?.glucoseReadings || []
  );
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const hasLoadedRef = useRef(false);
  const weightPreviewSeededRef = useRef(false);

  const applyWeightHistoryPreview = useCallback(
    async (experience) => {
      const activePatientId = experience?.patient?.id_paciente_uuid || patientId;
      const currentWeight = toNumber(experience?.patient?.peso_atual_kg, 0);
      if (!activePatientId || !(currentWeight > 0) || weightPreviewSeededRef.current) {
        return experience?.appState || createDefaultAppState();
      }

      weightPreviewSeededRef.current = true;
      const seededAppState = await ensurePatientWeightHistoryPreview(activePatientId, currentWeight, {
        patientContext: usuarioLogado,
      });

      return seededAppState || experience?.appState || createDefaultAppState();
    },
    [patientId, usuarioLogado]
  );

  const loadProgresso = useCallback(
    async ({ silent = false, forceRefresh = false } = {}) => {
      try {
        if (!silent) setLoading(true);

        if (!canResolvePatient) {
          setPatient(null);
          setAppState(createDefaultAppState());
          setGlucoseReadings([]);
          return;
        }

        const cachedExperience =
          !forceRefresh && patientId
            ? getCachedPatientExperience(patientId, progressoFetchLimits)
            : null;
        const cacheFresco =
          patientId && isPatientExperienceCacheFresh(patientId, progressoFetchLimits);

        if (cachedExperience) {
          const previewAppState = await applyWeightHistoryPreview(cachedExperience);
          setPatient(cachedExperience.patient || null);
          setAppState(previewAppState);
          setGlucoseReadings(cachedExperience.glucoseReadings || []);

          if (cacheFresco && !forceRefresh) {
            return;
          }

          fetchPatientExperience(patientId, {
            patientContext: usuarioLogado,
            forceRefresh: forceRefresh || !cacheFresco,
            ...progressoFetchLimits,
          })
            .then(async (experience) => {
              const nextAppState = await applyWeightHistoryPreview(experience);
              setPatient(experience?.patient || null);
              setAppState(nextAppState);
              setGlucoseReadings(experience?.glucoseReadings || []);
            })
            .catch((error) => console.log('Refresh progresso:', error));
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
          forceRefresh,
          ...progressoFetchLimits,
        });

        const nextAppState = await applyWeightHistoryPreview(experience);
        setPatient(experience?.patient || null);
        setAppState(nextAppState);
        setGlucoseReadings(experience?.glucoseReadings || []);
      } catch (error) {
        console.log('Erro ao carregar progresso:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applyWeightHistoryPreview, canResolvePatient, patientId, progressoFetchLimits, usuarioLogado]
  );

  useFocusEffect(
    useCallback(() => {
      const cacheFresco =
        patientId && isPatientExperienceCacheFresh(patientId, progressoFetchLimits);
      loadProgresso({
        silent: hasLoadedRef.current || cacheFresco,
        forceRefresh: false,
      });
      hasLoadedRef.current = true;
    }, [loadProgresso, patientId, progressoFetchLimits])
  );

  useEffect(() => {
    const activePatientId = patient?.id_paciente_uuid || patientId;
    if (!activePatientId) return undefined;

    return subscribeToPatientAppState(activePatientId, (nextAppState) => {
      if (nextAppState) {
        setAppState(nextAppState);
      }
    });
  }, [patient?.id_paciente_uuid, patientId]);

  const periodBounds = useMemo(
    () => getReportPeriodBounds(selectedPeriod, searchStartDate, searchEndDate),
    [selectedPeriod, searchStartDate, searchEndDate]
  );

  const filteredMealEntries = useMemo(
    () =>
      filterReportEntriesByPeriod(
        appState?.mealEntries,
        selectedPeriod,
        searchStartDate,
        searchEndDate
      ),
    [appState?.mealEntries, selectedPeriod, searchStartDate, searchEndDate]
  );

  const filteredGlucoseReadings = useMemo(
    () =>
      filterReportEntriesByPeriod(
        glucoseReadings,
        selectedPeriod,
        searchStartDate,
        searchEndDate
      ),
    [glucoseReadings, selectedPeriod, searchStartDate, searchEndDate]
  );

  const filteredMedicationEntries = useMemo(
    () =>
      filterReportEntriesByPeriod(
        appState?.medicationEntries,
        selectedPeriod,
        searchStartDate,
        searchEndDate
      ),
    [appState?.medicationEntries, selectedPeriod, searchStartDate, searchEndDate]
  );

  const filteredInsulinEntries = useMemo(
    () => filteredMedicationEntries.filter(isInsulinMedicationEntry),
    [filteredMedicationEntries]
  );

  const filteredPureMedicationEntries = useMemo(
    () => filteredMedicationEntries.filter((entry) => !isInsulinMedicationEntry(entry)),
    [filteredMedicationEntries]
  );

  const filteredNotifications = useMemo(
    () =>
      filterEntriesByPeriod(
        appState?.patientNotifications,
        selectedPeriod,
        searchStartDate,
        searchEndDate,
        (item) => item?.date || item?.created_at || item?.createdAt
      ),
    [appState?.patientNotifications, selectedPeriod, searchStartDate, searchEndDate]
  );

  const filteredAppState = useMemo(
    () => ({
      ...appState,
      mealEntries: filteredMealEntries,
      patientNotifications: filteredNotifications,
    }),
    [appState, filteredMealEntries, filteredNotifications]
  );

  function handleSelectPeriod(periodKey) {
    setSelectedPeriod(periodKey);
    if (periodKey === 'search' && !searchStartDate && !searchEndDate) {
      const today = formatDateLabel(getTodayDateString());
      setSearchStartDate(today);
      setSearchEndDate(today);
    }
  }

  const periodLabel = useMemo(() => {
    if (selectedPeriod === 'today') return 'Hoje';
    if (selectedPeriod === '7days') return '7 dias';
    if (selectedPeriod === '14days') return '14 dias';
    return `${formatShortDateLabel(periodBounds.startDate)} - ${formatShortDateLabel(periodBounds.endDate)}`;
  }, [periodBounds.endDate, periodBounds.startDate, selectedPeriod]);

  const planSections = useMemo(
    () => resolvePlanSections({ mealPlan: appState?.activeMealPlan, appState }),
    [appState]
  );
  const adherenceSeries = useMemo(
    () => {
      const { items } = buildPlanAdherenceSeries({
        mealEntries: appState?.mealEntries,
        sections: planSections,
        startDate: periodBounds.startDate,
        endDate: periodBounds.endDate,
        labelForDate: (isoDate, index) =>
          selectedPeriod === 'today'
            ? 'Hoje'
            : selectedPeriod === '7days'
              ? WEEKDAY_LABELS[index % WEEKDAY_LABELS.length]
              : formatShortDateLabel(isoDate),
      });
      return items;
    },
    [appState?.mealEntries, periodBounds.endDate, periodBounds.startDate, planSections, selectedPeriod]
  );
  const adherenceAverage = Math.round(
    adherenceSeries.reduce((sum, item) => sum + item.value, 0) / Math.max(adherenceSeries.length, 1)
  );
  const weightSeries = useMemo(
    () =>
      buildWeightSeries({
        weightEntries: appState?.weightEntries,
        currentWeight: toNumber(patient?.peso_atual_kg, 0),
        period: selectedPeriod,
        searchStartDate,
        searchEndDate,
      }),
    [
      appState?.weightEntries,
      patient?.peso_atual_kg,
      searchEndDate,
      searchStartDate,
      selectedPeriod,
    ]
  );
  const glycemicMetrics = useMemo(
    () => buildGlycemicMetrics(filteredGlucoseReadings),
    [filteredGlucoseReadings]
  );
  const achievements = useMemo(
    () =>
      buildAchievements(adherenceSeries, weightSeries, filteredMealEntries, filteredGlucoseReadings),
    [adherenceSeries, weightSeries, filteredMealEntries, filteredGlucoseReadings]
  );
  const monthlySummary = useMemo(
    () => buildMonthlySummary(filteredAppState, filteredGlucoseReadings, adherenceSeries),
    [filteredAppState, filteredGlucoseReadings, adherenceSeries]
  );
  const periodMealRecords = useMemo(
    () => buildMealRecords(filteredMealEntries),
    [filteredMealEntries]
  );
  const glucoseDailySeries = useMemo(
    () =>
      buildGlucoseDailyAverageSeries(filteredGlucoseReadings).map((item) => ({
        ...item,
        id: `glucose-${item.date}`,
        color:
          item.value < 70 ? '#fc8181' : item.value > 180 ? '#ed8936' : patientTheme.colors.primaryDark,
      })),
    [filteredGlucoseReadings]
  );
  const mealsDailySeries = useMemo(
    () =>
      buildCountByDay(filteredMealEntries, (entry) => entry?.date).map((item) => ({
        ...item,
        id: `meal-${item.date}`,
        color: '#4299e1',
      })),
    [filteredMealEntries]
  );
  const insulinDailySeries = useMemo(
    () =>
      buildCountByDay(filteredInsulinEntries, (entry) => entry?.date).map((item) => ({
        ...item,
        id: `insulin-${item.date}`,
        color: '#9f7aea',
      })),
    [filteredInsulinEntries]
  );
  const medicationDailySeries = useMemo(
    () =>
      buildCountByDay(filteredPureMedicationEntries, (entry) => entry?.date).map((item) => ({
        ...item,
        id: `med-${item.date}`,
        color: '#ed8936',
      })),
    [filteredPureMedicationEntries]
  );
  const [exportingReport, setExportingReport] = useState(false);

  async function handleExportProgress() {
    try {
      setExportingReport(true);

      let exportMeals = filteredMealEntries;
      let exportGlucose = filteredGlucoseReadings;
      let exportMedication = filteredMedicationEntries;
      let exportMetrics = glycemicMetrics;
      const activePatientId = patient?.id_paciente_uuid || patientId;

      if (activePatientId) {
        const experience = await fetchPatientExperience(activePatientId, {
          patientContext: usuarioLogado,
          forceRefresh: true,
          ...progressoFetchLimits,
        });

        exportMeals = filterReportEntriesByPeriod(
          experience?.appState?.mealEntries,
          selectedPeriod,
          searchStartDate,
          searchEndDate
        );
        if (!exportMeals.length && filteredMealEntries.length) {
          exportMeals = filteredMealEntries;
        }
        exportGlucose = filterReportEntriesByPeriod(
          experience?.glucoseReadings,
          selectedPeriod,
          searchStartDate,
          searchEndDate
        );
        exportMedication = filterReportEntriesByPeriod(
          experience?.appState?.medicationEntries,
          selectedPeriod,
          searchStartDate,
          searchEndDate
        );
        exportMetrics = buildGlycemicMetrics(exportGlucose);
      }

      const result = await exportPatientProgressReport({
        patient: patient || usuarioLogado,
        patientName: getPatientDisplayName(patient || usuarioLogado),
        generatedAt: new Date().toLocaleString('pt-BR'),
        periodLabel,
        periodBounds,
        period: selectedPeriod,
        startDate: searchStartDate,
        endDate: searchEndDate,
        weightSeries,
        weeklyAdherence: adherenceSeries,
        glycemicMetrics: exportMetrics,
        monthlySummary: {
          adherenceAverage,
          activeDays: new Set(exportMeals.map((entry) => entry?.date).filter(Boolean)).size,
          summaryItems: monthlySummary,
        },
        achievements,
        mealEntries: exportMeals,
        glucoseReadings: exportGlucose,
        medicationEntries: exportMedication,
      }, { format: 'pdf' });
      if (result?.ok) {
        alertPaciente(
          'Relatório pronto',
          Platform.OS === 'web'
            ? 'O PDF foi baixado com seus dados do período.'
            : 'Use compartilhar para salvar o PDF no celular.'
        );
      }
    } catch (error) {
      mostrarToastPacienteErro(error, 'Não foi possível exportar seu relatório agora.');
    } finally {
      setExportingReport(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      showTabBar={false}
      contentContainerStyle={styles.contentContainer}
    >
      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando progresso...</Text>
        </View>
      ) : null}

      {!loading ? (
        <View style={styles.pageStack}>
          <View style={styles.toolbarPanel}>
            <View style={styles.periodSelectorWrap}>
              {PROGRESS_PERIOD_TABS.map((item) => {
                const active = selectedPeriod === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.periodChip, active && styles.periodChipActive]}
                    activeOpacity={0.88}
                    onPress={() => handleSelectPeriod(item.key)}
                  >
                    <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedPeriod === 'search' ? (
              <View style={styles.searchFiltersCard}>
              <View style={styles.searchDateRow}>
                <View style={styles.searchDateField}>
                  <Text style={styles.searchDateLabel}>Data inicial</Text>
                  <TextInput
                    style={styles.searchDateInput}
                    value={searchStartDate}
                    onChangeText={(value) => setSearchStartDate(formatDateInput(value))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={patientTheme.colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
                <View style={styles.searchDateField}>
                  <Text style={styles.searchDateLabel}>Data final</Text>
                  <TextInput
                    style={styles.searchDateInput}
                    value={searchEndDate}
                    onChangeText={(value) => setSearchEndDate(formatDateInput(value))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={patientTheme.colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>
              <Text style={styles.searchDateHint}>
                Exibindo progresso de {formatDateLabel(periodBounds.startDate)} até {formatDateLabel(periodBounds.endDate)}.
              </Text>
              </View>
            ) : null}
          </View>

          <View style={[dashboardKpiStyles.grid, styles.overviewKpiGrid]}>
            <View style={[dashboardKpiStyles.cell, styles.overviewMetricCell]}>
              <View style={styles.overviewMetricCard}>
                <View style={styles.overviewMetricIconRow}>
                  <Ionicons
                    name={weightSeries.changeIcon || 'trending-down-outline'}
                    size={17}
                    color={weightSeries.changeColor || GLIC_GREEN}
                  />
                </View>
                <Text style={styles.overviewMetricLabel}>
                  {weightSeries.changeLabel || 'Perda de peso'}
                </Text>
                <Text
                  style={[
                    styles.overviewMetricValue,
                    { color: weightSeries.changeColor || GLIC_GREEN },
                  ]}
                >
                  {weightSeries.hasData
                    ? formatWeightChangeDisplay(weightSeries.weightChange ?? weightSeries.loss)
                    : '—'}
                </Text>
                <View
                  style={[
                    styles.overviewMetricAccentBar,
                    { backgroundColor: weightSeries.changeColor || GLIC_GREEN },
                  ]}
                />
              </View>
            </View>
            <View style={[dashboardKpiStyles.cell, styles.overviewMetricCell]}>
              <View style={styles.overviewMetricCard}>
                <View style={styles.overviewMetricIconRow}>
                  <Ionicons name="analytics-outline" size={17} color={GLIC_GREEN} />
                </View>
                <Text style={styles.overviewMetricLabel}>Adesão média</Text>
                <Text style={[styles.overviewMetricValue, { color: GLIC_GREEN }]}>
                  {`${adherenceAverage}%`}
                </Text>
                <View
                  style={[styles.overviewMetricAccentBar, { backgroundColor: GLIC_GREEN }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sua evolução</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>
                  {weightSeries.hasData
                    ? formatWeightChangeDisplay(weightSeries.weightChange ?? weightSeries.loss)
                    : 'Sem peso'}
                </Text>
              </View>
            </View>

            {weightSeries.hasData ? (
              <>
                <View style={styles.weightStatsRow}>
                  <View style={styles.weightStat}>
                    <Text style={styles.weightStatLabel}>Atual</Text>
                    <Text style={[styles.weightStatValue, styles.weightStatValueHighlight]}>
                      {formatDecimal(weightSeries.current)}kg
                    </Text>
                  </View>
                  <View style={styles.weightStat}>
                    <Text style={styles.weightStatLabel}>Meta sugerida</Text>
                    <Text style={styles.weightStatValue}>{formatDecimal(weightSeries.goal)}kg</Text>
                  </View>
                </View>

                {weightSeries.hasHistory ? (
                  <WeightChart points={weightSeries.points} />
                ) : (
                  <Text style={styles.emptyStateText}>
                    Salve seu peso no perfil em dias diferentes para ver o histórico no gráfico.
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.emptyStateText}>
                Informe seu peso no perfil para acompanhar a evolução.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Registros do período</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>
                  {periodMealRecords.length} refeiç{periodMealRecords.length === 1 ? 'ão' : 'ões'}
                </Text>
              </View>
            </View>

            {periodMealRecords.length ? (
              <View style={styles.todayMealsList}>
                {periodMealRecords.map((item) => (
                  <View key={item.id} style={styles.todayMealCard}>
                    <View style={styles.todayMealTimeBlock}>
                      <Text style={styles.todayMealTimeLabel}>
                        {selectedPeriod === 'today' ? 'Horario' : 'Data'}
                      </Text>
                      <Text style={styles.todayMealTimeValue}>{selectedPeriod === 'today' ? item.time : formatShortDateLabel(item.date)}</Text>
                    </View>

                    <View style={styles.todayMealCopy}>
                      <Text style={styles.todayMealTitle}>{item.title}</Text>
                      <Text style={styles.todayMealSummary}>
                        {selectedPeriod === 'today' ? item.summary : `${item.time} - ${item.summary}`}
                      </Text>
                      <View style={styles.todayMealBadge}>
                        <Text style={styles.todayMealBadgeText}>{item.calories} kcal</Text>
                      </View>
                      {(item.fiber || item.sugars || item.sodium) ? (
                        <Text style={styles.todayMealSummary}>
                          Fibra {item.fiber}g · Açúcares {item.sugars}g · Sódio {item.sodium}mg
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyStateText}>Nenhum registro alimentar encontrado no período.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Adesão ao plano</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{adherenceAverage}%</Text>
              </View>
            </View>

            <AdherenceBars items={adherenceSeries} />
            <Text style={styles.sectionFootnote}>Média do período: {adherenceAverage}%</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="pulse-outline"
                  size={13}
                  color={GLIC_GREEN}
                />
                <Text style={styles.sectionTitle}>Controle glicêmico</Text>
              </View>
            </View>

            {glycemicMetrics.hasData ? (
              <>
                <View style={styles.glycemicTirBlock}>
                  <View style={styles.glycemicTrackHeader}>
                    <Text style={styles.glycemicTrackLabel}>Tempo no alvo</Text>
                    <Text style={styles.glycemicTrackValue}>{glycemicMetrics.tir}%</Text>
                  </View>
                  <View style={styles.glycemicTrack}>
                    <View
                      style={[
                        styles.glycemicTrackFill,
                        { width: `${clamp(glycemicMetrics.tir, 0, 100)}%` },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.subsectionDivider} />

                <View style={styles.progressMiniRow}>
                  <View style={[dashboardKpiStyles.miniCell, styles.progressMiniCell]}>
                    <DashboardMiniKpiCard
                      label="Média"
                      value={String(glycemicMetrics.average)}
                      helper="mg/dL"
                      accent={GLIC_GREEN}
                      style={styles.progressMiniCard}
                      labelStyle={styles.progressMiniLabel}
                      valueStyle={styles.progressMiniValue}
                      helperStyle={styles.progressMiniHelper}
                      accentBarStyle={styles.progressMiniAccentBar}
                    />
                  </View>
                  <View style={[dashboardKpiStyles.miniCell, styles.progressMiniCell]}>
                    <DashboardMiniKpiCard
                      label="A1C estimada"
                      value={glycemicMetrics.gmi?.toFixed(1) ?? '—'}
                      helper="%"
                      accent={GLIC_GREEN}
                      style={styles.progressMiniCard}
                      labelStyle={styles.progressMiniLabel}
                      valueStyle={styles.progressMiniValue}
                      helperStyle={styles.progressMiniHelper}
                      accentBarStyle={styles.progressMiniAccentBar}
                    />
                  </View>
                  <View style={[dashboardKpiStyles.miniCell, styles.progressMiniCell]}>
                    <DashboardMiniKpiCard
                      label="Variabilidade"
                      value={String(glycemicMetrics.variability)}
                      helper="mg/dL"
                      accent={GLIC_GREEN}
                      style={styles.progressMiniCard}
                      labelStyle={styles.progressMiniLabel}
                      valueStyle={styles.progressMiniValue}
                      helperStyle={styles.progressMiniHelper}
                      accentBarStyle={styles.progressMiniAccentBar}
                    />
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.emptyStateText}>
                Registre glicemias no monitoramento para ver tendências aqui.
              </Text>
            )}

            {glycemicMetrics.hasData ? (
              <View style={styles.chartSection}>
                <View style={styles.subsectionDivider} />
                <Text style={styles.chartSectionTitle}>Média diária no período</Text>
                <CountBars items={glucoseDailySeries} emptyLabel="Sem leituras para gráfico." />
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="water-outline" size={13} color="#9f7aea" />
                <Text style={styles.sectionTitle}>Insulina</Text>
              </View>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{filteredInsulinEntries.length} registro(s)</Text>
              </View>
            </View>
            <CountBars
              items={insulinDailySeries}
              emptyLabel="Nenhuma aplicação de insulina no período."
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="medkit-outline" size={13} color="#ed8936" />
                <Text style={styles.sectionTitle}>Medicação</Text>
              </View>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{filteredPureMedicationEntries.length} registro(s)</Text>
              </View>
            </View>
            <CountBars
              items={medicationDailySeries}
              emptyLabel="Nenhuma medicação registrada no período."
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="restaurant-outline" size={13} color="#4299e1" />
                <Text style={styles.sectionTitle}>Alimentação no período</Text>
              </View>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{filteredMealEntries.length} refeição(ões)</Text>
              </View>
            </View>
            <CountBars items={mealsDailySeries} emptyLabel="Sem refeições para gráfico." />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="trophy-outline" size={13} color={patientTheme.colors.warning} />
                <Text style={styles.sectionTitle}>Conquistas</Text>
              </View>
            </View>

            <View style={styles.achievementsList}>
            {achievements.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.achievementCard,
                  {
                    backgroundColor: item.tone,
                    borderColor: item.border,
                  },
                ]}
              >
                <View style={styles.achievementIconWrap}>
                  <Ionicons name={item.icon} size={15} color={item.iconColor} />
                </View>
                <View style={styles.achievementCopy}>
                  <Text style={styles.achievementTitle}>{item.title}</Text>
                  <Text style={styles.achievementText}>{item.description}</Text>
                </View>
                {item.badge ? (
                  <View style={styles.achievementBadge}>
                    <Text style={styles.achievementBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Resumo do período</Text>

            <View style={styles.summaryGrid}>
              {monthlySummary.map((item) => (
                <View key={item.id} style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{item.value}</Text>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => navigation.navigate('PacientePlano', { usuarioLogado })}
              style={styles.summaryButton}
            >
              <Ionicons
                name="nutrition-outline"
                size={16}
                color={patientTheme.colors.onPrimary}
              />
              <Text style={styles.summaryButtonText}>Ver plano alimentar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.exportPanel}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportProgress}
              disabled={exportingReport}
              activeOpacity={0.9}
            >
              {exportingReport ? (
                <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
              ) : (
                <Ionicons name="download-outline" size={18} color={patientTheme.colors.onPrimary} />
              )}
              <Text style={styles.exportButtonText}>
                {exportingReport ? 'Gerando PDF…' : 'Baixar relatório PDF'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.exportHint}>
              Glicose, alimentação, insulina e medicação do período selecionado.
            </Text>
          </View>
        </View>
      ) : null}
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: patientTheme.spacing.xl + 8,
  },
  pageStack: {
    gap: PANEL_GAP,
  },
  toolbarPanel: {
    gap: SECTION_INNER_GAP,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    marginTop: 4,
    padding: 16,
    ...patientShadow,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  overviewKpiGrid: {
    marginBottom: 0,
  },
  exportPanel: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: 8,
    padding: PROGRESS_CARD_PAD,
    ...patientShadow,
  },
  exportButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  exportButtonText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  exportHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  periodSelectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodChip: {
    flex: 1,
    minWidth: 64,
    minHeight: 34,
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 8,
    ...patientShadow,
  },
  periodChipActive: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  periodChipText: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  periodChipTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  searchFiltersCard: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    padding: SECTION_INNER_GAP,
  },
  searchDateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchDateField: {
    flex: 1,
  },
  searchDateLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  searchDateInput: {
    minHeight: 38,
    borderRadius: patientTheme.radius.md,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    color: patientTheme.colors.text,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
  },
  searchDateHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  overviewMetricCell: {
    minWidth: 0,
  },
  overviewMetricCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 104,
    paddingHorizontal: 10,
    paddingVertical: 12,
    ...patientShadow,
  },
  overviewMetricIconRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  overviewMetricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  overviewMetricValue: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  overviewMetricAccentBar: {
    marginTop: 7,
    width: 24,
    height: 2,
    borderRadius: 999,
  },
  topMetricCard: {
    flex: 1,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    padding: 16,
    ...patientShadow,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  topMetricCardPrimary: {
    backgroundColor: patientTheme.colors.surface,
  },
  topMetricValue: {
    color: patientTheme.colors.primaryDark,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  topMetricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: SECTION_INNER_GAP,
    padding: PROGRESS_CARD_PAD,
    ...patientShadow,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  subsectionDivider: {
    backgroundColor: patientTheme.colors.border,
    height: 1,
    opacity: 0.65,
    width: '100%',
  },
  chartSection: {
    gap: 12,
  },
  chartSectionTitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  chartBlock: {
    marginTop: 0,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  badgeSoft: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeSoftText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '700',
  },
  weightStatsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weightStat: {
    flex: 1,
  },
  weightStatLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  weightStatValue: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  weightStatValueHighlight: {
    color: GLIC_GREEN,
  },
  chartCardFrame: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    height: 158,
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  chartGridLine: {
    backgroundColor: patientTheme.colors.border,
    height: 1,
    left: 12,
    opacity: 0.7,
    position: 'absolute',
    right: 12,
  },
  weightLine: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 999,
    height: 2,
    position: 'absolute',
  },
  weightDot: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.primaryDark,
    borderRadius: 999,
    borderWidth: 2,
    height: 6,
    position: 'absolute',
    width: 6,
  },
  weightValueTag: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 6,
    color: patientTheme.colors.primaryDark,
    fontSize: 9,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: 'absolute',
    textAlign: 'center',
    width: 44,
  },
  weightLabel: {
    bottom: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    position: 'absolute',
    width: 32,
    textAlign: 'center',
  },
  adherenceChartWrap: {
    paddingTop: 4,
  },
  adherenceBarsRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  adherenceBarColumn: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  adherenceBarTrack: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 84,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '72%',
    maxWidth: 24,
  },
  adherenceBarFill: {
    borderRadius: 8,
    width: '100%',
  },
  adherenceBarLabel: {
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  adherenceBarPercent: {
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  sectionFootnote: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'center',
  },
  todayMealsList: {
    gap: 8,
  },
  todayMealCard: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
  },
  todayMealTimeBlock: {
    width: 44,
    marginRight: 8,
  },
  todayMealTimeLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    marginBottom: 1,
  },
  todayMealTimeValue: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 19,
  },
  todayMealCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayMealTitle: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  todayMealSummary: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  todayMealBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayMealBadgeText: {
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyMealText: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyStateText: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 10,
    paddingVertical: 11,
    textAlign: 'center',
  },
  glycemicTirBlock: {
    gap: 10,
  },
  glycemicTrackHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glycemicTrackLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  glycemicTrackValue: {
    color: GLIC_GREEN,
    fontSize: 17,
    fontWeight: '700',
  },
  glycemicTrack: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    height: 9,
    marginTop: 7,
    overflow: 'hidden',
  },
  glycemicTrackFill: {
    backgroundColor: GLIC_GREEN,
    borderRadius: patientTheme.radius.pill,
    height: '100%',
  },
  progressMiniRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 0,
  },
  progressMiniCell: {
    minWidth: 0,
  },
  progressMiniCard: {
    minWidth: 0,
    minHeight: 86,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderWidth: 1,
    ...patientShadow,
  },
  progressMiniLabel: {
    minHeight: 20,
    fontSize: 10,
    lineHeight: 12,
  },
  progressMiniValue: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 17,
  },
  progressMiniHelper: {
    minHeight: 13,
    marginTop: 2,
    fontSize: 9,
    lineHeight: 10,
  },
  progressMiniAccentBar: {
    marginTop: 6,
    width: 22,
  },
  glycemicMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  glycemicMetricCard: {
    flex: 1,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    padding: 9,
  },
  glycemicMetricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  glycemicMetricValue: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  glycemicMetricUnit: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  achievementsList: {
    gap: 8,
  },
  achievementCard: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
  },
  achievementIconWrap: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 24,
  },
  achievementCopy: {
    flex: 1,
    paddingLeft: 8,
    paddingRight: 12,
  },
  achievementTitle: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  achievementText: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  achievementBadge: {
    backgroundColor: '#fff3cf',
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  achievementBadgeText: {
    color: '#b27b00',
    fontSize: 10,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: SECTION_INNER_GAP,
    padding: PROGRESS_CARD_PAD,
    ...patientShadow,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 78,
    paddingHorizontal: 8,
    paddingVertical: 10,
    width: '47.5%',
  },
  summaryValue: {
    color: patientTheme.colors.primaryDark,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  summaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
    minHeight: 40,
  },
  summaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
});
