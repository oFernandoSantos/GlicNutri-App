import * as ImagePicker from 'expo-image-picker';
import { invalidatePatientExperienceCache } from './cacheExperienciaPaciente';
import { supabase, supabaseAnonKey, supabaseUrl } from './configSupabase';
import { buscarAlimentosBrasil } from './servicoBuscaAlimentosBrasil';
import { registrarLogAuditoria } from './servicoAuditoria';
import { AppLogger, MODULOS_LOG_SISTEMA } from './servicoLogSistema';

export const REFEICAO_IA_BUCKET = 'refeicoes-ia';

function normalizeErrorMessage(error) {
  const message = String(error?.message || error || '').toLowerCase();

  if (message.includes('bucket not found')) {
    return (
      `O bucket "${REFEICAO_IA_BUCKET}" nao existe no Supabase Storage. ` +
      'Aplique a migration que cria o bucket "refeicoes-ia" antes de testar a IA.'
    );
  }

  if (message.includes('failed to fetch') || message.includes('network request failed')) {
    return 'Nao foi possivel enviar a imagem agora. Verifique sua conexao e tente novamente.';
  }

  if (message.includes('functions') && message.includes('not found')) {
    return 'A Edge Function "analisar-refeicao-ia" ainda nao foi publicada no Supabase.';
  }

  if (message.includes('non-2xx status code') || message.includes('unauthorized')) {
    return 'A funcao de analise retornou erro. Tente novamente agora que a integracao foi atualizada.';
  }

  if (message.includes('confirm your apicompany email') || message.includes('confirmation link')) {
    return 'A conta da LogMeal ainda nao foi ativada. Confirme o e-mail da conta LogMeal e tente novamente.';
  }

  if (message.includes('provided file does not have a valid format') || message.includes('valid formats are')) {
    return 'A foto enviada estava em um formato que a IA nao aceita. O app converteu para JPEG; tente escolher a imagem novamente.';
  }

  if (message.includes('too large') || message.includes('less than 1048576 bytes')) {
    return 'A foto ficou maior que o limite aceito pela IA. O app reduziu a imagem; tente analisar novamente.';
  }

  if (
    message.includes('not allowed') ||
    message.includes('upgrade your logmeal plan') ||
    message.includes('logmeal_api_user_key') ||
    message.includes('token de usuario logmeal') ||
    message.includes('apiuser')
  ) {
    return (
      'A analise automatica por foto nao esta disponivel no momento (configuracao ou plano LogMeal). ' +
      'Use "Anexar foto sem IA" e busque o alimento na tabela TACO abaixo.'
    );
  }

  return error?.message || String(error || 'Ocorreu um erro inesperado.');
}

async function extractFunctionErrorMessage(functionName, payload) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return '';
    }

    const rawText = await response.text();

    try {
      const parsed = JSON.parse(rawText);
      return String(parsed?.message || parsed?.error || rawText || '');
    } catch (_error) {
      return rawText;
    }
  } catch (_error) {
    return '';
  }
}

