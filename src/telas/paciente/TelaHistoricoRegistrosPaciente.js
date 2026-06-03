import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { useKeyboardBottomInset } from '../../componentes/comum/RolagemComTeclado';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import MensagemInline from '../../componentes/comum/MensagemInline';
import { alertPaciente, mostrarToastPacienteErro } from '../../servicos/servicoToastPaciente';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getCachedPatientExperience,
  getPatientId,
  hideGlucoseReadingForPatient,
  hideMealEntryForPatient,
  hideMedicationEntryForPatient,
  isPatientExperienceCacheFresh,
  mergeAppStateMealEntries,
} from '../../servicos/servicoDadosPaciente';
import { EsqueletoListaRegistros } from '../../componentes/comum/EsqueletoCarregamento';
import {
  getMealEntryPhotoRef,
  resolveMealPhotoDisplayUri,
} from '../../servicos/servicoRefeicaoIA';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import { criarGuardiaoCarregamentoInicial } from '../../utilitarios/carregamentoTela';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  removeCachedGlucoseReading,
  replaceCachedGlucoseReadings,
  subscribeToGlucoseReadings,
  buildGlucoseFingerprint,
} from '../../servicos/centralGlicose';
import {
  replaceCachedPatientAppState,
  subscribeToPatientAppState,
} from '../../servicos/centralAppState';
import {
  enrichGlucoseReadingDisplayFields,
  getGlucoseReadingDisplayDate,
  sortGlucoseReadingsNewestFirst,
} from '../../utilitarios/dataLocal';

const historyTabs = [
  { key: 'glucose', label: 'Glicemia' },
  { key: 'medication', label: 'Medicações' },
  { key: 'food', label: 'Alimentações' },
];

const historyTitles = {
  glucose: 'Registros de glicemias',
  medication: 'Registros de Medicações',
  food: 'Registros de Alimentares',
};

const periodTabs = [
  { key: 'today', label: 'Hoje' },
  { key: '7days', label: '7 dias' },
  { key: '14days', label: '14 dias' },
  { key: 'search', label: 'Pesquisa' },
];
const topSelectorRadius = 18;
const periodSelectorRadius = 16;

function formatDate(value) {
  if (!value) return '--/--/----';
  const normalized = String(value).slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return normalized;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!value) return '--:--';
  return String(value).slice(0, 5);
}

function formatMealExtraNutrition(entry) {
  const fiber = Number(entry?.fiberG || entry?.fibrasG || 0);
  const sugars = Number(entry?.sugarsG || entry?.acucaresG || 0);
  const sodium = Number(entry?.sodiumMg || entry?.sodioMg || 0);
  const saturated = Number(entry?.saturatedFatG || entry?.gordurasSaturadasG || 0);
  const parts = [];

  if (fiber > 0) parts.push(`Fibras: ${Math.round(fiber)}g`);
  if (sugars > 0) parts.push(`Açúcares: ${Math.round(sugars)}g`);
  if (saturated > 0) parts.push(`Gord. sat.: ${Math.round(saturated)}g`);
  if (sodium > 0) parts.push(`Sódio: ${Math.round(sodium)}mg`);

  return parts.join(' · ');
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

function filterByPeriod(items, period, startDateInput, endDateInput, options = {}) {
  const resolveItemDate =
    options.resolveItemDate ||
    ((item) => normalizeDateInput(String(item.date || '').slice(0, 10)));
  const sortItems = options.sortItems || sortByDateTime;
  const today = getTodayDateString();
  let startDate = today;
  let endDate = today;

  if (period === 'today') {
    const hasTodayRecord = items.some((item) => resolveItemDate(item) === today);

    if (!hasTodayRecord) {
      const latestRecordDate = sortItems(items).map(resolveItemDate).find(Boolean);

      if (!latestRecordDate) return items;

      startDate = latestRecordDate;
      endDate = latestRecordDate;
    }
  } else if (period === '7days') {
    startDate = addDays(today, -6);
  } else if (period === '14days') {
    startDate = addDays(today, -13);
  } else if (period === 'search') {
    startDate = normalizeDateInput(startDateInput);
    endDate = normalizeDateInput(endDateInput);

    if (!startDate && !endDate) return items;
    if (!startDate) startDate = endDate;
    if (!endDate) endDate = startDate;
  } else if (period !== 'today') {
    return items;
  }

  if (startDate > endDate) {
    const previousStartDate = startDate;
    startDate = endDate;
    endDate = previousStartDate;
  }

  return items.filter((item) => {
    const itemDate = resolveItemDate(item);
    if (!itemDate) return false;

    return itemDate >= startDate && itemDate <= endDate;
  });
}

function sortByDateTime(items) {
  return [...items].sort((left, right) => {
    const leftStamp = `${left.date || '1970-01-01'}T${left.time || '00:00:00'}`;
    const rightStamp = `${right.date || '1970-01-01'}T${right.time || '00:00:00'}`;
    return rightStamp.localeCompare(leftStamp);
  });
}

function appendUniqueHiddenId(array, id) {
  if (!id) {
    return Array.isArray(array) ? array : [];
  }

  return [...new Set([id, ...(Array.isArray(array) ? array : [])])];
}

function parseMedicationLabel(label) {
  const parts = String(label || '')
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);
  const doseParts = String(parts[1] || '').split(/\s+/).filter(Boolean);

  return {
    name: parts[0] || '',
    quantity: doseParts[0] || '',
    unit: doseParts.slice(1).join(' '),
    usage: parts[3] || '',
  };
}

