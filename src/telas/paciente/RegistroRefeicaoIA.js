import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import MensagemInline from '../../componentes/comum/MensagemInline';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  appendNewestEntry,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import {
  analisarImagemRefeicaoIA,
  buildMealTimelineEntryFromAI,
  calcularTotaisRefeicaoIA,
  criarAlimentoEditavel,
  escolherImagemRefeicaoDaGaleria,
  salvarRefeicaoIA,
  tirarFotoRefeicao,
  uploadImagemRefeicaoIA,
} from '../../servicos/servicoRefeicaoIA';

const mealTypeOptions = [
  'Caf\u00e9 da Manh\u00e3',
  'Lanche da Manh\u00e3',
  'Almo\u00e7o',
  'Lanche da Tarde',
  'Jantar',
  'Ceia',
  'Outro Momento',
];

const FOOD_CORE_FIELDS = [
  { key: 'quantidade_gramas', label: 'Gramas', unit: 'g' },
  { key: 'calorias', label: 'Calorias', unit: 'kcal' },
];

const FOOD_MACRO_FIELDS = [
  { key: 'carboidratos', label: 'Carboidratos', unit: 'g' },
  { key: 'proteinas', label: 'Proteínas', unit: 'g' },
  { key: 'gorduras', label: 'Gorduras', unit: 'g' },
  { key: 'fibras', label: 'Fibras', unit: 'g' },
  { key: 'acucares', label: 'Açúcares', unit: 'g' },
  { key: 'gorduras_saturadas', label: 'Gordura saturada', unit: 'g' },
];

const FOOD_MICRO_FIELDS = [
  { key: 'sodio', label: 'Sódio', unit: 'mg' },
  { key: 'potassio', label: 'Potássio', unit: 'mg' },
  { key: 'calcio', label: 'Cálcio', unit: 'mg' },
  { key: 'ferro', label: 'Ferro', unit: 'mg' },
  { key: 'magnesio', label: 'Magnésio', unit: 'mg' },
  { key: 'zinco', label: 'Zinco', unit: 'mg' },
  { key: 'vitamina_a', label: 'Vitamina A', unit: 'mcg' },
  { key: 'vitamina_c', label: 'Vitamina C', unit: 'mg' },
  { key: 'vitamina_d', label: 'Vitamina D', unit: 'mcg' },
  { key: 'vitamina_b12', label: 'Vitamina B12', unit: 'mcg' },
  { key: 'folato', label: 'Folato', unit: 'mcg' },
];

const TOTAL_MACRO_FIELDS = [
  { key: 'carboidratos_total', label: 'Carboidratos', unit: 'g' },
  { key: 'calorias_total', label: 'Calorias', unit: 'kcal' },
  { key: 'proteinas_total', label: 'Proteínas', unit: 'g' },
  { key: 'gorduras_total', label: 'Gorduras', unit: 'g' },
  { key: 'fibras_total', label: 'Fibras', unit: 'g' },
  { key: 'acucares_total', label: 'Açúcares', unit: 'g' },
  { key: 'gorduras_saturadas_total', label: 'Gordura saturada', unit: 'g' },
];

const TOTAL_MICRO_FIELDS = [
  { key: 'sodio_total', label: 'Sódio', unit: 'mg' },
  { key: 'potassio_total', label: 'Potássio', unit: 'mg' },
  { key: 'calcio_total', label: 'Cálcio', unit: 'mg' },
  { key: 'ferro_total', label: 'Ferro', unit: 'mg' },
  { key: 'magnesio_total', label: 'Magnésio', unit: 'mg' },
  { key: 'zinco_total', label: 'Zinco', unit: 'mg' },
  { key: 'vitamina_a_total', label: 'Vitamina A', unit: 'mcg' },
  { key: 'vitamina_c_total', label: 'Vitamina C', unit: 'mg' },
  { key: 'vitamina_d_total', label: 'Vitamina D', unit: 'mcg' },
  { key: 'vitamina_b12_total', label: 'Vitamina B12', unit: 'mcg' },
  { key: 'folato_total', label: 'Folato', unit: 'mcg' },
];

const TOTAL_TARGETS = {
  carboidratos_total: 225,
  calorias_total: 1800,
  proteinas_total: 90,
  gorduras_total: 60,
  fibras_total: 25,
  acucares_total: 50,
  gorduras_saturadas_total: 20,
  sodio_total: 2000,
  potassio_total: 2600,
  calcio_total: 1000,
  ferro_total: 18,
  magnesio_total: 320,
  zinco_total: 8,
  vitamina_a_total: 700,
  vitamina_c_total: 75,
  vitamina_d_total: 15,
  vitamina_b12_total: 2.4,
  folato_total: 400,
};