function buildUuid() {
  if (globalThis?.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}

function normalizeNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

function roundNutrient(value) {
  return Math.round(normalizeNumber(value) * 10) / 10;
}

const EXTRA_NUTRIENT_DEFAULTS = {
  fibras: 0,
  acucares: 0,
  gorduras_saturadas: 0,
  sodio: 0,
  ferro: 0,
  calcio: 0,
  magnesio: 0,
  potassio: 0,
  zinco: 0,
  vitamina_a: 0,
  vitamina_c: 0,
  vitamina_d: 0,
  vitamina_b12: 0,
  folato: 0,
};

const FOOD_NUTRIENT_HINTS = [
  {
    keys: ['arroz', 'massa', 'macarrao', 'batata', 'pao', 'quinoa', 'aveia'],
    fibras: 3,
    acucares: 2,
    gorduras_saturadas: 0.4,
    sodio: 120,
    ferro: 0.8,
    calcio: 18,
    magnesio: 28,
    potassio: 110,
    zinco: 0.7,
    vitamina_a: 0,
    vitamina_c: 2,
    vitamina_d: 0,
    vitamina_b12: 0,
    folato: 28,
  },
  {
    keys: ['feijao', 'lentilha', 'grao de bico', 'ervilha'],
    fibras: 7,
    acucares: 1,
    gorduras_saturadas: 0.1,
    sodio: 10,
    ferro: 2.4,
    calcio: 40,
    magnesio: 42,
    potassio: 240,
    zinco: 1.1,
    vitamina_a: 8,
    vitamina_c: 1,
    vitamina_d: 0,
    vitamina_b12: 0,
    folato: 120,
  },
  {
    keys: ['frango', 'carne', 'peixe', 'ovo', 'atum', 'salmao'],
    fibras: 0,
    acucares: 0,
    gorduras_saturadas: 2.2,
    sodio: 85,
    ferro: 1.6,
    calcio: 16,
    magnesio: 24,
    potassio: 260,
    zinco: 1.8,
    vitamina_a: 40,
    vitamina_c: 0,
    vitamina_d: 2.4,
    vitamina_b12: 1.1,
    folato: 18,
  },
  {
    keys: ['salada', 'legume', 'verdura', 'brocolis', 'cenoura', 'espinafre', 'couve'],
    fibras: 4,
    acucares: 3,
    gorduras_saturadas: 0,
    sodio: 35,
    ferro: 0.9,
    calcio: 48,
    magnesio: 30,
    potassio: 210,
    zinco: 0.4,
    vitamina_a: 260,
    vitamina_c: 18,
    vitamina_d: 0,
    vitamina_b12: 0,
    folato: 72,
  },
  {
    keys: ['queijo', 'leite', 'iogurte', 'kefir'],
    fibras: 0,
    acucares: 5,
    gorduras_saturadas: 3,
    sodio: 95,
    ferro: 0.1,
    calcio: 180,
    magnesio: 18,
    potassio: 190,
    zinco: 0.8,
    vitamina_a: 62,
    vitamina_c: 0,
    vitamina_d: 1.2,
    vitamina_b12: 0.9,
    folato: 10,
  },
  {
    keys: ['fruta', 'banana', 'maca', 'mamao', 'laranja', 'morango', 'abacate'],
    fibras: 3,
    acucares: 12,
    gorduras_saturadas: 0,
    sodio: 2,
    ferro: 0.3,
    calcio: 22,
    magnesio: 20,
    potassio: 240,
    zinco: 0.2,
    vitamina_a: 54,
    vitamina_c: 28,
    vitamina_d: 0,
    vitamina_b12: 0,
    folato: 34,
  },
  {
    keys: ['castanha', 'amendoa', 'nozes', 'amendoim', 'chia'],
    fibras: 3,
    acucares: 1,
    gorduras_saturadas: 1.1,
    sodio: 2,
    ferro: 1.1,
    calcio: 48,
    magnesio: 64,
    potassio: 180,
    zinco: 0.9,
    vitamina_a: 0,
    vitamina_c: 0,
    vitamina_d: 0,
    vitamina_b12: 0,
    folato: 22,
  },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasValue(value) {
  return value !== null && typeof value !== 'undefined' && String(value).trim() !== '';
}

function inferFoodNutrientDefaults(alimento) {
  const text = normalizeText(`${alimento?.nome || alimento?.foodName || ''} ${alimento?.categoria || alimento?.category || ''}`);
  const match = FOOD_NUTRIENT_HINTS.find((item) => item.keys.some((key) => text.includes(key)));
  if (!match) return EXTRA_NUTRIENT_DEFAULTS;

  return { ...EXTRA_NUTRIENT_DEFAULTS, ...match };
}

function pickNutrientValue(alimento, ptKey, enKey, fallback) {
  if (hasValue(alimento?.[ptKey])) return roundNutrient(alimento[ptKey]);
  if (hasValue(alimento?.[enKey])) return roundNutrient(alimento[enKey]);
  return roundNutrient(fallback);
}

function inferExtension(fileName, mimeType) {
  const normalizedName = String(fileName || '').toLowerCase();

  if (normalizedName.endsWith('.png') || mimeType === 'image/png') {
    return 'png';
  }

  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) {
    return normalizedName.endsWith('.jpg') ? 'jpg' : 'jpeg';
  }

  return 'jpg';
}

function inferMimeType(fileName, mimeType) {
  if (mimeType === 'image/png') {
    return 'image/png';
  }

  const extension = inferExtension(fileName, mimeType);
  return extension === 'png' ? 'image/png' : 'image/jpeg';
}

function looksLikeScreenshot(asset) {
  const fileName = String(asset?.fileName || asset?.file_name || '').toLowerCase();
  const uri = String(asset?.uri || '').toLowerCase();

  return (
    fileName.includes('screenshot') ||
    fileName.includes('captura de tela') ||
    fileName.includes('captura_tela') ||
    fileName.includes('screen shot') ||
    uri.includes('screenshot') ||
    uri.includes('captura')
  );
}

async function normalizePickerAsset(asset) {
  if (!asset?.uri) {
    return null;
  }

  const maxDimension = 1600;
  const width = Number(asset.width) || 0;
  const height = Number(asset.height) || 0;
  const shouldResize = width > maxDimension || height > maxDimension;
  const resizeAction = shouldResize
    ? [
        {
          resize:
            width >= height
              ? { width: maxDimension }
              : { height: maxDimension },
        },
      ]
    : [];

  const ImageManipulator = await import('expo-image-manipulator');
  const manipulated = await ImageManipulator.manipulateAsync(asset.uri, resizeAction, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const normalizedUri = manipulated.uri;
  const fileName = `refeicao-${Date.now()}.jpg`;
  const mimeType = 'image/jpeg';

  return {
    uri: normalizedUri,
    fileName,
    mimeType,
    width: manipulated.width || asset.width || null,
    height: manipulated.height || asset.height || null,
    fileSize: manipulated.fileSize || asset.fileSize || asset.file_size || null,
    isScreenshot: looksLikeScreenshot(asset),
  };
}

async function openPicker(promiseFactory) {
  const result = await promiseFactory();

  if (result?.canceled || !result?.assets?.length) {
    return null;
  }

  return await normalizePickerAsset(result.assets[0]);
}

export async function escolherImagemRefeicaoDaGaleria() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Permita o acesso a galeria para enviar a foto da refeicao.');
  }

  return openPicker(() =>
    ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      selectionLimit: 1,
    })
  );
}

