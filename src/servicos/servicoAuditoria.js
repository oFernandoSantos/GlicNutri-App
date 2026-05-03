import { supabase, supabaseUrl, supabaseAnonKey } from './configSupabase';

const AUDIT_BUCKET = 'audit-logs';
const AUDIT_PREFIX = 'app';
const MAX_EVENT_FILE_SIZE = 1024 * 1024;

function inferActorType(actor) {
  if (!actor || typeof actor !== 'object') {
    return 'anonimo';
  }

  if (
    actor.tipo_perfil === 'admin' ||
    actor.perfil === 'admin' ||
    actor.id_admin_uuid
  ) {
    return 'admin';
  }

  if (actor.id_nutricionista_uuid || actor.crm_numero) {
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
  delete sanitized.foto_url;
  delete sanitized.url_foto;
  delete sanitized.imagem_base64;

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
    actorAdminId: resolvedActorType === 'admin' ? actor?.id_admin_uuid || null : null,
    actorName:
      actor?.nome_completo_admin ||
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

function isAuditJsonFile(name) {
  return Boolean(name && String(name).toLowerCase().endsWith('.json'));
}

function isLikelyStorageFolder(item) {
  if (!item || !item.name) {
    return false;
  }

  return !isAuditJsonFile(item.name);
}

function isEventWithinDays(event, days) {
  const totalDays = Math.max(Number(days) || 1, 1);
  const createdAt = new Date(event?.createdAt || 0);

  if (Number.isNaN(createdAt.getTime())) {
    return true;
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCDate(now.getUTCDate() - (totalDays - 1));
  cutoff.setUTCHours(0, 0, 0, 0);

  return createdAt >= cutoff;
}

async function collectAuditJsonPaths(prefix, options = {}) {
  const maxItems = Math.max(Number(options.maxItems) || 120, 1);
  const maxDepth = Math.max(Number(options.maxDepth) || 4, 0);
  const currentDepth = Math.max(Number(options.currentDepth) || 0, 0);
  const visited = options.visited || new Set();

  if (!prefix || visited.has(prefix) || currentDepth > maxDepth) {
    return [];
  }

  visited.add(prefix);

  const { data, error } = await supabase.storage.from(AUDIT_BUCKET).list(prefix, {
    limit: maxItems,
    offset: 0,
  });

  if (error) {
    console.log('Erro ao listar arquivos de auditoria:', error);
    return [];
  }

  const filePaths = [];

  for (const item of data || []) {
    if (!item?.name) {
      continue;
    }

    const fullPath = `${prefix}/${item.name}`;

    if (isAuditJsonFile(item.name)) {
      filePaths.push(fullPath);
      if (filePaths.length >= maxItems) {
        break;
      }
      continue;
    }

    if (!isLikelyStorageFolder(item)) {
      continue;
    }

    const nestedPaths = await collectAuditJsonPaths(fullPath, {
      maxItems: Math.max(maxItems - filePaths.length, 1),
      maxDepth,
      currentDepth: currentDepth + 1,
      visited,
    });

    filePaths.push(...nestedPaths);

    if (filePaths.length >= maxItems) {
      break;
    }
  }

  return filePaths;
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

function buildStorageUploadBody(jsonString) {
  if (typeof Blob !== 'undefined') {
    return new Blob([jsonString], { type: 'application/json' });
  }
  return jsonString;
}

async function downloadAuditObjectViaRest(fullPath) {
  const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');
  const url = `${supabaseUrl}/storage/v1/object/${AUDIT_BUCKET}/${encodedPath}`;
  const { data: sessionData } = await supabase.auth.getSession();
  const bearer = sessionData?.session?.access_token || supabaseAnonKey;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!response.ok) {
    return { ok: false, text: '' };
  }

  const text = await response.text();
  return { ok: true, text };
}

async function uploadAuditLogViaStorageRest(path, bodyString) {
  const { data: sessionData } = await supabase.auth.getSession();
  const bearer = sessionData?.session?.access_token || supabaseAnonKey;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `${supabaseUrl}/storage/v1/object/${AUDIT_BUCKET}/${encodedPath}?upsert=false`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: bodyString,
  });

  let payloadText = '';
  try {
    payloadText = await response.text();
  } catch (_e) {
    payloadText = '';
  }

  if (!response.ok) {
    let message = payloadText || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(payloadText);
      message = parsed.message || parsed.error || parsed.msg || message;
    } catch (_e) {
      /* mantém message */
    }
    return { ok: false, error: new Error(String(message)), status: response.status };
  }

  let parsedData = null;
  if (payloadText) {
    try {
      parsedData = JSON.parse(payloadText);
    } catch (_e) {
      parsedData = { raw: payloadText };
    }
  }

  return { ok: true, data: parsedData };
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

  console.log('AUDITORIA CHAMADA', payload);

  try {
    const uploadBody = buildStorageUploadBody(body);
    const uploadResult = await supabase.storage
      .from(AUDIT_BUCKET)
      .upload(path, uploadBody, {
        contentType: 'application/json',
        upsert: false,
      });

    console.log('UPLOAD RESULT', uploadResult);

    if (!uploadResult.error) {
      return {
        ...payload,
        path,
      };
    }

    console.error('ERRO AUDITORIA', uploadResult.error);
    console.log('AUDITORIA tentativa REST apos falha do SDK', {
      sdkMessage: uploadResult.error?.message || '',
    });

    const restResult = await uploadAuditLogViaStorageRest(path, body);
    console.log('UPLOAD RESULT REST', restResult);

    if (restResult.ok) {
      return {
        ...payload,
        path,
      };
    }

    console.error('ERRO AUDITORIA', restResult.error);
    return null;
  } catch (error) {
    console.error('ERRO AUDITORIA', error);

    try {
      const restResult = await uploadAuditLogViaStorageRest(path, body);
      console.log('UPLOAD RESULT REST', restResult);
      if (restResult.ok) {
        return {
          ...payload,
          path,
        };
      }
      console.error('ERRO AUDITORIA', restResult.error);
    } catch (restError) {
      console.error('ERRO AUDITORIA', restError);
    }

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
  const attemptedPaths = new Set();

  async function processAuditPath(fullPath) {
    if (!fullPath || attemptedPaths.has(fullPath)) {
      return;
    }

    attemptedPaths.add(fullPath);

    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(AUDIT_BUCKET)
      .download(fullPath);

    let fileText = '';
    if (!downloadError && downloadData) {
      fileText = await readDownloadedText(downloadData);
    }

    if (!fileText || !String(fileText).trim()) {
      const restDl = await downloadAuditObjectViaRest(fullPath);
      if (restDl.ok && restDl.text) {
        fileText = restDl.text;
      }
    }

    if (downloadError && !fileText) {
      console.log('Erro ao baixar arquivo de auditoria:', downloadError);
    }

    if (!fileText || !String(fileText).trim()) {
      return;
    }

    const parsed = parseAuditEvent(fileText, fullPath);

    if (
      parsed &&
      isEventWithinDays(parsed, days) &&
      matchesFilter(parsed, { actorType, action, status, search })
    ) {
      parsedEvents.push(parsed);
    }
  }

  for (const prefix of prefixes) {
    const auditPaths = await collectAuditJsonPaths(prefix, {
      maxItems: Math.max(limit * 2, 50),
      maxDepth: 2,
    });

    for (const fullPath of auditPaths) {
      await processAuditPath(fullPath);
    }
  }

  if (parsedEvents.length === 0) {
    const fallbackPaths = await collectAuditJsonPaths(AUDIT_PREFIX, {
      maxItems: Math.max(limit * 4, 120),
      maxDepth: 4,
    });

    for (const fullPath of fallbackPaths) {
      await processAuditPath(fullPath);
    }
  }

  return parsedEvents
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, Math.max(Number(limit) || 1, 1));
}
