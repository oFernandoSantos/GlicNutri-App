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
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import MensagemInline from '../../componentes/comum/MensagemInline';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  addGlucoseReading,
  appendNewestEntry,
  fetchPatientExperience,
  getPatientId,
  savePatientAppState,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
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
  'Cafe da Manha',
  'Lanche da Manha',
  'Almoco',
  'Lanche da Tarde',
  'Jantar',
  'Ceia',
  'Outro Momento',
];

const FOOD_SUGGESTIONS = [
  {
    nome: 'Pao integral',
    categoria: 'Padaria',
    quantidade_gramas: 50,
    porcao: '2 fatias',
    calorias: 138,
    carboidratos: 24,
    proteinas: 6,
    gorduras: 2,
  },
  {
    nome: 'Ovo cozido',
    categoria: 'Proteina',
    quantidade_gramas: 50,
    porcao: '1 unidade',
    calorias: 78,
    carboidratos: 0.6,
    proteinas: 6,
    gorduras: 5,
  },
  {
    nome: 'Banana',
    categoria: 'Fruta',
    quantidade_gramas: 90,
    porcao: '1 media',
    calorias: 105,
    carboidratos: 27,
    proteinas: 1,
    gorduras: 0.3,
  },
  {
    nome: 'Frango grelhado',
    categoria: 'Proteina',
    quantidade_gramas: 100,
    porcao: '100g',
    calorias: 165,
    carboidratos: 0,
    proteinas: 31,
    gorduras: 3.6,
  },
  {
    nome: 'Arroz integral',
    categoria: 'Graos',
    quantidade_gramas: 90,
    porcao: '3 colheres',
    calorias: 124,
    carboidratos: 26,
    proteinas: 2.6,
    gorduras: 1,
  },
  {
    nome: 'Feijao',
    categoria: 'Graos',
    quantidade_gramas: 86,
    porcao: '1 concha',
    calorias: 76,
    carboidratos: 14,
    proteinas: 4.5,
    gorduras: 0.5,
  },
];

function formatNutrient(value, suffix = '') {
  const normalized = Math.round((Number(value) || 0) * 10) / 10;
  return `${normalized.toFixed(1).replace('.0', '')}${suffix}`;
}