export async function tirarFotoRefeicao() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Permita o acesso a camera para fotografar a refeicao.');
  }

  return openPicker(() =>
    ImagePicker.launchCameraAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    })
  );
}

export async function uploadImagemRefeicaoIA({ asset, patientId }) {
  if (!asset?.uri) {
    throw new Error('Selecione uma imagem antes de enviar.');
  }

  if (!patientId) {
    throw new Error('Paciente sem identificador para enviar imagem da refeicao.');
  }

  const mimeType = inferMimeType(asset.fileName, asset.mimeType);
  const extension = inferExtension(asset.fileName, mimeType);
  const fileName = `${buildUuid()}.${extension}`;
  const filePath = `${patientId}/${new Date().toISOString().slice(0, 10)}/${fileName}`;
  const response = await fetch(asset.uri);
  const body = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(REFEICAO_IA_BUCKET)
    .upload(filePath, body, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    AppLogger.erro(MODULOS_LOG_SISTEMA.ALIMENTACAO, 'Upload de imagem da refeicao', error, {
      usuario: patientId,
      complemento: 'Falha ao enviar imagem para o Storage',
    });
    throw new Error(normalizeErrorMessage(error));
  }

  return {
    bucket: REFEICAO_IA_BUCKET,
    path: filePath,
    storagePath: `storage://${REFEICAO_IA_BUCKET}/${filePath}`,
    mimeType,
    fileName: asset.fileName || fileName,
  };
}

export async function analisarImagemRefeicaoIA(payload) {
  const { data, error } = await supabase.functions.invoke('analisar-refeicao-ia', {
    body: payload,
  });

  if (error) {
    const detailedMessage = await extractFunctionErrorMessage('analisar-refeicao-ia', payload);
    AppLogger.erro(MODULOS_LOG_SISTEMA.ALIMENTACAO, 'Analise de refeicao por IA', error, {
      usuario: 'paciente',
      complemento: detailedMessage || error?.message || 'Falha na analise da refeicao',
    });
    throw new Error(normalizeErrorMessage(detailedMessage || error));
  }

  if (!data?.ok) {
    AppLogger.alerta(MODULOS_LOG_SISTEMA.ALIMENTACAO, 'Analise de refeicao por IA', {
      usuario: 'paciente',
      complemento: data?.message || 'IA nao retornou resultado valido',
    });
    throw new Error(normalizeErrorMessage(data?.message || 'Nao foi possivel analisar a refeicao agora.'));
  }

  if (Array.isArray(data?.alimentos) && data.alimentos.length) {
    return {
      ...data,
      alimentos: enriquecerAlimentosIdentificadosComTaco(data.alimentos),
    };
  }

  return data;
}

