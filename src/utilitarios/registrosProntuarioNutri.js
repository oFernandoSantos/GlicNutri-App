/**
 * Formatação, busca e mensagens de chat — registros do paciente (acesso Nutri).
 */
import { getMealEntryPhotoRef } from '../servicos/servicoRefeicaoIA';

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
      .map((item) => item?.name || item?.alimento || item?.nome)
      .filter(Boolean)
      .join(', ');
  }
  return String(entry.description || entry.resumo_ia || '').trim();
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

function sanitizeRegistroObservacao(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^storage:\/\//i.test(text)) return '';
  if (/^https?:\/\//i.test(text) && text.length > 120) return '';
  if (text.startsWith('{') && text.endsWith('}')) return '';
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
      description: entry.description,
      foods: entry.foods,
      foto_url: entry.foto_url,
      fotoUrl: entry.fotoUrl,
      photoUrl: entry.photoUrl,
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
    title = entry.title || entry.nome || entry.tipo_refeicao || entry.mealLabel || 'Refeição';
    detail = mealFoodsText(entry) || entry.description || entry.resumo_ia || '';
  }

  const resolvedPhotoRef =
    photoRef || (type === 'refeicoes' ? getMealEntryPhotoRef(entry) : null) || null;

  return {
    type,
    typeLabel: getRegistroChatTypeLabel(type),
    dateLabel,
    timeLabel,
    title: String(title || '').trim(),
    detail: String(detail || '').trim(),
    photoUrl: photoUrl || null,
    photoRef: resolvedPhotoRef,
    entry: slimRegistroEntryForChat(type, entry),
  };
}

export function buildRegistroChatMessageFromContext(context = {}, options = {}) {
  const { type, entry, photoRef } = context || {};
  const comment = String(options.comment || '').trim();
  if (!type || !entry) return comment;
  const base = buildRegistroChatMessage(type, entry, {
    photoRef: photoRef || (type === 'refeicoes' ? getMealEntryPhotoRef(entry) : null),
  });
  if (!comment) return base;
  return base ? `${base}\nMensagem: ${comment}` : comment;
}

export function parseRegistroChatMessage(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const type = Object.keys(REGISTRO_CHAT_HEADERS).find((key) =>
    raw.startsWith(REGISTRO_CHAT_HEADERS[key])
  );
  if (!type) return null;

  const fields = {};
  raw.split('\n').slice(1).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) return;
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (label) fields[label] = value;
  });

  const foto = fields.Foto || '';
  const photoRef = String(fields.FotoRef || '').trim() || null;
  const photoUrl =
    foto &&
    foto !== 'Sem foto' &&
    foto !== 'anexada' &&
    (foto.startsWith('http') || foto.startsWith('file') || foto.startsWith('data:'))
      ? foto
      : null;

  const titleByType =
    type === 'refeicoes'
      ? fields.Descrição || fields['Descrição'] || ''
      : fields.Valor || fields.Medicamento || fields.Tipo || '';

  const comment = String(fields.Mensagem || fields['Mensagem da nutricionista'] || '').trim();

  return {
    type,
    typeLabel: getRegistroChatTypeLabel(type),
    dateLabel: fields.Data || '',
    timeLabel: fields.Hora || '',
    title: titleByType,
    detail:
      type === 'refeicoes'
        ? fields.Alimentos || fields['Observação'] || fields.Observação || ''
        : fields.Dose ||
          fields['Observação'] ||
          fields.Observação ||
          fields.Alimentos ||
          '',
    photoUrl,
    photoRef,
    comment,
    rawText: raw,
  };
}

export function buildRegistroChatMessage(type, entry, { photoUrl = null, photoRef = null } = {}) {
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
    const descricao = entry.title || entry.nome || entry.tipo_refeicao || entry.mealLabel || '—';
    const alimentos = mealFoodsText(entry) || '—';
    const stablePhotoRef = photoRef || getMealEntryPhotoRef(entry);
    const lines = [
      'Registro de refeição:',
      `Data: ${dateLine}`,
      `Hora: ${timeLine}`,
      `Descrição: ${descricao}`,
      `Alimentos: ${alimentos}`,
      line(
        'Observação',
        sanitizeRegistroObservacao(entry.aiNote) ||
          sanitizeRegistroObservacao(entry.resumo_ia) ||
          obsFallback
      ),
      `Foto: ${(stablePhotoRef || photoUrl) ? 'anexada' : 'Sem foto'}`,
    ];
    if (stablePhotoRef) {
      lines.push(`FotoRef: ${stablePhotoRef}`);
    }
    return lines.filter(Boolean).join('\n');
  }

  return '';
}
