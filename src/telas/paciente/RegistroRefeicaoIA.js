import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import ToastPaciente from '../../componentes/comum/ToastPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { invalidatePatientExperienceCache } from '../../servicos/cacheExperienciaPaciente';
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
import {
  buscarAlimentosBrasil,
  FONTE_ALIMENTOS_LABEL,
  buscarProdutosRotuloBrasil,
  buscarMelhorProdutoRotuloBrasil,
  materializarAlimentoDaBusca,
} from '../../servicos/servicoBuscaAlimentosBrasil';
import {
  aplicarAprendizadoNutricional,
  carregarAprendizadoNutricional,
  registrarAprendizadoNutricional,
} from '../../servicos/servicoAprendizadoNutricional';
import {
  enrichMealEntryWithPlanLink,
  resolvePlanSections,
} from '../../utilitarios/vinculoPlanoRefeicao';

const FOOD_SEARCH_MIN_CHARS = 2;
const FOOD_SEARCH_PAGE_SIZE = 12;
const FOOD_SEARCH_LIST_MAX_HEIGHT = 200;
const NOTIFICACAO_AUTO_MS = 5000;
const PHOTO_DROPZONE_HEIGHT = 170;

const EDITABLE_ITEM_FIELDS = [
  { itemKey: 'calorias', baseKey: 'base_calorias', label: 'kcal', unit: '', color: '#111827' },
  { itemKey: 'carboidratos', baseKey: 'base_carboidratos', label: 'Carbo', unit: 'g', color: '#2563eb' },
  { itemKey: 'proteinas', baseKey: 'base_proteinas', label: 'Prot', unit: 'g', color: '#f97316' },
  { itemKey: 'gorduras', baseKey: 'base_gorduras', label: 'Gord', unit: 'g', color: '#ef4444' },
  { itemKey: 'fibras', baseKey: 'base_fibras', label: 'Fibra', unit: 'g', color: '#16a34a' },
  { itemKey: 'acucares', baseKey: 'base_acucares', label: 'Açúc.', unit: 'g', color: '#9333ea' },
  { itemKey: 'gorduras_saturadas', baseKey: 'base_gorduras_saturadas', label: 'Sat.', unit: 'g', color: '#ef4444' },
  { itemKey: 'sodio', baseKey: 'base_sodio', label: 'Sódio', unit: 'mg', color: '#64748b' },
];

const mealTypeOptions = [
  'Cafe da Manha',
  'Lanche da Manha',
  'Almoco',
  'Lanche da Tarde',
  'Jantar',
  'Ceia',
  'Outro Momento',
];

function formatNutrient(value, suffix = '') {
  const normalized = Math.round((Number(value) || 0) * 10) / 10;
  return `${normalized.toFixed(1).replace('.0', '')}${suffix}`;
}

function formatEditableValue(value) {
  const numeric = Math.round((Number(value) || 0) * 10) / 10;
  return String(numeric).replace('.', ',').replace(',0', '');
}

function parseEditableValue(value) {
  const numeric = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function getMealTimingLabel(mode) {
  return mode === 'current' ? 'Refeicao atual' : 'Refeicao anterior';
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
    return 'Nao foi possivel analisar a foto.';
  }

  if (normalized.includes('non-2xx status code')) {
    return 'Servidor indisponivel. Tente de novo em instantes.';
  }

  if (
    normalized.includes('limite') ||
    normalized.includes('gemini') ||
    normalized.includes('quota')
  ) {
    return 'Limite da IA atingido. Use anexar sem IA ou adicione manualmente.';
  }

  return rawMessage;
}

function feedbackErroAnalise(error) {
  const detalhe = normalizeAnalysisErrorMessage(error);
  const texto = detalhe.toLowerCase();

  if (texto.includes('limite') || texto.includes('gemini') || texto.includes('quota')) {
    return {
      tipo: 'aviso',
      title: 'IA indisponivel agora',
      detail: 'Continuaremos no modo manual.',
    };
  }

  if (texto.includes('identificar') || texto.includes('reconhecer')) {
    return {
      tipo: 'aviso',
      title: 'Nao vimos alimentos na foto',
      detail: 'Outro angulo, mais luz, ou adicione manualmente.',
    };
  }

  return {
    tipo: 'erro',
    title: 'Analise nao concluida',
    detail: detalhe,
  };
}

function buildSelectedFoodSummary(item) {
  const quantity = formatNutrient(item?.quantidade_gramas);
  return `Tabela calculada para ${quantity}${getFoodQuantityUnit(item)}`;
}

function normalizeFoodText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const BEVERAGE_TERMS = [
  'bebida',
  'beverage',
  'drink',
  'suco',
  'refrigerante',
  'agua',
  'cha',
  'cafe',
  'leite',
  'isotonico',
  'energetico',
  'achocolatado',
  'vitamina',
  'smoothie',
];

function getFoodQuantityUnit(item) {
  const explicitUnit = normalizeFoodText(item?.unidade_quantidade || item?.unidade);
  if (explicitUnit === 'ml') {
    return 'ml';
  }

  if (/\bml\b/i.test(String(item?.porcao || item?.serving_size || ''))) {
    return 'ml';
  }

  const searchableText = normalizeFoodText(
    [item?.categoria, item?.category, item?.nome, item?.foodName, item?.nomeComercial].join(' ')
  );

  return BEVERAGE_TERMS.some((term) => searchableText.includes(term)) ? 'ml' : 'g';
}

function buildNutritionTableRows(item) {
  const rows = [
    { label: 'kcal', value: Math.round(Number(item?.calorias) || 0) },
    { label: 'Carbo', value: formatNutrient(item?.carboidratos, 'g') },
    { label: 'Prot.', value: formatNutrient(item?.proteinas, 'g') },
    { label: 'Gord.', value: formatNutrient(item?.gorduras, 'g') },
    { label: 'Fibras', value: formatNutrient(item?.fibras, 'g') },
    { label: 'Açúcares', value: formatNutrient(item?.acucares, 'g') },
    { label: 'Sat.', value: formatNutrient(item?.gorduras_saturadas, 'g') },
    { label: 'Sódio', value: `${Math.round(Number(item?.sodio) || 0)}mg` },
  ];

  if (Number(item?.acucares_adicionados) > 0) {
    rows.push({ label: 'Açúc. adic.', value: formatNutrient(item.acucares_adicionados, 'g') });
  }

  if (Number(item?.gordura_trans) > 0) {
    rows.push({ label: 'Trans', value: formatNutrient(item.gordura_trans, 'g') });
  }

  return rows;
}

