import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BotaoVoltar from '../../components/BotaoVoltar';
import { patientShadow, patientTheme } from '../../theme/patientTheme';
import { markPatientOnboardingSeen } from '../../services/patientOnboardingService';

const ONBOARDING_WEB_MAX_WIDTH = 440;

const steps = [
  {
    key: 'objetivos',
    title: 'Quais são seus objetivos nutricionais?',
    subtitle: 'Selecione até 3 objetivos para orientar seu acompanhamento.',
    max: 3,
    layout: 'grid',
    options: [
      'Perder peso',
      'Ganhar peso',
      'Melhorar a alimentação',
      'Controle do diabetes',
      'Controle da hipertensão arterial',
      'Melhorar o colesterol',
      'Cuidar da saúde mental',
      'Melhorar a qualidade de vida',
      'Cuidar de condições de saúde',
    ],
  },
  {
    key: 'condicoes',
    title: 'Possui alguma condição clínica diagnosticada?',
    subtitle: 'Marque as condições que fazem parte do seu histórico de saúde.',
    noneOption: 'Não possuo',
    options: [
      'Colesterol alto',
      'Diabetes',
      'Doenças cardiovasculares',
      'Doença hepática (fígado)',
      'Doenças renais',
      'Obesidade',
      'Síndrome dos ovários policísticos',
      'Tireoide',
      'Triglicerídeos altos',
      'Não possuo',
    ],
  },
  {
    key: 'situacoes',
    title: 'Já apresentou alguma complicação clínica?',
    subtitle: 'Informe situações importantes para o acompanhamento nutricional.',
    noneOption: 'Não tive',
    options: [
      'Acidente vascular cerebral (AVC)',
      'Candidíase recorrente',
      'Infarto prévio',
      'Neuropatia diabética',
      'Pé diabético',
      'Retinopatia diabética',
      'Úlcera em alguma parte do corpo',
      'Não tive',
    ],
  },
  {
    key: 'procedimentos',
    title: 'Realizou algum procedimento clínico relevante?',
    subtitle: 'Selecione procedimentos que possam influenciar seu cuidado.',
    noneOption: 'Não realizei',
    options: [
      'Amputação de membro',
      'Cateterismo prévio',
      'Cirurgia de revascularização (ponte de safena)',
      'Portador de marcapasso',
      'Não realizei',
      'Outros',
    ],
  },
];

function createInitialAnswers() {
  return steps.reduce((acc, step) => {
    acc[step.key] = [];
    return acc;
  }, {});
}