function getMealTimingLabel(mode) {
  return mode === 'current' ? 'Refeicao atual' : 'Refeicao anterior';
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

function buildSelectedFoodSummary(item) {
  const quantity = item.quantidade_gramas ? `${formatNutrient(item.quantidade_gramas, 'g')}` : '';
  const calories = `${Math.round(Number(item.calorias) || 0)} kcal`;
  const macros = `C:${formatNutrient(item.carboidratos, 'g')} P:${formatNutrient(
    item.proteinas,
    'g'
  )} G:${formatNutrient(item.gorduras, 'g')}`;

  if (quantity) {
    return `${quantity}  ${calories}  ${macros}`;
  }

  return `${calories}  ${macros}`;
}

export default function RegistroRefeicaoIA({ navigation, route, usuarioLogado: usuarioProp }) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [mealTimingChoiceVisible, setMealTimingChoiceVisible] = useState(
    Boolean(route?.params?.openMealTimingChoice)
  );
  const [mealTimingDetailsVisible, setMealTimingDetailsVisible] = useState(false);
  const [mealGlucoseVisible, setMealGlucoseVisible] = useState(false);
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
  const [foodSearch, setFoodSearch] = useState('');
  const [mealGlucoseValue, setMealGlucoseValue] = useState('');
  const [savingMealGlucose, setSavingMealGlucose] = useState(false);

  const totais = useMemo(() => calcularTotaisRefeicaoIA(alimentos), [alimentos]);
  const hasFoods = alimentos.length > 0;
  const isBusy = Boolean(loadingAction);
  const hasSelectedImage = Boolean(selectedImage?.uri);
  const normalizedMealTimingDate = normalizeManualDateInput(mealTimingDate);
  const normalizedMealTimingTime = normalizeManualTimeInput(mealTimingTime);
  const canConfirmMealTiming =
    Boolean(mealType) &&
    isValidManualDate(mealTimingDate) &&
    isValidManualTime(mealTimingTime);

  const summaryMetrics = useMemo(
    () => [
      { label: 'kcal', value: Math.round(Number(totais.calorias_total) || 0), color: '#111827' },
      { label: 'Carbo', value: formatNutrient(totais.carboidratos_total), color: '#2563eb' },
      { label: 'Prot', value: formatNutrient(totais.proteinas_total), color: '#f97316' },
      { label: 'Gord', value: formatNutrient(totais.gorduras_total), color: '#ef4444' },
    ],
    [totais]
  );

  const filteredSuggestions = useMemo(() => {
    const query = String(foodSearch || '').trim().toLowerCase();

    if (!query) {
      return FOOD_SUGGESTIONS;
    }

    return FOOD_SUGGESTIONS.filter((item) => item.nome.toLowerCase().includes(query));
  }, [foodSearch]);

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
        texto: error?.message || 'Nao foi possivel abrir a galeria. Verifique as permissoes.',
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
        texto: error?.message || 'Nao foi possivel abrir a camera. Verifique as permissoes.',
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
        texto: 'Paciente sem identificador para registrar a refeicao.',
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

  function adicionarSugestao(item) {
    setAlimentos((current) => [
      ...current,
      criarAlimentoEditavel({
        ...item,
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
        ...mesclarLimitesDadosPaciente('diario'),
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
    setMealTimingDate(formatDateForDisplay(buildLocalDateString(now)));
    setMealTimingTime(formatManualTimeInput(buildLocalTimeString(now)));
    setMealTypeMenuVisible(false);
    setMealTimingChoiceVisible(false);
    setMealGlucoseValue('');
    setMealGlucoseVisible(true);
  }

  function continueAfterMealGlucose() {
    setMealGlucoseVisible(false);
    setMealTimingDetailsVisible(true);
  }

  async function handleSaveMealGlucose() {
    const parsedValue = Number(String(mealGlucoseValue || '').replace(',', '.'));

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setMensagemTopo({
        tipo: 'aviso',
        texto: 'Informe uma glicose valida em mg/dL.',
      });
      return;
    }

    if (!patientId) {
      continueAfterMealGlucose();
      return;
    }

    try {
      setSavingMealGlucose(true);
      await addGlucoseReading(patientId, parsedValue, {
        date: buildLocalDateString(),
        time: buildLocalTimeString(),
        actor: usuarioLogado,
        auditSource: 'registro_refeicao_fluxo',
        symptoms:
          mealTimingMode === 'current'
            ? 'Tipo da glicemia: Antes da refeicao'
            : 'Tipo da glicemia: Outro Momento',
      });
      continueAfterMealGlucose();
    } catch (error) {
      console.log('Erro ao salvar glicemia no fluxo da refeicao:', error);
      setMensagemTopo({
        tipo: 'erro',
        texto: 'Nao foi possivel salvar a glicose agora. Tente novamente ou continue sem ela.',
      });
    } finally {
      setSavingMealGlucose(false);
    }
  }

  function handleConfirmMealTiming() {
    if (!canConfirmMealTiming) {
      setMensagemTopo({
        tipo: 'aviso',
        texto:
          mealTimingMode === 'current'
            ? 'Selecione o tipo da refeicao para continuar.'
            : 'Selecione o tipo da refeicao e informe uma data e hora validas.',
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
        texto: 'Paciente sem identificador para salvar a refeicao.',
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
          title: mealType || 'Refeicao Registrada',
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
          'Nao foi possivel salvar a refeicao. Verifique a conexao e tente novamente.',
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
          style={[styles.saveButton, isBusy && styles.saveButtonBusy]}
          onPress={confirmarSalvar}
          disabled={!hasFoods || isBusy}
        >
          {loadingAction === 'save' ? (
            <ActivityIndicator color={patientTheme.colors.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Salvar Refeicao</Text>
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
                  <Text style={styles.modalTitle}>Registrar alimentacao</Text>
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
                  Escolha se esta refeicao e de agora ou se deseja registrar uma refeicao anterior.
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
                      Refeicao Atual
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
                      Refeicao Anterior
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={mealGlucoseVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMealGlucoseVisible(false);
          setMealTimingDetailsVisible(true);
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
                  <Text style={styles.modalTitle}>Registrar glicose</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => continueAfterMealGlucose()}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalText}>
                  Antes de continuar, informe a glicose atual em mg/dL. Se preferir, voce pode
                  seguir sem preencher.
                </Text>

                <View style={styles.previousMealFields}>
                  <Text style={styles.modalFieldLabel}>Glicose atual</Text>
                  <TextInput
                    style={[styles.input, styles.manualModalInput]}
                    placeholder="Ex: 110"
                    placeholderTextColor="#8a9095"
                    keyboardType="decimal-pad"
                    value={mealGlucoseValue}
                    onChangeText={setMealGlucoseValue}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.modalPrimaryButton, savingMealGlucose && styles.primaryButtonDisabled]}
                  onPress={handleSaveMealGlucose}
                  disabled={savingMealGlucose}
                >
                  {savingMealGlucose ? (
                    <ActivityIndicator color={patientTheme.colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Salvar glicose</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipInlineButton}
                  onPress={() => continueAfterMealGlucose()}
                  disabled={savingMealGlucose}
                >
                  <Text style={styles.skipInlineButtonText}>Continuar sem glicose</Text>
                </TouchableOpacity>
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
                  Informe o tipo, a data e a hora da refeicao.
                </Text>

                <View style={styles.previousMealFields}>
                  <Text style={styles.modalFieldLabel}>Tipo da Refeicao</Text>
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
                    style={[styles.input, styles.manualModalInput]}
                    placeholder="Ex: dd/mm/aaaa"
                    placeholderTextColor="#8a9095"
                    value={mealTimingDate}
                    onChangeText={(value) => setMealTimingDate(formatManualDateInput(value))}
                  />

                  <Text style={styles.modalFieldLabel}>Hora</Text>
                  <TextInput
                    style={[styles.input, styles.manualModalInput]}
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tipo de Refeicao</Text>
        <TouchableOpacity style={styles.typeSelector} onPress={() => openMealTimingBefore(null)}>
          <View style={styles.typeSelectorContent}>
            <Text style={[styles.typeSelectorValue, !mealType && styles.typeSelectorPlaceholder]}>
              {mealType || 'Selecione...'}
            </Text>
            <Text style={styles.typeSelectorMeta}>
              {getMealTimingLabel(mealTimingMode)}  {mealTimingDate}  {mealTimingTime}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={patientTheme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.photoDropzone}
          onPress={() => openMealTimingBefore('camera')}
          activeOpacity={0.88}
        >
          {selectedImage?.uri ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={28} color={patientTheme.colors.textMuted} />
              <Text style={styles.photoDropzoneTitle}>Tirar foto da refeicao</Text>
              <Text style={styles.photoDropzoneText}>Opcional, mas ajuda a IA</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.photoActionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openMealTimingBefore('camera')}
            disabled={isBusy}
          >
            <Ionicons name="camera-outline" size={18} color={patientTheme.colors.text} />
            <Text style={styles.secondaryButtonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openMealTimingBefore('gallery')}
            disabled={isBusy}
          >
            <Ionicons name="image-outline" size={18} color={patientTheme.colors.text} />
            <Text style={styles.secondaryButtonText}>Galeria</Text>
          </TouchableOpacity>
        </View>

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

        {loadingAction === 'upload' ? (
          <Text style={styles.helperText}>Enviando imagem para o storage...</Text>
        ) : null}
        {loadingAction === 'analysis' ? (
          <Text style={styles.helperText}>Consultando a IA alimentar...</Text>
        ) : null}
        {analysisMeta?.source ? (
          <Text style={styles.helperText}>Analise concluida via {analysisMeta.source}.</Text>
        ) : null}
        {erroAnalise ? <Text style={styles.errorText}>{erroAnalise}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Buscar Alimento</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={patientTheme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Digite o nome do alimento..."
            placeholderTextColor="#9aa1a8"
            value={foodSearch}
            onChangeText={setFoodSearch}
          />
        </View>

        <Text style={styles.cardHint}>Sugestoes baseadas no seu plano</Text>

        <View style={styles.suggestionList}>
          {filteredSuggestions.map((item) => (
            <View key={item.nome} style={styles.suggestionRow}>
              <View style={styles.suggestionInfo}>
                <Text style={styles.suggestionName}>{item.nome}</Text>
                <Text style={styles.suggestionSubtext}>{item.porcao}</Text>
              </View>
              <View style={styles.suggestionMeta}>
                <Text style={styles.suggestionCalories}>{Math.round(item.calorias)} kcal</Text>
                <Text style={styles.suggestionMacros}>
                  C:{formatNutrient(item.carboidratos)}g P:{formatNutrient(item.proteinas)}g
                </Text>
              </View>
              <TouchableOpacity
                style={styles.suggestionAddButton}
                onPress={() => adicionarSugestao(item)}
                disabled={isBusy}
              >
                <Ionicons name="add" size={18} color={patientTheme.colors.primaryDark} />
              </TouchableOpacity>
            </View>
          ))}

          {!filteredSuggestions.length ? (
            <View style={styles.emptySuggestionState}>
              <Text style={styles.emptySuggestionText}>Nenhum alimento encontrado.</Text>
              <TouchableOpacity style={styles.inlineLinkButton} onPress={adicionarItemManual}>
                <Text style={styles.inlineLinkText}>Adicionar manualmente</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.selectedCard}>
        <View style={styles.selectedHeader}>
          <Text style={styles.cardTitle}>Itens Selecionados</Text>
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>
              {alimentos.length} {alimentos.length === 1 ? 'item' : 'itens'}
            </Text>
          </View>
        </View>

        {hasFoods ? (
          <View style={styles.selectedList}>
            {alimentos.map((item, index) => (
              <View key={item.id || `${item.nome}-${index}`} style={styles.selectedItemRow}>
                <View style={styles.selectedItemMain}>
                  <TextInput
                    style={styles.selectedItemName}
                    value={item.nome}
                    onChangeText={(value) => atualizarCampo(index, 'nome', value)}
                    placeholder="Nome do alimento"
                    placeholderTextColor="#8a9095"
                  />
                  <Text style={styles.selectedItemSummary}>{buildSelectedFoodSummary(item)}</Text>
                  <View style={styles.selectedItemControls}>
                    <View style={styles.quantityField}>
                      <Text style={styles.quantityLabel}>Qtd (g)</Text>
                      <TextInput
                        style={styles.quantityInput}
                        value={String(item.quantidade_gramas ?? 0)}
                        onChangeText={(value) => atualizarCampo(index, 'quantidade_gramas', value)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.removeItemButton}
                      onPress={() => removerItem(index)}
                      disabled={isBusy}
                    >
                      <Ionicons name="trash-outline" size={16} color="#b75c5c" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addManualButton, isBusy && styles.buttonDisabled]}
              onPress={adicionarItemManual}
              disabled={isBusy}
            >
              <Ionicons name="add-circle-outline" size={18} color={patientTheme.colors.primaryDark} />
              <Text style={styles.addManualButtonText}>Adicionar alimento manualmente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptySelectedState}>
            <Text style={styles.emptySelectedTitle}>Nenhum item adicionado ainda</Text>
            <Text style={styles.emptySelectedText}>Busque e adicione alimentos acima</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumo Nutricional</Text>
        <View style={styles.summaryStatsRow}>
          {summaryMetrics.map((item) => (
            <View key={item.label} style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.summaryStatLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 108,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  selectedCard: {
    backgroundColor: '#f5fff9',
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
    ...patientShadow,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  cardHint: {
    marginTop: 10,
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  typeSelector: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  typeSelectorContent: {
    flex: 1,
  },
  typeSelectorValue: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  typeSelectorPlaceholder: {
    color: '#9aa1a8',
    fontWeight: '500',
  },
  typeSelectorMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  photoDropzone: {
    minHeight: 138,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  photoDropzoneTitle: {
    marginTop: 10,
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  photoDropzoneText: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 12,
    minHeight: 46,
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#cfd6d4',
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
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
  searchBox: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: patientTheme.colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  suggestionList: {
    marginTop: 10,
    gap: 10,
  },
  suggestionRow: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSubtext: {
    marginTop: 3,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  suggestionMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  suggestionCalories: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionMacros: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  suggestionAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
  },
  emptySuggestionState: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptySuggestionText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
  },
  inlineLinkButton: {
    marginTop: 8,
  },
  inlineLinkText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectedBadge: {
    backgroundColor: '#0ea43e',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  selectedList: {
    marginTop: 14,
    gap: 10,
  },
  selectedItemRow: {
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  selectedItemMain: {
    gap: 8,
  },
  selectedItemName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 0,
  },
  selectedItemSummary: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  selectedItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quantityField: {
    flex: 1,
  },
  quantityLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  quantityInput: {
    minHeight: 40,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    color: patientTheme.colors.text,
  },
  removeItemButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  addManualButton: {
    minHeight: 44,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addManualButtonText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  emptySelectedState: {
    marginTop: 18,
    minHeight: 116,
    borderRadius: patientTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySelectedTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySelectedText: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  summaryStatsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  summaryStatLabel: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  saveButton: {
    marginTop: 18,
    marginBottom: 8,
    minHeight: 48,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonBusy: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  saveButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
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
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
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
  manualModalInput: {
    alignSelf: 'stretch',
    width: '100%',
  },
  dropdownButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    width: '100%',
  },
  skipInlineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 42,
  },
  skipInlineButtonText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  mealTypeInlineList: {
    gap: 8,
    marginTop: 14,
  },
  mealTypeOptionButton: {
    backgroundColor: '#f1f3f5',
    borderColor: patientTheme.colors.border,
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
    borderColor: patientTheme.colors.primarySoft,
  },
  mealTypeOptionText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  mealTypeOptionTextSelected: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
});