function buildItemDraft(item) {
  return EDITABLE_ITEM_FIELDS.reduce(
    (values, field) => ({
      ...values,
      [field.itemKey]: formatEditableValue(item?.[field.itemKey]),
    }),
    {
      nome: String(item?.nome || '').trim(),
      quantidade_gramas: formatEditableValue(item?.quantidade_gramas),
    }
  );
}

function buildItemFromDraft(item, draft) {
  const quantidade = parseEditableValue(draft?.quantidade_gramas);
  const baseQuantity = Number(item?.base_quantidade_gramas) > 0 ? Number(item.base_quantidade_gramas) : 100;
  const nextItem = {
    ...item,
    nome: String(draft?.nome || item?.nome || 'Alimento').trim(),
    quantidade_gramas: quantidade,
    base_quantidade_gramas: baseQuantity,
  };

  EDITABLE_ITEM_FIELDS.forEach((field) => {
    const value = parseEditableValue(draft?.[field.itemKey]);
    const baseValue = quantidade > 0 ? Math.round((value / (quantidade / baseQuantity)) * 10) / 10 : value;
    nextItem[field.itemKey] = value;
    nextItem[field.baseKey] = baseValue;
  });

  return criarAlimentoEditavel(nextItem);
}

function getFoodSuggestionMeta(item) {
  if (item?.ajusteNutricionalAprendido) {
    return `Ajuste aprendido · ${item.ajusteNutricionalRegistros || 1} registro(s)`;
  }

  if (item?.origem === 'rotulo') {
    const brand = String(item?.brands || item?.marca || '').trim();
    return brand ? `Rótulo real · ${brand}` : 'Rótulo real · tabela da marca';
  }

  if (item?.buscaInteligente && item?.nomeTacoReferencia) {
    return `Sugestão baseada em: ${item.nomeTacoReferencia}`;
  }

  if (item?.origem === 'industrializado') {
    return 'Produto local · valores aproximados';
  }

  return '';
}

function getFoodSuggestionCalories(item) {
  return Math.round(Number(item?.calorias ?? item?.base_calorias) || 0);
}