export default function PacienteOnboardingScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
  onOnboardingFinished,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const stepProgressAnim = useRef(new Animated.Value(1)).current;
  const { width: windowWidth } = useWindowDimensions();
  const [stepIndex, setStepIndex] = useState(0);
  const [highestStepUnlocked, setHighestStepUnlocked] = useState(0);
  const [answers, setAnswers] = useState(createInitialAnswers);
  const [outrosProcedimento, setOutrosProcedimento] = useState('');
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

  const currentStep = steps[stepIndex];
  const selectedOptions = answers[currentStep.key] || [];
  const canAdvance = selectedOptions.length > 0 && !saving;
  const availableWidth = Math.max(windowWidth - 40, 1);
  const contentWidth = Math.min(availableWidth, ONBOARDING_WEB_MAX_WIDTH);
  const stepProgressWidth = stepProgressAnim.interpolate({
    inputRange: [1, steps.length],
    outputRange: [`${100 / steps.length}%`, '100%'],
    extrapolate: 'clamp',
  });

  const payload = useMemo(
    () => ({
      objetivos: answers.objetivos,
      condicoes: answers.condicoes,
      situacoes: answers.situacoes,
      procedimentos: answers.procedimentos,
      procedimento_outros: outrosProcedimento.trim(),
    }),
    [answers, outrosProcedimento]
  );

  useEffect(() => {
    if (!finished) return undefined;

    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'HomePaciente',
            params: { usuarioLogado },
          },
        ],
      });
      onOnboardingFinished?.();
    }, 1200);

    return () => clearTimeout(timer);
  }, [finished, navigation, onOnboardingFinished, usuarioLogado]);

  useEffect(() => {
    Animated.timing(stepProgressAnim, {
      toValue: stepIndex + 1,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [stepIndex, stepProgressAnim]);

  function isStepComplete(index) {
    const step = steps[index];
    if (!step) return false;

    return (answers[step.key] || []).length > 0;
  }

  function toggleOption(step, option) {
    const currentSelection = answers[step.key] || [];
    const isCurrentlySelected = currentSelection.includes(option);

    if (
      step.key === 'procedimentos' &&
      ((option === 'Outros' && isCurrentlySelected) || option === step.noneOption)
    ) {
      setOutrosProcedimento('');
    }

    setAnswers((current) => {
      const currentSelection = current[step.key] || [];
      const isSelected = currentSelection.includes(option);
      let nextSelection = [];

      if (step.noneOption && option === step.noneOption) {
        nextSelection = isSelected ? [] : [option];
      } else {
        const withoutNone = step.noneOption
          ? currentSelection.filter((item) => item !== step.noneOption)
          : currentSelection;

        if (isSelected) {
          nextSelection = withoutNone.filter((item) => item !== option);
        } else if (step.max && withoutNone.length >= step.max) {
          nextSelection = withoutNone;
        } else {
          nextSelection = [...withoutNone, option];
        }
      }

      return {
        ...current,
        [step.key]: nextSelection,
      };
    });
  }

  function goToStep(index) {
    const boundedIndex = Math.max(0, Math.min(steps.length - 1, index));
    const canMoveForward =
      boundedIndex <= highestStepUnlocked ||
      (boundedIndex === stepIndex + 1 && isStepComplete(stepIndex));

    if (!canMoveForward) return;

    setHighestStepUnlocked((current) => Math.max(current, boundedIndex));
    setStepIndex(boundedIndex);
  }

  async function finishOnboarding(skipped = false) {
    if (saving) return;

    setSaving(true);
    await markPatientOnboardingSeen(usuarioLogado, {
      ...payload,
      skipped,
    });

    if (skipped) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'HomePaciente',
            params: { usuarioLogado },
          },
        ],
      });
      onOnboardingFinished?.();
      return;
    }

    setSaving(false);
    setFinished(true);
  }

  function handleAdvance() {
    if (!canAdvance) return;

    if (stepIndex === steps.length - 1) {
      finishOnboarding(false);
      return;
    }

    const nextIndex = stepIndex + 1;
    setHighestStepUnlocked((current) => Math.max(current, nextIndex));
    setStepIndex(nextIndex);
  }

  function handleBack() {
    if (stepIndex === 0) {
      finishOnboarding(true);
      return;
    }

    setStepIndex((current) => current - 1);
  }

  function renderOption(step, option) {
    const isSelected = (answers[step.key] || []).includes(option);
    const isOutrosProcedimento = step.key === 'procedimentos' && option === 'Outros';

    return (
      <View key={option} style={styles.optionGroup}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => toggleOption(step, option)}
          style={[
            styles.optionBox,
            isSelected ? styles.optionSelected : null,
          ]}
        >
          <Text style={styles.optionText}>
            {option}
          </Text>
          <View style={[styles.roundCheck, isSelected ? styles.roundCheckSelected : null]}>
            {isSelected ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
          </View>
        </TouchableOpacity>

        {isOutrosProcedimento && isSelected ? (
          <TextInput
            value={outrosProcedimento}
            onChangeText={setOutrosProcedimento}
            placeholder="Descreva o procedimento"
            placeholderTextColor="#9aa2aa"
            returnKeyType="done"
            selectionColor={patientTheme.colors.primary}
            underlineColorAndroid="transparent"
            style={[
              styles.otherInput,
              Platform.OS === 'web' ? styles.otherInputWeb : null,
            ]}
          />
        ) : null}
      </View>
    );
  }

  function renderStepProgress() {
    return (
      <View style={styles.stepProgress}>
        <View style={styles.stepTrack}>
          <Animated.View style={[styles.stepTrackFill, { width: stepProgressWidth }]} />
        </View>
        <View style={styles.stepItems}>
          {steps.map((step, index) => {
            const isActive = index <= stepIndex;
            const isReachable =
              index <= highestStepUnlocked || (index === stepIndex + 1 && isStepComplete(stepIndex));

            return (
              <TouchableOpacity
                key={step.key}
                activeOpacity={0.74}
                disabled={!isReachable}
                onPress={() => goToStep(index)}
                style={[
                  styles.stepButton,
                  !isReachable ? styles.stepButtonLocked : null,
                ]}
              >
                <View style={[styles.stepDot, isActive ? styles.stepDotActive : null]}>
                  <Text style={[styles.stepDotText, isActive ? styles.stepDotTextActive : null]}>
                    {index + 1}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function renderStepCard(step, index) {
    const isComplete = (answers[step.key] || []).length > 0;
    const buttonDisabled = !isComplete || saving;

    return (
      <View key={step.key} style={styles.stepPage}>
        <View style={styles.card}>
          <View style={styles.hero}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.subtitle}>{step.subtitle}</Text>
          </View>

          <View style={styles.optionList}>{step.options.map((option) => renderOption(step, option))}</View>

          <TouchableOpacity
            activeOpacity={0.84}
            onPress={handleAdvance}
            disabled={buttonDisabled}
            style={[styles.primaryButton, buttonDisabled ? styles.buttonDisabled : null]}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {index === steps.length - 1 ? 'Concluir' : 'Próximo'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={38} color={patientTheme.colors.primaryDark} />
          </View>
          <Text style={styles.successTitle}>Eba!</Text>
          <Text style={styles.successText}>Objetivos de saúde definidos.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topBar, { width: contentWidth }]}>
          <View style={styles.topSide}>
            <BotaoVoltar onPress={handleBack} style={styles.backButton} />
          </View>

          {renderStepProgress()}

          <View style={[styles.topSide, styles.topRight]}>
            {stepIndex < steps.length - 1 ? (
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => finishOnboarding(true)}
                disabled={saving}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>Pular</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={[styles.stepFrame, { width: contentWidth }]}>
          {renderStepCard(currentStep, stepIndex)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: patientTheme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  webScroll: {
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 44,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    width: '100%',
  },
  topSide: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 56,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 0,
  },
  topRight: {
    alignItems: 'flex-end',
  },
  skipButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  skipText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 24,
    padding: 25,
    width: '100%',
    ...patientShadow,
  },
  stepFrame: {
    marginTop: 10,
  },
  stepPage: {
    paddingHorizontal: 0,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 22,
  },
  title: {
    color: patientTheme.colors.primary,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
    maxWidth: 330,
    textAlign: 'center',
  },
  subtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 330,
    textAlign: 'center',
  },
  optionList: {
    gap: 14,
  },
  optionGroup: {
    width: '100%',
  },
  optionBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    borderRadius: 15,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '100%',
    ...patientShadow,
  },
  optionText: {
    color: '#111827',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    paddingRight: 14,
  },
  optionSelected: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.primary,
  },
  roundCheck: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cfd6dc',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  roundCheckSelected: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  otherInput: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.primary,
    borderRadius: 15,
    borderWidth: 1.5,
    color: '#333333',
    fontSize: 15,
    marginTop: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    width: '100%',
  },
  otherInputWeb: {
    outlineColor: patientTheme.colors.primary,
    outlineStyle: 'solid',
    outlineWidth: 1,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primary,
    borderRadius: 20,
    marginTop: 30,
    padding: 16,
  },
  buttonDisabled: {
    backgroundColor: '#c8c8c8',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  stepProgress: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
    maxWidth: 210,
  },
  stepTrack: {
    backgroundColor: '#dfe6e2',
    borderRadius: 999,
    height: 4,
    left: 11,
    overflow: 'hidden',
    position: 'absolute',
    right: 11,
  },
  stepTrackFill: {
    backgroundColor: patientTheme.colors.primary,
    borderRadius: 999,
    height: '100%',
  },
  stepItems: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepButton: {
    padding: 2,
  },
  stepButtonLocked: {
    opacity: 0.72,
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d8dde1',
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  stepDotActive: {
    backgroundColor: patientTheme.colors.primary,
    borderColor: patientTheme.colors.primary,
  },
  stepDotText: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  stepDotTextActive: {
    color: '#ffffff',
  },
  successContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successIcon: {
    alignItems: 'center',
    borderColor: patientTheme.colors.primaryDark,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 58,
    justifyContent: 'center',
    marginBottom: 26,
    width: 58,
  },
  successTitle: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  successText: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    textAlign: 'center',
  },
});
