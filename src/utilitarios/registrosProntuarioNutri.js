/**
 * Formatação, busca e mensagens de chat — registros do paciente (acesso Nutri).
 */
import { getMealEntryPhotoRef, isMealPhotoRefResolvable } from '../servicos/servicoRefeicaoIA';

function parseRegistroInstant(entry = {}) {
  const isoCandidates = [
    entry.readingTimeUtc,
    entry.data_hora,
    entry.registered_at,
    entry.created_at,
    entry.createdAt,
  ];

  for (const candidate of isoCandidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dateRaw = entry.date || entry.data || entry.data_refeicao;
  const timeRaw = entry.time || entry.hora || entry.hora_refeicao || '00:00';
  if (dateRaw) {
    const date = String(dateRaw).slice(0, 10);
    const time = String(timeRaw).slice(0, 5);
    const parsed = new Date(`${date}T${time}:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

export function sortRegistrosNewestFirst(entries = []) {
  return [...entries].sort((left, right) => {
    const leftTime = parseRegistroInstant(left)?.getTime() ?? 0;
    const rightTime = parseRegistroInstant(right)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

export function formatRegistroDateParts(entry) {
  const instant = parseRegistroInstant(entry);
  if (!instant) {
    return {
      dateLabel: 'Data não informada',
      timeLabel: '',
      combined: 'Data não informada',
    };
  }

  const dateLabel = instant.toLocaleDateString('pt-BR');
  const timeLabel = instant.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    dateLabel,
    timeLabel,
    combined: `${dateLabel} ${timeLabel}`,
  };
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mealFoodsText(entry = {}) {
  if (Array.isArray(entry.foods) && entry.foods.length) {
    return entry.foods
      .map((item) => {
        const nome = item?.name || item?.alimento || item?.nome;
        if (!nome) return '';
        const gramas = item?.grams ?? item?.quantidade_gramas;
        if (gramas == null || Number.isNaN(Number(gramas))) return nome;
        return `${nome} (${Math.round(Number(gramas))} g)`;
      })
      .filter(Boolean)
      .join(', ');
  }
  return String(entry.description || entry.resumo_ia || '').trim();
}

function mealAlimentosLine(entry = {}) {
  const fromFoods = mealFoodsText(entry);
  const description = String(entry.description || '').trim();
  if (!fromFoods) return description;
  if (!description || description === fromFoods) return fromFoods;
  if (description.length > fromFoods.length) return description;
  return fromFoods;
}

export function mealRegistroModeLabel(entry = {}) {
  if (entry.mode === 'photo') return 'Foto';
  if (entry.mode === 'voice') return 'Áudio';
  if (entry.mode === 'text') return 'Texto';
  if (getMealEntryPhotoRef(entry)) return 'Foto';
  return 'Texto';
}

export function mealNutritionSummaryLine(entry = {}) {
  const parts = [];
  const fiber = Number(entry?.fiberG ?? entry?.fibrasG ?? entry?.fibras_total ?? 0);
  const sugars = Number(entry?.sugarsG ?? entry?.acucaresG ?? entry?.acucares_total ?? 0);
  const sodium = Number(entry?.sodiumMg ?? entry?.sodioMg ?? entry?.sodio_total ?? 0);
  const saturated = Number(entry?.saturatedFatG ?? entry?.gordurasSaturadasG ?? entry?.gorduras_saturadas_total ?? 0);
  const carbs = Number(entry?.carbsG ?? entry?.carboidratos_total ?? 0);
  const protein = Number(entry?.proteinG ?? entry?.proteinas_total ?? 0);
  const fat = Number(entry?.fatG ?? entry?.gorduras_total ?? 0);

  if (carbs > 0) parts.push(`Carboidratos: ${Math.round(carbs)}g`);
  if (protein > 0) parts.push(`Proteínas: ${Math.round(protein)}g`);
  if (fat > 0) parts.push(`Gorduras: ${Math.round(fat)}g`);
  if (fiber > 0) parts.push(`Fibras: ${Math.round(fiber)}g`);
  if (sugars > 0) parts.push(`Açúcares: ${Math.round(sugars)}g`);
  if (saturated > 0) parts.push(`Gord. sat.: ${Math.round(saturated)}g`);
  if (sodium > 0) parts.push(`Sódio: ${Math.round(sodium)}mg`);

  return parts.join(' · ');
}

function mealKcalLabel(entry = {}) {
  const kcal = Number(
    entry?.kcal ?? entry?.calorias_estimadas ?? entry?.calories ?? entry?.calorias_total ?? 0
  );
  return kcal > 0 ? `${Math.round(kcal)} kcal` : '';
}

function mealTitleLabel(entry = {}) {
  return (
    entry.title ||
    entry.mealLabel ||
    entry.mealTypeLabel ||
    entry.nome ||
    entry.tipo_refeicao ||
    'Refeição'
  );
}

function glucoseObservation(entry = {}) {
  const raw = String(entry.sintomas_associados || entry.observacao || entry.notes || '').trim();
  if (!raw) return '';
  if (/^tipo da glicemia:/i.test(raw) && raw.split('\n').length <= 1) {
    return entry.glucoseType ? '' : raw;
  }
  return raw;
}

export function buildRegistroSearchHaystack(entry, type) {
  const { dateLabel, timeLabel, combined } = formatRegistroDateParts(entry);
  const parts = [dateLabel, timeLabel, combined];

  if (type === 'glicemia') {
    parts.push(
      entry.valor_mgdl,
      entry.value,
      entry.contexto,
      entry.context,
      entry.glucoseType,
      glucoseObservation(entry)
    );
  } else if (type === 'medicacao') {
    parts.push(
      entry.medicineName,
      entry.nome_medicamento,
      entry.medicineQuantity,
      entry.medicineUnit,
      entry.dosagem,
      entry.dose,
      entry.label,
      entry.observation,
      entry.descricao
    );
  } else if (type === 'insulina') {
    parts.push(
      entry.medicineName,
      entry.nome_medicamento,
      entry.insulinCategory,
      entry.categoria_insulina,
      entry.medicineQuantity,
      entry.medicineUnit,
      entry.insulinUsage,
      entry.insulinNotes,
      entry.observation
    );
  } else if (type === 'refeicoes') {
    parts.push(
      entry.title,
      entry.nome,
      entry.tipo_refeicao,
      entry.mealLabel,
      entry.description,
      entry.resumo_ia,
      entry.aiNote,
      entry.calorias_estimadas,
      entry.kcal,
      mealFoodsText(entry),
      entry.foto_url
    );
  }

  return normalizeSearchText(parts.filter(Boolean).join(' '));
}

export function matchesRegistroSearch(entry, type, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return buildRegistroSearchHaystack(entry, type).includes(normalizedQuery);
}

function line(label, value) {
  const text = sanitizeRegistroObservacao(value);
  if (!text || text === '—') return null;
  return `${label}: ${text}`;
}

export function sanitizeRegistroObservacao(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  text = text
    .replace(/fotoref:\s*storage:\/\/[^\s]+/gi, '')
    .replace(/storage:\/\/[^\s]+/gi, '')
    .replace(/fotoref:\s*/gi, '')
    .replace(/foto:\s*(anexada|sem foto)/gi, '')
    .trim();
  if (/^[\w]{0,8}:\s*$/i.test(text)) return '';
  if (!text) return '';
  if (/^https?:\/\//i.test(text) && text.length > 120) return '';
  if (text.startsWith('{') && text.endsWith('}')) return '';
  if (/^(anexada|sem foto|—|-)$/i.test(text)) return '';
  if (/^totais:\s*\d/i.test(text)) return '';
  if (text.length > 240) return `${text.slice(0, 237)}...`;
  return text;
}

/** Dados mínimos do registro para navegação e envio ao chat (evita params gigantes). */
export function slimRegistroEntryForChat(type, entry = {}) {
  if (!entry || typeof entry !== 'object') return {};

  const base = {
    id: entry.id,
    date: entry.date || entry.data || entry.data_refeicao,
    time: entry.time || entry.hora || entry.hora_refeicao,
    data_hora: entry.data_hora,
    registered_at: entry.registered_at,
    created_at: entry.created_at,
    createdAt: entry.createdAt,
    readingTimeUtc: entry.readingTimeUtc,
  };

  if (type === 'glicemia') {
    return {
      ...base,
      valor_mgdl: entry.valor_mgdl,
      value: entry.value,
      contexto: entry.contexto,
      context: entry.context,
      glucoseType: entry.glucoseType,
      sintomas_associados: entry.sintomas_associados,
      observacao: entry.observacao,
    };
  }

  if (type === 'medicacao') {
    return {
      ...base,
      medicineName: entry.medicineName,
      nome_medicamento: entry.nome_medicamento,
      medicineQuantity: entry.medicineQuantity,
      medicineUnit: entry.medicineUnit,
      dosagem: entry.dosagem,
      dose: entry.dose,
      observation: entry.observation,
      label: entry.label,
      descricao: entry.descricao,
    };
  }

  if (type === 'insulina') {
    return {
      ...base,
      medicineName: entry.medicineName,
      nome_medicamento: entry.nome_medicamento,
      medicineQuantity: entry.medicineQuantity,
      medicineUnit: entry.medicineUnit,
      insulinCategory: entry.insulinCategory,
      categoria_insulina: entry.categoria_insulina,
      insulinUsage: entry.insulinUsage,
      insulinNotes: entry.insulinNotes,
      observation: entry.observation,
    };
  }

  if (type === 'refeicoes') {
    return {
      ...base,
      title: entry.title,
      nome: entry.nome,
      tipo_refeicao: entry.tipo_refeicao,
      mealLabel: entry.mealLabel,
      mealTypeLabel: entry.mealTypeLabel,
      description: entry.description,
      foods: entry.foods,
      mode: entry.mode,
      kcal: entry.kcal,
      calorias_estimadas: entry.calorias_estimadas,
      calories: entry.calories,
      calorias_total: entry.calorias_total,
      carbsG: entry.carbsG,
      proteinG: entry.proteinG,
      fatG: entry.fatG,
      fiberG: entry.fiberG,
      sugarsG: entry.sugarsG,
      sodiumMg: entry.sodiumMg,
      saturatedFatG: entry.saturatedFatG,
      carboidratos_total: entry.carboidratos_total,
      proteinas_total: entry.proteinas_total,
      gorduras_total: entry.gorduras_total,
      fibras_total: entry.fibras_total,
      acucares_total: entry.acucares_total,
      sodio_total: entry.sodio_total,
      foto_url: entry.foto_url,
      fotoUrl: entry.fotoUrl,
      photoUrl: entry.photoUrl,
      storagePath: entry.storagePath,
      imageUri: entry.imageUri,
      imageUrl: entry.imageUrl,
      aiNote: sanitizeRegistroObservacao(entry.aiNote),
      resumo_ia: sanitizeRegistroObservacao(entry.resumo_ia),
    };
  }

  return base;
}

const REGISTRO_CHAT_HEADERS = {
  glicemia: 'Registro de glicemia:',
  medicacao: 'Registro de medicação:',
  insulina: 'Registro de insulina:',
  refeicoes: 'Registro de refeição:',
};

const REGISTRO_META_START = '[GLICNUTRI_REGISTRO_START]';
const REGISTRO_META_END = '[GLICNUTRI_REGISTRO_END]';

export function getRegistroChatTypeLabel(type) {
  const labels = {
    glicemia: 'Glicemia',
    medicacao: 'Medicação',
    insulina: 'Insulina',
    refeicoes: 'Refeição',
  };
  return labels[type] || 'Registro';
}

export function buildRegistroChatContext(type, entry, { photoUrl = null, photoRef = null } = {}) {
  const { dateLabel, timeLabel } = formatRegistroDateParts(entry);
  let title = '';
  let detail = '';

  if (type === 'glicemia') {
    const valor = entry.valor_mgdl ?? entry.value;
    title = valor != null && valor !== '' ? `${valor} mg/dL` : 'Glicemia';
    detail =
      glucoseObservation(entry) ||
      entry.contexto ||
      entry.context ||
      entry.glucoseType ||
      '';
  } else if (type === 'medicacao') {
    title = entry.medicineName || entry.nome_medicamento || 'Medicamento';
    detail = [entry.medicineQuantity || entry.dosagem || entry.dose, entry.medicineUnit]
      .filter(Boolean)
      .join(' ');
    if (entry.observation) detail = detail ? `${detail} · ${entry.observation}` : entry.observation;
  } else if (type === 'insulina') {
    title = entry.medicineName || entry.nome_medicamento || 'Insulina';
    detail = [
      entry.insulinCategory || entry.categoria_insulina,
      [entry.medicineQuantity || entry.dosagem || entry.dose, entry.medicineUnit || 'UI']
        .filter(Boolean)
        .join(' '),
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (type === 'refeicoes') {
    title = mealTitleLabel(entry);
    detail = mealAlimentosLine(entry) || entry.resumo_ia || '';
  }

  const resolvedPhotoRef =
    photoRef || (type === 'refeicoes' ? getMealEntryPhotoRef(entry) : null) || null;

  const alimentos = type === 'refeicoes' ? mealAlimentosLine(entry) : '';
  const observacao =
    type === 'refeicoes'
      ? sanitizeRegistroObservacao(entry.aiNote) || sanitizeRegistroObservacao(entry.resumo_ia)
      : '';
  const registroMode = type === 'refeicoes' ? mealRegistroModeLabel(entry) : '';
  const nutritionSummary = type === 'refeicoes' ? mealNutritionSummaryLine(entry) : '';
  const kcalLabel = type === 'refeicoes' ? mealKcalLabel(entry) : '';

  return {
    type,
    typeLabel: getRegistroChatTypeLabel(type),
    dateLabel,
    timeLabel,
    title: String(title || '').trim(),
    detail: type === 'refeicoes' ? alimentos || String(detail || '').trim() : String(detail || '').trim(),
    alimentos,
    observacao,
    registroMode,
    nutritionSummary,
    kcalLabel,
    photoUrl: photoUrl || null,
    photoRef: resolvedPhotoRef,
    entry: slimRegistroEntryForChat(type, entry),
  };
}

export function stripRegistroMetaFromChatText(text = '') {
  return String(text || '')
    .replace(
      new RegExp(
        `${REGISTRO_META_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${REGISTRO_META_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'g'
      ),
      ''
    )
    .trim();
}

export function registroContextForChatMessage(context = {}, comment = '') {
  if (!context?.type) return null;

  const entrySnapshot =
    context.entrySnapshot ||
    (context.entry ? slimRegistroEntryForChat(context.type, context.entry) : null);

  return {
    type: context.type,
    typeLabel: context.typeLabel || getRegistroChatTypeLabel(context.type),
    dateLabel: context.dateLabel || '',
    timeLabel: context.timeLabel || '',
    title: context.title || '',
    detail: context.detail || context.alimentos || '',
    alimentos: context.alimentos || context.detail || '',
    observacao: sanitizeRegistroObservacao(context.observacao || ''),
    registroMode: context.registroMode || '',
    nutritionSummary: context.nutritionSummary || '',
    kcalLabel: context.kcalLabel || '',
    photoRef: pickResolvablePhotoRef(
      context.photoRef,
      entrySnapshot ? getMealEntryPhotoRef(entrySnapshot) : null
    ),
    photoUrl: context.photoUrl || null,
    entryId:
      context.entryId ||
      context.entry?.databaseId ||
      context.entry?.id ||
      entrySnapshot?.databaseId ||
      entrySnapshot?.id ||
      null,
    entrySnapshot,
    comment: String(comment || '').trim(),
  };
}

function buildRegistroMetaPayload(context = {}) {
  return registroContextForChatMessage(context);
}

function appendRegistroMetaBlock(body = '', context = {}) {
  const payload = buildRegistroMetaPayload(context);
  if (!payload || !String(body || '').trim()) return body;
  return `${body}${REGISTRO_META_START}${JSON.stringify(payload)}${REGISTRO_META_END}`;
}

function extractRegistroMetaFromText(raw = '') {
  const match = String(raw || '').match(
    new RegExp(
      `${REGISTRO_META_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${REGISTRO_META_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
    )
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.log('Meta de registro no chat invalido:', error);
    return null;
  }
}

function pickNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function pickResolvablePhotoRef(...candidates) {
  for (const candidate of candidates) {
    if (isMealPhotoRefResolvable(candidate)) return String(candidate).trim();
  }
  return null;
}

export function hasRegistroPresentationFields(context = null) {
  if (!context) return false;
  return Boolean(
    pickNonEmpty(
      context.title,
      context.alimentos,
      context.detail,
      context.nutritionSummary,
      context.kcalLabel,
      context.observacao
    ) || isMealPhotoRefResolvable(context.photoRef) || pickNonEmpty(context.photoUrl)
  );
}

/** Monta apresentação do card a partir do snapshot de envio ({ type, entry, photoRef }). */
export function buildRegistroPresentationFromSnapshot(snapshot = {}) {
  const { type, entry, photoRef, photoUrl, comment } = snapshot || {};
  if (!type) return null;

  if (hasRegistroPresentationFields(snapshot) && !entry) {
    return registroContextForChatMessage(snapshot, comment);
  }

  if (!entry) return null;
  const base = buildRegistroChatMessage(type, entry, {
    photoRef: photoRef || (type === 'refeicoes' ? getMealEntryPhotoRef(entry) : null),
    photoUrl: photoUrl || null,
  });
  if (!base) return null;
  const parsed = parseRegistroChatMessage(base);
  if (!parsed) return null;
  const note = String(comment || '').trim();
  if (note) parsed.comment = note;
  return parsed;
}

export function buildRegistroChatMessageFromContext(context = {}, options = {}) {
  const { type, entry, photoRef } = context || {};
  const comment = String(options.comment || '').trim();
  if (!type || !entry) return comment;
  const base = buildRegistroChatMessage(type, entry, {
    photoRef: photoRef || (type === 'refeicoes' ? getMealEntryPhotoRef(entry) : null),
    photoUrl: context.photoUrl || null,
  });
  const presentation =
    buildRegistroPresentationFromSnapshot({ ...context, comment }) ||
    registroContextForChatMessage(context, comment);
  const withMeta = appendRegistroMetaBlock(base, presentation);
  if (!comment) return withMeta;
  return withMeta ? `${withMeta}\nMensagem: ${comment}` : comment;
}

function normalizeRegistroHeaderKey(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseRegistroFieldMap(raw) {
  const fields = {};
  const orphanLines = [];

  stripRegistroMetaFromChatText(raw)
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed) return;

      const separator = trimmed.indexOf(':');
      if (separator <= 0) {
        orphanLines.push(trimmed);
        return;
      }

      const label = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!label) return;
      fields[label] = fields[label] ? `${fields[label]}\n${value}` : value;
    });

  return { fields, orphanLines };
}

function pickRegistroFieldValue(fields = {}, keys = []) {
  for (const key of keys) {
    if (fields[key]) return String(fields[key]).trim();
  }
  return '';
}

function canonicalRegistroFields(parsed = {}) {
  const { fields = {}, orphanLines = [] } = parsed;
  const alimentos =
    pickRegistroFieldValue(fields, ['Alimentos', 'alimentos']) ||
    orphanLines.filter((line) => !/^registro de /i.test(line)).join(', ');

  return {
    Data: pickRegistroFieldValue(fields, ['Data', 'data', 'ata']),
    Hora: pickRegistroFieldValue(fields, ['Hora', 'hora']),
    Descrição: pickRegistroFieldValue(fields, [
      'Descrição',
      'Descriçao',
      'Descricao',
      'Descricão',
      'Título',
      'Titulo',
    ]),
    Alimentos: alimentos,
    Observação: pickRegistroFieldValue(fields, ['Observação', 'Observacao']),
    Foto: pickRegistroFieldValue(fields, ['Foto', 'foto']),
    FotoRef: pickRegistroFieldValue(fields, ['FotoRef', 'Foto Ref', 'fotoRef']),
    Valor: pickRegistroFieldValue(fields, ['Valor', 'valor']),
    Medicamento: pickRegistroFieldValue(fields, ['Medicamento', 'medicamento']),
    Tipo: pickRegistroFieldValue(fields, ['Tipo', 'tipo']),
    Dose: pickRegistroFieldValue(fields, ['Dose', 'dose']),
    Mensagem: pickRegistroFieldValue(fields, ['Mensagem', 'Mensagem da nutricionista']),
    Refeição: pickRegistroFieldValue(fields, [
      'Refeição',
      'Refeicao',
      'Descrição',
      'Descriçao',
      'Descricao',
    ]),
    Tipo: pickRegistroFieldValue(fields, ['Tipo', 'tipo']),
    Nutrição: pickRegistroFieldValue(fields, ['Nutrição', 'Nutricao', 'Nutricao']),
    Calorias: pickRegistroFieldValue(fields, ['Calorias', 'calorias']),
  };
}

function extractMealPhotoRefFromText(text) {
  const match = String(text || '').match(/storage:\/\/refeicoes-ia\/[^\s]+/i);
  if (!match?.[0]) return null;
  const ref = match[0].trim().replace(/[),.;!?]+$/g, '');
  return isMealPhotoRefResolvable(ref) ? ref : null;
}

function detectRegistroChatTypeFromText(raw, canonical = {}) {
  const normalized = normalizeRegistroHeaderKey(raw);

  const byHeader = Object.keys(REGISTRO_CHAT_HEADERS).find((key) =>
    normalized.startsWith(normalizeRegistroHeaderKey(REGISTRO_CHAT_HEADERS[key]))
  );
  if (byHeader) return byHeader;

  if (extractMealPhotoRefFromText(raw)) return 'refeicoes';

  const hasDate = Boolean(canonical.Data);
  const hasTime = Boolean(canonical.Hora);
  const looksLikeMeal =
    canonical.Descrição ||
    canonical.Alimentos ||
    canonical.FotoRef ||
    canonical.Foto ||
    /refeic/i.test(raw);

  if (hasDate && hasTime && looksLikeMeal) {
    return 'refeicoes';
  }

  if (!hasDate || !hasTime) return null;
  if (canonical.Valor) return 'glicemia';
  if (canonical.Medicamento) return 'medicacao';
  if (canonical.Dose && canonical.Tipo) return 'insulina';

  return null;
}

function buildParsedRegistroFromFields(raw, canonical, type) {
  const foto = canonical.Foto || '';
  let photoRef =
    String(canonical.FotoRef || '').trim() || extractMealPhotoRefFromText(raw) || null;
  const observacaoBruta = canonical.Observação || '';

  if (!photoRef && /storage:\/\//i.test(observacaoBruta)) {
    photoRef = extractMealPhotoRefFromText(observacaoBruta) || photoRef;
  }
  photoRef = pickResolvablePhotoRef(photoRef);

  const photoUrl =
    foto &&
    foto !== 'Sem foto' &&
    foto !== 'anexada' &&
    (foto.startsWith('http') || foto.startsWith('file') || foto.startsWith('data:'))
      ? foto
      : null;

  const observacaoLimpa = sanitizeRegistroObservacao(observacaoBruta);
  const alimentos = String(canonical.Alimentos || '').trim();

  const titleByType =
    type === 'refeicoes'
      ? canonical.Refeição || canonical.Descrição || ''
      : canonical.Valor || canonical.Medicamento || canonical.Tipo || '';

  const detailByType =
    type === 'refeicoes' ? alimentos || observacaoLimpa || '' : canonical.Dose || observacaoLimpa || '';

  const comment = String(canonical.Mensagem || '').trim();

  return {
    type,
    typeLabel: getRegistroChatTypeLabel(type),
    dateLabel: canonical.Data || '',
    timeLabel: canonical.Hora || '',
    title: titleByType,
    detail: detailByType,
    alimentos: type === 'refeicoes' ? alimentos : '',
    observacao: observacaoLimpa,
    registroMode: type === 'refeicoes' ? canonical.Tipo || '' : '',
    nutritionSummary: type === 'refeicoes' ? canonical.Nutrição || '' : '',
    kcalLabel: type === 'refeicoes' ? canonical.Calorias || '' : '',
    photoUrl,
    photoRef,
    comment,
    rawText: raw,
  };
}

export function parseRegistroChatMessage(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const meta = extractRegistroMetaFromText(raw);
  if (meta?.type) {
    const canonical = canonicalRegistroFields(parseRegistroFieldMap(raw));
    const built = buildParsedRegistroFromFields(raw, canonical, meta.type);
    const comment = pickNonEmpty(canonical.Mensagem, meta.comment, built.comment);
    return {
      ...built,
      type: meta.type,
      typeLabel: pickNonEmpty(meta.typeLabel, built.typeLabel) || getRegistroChatTypeLabel(meta.type),
      dateLabel: pickNonEmpty(built.dateLabel, meta.dateLabel, canonical.Data),
      timeLabel: pickNonEmpty(built.timeLabel, meta.timeLabel, canonical.Hora),
      title: pickNonEmpty(built.title, meta.title, canonical.Refeição, canonical.Descrição),
      detail: pickNonEmpty(built.detail, meta.detail, meta.alimentos, canonical.Alimentos),
      alimentos: pickNonEmpty(built.alimentos, meta.alimentos, meta.detail, canonical.Alimentos),
      observacao: sanitizeRegistroObservacao(
        pickNonEmpty(built.observacao, meta.observacao, canonical.Observação)
      ),
      registroMode: pickNonEmpty(built.registroMode, meta.registroMode, canonical.Tipo),
      nutritionSummary: pickNonEmpty(built.nutritionSummary, meta.nutritionSummary, canonical.Nutrição),
      kcalLabel: pickNonEmpty(built.kcalLabel, meta.kcalLabel, canonical.Calorias),
      photoUrl: built.photoUrl || meta.photoUrl || null,
      photoRef: pickResolvablePhotoRef(
        built.photoRef,
        meta.photoRef,
        meta.entrySnapshot ? getMealEntryPhotoRef(meta.entrySnapshot) : null,
        extractMealPhotoRefFromText(raw)
      ),
      entryId: meta.entryId || null,
      entrySnapshot: meta.entrySnapshot || null,
      comment,
      rawText: raw,
    };
  }

  const canonical = canonicalRegistroFields(parseRegistroFieldMap(raw));
  const type = detectRegistroChatTypeFromText(raw, canonical);
  if (!type) return null;

  return buildParsedRegistroFromFields(raw, canonical, type);
}

function presentationFromRegistroContext(context = null) {
  if (!context?.type) return null;

  if (context.entrySnapshot) {
    const fromSnapshot = buildRegistroPresentationFromSnapshot({
      type: context.type,
      entry: context.entrySnapshot,
      photoRef: context.photoRef,
      photoUrl: context.photoUrl,
      comment: context.comment,
    });
    if (fromSnapshot) {
      return registroContextForChatMessage(fromSnapshot, fromSnapshot.comment || context.comment);
    }
  }

  if (hasRegistroPresentationFields(context) && !context.entry) {
    return registroContextForChatMessage(context, context.comment);
  }
  if (context.entry) {
    const fromEntry = buildRegistroPresentationFromSnapshot(context);
    if (fromEntry) {
      return registroContextForChatMessage(fromEntry, fromEntry.comment || context.comment);
    }
  }
  if (!hasRegistroPresentationFields(context)) return null;
  return registroContextForChatMessage(context, context.comment);
}

function mergeRegistroPresentation(contextPresentation = null, parsedFromText = null) {
  if (!parsedFromText?.type && !contextPresentation?.type) return null;
  const pick = (key) => {
    const fromParsed = parsedFromText?.[key];
    if (fromParsed != null && String(fromParsed).trim() !== '') return fromParsed;
    return contextPresentation?.[key] || '';
  };

  const merged = {
    type: parsedFromText?.type || contextPresentation?.type,
    typeLabel: pick('typeLabel') || getRegistroChatTypeLabel(parsedFromText?.type || contextPresentation?.type),
    dateLabel: pick('dateLabel'),
    timeLabel: pick('timeLabel'),
    title: pick('title'),
    detail: pick('detail') || pick('alimentos'),
    alimentos: pick('alimentos') || pick('detail'),
    observacao: sanitizeRegistroObservacao(pick('observacao')),
    registroMode: pick('registroMode'),
    nutritionSummary: pick('nutritionSummary'),
    kcalLabel: pick('kcalLabel'),
    photoRef: pickResolvablePhotoRef(
      parsedFromText?.photoRef,
      contextPresentation?.photoRef,
      parsedFromText?.entrySnapshot
        ? getMealEntryPhotoRef(parsedFromText.entrySnapshot)
        : null,
      contextPresentation?.entrySnapshot
        ? getMealEntryPhotoRef(contextPresentation.entrySnapshot)
        : null
    ),
    photoUrl: pick('photoUrl') || null,
    entryId: pickNonEmpty(parsedFromText?.entryId, contextPresentation?.entryId),
    entrySnapshot:
      contextPresentation?.entrySnapshot || parsedFromText?.entrySnapshot || null,
    comment: String(parsedFromText?.comment || contextPresentation?.comment || '').trim(),
  };

  return registroContextForChatMessage(merged, merged.comment);
}

/** Usa contexto anexado na mensagem (envio otimista) ou reconstrói pelo texto salvo no banco. */
function registroParseTextFromMessage(message = null) {
  return String(
    message?.textRaw ||
      message?.texto_bruto ||
      message?.text ||
      message?.texto ||
      message?.body ||
      message?.message ||
      ''
  ).trim();
}

export function resolveRegistroChatPresentation(message = null) {
  if (!message) return null;
  const text = registroParseTextFromMessage(message);
  const parsedFromText = text ? parseRegistroChatMessage(text) : null;
  const rawContext = message?.registroContext || message?.registroPayload || null;
  const fromContext = presentationFromRegistroContext(
    hasRegistroPresentationFields(rawContext) || rawContext?.entry ? rawContext : null
  );
  return mergeRegistroPresentation(fromContext, parsedFromText);
}

function parsePtBrDateTimeLabel(dateLabel = '', timeLabel = '') {
  const dateMatch = String(dateLabel || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const timeMatch = String(timeLabel || '').match(/(\d{2}):(\d{2})/);
  if (!dateMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const year = Number(dateMatch[3]);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const parsed = new Date(year, month, day, hour, minute, 0, 0);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeMealLookupId(value = '') {
  return String(value || '')
    .replace(/^meal-ia-/i, '')
    .trim();
}

function findMatchingMealForRegistro(meals = [], presentation = null) {
  if (!presentation?.type || presentation.type !== 'refeicoes') return null;

  const catalog = ensureArray(meals);
  if (!catalog.length) return null;

  const entryId = normalizeMealLookupId(presentation.entryId);
  if (entryId) {
    const byId = catalog.find((meal) => {
      const candidates = [
        normalizeMealLookupId(meal?.databaseId),
        normalizeMealLookupId(meal?.id),
      ];
      return candidates.includes(entryId);
    });
    if (byId) return byId;
  }

  const target = parsePtBrDateTimeLabel(presentation.dateLabel, presentation.timeLabel);
  if (!target) return null;

  let best = null;
  let bestDiff = Infinity;

  for (const meal of catalog) {
    const instant = parseRegistroInstant(meal);
    if (!instant) continue;
    const diff = Math.abs(instant.getTime() - target.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = meal;
    }
  }

  return bestDiff <= 20 * 60 * 1000 ? best : null;
}

/** Preenche cards de refeição no chat com dados do banco quando o texto salvo está incompleto. */
export function enrichRegistroThreadsWithMealCatalog(thread = [], meals = []) {
  const catalog = ensureArray(meals);
  if (!catalog.length) return ensureArray(thread);

  return ensureArray(thread).map((msg) => {
    const rawText = registroParseTextFromMessage(msg);
    const parsedFromText = rawText ? parseRegistroChatMessage(rawText) : null;
    const fromContext = presentationFromRegistroContext(msg?.registroContext || null);
    let merged = mergeRegistroPresentation(fromContext, parsedFromText);

    if (!merged?.type || merged.type !== 'refeicoes') {
      return msg;
    }

    if (isMealPhotoRefResolvable(merged.photoRef)) {
      return { ...msg, registroContext: merged };
    }

    const meal = findMatchingMealForRegistro(catalog, merged);
    if (!meal) {
      return merged?.type ? { ...msg, registroContext: merged } : msg;
    }

    const rebuilt = buildRegistroChatContext('refeicoes', meal, {
      photoRef: getMealEntryPhotoRef(meal),
    });
    merged = mergeRegistroPresentation(
      registroContextForChatMessage(rebuilt, merged.comment),
      merged
    );

    return {
      ...msg,
      registroContext: merged,
    };
  });
}

/** Garante registroContext em cada item (sempre re-parse do texto + merge). */
export function attachRegistroContextToThreadMessages(thread = [], previousThread = []) {
  const contextByText = new Map();
  for (const msg of ensureArray(previousThread)) {
    if (!msg?.registroContext?.type) continue;
    if (
      !hasRegistroPresentationFields(msg.registroContext) &&
      !msg.registroContext?.entry &&
      !msg.registroContext?.entrySnapshot
    ) {
      continue;
    }
    const key = stripRegistroMetaFromChatText(registroParseTextFromMessage(msg));
    if (key) contextByText.set(key, msg.registroContext);
  }

  return ensureArray(thread).map((msg) => {
    const rawText = registroParseTextFromMessage(msg);
    const text = String(msg?.text || msg?.texto || rawText || '').trim();
    const key = stripRegistroMetaFromChatText(rawText || text);
    const parsedFromText = rawText ? parseRegistroChatMessage(rawText) : null;
    const preserved = key ? contextByText.get(key) : null;
    const metaFromText = rawText ? extractRegistroMetaFromText(rawText) : null;
    const fromContext = presentationFromRegistroContext(
      msg?.registroContext || preserved || metaFromText || null
    );
    const merged = mergeRegistroPresentation(fromContext, parsedFromText);
    if (!merged?.type) return { ...msg, text: text || msg.text, textRaw: rawText || text };
    return {
      ...msg,
      text: text || msg.text,
      textRaw: rawText || text,
      registroContext: merged,
    };
  });
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function isRegistroChatMessage(text = '') {
  return Boolean(parseRegistroChatMessage(text));
}

export function buildRegistroChatMessage(
  type,
  entry,
  { photoUrl = null, photoRef = null } = {}
) {
  const { dateLabel, timeLabel } = formatRegistroDateParts(entry);
  const dateLine = dateLabel === 'Data não informada' ? dateLabel : dateLabel;
  const timeLine = timeLabel || '—';
  const obsFallback = '—';

  if (type === 'glicemia') {
    const valor = entry.valor_mgdl ?? entry.value;
    const lines = [
      'Registro de glicemia:',
      `Data: ${dateLine}`,
      `Hora: ${timeLine}`,
      `Valor: ${valor != null && valor !== '' ? `${valor} mg/dL` : '—'}`,
      line(
        'Observação',
        glucoseObservation(entry) || entry.contexto || entry.context || entry.glucoseType || obsFallback
      ),
    ];
    return lines.filter(Boolean).join('\n');
  }

  if (type === 'medicacao') {
    const nome = entry.medicineName || entry.nome_medicamento || '—';
    const dose = [entry.medicineQuantity || entry.dosagem || entry.dose, entry.medicineUnit]
      .filter(Boolean)
      .join(' ')
      .trim();
    const lines = [
      'Registro de medicação:',
      `Data: ${dateLine}`,
      `Hora: ${timeLine}`,
      `Medicamento: ${nome}`,
      `Dose: ${dose || '—'}`,
      line('Observação', entry.observation || entry.label || entry.descricao || obsFallback),
    ];
    return lines.filter(Boolean).join('\n');
  }

  if (type === 'insulina') {
    const tipo =
      entry.insulinCategory ||
      entry.categoria_insulina ||
      entry.insulinUsage ||
      entry.objetivo_uso ||
      '—';
    const dose = [entry.medicineQuantity || entry.dosagem || entry.dose, entry.medicineUnit || 'UI']
      .filter(Boolean)
      .join(' ')
      .trim();
    const lines = [
      'Registro de insulina:',
      `Data: ${dateLine}`,
      `Hora: ${timeLine}`,
      `Tipo: ${tipo}`,
      `Dose: ${dose || '—'}`,
      line(
        'Observação',
        entry.insulinNotes || entry.observation || entry.label || obsFallback
      ),
    ];
    return lines.filter(Boolean).join('\n');
  }

  if (type === 'refeicoes') {
    const refeicao = mealTitleLabel(entry);
    const alimentos = mealAlimentosLine(entry) || '—';
    const stablePhotoRef = photoRef || getMealEntryPhotoRef(entry);
    const notaLimpa =
      sanitizeRegistroObservacao(entry.aiNote) ||
      sanitizeRegistroObservacao(entry.resumo_ia) ||
      '';
    const nutricao = mealNutritionSummaryLine(entry);
    const kcal = mealKcalLabel(entry);
    const lines = [
      'Registro de refeição:',
      `Data: ${dateLine}`,
      `Hora: ${timeLine}`,
      `Refeição: ${refeicao}`,
      `Alimentos: ${alimentos}`,
      line('Calorias', kcal),
      line('Nutrição', nutricao),
      line('Observação', notaLimpa || obsFallback),
      `Foto: ${(stablePhotoRef || photoUrl) ? 'anexada' : 'Sem foto'}`,
    ];
    if (stablePhotoRef) {
      lines.push(`FotoRef: ${stablePhotoRef}`);
    }
    return lines.filter(Boolean).join('\n');
  }

  return '';
}
