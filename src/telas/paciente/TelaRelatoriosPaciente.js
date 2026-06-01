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
import {
  DashboardKpiCard,
  KPI_ACCENTS,
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

const PERIOD_TABS = [
  { key: 'today', label: 'Hoje' },
  { key: '7days', label: '7 dias' },
  { key: '14days', label: '14 dias' },
  { key: 'search', label: 'Pesquisa' },
];

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

function CountBars({ items, emptyLabel = 'Sem registros no periodo.' }) {
  if (!items?.length) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }

  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartRow}>
        {items.map((item) => (
          <View key={item.id || item.label} style={styles.chartColumn}>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartFill,
                  {
                    height: `${Math.max(8, (Number(item.value) / max) * 100)}%`,
                    backgroundColor: item.color || patientTheme.colors.primaryDark,
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
        color: item.value < 70 ? '#fc8181' : item.value > 180 ? '#ed8936' : patientTheme.colors.primaryDark,
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
        color: '#4299e1',
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
        color: '#9f7aea',
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
        color: '#ed8936',
      })),
    [filteredPureMedicationEntries, periodBounds.endDate, periodBounds.startDate]
  );

  const summaryItems = useMemo(
    () => [
      { id: 'meals', label: 'Refeicoes', value: filteredMealEntries.length },
      { id: 'glucose', label: 'Glicose', value: filteredGlucoseReadings.length },
      { id: 'insulin', label: 'Insulina', value: filteredInsulinEntries.length },
      { id: 'medication', label: 'Medicacao', value: filteredPureMedicationEntries.length },
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

  async function handleExport(format) {
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
        { format }
      );

      if (result?.ok) {
        Alert.alert(
          format === 'pdf' ? 'Relatorio PDF' : 'Relatorio TXT',
          Platform.OS === 'web'
            ? `O arquivo ${format.toUpperCase()} foi baixado com graficos e registros do periodo.`
            : 'Use o compartilhamento para salvar o arquivo.'
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
          <Text style={styles.loadingText}>Carregando relatorios...</Text>
        </View>
      ) : null}

      {!loading ? (
        <>
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>Relatorios clinicos</Text>
            <Text style={styles.introText}>
              Exporte glicose, alimentacao, insulina e medicacao do periodo selecionado em PDF ou TXT,
              com graficos e tabelas dos seus registros.
            </Text>
          </View>

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
                Periodo: {formatDateLabel(periodBounds.startDate)} ate {formatDateLabel(periodBounds.endDate)}.
              </Text>
            </View>
          ) : null}

          <View style={dashboardKpiStyles.grid}>
            <View style={dashboardKpiStyles.cell}>
              <DashboardKpiCard
                icon="restaurant-outline"
                accent={KPI_ACCENTS.blue}
                label="Refeicoes"
                value={String(filteredMealEntries.length)}
              />
            </View>
            <View style={dashboardKpiStyles.cell}>
              <DashboardKpiCard
                icon="pulse-outline"
                accent={KPI_ACCENTS.green}
                label="Glicose"
                value={String(filteredGlucoseReadings.length)}
              />
            </View>
            <View style={dashboardKpiStyles.cell}>
              <DashboardKpiCard
                icon="water-outline"
                accent={KPI_ACCENTS.purple}
                label="Insulina"
                value={String(filteredInsulinEntries.length)}
              />
            </View>
            <View style={dashboardKpiStyles.cell}>
              <DashboardKpiCard
                icon="medkit-outline"
                accent={KPI_ACCENTS.orange}
                label="Medicacao"
                value={String(filteredPureMedicationEntries.length)}
              />
            </View>
          </View>

          <View style={styles.exportSection}>
            <Text style={styles.sectionTitle}>Exportar relatorio</Text>
            <Text style={styles.sectionHint}>
              Periodo: {periodLabel}
              {glycemicMetrics.hasData ? ` · media ${glycemicMetrics.average} mg/dL` : ''}
            </Text>

            <TouchableOpacity
              style={styles.exportButtonPrimary}
              onPress={() => handleExport('pdf')}
              disabled={exportingReport}
              activeOpacity={0.9}
            >
              {exportingReport ? (
                <ActivityIndicator size="small" color={patientTheme.colors.onPrimary} />
              ) : (
                <Ionicons name="document-text-outline" size={18} color={patientTheme.colors.onPrimary} />
              )}
              <Text style={styles.exportButtonPrimaryText}>
                {exportingReport ? 'Gerando PDF…' : 'Baixar PDF com graficos'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportButtonSecondary}
              onPress={() => handleExport('txt')}
              disabled={exportingReport}
              activeOpacity={0.9}
            >
              <Ionicons name="download-outline" size={16} color={patientTheme.colors.primaryDark} />
              <Text style={styles.exportButtonSecondaryText}>Exportar resumo em TXT</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Glicose — media diaria</Text>
            {glycemicMetrics.hasData ? (
              <>
                <Text style={styles.sectionHint}>
                  TIR {glycemicMetrics.tir}% · variabilidade {glycemicMetrics.variability} mg/dL
                </Text>
                <CountBars items={glucoseDailySeries} emptyLabel="Sem leituras para grafico." />
              </>
            ) : (
              <Text style={styles.emptyText}>Nenhuma leitura de glicose no periodo.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Alimentacao — por dia</Text>
            <CountBars items={mealsDailySeries} emptyLabel="Sem refeicoes no periodo." />
            <Text style={[styles.sectionTitle, styles.subSectionTitle]}>Alimentacao — por semana</Text>
            <CountBars items={mealsWeeklySeries} emptyLabel="Sem refeicoes no periodo." />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Insulina — por dia</Text>
            <CountBars items={insulinDailySeries} emptyLabel="Sem aplicacoes no periodo." />
            <Text style={[styles.sectionTitle, styles.subSectionTitle]}>Insulina — por semana</Text>
            <CountBars items={insulinWeeklySeries} emptyLabel="Sem aplicacoes no periodo." />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Medicacao — por dia</Text>
            <CountBars items={medicationDailySeries} emptyLabel="Sem medicacao no periodo." />
            <Text style={[styles.sectionTitle, styles.subSectionTitle]}>Medicacao — por semana</Text>
            <CountBars items={medicationWeeklySeries} emptyLabel="Sem medicacao no periodo." />
          </View>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('PacienteProgresso', { usuarioLogado })}
            activeOpacity={0.88}
          >
            <Ionicons name="stats-chart-outline" size={16} color={patientTheme.colors.primaryDark} />
            <Text style={styles.linkButtonText}>Ver evolucao e conquistas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('PacienteHistoricoRegistros', { usuarioLogado })}
            activeOpacity={0.88}
          >
            <Ionicons name="document-text-outline" size={16} color={patientTheme.colors.primaryDark} />
            <Text style={styles.linkButtonText}>Abrir historico de registros</Text>
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
  introCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  introTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  introText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  periodSelectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  periodChipActive: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
  },
  periodChipText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  periodChipTextActive: {
    color: patientTheme.colors.primaryDark,
  },
  searchFiltersCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
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
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: patientTheme.colors.text,
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  searchDateHint: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  exportSection: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subSectionTitle: {
    fontSize: 14,
    marginTop: 14,
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: 12,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  exportButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.xl,
    paddingVertical: 13,
    marginBottom: 8,
  },
  exportButtonPrimaryText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  exportButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: patientTheme.radius.xl,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  exportButtonSecondaryText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  chartWrap: {
    marginTop: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    minHeight: 120,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartTrack: {
    width: '100%',
    height: 92,
    borderRadius: 10,
    backgroundColor: patientTheme.colors.backgroundSoft,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartFill: {
    width: '100%',
    borderRadius: 10,
  },
  chartLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  chartValue: {
    fontSize: 11,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  emptyText: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surface,
  },
  linkButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
});
