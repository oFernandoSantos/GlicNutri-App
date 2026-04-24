import { supabase } from './configSupabase';

const AUDIT_BUCKET = 'audit-logs';
const AUDIT_PREFIX = 'app';
const MAX_EVENT_FILE_SIZE = 1024 * 1024;

function inferActorType(actor) {
  if (!actor || typeof actor !== 'object') {
    return 'anonimo';
  }

  if (actor.id_nutricionista_uuid || actor.crm_numero || actor.email_acesso) {
    return 'nutricionista';
  }

  if (actor.id_medico_uuid || actor.crm_medico || actor.email_medico) {
    return 'medico';
  }

  if (actor.id_paciente_uuid || actor.cpf_paciente || actor.email_pac || actor.patient_id) {
    return 'paciente';
  }

  return 'anonimo';
}

function buildSafeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {};
  }

  const sanitized = { ...details };
  delete sanitized.senha;
  delete sanitized.senha_pac;
  delete sanitized.senha_nutri;
  delete sanitized.codigo;
  delete sanitized.code;
  delete sanitized.access_token;
  delete sanitized.refresh_token;
  delete sanitized.token;

  return sanitized;
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

function sanitizeFileNamePart(value) {
  return String(value || 'evento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .toLowerCase() || 'evento';
}

function formatDateParts(date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const stamp = [
    year,
    month,
    day,
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
    String(date.getUTCMilliseconds()).padStart(3, '0'),
  ].join('');

  return {
    year,
    month,
    day,
    stamp,
    isoDate: `${year}-${month}-${day}`,
  };
}

function buildAuditLogPayload({
  actor,
  actorType,
  targetPatientId,
  action,
  entity,
  entityId,
  origin = 'app',
  status = 'sucesso',
  details = {},
} = {}) {
  const resolvedActorType = actorType || inferActorType(actor);
  const createdAt = new Date().toISOString();

  return {
    id: buildUuid(),
    createdAt,
    actorType: resolvedActorType,
    actorPatientId:
      resolvedActorType === 'paciente'
        ? actor?.id_paciente_uuid ||
          actor?.patient_id ||
          actor?.user_metadata?.id_paciente_uuid ||
          null
        : null,
    actorNutritionistId:
      resolvedActorType === 'nutricionista' ? actor?.id_nutricionista_uuid || null : null,
    actorName:
      actor?.nome_completo_nutri ||
      actor?.nome_nutri ||
      actor?.nome_completo_medico ||
      actor?.nome_medico ||
      actor?.nome_completo ||
      actor?.user_metadata?.full_name ||
      actor?.email_acesso ||
      actor?.email_medico ||
      actor?.email_pac ||
      actor?.email ||
      null,
    targetPatientId:
      targetPatientId ||
      actor?.id_paciente_uuid ||
      actor?.patient_id ||
      actor?.user_metadata?.id_paciente_uuid ||
      null,
    action,
    entity,
    entityId: entityId ? String(entityId) : null,
    origin,
    status,
    details: buildSafeDetails(details),
  };
}

function buildAuditLogPath(payload) {
  const date = new Date(payload.createdAt || Date.now());
  const { year, month, day, stamp } = formatDateParts(date);
  const actorType = sanitizeFileNamePart(payload.actorType);
  const action = sanitizeFileNamePart(payload.action);

  return `${AUDIT_PREFIX}/${year}-${month}-${day}/${stamp}-${actorType}-${action}-${payload.id}.json`;
}

function encodeTextPayload(value) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }

  const bytes = [];
  for (let index = 0; index < value.length; index += 1) {
    bytes.push(value.charCodeAt(index) & 0xff);
  }

  return Uint8Array.from(bytes);
}

async function readDownloadedText(fileData) {
  if (!fileData) return '';

  if (typeof fileData.text === 'function') {
    return await fileData.text();
  }

  if (typeof fileData.arrayBuffer === 'function') {
    const buffer = await fileData.arrayBuffer();
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(buffer);
    }

    return String.fromCharCode(...new Uint8Array(buffer));
  }

  return '';
}

function parseAuditEvent(text, path) {
  try {
    const payload = JSON.parse(text);
    return {
      ...payload,
      path,
    };
  } catch (_error) {
    return null;
  }
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildRecentDatePrefixes(days) {
  const totalDays = Math.max(Number(days) || 1, 1);
  const base = startOfUtcDay(new Date());
  const prefixes = [];

  for (let index = 0; index < totalDays; index += 1) {
    const current = new Date(base);
    current.setUTCDate(base.getUTCDate() - index);
    prefixes.push(`${AUDIT_PREFIX}/${formatDateParts(current).isoDate}`);
  }

  return prefixes;
}

function matchesFilter(event, filters = {}) {
  const actorType = String(filters.actorType || '').trim();
  const action = String(filters.action || '').trim().toLowerCase();
  const status = String(filters.status || '').trim().toLowerCase();
  const search = String(filters.search || '').trim().toLowerCase();

  if (actorType && event.actorType !== actorType) {
    return false;
  }

  if (action && !String(event.action || '').toLowerCase().includes(action)) {
    return false;
  }

  if (status && String(event.status || '').toLowerCase() !== status) {
    return false;
  }

  if (!search) {
    return true;
  }

  const searchableParts = [
    event.actorName,
    event.actorType,
    event.action,
    event.entity,
    event.entityId,
    event.targetPatientId,
    JSON.stringify(event.details || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableParts.includes(search);
}

export async function registrarLogAuditoria(config = {}) {
  if (!config?.action || !config?.entity) {
    return null;
  }

  const payload = buildAuditLogPayload(config);
  const path = buildAuditLogPath(payload);
  const body = JSON.stringify(payload, null, 2);
  const binaryBody = encodeTextPayload(body);

  if (binaryBody.byteLength > MAX_EVENT_FILE_SIZE) {
    console.log('Log de auditoria descartado por tamanho excessivo:', path);
    return null;
  }

  try {
    const { error } = await supabase.storage
      .from(AUDIT_BUCKET)
      .upload(path, binaryBody, {
        contentType: 'application/json',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return {
      ...payload,
      path,
    };
  } catch (error) {
    console.log('Erro ao registrar log de auditoria em arquivo:', error);
    return null;
  }
}

export async function listarEventosAuditoria({
  days = 7,
  limit = 60,
  actorType = '',
  action = '',
  status = '',
  search = '',
} = {}) {
  const prefixes = buildRecentDatePrefixes(days);
  const parsedEvents = [];

  for (const prefix of prefixes) {
    const { data, error } = await supabase.storage.from(AUDIT_BUCKET).list(prefix, {
      limit: Math.max(limit * 2, 50),
      offset: 0,
    });

    if (error) {
      console.log('Erro ao listar arquivos de auditoria:', error);
      continue;
    }

    for (const file of data || []) {
      if (!file?.name || !String(file.name).endsWith('.json')) {
        continue;
      }

      const fullPath = `${prefix}/${file.name}`;
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(AUDIT_BUCKET)
        .download(fullPath);

      if (downloadError) {
        console.log('Erro ao baixar arquivo de auditoria:', downloadError);
        continue;
      }

      const fileText = await readDownloadedText(downloadData);
      const parsed = parseAuditEvent(fileText, fullPath);

      if (parsed && matchesFilter(parsed, { actorType, action, status, search })) {
        parsedEvents.push(parsed);
      }
    }
  }

  return parsedEvents
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, Math.max(Number(limit) || 1, 1));
}