function getMedicationDisplay(entry) {
  const parsedLabel = parseMedicationLabel(entry.label);
  const title =
    String(entry.medicineName || '').trim() ||
    parsedLabel.name ||
    (entry.medicationKind === 'insulin' ? String(entry.label || '').trim() : '') ||
    'Medicação';
  const quantity = String(entry.medicineQuantity || '').trim() || parsedLabel.quantity;
  const unit = String(entry.medicineUnit || '').trim() || parsedLabel.unit;
  const usage =
    entry.medicationKind === 'medicine'
      ? entry.medicineContinuousUse
        ? 'Uso contínuo'
        : String(entry.medicineDays || '').trim()
          ? `${String(entry.medicineDays).trim()} dia(s)`
          : parsedLabel.usage
      : entry.medicationKind === 'insulin'
        ? String(entry.insulinUsage || '').trim() || parsedLabel.usage
      : '';
  const notes = entry.medicationKind === 'insulin' ? String(entry.insulinNotes || '').trim() : '';
  const type =
    entry.medicationKind === 'insulin'
      ? 'Insulina'
      : entry.medicationKind === 'medicine' || entry.medicineName || quantity || unit
        ? 'Medicamento'
        : 'Registro de medicação';

  return {
    title,
    type,
    quantity,
    unit,
    usage,
    notes,
  };
}

