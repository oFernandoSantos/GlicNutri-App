import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
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
  getLatestGlucose,
  getPatientDisplayName,
  getPatientId,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import { syncGooglePatientRecord } from '../../servicos/sincronizarPacienteGoogle';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  replaceCachedGlucoseReadings,
  subscribeToGlucoseReadings,
} from '../../servicos/centralGlicose';

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
  return new Date().toISOString().slice(0, 10);
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
  const todayMeals = (mealEntries || []).filter((entry) => !entry.date || entry.date === today);
  const consumed = estimateNutritionFromTexts(todayMeals.map(getMealText));
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
    microItems: target.micros.slice(0, 5).map((label) => ({
      label,
      reached: consumedMicroSet.has(label),
    })),
    microScore: percentage(matchedMicros.length, microTarget),
    mealCount: todayMeals.length,
    plannedCount: (planSections || []).length,
  };
}

function buildGlucoseSummary(glucoseReadings) {
  const today = todayDateString();
  const todayReadings = (glucoseReadings || []).filter((item) => item.date === today);
  const baseReadings = todayReadings.length ? todayReadings : glucoseReadings || [];
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
}) {
  const glucoseLabel = currentGlucose ? `${currentGlucose} mg/dL` : '-- mg/dL';
  const updatedLabel = latestGlucose?.time ? `Atualizado ${latestGlucose.time}` : 'Sem registro hoje';
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
        {nutritionSummary.microItems.map((item) => (
          <View
            key={item.label}
            style={[styles.microPill, item.reached && styles.microPillReached]}
          >
            <Ionicons
              name={item.reached ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={item.reached ? patientTheme.colors.primaryDark : patientTheme.colors.textMuted}
            />
            <Text style={[styles.microPillText, item.reached && styles.microPillTextReached]}>
              {item.label}
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
  const { width: windowWidth } = useWindowDimensions();
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [activeMetricIndex, setActiveMetricIndex] = useState(0);

  const [paciente, setPaciente] = useState(null);
  const [clinicalObjective, setClinicalObjective] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [glucoseReadings, setGlucoseReadings] = useState([]);

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

  const carregarDados = useCallback(async function carregarDados() {
    try {
      setLoading(true);
      if (!canResolvePatient) {
        setPaciente({
          nome_completo: nomeBaseUsuario,
          email_pac: usuarioLogado?.email || null,
        });
        setAppState(createDefaultAppState());
        setClinicalObjective('');
        setGlucoseReadings([]);
        return;
      }

      let experience = await fetchPatientExperience(idPaciente, {
        patientContext: usuarioLogado,
      });

      if (!experience.patient && usuarioLogado?.id) {
        const pacienteSincronizado = await syncGooglePatientRecord(usuarioLogado);

        if (pacienteSincronizado?.id_paciente_uuid) {
          experience = {
            ...experience,
            patient: pacienteSincronizado,
          };
        }
      }

      setPaciente(
        experience.patient || {
          ...usuarioLogado,
          id_paciente_uuid: idPaciente,
          nome_completo: nomeBaseUsuario,
          email_pac: usuarioLogado?.email || null,
        }
      );
      const mergedReadings = mergeCachedGlucoseReadings(
        experience.glucoseReadings,
        getCachedGlucoseReadings(experience.patient?.id_paciente_uuid || idPaciente)
      );

      setAppState(experience.appState);
      setClinicalObjective(experience.clinicalObjective);
      setGlucoseReadings(mergedReadings);
      replaceCachedGlucoseReadings(
        experience.patient?.id_paciente_uuid || idPaciente,
        mergedReadings
      );
    } catch (error) {
      console.log('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canResolvePatient, idPaciente, nomeBaseUsuario, usuarioLogado]);

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

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.log('Erro inesperado no logout:', error);
      Alert.alert('Erro', 'Não foi possível sair da conta.');
    } finally {
      setSaindo(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  const nomeUsuario = paciente?.nome_completo || nomeBaseUsuario;
  const activeGlucosePatientId = paciente?.id_paciente_uuid || idPaciente || null;

  useEffect(() => {
    if (!activeGlucosePatientId) return undefined;

    return subscribeToGlucoseReadings(activeGlucosePatientId, (nextReadings) => {
      setGlucoseReadings(nextReadings);
    });
  }, [activeGlucosePatientId]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarDados();
  };

  const latestGlucose = getLatestGlucose(glucoseReadings);
  const currentGlucose = latestGlucose?.value || null;
  const glucoseForInsights = currentGlucose || 105;
  const trendMeta = getTrendMeta(glucoseForInsights);
  const mealEntries = appState?.mealEntries || [];
  const planSections = appState?.planSections || [];
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

      return [...guidedNotifications, ...insightNotifications];
    },
    [appState?.patientNotifications, insights, notificationBaseTime]
  );
  const notificationItems = useMemo(
    () =>
      allNotificationItems.filter(
        (item) => !dismissedNotificationKeys[item.notificationKey]
      ),
    [allNotificationItems, dismissedNotificationKeys]
  );
  const notificationCount = notificationItems.length;
  const sparklineData =
    glucoseReadings.length
      ? glucoseReadings
          .slice(0, 7)
          .reverse()
          .map((item) => ({
            value: item.value,
            label: String(item.time || '').slice(0, 5),
            date: item.date,
            time: item.time,
          }))
      : [];
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

  const quickActions = [
    {
      id: 'meal',
      label: 'Registrar refeição',
      helper: 'Foto, texto ou voz',
      icon: 'camera-outline',
      action: () => navigation.navigate('PacienteDiario', { usuarioLogado }),
    },
    {
      id: 'water',
      label: 'Hidratação',
      helper: `+1 copo (agora ${waterCount})`,
      icon: 'water-outline',
      action: async () => {
        const next = waterCount + 1;
        const nextState = {
          ...appState,
          waterCount: next,
        };

        setAppState(nextState);

        try {
          await persistirAppState(nextState);
          Alert.alert('Hidratação registrada', `Agora você tem ${next} copos registrados hoje.`);
        } catch (error) {
          console.log('Erro ao salvar hidratação:', error);
          Alert.alert('Erro', 'Não foi possível salvar a hidratação agora.');
          setAppState(appState);
        }
      },
    },
    {
      id: 'activity',
      label: 'Atividade física',
      helper: 'Registrar treino',
      icon: 'barbell-outline',
      action: () => navigation.navigate('PacienteBemEstar', { usuarioLogado }),
    },
    {
      id: 'medication',
      label: 'Medicação',
      helper: 'Insulina e rotina',
      icon: 'pill',
      library: 'material',
      action: () =>
        navigation.navigate('PacienteMonitoramento', {
          usuarioLogado,
          openMedication: true,
        }),
    },
  ];


  if (loading) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
          <Text style={styles.loadingText}>Montando seu painel de cuidado...</Text>
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

      {menuVisible ? (
        <PatientDrawer
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={(screen, params) => navigation.navigate(screen, { usuarioLogado, ...params })}
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
                      accessibilityLabel="Limpar todas as notificacoes"
                      accessibilityRole="button"
                      activeOpacity={0.78}
                      onPress={limparTodasNotificacoes}
                      style={styles.notificationClearAllButton}
                    >
                      <Text style={styles.notificationClearAllText}>Limpar todas</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    accessibilityLabel="Fechar notificacoes"
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
                        <Ionicons name="checkmark-done-outline" size={16} color="#d96666" />
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

        <Text style={styles.sectionTitle}>Ações rápidas</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((item) => (
            <TouchableOpacity key={item.id} style={styles.quickCard} onPress={item.action}>
              <View style={styles.quickIconWrap}>
                {item.library === 'material' ? (
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={24}
                    color={patientTheme.colors.primaryDark}
                  />
                ) : (
                  <Ionicons name={item.icon} size={24} color={patientTheme.colors.primaryDark} />
                )}
              </View>
              <Text style={styles.quickTitle}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Meu plano de hoje</Text>
        <SectionCard>
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
            onPress={() => navigation.navigate('PacientePlano', { usuarioLogado })}
          >
            <Text style={styles.planButtonText}>Abrir plano completo</Text>
          </TouchableOpacity>
        </SectionCard>

        <View style={styles.listFooter} />
      </ScrollView>

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
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -3,
  },
  quickCard: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 4,
  },
  quickIconWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  quickTitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
    marginTop: 6,
    textAlign: 'center',
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
    color: '#d96666',
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
    color: '#d96666',
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
});
