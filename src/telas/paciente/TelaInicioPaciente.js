import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
  Modal,
  PanResponder,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import BarraAbasPaciente, {
  PATIENT_TAB_BAR_HEIGHT,
  PATIENT_TAB_BAR_SPACE,
} from '../../componentes/paciente/BarraAbasPaciente';
import PatientDrawer from '../../componentes/paciente/MenuPaciente';
import { supabase } from '../../servicos/configSupabase';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  buildHomeInsights,
  getTrendMeta,
} from '../../dados/dadosExperienciaPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  fetchPatientNutritionistChat,
  getCachedPatientExperience,
  getLatestGlucose,
  getPatientDisplayName,
  getPatientId,
  isPatientExperienceCacheFresh,
  mergeAppStateMealEntries,
  refreshPatientGlucoseReadings,
  refreshPatientMealEntries,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import { syncLinkedLibreViewReadings } from '../../servicos/servicoLibreViewAutoSync';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import { EsqueletoMetricaGlicose } from '../../componentes/comum/EsqueletoCarregamento';
import { getMealEntryNutrition } from '../../servicos/servicoRefeicaoIA';
import { syncGooglePatientRecord } from '../../servicos/sincronizarPacienteGoogle';
import {
  buildPlanDayStatus,
  resolvePlanSections,
} from '../../utilitarios/vinculoPlanoRefeicao';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  replaceCachedGlucoseReadings,
  subscribeToGlucoseReadings,
} from '../../servicos/centralGlicose';
import {
  getCachedPatientAppState,
  replaceCachedPatientAppState,
  subscribeToPatientAppState,
} from '../../servicos/centralAppState';
import {
  getCachedPatientChat,
  invalidatePatientChatCache,
  replaceCachedPatientChat,
} from '../../servicos/cacheExperienciaPaciente';
import MensagemInline from '../../componentes/comum/MensagemInline';
import HostToastPaciente from '../../componentes/comum/HostToastPaciente';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import { listPatientClinicalAlerts } from '../../servicos/servicoAlertasClinicos';
import {
  buildLocalDateString,
  buildTodaySparklineFromReadings,
  filterGlucoseReadingsLastHours,
  getGlucoseReadingDisplayDate,
} from '../../utilitarios/dataLocal';
import { criarGuardiaoCarregamentoInicial } from '../../utilitarios/carregamentoTela';
import {
  PATIENT_MAIN_TAB_ROUTES,
  navigatePatientTab,
} from '../../utilitarios/navegacaoAbas';
import { navigatePatientFeature } from '../../utilitarios/navegacaoPaciente';
import {
  buildPatientChatPreview,
  getPatientChatLastReadAt,
  resolveNutritionistThreadMerge,
} from '../../utilitarios/chatConversa';
import { limparSessaoPaciente } from '../../servicos/servicoSessaoPaciente';
import { garantirSessaoRpcClinicaComPerfil } from '../../servicos/servicoSessaoRpc';

