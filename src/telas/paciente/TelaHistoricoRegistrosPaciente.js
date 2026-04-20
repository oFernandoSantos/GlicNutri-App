import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  deleteGlucoseReading,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  removeCachedGlucoseReading,
  replaceCachedGlucoseReadings,
  subscribeToGlucoseReadings,
} from '../../servicos/centralGlicose';

const historyTabs = [
  { key: 'glucose', label: 'Glicemia' },
  { key: 'medication', label: 'Medicações' },
  { key: 'food', label: 'Alimentações' },
];

const historyTitles = {
  glucose: 'Registros de Glicemias',
  medication: 'Registros de Medicações',
  food: 'Registros de Alimentares',
};

const periodTabs = [
  { key: 'today', label: 'Hoje' },
  { key: '7days', label: '7 dias' },
  { key: '14days', label: '14 dias' },
  { key: 'search', label: 'Pesquisa' },
];
const selectorButtonRadius = 16;

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

function filterByPeriod(items, period, startDateInput, endDateInput) {
  const today = getTodayDateString();
  let startDate = today;
  let endDate = today;

  if (period === 'today') {
    const hasTodayRecord = items.some(
      (item) => normalizeDateInput(String(item.date || '').slice(0, 10)) === today
    );

    if (!hasTodayRecord) {
      const latestRecordDate = sortByDateTime(items)
        .map((item) => normalizeDateInput(String(item.date || '').slice(0, 10)))
        .find(Boolean);

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
    const itemDate = normalizeDateInput(String(item.date || '').slice(0, 10));
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
        ? 'Uso continuo'
        : String(entry.medicineDays || '').trim()
          ? `${String(entry.medicineDays).trim()} dia(s)`
          : parsedLabel.usage
      : '';
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
  };
}

function EmptyState({ activeTab }) {
  const text =
    activeTab === 'glucose'
      ? 'Nenhum registro glicêmico encontrado.'
      : activeTab === 'medication'
        ? 'Nenhum registro de medicação encontrado.'
        : 'Nenhum registro alimentar encontrado.';

  return (
    <View style={styles.emptyCard}>
      <Ionicons name="document-text-outline" size={24} color={patientTheme.colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function PacienteHistoricoRegistrosScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [activeTab, setActiveTab] = useState('glucose');
  const [activePeriod, setActivePeriod] = useState('today');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
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
        console.log('Erro ao carregar historico:', error);
        Alert.alert('Erro', 'Não foi possível carregar o histórico agora.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId, usuarioLogado]);

  useEffect(() => {
    if (!activePatientId) return undefined;

    return subscribeToGlucoseReadings(activePatientId, (nextReadings) => {
      setGlucoseReadings(nextReadings);
    });
  }, [activePatientId]);

  const medicationEntries = useMemo(
    () =>
      sortByDateTime(
        (appState.medicationEntries || []).map((item) => ({
          ...item,
          date: item.date || new Date().toISOString().slice(0, 10),
          time: item.time || '00:00',
        }))
      ),
    [appState.medicationEntries]
  );

  const foodEntries = useMemo(
    () =>
      sortByDateTime(
        (appState.mealEntries || []).map((item) => ({
          ...item,
          date: item.date || new Date().toISOString().slice(0, 10),
          time: item.time || '00:00',
        }))
      ),
    [appState.mealEntries]
  );

  const sortedGlucoseReadings = useMemo(
    () => sortByDateTime(glucoseReadings),
    [glucoseReadings]
  );

  const filteredMedicationEntries = useMemo(
    () => filterByPeriod(medicationEntries, activePeriod, searchStartDate, searchEndDate),
    [activePeriod, medicationEntries, searchEndDate, searchStartDate]
  );

  const filteredGlucoseReadings = useMemo(
    () => filterByPeriod(sortedGlucoseReadings, activePeriod, searchStartDate, searchEndDate),
    [activePeriod, searchEndDate, searchStartDate, sortedGlucoseReadings]
  );

  const filteredFoodEntries = useMemo(
    () => filterByPeriod(foodEntries, activePeriod, searchStartDate, searchEndDate),
    [activePeriod, foodEntries, searchEndDate, searchStartDate]
  );

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

        {activePeriod === 'search' ? (
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
        ) : null}
      </View>
    ),
    [activePeriod, activeTab, searchEndDate, searchStartDate]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      readerExtraContent: headerSelectors,
      readerTitle: historyTitles[activeTab],
    });

    return () => {
      navigation.setOptions({
        readerExtraContent: null,
        readerTitle: null,
      });
    };
  }, [activeTab, headerSelectors, navigation]);

  function confirmDeleteGlucose(reading) {
    Alert.alert(
      'Excluir registro?',
      `Deseja excluir a glicemia de ${reading.value} mg/dL em ${formatDate(reading.date)} às ${formatTime(reading.time)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => handleDeleteGlucose(reading),
        },
      ]
    );
  }

  async function handleDeleteGlucose(reading) {
    try {
      setDeletingId(reading.id);
      await deleteGlucoseReading(activePatientId, reading);
      setGlucoseReadings((current) => current.filter((item) => item.id !== reading.id));
      removeCachedGlucoseReading(activePatientId, reading.id);
    } catch (error) {
      console.log('Erro ao excluir glicemia:', error);
      Alert.alert('Erro', 'Não foi possível excluir a glicemia agora.');
    } finally {
      setDeletingId(null);
    }
  }

  function confirmDeleteMedication(entry) {
    const medicationDisplay = getMedicationDisplay(entry);

    Alert.alert(
      'Excluir registro?',
      `Deseja excluir "${medicationDisplay.title}" de ${formatDate(entry.date)} às ${formatTime(entry.time)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => handleDeleteMedication(entry),
        },
      ]
    );
  }

  async function handleDeleteMedication(entry) {
    try {
      setDeletingId(entry.id);
      const nextState = {
        ...appState,
        medicationEntries: (appState.medicationEntries || []).filter(
          (item) => item.id !== entry.id
        ),
      };

      setAppState(nextState);

      const saved = await savePatientAppState({
        patientId: activePatientId,
        objectiveText,
        appState: nextState,
        currentPatient: patient,
        patientContext: usuarioLogado,
      });

      setPatient(saved.patient || patient);
      setObjectiveText(saved.clinicalObjective || objectiveText);
      setAppState(saved.appState);
    } catch (error) {
      setAppState(appState);
      console.log('Erro ao excluir medicacao:', error);
      Alert.alert('Erro', 'Não foi possível excluir a medicação agora.');
    } finally {
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
        Platform.OS === 'web' &&
          (activePeriod === 'search'
            ? styles.screenContentWebSearchHeaderOffset
            : styles.screenContentWebHeaderOffset),
      ]}
      scrollEnabled={false}
    >
      {false ? (
      <View style={styles.stickySelectors}>
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

        {activePeriod === 'search' ? (
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
        ) : null}
      </View>
      ) : null}

      <ScrollView
        style={styles.recordsScroll}
        contentContainerStyle={[
          styles.recordsContent,
          activePeriod === 'search' && styles.recordsContentWithSearch,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
        </View>
      ) : listIsEmpty ? (
        <EmptyState activeTab={activeTab} />
      ) : activeTab === 'glucose' ? (
        <View style={styles.list}>
          {filteredGlucoseReadings.map((reading) => (
            <View key={reading.id} style={styles.recordCard}>
              <View style={styles.recordIcon}>
                <Ionicons name="water-outline" size={20} color="#E50914" />
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
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => confirmDeleteGlucose(reading)}
                disabled={deletingId === reading.id}
              >
                {deletingId === reading.id ? (
                  <ActivityIndicator size="small" color="#E50914" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#E50914" />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : activeTab === 'medication' ? (
        <View style={styles.list}>
          {filteredMedicationEntries.map((entry) => {
            const medicationDisplay = getMedicationDisplay(entry);

            return (
              <View key={entry.id} style={styles.recordCard}>
                <View style={[styles.recordIcon, styles.medicationIcon]}>
                  <MaterialCommunityIcons name="pill" size={20} color="#ffffff" />
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
                  <Text style={styles.recordLine}>
                    Data: {formatDate(entry.date)}   Hora: {formatTime(entry.time)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmDeleteMedication(entry)}
                  disabled={deletingId === entry.id}
                >
                  {deletingId === entry.id ? (
                    <ActivityIndicator size="small" color="#E50914" />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color="#E50914" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.list}>
          {filteredFoodEntries.map((entry) => (
            <View key={entry.id} style={styles.recordCard}>
              <View style={[styles.recordIcon, styles.foodIcon]}>
                <MaterialCommunityIcons name="food-variant" size={20} color="#ffffff" />
              </View>
              <View style={styles.recordBody}>
                <Text style={styles.recordTitle}>{entry.title || 'Alimentação'}</Text>
                <Text style={styles.recordLine}>
                  Tipo: {entry.mode === 'photo' ? 'Foto' : entry.mode === 'voice' ? 'Áudio' : 'Texto'}
                </Text>
                {entry.description ? (
                  <Text style={styles.recordLine}>{entry.description}</Text>
                ) : null}
                <Text style={styles.recordLine}>
                  Data: {formatDate(entry.date)}   Hora: {formatTime(entry.time)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      </ScrollView>
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
  screenContentWebSearchHeaderOffset: {
    paddingTop: 190,
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
    paddingTop: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tab: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: selectorButtonRadius,
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
    justifyContent: 'space-between',
    marginTop: 12,
  },
  periodTab: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: selectorButtonRadius,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    maxWidth: 78,
    minHeight: 36,
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
    gap: 10,
    marginTop: 12,
    padding: 12,
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
    marginBottom: 6,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: patientTheme.colors.text,
    minHeight: 44,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 12,
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
  list: {
    gap: 10,
    marginTop: 14,
  },
  recordCard: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    flexDirection: 'row',
    minHeight: 86,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...patientShadow,
  },
  recordIcon: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40,
  },
  medicationIcon: {
    backgroundColor: '#E50914',
  },
  foodIcon: {
    backgroundColor: patientTheme.colors.primary,
  },
  recordBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
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
  deleteButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 8,
    width: 36,
  },
});
