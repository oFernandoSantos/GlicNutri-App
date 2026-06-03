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
  DashboardKpiCard,
  DashboardMiniKpiCard,
  dashboardKpiStyles,
} from '../../componentes/comum/CartaoKpiDashboard';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getCachedPatientExperience,
  getPatientDisplayName,
  getPatientId,
  isPatientExperienceCacheFresh,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import { subscribeToPatientAppState } from '../../servicos/centralAppState';
import {
  buildCountByDay,
  buildGlucoseDailyAverageSeries,
  buildGlycemicMetrics,
  exportPatientProgressReport,
  buildCountByWeekForRange,
  resolveEntryDate,
  filterReportEntriesByPeriod,
  getReportPeriodBounds,
  isInsulinMedicationEntry,
} from '../../servicos/servicoRelatorioPaciente';
import {
  buildPlanAdherenceSeries,
  resolvePlanSections,
} from '../../utilitarios/vinculoPlanoRefeicao';
import { alertPaciente, mostrarToastPacienteErro } from '../../servicos/servicoToastPaciente';

const PERIOD_TABS = [
  { key: 'today', label: 'Hoje' },
  { key: '7days', label: '7 dias' },
  { key: '14days', label: '14 dias' },
  { key: 'search', label: 'Pesquisa' },
];
const PANEL_GAP = patientTheme.spacing.lg;
const SECTION_INNER_GAP = patientTheme.spacing.md;
const GLIC_GREEN = patientTheme.colors.primary;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback = 0) {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : fallback;
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

  if (!validDate) return '';
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

function CountBars({ items, emptyLabel = 'Sem registros no período.' }) {
  if (!items?.length) {
    return <Text style={styles.emptyStateText}>{emptyLabel}</Text>;
  }

  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);

  return (
    <View style={[styles.chartWrap, styles.chartBlock]}>
      <View style={styles.chartRow}>
        {items.map((item) => (
          <View key={item.id || item.label} style={styles.chartColumn}>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartFill,
                  {
                    height: `${Math.max(8, (Number(item.value) / max) * 100)}%`,
                    backgroundColor: item.color || GLIC_GREEN,
                  },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{item.label}</Text>
            <Text style={styles.chartValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PacienteRelatoriosScreen({
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
  const fetchLimits = useMemo(() => mesclarLimitesDadosPaciente('relatorio'), []);
  const cachedInitial = useMemo(
    () => (patientId ? getCachedPatientExperience(patientId, fetchLimits) : null),
    [patientId, fetchLimits]
  );

  const [loading, setLoading] = useState(!cachedInitial);
  const [patient, setPatient] = useState(cachedInitial?.patient || null);
  const [appState, setAppState] = useState(cachedInitial?.appState || createDefaultAppState());
  const [glucoseReadings, setGlucoseReadings] = useState(cachedInitial?.glucoseReadings || []);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [exportingReport, setExportingReport] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadData = useCallback(
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
            ? getCachedPatientExperience(patientId, fetchLimits)
            : null;
        const cacheFresco =
          patientId && isPatientExperienceCacheFresh(patientId, fetchLimits);

        if (cachedExperience) {
          setPatient(cachedExperience.patient || null);
          setAppState(cachedExperience.appState || createDefaultAppState());
          setGlucoseReadings(cachedExperience.glucoseReadings || []);

          if (cacheFresco && !forceRefresh) {
            return;
          }

          fetchPatientExperience(patientId, {
            patientContext: usuarioLogado,
            forceRefresh: forceRefresh || !cacheFresco,
            ...fetchLimits,
          })
            .then((experience) => {
              setPatient(experience?.patient || null);
              setAppState(experience?.appState || createDefaultAppState());
              setGlucoseReadings(experience?.glucoseReadings || []);
            })
            .catch((error) => console.log('Refresh relatorios:', error));
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
          forceRefresh,
          ...fetchLimits,
        });

        setPatient(experience?.patient || null);
        setAppState(experience?.appState || createDefaultAppState());
        setGlucoseReadings(experience?.glucoseReadings || []);
      } catch (error) {
        console.log('Erro ao carregar relatorios do paciente:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [canResolvePatient, fetchLimits, patientId, usuarioLogado]
  );

  useFocusEffect(
    useCallback(() => {
      const cacheFresco = patientId && isPatientExperienceCacheFresh(patientId, fetchLimits);
      loadData({
        silent: hasLoadedRef.current || cacheFresco,
        forceRefresh: false,
      });
      hasLoadedRef.current = true;
    }, [fetchLimits, loadData, patientId])
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
    [appState?.mealEntries, searchEndDate, searchStartDate, selectedPeriod]
  );

  const filteredGlucoseReadings = useMemo(
    () =>
      filterReportEntriesByPeriod(
        glucoseReadings,
        selectedPeriod,
        searchStartDate,
        searchEndDate
      ),
    [glucoseReadings, searchEndDate, searchStartDate, selectedPeriod]
  );

  const filteredMedicationEntries = useMemo(
    () =>
      filterReportEntriesByPeriod(
        appState?.medicationEntries,
        selectedPeriod,
        searchStartDate,
        searchEndDate
      ),
    [appState?.medicationEntries, searchEndDate, searchStartDate, selectedPeriod]
  );

  const filteredInsulinEntries = useMemo(
    () => filteredMedicationEntries.filter(isInsulinMedicationEntry),
    [filteredMedicationEntries]
  );

  const filteredPureMedicationEntries = useMemo(
    () => filteredMedicationEntries.filter((entry) => !isInsulinMedicationEntry(entry)),
    [filteredMedicationEntries]
  );

  const planSections = useMemo(
    () => resolvePlanSections({ mealPlan: appState?.activeMealPlan, appState }),
    [appState]
  );

  const adherenceSeries = useMemo(() => {
    const { items } = buildPlanAdherenceSeries({
      mealEntries: appState?.mealEntries,
      sections: planSections,
      startDate: periodBounds.startDate,
      endDate: periodBounds.endDate,
      labelForDate: (isoDate) => formatShortDateLabel(isoDate),
    });
    return items;
  }, [appState?.mealEntries, periodBounds.endDate, periodBounds.startDate, planSections]);

  const adherenceAverage = Math.round(
    adherenceSeries.reduce((sum, item) => sum + item.value, 0) / Math.max(adherenceSeries.length, 1)
  );

  const glycemicMetrics = useMemo(
    () => buildGlycemicMetrics(filteredGlucoseReadings),
    [filteredGlucoseReadings]
  );

  const periodLabel = useMemo(() => {
    if (selectedPeriod === 'today') return 'Hoje';
    if (selectedPeriod === '7days') return '7 dias';
    if (selectedPeriod === '14days') return '14 dias';
    return `${formatShortDateLabel(periodBounds.startDate)} - ${formatShortDateLabel(periodBounds.endDate)}`;
  }, [periodBounds.endDate, periodBounds.startDate, selectedPeriod]);

  const glucoseDailySeries = useMemo(
    () =>
      buildGlucoseDailyAverageSeries(filteredGlucoseReadings).map((item) => ({
        ...item,
        id: `glucose-${item.date}`,
        color: item.value < 70 ? '#fc8181' : item.value > 180 ? '#ed8936' : GLIC_GREEN,
      })),
    [filteredGlucoseReadings]
  );

  const mealsDailySeries = useMemo(
    () =>
      buildCountByDay(filteredMealEntries, (entry) => entry?.date).map((item) => ({
        ...item,
        id: `meal-${item.date}`,
        color: GLIC_GREEN,
      })),
    [filteredMealEntries]
  );

  const insulinDailySeries = useMemo(
    () =>
      buildCountByDay(filteredInsulinEntries, (entry) => entry?.date).map((item) => ({
        ...item,
        id: `insulin-${item.date}`,
        color: GLIC_GREEN,
      })),
    [filteredInsulinEntries]
  );

  const medicationDailySeries = useMemo(
    () =>
      buildCountByDay(filteredPureMedicationEntries, (entry) => entry?.date).map((item) => ({
        ...item,
        id: `med-${item.date}`,
        color: GLIC_GREEN,
      })),
    [filteredPureMedicationEntries]
  );

  const mealsWeeklySeries = useMemo(
    () =>
      buildCountByWeekForRange(
        filteredMealEntries,
        periodBounds.startDate,
        periodBounds.endDate,
        (entry) => resolveEntryDate(entry?.date)
      ).map((item) => ({
        ...item,
        id: `meal-week-${item.date}`,
        color: GLIC_GREEN,
      })),
    [filteredMealEntries, periodBounds.endDate, periodBounds.startDate]
  );

  const insulinWeeklySeries = useMemo(
    () =>
      buildCountByWeekForRange(
        filteredInsulinEntries,
        periodBounds.startDate,
        periodBounds.endDate,
        (entry) => resolveEntryDate(entry?.date)
      ).map((item) => ({
        ...item,
        id: `insulin-week-${item.date}`,
        color: GLIC_GREEN,
      })),
    [filteredInsulinEntries, periodBounds.endDate, periodBounds.startDate]
  );

  const medicationWeeklySeries = useMemo(
    () =>
      buildCountByWeekForRange(
        filteredPureMedicationEntries,
        periodBounds.startDate,
        periodBounds.endDate,
        (entry) => resolveEntryDate(entry?.date)
      ).map((item) => ({
        ...item,
        id: `med-week-${item.date}`,
        color: GLIC_GREEN,
      })),
    [filteredPureMedicationEntries, periodBounds.endDate, periodBounds.startDate]
  );

  const summaryItems = useMemo(
    () => [
      { id: 'meals', label: 'Refeições', value: filteredMealEntries.length },
      { id: 'glucose', label: 'Glicose', value: filteredGlucoseReadings.length },
      { id: 'insulin', label: 'Insulina', value: filteredInsulinEntries.length },
      { id: 'medication', label: 'Medicação', value: filteredPureMedicationEntries.length },
    ],
    [
      filteredGlucoseReadings.length,
      filteredInsulinEntries.length,
      filteredMealEntries.length,
      filteredPureMedicationEntries.length,
    ]
  );

  function handleSelectPeriod(periodKey) {
    setSelectedPeriod(periodKey);
    if (periodKey === 'search' && !searchStartDate && !searchEndDate) {
      const today = formatDateLabel(getTodayDateString());
      setSearchStartDate(today);
      setSearchEndDate(today);
    }
  }

  async function handleExport() {
    try {
      setExportingReport(true);

      let exportMeals = filteredMealEntries;
      let exportGlucose = filteredGlucoseReadings;
      let exportMedication = filteredMedicationEntries;
      let exportMetrics = glycemicMetrics;

      if (patientId && canResolvePatient) {
        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
          forceRefresh: true,
          ...fetchLimits,
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

      const result = await exportPatientProgressReport(
        {
          patient: patient || usuarioLogado,
          patientName: getPatientDisplayName(patient || usuarioLogado),
          generatedAt: new Date().toLocaleString('pt-BR'),
          periodLabel,
          periodBounds,
          period: selectedPeriod,
          startDate: searchStartDate,
          endDate: searchEndDate,
          weightSeries: {
            hasData: toNumber(patient?.peso_atual_kg) > 0,
            current: toNumber(patient?.peso_atual_kg),
            loss: 0,
            points: [],
          },
          weeklyAdherence: adherenceSeries,
          glycemicMetrics: exportMetrics,
          monthlySummary: {
            adherenceAverage,
            activeDays: new Set(exportMeals.map((entry) => entry?.date).filter(Boolean)).size,
            summaryItems: summaryItems.map((item) => ({
              id: item.id,
              label: item.label,
              value:
                item.id === 'meals'
                  ? exportMeals.length
                  : item.id === 'glucose'
                    ? exportGlucose.length
                    : item.id === 'insulin'
                      ? exportMedication.filter(isInsulinMedicationEntry).length
                      : exportMedication.filter((entry) => !isInsulinMedicationEntry(entry)).length,
            })),
          },
          achievements: [],
          mealEntries: exportMeals,
          glucoseReadings: exportGlucose,
          medicationEntries: exportMedication,
        },
        { format: 'pdf' }
      );

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
          <ActivityIndicator color={GLIC_GREEN} />
          <Text style={styles.loadingText}>Carregando relatórios...</Text>
        </View>
      ) : null}

      {!loading ? (
        <View style={styles.pageStack}>
          <View style={styles.toolbarPanel}>
            <View style={styles.periodSelectorWrap}>
              {PERIOD_TABS.map((item) => {
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
                  Exibindo relatório de {formatDateLabel(periodBounds.startDate)} até{' '}
                  {formatDateLabel(periodBounds.endDate)}.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[dashboardKpiStyles.grid, styles.overviewKpiGrid]}>
            <View style={[dashboardKpiStyles.cell, styles.overviewKpiCell]}>
              <DashboardKpiCard
                icon="restaurant-outline"
                accent={GLIC_GREEN}
                label="Refeições"
                value={String(filteredMealEntries.length)}
                style={styles.overviewKpiCard}
              />
            </View>
            <View style={[dashboardKpiStyles.cell, styles.overviewKpiCell]}>
              <DashboardKpiCard
                icon="pulse-outline"
                accent={GLIC_GREEN}
                label="Glicose"
                value={String(filteredGlucoseReadings.length)}
                style={styles.overviewKpiCard}
              />
            </View>
            <View style={[dashboardKpiStyles.cell, styles.overviewKpiCell]}>
              <DashboardKpiCard
                icon="water-outline"
                accent={GLIC_GREEN}
                label="Insulina"
                value={String(filteredInsulinEntries.length)}
                style={styles.overviewKpiCard}
              />
            </View>
            <View style={[dashboardKpiStyles.cell, styles.overviewKpiCell]}>
              <DashboardKpiCard
                icon="medkit-outline"
                accent={GLIC_GREEN}
                label="Medicação"
                value={String(filteredPureMedicationEntries.length)}
                style={styles.overviewKpiCard}
              />
            </View>
          </View>

          <View style={styles.exportPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Exportar relatório</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{periodLabel}</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              {glycemicMetrics.hasData
                ? `Média ${glycemicMetrics.average} mg/dL no período`
                : 'Gráficos e totais do período selecionado'}
            </Text>

            <TouchableOpacity
              style={styles.exportButtonPrimary}
              onPress={handleExport}
              disabled={exportingReport}
              activeOpacity={0.9}
            >
              {exportingReport ? (
                <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
              ) : (
                <Ionicons name="document-text-outline" size={18} color={patientTheme.colors.onPrimary} />
              )}
              <Text style={styles.exportButtonPrimaryText}>
                {exportingReport ? 'Gerando PDF…' : 'Baixar relatório PDF'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="pulse-outline" size={15} color={GLIC_GREEN} />
                <Text style={styles.sectionTitle}>Controle glicêmico</Text>
              </View>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>
                  {filteredGlucoseReadings.length} leitura(s)
                </Text>
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

                <View style={styles.chartSection}>
                  <View style={styles.subsectionDivider} />
                  <Text style={styles.chartSectionTitle}>Média diária no período</Text>
                  <CountBars items={glucoseDailySeries} emptyLabel="Sem leituras para gráfico." />
                </View>
              </>
            ) : (
              <Text style={styles.emptyStateText}>Nenhuma leitura de glicose no período.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="restaurant-outline" size={15} color={GLIC_GREEN} />
                <Text style={styles.sectionTitle}>Alimentação</Text>
              </View>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{filteredMealEntries.length} refeição(ões)</Text>
              </View>
            </View>
            <Text style={styles.chartSectionTitle}>Por dia</Text>
            <CountBars items={mealsDailySeries} emptyLabel="Sem refeições no período." />
            <View style={styles.subsectionDivider} />
            <Text style={styles.chartSectionTitle}>Por semana</Text>
            <CountBars items={mealsWeeklySeries} emptyLabel="Sem refeições no período." />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="water-outline" size={15} color={GLIC_GREEN} />
                <Text style={styles.sectionTitle}>Insulina</Text>
              </View>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{filteredInsulinEntries.length} registro(s)</Text>
              </View>
            </View>
            <Text style={styles.chartSectionTitle}>Por dia</Text>
            <CountBars items={insulinDailySeries} emptyLabel="Sem aplicações no período." />
            <View style={styles.subsectionDivider} />
            <Text style={styles.chartSectionTitle}>Por semana</Text>
            <CountBars items={insulinWeeklySeries} emptyLabel="Sem aplicações no período." />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="medkit-outline" size={15} color={GLIC_GREEN} />
                <Text style={styles.sectionTitle}>Medicação</Text>
              </View>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>
                  {filteredPureMedicationEntries.length} registro(s)
                </Text>
              </View>
            </View>
            <Text style={styles.chartSectionTitle}>Por dia</Text>
            <CountBars items={medicationDailySeries} emptyLabel="Sem medicação no período." />
            <View style={styles.subsectionDivider} />
            <Text style={styles.chartSectionTitle}>Por semana</Text>
            <CountBars items={medicationWeeklySeries} emptyLabel="Sem medicação no período." />
          </View>

          <View style={styles.navPanel}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('PacienteProgresso', { usuarioLogado })}
              activeOpacity={0.88}
            >
              <Ionicons name="stats-chart-outline" size={16} color={GLIC_GREEN} />
              <Text style={styles.linkButtonText}>Ver evolução e conquistas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('PacienteHistoricoRegistros', { usuarioLogado })}
              activeOpacity={0.88}
            >
              <Ionicons name="document-text-outline" size={16} color={GLIC_GREEN} />
              <Text style={styles.linkButtonText}>Abrir histórico de registros</Text>
            </TouchableOpacity>
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
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    marginTop: 4,
    padding: patientTheme.spacing.xl,
    ...patientShadow,
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  overviewKpiGrid: {
    flexWrap: 'nowrap',
    gap: 8,
    marginBottom: 0,
  },
  overviewKpiCell: {
    flex: 1,
    minWidth: 0,
    width: undefined,
    maxWidth: undefined,
  },
  overviewKpiCard: {
    alignSelf: 'stretch',
    borderWidth: 0,
    minWidth: 0,
    minHeight: 108,
    paddingHorizontal: 8,
    paddingVertical: 12,
    width: '100%',
  },
  periodSelectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  periodChip: {
    flex: 1,
    minWidth: 72,
    minHeight: 42,
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 12,
    ...patientShadow,
  },
  periodChipActive: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  periodChipText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  periodChipTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  searchFiltersCard: {
    backgroundColor: patientTheme.colors.surface,
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
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  searchDateInput: {
    minHeight: 46,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
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
  exportPanel: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: SECTION_INNER_GAP,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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
  sectionHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 0,
  },
  exportButtonPrimary: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exportButtonPrimaryText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    gap: SECTION_INNER_GAP,
    padding: patientTheme.spacing.card,
    ...patientShadow,
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
    fontSize: 13,
    fontWeight: '700',
  },
  chartBlock: {
    marginTop: 0,
  },
  chartWrap: {
    paddingTop: 4,
  },
  chartRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  chartTrack: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 104,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '72%',
    maxWidth: 28,
  },
  chartFill: {
    borderRadius: 8,
    width: '100%',
  },
  chartLabel: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  chartValue: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  emptyStateText: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
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
    fontSize: 13,
  },
  glycemicTrackValue: {
    color: GLIC_GREEN,
    fontSize: 22,
    fontWeight: '700',
  },
  glycemicTrack: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    height: 12,
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
  },
  progressMiniCell: {
    minWidth: 0,
  },
  progressMiniCard: {
    minWidth: 0,
    minHeight: 106,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderWidth: 1,
    ...patientShadow,
  },
  progressMiniLabel: {
    minHeight: 24,
    fontSize: 11,
    lineHeight: 13,
  },
  progressMiniValue: {
    marginTop: 5,
    fontSize: 18,
    lineHeight: 21,
  },
  progressMiniHelper: {
    minHeight: 16,
    marginTop: 4,
    fontSize: 10,
    lineHeight: 11,
  },
  progressMiniAccentBar: {
    marginTop: 8,
    width: 28,
  },
  navPanel: {
    gap: 10,
  },
  linkButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...patientShadow,
  },
  linkButtonText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
