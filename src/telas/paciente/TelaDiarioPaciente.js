import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  appendNewestEntry,
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
} from '../../servicos/servicoDadosPaciente';
import {
  replaceCachedPatientAppState,
  subscribeToPatientAppState,
} from '../../servicos/centralAppState';

const mealKindStyle = {
  icon: 'restaurant-outline',
  color: patientTheme.colors.primaryDark,
  bg: patientTheme.colors.primarySoft,
};

const rangeOptions = ['Hoje', '7 dias', '14 dias'];
const NUTRIENT_BASE = {
  calories: 0,
  carbs: 0,
  protein: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  saturatedFat: 0,
  sodium: 0,
  iron: 0,
  calcium: 0,
  magnesium: 0,
  potassium: 0,
  zinc: 0,
  vitaminA: 0,
  vitaminC: 0,
  vitaminD: 0,
  vitaminB12: 0,
  folate: 0,
};
const MACRO_NUTRIENTS = [
  { id: 'calories', label: 'Calorias', unit: 'kcal', target: 1800 },
  { id: 'carbs', label: 'Carboidratos', unit: 'g', target: 225 },
  { id: 'protein', label: 'Proteinas', unit: 'g', target: 90 },
  { id: 'fat', label: 'Gorduras totais', unit: 'g', target: 60 },
  { id: 'fiber', label: 'Fibras', unit: 'g', target: 25 },
  { id: 'sugar', label: 'Acucares', unit: 'g', target: 50 },
  { id: 'saturatedFat', label: 'Gordura saturada', unit: 'g', target: 20 },
  { id: 'sodium', label: 'Sodio', unit: 'mg', target: 2000 },
];
const MICRO_NUTRIENTS = [
  { id: 'iron', label: 'Ferro', unit: 'mg', target: 18 },
  { id: 'calcium', label: 'Calcio', unit: 'mg', target: 1000 },
  { id: 'magnesium', label: 'Magnesio', unit: 'mg', target: 320 },
  { id: 'potassium', label: 'Potassio', unit: 'mg', target: 2600 },
  { id: 'zinc', label: 'Zinco', unit: 'mg', target: 8 },
  { id: 'vitaminA', label: 'Vitamina A', unit: 'mcg', target: 700 },
  { id: 'vitaminC', label: 'Vitamina C', unit: 'mg', target: 75 },
  { id: 'vitaminD', label: 'Vitamina D', unit: 'mcg', target: 15 },
  { id: 'vitaminB12', label: 'Vitamina B12', unit: 'mcg', target: 2.4 },
  { id: 'folate', label: 'Folato', unit: 'mcg', target: 400 },
];

const NUTRITION_KEYWORDS = [
  { keys: ['arroz', 'massa', 'macarrao', 'batata', 'pao', 'quinoa', 'aveia'], calories: 160, carbs: 32, protein: 4, fat: 2, fiber: 3, sugar: 2, saturatedFat: 0.4, sodium: 120, iron: 0.8, calcium: 18, magnesium: 28, potassium: 110, zinc: 0.7, vitaminA: 0, vitaminC: 2, vitaminD: 0, vitaminB12: 0, folate: 28 },
  { keys: ['feijao', 'lentilha', 'grao de bico', 'ervilha'], calories: 110, carbs: 19, protein: 7, fat: 1, fiber: 7, sugar: 1, saturatedFat: 0.1, sodium: 10, iron: 2.4, calcium: 40, magnesium: 42, potassium: 240, zinc: 1.1, vitaminA: 8, vitaminC: 1, vitaminD: 0, vitaminB12: 0, folate: 120 },
  { keys: ['frango', 'carne', 'peixe', 'ovo', 'atum', 'salmao'], calories: 180, carbs: 0, protein: 24, fat: 8, fiber: 0, sugar: 0, saturatedFat: 2.2, sodium: 85, iron: 1.6, calcium: 16, magnesium: 24, potassium: 260, zinc: 1.8, vitaminA: 40, vitaminC: 0, vitaminD: 2.4, vitaminB12: 1.1, folate: 18 },
  { keys: ['salada', 'legume', 'verdura', 'brocolis', 'cenoura', 'espinafre', 'couve'], calories: 45, carbs: 8, protein: 2, fat: 0, fiber: 4, sugar: 3, saturatedFat: 0, sodium: 35, iron: 0.9, calcium: 48, magnesium: 30, potassium: 210, zinc: 0.4, vitaminA: 260, vitaminC: 18, vitaminD: 0, vitaminB12: 0, folate: 72 },
  { keys: ['queijo', 'leite', 'iogurte', 'kefir'], calories: 90, carbs: 6, protein: 6, fat: 5, fiber: 0, sugar: 5, saturatedFat: 3, sodium: 95, iron: 0.1, calcium: 180, magnesium: 18, potassium: 190, zinc: 0.8, vitaminA: 62, vitaminC: 0, vitaminD: 1.2, vitaminB12: 0.9, folate: 10 },
  { keys: ['fruta', 'banana', 'maca', 'mamao', 'laranja', 'morango', 'abacate'], calories: 70, carbs: 18, protein: 1, fat: 0, fiber: 3, sugar: 12, saturatedFat: 0, sodium: 2, iron: 0.3, calcium: 22, magnesium: 20, potassium: 240, zinc: 0.2, vitaminA: 54, vitaminC: 28, vitaminD: 0, vitaminB12: 0, folate: 34 },
  { keys: ['castanha', 'amendoa', 'nozes', 'amendoim', 'chia'], calories: 120, carbs: 5, protein: 4, fat: 10, fiber: 3, sugar: 1, saturatedFat: 1.1, sodium: 2, iron: 1.1, calcium: 48, magnesium: 64, potassium: 180, zinc: 0.9, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, folate: 22 },
];

function parseEntryDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateDayDifference(baseDate, compareDate) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((baseDate.getTime() - compareDate.getTime()) / dayMs);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractNumber(text, pattern) {
  const match = String(text || '').match(pattern);
  return match ? Number(match[1].replace(',', '.')) || 0 : 0;
}

function formatNutrientValue(value, unit) {
  if (unit === 'kcal') {
    return `${Math.round(value)}`;
  }

  if (value >= 100) {
    return `${Math.round(value)}`;
  }

  if (value >= 10) {
    return `${value.toFixed(1).replace(/\.0$/, '')}`;
  }

  return `${value.toFixed(1).replace(/\.0$/, '')}`;
}

function estimateNutritionFromMeal(entry) {
  const aiNote = String(entry?.aiNote || '');
  const delta = String(entry?.glucoseDelta || '');
  const combinedText = normalizeText([entry?.title, entry?.description, aiNote].filter(Boolean).join(' '));

  const directCalories = extractNumber(aiNote, /(\d+(?:[.,]\d+)?)\s*kcal/i);
  const directProtein = extractNumber(aiNote, /(\d+(?:[.,]\d+)?)\s*g\s*proteinas?/i);
  const directFat = extractNumber(aiNote, /(\d+(?:[.,]\d+)?)\s*g\s*gorduras?/i);
  const directCarbs = extractNumber(delta, /(\d+(?:[.,]\d+)?)\s*g\s*carbos?/i);

  if (directCalories || directProtein || directFat || directCarbs) {
    return {
      ...NUTRIENT_BASE,
      calories: directCalories,
      carbs: directCarbs,
      protein: directProtein,
      fat: directFat,
    };
  }

  return NUTRITION_KEYWORDS.reduce(
    (totals, item) => {
      const matched = item.keys.some((key) => combinedText.includes(normalizeText(key)));

      if (!matched) {
        return totals;
      }

      return {
        calories: totals.calories + (item.calories || 0),
        carbs: totals.carbs + (item.carbs || 0),
        protein: totals.protein + (item.protein || 0),
        fat: totals.fat + (item.fat || 0),
        fiber: totals.fiber + (item.fiber || 0),
        sugar: totals.sugar + (item.sugar || 0),
        saturatedFat: totals.saturatedFat + (item.saturatedFat || 0),
        sodium: totals.sodium + (item.sodium || 0),
        iron: totals.iron + (item.iron || 0),
        calcium: totals.calcium + (item.calcium || 0),
        magnesium: totals.magnesium + (item.magnesium || 0),
        potassium: totals.potassium + (item.potassium || 0),
        zinc: totals.zinc + (item.zinc || 0),
        vitaminA: totals.vitaminA + (item.vitaminA || 0),
        vitaminC: totals.vitaminC + (item.vitaminC || 0),
        vitaminD: totals.vitaminD + (item.vitaminD || 0),
        vitaminB12: totals.vitaminB12 + (item.vitaminB12 || 0),
        folate: totals.folate + (item.folate || 0),
      };
    },
    { ...NUTRIENT_BASE }
  );
}