function escalarNutrienteTaco(valorPor100g, gramas) {
  const factor = Math.max(normalizeNumber(gramas), 1) / 100;
  return roundNutrient(normalizeNumber(valorPor100g) * factor);
}

/**
 * Refina macros da IA com a TACO quando a porcao ou os totais parecem inconsistentes.
 */
export function enriquecerAlimentosIdentificadosComTaco(alimentos = []) {
  return (Array.isArray(alimentos) ? alimentos : []).map((item) => {
    const nomeBusca = String(item?.nome || item?.foodName || '').trim();
    const normalized = criarAlimentoEditavel(item);

    if (!nomeBusca || nomeBusca.toLowerCase().includes('nao identificado')) {
      return normalized;
    }

    const match = buscarAlimentosBrasil(nomeBusca, { limit: 1 }).items[0];
    if (!match) {
      return normalized;
    }

    const grams = normalizeNumber(normalized.quantidade_gramas) > 0 ? normalized.quantidade_gramas : 100;
    const iaCalories = normalizeNumber(normalized.calorias);
    const tacoCalories = escalarNutrienteTaco(match.calorias, grams);
    const preferTaco =
      iaCalories <= 0 ||
      iaCalories < tacoCalories * 0.35 ||
      normalizeNumber(normalized.carboidratos) <= 0;

    return criarAlimentoEditavel({
      ...normalized,
      nome: match.nome,
      categoria:
        normalized.categoria && normalized.categoria !== 'Nao informada'
          ? normalized.categoria
          : match.categoria,
      quantidade_gramas: grams,
      refTacoId: match.id,
      calorias: preferTaco ? tacoCalories : normalized.calorias,
      carboidratos: preferTaco
        ? escalarNutrienteTaco(match.carboidratos, grams)
        : normalized.carboidratos,
      proteinas: preferTaco
        ? escalarNutrienteTaco(match.proteinas, grams)
        : normalized.proteinas,
      gorduras: preferTaco ? escalarNutrienteTaco(match.gorduras, grams) : normalized.gorduras,
      fibras: preferTaco ? escalarNutrienteTaco(match.fibras, grams) : normalized.fibras,
    });
  });
}

export function getMealEntryNutrition(entry) {
  const kcal = Number(entry?.kcal ?? entry?.calories);
  const carbs = Number(entry?.carbsG ?? entry?.carbs);
  const protein = Number(entry?.proteinG ?? entry?.protein);
  const fat = Number(entry?.fatG ?? entry?.fat);

  if (!Number.isFinite(kcal) || kcal <= 0) {
    return null;
  }

  return {
    calories: kcal,
    carbs: Number.isFinite(carbs) ? carbs : 0,
    protein: Number.isFinite(protein) ? protein : 0,
    fat: Number.isFinite(fat) ? fat : 0,
  };
}

