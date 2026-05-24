import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RolagemComTeclado } from '../../componentes/comum/RolagemComTeclado';
import { Ionicons } from '@expo/vector-icons';
import {
  AvatarBadge,
  FilterTabs,
  ProgressBar,
  RiskBadge,
  SectionCard,
  TrendChartCard,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  fetchPatientById,
  fetchPatientExperience,
  getLatestGlucose,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import {
  averageAdherence,
  buildWeeklyAdherenceFromMeals,
} from '../../utilitarios/adesaoNutricional';
import {
  disableOtherMealPlansForPatient,
  fetchActiveMealPlanForPatient,
  upsertMealPlan,
} from '../../servicos/servicoPlanoAlimentar';
import {
  getNutritionistId,
  isPatientLinkedToNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';

const detailTabs = [
  { value: 'overview', label: 'Visao Geral' },
  { value: 'plan', label: 'Plano Alimentar' },
  { value: 'goals', label: 'Metas' },
  { value: 'recommendations', label: 'Recomendacoes' },
  { value: 'personal', label: 'Dados Pessoais' },
];

function calculateAge(value) {
  const birth = value ? new Date(value) : null;
  if (!birth || Number.isNaN(birth.getTime())) return '--';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : '--';
}

function normalizePatientForProntuario(patient) {
  if (!patient) return null;
  const raw = patient.raw || patient;
  const name = patient.name || raw.nome_completo || raw.nome_pac || raw.email_pac || 'Paciente';
  const objective =
    patient.objective ||
    raw.objetivo_principal ||
    raw.objetivo ||
    raw.diagnostico_principal ||
    'Acompanhamento';
  const latestGlucose = patient.latestGlucose || raw.glicemia_atual || raw.ultima_glicemia_mgdl || '--';

  return {
    ...patient,
    id: patient.id || raw.id_paciente_uuid,
    name,
    age: patient.age || calculateAge(raw.data_nascimento),
    bmi: patient.bmi || raw.imc_atual || raw.imc || '--',
    specialtyTag: patient.specialtyTag || objective,
    risk: patient.risk || 'Baixo',
    latestGlucose,
    trendText: patient.trendText || 'Acompanhe a evolucao pelos registros do paciente.',
    adherence: Number(patient.adherence || raw.adesao_percentual || 78),
    alerts: Number(patient.alerts || 0),
    notes: patient.notes || raw.observacoes || 'Paciente vinculado ao acompanhamento nutricional.',
    glucose12h: patient.glucose12h || [],
    planMeals: patient.planMeals || [],
    goals: patient.goals || [
      { id: 'goal-glicose', label: 'Controle glicemico', progress: 70 },
      { id: 'goal-plano', label: 'Plano alimentar', progress: 65 },
    ],
    recommendations: patient.recommendations || ['Revisar registros recentes', 'Ajustar metas na consulta'],
    comorbidities: patient.comorbidities || [raw.condicoes_saude || 'Nao informado'],
    medications: patient.medications || [raw.medicamentos_uso_continuo || 'Nao informado'],
    personalData: patient.personalData || {
      email: raw.email_pac || 'Nao informado',
      phone: raw.telefone || raw.telefone_paciente || 'Nao informado',
      city: raw.cidade || 'Nao informado',
    },
  };
}

export default function TelaProntuarioPacienteNutri({ navigation, route }) {
  const { pacienteId, paciente, usuarioLogado } = route.params || {};
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);
  const [patientRecord, setPatientRecord] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [activeMealPlan, setActiveMealPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState(null);
  const [linkedToNutri, setLinkedToNutri] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [planTitle, setPlanTitle] = useState('Plano alimentar');
  const [mealTitle, setMealTitle] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealObjective, setMealObjective] = useState('');
  const [mealFoods, setMealFoods] = useState('');
  const [mealSubstitutions, setMealSubstitutions] = useState('');
  const [mealSummary, setMealSummary] = useState('');
  const [extraMeals, setExtraMeals] = useState([]);
  const [patientExperience, setPatientExperience] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadPatient() {
      if (paciente || !pacienteId) {
        setPatientRecord(null);
        return;
      }

      try {
        setLoadingPatient(true);
        const data = await fetchPatientById(pacienteId);
        if (active) setPatientRecord(data || null);
      } catch (error) {
        console.log('Erro ao carregar paciente do prontuario:', error);
        if (active) setPatientRecord(null);
      } finally {
        if (active) setLoadingPatient(false);
      }
    }

    loadPatient();

    return () => {
      active = false;
    };
  }, [paciente, pacienteId]);

  useEffect(() => {
    let active = true;
    const effectivePacienteId =
      pacienteId || paciente?.id || patientRecord?.id_paciente_uuid || null;

    async function loadExperience() {
      if (!effectivePacienteId) {
        if (active) setPatientExperience(null);
        return;
      }

      try {
        const experience = await fetchPatientExperience(effectivePacienteId, {
          skipAlertSync: true,
          ...mesclarLimitesDadosPaciente('prontuario'),
        });
        if (active) setPatientExperience(experience);
      } catch (error) {
        console.log('Erro ao carregar experiencia do prontuario:', error);
        if (active) setPatientExperience(null);
      }
    }

    loadExperience();

    return () => {
      active = false;
    };
  }, [paciente?.id, pacienteId, patientRecord?.id_paciente_uuid]);

  const currentPatient = useMemo(() => {
    const base = normalizePatientForProntuario(paciente || patientRecord || null);
    if (!base || !patientExperience) return base;

    const { items } = buildWeeklyAdherenceFromMeals(
      patientExperience.appState?.mealEntries,
      3
    );
    const adherence = averageAdherence(items);
    const latestGlucose = getLatestGlucose(patientExperience.glucoseReadings);
    const glucoseValue = latestGlucose?.value ?? base.latestGlucose;

    return {
      ...base,
      adherence: adherence || base.adherence,
      latestGlucose: glucoseValue,
      glucose12h: (patientExperience.glucoseReadings || []).slice(0, 12),
      trendText: latestGlucose?.value
        ? `Ultima leitura: ${latestGlucose.value} mg/dL`
        : base.trendText,
    };
  }, [paciente, patientExperience, patientRecord]);

  const allMeals = useMemo(() => {
    return [...(currentPatient?.planMeals || []), ...extraMeals];
  }, [currentPatient, extraMeals]);

  useEffect(() => {
    let active = true;
    const effectivePacienteId = currentPatient?.id || pacienteId;

    async function loadPlan() {
      if (!effectivePacienteId || !nutricionistaId) {
        setActiveMealPlan(null);
        setLinkedToNutri(false);
        return;
      }

      try {
        setLoadingPlan(true);
        setPlanMessage(null);
        const [vinculado, plano] = await Promise.all([
          isPatientLinkedToNutritionist({
            pacienteId: effectivePacienteId,
            nutricionistaId,
          }),
          fetchActiveMealPlanForPatient(effectivePacienteId),
        ]);

        if (!active) return;
        setLinkedToNutri(vinculado);
        setActiveMealPlan(plano || null);
        setPlanTitle(plano?.titulo || 'Plano alimentar');
        const refeicoes = Array.isArray(plano?.metas?.planSections)
          ? plano.metas.planSections
          : Array.isArray(plano?.metas?.refeicoes)
            ? plano.metas.refeicoes
            : [];
        setExtraMeals(refeicoes);
      } catch (error) {
        console.log('Erro ao carregar plano alimentar:', error);
        if (active) setPlanMessage({ tipo: 'erro', texto: 'Nao foi possivel carregar o plano alimentar.' });
      } finally {
        if (active) setLoadingPlan(false);
      }
    }

    loadPlan();

    return () => {
      active = false;
    };
  }, [currentPatient?.id, pacienteId, nutricionistaId]);

  function addMeal() {
    const draftMeal = buildDraftMeal(extraMeals.length);
    if (!draftMeal) return;

    setExtraMeals((current) => [...current, draftMeal]);
    clearMealDraft();
  }

  function buildDraftMeal(index = extraMeals.length) {
    if (!mealTitle.trim() || !mealTime.trim() || !mealSummary.trim()) return null;

    const foods = mealFoods
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const substitutions = mealSubstitutions
      .split('\n')
      .map((line) => {
        const [anchor, rawOptions] = line.split(':');
        const options = String(rawOptions || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        return {
          anchor: String(anchor || '').trim(),
          options,
        };
      })
      .filter((item) => item.anchor && item.options.length);

    return {
      id: `extra-${index + 1}`,
      title: mealTitle.trim(),
      time: mealTime.trim(),
      objective: mealObjective.trim() || mealSummary.trim(),
      foods: foods.length ? foods : [mealSummary.trim()],
      substitutions,
      summary: mealSummary.trim(),
    };
  }

  function clearMealDraft() {
    setMealTitle('');
    setMealTime('');
    setMealObjective('');
    setMealFoods('');
    setMealSubstitutions('');
    setMealSummary('');
  }

  function buildPlanDescription(meals) {
    return meals
      .map((meal) => {
        const foods = Array.isArray(meal.foods) ? meal.foods.join(', ') : meal.summary || '';
        return `${meal.time || '--:--'} - ${meal.title || 'Refeicao'}: ${foods}`;
      })
      .join('\n');
  }

  function normalizePlanSections(meals) {
    return meals.map((meal, index) => ({
      id: meal.id || `meal-${index + 1}`,
      title: meal.title || 'Refeicao',
      time: meal.time || '--:--',
      objective: meal.objective || meal.summary || '',
      foods: Array.isArray(meal.foods) && meal.foods.length
        ? meal.foods
        : [meal.summary || 'Orientacao alimentar'],
      substitutions: Array.isArray(meal.substitutions) ? meal.substitutions : [],
      summary: meal.summary || '',
    }));
  }

  async function saveMealPlan() {
    const effectivePacienteId = currentPatient?.id || pacienteId;
    const draftMeal = buildDraftMeal(allMeals.length);
    const mealsToSave = draftMeal ? [...allMeals, draftMeal] : allMeals;

    if (!linkedToNutri) {
      setPlanMessage({
        tipo: 'erro',
        texto: 'Este paciente nao esta vinculado ao seu perfil de nutricionista.',
      });
      return;
    }

    if (!mealsToSave.length) {
      setPlanMessage({ tipo: 'erro', texto: 'Adicione ao menos uma refeicao ao plano.' });
      return;
    }

    try {
      setSavingPlan(true);
      setPlanMessage(null);
      const planSections = normalizePlanSections(mealsToSave);
      const saved = await upsertMealPlan({
        id: activeMealPlan?.id,
        nutricionistaId,
        pacienteId: effectivePacienteId,
        titulo: planTitle,
        descricao: buildPlanDescription(planSections),
        metas: {
          planSections,
          refeicoes: planSections,
          totalRefeicoes: planSections.length,
        },
        ativo: true,
        actor: usuarioLogado,
      });

      await disableOtherMealPlansForPatient({
        pacienteId: effectivePacienteId,
        exceptId: saved?.id,
        actor: usuarioLogado,
      });

      setActiveMealPlan(saved);
      setExtraMeals(Array.isArray(saved?.metas?.planSections) ? saved.metas.planSections : planSections);
      if (draftMeal) clearMealDraft();
      setPlanMessage({ tipo: 'sucesso', texto: 'Plano alimentar salvo para este paciente.' });
    } catch (error) {
      console.log('Erro ao salvar plano alimentar:', error);
      setPlanMessage({
        tipo: 'erro',
        texto: error?.message || 'Nao foi possivel salvar o plano alimentar.',
      });
    } finally {
      setSavingPlan(false);
    }
  }

  if (loadingPatient && !currentPatient) {
    return (
      <View style={styles.emptyWrap}>
        <ActivityIndicator color={patientTheme.colors.primaryDark} />
        <Text style={styles.emptyTitle}>Carregando paciente...</Text>
      </View>
    );
  }

  if (!currentPatient) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Paciente nao encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerShell}>
        <View style={styles.headerCard}>
          <View style={styles.headerMain}>
            <View style={styles.identityRow}>
              <AvatarBadge name={currentPatient.name} size={56} />
              <View style={styles.identityCopy}>
                <Text style={styles.patientName}>{currentPatient.name}</Text>
                <Text style={styles.patientMeta}>
                  {currentPatient.age} anos · IMC {currentPatient.bmi} · {currentPatient.specialtyTag}
                </Text>
              </View>
            </View>
            <RiskBadge risk={`${currentPatient.risk} risco`} />
          </View>

          <FilterTabs items={detailTabs} active={activeTab} onChange={setActiveTab} compact />
        </View>
      </View>

      <RolagemComTeclado
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardBottomBase={48}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' ? (
          <View style={styles.pageGap}>
            <TrendChartCard
              title="Glicemia nas ultimas 12h"
              subtitle="Leituras resumidas para detectar subida, estabilidade e pontos de atencao."
              data={currentPatient.glucose12h}
            />

            <View style={styles.overviewStats}>
              <SectionCard style={styles.statCard}>
                <Text style={styles.statLabel}>Glicose atual</Text>
                <Text style={styles.statValue}>{currentPatient.latestGlucose} mg/dL</Text>
                <Text style={styles.statHelper}>{currentPatient.trendText}</Text>
              </SectionCard>
              <SectionCard style={styles.statCard}>
                <Text style={styles.statLabel}>Adesao</Text>
                <Text style={styles.statValue}>{currentPatient.adherence}%</Text>
                <ProgressBar value={currentPatient.adherence} tone={currentPatient.adherence < 70 ? 'danger' : 'success'} />
              </SectionCard>
              <SectionCard style={styles.statCard}>
                <Text style={styles.statLabel}>Alertas</Text>
                <Text style={styles.statValue}>{currentPatient.alerts}</Text>
                <Text style={styles.statHelper}>{currentPatient.notes}</Text>
              </SectionCard>
            </View>
          </View>
        ) : null}

        {activeTab === 'plan' ? (
          <View style={styles.pageGap}>
            <SectionCard>
              <Text style={styles.sectionTitle}>Plano alimentar atual</Text>
              <Text style={styles.sectionHelper}>Refine refeicoes e horarios diretamente no prontuario.</Text>

              {loadingPlan ? (
                <View style={styles.inlineStatus}>
                  <ActivityIndicator color={patientTheme.colors.primaryDark} />
                  <Text style={styles.inlineStatusText}>Carregando plano...</Text>
                </View>
              ) : null}

              {planMessage ? (
                <View style={[styles.messageBox, planMessage.tipo === 'erro' && styles.messageBoxError]}>
                  <Text
                    style={[
                      styles.messageText,
                      planMessage.tipo === 'erro' && styles.messageTextError,
                    ]}
                  >
                    {planMessage.texto}
                  </Text>
                </View>
              ) : null}

              {!linkedToNutri && !loadingPlan ? (
                <View style={styles.messageBoxError}>
                  <Text style={styles.messageTextError}>
                    Este paciente nao esta vinculado ao seu perfil. O plano so pode ser criado para pacientes vinculados.
                  </Text>
                </View>
              ) : null}

              <TextInput
                style={[styles.input, styles.planTitleInput]}
                value={planTitle}
                onChangeText={setPlanTitle}
                placeholder="Titulo do plano"
                placeholderTextColor={patientTheme.colors.textMuted}
              />

              <View style={styles.mealList}>
                {allMeals.map((meal) => (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealTop}>
                      <Text style={styles.mealTime}>{meal.time}</Text>
                      <Text style={styles.mealTitle}>{meal.title}</Text>
                    </View>
                    <Text style={styles.mealSummary}>{meal.objective || meal.summary}</Text>
                    {Array.isArray(meal.foods) && meal.foods.length ? (
                      <Text style={styles.mealSummary}>Alimentos: {meal.foods.join(', ')}</Text>
                    ) : null}
                    {Array.isArray(meal.substitutions) && meal.substitutions.length ? (
                      <Text style={styles.mealSummary}>
                        Substituicoes: {meal.substitutions.map((item) => `${item.anchor}: ${item.options.join(', ')}`).join(' | ')}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (!linkedToNutri || savingPlan) && styles.buttonDisabled]}
                onPress={saveMealPlan}
                disabled={!linkedToNutri || savingPlan}
              >
                {savingPlan ? (
                  <ActivityIndicator color={patientTheme.colors.onPrimary} />
                ) : (
                  <Ionicons name="save-outline" size={18} color={patientTheme.colors.onPrimary} />
                )}
                <Text style={styles.primaryButtonText}>
                  {activeMealPlan?.id ? 'Atualizar plano alimentar' : 'Salvar plano alimentar'}
                </Text>
              </TouchableOpacity>
            </SectionCard>

            <SectionCard>
              <Text style={styles.sectionTitle}>Adicionar refeicao</Text>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={mealTitle}
                  onChangeText={setMealTitle}
                  placeholder="Nome da refeicao"
                  placeholderTextColor={patientTheme.colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={mealTime}
                  onChangeText={setMealTime}
                  placeholder="08:00"
                  placeholderTextColor={patientTheme.colors.textMuted}
                />
              </View>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={mealObjective}
                onChangeText={setMealObjective}
                placeholder="Objetivo da refeicao"
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={mealFoods}
                onChangeText={setMealFoods}
                placeholder="Alimentos separados por virgula"
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={mealSubstitutions}
                onChangeText={setMealSubstitutions}
                placeholder="Substituicoes, uma por linha. Ex.: Arroz integral: quinoa, batata-doce"
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={mealSummary}
                onChangeText={setMealSummary}
                placeholder="Descreva o que foi proposto para essa refeicao"
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.primaryButton} onPress={addMeal}>
                <Ionicons name="add-circle-outline" size={18} color={patientTheme.colors.onPrimary} />
                <Text style={styles.primaryButtonText}>Adicionar refeicao</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.secondarySaveButton,
                  (!linkedToNutri || savingPlan) && styles.buttonDisabled,
                ]}
                onPress={saveMealPlan}
                disabled={!linkedToNutri || savingPlan}
              >
                {savingPlan ? (
                  <ActivityIndicator color={patientTheme.colors.onPrimary} />
                ) : (
                  <Ionicons name="save-outline" size={18} color={patientTheme.colors.onPrimary} />
                )}
                <Text style={styles.primaryButtonText}>Salvar plano</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        ) : null}

        {activeTab === 'goals' ? (
          <SectionCard>
            <Text style={styles.sectionTitle}>Metas de acompanhamento</Text>
            <Text style={styles.sectionHelper}>Acompanhamento claro para consulta e follow-up remoto.</Text>
            <View style={styles.goalList}>
              {currentPatient.goals.map((goal) => (
                <View key={goal.id} style={styles.goalItem}>
                  <View style={styles.goalTop}>
                    <Text style={styles.goalLabel}>{goal.label}</Text>
                    <Text style={styles.goalValue}>{goal.progress}%</Text>
                  </View>
                  <ProgressBar
                    value={goal.progress}
                    tone={goal.progress < 70 ? 'warning' : 'success'}
                  />
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {activeTab === 'recommendations' ? (
          <SectionCard>
            <Text style={styles.sectionTitle}>Recomendacoes de estilo de vida</Text>
            <Text style={styles.sectionHelper}>Tags curtas para orientar conversa, reforco e proximo passo.</Text>
            <View style={styles.recommendationWrap}>
              {currentPatient.recommendations.map((item, index) => (
                <View key={`${currentPatient.id}-rec-${index}`} style={styles.recommendationTag}>
                  <Text style={styles.recommendationText}>{item}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {activeTab === 'personal' ? (
          <View style={styles.pageGap}>
            <SectionCard>
              <Text style={styles.sectionTitle}>Comorbidades</Text>
              <View style={styles.infoList}>
                {currentPatient.comorbidities.map((item, index) => (
                  <View key={`${currentPatient.id}-comorb-${index}`} style={styles.infoCard}>
                    <Text style={styles.infoCardText}>{item}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>

            <SectionCard>
              <Text style={styles.sectionTitle}>Medicamentos</Text>
              <View style={styles.infoList}>
                {currentPatient.medications.map((item, index) => (
                  <View key={`${currentPatient.id}-med-${index}`} style={styles.infoCard}>
                    <Text style={styles.infoCardText}>{item}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>

            <SectionCard>
              <Text style={styles.sectionTitle}>Contato</Text>
              <View style={styles.personalRow}>
                <Text style={styles.personalLabel}>Email</Text>
                <Text style={styles.personalValue}>{currentPatient.personalData.email}</Text>
              </View>
              <View style={styles.personalRow}>
                <Text style={styles.personalLabel}>Telefone</Text>
                <Text style={styles.personalValue}>{currentPatient.personalData.phone}</Text>
              </View>
              <View style={styles.personalRow}>
                <Text style={styles.personalLabel}>Cidade</Text>
                <Text style={styles.personalValue}>{currentPatient.personalData.city}</Text>
              </View>
            </SectionCard>
          </View>
        ) : null}
      </RolagemComTeclado>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: patientTheme.colors.background,
  },
  headerShell: {
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerCard: {
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    gap: 14,
    ...patientShadow,
  },
  headerMain: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 12,
  },
  identityRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  patientName: {
    fontSize: 24,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  patientMeta: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: patientTheme.spacing.screen,
    paddingBottom: 28,
  },
  pageGap: {
    gap: 14,
  },
  overviewStats: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minHeight: 146,
  },
  statLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  statValue: {
    marginTop: 10,
    marginBottom: 10,
    fontSize: 24,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  statHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  sectionHelper: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  mealList: {
    gap: 10,
  },
  inlineStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inlineStatusText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  messageBox: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    marginBottom: 12,
    padding: 12,
  },
  messageBoxError: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  messageText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
    lineHeight: 20,
  },
  messageTextError: {
    color: '#c55b5b',
    fontWeight: '800',
    lineHeight: 20,
  },
  planTitleInput: {
    marginBottom: 12,
  },
  mealCard: {
    padding: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  mealTop: {
    flexDirection: 'row',
    gap: 12,
  },
  mealTime: {
    width: 54,
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  mealTitle: {
    flex: 1,
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  mealSummary: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  formRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
  },
  input: {
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: patientTheme.colors.text,
    ...patientShadow,
  },
  inputFlex: {
    flex: 1,
  },
  timeInput: {
    width: Platform.OS === 'web' ? 120 : '100%',
  },
  inputMultiline: {
    marginTop: 10,
    minHeight: 110,
  },
  primaryButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  secondarySaveButton: {
    marginTop: 8,
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
  },
  goalList: {
    gap: 12,
    marginTop: 14,
  },
  goalItem: {
    padding: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  goalTop: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalLabel: {
    flex: 1,
    color: patientTheme.colors.text,
    fontWeight: '800',
  },
  goalValue: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  recommendationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  recommendationTag: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  recommendationText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  infoList: {
    gap: 10,
    marginTop: 14,
  },
  infoCard: {
    padding: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  infoCardText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  personalRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: patientTheme.colors.border,
  },
  personalLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  personalValue: {
    marginTop: 6,
    color: patientTheme.colors.text,
    fontWeight: '800',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
});