export default function RegistroRefeicaoIA({ navigation, route, usuarioLogado: usuarioProp }) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const [mealTimingChoiceVisible, setMealTimingChoiceVisible] = useState(true);
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
  const [statusFoto, setStatusFoto] = useState(null);
  const [loadingAction, setLoadingAction] = useState('');
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const [foodSearch, setFoodSearch] = useState('');
  const [foodSearchLimit, setFoodSearchLimit] = useState(FOOD_SEARCH_PAGE_SIZE);
  const [foodSearchRemoteItems, setFoodSearchRemoteItems] = useState([]);
  const [foodSearchRemoteBusy, setFoodSearchRemoteBusy] = useState(false);
  const [mealGlucoseValue, setMealGlucoseValue] = useState('');
  const [savingMealGlucose, setSavingMealGlucose] = useState(false);
  const [aprendizadoNutricional, setAprendizadoNutricional] = useState({});
  const [editingFoodIndex, setEditingFoodIndex] = useState(null);
  const [editingFoodDraft, setEditingFoodDraft] = useState(null);

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
  const hasMealType = Boolean(mealType);
  const hasMealContent = hasFoods || hasSelectedImage;
  const canSaveMeal = hasMealType && hasMealContent && !isBusy;

  function solicitarTipoRefeicao() {
    setMealTypeMenuVisible(false);
    setMealTimingDetailsVisible(true);
    mostrarToast(
      'aviso',
      'Tipo obrigatorio',
      'Selecione o tipo da refeicao para continuar.'
    );
    return false;
  }

  function exigirTipoRefeicao() {
    if (hasMealType) {
      return true;
    }

    return solicitarTipoRefeicao();
  }

  function tentarFecharDetalhesRefeicao() {
    if (!hasMealType) {
      mostrarToast(
        'aviso',
        'Tipo obrigatorio',
        'Selecione o tipo da refeicao para continuar.'
      );
      return;
    }

    setMealTypeMenuVisible(false);
    setMealTimingDetailsVisible(false);
  }

  function mostrarAvisoTopo({ tipo = 'aviso', titulo, detalhe = '' }) {
    setToast(null);
    setStatusFoto({
      tipo,
      title: titulo,
      detail: detalhe,
    });
  }

  function mostrarToast(tipo, texto, detalhe = '') {
    mostrarAvisoTopo({ tipo, titulo: texto, detalhe });
  }

  function fecharNotificacaoTopo() {
    setStatusFoto(null);
    setToast(null);
  }

  function mostrarFotoSelecionada(origem) {
    const detalhe =
      origem === 'camera'
        ? 'Foto da camera pronta. Analise com IA ou anexe sem IA.'
        : 'Foto da galeria pronta. Analise com IA ou anexe sem IA.';

    mostrarAvisoTopo({
      tipo: 'info',
      titulo: 'Foto selecionada',
      detalhe,
    });
  }

  const notificacaoTopo = useMemo(() => {
    if (loadingAction === 'upload') {
      return {
        tipo: 'processando',
        texto: 'Enviando foto...',
        subtexto: 'Preparando imagem para a refeicao',
        carregando: true,
      };
    }

    if (loadingAction === 'analysis') {
      return {
        tipo: 'info',
        texto: 'Analisando com IA...',
        subtexto: 'Identificando alimentos na foto',
        carregando: true,
      };
    }

    if (loadingAction === 'save') {
      return {
        tipo: 'processando',
        texto: 'Salvando refeicao...',
        subtexto: 'Registrando alimentos e nutrientes',
        carregando: true,
      };
    }

    if (statusFoto?.title) {
      return {
        tipo: statusFoto.tipo || 'aviso',
        texto: statusFoto.title,
        subtexto: statusFoto.detail || '',
        carregando: false,
      };
    }

    if (toast?.texto) {
      return {
        tipo: toast.tipo || 'aviso',
        texto: toast.texto,
        subtexto: '',
        carregando: false,
      };
    }

    return null;
  }, [loadingAction, statusFoto, toast]);

  const summaryMetrics = useMemo(
    () => [
      { label: 'kcal', value: Math.round(Number(totais.calorias_total) || 0), color: '#111827' },
      { label: 'Carbo', value: formatNutrient(totais.carboidratos_total), color: '#2563eb' },
      { label: 'Prot', value: formatNutrient(totais.proteinas_total), color: '#f97316' },
      { label: 'Gord', value: formatNutrient(totais.gorduras_total), color: '#ef4444' },
      { label: 'Fibra', value: formatNutrient(totais.fibras_total), color: '#16a34a' },
      { label: 'Açúc.', value: formatNutrient(totais.acucares_total), color: '#9333ea' },
      { label: 'Sódio', value: Math.round(Number(totais.sodio_total) || 0), unit: 'mg', color: '#64748b' },
    ],
    [totais]
  );

  useEffect(() => {
    setFoodSearchLimit(FOOD_SEARCH_PAGE_SIZE);
  }, [foodSearch]);

  useEffect(() => {
    let mounted = true;

    carregarAprendizadoNutricional().then((dados) => {
      if (mounted) {
        setAprendizadoNutricional(dados);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const foodSearchQuery = String(foodSearch || '').trim();
  const foodSearchAtivo = foodSearchQuery.length >= FOOD_SEARCH_MIN_CHARS;

  useEffect(() => {
    let isActive = true;
    let debounceTimer = null;

    if (!foodSearchAtivo) {
      setFoodSearchRemoteItems([]);
      setFoodSearchRemoteBusy(false);
      return () => {};
    }

    setFoodSearchRemoteBusy(true);
    debounceTimer = setTimeout(() => {
      buscarProdutosRotuloBrasil(foodSearchQuery, { limit: 10, page: 1 })
        .then((result) => {
          if (!isActive) return;
          setFoodSearchRemoteItems(Array.isArray(result?.items) ? result.items : []);
        })
        .catch(() => {
          if (!isActive) return;
          setFoodSearchRemoteItems([]);
        })
        .finally(() => {
          if (!isActive) return;
          setFoodSearchRemoteBusy(false);
        });
    }, 350);

    return () => {
      isActive = false;
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [foodSearchAtivo, foodSearchQuery]);

  const foodSearchResult = useMemo(() => {
    if (!foodSearchAtivo) {
      return { items: [], total: 0, hasMore: false };
    }

    return buscarAlimentosBrasil(foodSearchQuery, { limit: foodSearchLimit, offset: 0 });
  }, [foodSearchAtivo, foodSearchQuery, foodSearchLimit]);

  const filteredSuggestions = useMemo(() => {
    const localItems = Array.isArray(foodSearchResult.items) ? foodSearchResult.items : [];
    const remoteItems = Array.isArray(foodSearchRemoteItems) ? foodSearchRemoteItems : [];

    const seen = new Set();
    const merged = [];

    remoteItems.forEach((item) => {
      const key = String(item?.code ?? item?.nome ?? item?.id ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(aplicarAprendizadoNutricional(item, aprendizadoNutricional));
    });

    localItems.forEach((item) => {
      const key = String(item?.nome ?? item?.id ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(aplicarAprendizadoNutricional(item, aprendizadoNutricional));
    });

    return merged;
  }, [aprendizadoNutricional, foodSearchResult.items, foodSearchRemoteItems]);
  const foodSearchSummary = useMemo(() => {
    if (!foodSearchQuery) {
      return `Mín. ${FOOD_SEARCH_MIN_CHARS} letras · ex.: arroz, frango, salada`;
    }

    if (!foodSearchAtivo) {
      return 'Digite mais 1 letra.';
    }

    if (!foodSearchResult.total && !foodSearchRemoteItems.length && !foodSearchRemoteBusy) {
      return `Nada para "${foodSearchQuery}".`;
    }

    if (foodSearchResult.searchHint) {
      return foodSearchResult.searchHint;
    }

    const localTotal = Number(foodSearchResult.total) || 0;
    const remoteTotal = foodSearchRemoteItems.length;
    const total = localTotal + remoteTotal;

    if (foodSearchRemoteBusy) {
      return `${Math.max(0, total)} resultado(s) · buscando rótulos...`;
    }

    return `${Math.max(0, total)} resultado(s)`;
  }, [foodSearchQuery, foodSearchAtivo, foodSearchResult, foodSearchRemoteItems.length, foodSearchRemoteBusy]);

  function fecharEscolhaHorarioEVoltar() {
    setPendingMealAction(null);
    setMealTimingChoiceVisible(false);

    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('PacienteDiario', { usuarioLogado });
  }

  function abrirEdicaoHorarioRefeicao() {
    setMealTypeMenuVisible(false);
    setMealTimingDetailsVisible(true);
  }

  function abrirOpcoesFoto() {
    if (isBusy) return;
    if (!exigirTipoRefeicao()) return;
    setPhotoOptionsVisible(true);
  }

  function fecharOpcoesFoto() {
    setPhotoOptionsVisible(false);
  }

  async function processarFotoComFallback(imagem, origem) {
    if (!imagem?.uri) return;

    setSelectedImage(imagem);
    setUploadedImage(null);
    setAlimentos([]);
    setAnalysisMeta(null);

    if (origem) {
      mostrarFotoSelecionada(origem);
    }

    if (!patientId) {
      mostrarToast('aviso', 'Sessao expirada', 'Faca login novamente no app.');
      return;
    }

    setStatusFoto(null);
    setLoadingAction('upload');

    try {
      const upload = await uploadImagemRefeicaoIA({
        asset: imagem,
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
            'Nao foi possivel identificar alimentos nesta foto. Continue preenchendo manualmente.'
        );
      }

      setAlimentos(itens);
      setAnalysisMeta({
        source: response.source || 'gemini-vision',
        imageId: response.imageId || null,
      });
      mostrarAvisoTopo({
        tipo: 'sucesso',
        titulo: `${itens.length} alimento(s) pela IA`,
        detalhe: 'Confira porcoes (g) e ajuste se precisar.',
      });
    } catch (error) {
      console.log('Falha na IA, seguindo manual:', error);
      setAnalysisMeta({
        source: 'foto-manual',
        imageId: null,
      });

      const feedback = feedbackErroAnalise(error);
      mostrarAvisoTopo({
        tipo: feedback.tipo || 'aviso',
        titulo: feedback.title || 'IA indisponivel',
        detalhe: 'Foto anexada. Continue adicionando os alimentos na lista.',
      });
    } finally {
      setLoadingAction('');
    }
  }

  async function escolherDaGaleria({ fecharModal = false } = {}) {
    if (isBusy) {
      return;
    }

    try {
      const imagem = await escolherImagemRefeicaoDaGaleria();

      if (fecharModal) {
        fecharOpcoesFoto();
      }

      if (!imagem) {
        return;
      }

      await processarFotoComFallback(imagem, 'galeria');
    } catch (error) {
      if (fecharModal) {
        fecharOpcoesFoto();
      }

      mostrarAvisoTopo({
        tipo: 'erro',
        titulo: 'Galeria indisponivel',
        detalhe: error?.message || 'Nao foi possivel abrir a galeria.',
      });
    }
  }

  async function tirarFoto({ fecharModal = false } = {}) {
    if (isBusy) {
      return;
    }

    if (Platform.OS === 'web') {
      if (fecharModal) {
        fecharOpcoesFoto();
      }

      mostrarAvisoTopo({
        tipo: 'aviso',
        titulo: 'Use a galeria no navegador',
        detalhe: 'No computador, escolha a foto pelo botao Galeria.',
      });
      return;
    }

    try {
      const imagem = await tirarFotoRefeicao();

      if (fecharModal) {
        fecharOpcoesFoto();
      }

      if (!imagem) {
        return;
      }

      await processarFotoComFallback(imagem, 'camera');
    } catch (error) {
      if (fecharModal) {
        fecharOpcoesFoto();
      }

      mostrarAvisoTopo({
        tipo: 'erro',
        titulo: 'Camera indisponivel',
        detalhe: error?.message || 'Nao foi possivel abrir a camera.',
      });
    }
  }

  function atualizarCampo(index, field, value) {
    setAlimentos((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item;
        }

        if (field === 'quantidade_gramas') {
          const raw = Number(String(value).replace(',', '.'));
          const quantidade = Number.isFinite(raw) ? raw : 0;

          return {
            ...criarAlimentoEditavel({
              ...item,
              id: item.id,
              quantidade_gramas: quantidade,
            }),
            quantidade_gramas: quantidade,
          };
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

  function adicionarItemManual(nomeSugerido, { limparBusca = true } = {}) {
    if (!exigirTipoRefeicao()) {
      return;
    }

    const nomeDigitado = String(nomeSugerido ?? foodSearchQuery ?? '').trim();
    const nome = nomeDigitado || 'Novo alimento';
    const alimentoManual = criarAlimentoEditavel({
      nome,
      categoria: 'Ajuste manual',
    });
    const unidadeQuantidade = getFoodQuantityUnit(alimentoManual);

    setAlimentos((current) => [
      ...current,
      alimentoManual,
    ]);

    if (limparBusca) {
      setFoodSearch('');
    }

    mostrarAvisoTopo({
      tipo: 'sucesso',
      titulo: 'Adicionado como digitado',
      detalhe: `${nome} · ajuste a quantidade (${unidadeQuantidade}) na lista.`,
    });
  }

  function adicionarTextoDigitadoBusca() {
    if (!foodSearchQuery || isBusy) {
      return;
    }

    adicionarItemManual(foodSearchQuery, { limparBusca: true });
  }

  function abrirModalItem(index) {
    const item = alimentos[index];
    if (!item) return;
    setEditingFoodIndex(index);
    setEditingFoodDraft(buildItemDraft(item));
  }

  function fecharModalItem() {
    setEditingFoodIndex(null);
    setEditingFoodDraft(null);
  }

  function atualizarDraftItem(field, value) {
    setEditingFoodDraft((current) => ({
      ...(current || {}),
      [field]: field === 'nome' ? value : value.replace(/[^0-9,.]/g, ''),
    }));
  }

  function salvarModalItem() {
    if (editingFoodIndex === null || !editingFoodDraft) {
      fecharModalItem();
      return;
    }

    setAlimentos((current) =>
      current.map((item, index) =>
        index === editingFoodIndex ? buildItemFromDraft(item, editingFoodDraft) : item
      )
    );
    fecharModalItem();
  }

  async function adicionarSugestao(item) {
    if (!exigirTipoRefeicao()) {
      return;
    }

    const itemComAprendizado = aplicarAprendizadoNutricional(item, aprendizadoNutricional);
    const isApproximateMarketProduct =
      itemComAprendizado?.origem === 'industrializado' ||
      itemComAprendizado?.buscaInteligente ||
      itemComAprendizado?.origem === 'taco';
    let itemResolvido = itemComAprendizado;
    let usouRotuloReal = itemComAprendizado?.origem === 'rotulo';

    if (isApproximateMarketProduct && !itemComAprendizado?.ajusteNutricionalAprendido) {
      setLoadingAction('rotulo-real');
      const consulta = [itemComAprendizado?.nomeComercial, itemComAprendizado?.nome, itemComAprendizado?.brands, itemComAprendizado?.marca]
        .filter(Boolean)
        .join(' ');
      const rotuloReal = await buscarMelhorProdutoRotuloBrasil(consulta);

      if (rotuloReal) {
        itemResolvido = aplicarAprendizadoNutricional(rotuloReal, aprendizadoNutricional);
        usouRotuloReal = true;
      }
    }

    try {
      const fonte = materializarAlimentoDaBusca(itemResolvido);
      const refTacoId = itemResolvido.buscaInteligente
        ? itemResolvido.refTacoId
        : itemResolvido.refTacoId ?? (itemResolvido.origem === 'taco' ? itemResolvido.id : null);
      const nomeExibicao = itemResolvido.buscaInteligente
        ? itemResolvido.nomeComercial || itemResolvido.nome
        : itemResolvido.nome;
      const referenciaLabel =
        itemResolvido.nomeTacoReferencia ||
        itemResolvido.referenciaTacoNome ||
        fonte.referenciaTacoNome ||
        (itemResolvido.origem === 'taco' ? itemResolvido.nome : null);
      const unidadeQuantidade = getFoodQuantityUnit(fonte);

      setAlimentos((current) => [
        ...current,
        {
          ...criarAlimentoEditavel({
            ...fonte,
            id: undefined,
            nome: nomeExibicao,
            refTacoId: refTacoId || null,
            nomeTacoReferencia: referenciaLabel,
          }),
          unidade_quantidade: unidadeQuantidade,
        },
      ]);

      setFoodSearch('');

      const detalheReferencia =
        !usouRotuloReal && itemResolvido.buscaInteligente && referenciaLabel
          ? ` · sugestão baseada em: ${referenciaLabel}`
          : '';

      mostrarAvisoTopo({
        tipo: usouRotuloReal || itemResolvido?.ajusteNutricionalAprendido ? 'sucesso' : 'aviso',
        titulo: itemResolvido?.ajusteNutricionalAprendido
          ? 'Ajuste aprendido aplicado'
          : usouRotuloReal
            ? 'Rótulo real adicionado'
            : 'Adicionado com aproximação',
        detalhe: itemResolvido?.ajusteNutricionalAprendido
          ? `${nomeExibicao} · usando média dos seus registros anteriores.`
          : usouRotuloReal
          ? `${nomeExibicao} · tabela nutricional da marca.`
          : `${nomeExibicao}${detalheReferencia} · rótulo real não encontrado.`,
      });
    } finally {
      setLoadingAction('');
    }
  }

  function removerItem(index) {
    const removido = alimentos[index];
    const nomeRemovido = String(removido?.nome || '').trim();

    setAlimentos((current) => current.filter((_, currentIndex) => currentIndex !== index));

    mostrarAvisoTopo({
      tipo: 'remocao',
      titulo: 'Item removido',
      detalhe: nomeRemovido
        ? `${nomeRemovido} saiu da lista`
        : 'Voce pode adicionar outro alimento.',
    });
  }

  async function sincronizarTimeline(entry) {
    try {
      invalidatePatientExperienceCache(patientId);

      const experience = await fetchPatientExperience(patientId, {
        patientContext: usuarioLogado,
        forceRefresh: true,
        ...mesclarLimitesDadosPaciente('diario'),
      });
      const recordId = String(entry?.databaseId || '').trim();
      const entryId = String(entry?.id || '').trim();
      const currentEntries = experience.appState?.mealEntries || [];
      const alreadyPresent = currentEntries.some((item) => {
        const itemDbId = String(item?.databaseId || '').trim();
        const itemId = String(item?.id || '').trim();
        if (recordId && (itemDbId === recordId || itemId === `meal-ia-${recordId}`)) {
          return true;
        }
        return entryId && itemId === entryId;
      });

      const planSections = resolvePlanSections({ appState: experience.appState });
      const timelineEntry = enrichMealEntryWithPlanLink(
        {
          ...entry,
          databaseId: recordId || entry?.databaseId || null,
          storageOrigin: entry?.storageOrigin || 'database',
        },
        planSections
      );
      const nextState = alreadyPresent
        ? experience.appState
        : {
            ...experience.appState,
            mealEntries: appendNewestEntry(currentEntries, timelineEntry),
          };

      const canonicalId = experience.patient?.id_paciente_uuid || patientId;

      await savePatientAppState({
        patientId: canonicalId,
        objectiveText: experience.clinicalObjective,
        appState: nextState,
        currentPatient: experience.patient,
        patientContext: usuarioLogado,
      });
      invalidatePatientExperienceCache(canonicalId);
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
      mostrarToast('aviso', 'Glicose invalida', 'Informe um valor maior que zero em mg/dL.');
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
      mostrarAvisoTopo({
        tipo: 'sucesso',
        titulo: 'Glicose registrada',
        detalhe: `${parsedValue} mg/dL · antes da refeicao`,
      });
      continueAfterMealGlucose();
    } catch (error) {
      console.log('Erro ao salvar glicemia no fluxo da refeicao:', error);
      mostrarAvisoTopo({
        tipo: 'erro',
        titulo: 'Glicose nao salva',
        detalhe: 'Continue sem ela ou tente de novo.',
      });
    } finally {
      setSavingMealGlucose(false);
    }
  }

  function handleConfirmMealTiming() {
    if (!canConfirmMealTiming) {
      mostrarToast(
        'aviso',
        'Dados incompletos',
        mealTimingMode === 'current'
          ? 'Selecione o tipo da refeicao.'
          : 'Informe tipo, data e hora da refeicao.'
      );
      return;
    }

    setMealTimingChoiceVisible(false);
    setMealTimingDetailsVisible(false);
    setMealTypeMenuVisible(false);

    mostrarAvisoTopo({
      tipo: 'info',
      titulo: 'Refeicao configurada',
      detalhe: `${mealType} · ${mealTimingDate} ${mealTimingTime}`,
    });

    runPendingMealAction();
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

  function openNutritionistChat() {
    navigation.navigate('PacienteChatNutricionista', {
      usuarioLogado,
    });
  }

  async function confirmarSalvar() {
    if (!exigirTipoRefeicao()) {
      return;
    }

    if (!hasMealContent) {
      mostrarToast(
        'aviso',
        'Refeicao incompleta',
        'Adicione itens na lista ou anexe uma foto da refeicao.'
      );
      return;
    }

    if (!patientId) {
      mostrarToast('aviso', 'Sessao expirada', 'Faca login novamente no app.');
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

      let fotoUrl = uploadedImage?.storagePath || null;

      if (!fotoUrl && selectedImage?.uri) {
        const upload = await uploadImagemRefeicaoIA({
          asset: selectedImage,
          patientId,
        });
        setUploadedImage(upload);
        fotoUrl = upload.storagePath;
      }

      const alimentosParaSalvar = alimentos.map((item) => criarAlimentoEditavel(item));
      const aprendizadoAtualizado = await registrarAprendizadoNutricional(alimentosParaSalvar);
      setAprendizadoNutricional(aprendizadoAtualizado);

      const saved = await salvarRefeicaoIA({
        patientId,
        fotoUrl,
        alimentos: alimentosParaSalvar,
        confirmado: true,
        createdAt,
        mealLabel: mealType,
        mealTypeLabel: mealType,
      });

      const recordId = String(saved.record?.id || '').trim();
      const timelineEntry = {
        ...buildMealTimelineEntryFromAI({
          alimentos: saved.foods,
          totais: saved.totals,
          date: effectiveDate,
          time: effectiveTime,
          mealLabel: mealType,
        }),
        id: recordId ? `meal-ia-${recordId}` : `meal-ia-${Date.now()}`,
        databaseId: recordId || null,
        storageOrigin: 'database',
      };

      await sincronizarTimeline(timelineEntry);

      navigation.navigate('PacienteDiario', {
        usuarioLogado,
        mealEntryIA: timelineEntry,
        mealIARefreshToken: Date.now(),
        mealDataRefresh: Date.now(),
      });
    } catch (error) {
      console.log('Erro ao salvar refeicao IA:', error);
      mostrarAvisoTopo({
        tipo: 'erro',
        titulo: 'Refeicao nao salva',
        detalhe: error?.message || 'Verifique a conexao e tente de novo.',
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
      topOverlay={
        notificacaoTopo ? (
          <ToastPaciente
            posicao="top"
            tipo={notificacaoTopo.tipo}
            texto={notificacaoTopo.texto}
            subtexto={notificacaoTopo.subtexto}
            carregando={notificacaoTopo.carregando}
            onFechar={fecharNotificacaoTopo}
            autoOcultarMs={notificacaoTopo.carregando ? 0 : NOTIFICACAO_AUTO_MS}
          />
        ) : null
      }
      footerOverlay={
        <View style={styles.footerStack}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              !canSaveMeal && styles.saveButtonDisabled,
              isBusy && styles.saveButtonBusy,
            ]}
            onPress={() => {
              if (!canSaveMeal) return;
              confirmarSalvar();
            }}
            activeOpacity={canSaveMeal ? 0.88 : 1}
            accessibilityState={{ disabled: !canSaveMeal }}
          >
            {loadingAction === 'save' ? (
              <ActivityIndicator color={patientTheme.colors.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Refeição</Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <Modal
        visible={mealTimingChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharEscolhaHorarioEVoltar}
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
                    onPress={fecharEscolhaHorarioEVoltar}
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
        onRequestClose={tentarFecharDetalhesRefeicao}
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
                    onPress={tentarFecharDetalhesRefeicao}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalText}>
                  Informe o tipo, a data e a hora da refeicao. O tipo e obrigatorio.
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

      <Modal
        visible={photoOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharOpcoesFoto}
      >
        <View style={styles.overlayLayer}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Anexar foto</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={fecharOpcoesFoto}
                >
                  <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.photoPickerOptions}>
                <TouchableOpacity
                  style={styles.photoPickerOption}
                  onPress={() => void tirarFoto({ fecharModal: true })}
                  disabled={isBusy}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera-outline" size={20} color={patientTheme.colors.primary} />
                  <Text style={styles.photoPickerOptionText}>Câmera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photoPickerOption}
                  onPress={() => void escolherDaGaleria({ fecharModal: true })}
                  disabled={isBusy}
                  activeOpacity={0.85}
                >
                  <Ionicons name="image-outline" size={20} color={patientTheme.colors.primary} />
                  <Text style={styles.photoPickerOptionText}>Galeria</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        style={styles.mealTypeCard}
        onPress={abrirEdicaoHorarioRefeicao}
        activeOpacity={0.88}
      >
        <View style={styles.mealTypeCardContent}>
          <View style={styles.mealTypeCardTextCol}>
            <Text style={styles.mealTypeCardTitle}>Tipo de refeição</Text>
            <Text style={[styles.mealTypeCardValue, !mealType && styles.typeSelectorPlaceholder]}>
              {mealType || 'Selecione...'}
            </Text>
            <Text style={styles.mealTypeCardMeta} numberOfLines={1}>
              {getMealTimingLabel(mealTimingMode)} · {mealTimingDate} · {mealTimingTime}
            </Text>
          </View>
          <View style={styles.mealTypeCardChevron}>
            <Ionicons name="chevron-forward" size={16} color={patientTheme.colors.textMuted} />
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.photoCard}>
        <TouchableOpacity
          style={styles.photoDropzone}
          onPress={abrirOpcoesFoto}
          activeOpacity={0.88}
        >
          {selectedImage?.uri ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={48} color={patientTheme.colors.primary} />
              <Text style={styles.photoDropzoneTitle}>Anexar foto da refeição</Text>
              <Text style={styles.photoDropzoneText}>Toque aqui para escolher câmera ou galeria</Text>
            </>
          )}
        </TouchableOpacity>

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

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={patientTheme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar alimento"
            placeholderTextColor="#9aa1a8"
            value={foodSearch}
            onChangeText={setFoodSearch}
            returnKeyType="done"
            onSubmitEditing={adicionarTextoDigitadoBusca}
            blurOnSubmit
          />
          {foodSearch ? (
            <TouchableOpacity
              onPress={() => setFoodSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Limpar busca"
            >
              <Ionicons name="close-circle" size={18} color={patientTheme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.cardHint} numberOfLines={1}>
          {foodSearchSummary}
        </Text>

        {foodSearchAtivo ? (
          <TouchableOpacity
            style={[styles.usarDigitadoButton, isBusy && styles.buttonDisabled]}
            onPress={adicionarTextoDigitadoBusca}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={16} color={patientTheme.colors.primary} />
            <Text style={styles.usarDigitadoButtonText} numberOfLines={2}>
              Usar o que digitei: "{foodSearchQuery}"
            </Text>
            <Ionicons name="arrow-forward" size={16} color={patientTheme.colors.primary} />
          </TouchableOpacity>
        ) : null}

        {foodSearchAtivo && filteredSuggestions.length ? (
          <ScrollView
            style={[styles.suggestionListScroll, { maxHeight: FOOD_SEARCH_LIST_MAX_HEIGHT }]}
            contentContainerStyle={styles.suggestionList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {filteredSuggestions.map((item) => (
              <TouchableOpacity
                key={`taco-${item.id}`}
                style={[
                  styles.suggestionRowCompact,
                  item.buscaInteligente && styles.suggestionRowDestaque,
                ]}
                onPress={() => adicionarSugestao(item)}
                disabled={isBusy}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionTextCol}>
                  <Text
                    style={[
                      styles.suggestionNameCompact,
                      item.buscaInteligente && styles.suggestionNameDestaque,
                    ]}
                    numberOfLines={2}
                  >
                    {item.nome}
                  </Text>
                  {getFoodSuggestionMeta(item) ? (
                    <Text style={styles.suggestionRefTaco} numberOfLines={1}>
                      {getFoodSuggestionMeta(item)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.suggestionKcalCompact}>{getFoodSuggestionCalories(item)} kcal</Text>
                <View
                  style={[
                    styles.suggestionAddButtonCompact,
                    item.buscaInteligente && styles.suggestionAddButtonDestaque,
                  ]}
                >
                  <Ionicons name="add" size={16} color={patientTheme.colors.primary} />
                </View>
              </TouchableOpacity>
            ))}

            {foodSearchResult.hasMore ? (
              <TouchableOpacity
                style={styles.loadMoreFoodsButton}
                onPress={() => setFoodSearchLimit((current) => current + FOOD_SEARCH_PAGE_SIZE)}
              >
                <Text style={styles.loadMoreFoodsText}>
                  Ver mais ({filteredSuggestions.length}/{foodSearchResult.total})
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : null}

        {foodSearchAtivo && !filteredSuggestions.length ? (
          <View style={styles.emptySuggestionState}>
            <Text style={styles.emptySuggestionText}>
              Nenhum resultado para "{foodSearchQuery}". Toque em "Usar o que digitei" acima.
            </Text>
          </View>
        ) : null}

        <View style={styles.selectedListDivider} />

        {hasFoods ? (
          <View style={styles.selectedList}>
            {alimentos.map((item, index) => (
              <TouchableOpacity
                key={item.id || `${item.nome}-${index}`}
                style={styles.selectedItemRow}
                onPress={() => abrirModalItem(index)}
                activeOpacity={0.82}
              >
                <View style={styles.selectedItemContent}>
                  <View style={styles.selectedItemInfo}>
                    <Text style={styles.selectedItemName} numberOfLines={1}>
                      {item.nome || 'Nome do alimento'}
                    </Text>
                    <Text style={styles.selectedItemSummary} numberOfLines={2}>
                      {buildSelectedFoodSummary(item)}
                    </Text>
                  </View>
                  <View style={styles.selectedItemActions}>
                    <View style={styles.quantityGroup}>
                      <Text style={styles.quantityLabel}>Qtd</Text>
                      <Text style={styles.quantityInput}>{String(item.quantidade_gramas ?? 0)}</Text>
                      <Text style={styles.quantityUnit}>{getFoodQuantityUnit(item)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeItemButton}
                      onPress={() => removerItem(index)}
                      disabled={isBusy}
                    >
                      <Ionicons name="trash-outline" size={12} color="#b75c5c" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.selectedItemNutritionGrid}>
                  {buildNutritionTableRows(item).map((nutrient) => (
                    <View key={nutrient.label} style={styles.selectedItemNutritionPill}>
                      <Text style={styles.selectedItemNutritionLabel}>{nutrient.label}</Text>
                      <Text style={styles.selectedItemNutritionValue}>{nutrient.value}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptySelectedState}>
            <Text style={styles.emptySelectedTitle}>Nenhum item na lista ainda</Text>
            <Text style={styles.emptySelectedText}>
              Busque um alimento (ex.: arroz, frango, salada) ou analise uma foto com IA
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumo Nutricional</Text>
        <View style={styles.summaryStatsRow}>
          {summaryMetrics.map((item) => (
            <View key={item.label} style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatValue, { color: item.color }]}>
                {item.value}
                {item.unit ? <Text style={styles.summaryStatValueUnit}>{item.unit}</Text> : null}
              </Text>
              <Text style={styles.summaryStatLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.mealQuestionButton}
          onPress={openNutritionistChat}
          activeOpacity={0.88}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={patientTheme.colors.primaryDark} />
          <Text style={styles.mealQuestionButtonText}>Dúvida sobre esta refeição?</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={editingFoodIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={fecharModalItem}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        >
          <View style={[styles.modalCard, styles.foodEditModalCard]}>
            <View style={styles.modalHeader}>
              <View style={styles.foodEditTitleCol}>
                <Text style={styles.modalTitle}>Editar item</Text>
                <Text style={styles.modalSubtitle}>Ajuste os dados deste alimento</Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseButton, styles.foodEditCloseButton]}
                onPress={fecharModalItem}
              >
                <Ionicons name="close" size={18} color={patientTheme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.foodEditModalScroll}
              contentContainerStyle={styles.foodEditModalContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.modalFieldLabel, styles.foodEditLabel]}>Nome do item</Text>
              <TextInput
                style={[styles.input, styles.foodEditNameInput]}
                value={editingFoodDraft?.nome || ''}
                onChangeText={(value) => atualizarDraftItem('nome', value)}
                placeholder="Nome do alimento"
                placeholderTextColor="#8a9095"
              />

              <View style={styles.foodEditGrid}>
                <View style={styles.foodEditField}>
                  <Text style={[styles.modalFieldLabel, styles.foodEditLabel]}>
                    Quantidade ({getFoodQuantityUnit(alimentos[editingFoodIndex] || {})})
                  </Text>
                  <TextInput
                    style={[styles.input, styles.foodEditInput]}
                    value={editingFoodDraft?.quantidade_gramas || ''}
                    onChangeText={(value) => atualizarDraftItem('quantidade_gramas', value)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                </View>

                {EDITABLE_ITEM_FIELDS.map((field) => (
                  <View key={field.itemKey} style={styles.foodEditField}>
                    <Text style={[styles.modalFieldLabel, styles.foodEditLabel]}>
                      {field.label}{field.unit ? ` (${field.unit})` : ''}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.foodEditInput]}
                      value={editingFoodDraft?.[field.itemKey] || ''}
                      onChangeText={(value) => atualizarDraftItem(field.itemKey, value)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.foodEditActions}>
              <TouchableOpacity style={styles.foodEditCancelButton} onPress={fecharModalItem}>
                <Text style={styles.foodEditCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.foodEditSaveButton} onPress={salvarModalItem}>
                <Text style={styles.foodEditSaveText}>Salvar item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginBottom: 16,
    ...patientShadow,
    borderColor: patientTheme.colors.border,
  },
  selectedListDivider: {
    marginTop: 8,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
  },
  mealTypeCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 0,
  },
  mealTypeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealTypeCardTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  mealTypeCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mealTypeCardValue: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  mealTypeCardMeta: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  mealTypeCardChevron: {
    width: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginBottom: 16,
    borderWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: patientTheme.colors.text,
  },
  cardHint: {
    marginTop: 3,
    marginBottom: 1,
    fontSize: 11,
    lineHeight: 14,
    color: patientTheme.colors.textMuted,
  },
  typeSelector: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  typeSelectorCompact: {
    minHeight: 48,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  typeSelectorValueCompact: {
    color: patientTheme.colors.text,
    fontSize: 13,
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
  typeSelectorMetaCompact: {
    marginTop: 3,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  photoCard: {
    marginBottom: 16,
  },
  photoDropzone: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: PHOTO_DROPZONE_HEIGHT,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  photoDropzoneTitle: {
    marginTop: 12,
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
    backgroundColor: '#fff',
    borderRadius: patientTheme.radius.md,
    height: PHOTO_DROPZONE_HEIGHT - 24,
    width: '100%',
  },
  photoPickerOptions: {
    gap: 10,
    marginTop: 10,
  },
  photoPickerOption: {
    minHeight: 46,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  photoPickerOptionText: {
    color: patientTheme.colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  photoSecondaryFull: {
    flex: 0,
    width: '100%',
    marginTop: 10,
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
    fontWeight: '600',
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
    fontWeight: '700',
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
    marginTop: 0,
    minHeight: 40,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#ffffff',
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
    paddingVertical: 8,
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          outlineWidth: 0,
        }
      : null),
  },
  usarDigitadoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: patientTheme.radius.md,
    borderWidth: 1.5,
    borderColor: patientTheme.colors.primary,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  usarDigitadoButtonText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: patientTheme.colors.primaryDark,
  },
  suggestionListScroll: {
    marginTop: 6,
  },
  suggestionList: {
    gap: 4,
    paddingBottom: 2,
  },
  loadMoreFoodsButton: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.md,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  loadMoreFoodsText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: patientTheme.radius.md,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  suggestionRowDestaque: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.border,
    borderWidth: 1,
  },
  suggestionTextCol: {
    flex: 1,
    gap: 2,
  },
  suggestionNameCompact: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionNameDestaque: {
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  suggestionRefTaco: {
    fontSize: 10,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
  },
  suggestionKcalCompact: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionAddButtonCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
  },
  suggestionAddButtonDestaque: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  emptySuggestionState: {
    marginTop: 6,
    paddingVertical: 8,
    gap: 8,
  },
  emptySuggestionText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  manualAddProminentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  manualAddProminentText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
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
    marginBottom: 10,
  },
  selectedBadge: {
    backgroundColor: patientTheme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  selectedList: {
    marginTop: 14,
    gap: 6,
  },
  selectedItemRow: {
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: patientTheme.colors.primary,
  },
  selectedItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedItemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingRight: 2,
  },
  selectedItemName: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 0,
    margin: 0,
  },
  selectedItemSummary: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
  },
  selectedItemNutritionGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  selectedItemNutritionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.surface,
  },
  selectedItemNutritionLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  selectedItemNutritionValue: {
    color: patientTheme.colors.text,
    fontSize: 9,
    fontWeight: '700',
  },
  selectedItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  quantityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 0,
  },
  quantityLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  quantityInput: {
    width: 34,
    minHeight: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    backgroundColor: 'transparent',
  },
  quantityUnit: {
    color: patientTheme.colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  removeItemButton: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
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
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryStatItem: {
    minWidth: 70,
    flexGrow: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  summaryStatValueUnit: {
    fontSize: 11,
    fontWeight: '800',
  },
  summaryEditHint: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  summaryStatInput: {
    minWidth: 62,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: patientTheme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  summaryStatLabel: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  mealQuestionButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    minHeight: 34,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    borderColor: patientTheme.colors.primarySoft,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  mealQuestionButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryStatUnit: {
    marginTop: 1,
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  footerStack: {
    width: '100%',
    gap: 0,
  },
  saveButton: {
    marginTop: 0,
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
  saveButtonDisabled: {
    backgroundColor: '#cfd6d4',
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
  modalSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
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
  foodEditModalCard: {
    maxHeight: '78%',
    maxWidth: 360,
    padding: 14,
    width: '100%',
  },
  foodEditTitleCol: {
    flex: 1,
  },
  foodEditCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  foodEditModalScroll: {
    marginTop: 8,
  },
  foodEditModalContent: {
    paddingBottom: 4,
  },
  foodEditNameInput: {
    marginBottom: 8,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
  },
  foodEditLabel: {
    fontSize: 11,
    marginBottom: 3,
  },
  foodEditGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  foodEditField: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  foodEditInput: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    textAlign: 'left',
    fontWeight: '400',
  },
  foodEditActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  foodEditCancelButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surface,
  },
  foodEditCancelText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '800',
  },
  foodEditSaveButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
  },
  foodEditSaveText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
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
