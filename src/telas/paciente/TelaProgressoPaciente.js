import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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

const WEEKLY_FALLBACK = [84, 91, 78, 88, 67, 72, 58];
const WEIGHT_LABELS = ['01/03', '05/03', '10/03', '15/03', '20/03', '25/03', '29/03'];
const WEEKDAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

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

function buildWeightSeries(currentWeight) {
  const current = currentWeight > 0 ? currentWeight : 74.8;
  const initial = current + 3.7;
  const goal = Math.max(current - 4.8, 50);
  const delta = initial - current;
  const step = delta / Math.max(WEIGHT_LABELS.length - 1, 1);

  return {
    initial,
    current,
    goal,
    loss: -delta,
    points: WEIGHT_LABELS.map((label, index) => ({
      id: `weight-${label}`,
      label,
      value: Number((initial - step * index).toFixed(1)),
    })),
  };
}

function buildWeeklyAdherence(mealEntries, targetMeals) {
  const safeTarget = Math.max(targetMeals || 3, 1);
  const entries = Array.isArray(mealEntries) ? mealEntries : [];
  const today = new Date();
  const items = [];
  let hasRealData = false;

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - index);
    const isoDate = date.toISOString().slice(0, 10);
    const total = entries.filter((entry) => entry?.date === isoDate).length;
    if (total > 0) {
      hasRealData = true;
    }

    items.push({
      id: `adherence-${isoDate}`,
      label: WEEKDAY_LABELS[6 - index],
      value: clamp(Math.round((total / safeTarget) * 100), 0, 100),
    });
  }

  if (!hasRealData) {
    return WEEKDAY_LABELS.map((label, index) => ({
      id: `adherence-fallback-${index}`,
      label,
      value: WEEKLY_FALLBACK[index],
    }));
  }

  return items;
}