function formatNutrient(value, suffix = '') {
  const normalized = Math.round((Number(value) || 0) * 10) / 10;
  return `${normalized.toFixed(1).replace('.0', '')}${suffix}`;
}

function getProgressPercent(value, target) {
  const numericValue = Number(value) || 0;
  const numericTarget = Number(target) || 0;
  if (numericTarget <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((numericValue / numericTarget) * 100)));
}

function getMealTimingLabel(mode) {
  return mode === 'current' ? 'Refeição atual' : 'Refeição anterior';
}

function buildFallbackFoodItem() {
  return criarAlimentoEditavel({
    nome: 'Alimento manual',
    categoria: 'Preenchimento manual',
    quantidade_gramas: 0,
    calorias: 0,
    carboidratos: 0,
    proteinas: 0,
    gorduras: 0,
  });
}

function buildLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildLocalTimeString(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatManualDateInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatManualTimeInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeManualDateInput(value) {
  const rawValue = String(value || '').trim();
  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return '';
}

function normalizeManualTimeInput(value) {
  const rawValue = String(value || '').trim();
  const match = rawValue.match(/^(\d{2}):(\d{2})$/);

  if (!match) return '';

  const [, hours, minutes] = match;
  return `${hours}:${minutes}`;
}

function isValidManualDate(value) {
  const normalizedDate = normalizeManualDateInput(value);

  if (!normalizedDate) return false;

  const [year, month, day] = normalizedDate.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

function isValidManualTime(value) {
  const normalizedTime = normalizeManualTimeInput(value);

  if (!normalizedTime) return false;

  const [hours, minutes] = normalizedTime.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function formatDateForDisplay(value) {
  const normalizedDate = normalizeManualDateInput(value);
  if (!normalizedDate) return '--/--/----';

  const [year, month, day] = normalizedDate.split('-');
  return `${day}/${month}/${year}`;
}

function normalizeAnalysisErrorMessage(error) {
  const rawMessage = String(error?.message || error || '').trim();
  const normalized = rawMessage.toLowerCase();

  if (!rawMessage) {
    return 'A IA nao conseguiu reconhecer a refeicao.';
  }

  if (normalized.includes('non-2xx status code')) {
    return 'A analise da IA falhou no servidor. Se a conta da LogMeal ainda nao foi ativada, confirme o e-mail dela e tente novamente.';
  }

  if (normalized.includes('confirm your apicompany email') || normalized.includes('confirmation link')) {
    return 'A conta da LogMeal ainda nao foi ativada. Confirme o e-mail da conta LogMeal e tente novamente.';
  }

  return rawMessage;
}

export default function RegistroRefeicaoIA({ navigation, route, usuarioLogado: usuarioProp }) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [mealTimingChoiceVisible, setMealTimingChoiceVisible] = useState(
    Boolean(route?.params?.openMealTimingChoice)
  );
  const [mealTimingDetailsVisible, setMealTimingDetailsVisible] = useState(false);
  const [mealTimingMode, setMealTimingMode] = useState('current');
  const [mealTimingDate, setMealTimingDate] = useState(
    formatDateForDisplay(buildLocalDateString())
  );
  const [mealTimingTime, setMealTimingTime] = useState(formatManualTimeInput(buildLocalTimeString()));
  const [mealType, setMealType] = useState('');
  const [mealTypeMenuVisible, setMealTypeMenuVisible] = useState(false);
  const [pendingMealAction, setPendingMealAction] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [alimentos, setAlimentos] = useState([]);
  const [erroAnalise, setErroAnalise] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [mensagemTopo, setMensagemTopo] = useState(null);

  const totais = useMemo(() => calcularTotaisRefeicaoIA(alimentos), [alimentos]);
  const hasFoods = alimentos.length > 0;
  const isBusy = Boolean(loadingAction);
  const hasSelectedImage = Boolean(selectedImage?.uri);
  const normalizedMealTimingDate = normalizeManualDateInput(mealTimingDate);
  const normalizedMealTimingTime = normalizeManualTimeInput(mealTimingTime);
  const mealContextLabel = `${mealType || 'Tipo não definido'} • ${getMealTimingLabel(mealTimingMode)}`;
  const canConfirmMealTiming =
    Boolean(mealType) &&
    isValidManualDate(mealTimingDate) &&
    isValidManualTime(mealTimingTime);

  useEffect(() => {
    if (!route?.params?.openMealTimingChoice) {
      return;
    }

    setMealTimingChoiceVisible(true);

    if (navigation?.setParams) {
      navigation.setParams({ openMealTimingChoice: undefined });
    }
  }, [navigation, route?.params?.openMealTimingChoice]);

  async function escolherDaGaleria() {
    try {
      const imagem = await escolherImagemRefeicaoDaGaleria();

      if (!imagem) {
        return;
      }

      setSelectedImage(imagem);
      setUploadedImage(null);
      setAlimentos([]);
      setAnalysisMeta(null);
      setErroAnalise('');
    } catch (error) {
      setMensagemTopo({
        tipo: 'aviso',
        texto: error?.message || 'Não foi possível abrir a galeria. Verifique as permissões.',
      });
    }
  }

  async function tirarFoto() {
    try {
      const imagem = await tirarFotoRefeicao();

      if (!imagem) {
        return;
      }

      setSelectedImage(imagem);
      setUploadedImage(null);
      setAlimentos([]);
      setAnalysisMeta(null);
      setErroAnalise('');
    } catch (error) {
      setMensagemTopo({
        tipo: 'aviso',
        texto: error?.message || 'Não foi possível abrir a câmera. Verifique as permissões.',
      });
    }
  }

  async function analisarImagem() {
    if (!selectedImage?.uri) {
      setMensagemTopo({ tipo: 'aviso', texto: 'Selecione uma imagem antes de analisar.' });
      return;
    }

    if (!patientId) {
      setMensagemTopo({
        tipo: 'aviso',
        texto: 'Paciente sem identificador para registrar a refeição.',
      });
      return;
    }

    setErroAnalise('');
    setLoadingAction('upload');

    try {
      const upload = await uploadImagemRefeicaoIA({
        asset: selectedImage,
        patientId,
      });

      setUploadedImage(upload);
      setLoadingAction('analysis');

      const response = await analisarImagemRefeicaoIA({
        bucket: upload.bucket,
        path: upload.path,
        mimeType: upload.mimeType,
        fileName: upload.fileName,
      });

      const itens = (response.alimentos || []).map((item) => criarAlimentoEditavel(item));

      if (!itens.length) {
        throw new Error(
          response.message ||
            'A IA nao conseguiu reconhecer alimentos nessa imagem. Tente outra foto ou preencha manualmente.'
        );
      }

      setAlimentos(itens);
      setAnalysisMeta({
        source: response.source || 'logmeal',
        imageId: response.imageId || null,
      });
    } catch (error) {
      console.log('Erro ao analisar refeicao com IA:', error);
      setAlimentos([buildFallbackFoodItem()]);
      setAnalysisMeta({
        source: 'manual-fallback',
        imageId: null,
      });
      setErroAnalise(
        normalizeAnalysisErrorMessage(error) +
          ' Voce pode continuar preenchendo os alimentos manualmente abaixo.'
      );
    } finally {
      setLoadingAction('');
    }
  }

  function atualizarCampo(index, field, value) {
    setAlimentos((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item;
        }

        if (field === 'nome' || field === 'categoria') {
          return {
            ...item,
            [field]: value,
          };
        }

        const numeric = Number(String(value).replace(',', '.'));

        return {
          ...item,
          [field]: Number.isFinite(numeric) ? numeric : 0,
        };
      })
    );
  }

  function adicionarItemManual() {
    setAlimentos((current) => [
      ...current,
      criarAlimentoEditavel({
        nome: 'Novo alimento',
        categoria: 'Ajuste manual',
      }),
    ]);
  }

  function removerItem(index) {
    setAlimentos((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function sincronizarTimeline(entry) {
    try {
      const experience = await fetchPatientExperience(patientId, {
        patientContext: usuarioLogado,
      });
      const nextState = {
        ...experience.appState,
        mealEntries: appendNewestEntry(experience.appState.mealEntries, entry),
      };

      await savePatientAppState({
        patientId,
        objectiveText: experience.clinicalObjective,
        appState: nextState,
        currentPatient: experience.patient,
        patientContext: usuarioLogado,
      });
    } catch (error) {
      console.log('Erro ao sincronizar timeline da refeicao IA:', error);
    }
  }

  function handleSelectMealTiming(mode) {
    const now = new Date();

    setMealTimingMode(mode);
    setMealType('');

    if (mode === 'current') {
      setMealTimingDate(formatDateForDisplay(buildLocalDateString(now)));
      setMealTimingTime(formatManualTimeInput(buildLocalTimeString(now)));
      setMealTypeMenuVisible(false);
      setMealTimingChoiceVisible(false);
      setMealTimingDetailsVisible(true);
      return;
    }

    setMealTimingDate(formatDateForDisplay(buildLocalDateString(now)));
    setMealTimingTime(formatManualTimeInput(buildLocalTimeString(now)));
    setMealTypeMenuVisible(false);
    setMealTimingChoiceVisible(false);
    setMealTimingDetailsVisible(true);
  }

  function handleConfirmMealTiming() {
    if (!canConfirmMealTiming) {
      setMensagemTopo({
        tipo: 'aviso',
        texto:
          mealTimingMode === 'current'
            ? 'Selecione o tipo da refeição para continuar.'
            : 'Selecione o tipo da refeição e informe uma data e hora válidas.',
      });
      return;
    }

    setMealTimingChoiceVisible(false);
    setMealTimingDetailsVisible(false);
    setMealTypeMenuVisible(false);
    runPendingMealAction();
  }

  function openMealTimingBefore(action) {
    setPendingMealAction(action);
    setMealTypeMenuVisible(false);
    setMealTimingDetailsVisible(false);
    setMealTimingChoiceVisible(true);
  }

  function runPendingMealAction() {
    const nextAction = pendingMealAction;
    setPendingMealAction(null);

    if (!nextAction) {
      return;
    }

    const delay = Platform.OS === 'web' ? 0 : 80;

    setTimeout(() => {
      if (nextAction === 'camera') {
        tirarFoto();
        return;
      }

      if (nextAction === 'gallery') {
        escolherDaGaleria();
        return;
      }

      if (nextAction === 'manual') {
        adicionarItemManual();
      }
    }, delay);
  }

  async function confirmarSalvar() {
    if (!hasFoods) {
      setMensagemTopo({
        tipo: 'aviso',
        texto: 'Confirme ao menos um alimento antes de salvar.',
      });
      return;
    }

    if (!patientId) {
      setMensagemTopo({
        tipo: 'aviso',
        texto: 'Paciente sem identificador para salvar a refeição.',
      });
      return;
    }

    setLoadingAction('save');

    try {
      const effectiveDate =
        mealTimingMode === 'previous' && normalizedMealTimingDate
          ? normalizedMealTimingDate
          : buildLocalDateString();
      const effectiveTime =
        mealTimingMode === 'previous' && normalizedMealTimingTime
          ? normalizedMealTimingTime
          : buildLocalTimeString();
      const createdAt = `${effectiveDate}T${effectiveTime}:00`;

      const saved = await salvarRefeicaoIA({
        patientId,
        fotoUrl: uploadedImage?.storagePath || null,
        alimentos,
        confirmado: true,
        createdAt,
      });

      const timelineEntry = {
        ...buildMealTimelineEntryFromAI({
          alimentos: saved.foods,
          totais: saved.totals,
          date: effectiveDate,
          time: effectiveTime,
          title: mealType || 'Refeição Registrada',
        }),
        id: `meal-ia-${saved.record?.id || Date.now()}`,
      };

      await sincronizarTimeline(timelineEntry);

      navigation.navigate('PacienteDiario', {
        usuarioLogado,
        mealEntryIA: timelineEntry,
        mealIARefreshToken: Date.now(),
      });
    } catch (error) {
      console.log('Erro ao salvar refeicao IA:', error);
      setMensagemTopo({
        tipo: 'erro',
        texto:
          error?.message ||
          'Não foi possível salvar a refeição. Verifique a conexão e tente novamente.',
      });
    } finally {
      setLoadingAction('');
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      showTabBar={false}
      contentContainerStyle={styles.screenContent}
      footerOverlay={
        <TouchableOpacity
          style={[styles.saveButton, (!hasFoods || isBusy) && styles.buttonDisabled]}
          onPress={confirmarSalvar}
          disabled={!hasFoods || isBusy}
        >
          {loadingAction === 'save' ? (
            <ActivityIndicator color={patientTheme.colors.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Salvar refeicao confirmada</Text>
          )}
        </TouchableOpacity>
      }
    >
      {mensagemTopo?.texto ? (
        <MensagemInline
          tipo={mensagemTopo.tipo || 'aviso'}
          texto={mensagemTopo.texto}
          onFechar={() => setMensagemTopo(null)}
        />
      ) : null}
      <Modal
        visible={mealTimingChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPendingMealAction(null);
          setMealTimingChoiceVisible(false);
        }}
      >
        <View style={styles.overlayLayer}>
          <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registrar alimentação</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setPendingMealAction(null);
                    setMealTimingChoiceVisible(false);
                  }}
                >
                  <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalText}>
                Escolha se esta refeição é de agora ou se deseja registrar uma refeição anterior.
              </Text>

              <View style={styles.measurementChoiceList}>
                <TouchableOpacity
                  style={[
                    styles.measurementChoiceButton,
                    mealTimingMode === 'current'
                      ? styles.measurementChoiceButtonCurrent
                      : styles.measurementChoiceButtonPrevious,
                  ]}
                  onPress={() => handleSelectMealTiming('current')}
                >
                  <Text
                    style={[
                      mealTimingMode === 'current'
                        ? styles.measurementChoiceTextCurrent
                        : styles.measurementChoiceTextPrevious,
                    ]}
                  >
                    Refeição Atual
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.measurementChoiceButton,
                    mealTimingMode === 'previous'
                      ? styles.measurementChoiceButtonCurrent
                      : styles.measurementChoiceButtonPrevious,
                  ]}
                  onPress={() => handleSelectMealTiming('previous')}
                >
                  <Text
                    style={[
                      mealTimingMode === 'previous'
                        ? styles.measurementChoiceTextCurrent
                        : styles.measurementChoiceTextPrevious,
                    ]}
                  >
                    Refeição Anterior
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={mealTimingDetailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMealTypeMenuVisible(false);
          setMealTimingDetailsVisible(false);
        }}
      >
        <View style={styles.overlayLayer}>
          <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {mealTimingMode === 'current' ? 'Registro atual' : 'Registro anterior'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setMealTypeMenuVisible(false);
                    setMealTimingDetailsVisible(false);
                  }}
                >
                  <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalText}>
                {mealTimingMode === 'current'
                  ? 'Informe o tipo, a data e a hora da refei\u00e7\u00e3o. Ao salvar, ela entra na sua evolu\u00e7\u00e3o.'
                  : 'Informe o tipo, a data e a hora da refei\u00e7\u00e3o.'}
              </Text>

              <View style={styles.previousMealFields}>
                <Text style={styles.modalFieldLabel}>{'Tipo da Refei\u00e7\u00e3o'}</Text>
                <TouchableOpacity
                  style={[styles.input, styles.manualModalInput, styles.dropdownButton]}
                  onPress={() => setMealTypeMenuVisible((current) => !current)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      !mealType && styles.dropdownPlaceholderText,
                    ]}
                  >
                    {mealType || 'Selecione o tipo'}
                  </Text>
                  <Ionicons
                    name={mealTypeMenuVisible ? 'chevron-up' : 'chevron-forward'}
                    size={18}
                    color={patientTheme.colors.textMuted}
                  />
                </TouchableOpacity>

                {mealTypeMenuVisible ? (
                  <View style={styles.mealTypeInlineList}>
                    {mealTypeOptions.map((option) => {
                      const isSelected = mealType === option;

                      return (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.mealTypeOptionButton,
                            isSelected && styles.mealTypeOptionButtonSelected,
                          ]}
                          onPress={() => {
                            setMealType(option);
                            setMealTypeMenuVisible(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.mealTypeOptionText,
                              isSelected && styles.mealTypeOptionTextSelected,
                            ]}
                          >
                            {option}
                          </Text>
                          {isSelected ? (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={patientTheme.colors.primaryDark}
                            />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                <Text style={styles.modalFieldLabel}>Data</Text>
                <TextInput
                  style={[styles.input, styles.manualModalInput, styles.modalInput]}
                  placeholder="Ex: dd/mm/aaaa"
                  placeholderTextColor="#8a9095"
                  value={mealTimingDate}
                  onChangeText={(value) => setMealTimingDate(formatManualDateInput(value))}
                />

                <Text style={styles.modalFieldLabel}>Hora</Text>
                <TextInput
                  style={[styles.input, styles.manualModalInput, styles.modalInput]}
                  placeholder="Ex: 15:48"
                  placeholderTextColor="#8a9095"
                  value={mealTimingTime}
                  onChangeText={(value) => setMealTimingTime(formatManualTimeInput(value))}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.modalPrimaryButton,
                  !canConfirmMealTiming && styles.primaryButtonDisabled,
                ]}
                onPress={handleConfirmMealTiming}
                disabled={!canConfirmMealTiming}
              >
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <View style={styles.contextCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.cardTitle}>Resumo da refeição</Text>
            <Text style={styles.cardText}>Defina o contexto antes de enviar foto ou editar alimentos.</Text>
          </View>
          <TouchableOpacity
            style={styles.contextEditButton}
            onPress={() => openMealTimingBefore(null)}
            disabled={isBusy}
          >
            <Ionicons name="create-outline" size={16} color={patientTheme.colors.primaryDark} />
            <Text style={styles.contextEditButtonText}>Editar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contextPanel}>
          <View style={styles.contextPill}>
            <Text style={styles.contextPillLabel}>Tipo</Text>
            <Text style={styles.contextPillValue}>{mealType || 'Selecione a refeição'}</Text>
          </View>
          <View style={styles.contextPill}>
            <Text style={styles.contextPillLabel}>Momento</Text>
            <Text style={styles.contextPillValue}>{getMealTimingLabel(mealTimingMode)}</Text>
          </View>
          <View style={styles.contextPill}>
            <Text style={styles.contextPillLabel}>Data</Text>
            <Text style={styles.contextPillValue}>{mealTimingDate || '--/--/----'}</Text>
          </View>
          <View style={styles.contextPill}>
            <Text style={styles.contextPillLabel}>Hora</Text>
            <Text style={styles.contextPillValue}>{mealTimingTime || '--:--'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Envie a foto</Text>
        <Text style={styles.cardText}>
          Escolha uma foto do prato para analisar com IA ou seguir preenchendo manualmente.
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openMealTimingBefore('camera')}
            disabled={isBusy}
          >
            <Ionicons name="camera-outline" size={18} color={patientTheme.colors.text} />
            <Text style={styles.secondaryButtonText}>Tirar foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openMealTimingBefore('gallery')}
            disabled={isBusy}
          >
            <Ionicons name="image-outline" size={18} color={patientTheme.colors.text} />
            <Text style={styles.secondaryButtonText}>Galeria</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openMealTimingBefore('manual')}
            disabled={isBusy}
          >
            <Ionicons name="create-outline" size={18} color={patientTheme.colors.text} />
            <Text style={styles.secondaryButtonText}>Manual</Text>
          </TouchableOpacity>
        </View>

        {selectedImage?.uri ? (
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderBox}>
            <Ionicons name="restaurant-outline" size={24} color={patientTheme.colors.textMuted} />
            <Text style={styles.placeholderText}>Nenhuma imagem selecionada ainda.</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!hasSelectedImage || isBusy) && styles.primaryButtonDisabled,
          ]}
          onPress={analisarImagem}
          disabled={!hasSelectedImage || isBusy}
        >
          {loadingAction === 'upload' || loadingAction === 'analysis' ? (
            <ActivityIndicator color={patientTheme.colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Analisar com IA</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.manualPhotoButton,
            (!hasSelectedImage || isBusy) && styles.manualPhotoButtonDisabled,
          ]}
          onPress={() => {
            if (!hasSelectedImage) {
              setMensagemTopo({
                tipo: 'aviso',
                texto: 'Escolha uma foto antes de continuar sem IA.',
              });
              return;
            }

            setAlimentos([buildFallbackFoodItem()]);
            setAnalysisMeta({
              source: 'manual-photo',
              imageId: null,
            });
            setErroAnalise('');
          }}
          disabled={!hasSelectedImage || isBusy}
        >
          <Text style={styles.manualPhotoButtonText}>Continuar sem IA</Text>
        </TouchableOpacity>

        {loadingAction === 'upload' ? (
          <Text style={styles.helperText}>Enviando imagem para o Storage...</Text>
        ) : null}
        {loadingAction === 'analysis' ? (
          <Text style={styles.helperText}>Consultando a IA alimentar...</Text>
        ) : null}
        {selectedImage?.isScreenshot ? (
          <Text style={styles.warningText}>
            Prints e screenshots costumam ter reconhecimento pior. Para melhor resultado, use uma
            foto tirada pela camera.
          </Text>
        ) : null}
        {analysisMeta?.source ? (
          <Text style={styles.helperText}>Analise concluida via {analysisMeta.source}.</Text>
        ) : null}
        {hasFoods ? (
          <Text style={styles.helperText}>
            Se algum item nao apareceu, adicione manualmente abaixo antes de salvar.
          </Text>
        ) : null}
        {erroAnalise ? <Text style={styles.errorText}>{erroAnalise}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.cardTitle}>2. Confirme os alimentos</Text>
            <Text style={styles.cardText}>
              Ajuste nome, categoria, quantidade e nutrientes antes de salvar.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addFoodPrimaryButton, isBusy && styles.buttonDisabled]}
          onPress={adicionarItemManual}
          disabled={isBusy}
        >
          <Ionicons name="add-circle-outline" size={18} color={patientTheme.colors.onPrimary} />
          <Text style={styles.addFoodPrimaryButtonText}>Adicionar alimento manualmente</Text>
        </TouchableOpacity>

        {hasFoods ? (
          <>
            {alimentos.map((item, index) => (
              <View key={item.id} style={styles.foodCard}>
                <View style={styles.foodHeader}>
                  <Text style={styles.foodIndex}>Item {index + 1}</Text>
                  <TouchableOpacity onPress={() => removerItem(index)} disabled={isBusy}>
                    <Ionicons name="trash-outline" size={18} color="#b75c5c" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={item.nome}
                  onChangeText={(value) => atualizarCampo(index, 'nome', value)}
                  placeholder="Nome do alimento"
                  placeholderTextColor="#8a9095"
                />

                <Text style={styles.inputLabel}>Categoria</Text>
                <TextInput
                  style={styles.input}
                  value={item.categoria}
                  onChangeText={(value) => atualizarCampo(index, 'categoria', value)}
                  placeholder="Categoria"
                  placeholderTextColor="#8a9095"
                />

                <View style={styles.nutritionPanel}>
                  <Text style={styles.nutritionPanelTitle}>Dados básicos</Text>
                  <View style={styles.nutritionGrid}>
                    {FOOD_CORE_FIELDS.map((field) => (
                      <View key={`${item.id}-${field.key}`} style={styles.nutritionGridItem}>
                        <Text style={styles.inputLabel}>
                          {field.label} {field.unit ? `(${field.unit})` : ''}
                        </Text>
                        <TextInput
                          style={[styles.input, styles.nutrientInput]}
                          value={String(item[field.key] ?? 0)}
                          onChangeText={(value) => atualizarCampo(index, field.key, value)}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.nutritionPanel}>
                  <Text style={styles.nutritionPanelTitle}>Macronutrientes</Text>
                  <View style={styles.nutritionGrid}>
                    {FOOD_MACRO_FIELDS.map((field) => (
                      <View key={`${item.id}-${field.key}`} style={styles.nutritionGridItem}>
                        <Text style={styles.inputLabel}>
                          {field.label} {field.unit ? `(${field.unit})` : ''}
                        </Text>
                        <TextInput
                          style={[styles.input, styles.nutrientInput]}
                          value={String(item[field.key] ?? 0)}
                          onChangeText={(value) => atualizarCampo(index, field.key, value)}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.nutritionPanel}>
                  <Text style={styles.nutritionPanelTitle}>Micronutrientes</Text>
                  <View style={styles.nutritionGrid}>
                    {FOOD_MICRO_FIELDS.map((field) => (
                      <View key={`${item.id}-${field.key}`} style={styles.nutritionGridItem}>
                        <Text style={styles.inputLabel}>
                          {field.label} {field.unit ? `(${field.unit})` : ''}
                        </Text>
                        <TextInput
                          style={[styles.input, styles.nutrientInput]}
                          value={String(item[field.key] ?? 0)}
                          onChangeText={(value) => atualizarCampo(index, field.key, value)}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))}

          </>
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>
              Nenhum alimento reconhecido ainda. Voce pode analisar uma imagem ou adicionar itens
              manualmente.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Totais confirmados</Text>
        <Text style={styles.summarySectionTitle}>Resumo da refeição</Text>
        <Text style={styles.summaryContextText}>{mealContextLabel}</Text>
        <Text style={styles.summaryContextText}>
          {mealTimingDate || '--/--/----'} às {mealTimingTime || '--:--'}
        </Text>

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Macronutrientes</Text>
          <View style={styles.summaryMetricList}>
            {TOTAL_MACRO_FIELDS.map((field) => {
              const target = TOTAL_TARGETS[field.key];
              const progress = getProgressPercent(totais[field.key], target);
              return (
                <View key={field.key} style={styles.summaryMetricItem}>
                  <View style={styles.summaryMetricHeader}>
                    <Text style={styles.summaryMetricLabel}>{field.label}</Text>
                    <Text style={styles.summaryMetricValue}>
                      {formatNutrient(totais[field.key], field.unit ? ` ${field.unit}` : '')}
                    </Text>
                  </View>
                  <View style={styles.summaryMetricBarTrack}>
                    <View
                      style={[
                        styles.summaryMetricBarFill,
                        { width: `${progress}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.summaryMetricMeta}>
                    {progress}% da referência • meta {formatNutrient(target, field.unit ? ` ${field.unit}` : '')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Micronutrientes</Text>
          <View style={styles.summaryMetricList}>
            {TOTAL_MICRO_FIELDS.map((field) => {
              const target = TOTAL_TARGETS[field.key];
              const progress = getProgressPercent(totais[field.key], target);
              return (
                <View key={field.key} style={styles.summaryMetricItem}>
                  <View style={styles.summaryMetricHeader}>
                    <Text style={styles.summaryMetricLabel}>{field.label}</Text>
                    <Text style={styles.summaryMetricValue}>
                      {formatNutrient(totais[field.key], field.unit ? ` ${field.unit}` : '')}
                    </Text>
                  </View>
                  <View style={styles.summaryMetricBarTrack}>
                    <View
                      style={[
                        styles.summaryMetricBarFill,
                        { width: `${progress}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.summaryMetricMeta}>
                    {progress}% da referência • meta {formatNutrient(target, field.unit ? ` ${field.unit}` : '')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 116,
  },
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginBottom: 16,
    ...patientShadow,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  cardText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  secondaryButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: patientTheme.radius.lg,
    marginTop: 16,
    backgroundColor: '#e9eef1',
  },
  placeholderBox: {
    marginTop: 16,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fcfcfc',
  },
  placeholderText: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#cfd6d4',
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  manualPhotoButton: {
    marginTop: 10,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: '#ffffff',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualPhotoButtonDisabled: {
    backgroundColor: '#f1f3f2',
    borderColor: '#d9dfdc',
  },
  manualPhotoButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  helperText: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    marginTop: 10,
    color: '#c35a5a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  warningText: {
    marginTop: 10,
    color: '#9a6d1f',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  tipCard: {
    marginBottom: 16,
    backgroundColor: '#f9fffc',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dff3ea',
    flexDirection: 'row',
    gap: 12,
  },
  tipIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  tipText: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  contextCard: {
    marginBottom: 14,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  contextEditButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  contextEditButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  contextPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  contextPill: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  contextPillLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  contextPillValue: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeader: {
    gap: 12,
  },
  foodCard: {
    marginTop: 16,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#ffffff',
    padding: 14,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  foodIndex: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  nutritionPanel: {
    marginTop: 14,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    padding: 12,
  },
  nutritionPanelTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nutritionGridItem: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  inputLabel: {
    marginTop: 10,
    marginBottom: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    minHeight: 44,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: patientTheme.colors.text,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  nutrientInput: {
    backgroundColor: '#ffffff',
    marginTop: 0,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridItem: {
    flex: 1,
  },
  addFoodPrimaryButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  addFoodPrimaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    ...patientShadow,
  },
  summaryTitle: {
    color: patientTheme.colors.primaryDark,
    fontSize: 17,
    fontWeight: '700',
  },
  summarySection: {
    marginTop: 14,
  },
  summarySectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
  },
  summaryContextText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  summaryMetricList: {
    marginTop: 10,
    gap: 10,
  },
  summaryMetricItem: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  summaryMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryMetricLabel: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryMetricValue: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryMetricBarTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e6f3ed',
    overflow: 'hidden',
  },
  summaryMetricBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: patientTheme.colors.primary,
  },
  summaryMetricMeta: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  saveButton: {
    marginTop: 18,
    marginBottom: 8,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.primaryDark,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 52, 56, 0.32)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  modalKeyboard: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    maxWidth: 420,
    padding: 18,
    width: '100%',
    ...patientShadow,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 36,
    position: 'relative',
  },
  modalTitle: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 42,
    textAlign: 'center',
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
  },
  modalText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  measurementChoiceList: {
    gap: 10,
    marginTop: 16,
  },
  measurementChoiceButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  measurementChoiceButtonCurrent: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  measurementChoiceButtonPrevious: {
    backgroundColor: '#f1f3f5',
    borderColor: '#f1f3f5',
    borderWidth: 1,
  },
  measurementChoiceTextCurrent: {
    color: patientTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  measurementChoiceTextPrevious: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  previousMealFields: {
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  modalFieldLabel: {
    color: '#4f565c',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  manualModalInput: {
    alignSelf: 'stretch',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    width: '100%',
  },
  dropdownButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
    minHeight: 46,
    width: '100%',
  },
  dropdownButtonText: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 10,
  },
  dropdownPlaceholderText: {
    color: '#8a9095',
    fontWeight: '500',
  },
  modalInput: {
    marginTop: 0,
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    width: '100%',
  },
  mealTypeInlineList: {
    gap: 8,
    marginTop: 14,
  },
  mealTypeOptionButton: {
    backgroundColor: '#f1f3f5',
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  mealTypeOptionButtonSelected: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
  },
  mealTypeOptionText: {
    color: patientTheme.colors.textMuted,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  mealTypeOptionTextSelected: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
  },
});
