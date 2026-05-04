import { supabase, supabaseUrl, supabaseAnonKey } from './configSupabase';

const AUDIT_BUCKET = 'audit-logs';
const AUDIT_PREFIX = 'app';
const MAX_EVENT_FILE_SIZE = 1024 * 1024;
const AUDIT_DOWNLOAD_CONCURRENCY = 16;
const auditEventCache = new Map();

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

  const pageSize = Math.min(maxItems, 1000);
  const listedItems = [];
  let offset = 0;

  while (listedItems.length < maxItems) {
    const { data, error } = await supabase.storage.from(AUDIT_BUCKET).list(prefix, {
      limit: pageSize,
      offset,
    });

    if (error) {
      console.log('Erro ao listar arquivos de auditoria:', error);
      return [];
    }

    const batch = data || [];
    listedItems.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  const filePaths = [];

  const sortedItems = listedItems.slice(0, maxItems).sort((left, right) =>
    String(right?.name || '').localeCompare(String(left?.name || ''))
  );

  for (const item of sortedItems) {
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

export async function contarEventosAuditoriaTotal({ maxItems = 50000 } = {}) {
  const paths = await collectAuditJsonPaths(AUDIT_PREFIX, {
    maxItems,
    maxDepth: 4,
  });

  return paths.length;
}

async function processInBatches(items, worker, batchSize = AUDIT_DOWNLOAD_CONCURRENCY) {
  const normalizedBatchSize = Math.max(Number(batchSize) || 1, 1);

  for (let index = 0; index < items.length; index += normalizedBatchSize) {
    const batch = items.slice(index, index + normalizedBatchSize);
    await Promise.all(batch.map((item) => worker(item)));
  }
}

function buildProgressiveWindows(days, targetSize) {
  const maxDays = Math.max(Number(days) || 1, 1);
  const windows = [];
  const presets = targetSize <= 20 ? [7, 30, 90, 365] : [30, 90, 365, 1095];

  for (const value of presets) {
    if (value < maxDays) {
      windows.push(value);
    }
  }

  windows.push(maxDays);
  return [...new Set(windows)];
}

function shouldUseRootListing(filters = {}) {
  const hasDateRange = Boolean(String(filters.dateRange || '').trim());
  const hasTextSearch = Boolean(String(filters.search || '').trim());

  return !hasDateRange && !hasTextSearch;
}

function matchesFilter(event, filters = {}) {
  const actorType = String(filters.actorType || '').trim();
  const action = String(filters.action || '').trim().toLowerCase();
  const status = String(filters.status || '').trim().toLowerCase();
  const search = String(filters.search || '').trim().toLowerCase();
  const dateRange = String(filters.dateRange || '').trim();

  if (actorType && event.actorType !== actorType) {
    return false;
  }

  if (action && !String(event.action || '').toLowerCase().includes(action)) {
    return false;
  }

  if (status && String(event.status || '').toLowerCase() !== status) {
    return false;
  }

  if (dateRange) {
    const createdAt = new Date(event?.createdAt || 0);

    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    const normalizedRange = dateRange
      .replace(/\s+/g, ' ')
      .replace(/\./g, '/')
      .replace(/-/g, '/')
      .trim();
    const [startText = '', endText = ''] = normalizedRange.split(' até ');
    const startParts = startText.split('/');
    const endParts = endText.split('/');

    if (startParts.length !== 3 || endParts.length !== 3) {
      return false;
    }

    const [startDay, startMonth, startYear] = startParts;
    const [endDay, endMonth, endYear] = endParts;
    const startDate = new Date(
      Number(startYear),
      Math.max(Number(startMonth) - 1, 0),
      Number(startDay),
      0,
      0,
      0,
      0
    );
    const endDate = new Date(
      Number(endYear),
      Math.max(Number(endMonth) - 1, 0),
      Number(endDay),
      23,
      59,
      59,
      999
    );

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return false;
    }

    if (createdAt < startDate || createdAt > endDate) {
      return false;
    }
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

async function uploadAuditLogViaStorageRest(path, bodyData) {
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
    body: bodyData,
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
    const restResult = await uploadAuditLogViaStorageRest(path, binaryBody);
    console.log('UPLOAD RESULT REST', restResult);

    if (restResult.ok) {
      return {
        ...payload,
        path,
      };
    }

    console.error('ERRO AUDITORIA', restResult.error);
    console.log('AUDITORIA tentativa SDK apos falha do REST', {
      restMessage: restResult.error?.message || '',
    });

    const uploadResult = await supabase.storage
      .from(AUDIT_BUCKET)
      .upload(path, binaryBody, {
        contentType: 'application/json',
        upsert: false,
      });

    console.log('UPLOAD RESULT SDK', uploadResult);

    if (!uploadResult.error) {
      return {
        ...payload,
        path,
      };
    }

    console.error('ERRO AUDITORIA', uploadResult.error);
    return null;
  } catch (error) {
    console.error('ERRO AUDITORIA', error);

    try {
      const uploadResult = await supabase.storage
        .from(AUDIT_BUCKET)
        .upload(path, binaryBody, {
          contentType: 'application/json',
          upsert: false,
        });
      console.log('UPLOAD RESULT SDK', uploadResult);
      if (!uploadResult.error) {
        return {
          ...payload,
          path,
        };
      }
      console.error('ERRO AUDITORIA', uploadResult.error);
    } catch (sdkError) {
      console.error('ERRO AUDITORIA', sdkError);
    }

    return null;
  }
}

export async function listarEventosAuditoria({
  days = 7,
  limit = 60,
  offset = 0,
  actorType = '',
  action = '',
  status = '',
  search = '',
  dateRange = '',
} = {}) {
  const parsedEvents = [];
  const attemptedPaths = new Set();
  const maxWindowSize = Math.max((Number(offset) || 0) + (Number(limit) || 1), 1);
  const shouldStopAfterWindow = maxWindowSize <= 200;
  const effectiveSliceEnd = Math.max((Number(offset) || 0) + (Number(limit) || 1), 1);

  async function processAuditPath(fullPath) {
    if (!fullPath || attemptedPaths.has(fullPath)) {
      return;
    }

    attemptedPaths.add(fullPath);
    const cachedEvent = auditEventCache.get(fullPath);

    if (cachedEvent) {
      if (
        isEventWithinDays(cachedEvent, days) &&
        matchesFilter(cachedEvent, { actorType, action, status, search, dateRange })
      ) {
        parsedEvents.push(cachedEvent);
      }
      return;
    }

    if (shouldStopAfterWindow && parsedEvents.length >= maxWindowSize) {
      return;
    }

    let fileText = '';
    let downloadError = null;

    const restDl = await downloadAuditObjectViaRest(fullPath);
    if (restDl.ok && restDl.text) {
      fileText = restDl.text;
    }

    if (!fileText || !String(fileText).trim()) {
      const downloadResult = await supabase.storage
        .from(AUDIT_BUCKET)
        .download(fullPath);

      downloadError = downloadResult.error;

      if (!downloadResult.error && downloadResult.data) {
        fileText = await readDownloadedText(downloadResult.data);
      }
    }

    if (downloadError && !fileText) {
      console.log('Erro ao baixar arquivo de auditoria:', downloadError);
    }

    if (!fileText || !String(fileText).trim()) {
      return;
    }

    const parsed = parseAuditEvent(fileText, fullPath);
    if (parsed) {
      auditEventCache.set(fullPath, parsed);
    }

    if (
      parsed &&
      isEventWithinDays(parsed, days) &&
      matchesFilter(parsed, { actorType, action, status, search, dateRange })
    ) {
      parsedEvents.push(parsed);
    }
  }

  async function processPathsAndMaybeStop(paths) {
    await processInBatches(paths, processAuditPath);
    return shouldStopAfterWindow && parsedEvents.length >= maxWindowSize;
  }

  if (shouldUseRootListing({ search, dateRange })) {
    const rootMaxItems = Math.max(effectiveSliceEnd * 3, 30);
    const rootPaths = await collectAuditJsonPaths(AUDIT_PREFIX, {
      maxItems: rootMaxItems,
      maxDepth: 4,
    });

    if (rootPaths.length === 0) {
      return [];
    }

    const shouldStop = await processPathsAndMaybeStop(rootPaths);
    if (shouldStop) {
      return parsedEvents
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
        .slice(Math.max(Number(offset) || 0, 0), effectiveSliceEnd);
    }

    if (rootPaths.length < rootMaxItems) {
      return parsedEvents
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
        .slice(Math.max(Number(offset) || 0, 0), effectiveSliceEnd);
    }
  }

  const progressiveWindows = buildProgressiveWindows(days, maxWindowSize);
  const visitedPrefixes = new Set();

  for (const windowDays of progressiveWindows) {
    const prefixes = buildRecentDatePrefixes(windowDays);

    for (const prefix of prefixes) {
      if (visitedPrefixes.has(prefix)) {
        continue;
      }

      visitedPrefixes.add(prefix);

      const auditPaths = await collectAuditJsonPaths(prefix, {
        maxItems: Math.max(maxWindowSize * 2, 30),
        maxDepth: 2,
      });

      const shouldStop = await processPathsAndMaybeStop(auditPaths);
      if (shouldStop) {
        break;
      }
    }

    if (shouldStopAfterWindow && parsedEvents.length >= maxWindowSize) {
      break;
    }
  }

  if (parsedEvents.length === 0) {
    const fallbackPaths = await collectAuditJsonPaths(AUDIT_PREFIX, {
      maxItems: Math.max(maxWindowSize * 3, 60),
      maxDepth: 4,
    });

    await processInBatches(fallbackPaths, processAuditPath);
  }

  return parsedEvents
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(Math.max(Number(offset) || 0, 0), Math.max((Number(offset) || 0) + (Number(limit) || 1), 1));
}