export function criarAlimentoEditavel(alimento = {}) {
  const inferred = inferFoodNutrientDefaults(alimento);

  return {
    id: alimento.id || buildUuid(),
    nome: String(alimento.nome || alimento.foodName || 'Alimento').trim(),
    categoria: String(alimento.categoria || alimento.category || 'Nao informada').trim(),
    quantidade_gramas: roundNutrient(alimento.quantidade_gramas || alimento.quantity_grams),
    calorias: roundNutrient(alimento.calorias || alimento.calories),
    carboidratos: roundNutrient(alimento.carboidratos || alimento.carbs),
    proteinas: roundNutrient(alimento.proteinas || alimento.proteins),
    gorduras: roundNutrient(alimento.gorduras || alimento.fats),
    fibras: pickNutrientValue(alimento, 'fibras', 'fiber', inferred.fibras),
    acucares: pickNutrientValue(alimento, 'acucares', 'sugar', inferred.acucares),
    gorduras_saturadas: pickNutrientValue(
      alimento,
      'gorduras_saturadas',
      'saturatedFat',
      inferred.gorduras_saturadas
    ),
    sodio: pickNutrientValue(alimento, 'sodio', 'sodium', inferred.sodio),
    ferro: pickNutrientValue(alimento, 'ferro', 'iron', inferred.ferro),
    calcio: pickNutrientValue(alimento, 'calcio', 'calcium', inferred.calcio),
    magnesio: pickNutrientValue(alimento, 'magnesio', 'magnesium', inferred.magnesio),
    potassio: pickNutrientValue(alimento, 'potassio', 'potassium', inferred.potassio),
    zinco: pickNutrientValue(alimento, 'zinco', 'zinc', inferred.zinco),
    vitamina_a: pickNutrientValue(alimento, 'vitamina_a', 'vitaminA', inferred.vitamina_a),
    vitamina_c: pickNutrientValue(alimento, 'vitamina_c', 'vitaminC', inferred.vitamina_c),
    vitamina_d: pickNutrientValue(alimento, 'vitamina_d', 'vitaminD', inferred.vitamina_d),
    vitamina_b12: pickNutrientValue(alimento, 'vitamina_b12', 'vitaminB12', inferred.vitamina_b12),
    folato: pickNutrientValue(alimento, 'folato', 'folate', inferred.folato),
  };
}

export function calcularTotaisRefeicaoIA(alimentos) {
  return (Array.isArray(alimentos) ? alimentos : []).reduce(
    (totais, item) => ({
      carboidratos_total: roundNutrient(totais.carboidratos_total + item.carboidratos),
      calorias_total: roundNutrient(totais.calorias_total + item.calorias),
      proteinas_total: roundNutrient(totais.proteinas_total + item.proteinas),
      gorduras_total: roundNutrient(totais.gorduras_total + item.gorduras),
      fibras_total: roundNutrient(totais.fibras_total + item.fibras),
      acucares_total: roundNutrient(totais.acucares_total + item.acucares),
      gorduras_saturadas_total: roundNutrient(
        totais.gorduras_saturadas_total + item.gorduras_saturadas
      ),
      sodio_total: roundNutrient(totais.sodio_total + item.sodio),
      ferro_total: roundNutrient(totais.ferro_total + item.ferro),
      calcio_total: roundNutrient(totais.calcio_total + item.calcio),
      magnesio_total: roundNutrient(totais.magnesio_total + item.magnesio),
      potassio_total: roundNutrient(totais.potassio_total + item.potassio),
      zinco_total: roundNutrient(totais.zinco_total + item.zinco),
      vitamina_a_total: roundNutrient(totais.vitamina_a_total + item.vitamina_a),
      vitamina_c_total: roundNutrient(totais.vitamina_c_total + item.vitamina_c),
      vitamina_d_total: roundNutrient(totais.vitamina_d_total + item.vitamina_d),
      vitamina_b12_total: roundNutrient(totais.vitamina_b12_total + item.vitamina_b12),
      folato_total: roundNutrient(totais.folato_total + item.folato),
    }),
    {
      carboidratos_total: 0,
      calorias_total: 0,
      proteinas_total: 0,
      gorduras_total: 0,
      fibras_total: 0,
      acucares_total: 0,
      gorduras_saturadas_total: 0,
      sodio_total: 0,
      ferro_total: 0,
      calcio_total: 0,
      magnesio_total: 0,
      potassio_total: 0,
      zinco_total: 0,
      vitamina_a_total: 0,
      vitamina_c_total: 0,
      vitamina_d_total: 0,
      vitamina_b12_total: 0,
      folato_total: 0,
    }
  );
}

