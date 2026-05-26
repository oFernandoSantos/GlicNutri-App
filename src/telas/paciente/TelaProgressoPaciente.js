import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getPatientDisplayName,
  getPatientId,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import { mergeCachedGlucoseReadings } from '../../servicos/centralGlicose';
import { subscribeToPatientAppState } from '../../servicos/centralAppState';
import { exportPatientProgressReport } from '../../servicos/servicoRelatorioPaciente';

const WEEKDAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
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

function buildWeightSeries(currentWeight) {
  if (!(currentWeight > 0)) {
    return {
      initial: null,
      current: null,
      goal: null,
      loss: 0,
      hasData: false,
      points: [],
    };
  }

  const current = currentWeight;
  const initial = current;
  const goal = Math.max(current - 4.8, 50);

  return {
    initial,
    current,
    goal,
    loss: 0,
    hasData: true,
    points: [
      {
        id: 'weight-current',
        label: 'Atual',
        value: Number(current.toFixed(1)),
      },
    ],
  };
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

function buildGlycemicMetrics(glucoseReadings) {
  const values = mergeCachedGlucoseReadings(Array.isArray(glucoseReadings) ? glucoseReadings : [])
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) {
    return {
      average: null,
      gmi: null,
      variability: null,
      tir: null,
      total: 0,
      hasData: false,
    };
  }

  const total = values.length;
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / total);
  const inRange = values.filter((value) => value >= 70 && value <= 180).length;
  const tir = Math.round((inRange / total) * 100);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(total, 1);
  const variability = Math.round(Math.sqrt(variance));
  const gmi = (3.31 + 0.02392 * average).toFixed(1);

  return {
    average,
    gmi: Number(gmi),
    variability,
    tir,
    total,
    hasData: true,
  };
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

  const achievedWeightLoss = Math.abs(weightSeries.loss);
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
          ? 'Rotina forte de registros e adesao ao plano.'
          : 'Continue registrando refeicoes para aumentar sua sequencia.',
      badge: streak >= 7 ? 'Novo' : null,
      tone: '#fff8e6',
      border: '#f4c86c',
    },
    {
      id: 'achievement-weight',
      icon: 'star-outline',
      iconColor: patientTheme.colors.primaryDark,
      title: achievedWeightLoss >= 3 ? 'Meta em andamento' : 'Meta iniciada',
      description:
        achievedWeightLoss >= 3
          ? `${Math.abs(weightSeries.loss).toFixed(1)}kg de evolucao no periodo.`
          : 'Seu plano ja esta gerando os primeiros sinais de progresso.',
      badge: null,
      tone: patientTheme.colors.primarySoft,
      border: patientTheme.colors.primary,
    },
    {
      id: 'achievement-glycemia',
      icon: 'flash-outline',
      iconColor: '#8a6df0',
      title: readingsCount >= 7 ? 'Controle glicemico ativo' : 'Monitoramento em construcao',
      description:
        readingsCount >= 7
          ? `${readingsCount} leituras recentes ajudando a IA a refinar os insights.`
          : 'Quanto mais leituras voce fizer, melhor fica a leitura do seu padrao glicemico.',
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
      label: 'Refeicoes registradas',
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
      label: 'Adesao media',
      value: `${adherenceAverage}%`,
    },
    {
      id: 'summary-notifications',
      label: 'Alertas recebidos',
      value: notificationCount || 0,
    },
    {
      id: 'summary-water',
      label: 'Copos de agua',
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
    };
  });
}

function WeightChart({ points }) {
  const chartHeight = 154;
  const [chartWidth, setChartWidth] = useState(0);
  const max = Math.max(...points.map((point) => point.value)) + 1;
  const min = Math.min(...points.map((point) => point.value)) - 1;
  const range = Math.max(max - min, 1);
  const innerWidth = Math.max(chartWidth - 32, 1);
  const innerHeight = chartHeight - 42;

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
              top: 24 + line * 34,
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
        positioned.map((point) => (
        <React.Fragment key={point.id}>
          <View style={[styles.weightDot, { left: point.x - 4, top: point.y - 4 }]} />
          <Text style={[styles.weightLabel, { left: point.x - 16 }]}>{point.label}</Text>
        </React.Fragment>
      ))}
    </View>
  );
}