function summarizeNutrition(entries) {
  return entries.reduce(
    (totals, entry) => {
      const nutrition = estimateNutritionFromMeal(entry);

      return {
        calories: totals.calories + nutrition.calories,
        carbs: totals.carbs + nutrition.carbs,
        protein: totals.protein + nutrition.protein,
        fat: totals.fat + nutrition.fat,
        fiber: totals.fiber + nutrition.fiber,
        sugar: totals.sugar + nutrition.sugar,
        saturatedFat: totals.saturatedFat + nutrition.saturatedFat,
        sodium: totals.sodium + nutrition.sodium,
        iron: totals.iron + nutrition.iron,
        calcium: totals.calcium + nutrition.calcium,
        magnesium: totals.magnesium + nutrition.magnesium,
        potassium: totals.potassium + nutrition.potassium,
        zinc: totals.zinc + nutrition.zinc,
        vitaminA: totals.vitaminA + nutrition.vitaminA,
        vitaminC: totals.vitaminC + nutrition.vitaminC,
        vitaminD: totals.vitaminD + nutrition.vitaminD,
        vitaminB12: totals.vitaminB12 + nutrition.vitaminB12,
        folate: totals.folate + nutrition.folate,
      };
    },
    { ...NUTRIENT_BASE }
  );
}

function buildProgress(value, target) {
  if (!target) {
    return 0;
  }

  return Math.max(0, Math.min(value / target, 1));
}