export function buildMealTimelineEntryFromAI({ alimentos, totais, date, time, title, mealLabel }) {
  const normalizedFoods = Array.isArray(alimentos) ? alimentos : [];
  const safeTotals = totais || calcularTotaisRefeicaoIA(normalizedFoods);
  const description = normalizedFoods
    .map((item) => `${item.nome} (${roundNutrient(item.quantidade_gramas)} g)`)
    .join(', ');
  const now = new Date();
  const entryDate = date || now.toISOString().slice(0, 10);
  const entryTime = time || now.toTimeString().slice(0, 5);
  const displayTitle = mealLabel || title || 'Refeição Registrada';

  return {
    id: `meal-ia-${Date.now()}`,
    kind: 'meal',
    mode: 'photo',
    date: entryDate,
    time: entryTime,
    title: displayTitle,
    mealLabel: displayTitle,
    mealTypeLabel: displayTitle,
    description: description || 'Refeicao confirmada manualmente.',
    glucoseNote: 'Macros confirmados pelo usuario',
    glucoseDelta: `${roundNutrient(safeTotals.carboidratos_total)} g carbos`,
    aiNote:
      `Totais: ${roundNutrient(safeTotals.calorias_total)} kcal, ` +
      `${roundNutrient(safeTotals.proteinas_total)} g proteinas e ` +
      `${roundNutrient(safeTotals.gorduras_total)} g gorduras.`,
    carbsG: roundNutrient(safeTotals.carboidratos_total),
    kcal: roundNutrient(safeTotals.calorias_total),
    proteinG: roundNutrient(safeTotals.proteinas_total),
    fatG: roundNutrient(safeTotals.gorduras_total),
    foods: normalizedFoods.map((item) => ({
      name: item.nome,
      alimento: item.nome,
      grams: roundNutrient(item.quantidade_gramas),
    })),
  };
}

export async function salvarRefeicaoIA({
  patientId,
  fotoUrl,
  alimentos,
  confirmado = true,
  createdAt,
}) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para salvar a refeicao.');
  }

  const normalizedFoods = (Array.isArray(alimentos) ? alimentos : [])
    .map((item) => criarAlimentoEditavel(item))
    .filter((item) => item.nome);

  if (!normalizedFoods.length) {
    throw new Error('Adicione ao menos um alimento antes de confirmar.');
  }

  const totais = calcularTotaisRefeicaoIA(normalizedFoods);
  const payload = {
    paciente_id: patientId,
    foto_url: fotoUrl || null,
    alimentos: normalizedFoods,
    carboidratos_total: totais.carboidratos_total,
    calorias_total: totais.calorias_total,
    proteinas_total: totais.proteinas_total,
    gorduras_total: totais.gorduras_total,
    confirmado,
    ...(createdAt ? { created_at: createdAt } : {}),
  };

  const { data, error } = await supabase
    .from('refeicao_ia')
    .insert([payload])
    .select('*')
    .maybeSingle();

  if (error) {
    AppLogger.erro(MODULOS_LOG_SISTEMA.ALIMENTACAO, 'Cadastro de refeicao', error, {
      usuario: patientId,
      complemento: 'Falha ao cadastrar refeicao IA',
    });
    registrarLogAuditoria({
      actor: { id_paciente_uuid: patientId },
      actorType: 'paciente',
      targetPatientId: patientId,
      action: 'refeicao_ia_falha_persistencia',
      entity: 'refeicao_ia',
      entityId: null,
      origin: 'refeicao_ia',
      status: 'falha',
      details: {
        paciente_id: patientId,
        confirmado,
      },
    });
    throw error;
  }

  const recordId = data?.id != null ? String(data.id) : null;

  registrarLogAuditoria({
    actor: { id_paciente_uuid: patientId },
    actorType: 'paciente',
    targetPatientId: patientId,
    action: 'refeicao_ia_registrada',
    entity: 'refeicao_ia',
    entityId: recordId,
    origin: 'refeicao_ia',
    status: 'sucesso',
    details: {
      paciente_id: patientId,
      tipoAcao: 'create',
      confirmado,
      quantidadeAlimentos: normalizedFoods.length,
      possuiFoto: Boolean(fotoUrl),
      carboidratosTotal: totais.carboidratos_total,
      caloriasTotal: totais.calorias_total,
    },
  });

  AppLogger.cadastro(MODULOS_LOG_SISTEMA.ALIMENTACAO, 'Cadastro de refeicao', {
    usuario: patientId,
    complemento: `Refeicao cadastrada | Alimentos: ${normalizedFoods.length} | Carboidratos: ${totais.carboidratos_total} g`,
    detalhes: {
      recordId,
      totais,
    },
  });

  invalidatePatientExperienceCache(patientId);

  return {
    record: data || payload,
    totals: totais,
    foods: normalizedFoods,
  };
}