function AdherenceBars({ items }) {
  return (
    <View style={styles.adherenceChartWrap}>
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

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [appState, setAppState] = useState(createDefaultAppState());
  const [glucoseReadings, setGlucoseReadings] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const hasLoadedRef = useRef(false);

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

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
          forceRefresh,
          ...mesclarLimitesDadosPaciente('progresso'),
        });

        setPatient(experience?.patient || null);
        setAppState(experience?.appState || createDefaultAppState());
        setGlucoseReadings(experience?.glucoseReadings || []);
      } catch (error) {
        console.log('Erro ao carregar progresso:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [canResolvePatient, patientId, usuarioLogado]
  );

  useFocusEffect(
    useCallback(() => {
      loadProgresso({ silent: hasLoadedRef.current, forceRefresh: hasLoadedRef.current });
      hasLoadedRef.current = true;
    }, [loadProgresso])
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
    () => getPeriodBounds(selectedPeriod, searchStartDate, searchEndDate),
    [selectedPeriod, searchStartDate, searchEndDate]
  );

  const filteredMealEntries = useMemo(
    () =>
      filterEntriesByPeriod(
        appState?.mealEntries,
        selectedPeriod,
        searchStartDate,
        searchEndDate,
        (item) => item?.date
      ),
    [appState?.mealEntries, selectedPeriod, searchStartDate, searchEndDate]
  );

  const filteredGlucoseReadings = useMemo(
    () =>
      filterEntriesByPeriod(
        glucoseReadings,
        selectedPeriod,
        searchStartDate,
        searchEndDate,
        (item) => item?.date
      ),
    [glucoseReadings, selectedPeriod, searchStartDate, searchEndDate]
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

  const displayName = getPatientDisplayName(patient || usuarioLogado).split(' ')[0] || 'Paciente';
  const targetMeals = appState?.planSections?.length || 3;
  const adherenceSeries = useMemo(
    () =>
      buildAdherenceSeries(
        filteredMealEntries,
        targetMeals,
        selectedPeriod,
        searchStartDate,
        searchEndDate
      ),
    [filteredMealEntries, targetMeals, selectedPeriod, searchStartDate, searchEndDate]
  );
  const adherenceAverage = Math.round(
    adherenceSeries.reduce((sum, item) => sum + item.value, 0) / Math.max(adherenceSeries.length, 1)
  );
  const weightSeries = useMemo(
    () => buildWeightSeries(toNumber(patient?.peso_atual_kg, 0)),
    [patient?.peso_atual_kg]
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
  const [exportingReport, setExportingReport] = useState(false);

  async function handleExportProgress() {
    try {
      setExportingReport(true);
      const result = await exportPatientProgressReport({
        patientName: getPatientDisplayName(patient || usuarioLogado),
        generatedAt: new Date().toLocaleString('pt-BR'),
        weightSeries,
        weeklyAdherence: adherenceSeries,
        glycemicMetrics,
        monthlySummary: {
          adherenceAverage,
          activeDays: new Set(filteredMealEntries.map((entry) => entry?.date).filter(Boolean))
            .size,
          summaryItems: monthlySummary,
        },
        achievements,
        mealEntries: filteredMealEntries,
        glucoseReadings: filteredGlucoseReadings,
      });
      if (result?.ok) {
        Alert.alert(
          'Relatorio exportado',
          Platform.OS === 'web'
            ? 'O arquivo foi baixado.'
            : 'Use o compartilhamento para salvar o relatorio completo.'
        );
      }
    } catch (error) {
      Alert.alert('Exportacao', error?.message || 'Nao foi possivel exportar o relatorio.');
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
        <>
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
                Exibindo progresso de {formatDateLabel(periodBounds.startDate)} ate {formatDateLabel(periodBounds.endDate)}.
              </Text>
            </View>
          ) : null}

          <View style={styles.metricsRow}>
            <View style={[styles.topMetricCard, styles.topMetricCardPrimary]}>
              <Ionicons
                name="trending-down-outline"
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.topMetricValue}>
                {weightSeries.hasData ? formatSignedWeight(weightSeries.loss) : '—'}
              </Text>
              <Text style={styles.topMetricLabel}>Perda de peso</Text>
            </View>

            <View style={styles.topMetricCard}>
              <Ionicons
                name="analytics-outline"
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.topMetricValue}>{adherenceAverage}%</Text>
              <Text style={styles.topMetricLabel}>Adesao media ({periodLabel})</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sua evolução</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>
                  {weightSeries.hasData ? formatSignedWeight(weightSeries.loss) : 'Sem peso'}
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

                <WeightChart points={weightSeries.points} />
              </>
            ) : (
              <Text style={styles.emptyMealText}>
                Informe seu peso no perfil para acompanhar a evolução.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Registros do periodo</Text>
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
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyMealText}>Nenhum registro alimentar encontrado no periodo.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Adesao ao plano</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{adherenceAverage}%</Text>
              </View>
            </View>

            <AdherenceBars items={adherenceSeries} />
            <Text style={styles.sectionFootnote}>Media do periodo: {adherenceAverage}%</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="pulse-outline"
                  size={15}
                  color={patientTheme.colors.primaryDark}
                />
                <Text style={styles.sectionTitle}>Controle glicemico</Text>
              </View>
            </View>

            {glycemicMetrics.hasData ? (
              <>
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

                <View style={styles.glycemicMetricsRow}>
                  <View style={styles.glycemicMetricCard}>
                    <Text style={styles.glycemicMetricLabel}>Media</Text>
                    <Text style={styles.glycemicMetricValue}>{glycemicMetrics.average}</Text>
                    <Text style={styles.glycemicMetricUnit}>mg/dL</Text>
                  </View>
                  <View style={styles.glycemicMetricCard}>
                    <Text style={styles.glycemicMetricLabel}>A1C estimada</Text>
                    <Text style={styles.glycemicMetricValue}>
                      {glycemicMetrics.gmi?.toFixed(1)}
                    </Text>
                    <Text style={styles.glycemicMetricUnit}>%</Text>
                  </View>
                  <View style={styles.glycemicMetricCard}>
                    <Text style={styles.glycemicMetricLabel}>Variabilidade</Text>
                    <Text style={styles.glycemicMetricValue}>{glycemicMetrics.variability}</Text>
                    <Text style={styles.glycemicMetricUnit}>mg/dL</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.emptyMealText}>
                Registre glicemias no monitoramento para ver tendências aqui.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="trophy-outline" size={15} color={patientTheme.colors.warning} />
                <Text style={styles.sectionTitle}>Conquistas</Text>
              </View>
            </View>

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
                  <Ionicons name={item.icon} size={18} color={item.iconColor} />
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

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Resumo do periodo</Text>

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

          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportProgress}
            disabled={exportingReport}
            activeOpacity={0.9}
          >
            {exportingReport ? (
              <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
            ) : (
              <Ionicons name="download-outline" size={18} color={patientTheme.colors.primaryDark} />
            )}
            <Text style={styles.exportButtonText}>Baixar relatorio completo</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 36,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginTop: 8,
    padding: 24,
    ...patientShadow,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    marginTop: 10,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  exportButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  periodSelectorWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    ...patientShadow,
  },
  periodChipActive: {
    backgroundColor: patientTheme.colors.primary,
  },
  periodChipText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  periodChipTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  searchFiltersCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginBottom: 12,
    padding: patientTheme.spacing.card,
    ...patientShadow,
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
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  searchDateInput: {
    minHeight: 46,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    color: patientTheme.colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
  },
  searchDateHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
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
    fontSize: 28,
    fontWeight: '700',
    marginTop: 10,
  },
  topMetricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginBottom: 12,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  badgeSoft: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeSoftText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  weightStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  weightStat: {
    flex: 1,
  },
  weightStatLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  weightStatValue: {
    color: patientTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  weightStatValueHighlight: {
    color: patientTheme.colors.primaryDark,
  },
  chartCardFrame: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    height: 170,
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
    height: 8,
    position: 'absolute',
    width: 8,
  },
  weightLabel: {
    bottom: 12,
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    position: 'absolute',
    width: 38,
    textAlign: 'center',
  },
  adherenceChartWrap: {
    paddingTop: 6,
  },
  adherenceBarsRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adherenceBarColumn: {
    alignItems: 'center',
    flex: 1,
  },
  adherenceBarTrack: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    height: 96,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 20,
  },
  adherenceBarFill: {
    borderRadius: 8,
    width: '100%',
  },
  adherenceBarLabel: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  adherenceBarPercent: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  sectionFootnote: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  todayMealsList: {
    gap: 10,
  },
  todayMealCard: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  todayMealTimeBlock: {
    width: 52,
    marginRight: 10,
  },
  todayMealTimeLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  todayMealTimeValue: {
    color: patientTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  todayMealCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayMealTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  todayMealSummary: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  todayMealBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  todayMealBadgeText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyMealText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  glycemicTrackHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glycemicTrackLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
  },
  glycemicTrackValue: {
    color: patientTheme.colors.primaryDark,
    fontSize: 22,
    fontWeight: '700',
  },
  glycemicTrack: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    height: 12,
    marginTop: 10,
    overflow: 'hidden',
  },
  glycemicTrackFill: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    height: '100%',
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
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  glycemicMetricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  glycemicMetricValue: {
    color: patientTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  glycemicMetricUnit: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  achievementCard: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    padding: 12,
  },
  achievementIconWrap: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 28,
  },
  achievementCopy: {
    flex: 1,
    paddingLeft: 8,
    paddingRight: 12,
  },
  achievementTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  achievementText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  achievementBadge: {
    backgroundColor: '#fff3cf',
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  achievementBadgeText: {
    color: '#b27b00',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginBottom: 12,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    minHeight: 96,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    color: patientTheme.colors.primaryDark,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  summaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 46,
  },
  summaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
});