const HOME_CHAT_BUTTON_SIZE = 54;
const HOME_CHAT_BUTTON_EDGE_GAP = patientTheme.spacing.screen;
const HOME_CHAT_BUTTON_MIN_TOP = 104;
const HOME_CHAT_BUTTON_POSITION_KEY = '@glicnutri:homeChatButtonPosition';
const HOME_CHAT_DRAG_THRESHOLD = 2;

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatNotificationDate(date) {
  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatNotificationTime(date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function getGlucoseLevelColor(value) {
  if (!value) return patientTheme.colors.textMuted;
  if (value < 54) return '#E50914';
  if (value < 70) return '#f28c28';
  if (value <= 180) return patientTheme.colors.primaryDark;
  if (value <= 250) return '#FFD600';
  return '#E50914';
}

function getGlucoseStatusMeta(value) {
  if (!value) {
    return {
      label: 'Sem leitura',
      icon: 'remove-outline',
      color: patientTheme.colors.textMuted,
      textColor: patientTheme.colors.textMuted,
    };
  }

  if (value < 54) {
    return {
      label: 'Muito grave',
      icon: 'alert-circle-outline',
      color: '#E50914',
      textColor: '#ffffff',
    };
  }

  if (value < 70) {
    return {
      label: 'Baixo',
      icon: 'trending-down-outline',
      color: '#f28c28',
      textColor: '#ffffff',
    };
  }

  if (value <= 180) {
    return {
      label: 'Ideal',
      icon: 'checkmark-circle-outline',
      color: patientTheme.colors.primaryDark,
      textColor: '#ffffff',
    };
  }

  if (value <= 250) {
    return {
      label: 'Alto leve',
      icon: 'trending-up-outline',
      color: '#FFD600',
      textColor: '#ffffff',
    };
  }

  return {
    label: 'Grave',
    icon: 'alert-circle-outline',
    color: '#E50914',
    textColor: '#ffffff',
  };
}

function Sparkline({ data }) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 220;
  const chartPaddingHorizontal = 42;
  const chartPaddingTop = 30;
  const chartPaddingBottom = 34;
  const chartData = data;
  const chartMarks = [50, 100, 150, 200, 250, 300, 350, 400];
  const min = 50;
  const max = 400;
  const range = Math.max(max - min, 1);
  const contentWidth = Math.max(chartWidth - chartPaddingHorizontal * 2, 1);
  const contentHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const getTopForValue = (value) =>
    chartPaddingTop + (1 - (Math.min(Math.max(value, min), max) - min) / range) * contentHeight;
  const safeRangeTop = getTopForValue(180);
  const safeRangeHeight = getTopForValue(70) - safeRangeTop;
  const points = chartData.map((item, index) => {
    const x =
      chartPaddingHorizontal +
      (chartData.length === 1 ? contentWidth : (index / (chartData.length - 1)) * contentWidth);
    const y = getTopForValue(item.value);

    return { ...item, x, y };
  });

  return (
    <View
      style={styles.glucoseLineChart}
      onLayout={({ nativeEvent }) => setChartWidth(nativeEvent.layout.width)}
    >
      <View style={[styles.homeSafeRangeBand, { top: safeRangeTop, height: safeRangeHeight }]} />
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
            const segmentColor = getGlucoseLevelColor(point.value);

            return (
              <View
                key={`${point.value}-${index}`}
                style={[
                  styles.glucoseLineSegment,
                  {
                    backgroundColor: segmentColor,
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

      {chartWidth > 0 && points.length ? (
        points.map((point, index) => {
          const pointColor = getGlucoseLevelColor(point.value);

          return (
            <View
              key={`${point.value}-dot-${index}`}
              style={[
                styles.glucosePointer,
                {
                  backgroundColor: pointColor,
                  borderColor: pointColor,
                  left: point.x - 6,
                  top: point.y - 6,
                },
              ]}
            />
          );
        })
      ) : null}

      {chartWidth > 0 && points.length ? (
        points.map((point, index) => (
          <Text
            key={`${point.value}-value-${index}`}
            style={[
              styles.glucosePointValue,
              {
                left: Math.min(Math.max(point.x - 18, 4), Math.max(chartWidth - 42, 4)),
                top: Math.max(point.y - 23, 5),
              },
            ]}
          >
            {point.value}
          </Text>
        ))
      ) : null}

      <View style={styles.glucoseChartLabelsRow}>
        {points.map((point, index) => (
          <Text
            key={`${point.label || point.value}-label-${index}`}
            style={[
              styles.glucoseChartLabel,
              {
                left: Math.min(Math.max(point.x - 22, 4), Math.max(chartWidth - 48, 4)),
              },
            ]}
          >
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function TimeInRangeBar({ summary }) {
  const hasReadings = summary.total > 0;
  const inRange = hasReadings ? summary.inRangePercent : 0;
  const above = hasReadings ? summary.abovePercent : 0;
  const below = hasReadings ? summary.belowPercent : 0;

  return (
    <View>
      <View style={styles.rangeBar}>
        {hasReadings ? (
          <>
            {inRange > 0 ? (
              <View
                style={[
                  styles.rangeSegment,
                  styles.rangePrimary,
                  { width: `${inRange}%` },
                ]}
              />
            ) : null}
            {above > 0 ? (
              <View
                style={[
                  styles.rangeSegment,
                  styles.rangeWarning,
                  { width: `${above}%` },
                ]}
              />
            ) : null}
            {below > 0 ? (
              <View
                style={[
                  styles.rangeSegment,
                  styles.rangeInfo,
                  { width: `${below}%` },
                ]}
              />
            ) : null}
          </>
        ) : (
          <View style={[styles.rangeSegment, styles.rangeEmpty, { width: '100%' }]} />
        )}
      </View>

      <View style={styles.rangeLegend}>
        <View style={styles.rangeLegendItem}>
          <View
            style={[
              styles.rangeLegendDot,
              { backgroundColor: patientTheme.colors.primaryDark },
            ]}
          />
          <Text style={styles.rangeLegendText}>{inRange}% na meta</Text>
        </View>
        <View style={styles.rangeLegendItem}>
          <View style={[styles.rangeLegendDot, { backgroundColor: '#FFD600' }]} />
          <Text style={styles.rangeLegendText}>{above}% acima</Text>
        </View>
        <View style={styles.rangeLegendItem}>
          <View style={[styles.rangeLegendDot, { backgroundColor: '#f28c28' }]} />
          <Text style={styles.rangeLegendText}>{below}% abaixo</Text>
        </View>
      </View>
    </View>
  );
}

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

const NUTRIENT_KEYWORDS = [
  {
    keys: ['iogurte', 'kefir', 'leite fermentado'],
    macros: { carbs: 12, protein: 8, fat: 4 },
    micros: ['Cálcio', 'Probióticos'],
  },
  {
    keys: ['aveia', 'farelo de aveia', 'granola'],
    macros: { carbs: 27, protein: 5, fat: 3 },
    micros: ['Fibras', 'Magnésio'],
  },
  {
    keys: ['chia', 'castanha', 'sement'],
    macros: { carbs: 6, protein: 4, fat: 8 },
    micros: ['Ômega-3', 'Magnésio'],
  },
  {
    keys: ['morango', 'fruta', 'maçã', 'maca', 'laranja'],
    macros: { carbs: 15, protein: 1, fat: 0 },
    micros: ['Vitamina C', 'Fibras'],
  },
  {
    keys: ['arroz', 'quinoa', 'batata-doce', 'pão', 'pao', 'torrada', 'biscoito'],
    macros: { carbs: 32, protein: 4, fat: 2 },
    micros: ['Fibras', 'Magnésio'],
  },
  {
    keys: ['feijão', 'feijao', 'lentilha', 'grão-de-bico', 'grao-de-bico'],
    macros: { carbs: 22, protein: 9, fat: 1 },
    micros: ['Ferro', 'Fibras'],
  },
  {
    keys: ['frango', 'peixe', 'carne', 'tofu', 'ovo'],
    macros: { carbs: 0, protein: 25, fat: 7 },
    micros: ['Ferro', 'Zinco'],
  },
  {
    keys: ['salada', 'legume', 'sopa', 'verdura', 'brócolis', 'brocolis'],
    macros: { carbs: 10, protein: 3, fat: 1 },
    micros: ['Potássio', 'Vitamina C'],
  },
];

function todayDateString() {
  return buildLocalDateString();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getMealText(entry) {
  return [entry?.title, entry?.description, entry?.text]
    .filter(Boolean)
    .join(' ');
}

function getPlanText(section) {
  return [
    section?.title,
    section?.description,
    ...(Array.isArray(section?.foods) ? section.foods : []),
  ]
    .filter(Boolean)
    .join(' ');
}

function estimateNutritionFromTexts(texts) {
  const totals = { carbs: 0, protein: 0, fat: 0 };
  const micros = new Set();
  let matches = 0;

  texts.forEach((rawText) => {
    const text = normalizeText(rawText);

    NUTRIENT_KEYWORDS.forEach((item) => {
      const found = item.keys.some((key) => text.includes(normalizeText(key)));
      if (!found) return;

      matches += 1;
      totals.carbs += item.macros.carbs;
      totals.protein += item.macros.protein;
      totals.fat += item.macros.fat;
      item.micros.forEach((micro) => micros.add(micro));
    });
  });

  return {
    ...totals,
    calories: Math.round(totals.carbs * 4 + totals.protein * 4 + totals.fat * 9),
    micros: Array.from(micros),
    matches,
  };
}

function percentage(value, target) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function buildNutritionSummary(mealEntries, planSections) {
  const today = todayDateString();
  const todayMeals = (mealEntries || []).filter(
    (entry) => String(entry?.date || '').slice(0, 10) === today
  );
  const consumedFromMeals = todayMeals.reduce(
    (totals, entry) => {
      const structured = getMealEntryNutrition(entry);

      if (structured) {
        const structuredMicros = [
          structured.fiber > 0 ? 'Fibras' : null,
          structured.sodium > 0 ? 'Sódio' : null,
          structured.sugars > 0 ? 'Açúcares' : null,
          structured.saturatedFat > 0 ? 'Gordura saturada' : null,
        ].filter(Boolean);

        return {
          carbs: totals.carbs + structured.carbs,
          protein: totals.protein + structured.protein,
          fat: totals.fat + structured.fat,
          calories: totals.calories + structured.calories,
          fiber: totals.fiber + structured.fiber,
          sugars: totals.sugars + structured.sugars,
          saturatedFat: totals.saturatedFat + structured.saturatedFat,
          sodium: totals.sodium + structured.sodium,
          micros: Array.from(new Set([...totals.micros, ...structuredMicros])),
        };
      }

      const estimated = estimateNutritionFromTexts([getMealText(entry)]);

      return {
        carbs: totals.carbs + estimated.carbs,
        protein: totals.protein + estimated.protein,
        fat: totals.fat + estimated.fat,
        calories: totals.calories + estimated.calories,
        fiber: totals.fiber,
        sugars: totals.sugars,
        saturatedFat: totals.saturatedFat,
        sodium: totals.sodium,
        micros: Array.from(new Set([...totals.micros, ...estimated.micros])),
      };
    },
    { carbs: 0, protein: 0, fat: 0, calories: 0, fiber: 0, sugars: 0, saturatedFat: 0, sodium: 0, micros: [] }
  );
  const consumed = {
    ...consumedFromMeals,
    calories:
      consumedFromMeals.calories > 0
        ? consumedFromMeals.calories
        : Math.round(
            consumedFromMeals.carbs * 4 +
              consumedFromMeals.protein * 4 +
              consumedFromMeals.fat * 9
          ),
  };
  const planned = estimateNutritionFromTexts((planSections || []).map(getPlanText));
  const target = planned.matches
    ? planned
    : { carbs: 160, protein: 80, fat: 55, calories: 1455, micros: ['Fibras', 'Ferro', 'Cálcio'] };

  const microTarget = target.micros.length || 1;
  const consumedMicroSet = new Set(consumed.micros);
  const plannedMicroSet = new Set(target.micros);
  const matchedMicros = Array.from(consumedMicroSet).filter((item) => plannedMicroSet.has(item));

  return {
    consumed,
    target,
    macroItems: [
      { label: 'Carboidratos', value: consumed.carbs, target: target.carbs, unit: 'g' },
      { label: 'Proteínas', value: consumed.protein, target: target.protein, unit: 'g' },
      { label: 'Gorduras', value: consumed.fat, target: target.fat, unit: 'g' },
    ],
    microItems: Array.from(
      new Map(
        target.micros.slice(0, 5).map((label) => ({
          label,
          reached: consumedMicroSet.has(label),
        })).concat([
          { label: 'Fibras', value: Math.round(consumed.fiber), unit: 'g', reached: consumed.fiber > 0 },
          { label: 'Açúcares', value: Math.round(consumed.sugars), unit: 'g', reached: consumed.sugars > 0 },
          { label: 'Sódio', value: Math.round(consumed.sodium), unit: 'mg', reached: consumed.sodium > 0 },
        ]).map((item) => [item.label, item])
      ).values()
    ).slice(0, 6),
    microScore: percentage(matchedMicros.length, microTarget),
    mealCount: todayMeals.length,
    plannedCount: (planSections || []).length,
  };
}

function buildGlucoseSummary(glucoseReadings) {
  const dedupedReadings = mergeCachedGlucoseReadings(glucoseReadings || []);
  const today = todayDateString();
  const todayReadings = dedupedReadings.filter(
    (item) => getGlucoseReadingDisplayDate(item) === today
  );
  const lastDayReadings = filterGlucoseReadingsLastHours(dedupedReadings, 24);
  const baseReadings =
    todayReadings.length >= 2
      ? todayReadings
      : lastDayReadings.length
        ? lastDayReadings
        : dedupedReadings;
  const inRange = baseReadings.filter((item) => item.value >= 70 && item.value <= 180).length;
  const above = baseReadings.filter((item) => item.value > 180).length;
  const below = baseReadings.filter((item) => item.value < 70).length;

  return {
    total: baseReadings.length,
    inRangePercent: percentage(inRange, baseReadings.length),
    abovePercent: percentage(above, baseReadings.length),
    belowPercent: percentage(below, baseReadings.length),
  };
}

function ProgressLine({ label, value, target, unit }) {
  const progress = percentage(value, target);

  return (
    <View style={styles.nutritionLine}>
      <View style={styles.nutritionLineTop}>
        <Text style={styles.nutritionLabel}>{label}</Text>
        <Text style={styles.nutritionValue}>
          {Math.round(value)}{unit} / {Math.round(target)}{unit}
        </Text>
      </View>
      <View style={styles.nutritionTrack}>
        <View style={[styles.nutritionFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

function GlucoseMetricCard({
  width,
  currentGlucose,
  trendMeta,
  sparklineData,
  glucoseSummary,
  latestGlucose,
  loading,
}) {
  if (loading && !currentGlucose) {
    return <EsqueletoMetricaGlicose width={width} />;
  }

  const glucoseLabel = currentGlucose ? `${currentGlucose} mg/dL` : '-- mg/dL';
  const readingSource = String(latestGlucose?.source || latestGlucose?.fonte || '').toLowerCase();
  const sourceSuffix = readingSource.includes('libre') || readingSource.includes('cgm') ? ' · Sensor' : '';
  const updatedLabel = latestGlucose?.time
    ? `Atualizado ${String(latestGlucose.time).slice(0, 8)}${sourceSuffix}`
    : 'Sem registro hoje';
  const statusMeta = getGlucoseStatusMeta(currentGlucose);

  return (
    <SectionCard style={[styles.metricSlide, { width }]}>
      <View style={styles.heroTopRow}>
        <View>
          <Text style={styles.eyebrow}>Glicose em tempo real</Text>
          <Text style={styles.glucoseValue}>{glucoseLabel}</Text>
        </View>

        <View style={[styles.trendBadge, { backgroundColor: statusMeta.color }]}>
          <Ionicons
            name={statusMeta.icon}
            size={18}
            color={statusMeta.textColor}
          />
          <Text style={[styles.trendBadgeText, { color: statusMeta.textColor }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      <Text style={styles.heroHelper}>{trendMeta.helper}</Text>
      <View style={styles.rangeHeader}>
        <Text style={styles.rangeTitle}>Tempo na meta hoje</Text>
        <Text style={styles.rangeValue}>
          {glucoseSummary.total ? `${glucoseSummary.inRangePercent}% dentro da meta` : 'Sem leituras'}
        </Text>
      </View>
      <TimeInRangeBar summary={glucoseSummary} />

      <Sparkline data={sparklineData} />

      <View style={styles.sparklineFooter}>
        <Text style={styles.sparklineLabel}>Últimas leituras</Text>
        <Text style={styles.sparklineLabel}>{updatedLabel}</Text>
      </View>
    </SectionCard>
  );
}

function MacroMetricCard({ width, nutritionSummary }) {
  const totalProgress = percentage(
    nutritionSummary.consumed.calories,
    nutritionSummary.target.calories
  );

  return (
    <SectionCard style={[styles.metricSlide, { width }]}>
      <View style={styles.metricCardHeader}>
        <View>
          <Text style={styles.eyebrow}>Macronutrientes</Text>
          <Text style={styles.metricMainValue}>{totalProgress}% do plano</Text>
        </View>

        <View style={styles.metricIconWrap}>
          <MaterialCommunityIcons
            name="chart-donut"
            size={23}
            color={patientTheme.colors.primaryDark}
          />
        </View>
      </View>

      <Text style={styles.heroHelper}>
        Baseado nas refeições registradas hoje no diário e no plano alimentar proposto.
      </Text>

      <View style={styles.nutritionList}>
        {nutritionSummary.macroItems.map((item) => (
          <ProgressLine
            key={item.label}
            label={item.label}
            value={item.value}
            target={item.target}
            unit={item.unit}
          />
        ))}
      </View>

      <Text style={styles.metricFootnote}>
        {nutritionSummary.mealCount
          ? `${nutritionSummary.mealCount} refeição(ões) considerada(s) hoje`
          : 'Registre uma refeição no diário para atualizar este painel'}
      </Text>
    </SectionCard>
  );
}

function MicroMetricCard({ width, nutritionSummary }) {
  return (
    <SectionCard style={[styles.metricSlide, { width }]}>
      <View style={styles.metricCardHeader}>
        <View>
          <Text style={styles.eyebrow}>Micronutrientes</Text>
          <Text style={styles.metricMainValue}>{nutritionSummary.microScore}% coberto</Text>
        </View>

        <View style={styles.metricIconWrap}>
          <MaterialCommunityIcons
            name="sprout-outline"
            size={23}
            color={patientTheme.colors.primaryDark}
          />
        </View>
      </View>

      <Text style={styles.heroHelper}>
        Vitaminas e minerais estimados pelas escolhas registradas no diário.
      </Text>

      <View style={styles.microGrid}>
        {nutritionSummary.microItems.map((item, index) => (
          <View
            key={`${item.label}-${index}`}
            style={[styles.microPill, item.reached && styles.microPillReached]}
          >
            <Ionicons
              name={item.reached ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={item.reached ? patientTheme.colors.primaryDark : patientTheme.colors.textMuted}
            />
            <Text style={[styles.microPillText, item.reached && styles.microPillTextReached]}>
              {item.value != null ? `${item.label}: ${item.value}${item.unit || ''}` : item.label}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.metricFootnote}>
        {nutritionSummary.mealCount
          ? 'Quanto mais detalhado o diário, mais preciso fica o resumo.'
          : 'Sem refeições registradas hoje para cruzar com o plano.'}
      </Text>
    </SectionCard>
  );
}

export default function PacienteHomeScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const initialChatButtonBottom = PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE + 8;
  const initialChatButtonLeft = Math.max(
    HOME_CHAT_BUTTON_EDGE_GAP,
    windowWidth - HOME_CHAT_BUTTON_EDGE_GAP - HOME_CHAT_BUTTON_SIZE
  );
  const [chatButtonPosition, setChatButtonPosition] = useState(() => ({
    left: initialChatButtonLeft,
    bottom: initialChatButtonBottom,
  }));
  const chatButtonPositionRef = useRef({
    left: initialChatButtonLeft,
    bottom: initialChatButtonBottom,
  });
  const chatDragStartRef = useRef({
    left: initialChatButtonLeft,
    bottom: initialChatButtonBottom,
  });
  const chatDraggedRef = useRef(false);
  const chatLeftAnim = useRef(new Animated.Value(initialChatButtonLeft)).current;
  const chatBottomAnim = useRef(new Animated.Value(initialChatButtonBottom)).current;
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useState({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [mensagemHome, setMensagemHome] = useState(null);
  const [activeMetricIndex, setActiveMetricIndex] = useState(0);

  const [paciente, setPaciente] = useState(null);
  const [clinicalObjective, setClinicalObjective] = useState('');
  const [appState, setAppState] = useState(() => {
    const initialPatientId = getPatientId(usuarioProp || route?.params?.usuarioLogado || null);
    return (initialPatientId && getCachedPatientAppState(initialPatientId)) || createDefaultAppState();
  });
  const [glucoseReadings, setGlucoseReadings] = useState([]);
  const [clinicalAlerts, setClinicalAlerts] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [technicalLoadLog, setTechnicalLoadLog] = useState('');
  const [chatLastReadAt, setChatLastReadAt] = useState(null);
  const loadGuardRef = React.useRef(criarGuardiaoCarregamentoInicial());
  const loadInFlightRef = useRef(null);
  const homeLoadedRef = useRef(false);

  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;

  const idPaciente = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const canResolvePatient = useMemo(
    () =>
      Boolean(
        idPaciente ||
        usuarioLogado?.id_paciente_uuid ||
        usuarioLogado?.cpf_paciente ||
        usuarioLogado?.email_pac ||
        usuarioLogado?.email ||
        usuarioLogado?.id
      ),
    [idPaciente, usuarioLogado]
  );

  const nomeBaseUsuario = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);
  const homeFetchOptions = useMemo(
    () => ({
      patientContext: usuarioLogado,
      ...mesclarLimitesDadosPaciente('resumo'),
    }),
    [usuarioLogado]
  );

  const aplicarExperience = useCallback(
    function aplicarExperience(experience) {
      setPaciente(
        experience.patient || {
          ...usuarioLogado,
          id_paciente_uuid: idPaciente,
          nome_completo: nomeBaseUsuario,
          email_pac: usuarioLogado?.email || null,
        }
      );
      const patientUuid = experience.patient?.id_paciente_uuid || idPaciente;

      let nextAppStateForCache = null;
      setAppState((current) => {
        const merged = mergeAppStateMealEntries(experience.appState, patientUuid);
        nextAppStateForCache = {
          ...merged,
          nutritionistThread: resolveNutritionistThreadMerge(
            current?.nutritionistThread,
            merged?.nutritionistThread
          ),
        };
        return nextAppStateForCache;
      });
      if (patientUuid && nextAppStateForCache) {
        replaceCachedPatientAppState(patientUuid, nextAppStateForCache);
      }
      setClinicalObjective(experience.clinicalObjective);

      const glucoseFromExperience = Array.isArray(experience.glucoseReadings)
        ? experience.glucoseReadings
        : [];
      if (patientUuid && glucoseFromExperience.length) {
        replaceCachedGlucoseReadings(
          patientUuid,
          mergeCachedGlucoseReadings(
            glucoseFromExperience,
            getCachedGlucoseReadings(patientUuid)
          )
        );
      }
    },
    [idPaciente, nomeBaseUsuario, usuarioLogado]
  );

  const carregarAlertasClinicos = useCallback(async function carregarAlertasClinicos(patientUuid) {
    if (!patientUuid) {
      setClinicalAlerts([]);
      return;
    }

    try {
      const alerts = await listPatientClinicalAlerts(patientUuid, {
        onlyUnread: false,
        limit: 20,
      });
      setClinicalAlerts(alerts || []);
    } catch (error) {
      console.log('Erro ao carregar alertas clinicos do paciente:', error);
      setClinicalAlerts([]);
    }
  }, []);

  const agendarAlertasClinicos = useCallback(
    function agendarAlertasClinicos(patientUuid, delayMs = 450) {
      if (!patientUuid) return;
      setTimeout(() => {
        carregarAlertasClinicos(patientUuid);
      }, delayMs);
    },
    [carregarAlertasClinicos]
  );

  const atualizarExperienceSilencioso = useCallback(
    function atualizarExperienceSilencioso(experience) {
      if (!experience) return;
      aplicarExperience(experience);
      agendarAlertasClinicos(experience.patient?.id_paciente_uuid || idPaciente, 120);
    },
    [agendarAlertasClinicos, aplicarExperience, idPaciente]
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
          `patientId=${idPaciente || 'sem-id'}`,
          `email=${email}`,
          code ? `code=${code}` : null,
          `message=${message}`,
        ]
          .filter(Boolean)
          .join('\n')
      );
    },
    [idPaciente, usuarioLogado]
  );

  const carregarDados = useCallback(async function carregarDados(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const backgroundOnly = options.backgroundOnly === true;

    if (loadInFlightRef.current && !backgroundOnly) {
      return loadInFlightRef.current;
    }

    const run = (async () => {
      try {
        setTechnicalLoadLog('');
        if (!canResolvePatient) {
          setPaciente({
            nome_completo: nomeBaseUsuario,
            email_pac: usuarioLogado?.email || null,
          });
          setAppState(createDefaultAppState());
          setClinicalObjective('');
          setGlucoseReadings([]);
          setClinicalAlerts([]);
          setMetricsLoading(false);
          return;
        }

        await garantirSessaoRpcClinicaComPerfil(usuarioLogado).catch(() => null);

        const cacheOptions = homeFetchOptions;
        const cachedExperience = !forceRefresh
          ? getCachedPatientExperience(idPaciente, cacheOptions)
          : null;
        const cacheIsFresh = isPatientExperienceCacheFresh(idPaciente, cacheOptions);

        if (cachedExperience && !forceRefresh) {
          if (!backgroundOnly) {
            aplicarExperience(cachedExperience);
            setLoadError(null);
            setMetricsLoading(false);
            setRefreshing(false);
            agendarAlertasClinicos(cachedExperience.patient?.id_paciente_uuid || idPaciente);
          }

          const mergedMeals =
            mergeAppStateMealEntries(cachedExperience.appState, idPaciente)?.mealEntries?.length || 0;

          if (cacheIsFresh && mergedMeals > 0) {
            return;
          }

          fetchPatientExperience(idPaciente, {
            ...cacheOptions,
            forceRefresh: mergedMeals === 0,
            patientContext: usuarioLogado,
          })
            .then(aplicarExperience)
            .catch((error) => {
              registrarLogTecnicoCarga('home_refresh_background', error);
              console.log('Refresh home paciente:', error);
            });
          return;
        }

        if (backgroundOnly) {
          return;
        }

        const experience = await fetchPatientExperience(idPaciente, {
          ...cacheOptions,
          patientContext: usuarioLogado,
          currentPatient: usuarioLogado?.id_paciente_uuid ? usuarioLogado : undefined,
        });

        aplicarExperience(experience);
        setLoadError(null);
        setMetricsLoading(false);
        setRefreshing(false);
        agendarAlertasClinicos(experience.patient?.id_paciente_uuid || idPaciente);

        if (!experience.patient && usuarioLogado?.id) {
          syncGooglePatientRecord(usuarioLogado)
            .then((pacienteSincronizado) => {
              if (pacienteSincronizado?.id_paciente_uuid) {
                aplicarExperience({
                  ...experience,
                  patient: pacienteSincronizado,
                });
              }
            })
            .catch(() => {});
        }
      } catch (error) {
        registrarLogTecnicoCarga('home_load', error);
        console.log('Erro ao carregar dados:', error);
        if (!getCachedPatientExperience(idPaciente, homeFetchOptions)) {
          setLoadError(
            'Não foi possível carregar seu painel. Verifique a conexão e tente novamente.'
          );
        }
        setMetricsLoading(false);
      } finally {
        setRefreshing(false);
      }
    })();

    if (!backgroundOnly) {
      loadInFlightRef.current = run;
    }

    try {
      await run;
    } finally {
      if (!backgroundOnly) {
        loadInFlightRef.current = null;
      }
    }
  }, [
    agendarAlertasClinicos,
    aplicarExperience,
    atualizarExperienceSilencioso,
    canResolvePatient,
    homeFetchOptions,
    idPaciente,
    nomeBaseUsuario,
    registrarLogTecnicoCarga,
    usuarioLogado,
  ]);

  useLayoutEffect(() => {
    setPaciente((current) =>
      current?.nome_completo
        ? current
        : {
            ...usuarioLogado,
            id_paciente_uuid: idPaciente,
            nome_completo: nomeBaseUsuario,
            email_pac: usuarioLogado?.email_pac || usuarioLogado?.email || null,
          }
    );

    if (!canResolvePatient || !idPaciente) {
      setMetricsLoading(false);
      return;
    }

    const cachedExperience = getCachedPatientExperience(idPaciente, homeFetchOptions);
    const cachedGlucose = getCachedGlucoseReadings(idPaciente);
    const cachedAppState = getCachedPatientAppState(idPaciente);

    if (cachedExperience) {
      aplicarExperience(cachedExperience);
      setMetricsLoading(false);
      return;
    }

    if (cachedGlucose.length || cachedAppState) {
      if (cachedAppState) {
        setAppState(cachedAppState);
      }
      if (cachedGlucose.length) {
        setGlucoseReadings(cachedGlucose);
      }
      setMetricsLoading(false);
    }
  }, [aplicarExperience, canResolvePatient, homeFetchOptions, idPaciente, nomeBaseUsuario, usuarioLogado]);

  async function persistirAppState(nextState) {
    if (!canResolvePatient) {
      setAppState(nextState);
      return;
    }

    const saved = await savePatientAppState({
      patientId: idPaciente,
      objectiveText: clinicalObjective,
      appState: nextState,
      currentPatient: paciente,
      patientContext: usuarioLogado,
    });

    setPaciente(saved.patient || paciente);
    setAppState(saved.appState);
    setClinicalObjective(saved.clinicalObjective || clinicalObjective);
  }

  async function handleLogout() {
    try {
      setMenuVisible(false);
      setSaindo(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.log('Erro ao sair:', error.message);
      }

      await limparSessaoPaciente();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.log('Erro inesperado no logout:', error);
      setMensagemHome({
        tipo: 'erro',
        texto:
          'Não foi possível sair da conta. Verifique a conexão e tente novamente.',
      });
    } finally {
      setSaindo(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (loadGuardRef.current.deveIgnorarCarregamentoFocus()) {
        return undefined;
      }

      carregarDados({ forceRefresh: false });
      homeLoadedRef.current = true;

      if (!idPaciente) {
        return undefined;
      }

      const cacheFresco = isPatientExperienceCacheFresh(idPaciente, homeFetchOptions);

      if (!cacheFresco) {
        refreshPatientMealEntries(idPaciente, {
          patientContext: usuarioLogado,
          mealLimit: homeFetchOptions.mealLimit,
        }).catch((error) => {
          console.log('Refresh refeicoes na home:', error);
        });
      }

      const refreshGlucose = async () => {
        try {
          await syncLinkedLibreViewReadings({
            patientId: idPaciente,
            patientEmail: usuarioLogado?.email_pac || usuarioLogado?.email || '',
            actor: usuarioLogado,
            glucoseLimit: Math.max(homeFetchOptions.glucoseLimit || 48, 48),
            silent: true,
          });
        } catch (error) {
          console.log('Sync LibreLinkUp na home:', error?.message || error);
        }

        await refreshPatientGlucoseReadings(idPaciente, {
          patientContext: usuarioLogado,
          glucoseLimit: Math.max(homeFetchOptions.glucoseLimit || 48, 48),
        }).catch((error) => {
          console.log('Refresh glicose na home:', error);
        });
      };

      refreshGlucose();

      return undefined;
    }, [carregarDados, homeFetchOptions, idPaciente, navigation, usuarioLogado])
  );

  function navegarParaTela(rota, params = {}) {
    navigatePatientFeature(navigation, rota, { usuarioLogado, ...params });
  }

  function abrirChatNutricionista() {
    navegarParaTela('PacienteChatNutricionista');
  }

  const getChatButtonBounds = useCallback(() => {
    const minLeft = HOME_CHAT_BUTTON_EDGE_GAP;
    const maxLeft = Math.max(
      minLeft,
      windowWidth - HOME_CHAT_BUTTON_EDGE_GAP - HOME_CHAT_BUTTON_SIZE
    );
    const minBottom = PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE + 8;
    const maxBottom = Math.max(
      minBottom,
      windowHeight -
        HOME_CHAT_BUTTON_MIN_TOP -
        HOME_CHAT_BUTTON_SIZE -
        8
    );

    return { minLeft, maxLeft, minBottom, maxBottom };
  }, [windowHeight, windowWidth]);

  const clampChatButtonPosition = useCallback(
    (position) => {
      const bounds = getChatButtonBounds();
      return {
        left: Math.min(Math.max(position.left, bounds.minLeft), bounds.maxLeft),
        bottom: Math.min(Math.max(position.bottom, bounds.minBottom), bounds.maxBottom),
      };
    },
    [getChatButtonBounds]
  );

  const snapChatButtonPosition = useCallback(
    (position) => {
      const bounds = getChatButtonBounds();
      const clamped = clampChatButtonPosition(position);
      const snapLeft =
        clamped.left + HOME_CHAT_BUTTON_SIZE / 2 < windowWidth / 2
          ? bounds.minLeft
          : bounds.maxLeft;

      return { ...clamped, left: snapLeft };
    },
    [clampChatButtonPosition, getChatButtonBounds, windowWidth]
  );

  const persistChatButtonPosition = useCallback(async (position) => {
    try {
      await AsyncStorage.setItem(HOME_CHAT_BUTTON_POSITION_KEY, JSON.stringify(position));
    } catch (_) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setChatButtonPosition((current) => clampChatButtonPosition(current));
  }, [clampChatButtonPosition]);

  useEffect(() => {
    let cancelled = false;

    async function carregarPosicaoChat() {
      try {
        const raw = await AsyncStorage.getItem(HOME_CHAT_BUTTON_POSITION_KEY);
        if (cancelled || !raw) return;

        const parsed = JSON.parse(raw);
        const nextPosition = snapChatButtonPosition({
          left: Number(parsed?.left) || initialChatButtonLeft,
          bottom: Number(parsed?.bottom) || initialChatButtonBottom,
        });

        setChatButtonPosition(nextPosition);
      } catch (_) {
        /* ignore */
      }
    }

    carregarPosicaoChat();

    return () => {
      cancelled = true;
    };
  }, [initialChatButtonBottom, initialChatButtonLeft, snapChatButtonPosition]);

  useEffect(() => {
    chatButtonPositionRef.current = chatButtonPosition;
    chatLeftAnim.setValue(chatButtonPosition.left);
    chatBottomAnim.setValue(chatButtonPosition.bottom);
  }, [chatButtonPosition, chatBottomAnim, chatLeftAnim]);

  const syncChatButtonAnimatedPosition = useCallback(
    (position) => {
      const clamped = clampChatButtonPosition(position);
      chatLeftAnim.setValue(clamped.left);
      chatBottomAnim.setValue(clamped.bottom);
      return clamped;
    },
    [chatBottomAnim, chatLeftAnim, clampChatButtonPosition]
  );

  const chatButtonPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          chatDragStartRef.current = chatButtonPositionRef.current;
          chatDraggedRef.current = false;
        },
        onPanResponderMove: (_, gestureState) => {
          if (
            Math.abs(gestureState.dx) > HOME_CHAT_DRAG_THRESHOLD ||
            Math.abs(gestureState.dy) > HOME_CHAT_DRAG_THRESHOLD
          ) {
            chatDraggedRef.current = true;
          }

          syncChatButtonAnimatedPosition({
            left: chatDragStartRef.current.left + gestureState.dx,
            bottom: chatDragStartRef.current.bottom - gestureState.dy,
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextBottom = chatDragStartRef.current.bottom - gestureState.dy;
          const nextLeft = chatDragStartRef.current.left + gestureState.dx;
          const wasDragged =
            chatDraggedRef.current ||
            Math.abs(gestureState.dx) > HOME_CHAT_DRAG_THRESHOLD ||
            Math.abs(gestureState.dy) > HOME_CHAT_DRAG_THRESHOLD;

          const nextPosition = snapChatButtonPosition({
            left: nextLeft,
            bottom: nextBottom,
          });

          chatLeftAnim.setValue(nextPosition.left);
          chatBottomAnim.setValue(nextPosition.bottom);
          setChatButtonPosition(nextPosition);
          persistChatButtonPosition(nextPosition);

          if (!wasDragged) {
            abrirChatNutricionista();
          }
        },
        onPanResponderTerminate: () => {
          const nextPosition = snapChatButtonPosition(chatButtonPositionRef.current);
          chatLeftAnim.setValue(nextPosition.left);
          chatBottomAnim.setValue(nextPosition.bottom);
          setChatButtonPosition(nextPosition);
          persistChatButtonPosition(nextPosition);
        },
      }),
    [
      chatBottomAnim,
      chatLeftAnim,
      persistChatButtonPosition,
      snapChatButtonPosition,
      syncChatButtonAnimatedPosition,
    ]
  );

  const nomeUsuario = paciente?.nome_completo || nomeBaseUsuario;
  const chatPreview = useMemo(
    () =>
      buildPatientChatPreview(appState?.nutritionistThread, {
        patientName: nomeUsuario,
        lastReadAt: chatLastReadAt,
      }),
    [appState?.nutritionistThread, nomeUsuario, chatLastReadAt]
  );
  const unreadChatCount = Number(chatPreview.unread || 0);
  const activeGlucosePatientId = paciente?.id_paciente_uuid || idPaciente || null;

  const atualizarPreviewChat = useCallback(
    async ({ forceRefresh = true } = {}) => {
      if (!activeGlucosePatientId) return;

      if (!forceRefresh) {
        const cachedChat = getCachedPatientChat(activeGlucosePatientId);
        if (cachedChat?.appState?.nutritionistThread?.length) {
          let nextAppStateForCache = null;
          setAppState((current) => {
            nextAppStateForCache = {
              ...current,
              nutritionistThread: resolveNutritionistThreadMerge(
                current?.nutritionistThread,
                cachedChat.appState.nutritionistThread
              ),
            };
            return nextAppStateForCache;
          });
          if (nextAppStateForCache) {
            replaceCachedPatientAppState(activeGlucosePatientId, nextAppStateForCache);
          }
        }
      }

      try {
        const experience = await fetchPatientNutritionistChat(activeGlucosePatientId, {
          ...mesclarLimitesDadosPaciente('chat'),
          patientContext: usuarioLogado,
          forceRefresh: true,
        });
        let nextAppStateForCache = null;
        setAppState((current) => {
          nextAppStateForCache = {
            ...current,
            nutritionistThread: resolveNutritionistThreadMerge(
              current?.nutritionistThread,
              experience?.appState?.nutritionistThread || []
            ),
          };
          return nextAppStateForCache;
        });
        if (nextAppStateForCache) {
          replaceCachedPatientAppState(activeGlucosePatientId, nextAppStateForCache);
          replaceCachedPatientChat(activeGlucosePatientId, {
            ...experience,
            appState: nextAppStateForCache,
          });
        }
      } catch (error) {
        console.log('Erro ao atualizar contador do chat:', error);
      }
    },
    [activeGlucosePatientId, usuarioLogado]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      getPatientChatLastReadAt(activeGlucosePatientId).then((readAt) => {
        if (active) setChatLastReadAt(readAt);
      });
      const cachedChat = getCachedPatientChat(activeGlucosePatientId);
      if (!cachedChat?.appState?.nutritionistThread?.length) {
        invalidatePatientChatCache(activeGlucosePatientId);
      }
      atualizarPreviewChat({ forceRefresh: !cachedChat?.appState?.nutritionistThread?.length });

      return () => {
        active = false;
      };
    }, [activeGlucosePatientId, atualizarPreviewChat])
  );

  useEffect(() => {
    if (!activeGlucosePatientId) return undefined;

    const channel = supabase
      .channel(`patient-home-chat-counter-${activeGlucosePatientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagem_chat',
          filter: `paciente_id=eq.${activeGlucosePatientId}`,
        },
        () => atualizarPreviewChat({ forceRefresh: true })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGlucosePatientId, atualizarPreviewChat]);

  useEffect(() => {
    if (!activeGlucosePatientId) return undefined;

    return subscribeToPatientAppState(activeGlucosePatientId, (nextAppState) => {
      if (!nextAppState) return;

      setAppState((current) => ({
        ...nextAppState,
        nutritionistThread: resolveNutritionistThreadMerge(
          current?.nutritionistThread,
          nextAppState?.nutritionistThread
        ),
      }));
    });
  }, [activeGlucosePatientId]);

  useEffect(() => {
    if (!activeGlucosePatientId) return undefined;

    return subscribeToGlucoseReadings(activeGlucosePatientId, (nextReadings) => {
      setGlucoseReadings(nextReadings);
    });
  }, [activeGlucosePatientId]);

  const onRefresh = () => {
    setRefreshing(true);
    setMetricsLoading(true);
    carregarDados({ forceRefresh: true });
  };

  const latestGlucose = getLatestGlucose(glucoseReadings);
  const currentGlucose = latestGlucose?.value || null;
  const glucoseForInsights = currentGlucose || 105;
  const trendMeta = getTrendMeta(glucoseForInsights);
  const mealEntries = appState?.mealEntries || [];
  const planSections = useMemo(
    () => resolvePlanSections({ mealPlan: appState?.activeMealPlan, appState }),
    [appState]
  );
  const waterCount = appState?.waterCount || 0;
  const carouselWidth = Math.max(windowWidth - patientTheme.spacing.screen * 2, 280);
  const glucoseSummary = useMemo(
    () => buildGlucoseSummary(glucoseReadings),
    [glucoseReadings]
  );
  const nutritionSummary = useMemo(
    () => buildNutritionSummary(mealEntries, planSections),
    [mealEntries, planSections]
  );
  const homePlanDayStatus = useMemo(
    () => buildPlanDayStatus({ mealEntries, sections: planSections }),
    [mealEntries, planSections]
  );
  const todayMealEntries = useMemo(() => {
    const today = todayDateString();
    return (mealEntries || [])
      .filter((entry) => String(entry?.date || '').slice(0, 10) === today)
      .sort((left, right) => String(left.time || '').localeCompare(String(right.time || '')));
  }, [mealEntries]);
  const homeMealCards = useMemo(() => {
    if (todayMealEntries.length) {
      return todayMealEntries.map((entry) => {
        const nutrition = getMealEntryNutrition(entry) || {};
        return {
          id: entry.id,
          title: entry.mealLabel || entry.title || 'Refeição',
          time: entry.time || '--:--',
          description: entry.description || '',
          summary: {
            completed: true,
            kcal: Math.round(nutrition.calories || entry.kcal || 0),
            carbs: Math.round(nutrition.carbs || entry.carbsG || 0),
            protein: Math.round(nutrition.protein || entry.proteinG || 0),
            fat: Math.round(nutrition.fat || entry.fatG || 0),
          },
        };
      });
    }

    return homePlanDayStatus.meals.slice(0, 7);
  }, [homePlanDayStatus.meals, todayMealEntries]);
  const homePlanProgress = todayMealEntries.length
    ? Math.min(100, Math.round((todayMealEntries.length / 7) * 100))
    : homePlanDayStatus.progressPercent;
  const homePlanCompletedCount = todayMealEntries.length || homePlanDayStatus.completedCount;
  const homePlanTotalCount = todayMealEntries.length ? 7 : homePlanDayStatus.totalCount || 0;
  const insights = useMemo(
    () => buildHomeInsights(glucoseForInsights, mealEntries.length),
    [glucoseForInsights, mealEntries.length]
  );
  const notificationBaseTime = useMemo(
    () => new Date(),
    [glucoseForInsights, mealEntries.length]
  );
  const allNotificationItems = useMemo(
    () => {
      const clinicalNotifications = (clinicalAlerts || []).map((alert) => {
        const createdAt = alert?.created_at ? new Date(alert.created_at) : new Date();

        return {
          id: `clinical-${alert.id}`,
          title: alert.titulo || 'Alerta clínico',
          text: alert.mensagem || '',
          date: formatNotificationDate(createdAt),
          time: formatNotificationTime(createdAt),
          notificationKey: `clinical-${alert.id}`,
          optionLabel: alert.severidade === 'danger' ? 'Urgente' : 'Clinico',
        };
      });

      const guidedNotifications = (appState?.patientNotifications || []).map((item) => {
        const createdAt = item?.createdAt ? new Date(item.createdAt) : new Date();

        return {
          ...item,
          date: formatNotificationDate(createdAt),
          time: formatNotificationTime(createdAt),
          notificationKey: `${item.id}-${item.createdAt || item.text}`,
          optionLabel: 'Leitura guiada',
        };
      });

      const insightNotifications = insights.map((item, index) => {
        const createdAt = new Date(notificationBaseTime.getTime() - index * 18 * 60 * 1000);

        return {
          ...item,
          date: formatNotificationDate(createdAt),
          time: formatNotificationTime(createdAt),
          notificationKey: `${item.id}-${item.text}`,
          optionLabel:
            index === 0
              ? 'Aviso da IA'
              : index === 1
                ? 'Resumo do dia'
                : 'Lembrete de cuidado',
        };
      });

      return [...clinicalNotifications, ...guidedNotifications, ...insightNotifications];
    },
    [appState?.patientNotifications, clinicalAlerts, insights, notificationBaseTime]
  );
  const notificationItems = useMemo(
    () =>
      allNotificationItems.filter(
        (item) => !dismissedNotificationKeys[item.notificationKey]
      ),
    [allNotificationItems, dismissedNotificationKeys]
  );
  const notificationCount = notificationItems.length;
  const sparklineData = buildTodaySparklineFromReadings(glucoseReadings, 7);
  const metricDots = ['Glicose', 'Macros', 'Micros'];

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: () => setMenuVisible(true),
      readerMenuDisabled: saindo,
      readerNotificationCount: notificationCount,
      readerNotificationDisabled: notificationCount === 0,
      readerOnNotificationPress: () => setNotificationsVisible(true),
    });
  }, [navigation, notificationCount, saindo]);

  function limparNotificacao(notificationKey) {
    setDismissedNotificationKeys((atual) => ({
      ...atual,
      [notificationKey]: true,
    }));
  }

  function limparTodasNotificacoes() {
    setDismissedNotificationKeys((atual) => {
      const proximas = { ...atual };

      notificationItems.forEach((item) => {
        proximas[item.notificationKey] = true;
      });

      return proximas;
    });
  }

  if (loadError && !paciente && !glucoseReadings.length) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />
        <View style={styles.loadingContainer}>
          <>
            <EstadoErroCarregamento
            titulo="Painel indisponível"
            mensagem={loadError}
            loading={refreshing}
            onTentarNovamente={() => {
              loadGuardRef.current.reiniciar();
              setMetricsLoading(true);
              carregarDados({ forceRefresh: true });
            }}
          />
            {technicalLoadLog ? (
              <MensagemInline
                tipo="aviso"
                texto={`Log tecnico\n${technicalLoadLog}`}
                onFechar={() => setTechnicalLoadLog('')}
              />
            ) : null}
          </>
        </View>
        <BarraAbasPaciente
          navigation={navigation}
          rotaAtual={route?.name || 'HomePaciente'}
          usuarioLogado={usuarioLogado}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      {loadError ? (
        <View style={styles.inlineErrorWrap}>
          <>
            <EstadoErroCarregamento
            titulo="Atualização parcial"
            mensagem={loadError}
            loading={refreshing}
            onTentarNovamente={() => {
              setMetricsLoading(true);
              carregarDados({ forceRefresh: true });
            }}
          />
            {technicalLoadLog ? (
              <MensagemInline
                tipo="aviso"
                texto={`Log tecnico\n${technicalLoadLog}`}
                onFechar={() => setTechnicalLoadLog('')}
              />
            ) : null}
          </>
        </View>
      ) : null}

      {menuVisible ? (
        <PatientDrawer
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={(screen, params) => {
            if (PATIENT_MAIN_TAB_ROUTES.has(screen)) {
              navigatePatientTab(navigation, screen, usuarioLogado);
              return;
            }
            navegarParaTela(screen, params);
          }}
          onLogout={handleLogout}
          currentRoute={route?.name || 'HomePaciente'}
          userName={nomeUsuario}
        />
      ) : null}

      {notificationsVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setNotificationsVisible(false)}
        >
          <View style={styles.notificationModalOverlay}>
            <View style={styles.notificationModalCard}>
              <View style={styles.notificationModalHeader}>
                <View style={styles.notificationTitleRow}>
                  <View style={styles.notificationIconWrap}>
                    <Ionicons
                      name="notifications-outline"
                      size={20}
                      color={patientTheme.colors.primary}
                    />
                  </View>
                  <View>
                    <Text style={styles.notificationModalTitle}>Notificações</Text>
                    <Text style={styles.notificationModalSubtitle}>
                      {notificationCount} {notificationCount === 1 ? 'aviso agora' : 'avisos agora'}
                    </Text>
                  </View>
                </View>

                <View style={styles.notificationHeaderActions}>
                  {notificationCount > 0 ? (
                    <TouchableOpacity
                      accessibilityLabel="Limpar todas as notificações"
                      accessibilityRole="button"
                      activeOpacity={0.78}
                      onPress={limparTodasNotificacoes}
                      style={styles.notificationClearAllButton}
                    >
                      <Text style={styles.notificationClearAllText}>Limpar todas</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    accessibilityLabel="Fechar notificações"
                    accessibilityRole="button"
                    activeOpacity={0.78}
                    onPress={() => setNotificationsVisible(false)}
                    style={styles.notificationCloseButton}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.notificationList}
                contentContainerStyle={styles.notificationListContent}
                showsVerticalScrollIndicator={false}
              >
                {notificationCount > 0 ? (
                  notificationItems.map((item) => (
                    <View key={item.notificationKey} style={styles.notificationItem}>
                      <View style={styles.notificationItemTopRow}>
                        <Text style={styles.notificationItemTitle}>{item.title}</Text>
                        <Text style={styles.notificationOptionText}>{item.optionLabel}</Text>
                      </View>

                      <View style={styles.notificationMetaRow}>
                        <View style={styles.notificationMetaPill}>
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color={patientTheme.colors.primaryDark}
                          />
                          <Text style={styles.notificationMetaText}>{item.date}</Text>
                        </View>

                        <View style={styles.notificationMetaPill}>
                          <Ionicons
                            name="time-outline"
                            size={13}
                            color={patientTheme.colors.primaryDark}
                          />
                          <Text style={styles.notificationMetaText}>{item.time}</Text>
                        </View>
                      </View>

                      <Text style={styles.notificationItemText}>{item.text}</Text>

                      <TouchableOpacity
                        accessibilityLabel={`Limpar notificação ${item.title}`}
                        accessibilityRole="button"
                        activeOpacity={0.78}
                        onPress={() => limparNotificacao(item.notificationKey)}
                        style={styles.notificationClearButton}
                      >
                        <Ionicons name="checkmark-done-outline" size={16} color={patientTheme.colors.danger} />
                        <Text style={styles.notificationClearText}>Limpar notificação</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.notificationEmptyText}>
                    Nenhuma notificação nova no momento.
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.webScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {mensagemHome?.texto ? (
          <MensagemInline
            tipo={mensagemHome.tipo || 'aviso'}
            texto={mensagemHome.texto}
            onFechar={() => setMensagemHome(null)}
          />
        ) : null}
        <View style={styles.metricCarouselWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            snapToInterval={carouselWidth}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricCarouselContent}
            onMomentumScrollEnd={({ nativeEvent }) => {
              const nextIndex = Math.round(nativeEvent.contentOffset.x / carouselWidth);
              setActiveMetricIndex(Math.max(0, Math.min(metricDots.length - 1, nextIndex)));
            }}
          >
            <GlucoseMetricCard
              width={carouselWidth}
              currentGlucose={currentGlucose}
              trendMeta={trendMeta}
              sparklineData={sparklineData}
              glucoseSummary={glucoseSummary}
              latestGlucose={latestGlucose}
              loading={metricsLoading}
            />

            <MacroMetricCard width={carouselWidth} nutritionSummary={nutritionSummary} />

            <MicroMetricCard width={carouselWidth} nutritionSummary={nutritionSummary} />
          </ScrollView>

          <View style={styles.carouselDots}>
            {metricDots.map((label, index) => (
              <View
                key={label}
                style={[
                  styles.carouselDot,
                  activeMetricIndex === index && styles.carouselDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Alimentação de hoje</Text>
        <SectionCard>
          <View style={styles.homePlanHeader}>
            <View style={styles.homePlanHeaderLeft}>
              <Ionicons
                name="restaurant-outline"
                size={15}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.homePlanHeaderTitle}>
                {todayMealEntries.length ? 'Registros alimentares' : 'Plano Alimentar'}
              </Text>
            </View>
            <Text style={styles.homePlanHeaderCount}>
              {homePlanCompletedCount}/{homePlanTotalCount || 0}
            </Text>
          </View>

          <View style={styles.homePlanProgressRow}>
            <Text style={styles.homePlanProgressLabel}>
              {todayMealEntries.length ? 'Refeições registradas hoje' : 'Adesão de hoje'}
            </Text>
            <Text style={styles.homePlanProgressValue}>{homePlanProgress}%</Text>
          </View>
          <View style={styles.homePlanProgressTrack}>
            <View style={[styles.homePlanProgressFill, { width: `${homePlanProgress}%` }]} />
          </View>

          {homeMealCards.map((item) => (
            <TouchableOpacity
              key={`home-meal-${item.id}`}
              style={[
                styles.homePlanMealCard,
                item.summary.completed
                  ? styles.homePlanMealCardDone
                  : styles.homePlanMealCardPending,
              ]}
              activeOpacity={0.88}
              onPress={() => navegarParaTela('PacienteDiario')}
            >
              <View style={styles.homePlanMealHeader}>
                <View style={styles.homePlanMealTitleRow}>
                  <Ionicons
                    name={item.summary.completed ? 'checkmark-circle-outline' : 'ellipse-outline'}
                    size={18}
                    color={
                      item.summary.completed
                        ? patientTheme.colors.primaryDark
                        : patientTheme.colors.textMuted
                    }
                  />
                  <Text style={styles.homePlanMealTitle}>{item.title}</Text>
                </View>
                <View style={styles.homePlanMealTimeRow}>
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={patientTheme.colors.textMuted}
                  />
                  <Text style={styles.homePlanMealTime}>{item.time}</Text>
                </View>
              </View>

              {item.summary.completed ? (
                <>
                  {item.description ? (
                    <Text style={styles.homePlanMealDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.homePlanMacrosRow}>
                    <View>
                      <Text style={styles.homePlanMacroText}>Calorias: {item.summary.kcal} kcal</Text>
                      <Text style={styles.homePlanMacroText}>Proteina: {item.summary.protein}g</Text>
                    </View>
                    <View>
                      <Text style={styles.homePlanMacroText}>Carbo: {item.summary.carbs}g</Text>
                      <Text style={styles.homePlanMacroText}>Gordura: {item.summary.fat}g</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.homePlanPendingText}>Toque para registrar</Text>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.homePlanButton}
            onPress={() => navegarParaTela('PacienteDiario')}
          >
            <Text style={styles.homePlanButtonText}>Abrir alimentação completa</Text>
          </TouchableOpacity>

          {!todayMealEntries.length ? (
            <>
              {(planSections.length > 0 ? planSections.slice(0, 3) : [null, null]).map((item, index) => (
                <View key={item?.id || index} style={styles.planItem}>
                  <View style={styles.planTime}>
                    <Text style={styles.planTimeText}>
                      {item?.time || (index === 0 ? '07:00' : '12:30')}
                    </Text>
                  </View>
                  <View style={styles.planCopy}>
                    <Text style={styles.planTitle}>
                      {item?.title || (index === 0 ? 'Café da manhã' : 'Almoço equilibrado')}
                    </Text>
                    <Text style={styles.planText}>
                      {item?.foods?.join(', ') ||
                        (index === 0
                          ? 'Iogurte natural, aveia, chia e fruta.'
                          : 'Arroz integral, feijao, frango e salada.')}
                    </Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.planButton}
                onPress={() => navegarParaTela('PacientePlano')}
              >
                <Text style={styles.planButtonText}>Abrir plano completo</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </SectionCard>

        <TouchableOpacity
          style={styles.homePlanExternalButton}
          onPress={() => navegarParaTela('PacienteProgresso')}
        >
          <Text style={styles.homePlanExternalButtonText}>Ver meu progresso</Text>
        </TouchableOpacity>

        <View style={styles.listFooter} />
      </ScrollView>

      <Animated.View
        accessibilityLabel="Abrir conversa com nutricionista"
        accessibilityRole="button"
        style={[
          styles.homeChatFloatingButton,
          {
            left: chatLeftAnim,
            bottom: chatBottomAnim,
          },
        ]}
        {...chatButtonPanResponder.panHandlers}
      >
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={24}
          color={patientTheme.colors.onPrimary}
        />
        {unreadChatCount > 0 ? (
          <View style={styles.homeChatBadge}>
            <Text style={styles.homeChatBadgeText}>
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <BarraAbasPaciente
        navigation={navigation}
        rotaAtual={route?.name || 'HomePaciente'}
        usuarioLogado={usuarioLogado}
      />

      {saindo ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
          <Text style={styles.overlayText}>Encerrando sessao...</Text>
        </View>
      ) : null}

      <HostToastPaciente posicao="top" />
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
  loadingContainer: {
    flex: 1,
    backgroundColor: patientTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: patientTheme.spacing.screen,
  },
  inlineErrorWrap: {
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 12,
  },
  metricLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricLoadingText: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  loadingText: {
    marginTop: 12,
    color: patientTheme.colors.primaryDark,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    padding: patientTheme.spacing.screen,
    paddingTop: 6,
    paddingBottom: PATIENT_TAB_BAR_HEIGHT + 32 + PATIENT_TAB_BAR_SPACE,
  },
  webScroll: {
    overflowY: 'visible',
    overflowX: 'hidden',
  },
  webScrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  listFooter: {
    height: 8,
  },
  headerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: patientTheme.colors.textMuted,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroCard: {
    marginTop: 22,
  },
  metricCarouselWrap: {
    marginTop: 0,
  },
  metricCarouselContent: {
    alignItems: 'stretch',
  },
  metricSlide: {
    height: 468,
  },
  carouselDots: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  carouselDot: {
    backgroundColor: patientTheme.colors.border,
    borderRadius: 4,
    height: 8,
    marginHorizontal: 4,
    width: 8,
  },
  carouselDotActive: {
    backgroundColor: patientTheme.colors.primaryDark,
    width: 24,
  },
  eyebrow: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  glucoseValue: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  trendBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  heroHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  glucoseLineChart: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 220,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  homeSafeRangeBand: {
    backgroundColor: patientTheme.colors.primarySoft,
    height: 36,
    left: 0,
    opacity: 0.35,
    position: 'absolute',
    right: 0,
    top: 164,
  },
  chartGridLine: {
    backgroundColor: patientTheme.colors.border,
    height: 1,
    left: 42,
    opacity: 0.7,
    position: 'absolute',
    right: 0,
  },
  chartGridLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    left: -34,
    position: 'absolute',
    top: -8,
  },
  glucoseLineSegment: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 2,
    height: 3,
    position: 'absolute',
  },
  glucosePointer: {
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    width: 12,
  },
  glucosePointValue: {
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '800',
    position: 'absolute',
    textAlign: 'center',
    width: 36,
  },
  glucoseChartLabelsRow: {
    bottom: 8,
    height: 16,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  glucoseChartLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    position: 'absolute',
    textAlign: 'center',
    width: 44,
  },
  sparklineFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparklineLabel: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  rangeHeader: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  rangeValue: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  rangeBar: {
    marginTop: 8,
    height: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  rangeSegment: {
    height: '100%',
  },
  rangePrimary: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  rangeWarning: {
    backgroundColor: '#FFD600',
  },
  rangeInfo: {
    backgroundColor: '#f28c28',
  },
  rangeEmpty: {
    borderRadius: 8,
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  rangeLegend: {
    marginTop: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  rangeLegendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  rangeLegendText: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
  },
  metricCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricMainValue: {
    color: patientTheme.colors.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  metricIconWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  nutritionList: {
    gap: 13,
    marginTop: 20,
  },
  nutritionLine: {
    gap: 8,
  },
  nutritionLineTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionLabel: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  nutritionValue: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  nutritionTrack: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 8,
    height: 10,
    overflow: 'hidden',
  },
  nutritionFill: {
    backgroundColor: patientTheme.colors.primary,
    borderRadius: 8,
    height: '100%',
  },
  microGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  microPill: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  microPillReached: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primarySoft,
  },
  microPillText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 5,
  },
  microPillTextReached: {
    color: patientTheme.colors.primaryDark,
  },
  metricFootnote: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 'auto',
    paddingTop: 16,
  },
  summaryRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minHeight: 110,
  },
  summaryLabel: {
    marginTop: 10,
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 18,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  feedCard: {
    gap: 10,
  },
  notificationModalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 52, 56, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  notificationModalCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    maxHeight: '86%',
    maxWidth: 420,
    padding: 18,
    width: '100%',
    ...patientShadow,
  },
  notificationModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  notificationTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  notificationIconWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40,
  },
  notificationModalTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  notificationModalSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  notificationHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 10,
  },
  notificationClearAllButton: {
    backgroundColor: '#fff4f4',
    borderColor: '#f0d2d2',
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  notificationClearAllText: {
    color: patientTheme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  notificationCloseButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  notificationList: {
    maxHeight: 440,
  },
  notificationListContent: {
    paddingBottom: 4,
  },
  notificationItem: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    padding: 14,
  },
  notificationItemTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notificationItemTitle: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    paddingRight: 10,
  },
  notificationOptionText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  notificationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  notificationMetaPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  notificationMetaText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  notificationItemText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  notificationClearButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    marginTop: 12,
    paddingVertical: 4,
  },
  notificationClearText: {
    color: patientTheme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  notificationEmptyText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  insightRail: {
    width: 18,
    alignItems: 'center',
  },
  insightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: patientTheme.colors.primary,
  },
  insightLine: {
    flex: 1,
    width: 2,
    marginTop: 6,
    backgroundColor: patientTheme.colors.border,
  },
  insightContent: {
    flex: 1,
    paddingBottom: 14,
    paddingLeft: 10,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  insightText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
  exploreCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...patientShadow,
  },
  exploreIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  exploreCopy: {
    flex: 1,
  },
  exploreTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  exploreText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  planItem: {
    display: 'none',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  planTime: {
    width: 64,
    height: 34,
    borderRadius: 17,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planTimeText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  planCopy: {
    flex: 1,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  planText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: patientTheme.colors.textMuted,
  },
  planButton: {
    display: 'none',
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primary,
  },
  planButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  homePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  homePlanHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  homePlanHeaderTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  homePlanHeaderCount: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  homePlanProgressRow: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  homePlanProgressLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  homePlanProgressValue: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  homePlanProgressTrack: {
    height: 8,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.border,
    overflow: 'hidden',
  },
  homePlanProgressFill: {
    height: '100%',
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primary,
  },
  homePlanMealCard: {
    marginTop: 12,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    borderWidth: 1,
  },
  homePlanMealCardDone: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.primaryDark,
  },
  homePlanMealCardPending: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.border,
  },
  homePlanMealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  homePlanMealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 10,
  },
  homePlanMealTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  homePlanMealDescription: {
    marginTop: 8,
    marginLeft: 26,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  homePlanMealTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  homePlanMealTime: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  homePlanMacrosRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  homePlanMacroText: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontSize: 11,
  },
  homePlanPendingText: {
    marginTop: 8,
    marginLeft: 26,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  homePlanButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePlanButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  homePlanSecondaryButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePlanSecondaryButtonText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 14,
  },
  homePlanExternalButton: {
    minHeight: 46,
    marginTop: 10,
    marginBottom: 2,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  homePlanExternalButtonText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    marginTop: 12,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  homeChatFloatingButton: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    width: HOME_CHAT_BUTTON_SIZE,
    height: HOME_CHAT_BUTTON_SIZE,
    borderRadius: HOME_CHAT_BUTTON_SIZE / 2,
    backgroundColor: patientTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 0,
    shadowColor: patientTheme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.58,
    shadowRadius: 12,
    elevation: 32,
    zIndex: 1200,
    ...(Platform.OS === 'web'
      ? {
          touchAction: 'none',
          cursor: 'grab',
          userSelect: 'none',
        }
      : null),
  },
  homeChatBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  homeChatBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
});