function buildGlycemicMetrics(glucoseReadings) {
  const values = (Array.isArray(glucoseReadings) ? glucoseReadings : [])
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) {
    return {
      average: 115,
      gmi: 6.2,
      variability: 32,
      tir: 78,
      total: 0,
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

function buildTodayMealRecords(mealEntries) {
  const entries = Array.isArray(mealEntries) ? mealEntries : [];
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = entries
    .filter((entry) => entry?.date === today)
    .sort((a, b) => String(a?.time || '').localeCompare(String(b?.time || '')));

  return todayEntries.slice(0, 4).map((entry, index) => {
    const foods = Array.isArray(entry?.foods) ? entry.foods : [];
    const foodSummary = foods
      .map((item) => item?.name || item?.alimento || item?.title || '')
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');

    return {
      id: entry?.id || `meal-record-${index}`,
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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          if (!active) return;
          setPatient(null);
          setAppState(createDefaultAppState());
          setGlucoseReadings([]);
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
        });

        if (!active) return;

        setPatient(experience?.patient || null);
        setAppState(experience?.appState || createDefaultAppState());
        setGlucoseReadings(experience?.glucoseReadings || []);
      } catch (error) {
        console.log('Erro ao carregar progresso:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId, canResolvePatient, usuarioLogado]);

  const displayName = getPatientDisplayName(patient || usuarioLogado).split(' ')[0] || 'Paciente';
  const targetMeals = appState?.planSections?.length || 3;
  const weeklyAdherence = useMemo(
    () => buildWeeklyAdherence(appState?.mealEntries, targetMeals),
    [appState?.mealEntries, targetMeals]
  );
  const adherenceAverage = Math.round(
    weeklyAdherence.reduce((sum, item) => sum + item.value, 0) / Math.max(weeklyAdherence.length, 1)
  );
  const weightSeries = useMemo(
    () => buildWeightSeries(toNumber(patient?.peso_atual_kg, 74.8)),
    [patient?.peso_atual_kg]
  );
  const glycemicMetrics = useMemo(
    () => buildGlycemicMetrics(glucoseReadings),
    [glucoseReadings]
  );
  const achievements = useMemo(
    () =>
      buildAchievements(weeklyAdherence, weightSeries, appState?.mealEntries, glucoseReadings),
    [weeklyAdherence, weightSeries, appState?.mealEntries, glucoseReadings]
  );
  const monthlySummary = useMemo(
    () => buildMonthlySummary(appState, glucoseReadings, weeklyAdherence),
    [appState, glucoseReadings, weeklyAdherence]
  );
  const todayMealRecords = useMemo(
    () => buildTodayMealRecords(appState?.mealEntries),
    [appState?.mealEntries]
  );

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
          <View style={styles.metricsRow}>
            <View style={[styles.topMetricCard, styles.topMetricCardPrimary]}>
              <Ionicons
                name="trending-down-outline"
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.topMetricValue}>{formatSignedWeight(weightSeries.loss)}</Text>
              <Text style={styles.topMetricLabel}>Perda de peso</Text>
            </View>

            <View style={styles.topMetricCard}>
              <Ionicons
                name="analytics-outline"
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.topMetricValue}>{adherenceAverage}%</Text>
              <Text style={styles.topMetricLabel}>Adesao media</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sua evolução</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{formatSignedWeight(weightSeries.loss)}</Text>
              </View>
            </View>

            <View style={styles.weightStatsRow}>
              <View style={styles.weightStat}>
                <Text style={styles.weightStatLabel}>Inicial</Text>
                <Text style={styles.weightStatValue}>{formatDecimal(weightSeries.initial)}kg</Text>
              </View>
              <View style={styles.weightStat}>
                <Text style={styles.weightStatLabel}>Atual</Text>
                <Text style={[styles.weightStatValue, styles.weightStatValueHighlight]}>
                  {formatDecimal(weightSeries.current)}kg
                </Text>
              </View>
              <View style={styles.weightStat}>
                <Text style={styles.weightStatLabel}>Meta</Text>
                <Text style={styles.weightStatValue}>{formatDecimal(weightSeries.goal)}kg</Text>
              </View>
            </View>

            <WeightChart points={weightSeries.points} />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Registro de hoje</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>
                  {todayMealRecords.length} refeiç{todayMealRecords.length === 1 ? 'ão' : 'ões'}
                </Text>
              </View>
            </View>

            {todayMealRecords.length ? (
              <View style={styles.todayMealsList}>
                {todayMealRecords.map((item) => (
                  <View key={item.id} style={styles.todayMealCard}>
                    <View style={styles.todayMealTimeBlock}>
                      <Text style={styles.todayMealTimeLabel}>Horário</Text>
                      <Text style={styles.todayMealTimeValue}>{item.time}</Text>
                    </View>

                    <View style={styles.todayMealCopy}>
                      <Text style={styles.todayMealTitle}>{item.title}</Text>
                      <Text style={styles.todayMealSummary}>{item.summary}</Text>
                      <View style={styles.todayMealBadge}>
                        <Text style={styles.todayMealBadgeText}>{item.calories} kcal</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyMealText}>Nenhum registro alimentar feito hoje.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Adesao ao plano</Text>
              <View style={styles.badgeSoft}>
                <Text style={styles.badgeSoftText}>{adherenceAverage}%</Text>
              </View>
            </View>

            <AdherenceBars items={weeklyAdherence} />
            <Text style={styles.sectionFootnote}>Media semanal: {adherenceAverage}%</Text>
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
                <Text style={styles.glycemicMetricValue}>{glycemicMetrics.gmi.toFixed(1)}</Text>
                <Text style={styles.glycemicMetricUnit}>%</Text>
              </View>
              <View style={styles.glycemicMetricCard}>
                <Text style={styles.glycemicMetricLabel}>Variabilidade</Text>
                <Text style={styles.glycemicMetricValue}>{glycemicMetrics.variability}</Text>
                <Text style={styles.glycemicMetricUnit}>mg/dL</Text>
              </View>
            </View>
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
            <Text style={styles.sectionTitle}>Resumo do mes</Text>

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