export default function PacienteDiarioScreen({ navigation, route, usuarioLogado: usuarioProp }) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const { width: windowWidth } = useWindowDimensions();
  const mealEntryFromIA = route?.params?.mealEntryIA || null;
  const mealIARefreshToken = route?.params?.mealIARefreshToken || null;
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
  const [range, setRange] = useState('Hoje');
  const [nutritionSlideIndex, setNutritionSlideIndex] = useState(0);
  const [appState, setAppState] = useState(createDefaultAppState());

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          if (!active) return;
          setAppState(createDefaultAppState());
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
        });

        if (!active) return;

        setAppState(experience.appState);
        replaceCachedPatientAppState(
          experience.patient?.id_paciente_uuid || patientId,
          experience.appState
        );
      } catch (error) {
        console.log('Erro ao carregar diario:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId, canResolvePatient, usuarioLogado]);

  useEffect(() => {
    if (!patientId) return undefined;

    return subscribeToPatientAppState(patientId, (nextAppState) => {
      if (nextAppState) {
        setAppState(nextAppState);
      }
    });
  }, [patientId]);

  useEffect(() => {
    if (!mealEntryFromIA || !mealIARefreshToken) {
      return;
    }

    setAppState((current) => {
      const currentEntries = current?.mealEntries || [];

      if (currentEntries.some((item) => item?.id === mealEntryFromIA.id)) {
        return current;
      }

      return {
        ...current,
        mealEntries: appendNewestEntry(currentEntries, mealEntryFromIA),
      };
    });
  }, [mealEntryFromIA, mealIARefreshToken]);

  const timelineEntries = useMemo(() => {
    return (appState.mealEntries || []).map((item) => ({
      ...item,
      kind: item.kind || 'meal',
    })).sort((a, b) =>
      String(b.time || '').localeCompare(String(a.time || ''))
    );
  }, [appState]);

  const todayMealEntries = timelineEntries.length;
  const nutritionSummary = useMemo(() => summarizeNutrition(timelineEntries), [timelineEntries]);
  const selectedNutritionEntries = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    return timelineEntries.filter((entry) => {
      const entryDate = parseEntryDate(entry.date);

      if (!entryDate) {
        return range === 'Hoje';
      }

      const diff = calculateDayDifference(today, entryDate);

      if (range === 'Hoje') {
        return diff === 0;
      }

      if (range === '7 dias') {
        return diff >= 0 && diff < 7;
      }

      return diff >= 0 && diff < 14;
    });
  }, [range, timelineEntries]);
  const selectedNutritionSummary = useMemo(
    () => summarizeNutrition(selectedNutritionEntries),
    [selectedNutritionEntries]
  );
  const selectedAiMealEntriesCount = useMemo(
    () => selectedNutritionEntries.filter((entry) => entry.mode === 'photo').length,
    [selectedNutritionEntries]
  );
  const selectedLastMealTime = selectedNutritionEntries[0]?.time || '--:--';
  const summaryCards = useMemo(
    () => [
      {
        id: 'meals',
        label: 'Refeicoes no periodo',
        value: `${selectedNutritionEntries.length}`,
        helper: range === 'Hoje' ? 'registradas hoje' : 'registradas',
      },
      {
        id: 'carbs',
        label: 'Carboidratos do periodo',
        value: `${Math.round(selectedNutritionSummary.carbs)}g`,
        helper: 'estimativa da alimentacao',
      },
      {
        id: 'calories',
        label: 'Energia consumida',
        value: `${Math.round(selectedNutritionSummary.calories)}`,
        helper: 'kcal estimadas',
      },
      {
        id: 'last',
        label: 'Ultimo registro',
        value: selectedLastMealTime,
        helper: selectedAiMealEntriesCount ? `${selectedAiMealEntriesCount} com foto e IA` : 'sem foto com IA',
      },
    ],
    [range, selectedAiMealEntriesCount, selectedLastMealTime, selectedNutritionEntries.length, selectedNutritionSummary]
  );
  const macroCards = useMemo(
    () =>
      MACRO_NUTRIENTS.map((nutrient) => {
        const value = selectedNutritionSummary[nutrient.id] || 0;
        return {
          ...nutrient,
          value: formatNutrientValue(value, nutrient.unit),
          progress: buildProgress(value, nutrient.target),
          helper: `${Math.round(buildProgress(value, nutrient.target) * 100)}% da meta`,
        };
      }),
    [selectedNutritionSummary]
  );
  const microCards = useMemo(
    () =>
      MICRO_NUTRIENTS.map((nutrient) => {
        const value = selectedNutritionSummary[nutrient.id] || 0;
        return {
          ...nutrient,
          value: `${formatNutrientValue(value, nutrient.unit)} ${nutrient.unit}`,
          helper: `${Math.round(buildProgress(value, nutrient.target) * 100)}% da meta`,
          progress: buildProgress(value, nutrient.target),
        };
      }),
    [selectedNutritionSummary]
  );
  const latestMealEntry = timelineEntries[0] || null;
  const latestMealSummary = latestMealEntry
    ? latestMealEntry.description || latestMealEntry.aiNote || 'Refeicao registrada.'
    : 'Assim que voce registrar uma refeicao, mostramos o ultimo resumo aqui.';
  const scoreSummaryText = latestMealEntry
    ? `Proteínas (${Math.round(nutritionSummary.protein)} g), Gorduras (${Math.round(nutritionSummary.fat)} g)`
    : 'Proteínas (0 g), Gorduras (0 g)';
  const lastMealTime = timelineEntries[0]?.time || '--:--';
  const emptyTimeline = !loading && !timelineEntries.length;
  const nutritionCarouselCardWidth = Math.max(windowWidth - 36, 280);

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      contentContainerStyle={styles.screenContent}
      footerOverlay={
        <TouchableOpacity
          style={[styles.primaryButton, styles.fixedPrimaryButton, !canResolvePatient && styles.buttonDisabled]}
          onPress={() =>
            navigation.navigate('RegistroRefeicaoIA', {
              usuarioLogado,
              openMealTimingChoice: true,
            })
          }
          disabled={!canResolvePatient}
        >
          <Ionicons name="camera-outline" size={18} color={patientTheme.colors.onPrimary} />
          <Text style={styles.primaryButtonText}>Registrar Alimentação</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.scoreCard}>
        <View style={styles.scoreMain}>
          <Text style={styles.scoreLabel}>Resumo alimentar</Text>
        </View>

        <View style={styles.scoreLatestCard}>
          <View style={styles.scoreLatestHeader}>
            <View style={styles.scoreBadge}>
              <MaterialCommunityIcons
                name="silverware-fork-knife"
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.scoreBadgeText}>{'\u00daltima refei\u00e7\u00e3o'}</Text>
            </View>
            <Text style={styles.scoreLatestTime}>{lastMealTime}</Text>
          </View>
          <Text style={styles.scoreLatestTitle}>{latestMealEntry ? 'Refei\u00e7\u00e3o Registrada' : 'Sem registro recente'}</Text>
          <Text style={styles.scoreLatestSummary} numberOfLines={3}>
            {latestMealSummary}
          </Text>
          <Text style={styles.scoreLatestNutrition}>{scoreSummaryText}</Text>
        </View>
      </View>

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

      <View style={styles.metricsPanel}>
        <View style={styles.heroMetrics}>
          {summaryCards.map((item) => (
            <View key={item.id} style={styles.heroMetricCard}>
              <Text style={styles.heroMetricLabel}>{item.label}</Text>
              <Text style={styles.heroMetricValue}>{item.value}</Text>
              <Text style={styles.heroMetricHelper}>{item.helper}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.nutritionPanel}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={styles.nutritionCarouselContent}
          onMomentumScrollEnd={(event) => {
            const offsetX = event.nativeEvent.contentOffset.x;
            const nextIndex = Math.round(offsetX / (nutritionCarouselCardWidth + 12));
            setNutritionSlideIndex(nextIndex);
          }}
        >
        <View style={[styles.nutritionCardCarouselItem, { width: nutritionCarouselCardWidth }]}>
        <View style={styles.nutritionCard}>
          <View style={styles.nutritionHeader}>
            <View style={styles.nutritionHeaderCopy}>
              <Text style={styles.nutritionTitle}>Macronutrientes</Text>
              <Text style={styles.nutritionSubtitle}>
                {selectedNutritionEntries.length} refeicoes analisadas em {range.toLowerCase()}.
              </Text>
            </View>
            <View style={styles.chartRangePill}>
              <Text style={styles.chartRangeText}>{range}</Text>
            </View>
          </View>

          {macroCards.map((item) => (
            <View key={item.id} style={styles.macroRow}>
              <View style={styles.macroCopy}>
                <Text style={styles.macroLabel}>{item.label}</Text>
                <Text style={styles.macroHelper}>{item.helper}</Text>
              </View>
              <View style={styles.macroValueWrap}>
                <Text style={styles.macroValue}>
                  {item.value} {item.unit}
                </Text>
                <View style={styles.macroTrack}>
                  <View
                    style={[
                      styles.macroFill,
                      { width: `${item.progress > 0 ? Math.max(item.progress * 100, 8) : 0}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
        </View>

        <View style={[styles.nutritionCardCarouselItem, { width: nutritionCarouselCardWidth }]}>
        <View style={styles.nutritionCard}>
          <View style={styles.nutritionHeader}>
            <View style={styles.nutritionHeaderCopy}>
              <Text style={styles.nutritionTitle}>Micronutrientes</Text>
              <Text style={styles.nutritionSubtitle}>
                Estimativa com base nos alimentos descritos nas refeicoes.
              </Text>
            </View>
            <View style={styles.chartRangePill}>
              <Text style={styles.chartRangeText}>{range}</Text>
            </View>
          </View>

          {microCards.map((item) => (
            <View key={item.id} style={styles.microRow}>
              <View style={styles.microCopy}>
                <Text style={styles.microLabel}>{item.label}</Text>
                <Text style={styles.microHelper}>{item.helper}</Text>
              </View>
              <View style={styles.microValueWrap}>
                <Text style={styles.microValue}>{item.value}</Text>
                <View style={styles.microTrack}>
                  <View
                    style={[
                      styles.microFill,
                      { width: `${item.progress > 0 ? Math.max(item.progress * 100, 8) : 0}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
        </View>
        </ScrollView>

        <View style={styles.nutritionCarouselIndicatorRow}>
          {['Macro', 'Micro'].map((item, index) => {
            const active = nutritionSlideIndex === index;

            return (
              <View
                key={item}
                style={[
                  styles.nutritionCarouselIndicator,
                  active && styles.nutritionCarouselIndicatorActive,
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Linha do tempo alimentar</Text>
        <View style={styles.sectionPill}>
          <Ionicons name="time-outline" size={14} color={patientTheme.colors.primaryDark} />
          <Text style={styles.sectionPillText}>Mais recente primeiro</Text>
        </View>
      </View>

      <View style={styles.timelineCard}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.emptyStateText}>Carregando seus registros...</Text>
          </View>
        ) : timelineEntries.length > 0 ? (
          timelineEntries.map((entry, index) => {
            const meta = mealKindStyle;
            const nutrition = estimateNutritionFromMeal(entry);
            const nutritionSummaryLine = [
              `${Math.round(nutrition.calories)} kcal`,
              `${Math.round(nutrition.carbs)} g carboidratos`,
              `${Math.round(nutrition.protein)} g proteinas`,
              `${Math.round(nutrition.fat)} g gorduras`,
            ].join(', ');
            const entryModeLabel = entry.mode === 'photo' ? 'Com IA' : 'Registro manual';

            return (
              <View key={entry.id} style={styles.timelineRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{entry.time}</Text>
                  {index < timelineEntries.length - 1 ? <View style={styles.timeLine} /> : null}
                </View>

                <View style={[styles.kindIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>

                <View style={styles.timelineContent}>
                  <View style={styles.timelineEntryCard}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineTitle}>{entry.title}</Text>
                      <View style={styles.noteTag}>
                        <Text style={styles.noteTagText}>{entryModeLabel}</Text>
                      </View>
                    </View>

                    <Text style={styles.timelineDescription}>{entry.description}</Text>

                    <View style={styles.timelineMetaRow}>
                      <Text style={styles.deltaText}>
                        {nutrition.carbs
                          ? `${Math.round(nutrition.carbs)} g de carboidratos`
                          : 'Macros estimados abaixo'}
                      </Text>
                    </View>

                    <Text style={styles.timelineNutritionSummary}>{nutritionSummaryLine}</Text>

                    <Text style={styles.aiFeedback}>{entry.aiNote}</Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : emptyTimeline ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIllustration}>
              <Ionicons name="camera-outline" size={22} color={patientTheme.colors.primaryDark} />
            </View>
            <Text style={styles.emptyStateText}>
              Nenhuma refeição salva ainda. Comece pela primeira foto para montar seu histórico alimentar com ajuda da IA.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, styles.emptyPrimaryButton]}
              onPress={() =>
                navigation.navigate('RegistroRefeicaoIA', {
                  usuarioLogado,
                  openMealTimingChoice: true,
                })
              }
              disabled={!canResolvePatient}
            >
              <Text style={styles.primaryButtonText}>Registrar primeira refeição</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 160,
  },
  metricsPanel: {
    marginTop: 12,
    marginBottom: 18,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 20,
    aspectRatio: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  heroMetricLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 8.5,
    lineHeight: 12,
    minHeight: 24,
    textTransform: 'uppercase',
    letterSpacing: 0,
    textAlign: 'center',
  },
  heroMetricValue: {
    marginTop: 6,
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  heroMetricHelper: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
  primaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primary,
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
  scoreCard: {
    marginTop: 4,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
    padding: patientTheme.spacing.card,
    gap: 14,
    ...patientShadow,
  },
  scoreMain: {
    justifyContent: 'center',
  },
  scoreLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scoreValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  scoreHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: '100%',
  },
  scoreLatestCard: {
    borderRadius: 18,
    backgroundColor: patientTheme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scoreLatestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  scoreBadgeText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: patientTheme.colors.primaryDark,
  },
  scoreLatestTime: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scoreLatestTitle: {
    marginTop: 8,
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  scoreLatestSummary: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  scoreLatestNutrition: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  evolutionSection: {
    marginTop: 18,
    marginBottom: 2,
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
    alignItems: 'center',
    ...patientShadow,
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
  nutritionPanel: {
    marginTop: 8,
    overflow: 'hidden',
  },
  nutritionCarouselContent: {
    paddingRight: 0,
  },
  nutritionCardCarouselItem: {
    paddingHorizontal: 6,
    marginRight: 0,
  },
  nutritionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    minHeight: 620,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  nutritionCarouselIndicatorRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nutritionCarouselIndicator: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d1ddd7',
  },
  nutritionCarouselIndicatorActive: {
    width: 22,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  nutritionHeaderCopy: {
    flex: 1,
  },
  nutritionTitle: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  nutritionSubtitle: {
    marginTop: 5,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  chartRangePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  chartRangeText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  macroRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  macroCopy: {
    flex: 1,
  },
  macroLabel: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  macroHelper: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  macroValueWrap: {
    width: 124,
  },
  macroValue: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  macroTrack: {
    marginTop: 8,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#dfe9e4',
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  microRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  microCopy: {
    flex: 1,
  },
  microLabel: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  microHelper: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  microValueWrap: {
    width: 124,
  },
  microValue: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  microTrack: {
    marginTop: 8,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#dfe9e4',
    overflow: 'hidden',
  },
  microFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#5fcf95',
  },
  sectionHeaderRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  sectionPill: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  sectionPillText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  timelineCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 26,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 18,
  },
  timeColumn: {
    width: 50,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  timeLine: {
    marginTop: 8,
    width: 2,
    flex: 1,
    minHeight: 64,
    backgroundColor: patientTheme.colors.border,
  },
  kindIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 4,
  },
  timelineEntryCard: {
    borderRadius: 22,
    backgroundColor: patientTheme.colors.surfaceMuted,
    padding: 14,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
    flex: 1,
  },
  timelineDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
  },
  timelineMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  noteTagText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  deltaText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineNutritionSummary: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  aiFeedback: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: patientTheme.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
  },
  emptyIllustration: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
  },
  emptyStateText: {
    marginTop: 10,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  emptyPrimaryButton: {
    alignSelf: 'center',
    marginTop: 16,
  },
});













