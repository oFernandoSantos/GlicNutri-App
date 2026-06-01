import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { EsqueletoPlanoPaciente } from '../../componentes/comum/EsqueletoCarregamento';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import {
  DashboardMiniKpiCard,
  KPI_ACCENTS,
  dashboardKpiStyles,
} from '../../componentes/comum/CartaoKpiDashboard';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getCachedPatientExperience,
  getPatientId,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import {
  fetchActiveMealPlanForPatient,
  getCachedActiveMealPlanForPatient,
} from '../../servicos/servicoPlanoAlimentar';
import {
  averageAdherence,
} from '../../utilitarios/adesaoNutricional';
import {
  buildPlanAdherenceSeries,
  buildPlanDayStatus,
  resolvePlanSections,
} from '../../utilitarios/vinculoPlanoRefeicao';

function getAdherenceTone(value) {
  if (value >= 80) return patientTheme.colors.success;
  if (value >= 60) return '#ff7a12';
  return '#ff5a6b';
}

function formatFoodsInline(foods = []) {
  return foods.join(' + ');
}

export default function PacientePlanoScreen({
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

  const planFetchLimits = useMemo(() => mesclarLimitesDadosPaciente('plano'), []);

  const initialCachedExperience = useMemo(
    () =>
      patientId ? getCachedPatientExperience(patientId, planFetchLimits) : null,
    [patientId, planFetchLimits]
  );

  const initialCachedPlan = useMemo(
    () =>
      getCachedActiveMealPlanForPatient(
        initialCachedExperience?.patient?.id_paciente_uuid || patientId
      ),
    [initialCachedExperience, patientId]
  );

  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState(initialCachedExperience?.patient || null);
  const [appState, setAppState] = useState(
    initialCachedExperience?.appState || createDefaultAppState()
  );
  const [mealPlan, setMealPlan] = useState(
    initialCachedPlan === undefined ? null : initialCachedPlan
  );
  const [expandedStructure, setExpandedStructure] = useState(null);

  const loadPlano = useCallback(
    async ({ silent = false, forceRefresh = false } = {}) => {
      if (!canResolvePatient) {
        setAppState(createDefaultAppState());
        setLoading(false);
        return;
      }

      if (!silent && !appState?.planSections?.length && !mealPlan) setLoading(true);

      try {
        const initialPlanPromise = patientId
          ? fetchActiveMealPlanForPatient(patientId, { forceRefresh }).catch(() => null)
          : Promise.resolve(null);
        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
          forceRefresh,
          ...planFetchLimits,
        });

        const canonicalId =
          experience?.patient?.id_paciente_uuid ||
          patientId ||
          usuarioLogado?.id_paciente_uuid ||
          null;

        setPatient(experience.patient);
        setAppState(experience.appState);
        setLoading(false);

        const activePlan =
          canonicalId && canonicalId !== patientId
            ? await fetchActiveMealPlanForPatient(canonicalId, { forceRefresh }).catch(() => null)
            : await initialPlanPromise;
        setMealPlan(activePlan || null);
      } catch (error) {
        console.log('Erro ao carregar plano:', error);
      } finally {
        setLoading(false);
      }
    },
    [appState?.planSections?.length, canResolvePatient, mealPlan, patientId, planFetchLimits, usuarioLogado]
  );

  useFocusEffect(
    useCallback(() => {
      loadPlano({ silent: true, forceRefresh: false });
    }, [loadPlano])
  );

  const planSections = useMemo(() => {
    return resolvePlanSections({ mealPlan, appState });
  }, [appState, mealPlan]);
  const todayPlanStatus = useMemo(
    () => buildPlanDayStatus({ mealEntries: appState?.mealEntries, sections: planSections }),
    [appState?.mealEntries, planSections]
  );
  const mergedMeals = todayPlanStatus.meals;

  const completedMeals = todayPlanStatus.completedCount;
  const progressPercent = todayPlanStatus.progressPercent;
  const totalKcal = mergedMeals.reduce((sum, meal) => sum + meal.summary.kcal, 0);
  const weeklyAdherence = useMemo(() => {
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    const startDate = start.toISOString().slice(0, 10);
    const { items, hasRealData } = buildPlanAdherenceSeries({
      mealEntries: appState?.mealEntries,
      sections: planSections,
      startDate,
      endDate,
    });
    return { items, hasRealData };
  }, [appState?.mealEntries, planSections]);
  const weeklyAverage = averageAdherence(weeklyAdherence.items);
  const planDurationWeeks = 12;
  const patientName =
    patient?.nome_completo?.split(' ')[0] ||
    usuarioLogado?.nome_completo?.split(' ')[0] ||
    'João';

  function openFoodRegister() {
    navigation.navigate('RegistroRefeicaoIA', {
      usuarioLogado,
    });
  }

  function openNutritionistChat() {
    navigation.navigate('PacienteChatNutricionista', {
      usuarioLogado,
    });
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      contentContainerStyle={styles.contentContainer}
    >
      {loading ? <EsqueletoPlanoPaciente /> : null}

      {!loading ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconWrap}>
                <Ionicons
                  name="nutrition-outline"
                  size={20}
                  color={patientTheme.colors.onPrimary}
                />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Plano Personalizado</Text>
                <Text style={styles.heroSubtitle}>
                  Organizado para {patientName} com foco em rotina e estabilidade.
                </Text>
              </View>
            </View>

            <View style={dashboardKpiStyles.miniRow}>
              <View style={dashboardKpiStyles.miniCell}>
                <DashboardMiniKpiCard
                  label="Meta diária"
                  value={String(totalKcal)}
                  helper="kcal"
                  accent={KPI_ACCENTS.green}
                />
              </View>
              <View style={dashboardKpiStyles.miniCell}>
                <DashboardMiniKpiCard
                  label="Refeições"
                  value={String(mergedMeals.length)}
                  helper="por dia"
                  accent={KPI_ACCENTS.blue}
                />
              </View>
              <View style={dashboardKpiStyles.miniCell}>
                <DashboardMiniKpiCard
                  label="Duração"
                  value={String(planDurationWeeks)}
                  helper="semanas"
                  accent={KPI_ACCENTS.orange}
                />
              </View>
            </View>

            {mealPlan?.descricao ? (
              <Text style={styles.heroDescription}>{mealPlan.descricao}</Text>
            ) : null}

          </View>

          <View style={styles.sectionCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>Progresso de Hoje</Text>
              <View style={styles.progressBadge}>
                <Text style={styles.progressBadgeText}>{progressPercent}%</Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Refeições concluídas</Text>
              <Text style={styles.progressValue}>
                {completedMeals} de {mergedMeals.length}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.mealSectionHeader}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.sectionTitle}>Refeições de Hoje</Text>
            </View>

            {mergedMeals.map((meal) => (
              <TouchableOpacity
                key={meal.id}
                style={[
                  styles.todayMealCard,
                  meal.completed ? styles.todayMealCardDone : styles.todayMealCardPending,
                ]}
                activeOpacity={0.92}
                onPress={meal.completed ? undefined : openFoodRegister}
              >
                <View style={styles.todayMealHeader}>
                  <View style={styles.todayMealTitleRow}>
                    <Ionicons
                      name={meal.completed ? 'checkmark-circle-outline' : 'ellipse-outline'}
                      size={18}
                      color={meal.completed ? patientTheme.colors.primaryDark : '#c4c9ce'}
                    />
                    <Text style={styles.todayMealTitle}>{meal.title}</Text>
                  </View>

                  <View style={styles.todayMealTimeWrap}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={patientTheme.colors.textMuted}
                    />
                    <Text style={styles.todayMealTime}>{meal.time}</Text>
                  </View>
                </View>

                {meal.completed ? (
                  <View style={styles.macrosGrid}>
                    <View>
                      <Text style={styles.macroLine}>Calorias: {meal.summary.kcal} kcal</Text>
                      <Text style={styles.macroLine}>Proteína: {meal.summary.protein}g</Text>
                    </View>
                    <View>
                      <Text style={styles.macroLine}>Carbo: {meal.summary.carbs}g</Text>
                      <Text style={styles.macroLine}>Gordura: {meal.summary.fat}g</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.pendingText}>Toque para registrar</Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.inlineActionButton}
              onPress={openFoodRegister}
              activeOpacity={0.9}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={patientTheme.colors.onPrimary}
              />
              <Text style={styles.inlineActionText}>Registrar refeição</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Adesão semanal</Text>
            <Text style={styles.sectionHint}>
              {weeklyAdherence.hasRealData
                ? 'Calculada a partir das refeições registradas nos últimos 7 dias.'
                : 'Registre refeições para acompanhar sua adesão semanal ao plano.'}
            </Text>

            <View style={styles.weekBarsRow}>
              {weeklyAdherence.items.map((item) => (
                <View key={item.id} style={styles.weekBarItem}>
                  <View style={styles.weekBarTrack}>
                    <View
                      style={[
                        styles.weekBarFill,
                        {
                          height: `${item.value}%`,
                          backgroundColor: getAdherenceTone(item.value),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.weekDayLabel}>{item.label}</Text>
                  <Text style={styles.weekValueLabel}>{item.value}%</Text>
                </View>
              ))}
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: patientTheme.colors.success },
                  ]}
                />
                <Text style={styles.legendText}>Ótimo (&gt;80%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ff7a12' }]} />
                <Text style={styles.legendText}>Bom (60-80%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ff5a6b' }]} />
                <Text style={styles.legendText}>Baixo (&lt;60%)</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Estrutura do Plano</Text>

            {mergedMeals.map((meal) => {
              const expanded = expandedStructure === meal.id;
              const foods = Array.isArray(meal.foods) ? meal.foods : [];
              return (
                <TouchableOpacity
                  key={`${meal.id}-structure`}
                  style={styles.structureItem}
                  onPress={() => setExpandedStructure(expanded ? null : meal.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.structureHeader}>
                    <Text style={styles.structureTitle}>
                      {meal.title} ({meal.time})
                    </Text>
                    <Ionicons
                      name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={16}
                      color={patientTheme.colors.textMuted}
                    />
                  </View>
                  <Text style={styles.structureText}>
                    {expanded
                      ? formatFoodsInline(foods)
                      : foods.length
                        ? `${foods[0]} e mais ${Math.max(foods.length - 1, 0)} item(ns)`
                        : 'Plano registrado para este horario.'}
                  </Text>
                  <Text style={styles.structureKcal}>~{meal.summary.kcal} kcal</Text>
                </TouchableOpacity>
              );
            })}

          </View>


          <Text style={styles.weeklyAverageText}>
            Adesão média da semana: {weeklyAverage}%
          </Text>

          <TouchableOpacity
            style={styles.nutritionistChatButton}
            onPress={openNutritionistChat}
            activeOpacity={0.9}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={patientTheme.colors.onPrimary}
            />
            <Text style={styles.nutritionistChatButtonText}>
              Falar com minha Nutricionista
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 112,
  },
  loadingCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    alignItems: 'center',
    ...patientShadow,
  },
  loadingText: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
  },
  heroCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    lineHeight: 18,
  },
  heroDescription: {
    marginTop: 14,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  metricCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  heroMetricCard: {
    flex: 1,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...patientShadow,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  heroMetricLabel: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
  },
  heroMetricValue: {
    marginTop: 6,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: patientTheme.colors.primaryDark,
  },
  heroMetricHelper: {
    marginTop: 2,
    fontSize: 11,
    color: patientTheme.colors.textMuted,
  },
  sectionCard: {
    marginTop: 16,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  sectionHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBadge: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: patientTheme.colors.primaryDark,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    color: patientTheme.colors.text,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  progressTrack: {
    height: 8,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primary,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 6,
  },
  todayMealCard: {
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  todayMealCardDone: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.primary,
  },
  todayMealCardPending: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.border,
  },
  todayMealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayMealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    paddingRight: 10,
  },
  todayMealTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  todayMealTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayMealTime: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
  },
  macrosGrid: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  macroLine: {
    marginTop: 4,
    fontSize: 12,
    color: patientTheme.colors.text,
  },
  pendingText: {
    marginTop: 8,
    marginLeft: 26,
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  inlineActionButton: {
    minHeight: 46,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    borderWidth: 1,
    borderColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...patientShadow,
  },
  inlineActionText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  weekBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  weekBarItem: {
    alignItems: 'center',
    width: 30,
  },
  weekBarTrack: {
    width: 28,
    height: 52,
    justifyContent: 'flex-end',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 7,
    overflow: 'hidden',
  },
  weekBarFill: {
    width: '100%',
    borderRadius: 7,
  },
  weekDayLabel: {
    marginTop: 8,
    fontSize: 11,
    color: patientTheme.colors.text,
  },
  weekValueLabel: {
    marginTop: 4,
    fontSize: 10,
    color: patientTheme.colors.textMuted,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
  },
  structureItem: {
    marginTop: 12,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    ...patientShadow,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  structureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  structureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: patientTheme.colors.text,
    flex: 1,
    paddingRight: 10,
  },
  structureText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  structureKcal: {
    marginTop: 6,
    fontSize: 12,
    color: patientTheme.colors.text,
  },
  weeklyAverageText: {
    marginTop: 10,
    marginBottom: 4,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  nutritionistChatButton: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
  },
  nutritionistChatButtonText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
});
