import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, supabaseAnonKey, supabaseUrl } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';

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

  const maxDimension = 1280;
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

  const manipulated = await ImageManipulator.manipulateAsync(asset.uri, resizeAction, {
    compress: 0.65,
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
    throw new Error(normalizeErrorMessage(detailedMessage || error));
  }

  if (!data?.ok) {
    throw new Error(normalizeErrorMessage(data?.message || 'Nao foi possivel analisar a refeicao agora.'));
  }

  return data;
}

export function criarAlimentoEditavel(alimento = {}) {
  return {
    id: alimento.id || buildUuid(),
    nome: String(alimento.nome || alimento.foodName || 'Alimento').trim(),
    categoria: String(alimento.categoria || alimento.category || 'Nao informada').trim(),
    quantidade_gramas: roundNutrient(alimento.quantidade_gramas || alimento.quantity_grams),
    calorias: roundNutrient(alimento.calorias || alimento.calories),
    carboidratos: roundNutrient(alimento.carboidratos || alimento.carbs),
    proteinas: roundNutrient(alimento.proteinas || alimento.proteins),
    gorduras: roundNutrient(alimento.gorduras || alimento.fats),
  };
}

export function calcularTotaisRefeicaoIA(alimentos) {
  return (Array.isArray(alimentos) ? alimentos : []).reduce(
    (totais, item) => ({
      carboidratos_total: roundNutrient(totais.carboidratos_total + item.carboidratos),
      calorias_total: roundNutrient(totais.calorias_total + item.calorias),
      proteinas_total: roundNutrient(totais.proteinas_total + item.proteinas),
      gorduras_total: roundNutrient(totais.gorduras_total + item.gorduras),
    }),
    {
      carboidratos_total: 0,
      calorias_total: 0,
      proteinas_total: 0,
      gorduras_total: 0,
    }
  );
}

export function buildMealTimelineEntryFromAI({ alimentos, totais, date, time, title }) {
  const normalizedFoods = Array.isArray(alimentos) ? alimentos : [];
  const safeTotals = totais || calcularTotaisRefeicaoIA(normalizedFoods);
  const description = normalizedFoods
    .map((item) => `${item.nome} (${roundNutrient(item.quantidade_gramas)} g)`)
    .join(', ');
  const now = new Date();
  const entryDate = date || now.toISOString().slice(0, 10);
  const entryTime = time || now.toTimeString().slice(0, 5);

  return {
    id: `meal-ia-${Date.now()}`,
    kind: 'meal',
    mode: 'photo',
    date: entryDate,
    time: entryTime,
    title: title || 'Refeição Registrada',
    description: description || 'Refeicao confirmada manualmente.',
    glucoseNote: 'Macros confirmados pelo usuario',
    glucoseDelta: `${roundNutrient(safeTotals.carboidratos_total)} g carbos`,
    aiNote:
      `IA identificou ${normalizedFoods.length} item(ns). ` +
      `${roundNutrient(safeTotals.calorias_total)} kcal, ` +
      `${roundNutrient(safeTotals.proteinas_total)} g proteinas e ` +
      `${roundNutrient(safeTotals.gorduras_total)} g gorduras.`,
  };
}

export async function salvarRefeicaoIA({
  patientId,
  fotoUrl,
  alimentos,
  confirmado = true,
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
  };

  const { data, error } = await supabase
    .from('refeicao_ia')
    .insert([payload])
    .select('*')
    .maybeSingle();

  if (error) {
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

  return {
    record: data || payload,
    totals: totais,
    foods: normalizedFoods,
  };
}