function EmptyState({ activeTab, navigation, usuarioLogado, canResolvePatient }) {
  const text =
    activeTab === 'glucose'
      ? 'Nenhum registro glicêmico encontrado.'
      : activeTab === 'medication'
        ? 'Nenhum registro de medicação encontrado.'
        : 'Nenhum registro alimentar encontrado.';

  function irParaMonitoramento(extra = {}) {
    if (!canResolvePatient) return;
    navigation.navigate('PacienteMonitoramento', {
      usuarioLogado,
      openQuickRegister: undefined,
      openMedication: undefined,
      ...extra,
    });
  }

  function irParaDiario() {
    if (!canResolvePatient) return;
    navigation.navigate('PacienteDiario', { usuarioLogado });
  }

  function irParaRefeicao() {
    if (!canResolvePatient) return;
    navigation.navigate('RegistroRefeicaoIA', {
      usuarioLogado,
    });
  }

  return (
    <View style={styles.emptyCard}>
      <Ionicons name="document-text-outline" size={24} color={patientTheme.colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
      {canResolvePatient ? (
        <View style={styles.emptyActions}>
          {activeTab === 'glucose' ? (
            <TouchableOpacity style={styles.emptyPrimaryButton} onPress={() => irParaMonitoramento()}>
              <Text style={styles.emptyPrimaryButtonText}>Registrar glicose</Text>
            </TouchableOpacity>
          ) : null}
          {activeTab === 'medication' ? (
            <TouchableOpacity
              style={styles.emptyPrimaryButton}
              onPress={() => irParaMonitoramento({ openMedication: true })}
            >
              <Text style={styles.emptyPrimaryButtonText}>Registrar medicação</Text>
            </TouchableOpacity>
          ) : null}
          {activeTab === 'food' ? (
            <>
              <TouchableOpacity style={styles.emptyPrimaryButton} onPress={irParaRefeicao}>
                <Text style={styles.emptyPrimaryButtonText}>Registrar refeição</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emptySecondaryButton} onPress={irParaDiario}>
                <Text style={styles.emptySecondaryButtonText}>Abrir diário alimentar</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function PacienteHistoricoRegistrosScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const initialTab = route?.params?.initialTab;
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
  const [activeTab, setActiveTab] = useState(initialTab || 'glucose');
  const [activePeriod, setActivePeriod] = useState('today');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const historicoFetchLimits = useMemo(() => mesclarLimitesDadosPaciente('historico'), []);
  const cachedHistoricoInicial = useMemo(
    () => (patientId ? getCachedPatientExperience(patientId, historicoFetchLimits) : null),
    [patientId, historicoFetchLimits]
  );
  const historicoCacheQuente = Boolean(cachedHistoricoInicial);
  const [loading, setLoading] = useState(!historicoCacheQuente);
  const [deletingId, setDeletingId] = useState(null);
  const [patient, setPatient] = useState(cachedHistoricoInicial?.patient || null);
  const [objectiveText, setObjectiveText] = useState(
    () => cachedHistoricoInicial?.clinicalObjective || ''
  );
  const [appState, setAppState] = useState(
    () => cachedHistoricoInicial?.appState || createDefaultAppState()
  );
  const [glucoseReadings, setGlucoseReadings] = useState(() => {
    const id = cachedHistoricoInicial?.patient?.id_paciente_uuid || patientId;
    return mergeCachedGlucoseReadings(
      cachedHistoricoInicial?.glucoseReadings || [],
      getCachedGlucoseReadings(id)
    );
  });
  const [pendingHiddenGlucoseIds, setPendingHiddenGlucoseIds] = useState([]);
  const [pendingHiddenMedicationIds, setPendingHiddenMedicationIds] = useState([]);
  const [pendingHiddenMealIds, setPendingHiddenMealIds] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerOperacao, setBannerOperacao] = useState(null);
  const [mealPhotoViewer, setMealPhotoViewer] = useState(null);
  const activePatientId = patient?.id_paciente_uuid || patientId || null;
  const historicoLoadGuardRef = React.useRef(criarGuardiaoCarregamentoInicial());
  const loadHistoryExperience = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!canResolvePatient) {
      setPatient(null);
      setObjectiveText('');
      setAppState(createDefaultAppState());
      setGlucoseReadings([]);
      return;
    }

    const experience = await fetchPatientExperience(patientId, {
      patientContext: usuarioLogado,
      forceRefresh,
      ...historicoFetchLimits,
    });
    const mergedReadings = mergeCachedGlucoseReadings(
      experience.glucoseReadings,
      getCachedGlucoseReadings(experience.patient?.id_paciente_uuid || patientId)
    );

    setPatient(experience.patient);
    setObjectiveText(experience.clinicalObjective);
    const patientUuid = experience.patient?.id_paciente_uuid || patientId;
    const nextAppState = mergeAppStateMealEntries(experience.appState, patientUuid);
    setAppState(nextAppState);
    replaceCachedPatientAppState(patientUuid, nextAppState);
    setGlucoseReadings(mergedReadings);
    replaceCachedGlucoseReadings(
      experience.patient?.id_paciente_uuid || patientId,
      mergedReadings
    );
  }, [canResolvePatient, historicoFetchLimits, patientId, usuarioLogado]);

  const fetchHistoricoComErro = useCallback(async ({ forceRefresh = false } = {}) => {
    try {
      setLoadError(null);
      await loadHistoryExperience({ forceRefresh });
    } catch (error) {
      console.log('Erro ao carregar historico:', error);
      setLoadError(
        'Não foi possível carregar o histórico. Verifique sua conexão com a internet e tente novamente.'
      );
    }
  }, [loadHistoryExperience]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        if (!historicoCacheQuente) {
          setLoading(true);
        }
        await fetchHistoricoComErro({ forceRefresh: !historicoCacheQuente });
      } finally {
        if (active) {
          setLoading(false);
          historicoLoadGuardRef.current.marcarCarregado();
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [fetchHistoricoComErro, historicoCacheQuente]);

  const onRefreshHistorico = useCallback(async () => {
    setRefreshing(true);
    await fetchHistoricoComErro({ forceRefresh: true });
    setRefreshing(false);
  }, [fetchHistoricoComErro]);

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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function refreshOnFocus() {
        try {
          if (!canResolvePatient) {
            return;
          }

          if (historicoLoadGuardRef.current.deveIgnorarCarregamentoFocus()) {
            return;
          }

          const cacheFresco =
            patientId && isPatientExperienceCacheFresh(patientId, historicoFetchLimits);
          await fetchHistoricoComErro({ forceRefresh: !cacheFresco });
        } catch (error) {
          if (!active) return;
          console.log('Erro ao recarregar historico no foco:', error);
        }
      }

      refreshOnFocus();

      return () => {
        active = false;
      };
    }, [canResolvePatient, fetchHistoricoComErro, historicoFetchLimits, patientId])
  );

  useEffect(() => {
    if (initialTab && historyTabs.some((tab) => tab.key === initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const medicationEntries = useMemo(
    () =>
      sortByDateTime(
        (appState.medicationEntries || [])
          .filter(
            (item) =>
              ![...(appState.hiddenMedicationEntryIds || []), ...pendingHiddenMedicationIds].includes(
                item.databaseId || item.legacyId || item.id
              )
          )
          .map((item) => ({
            ...item,
            date: item.date || new Date().toISOString().slice(0, 10),
            time: item.time || '00:00',
          }))
      ),
    [appState.hiddenMedicationEntryIds, appState.medicationEntries, pendingHiddenMedicationIds]
  );

  const foodEntries = useMemo(
    () =>
      sortByDateTime(
        (appState.mealEntries || [])
          .filter(
            (item) => ![...(appState.hiddenMealEntryIds || []), ...pendingHiddenMealIds].includes(item.id)
          )
          .map((item) => ({
            ...item,
            date: item.date || new Date().toISOString().slice(0, 10),
            time: item.time || '00:00',
          }))
      ),
    [appState.hiddenMealEntryIds, appState.mealEntries, pendingHiddenMealIds]
  );

  const sortedGlucoseReadings = useMemo(
    () =>
      sortGlucoseReadingsNewestFirst(
        glucoseReadings
          .filter(
            (item) =>
              ![...(appState.hiddenGlucoseReadingIds || []), ...pendingHiddenGlucoseIds].includes(
                item.id
              )
          )
          .map((item) => enrichGlucoseReadingDisplayFields(item))
      ),
    [appState.hiddenGlucoseReadingIds, glucoseReadings, pendingHiddenGlucoseIds]
  );

  const filteredMedicationEntries = useMemo(
    () => filterByPeriod(medicationEntries, activePeriod, searchStartDate, searchEndDate),
    [activePeriod, medicationEntries, searchEndDate, searchStartDate]
  );

  const filteredGlucoseReadings = useMemo(
    () =>
      filterByPeriod(sortedGlucoseReadings, activePeriod, searchStartDate, searchEndDate, {
        resolveItemDate: getGlucoseReadingDisplayDate,
        sortItems: sortGlucoseReadingsNewestFirst,
      }),
    [activePeriod, searchEndDate, searchStartDate, sortedGlucoseReadings]
  );

  const filteredFoodEntries = useMemo(
    () => filterByPeriod(foodEntries, activePeriod, searchStartDate, searchEndDate),
    [activePeriod, foodEntries, searchEndDate, searchStartDate]
  );

  const keyboardScrollPadding = useKeyboardBottomInset(48);

  const headerSelectors = useMemo(
    () => (
      <View style={styles.headerSelectors}>
        <View style={styles.tabRow}>
          {historyTabs.map((tab) => {
            const active = activeTab === tab.key;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.periodRow}>
          {periodTabs.map((tab) => {
            const active = activePeriod === tab.key;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.periodTab, active && styles.periodTabActive]}
                onPress={() => setActivePeriod(tab.key)}
              >
                <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    ),
    [activePeriod, activeTab]
  );

  const searchPanel =
    activePeriod === 'search' ? (
      <View style={styles.searchCard}>
        <View style={styles.searchField}>
          <Text style={styles.searchLabel}>Início</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#8a9095"
            keyboardType="numeric"
            value={searchStartDate}
            onChangeText={(value) => setSearchStartDate(formatDateInput(value))}
          />
        </View>

        <View style={styles.searchField}>
          <Text style={styles.searchLabel}>Fim</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#8a9095"
            keyboardType="numeric"
            value={searchEndDate}
            onChangeText={(value) => setSearchEndDate(formatDateInput(value))}
          />
        </View>
      </View>
    ) : null;

  useLayoutEffect(() => {
    navigation.setOptions({
      readerExtraContent: headerSelectors,
      readerTitle: historyTitles[activeTab],
      readerRightAction: () =>
        navigation.navigate('PacienteRelatorios', { usuarioLogado }),
      readerRightIcon: 'document-text-outline',
      readerRightAccessibilityLabel: 'Abrir relatórios',
    });

    return () => {
      navigation.setOptions({
        readerExtraContent: null,
        readerTitle: null,
        readerRightAction: undefined,
        readerRightIcon: undefined,
        readerRightAccessibilityLabel: undefined,
      });
    };
  }, [activeTab, headerSelectors, navigation, usuarioLogado]);

  function confirmDeleteGlucose(reading) {
    Alert.alert(
      'Ocultar registro?',
      `Deseja excluir a glicemia de ${reading.value} mg/dL em ${formatDate(reading.date)} às ${formatTime(reading.time)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ocultar',
          style: 'destructive',
          onPress: () => handleDeleteGlucose(reading),
        },
      ]
    );
  }

  async function handleDeleteGlucose(reading) {
    const previousAppState = appState;
    const previousGlucoseReadings = glucoseReadings;
    const nextAppState = {
      ...previousAppState,
      hiddenGlucoseReadingIds: appendUniqueHiddenId(
        previousAppState?.hiddenGlucoseReadingIds,
        reading?.id
      ),
    };
    try {
      setDeletingId(reading.id);
      setPendingHiddenGlucoseIds((current) => appendUniqueHiddenId(current, reading?.id));
      setAppState(nextAppState);
      replaceCachedPatientAppState(activePatientId, nextAppState);
      setGlucoseReadings((current) => current.filter((item) => item.id !== reading?.id));
      removeCachedGlucoseReading(activePatientId, reading?.id);
      const saved = await hideGlucoseReadingForPatient({
        patientId: activePatientId,
        objectiveText,
        appState: nextAppState,
        reading,
        currentPatient: patient,
        patientContext: usuarioLogado,
      });
      setPatient(saved.patient || patient);
      setObjectiveText(saved.clinicalObjective || objectiveText);
      setAppState(saved.appState);
    } catch (error) {
      setPendingHiddenGlucoseIds((current) => current.filter((item) => item !== reading?.id));
      setAppState(previousAppState);
      replaceCachedPatientAppState(activePatientId, previousAppState);
      setGlucoseReadings(previousGlucoseReadings);
      replaceCachedGlucoseReadings(activePatientId, previousGlucoseReadings);
      console.log('Erro ao excluir glicemia:', error);
      setBannerOperacao('Não foi possível excluir a glicemia. Verifique a conexão e tente novamente.');
    } finally {
      setPendingHiddenGlucoseIds((current) => current.filter((item) => item !== reading?.id));
      setDeletingId(null);
    }
  }

  function confirmDeleteMedication(entry) {
    const medicationDisplay = getMedicationDisplay(entry);

    Alert.alert(
      'Ocultar registro?',
      `Deseja excluir "${medicationDisplay.title}" de ${formatDate(entry.date)} às ${formatTime(entry.time)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ocultar',
          style: 'destructive',
          onPress: () => handleDeleteMedication(entry),
        },
      ]
    );
  }

  async function handleDeleteMedication(entry) {
    const previousAppState = appState;
    const hiddenId = entry?.databaseId || entry?.legacyId || entry?.id;
    const nextAppState = {
      ...previousAppState,
      medicationEntries: (previousAppState?.medicationEntries || []).filter(
        (item) => (item?.databaseId || item?.legacyId || item?.id) !== hiddenId
      ),
      hiddenMedicationEntryIds: appendUniqueHiddenId(
        previousAppState?.hiddenMedicationEntryIds,
        hiddenId
      ),
    };

    try {
      setDeletingId(entry.id);
      setPendingHiddenMedicationIds((current) => appendUniqueHiddenId(current, hiddenId));
      setAppState(nextAppState);
      replaceCachedPatientAppState(activePatientId, nextAppState);

      const saved = await hideMedicationEntryForPatient({
        patientId: activePatientId,
        objectiveText,
        appState: nextAppState,
        entry,
        currentPatient: patient,
        patientContext: usuarioLogado,
      });

      setPatient(saved.patient || patient);
      setObjectiveText(saved.clinicalObjective || objectiveText);
      setAppState(saved.appState);
    } catch (error) {
      setPendingHiddenMedicationIds((current) => current.filter((item) => item !== hiddenId));
      setAppState(previousAppState);
      replaceCachedPatientAppState(activePatientId, previousAppState);
      console.log('Erro ao excluir medicacao:', error);
      setBannerOperacao(
        'Não foi possível excluir a medicação. Verifique a conexão e tente novamente.'
      );
    } finally {
      setPendingHiddenMedicationIds((current) => current.filter((item) => item !== hiddenId));
      setDeletingId(null);
    }
  }

  async function abrirFotoRefeicao(entry) {
    const photoRef = getMealEntryPhotoRef(entry);

    if (!photoRef) {
      alertPaciente('Sem foto neste registro', 'Este item de alimentação não tem imagem anexada.');
      return;
    }

    setMealPhotoViewer({
      title: entry.title || 'Alimentação',
      uri: null,
      loading: true,
    });

    try {
      const uri = await resolveMealPhotoDisplayUri(photoRef);

      if (!uri) {
        throw new Error('Não foi possível carregar a imagem desta refeição.');
      }

      setMealPhotoViewer({
        title: entry.title || 'Alimentação',
        uri,
        loading: false,
      });
    } catch (error) {
      console.log('Erro ao abrir foto da refeicao:', error);
      setMealPhotoViewer(null);
      mostrarToastPacienteErro(error, 'Não foi possível abrir a foto agora.');
    }
  }

  function fecharVisualizadorFoto() {
    setMealPhotoViewer(null);
  }

  function confirmDeleteMeal(entry) {
    Alert.alert(
      'Ocultar registro?',
      `Deseja excluir "${entry.title || 'Alimentação'}" de ${formatDate(entry.date)} às ${formatTime(entry.time)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ocultar',
          style: 'destructive',
          onPress: () => handleDeleteMeal(entry),
        },
      ]
    );
  }

  async function handleDeleteMeal(entry) {
    const previousAppState = appState;
    const nextAppState = {
      ...previousAppState,
      mealEntries: (previousAppState?.mealEntries || []).filter((item) => item?.id !== entry?.id),
      hiddenMealEntryIds: appendUniqueHiddenId(previousAppState?.hiddenMealEntryIds, entry?.id),
    };

    try {
      setDeletingId(entry.id);
      setPendingHiddenMealIds((current) => appendUniqueHiddenId(current, entry?.id));
      setAppState(nextAppState);
      replaceCachedPatientAppState(activePatientId, nextAppState);

      const saved = await hideMealEntryForPatient({
        patientId: activePatientId,
        objectiveText,
        appState: nextAppState,
        entry,
        currentPatient: patient,
        patientContext: usuarioLogado,
      });

      setPatient(saved.patient || patient);
      setObjectiveText(saved.clinicalObjective || objectiveText);
      setAppState(saved.appState);
    } catch (error) {
      setAppState(previousAppState);
      replaceCachedPatientAppState(activePatientId, previousAppState);
      setPendingHiddenMealIds((current) => current.filter((item) => item !== entry?.id));
      console.log('Erro ao excluir alimentacao:', error);
      setBannerOperacao(
        'Não foi possível excluir a alimentação. Verifique a conexão e tente novamente.'
      );
    } finally {
      setPendingHiddenMealIds((current) => current.filter((item) => item !== entry?.id));
      setDeletingId(null);
    }
  }

  const listIsEmpty =
    activeTab === 'glucose'
      ? filteredGlucoseReadings.length === 0
      : activeTab === 'medication'
        ? filteredMedicationEntries.length === 0
        : filteredFoodEntries.length === 0;

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      contentContainerStyle={[
        styles.screenContent,
        Platform.OS === 'web' && styles.screenContentWebHeaderOffset,
      ]}
      scrollEnabled={false}
    >
      <ScrollView
        style={styles.recordsScroll}
        contentContainerStyle={[
          styles.recordsContent,
          activePeriod === 'search' && styles.recordsContentWithSearch,
          { paddingBottom: keyboardScrollPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshHistorico} />
        }
      >
      {searchPanel}
      {bannerOperacao ? (
        <MensagemInline
          tipo="erro"
          texto={bannerOperacao}
          onFechar={() => setBannerOperacao(null)}
        />
      ) : null}
      {loading ? (
        <EsqueletoListaRegistros linhas={6} />
      ) : loadError ? (
        <EstadoErroCarregamento
          loading={loading}
          onTentarNovamente={() => {
            setLoading(true);
            fetchHistoricoComErro().finally(() => setLoading(false));
          }}
        />
      ) : listIsEmpty ? (
        <EmptyState
          activeTab={activeTab}
          navigation={navigation}
          usuarioLogado={usuarioLogado}
          canResolvePatient={canResolvePatient}
        />
      ) : activeTab === 'glucose' ? (
        <View style={styles.list}>
          {filteredGlucoseReadings.map((reading) => (
            <View key={reading.id} style={styles.recordCard}>
              <View style={styles.recordContentRow}>
                <View style={[styles.recordIcon, styles.glucoseIcon]}>
                  <Ionicons name="water" size={22} color="#E50914" />
                </View>
                <View style={styles.recordBody}>
                  <Text style={styles.recordTitle}>{reading.value} mg/dL</Text>
                  <Text style={styles.recordLine}>
                    Tipo: {reading.glucoseType || 'Não informado'}
                  </Text>
                  <Text style={styles.recordLine}>
                    Data: {formatDate(reading.date)}   Hora: {formatTime(reading.time)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteGlucose(reading)}
                disabled={deletingId === reading.id}
              >
                {deletingId === reading.id ? (
                  <ActivityIndicator size="small" color="#E50914" />
                ) : (
                  <Ionicons name="trash-outline" size={22} color="#E50914" />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : activeTab === 'medication' ? (
        <View style={[styles.list, styles.listOverlap]}>
          {filteredMedicationEntries.map((entry) => {
            const medicationDisplay = getMedicationDisplay(entry);

            return (
              <View key={entry.id} style={[styles.recordCard, styles.recordCardOverlap]}>
                <View style={styles.recordContentRow}>
                  <View style={[styles.recordIcon, styles.medicationIcon, styles.recordIconOverlap]}>
                    <MaterialCommunityIcons name="pill" size={22} color="#ffffff" />
                  </View>
                  <View style={styles.recordBody}>
                    <Text style={styles.recordTitle}>{medicationDisplay.title}</Text>
                    <Text style={styles.recordLine}>Tipo: {medicationDisplay.type}</Text>
                    {medicationDisplay.unit ? (
                      <Text style={styles.recordLine}>
                        Unidade de medida: {medicationDisplay.unit}
                      </Text>
                    ) : null}
                    {medicationDisplay.quantity ? (
                      <Text style={styles.recordLine}>
                        Quantidade: {medicationDisplay.quantity}
                      </Text>
                    ) : null}
                    {medicationDisplay.usage ? (
                      <Text style={styles.recordLine}>Uso: {medicationDisplay.usage}</Text>
                    ) : null}
                    {medicationDisplay.notes ? (
                      <Text style={styles.recordLine}>Observação: {medicationDisplay.notes}</Text>
                    ) : null}
                    <Text style={styles.recordLine}>
                      Data: {formatDate(entry.date)}   Hora: {formatTime(entry.time)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMedication(entry)}
                  disabled={deletingId === entry.id}
                >
                  {deletingId === entry.id ? (
                    <ActivityIndicator size="small" color="#E50914" />
                  ) : (
                    <Ionicons name="trash-outline" size={22} color="#E50914" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.list}>
          {filteredFoodEntries.map((entry) => {
            const possuiFoto = Boolean(getMealEntryPhotoRef(entry));

            return (
              <View key={entry.id} style={styles.recordCard}>
                <TouchableOpacity
                  style={styles.recordContentRow}
                  activeOpacity={possuiFoto ? 0.72 : 1}
                  onPress={() => abrirFotoRefeicao(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    possuiFoto
                      ? `Ver foto de ${entry.title || 'alimentação'}`
                      : `Registro de ${entry.title || 'alimentação'}`
                  }
                >
                  <View style={[styles.recordIcon, styles.foodIcon]}>
                    {possuiFoto ? (
                      <Ionicons name="image-outline" size={22} color="#ffffff" />
                    ) : (
                      <MaterialCommunityIcons name="food-variant" size={22} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.recordBody}>
                    <Text style={styles.recordTitle}>{entry.title || 'Alimentação'}</Text>
                    <Text style={styles.recordLine}>
                      Tipo:{' '}
                      {entry.mode === 'photo'
                        ? 'Foto'
                        : entry.mode === 'voice'
                          ? 'Áudio'
                          : 'Texto'}
                    </Text>
                    {entry.description ? (
                      <Text style={styles.recordLine} numberOfLines={2}>
                        {entry.description}
                      </Text>
                    ) : null}
                    <Text style={styles.recordLine}>
                      Data: {formatDate(entry.date)}   Hora: {formatTime(entry.time)}
                    </Text>
                    {formatMealExtraNutrition(entry) ? (
                      <Text style={styles.recordLine}>{formatMealExtraNutrition(entry)}</Text>
                    ) : null}
                    {possuiFoto ? (
                      <Text style={styles.recordPhotoHint}>Toque para ver a foto</Text>
                    ) : null}
                  </View>
                  {possuiFoto ? (
                    <View style={styles.recordChevronSlot}>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={patientTheme.colors.textMuted}
                      />
                    </View>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMeal(entry)}
                  disabled={deletingId === entry.id}
                >
                  {deletingId === entry.id ? (
                    <ActivityIndicator size="small" color="#E50914" />
                  ) : (
                    <Ionicons name="trash-outline" size={22} color="#E50914" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
      </ScrollView>

      <Modal
        visible={Boolean(mealPhotoViewer)}
        transparent
        animationType="fade"
        onRequestClose={fecharVisualizadorFoto}
      >
        <TouchableWithoutFeedback onPress={fecharVisualizadorFoto}>
          <View style={styles.photoModalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.photoModalCard}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle} numberOfLines={2}>
                {mealPhotoViewer?.title || 'Foto da refeição'}
              </Text>
              <TouchableOpacity
                style={styles.photoModalCloseButton}
                onPress={fecharVisualizadorFoto}
                accessibilityLabel="Fechar visualização da foto"
              >
                <Ionicons name="close" size={22} color={patientTheme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.photoModalImageWrap}>
              {mealPhotoViewer?.loading ? (
                <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
              ) : mealPhotoViewer?.uri ? (
                <Image
                  source={{ uri: mealPhotoViewer.uri }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.photoModalFallback}>
                  Não foi possível carregar a imagem.
                </Text>
              )}
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    flexGrow: 1,
    paddingTop: 0,
  },
  screenContentWebHeaderOffset: {
    paddingTop: 110,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stickySelectors: {
    backgroundColor: patientTheme.colors.background,
    marginHorizontal: -patientTheme.spacing.screen,
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 12,
    zIndex: 20,
  },
  headerSelectors: {
    backgroundColor: '#ffffff',
  },
  recordsScroll: {
    flex: 1,
    height: 1,
    minHeight: 0,
  },
  recordsContent: {
    paddingBottom: 8,
  },
  recordsContentWithSearch: {
    paddingTop: 6,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tab: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: topSelectorRadius,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 6,
    paddingVertical: 12,
    ...patientShadow,
  },
  tabActive: {
    backgroundColor: patientTheme.colors.primary,
  },
  tabText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
  },
  periodTab: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: periodSelectorRadius,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 68,
    paddingHorizontal: 8,
  },
  periodTabActive: {
    backgroundColor: patientTheme.colors.primary,
    borderColor: patientTheme.colors.primary,
  },
  periodTabText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  periodTabTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  searchCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    ...patientShadow,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
  },
  searchLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    paddingLeft: 2,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: patientTheme.colors.text,
    minHeight: 46,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 14,
    width: '100%',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 120,
    ...patientShadow,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 140,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  emptyText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: 12,
    gap: 10,
    width: '100%',
    alignItems: 'stretch',
  },
  emptyPrimaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  emptyPrimaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  emptySecondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: patientTheme.colors.primaryDark,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  emptySecondaryButtonText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
    fontSize: 15,
  },
  list: {
    gap: 12,
    marginTop: 14,
  },
  listOverlap: {
    paddingLeft: 10,
  },
  recordCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    minHeight: 92,
    overflow: 'visible',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 14,
    ...patientShadow,
  },
  recordCardOverlap: {
    paddingLeft: 30,
  },
  recordContentRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  recordIcon: {
    alignItems: 'center',
    borderRadius: 22,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    marginRight: 14,
    width: 44,
  },
  glucoseIcon: {
    backgroundColor: '#ffffff',
    borderColor: '#E50914',
    borderWidth: 1.5,
  },
  medicationIcon: {
    backgroundColor: patientTheme.colors.info,
  },
  recordIconOverlap: {
    marginLeft: -22,
    marginRight: 12,
  },
  foodIcon: {
    backgroundColor: patientTheme.colors.primary,
  },
  recordBody: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 1,
  },
  recordChevronSlot: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    marginLeft: 4,
    marginRight: 2,
    width: 24,
  },
  recordTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  recordLine: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  recordPhotoHint: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  photoModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.82)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  photoModalCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    maxHeight: '88%',
    overflow: 'hidden',
    width: '100%',
    ...patientShadow,
  },
  photoModalHeader: {
    alignItems: 'center',
    borderBottomColor: patientTheme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  photoModalTitle: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  photoModalCloseButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  photoModalImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
    padding: 12,
  },
  photoModalImage: {
    height: 360,
    width: '100%',
  },
  photoModalFallback: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 20,
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    marginLeft: 4,
    width: 40,
  },
});
