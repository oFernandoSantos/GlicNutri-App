import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AvatarBadge,
  FilterTabs,
  ProgressBar,
  RiskBadge,
  SectionCard,
  TrendChartCard,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { getNutritionistPatientById, nutritionistPatientsMock } from '../../dados/dadosNutricionistaMock';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

const detailTabs = [
  { value: 'overview', label: 'Visao Geral' },
  { value: 'plan', label: 'Plano Alimentar' },
  { value: 'goals', label: 'Metas' },
  { value: 'recommendations', label: 'Recomendacoes' },
  { value: 'personal', label: 'Dados Pessoais' },
];

export default function TelaProntuarioPacienteNutri({ navigation, route }) {
  const { pacienteId, paciente } = route.params || {};
  const [activeTab, setActiveTab] = useState('overview');
  const [mealTitle, setMealTitle] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealSummary, setMealSummary] = useState('');
  const [extraMeals, setExtraMeals] = useState([]);

  const currentPatient = useMemo(() => {
    return (
      paciente ||
      getNutritionistPatientById(pacienteId) ||
      nutritionistPatientsMock[0]
    );
  }, [pacienteId, paciente]);

  const allMeals = useMemo(() => {
    return [...(currentPatient?.planMeals || []), ...extraMeals];
  }, [currentPatient, extraMeals]);

  function addMeal() {
    if (!mealTitle.trim() || !mealTime.trim() || !mealSummary.trim()) return;

    setExtraMeals((current) => [
      ...current,
      {
        id: `extra-${current.length + 1}`,
        title: mealTitle.trim(),
        time: mealTime.trim(),
        summary: mealSummary.trim(),
      },
    ]);
    setMealTitle('');
    setMealTime('');
    setMealSummary('');
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={patientTheme.colors.text} />
        </TouchableOpacity>

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
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

              <View style={styles.mealList}>
                {allMeals.map((meal) => (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealTop}>
                      <Text style={styles.mealTime}>{meal.time}</Text>
                      <Text style={styles.mealTitle}>{meal.title}</Text>
                    </View>
                    <Text style={styles.mealSummary}>{meal.summary}</Text>
                  </View>
                ))}
              </View>
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
      </ScrollView>
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
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...patientShadow,
  },
  headerCard: {
    backgroundColor: patientTheme.colors.surface,
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
  mealCard: {
    padding: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
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
