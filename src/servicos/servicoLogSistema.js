import { Platform } from 'react-native';
import { supabase } from './configSupabase';

const SYSTEM_LOG_BUCKET = 'system-logs';
const SYSTEM_LOG_PREFIX = 'runtime';
const MAX_LOG_FILE_SIZE = 1024 * 1024;

let captureConfigured = false;
let internalWriteInProgress = false;
let originalConsoleMethods = null;

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

function stringifyValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function normalizeConsoleArgs(args) {
  return args.map((item) => stringifyValue(item)).join(' ');
}

function buildLogText({
  createdAt,
  level,
  source,
  message,
  context,
  stack,
}) {
  const contextText = context ? JSON.stringify(context, null, 2) : '';

  return [
    `createdAt=${createdAt}`,
    `level=${level}`,
    `source=${source}`,
    `platform=${Platform.OS}`,
    '---',
    'message:',
    String(message || ''),
    '---',
    'context:',
    contextText,
    '---',
    'stack:',
    String(stack || ''),
  ].join('\n');
}

function buildSystemLogPath({ createdAt, level, source, id }) {
  const date = new Date(createdAt || Date.now());
  const { isoDate, stamp } = formatDateParts(date);
  return `${SYSTEM_LOG_PREFIX}/${isoDate}/${stamp}-${sanitizeFileNamePart(level)}-${sanitizeFileNamePart(source)}-${id}.txt`;
}

function parseSystemLogText(text, path) {
  const normalized = String(text || '');
  const [headerBlock = '', ...sections] = normalized.split('\n---\n');
  const headers = Object.fromEntries(
    headerBlock
      .split('\n')
      .map((line) => line.split('='))
      .filter((entry) => entry.length >= 2)
      .map(([key, ...rest]) => [key, rest.join('=').trim()])
  );

  const messageSection = sections[0] || '';
  const contextSection = sections[1] || '';
  const stackSection = sections[2] || '';
  const message = messageSection.replace(/^message:\n?/i, '').trim();
  const contextRaw = contextSection.replace(/^context:\n?/i, '').trim();
  const stack = stackSection.replace(/^stack:\n?/i, '').trim();

  let context = null;
  if (contextRaw) {
    try {
      context = JSON.parse(contextRaw);
    } catch (_error) {
      context = contextRaw;
    }
  }

  return {
    id: path.split('/').pop() || buildUuid(),
    createdAt: headers.createdAt || '',
    level: headers.level || 'log',
    source: headers.source || 'app',
    platform: headers.platform || Platform.OS,
    message,
    context,
    stack,
    path,
  };
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
    prefixes.push(`${SYSTEM_LOG_PREFIX}/${formatDateParts(current).isoDate}`);
  }

  return prefixes;
}

function matchesSystemLogFilter(item, filters = {}) {
  const level = String(filters.level || '').trim().toLowerCase();
  const search = String(filters.search || '').trim().toLowerCase();

  if (level && String(item.level || '').toLowerCase() !== level) {
    return false;
  }

  if (!search) {
    return true;
  }

  const searchableText = [
    item.level,
    item.source,
    item.message,
    item.stack,
    typeof item.context === 'string' ? item.context : JSON.stringify(item.context || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes(search);
}

export async function registrarLogSistema({
  level = 'log',
  source = 'app',
  message = '',
  context = null,
  stack = '',
} = {}) {
  const createdAt = new Date().toISOString();
  const id = buildUuid();
  const path = buildSystemLogPath({ createdAt, level, source, id });
  const body = buildLogText({ createdAt, level, source, message, context, stack });
  const encoded = encodeTextPayload(body);

  if (encoded.byteLength > MAX_LOG_FILE_SIZE) {
    return null;
  }

  internalWriteInProgress = true;

  try {
    const { error } = await supabase.storage
      .from(SYSTEM_LOG_BUCKET)
      .upload(path, encoded, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return {
      id,
      createdAt,
      level,
      source,
      message,
      context,
      stack,
      path,
    };
  } catch (error) {
    originalConsoleMethods?.error?.('Erro ao gravar log do sistema:', error);
    return null;
  } finally {
    internalWriteInProgress = false;
  }
}

export async function listarLogsSistema({
  days = 7,
  limit = 80,
  level = '',
  search = '',
} = {}) {
  const prefixes = buildRecentDatePrefixes(days);
  const parsedLogs = [];

  for (const prefix of prefixes) {
    const { data, error } = await supabase.storage.from(SYSTEM_LOG_BUCKET).list(prefix, {
      limit: Math.max(limit * 2, 50),
      offset: 0,
    });

    if (error) {
      originalConsoleMethods?.error?.('Erro ao listar arquivos de log do sistema:', error);
      continue;
    }

    for (const file of data || []) {
      if (!file?.name || !String(file.name).endsWith('.txt')) {
        continue;
      }

      const fullPath = `${prefix}/${file.name}`;
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(SYSTEM_LOG_BUCKET)
        .download(fullPath);

      if (downloadError) {
        originalConsoleMethods?.error?.('Erro ao baixar arquivo de log do sistema:', downloadError);
        continue;
      }

      const text = await readDownloadedText(downloadData);
      const parsed = parseSystemLogText(text, fullPath);

      if (matchesSystemLogFilter(parsed, { level, search })) {
        parsedLogs.push(parsed);
      }
    }
  }

  return parsedLogs
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, Math.max(Number(limit) || 1, 1));
}

export function configurarCapturaGlobalLogs() {
  if (captureConfigured) {
    return;
  }

  captureConfigured = true;
  originalConsoleMethods = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  ['log', 'warn', 'error'].forEach((level) => {
    const originalMethod = originalConsoleMethods[level];

    console[level] = (...args) => {
      originalMethod(...args);

      if (internalWriteInProgress) {
        return;
      }

      registrarLogSistema({
        level,
        source: `console.${level}`,
        message: normalizeConsoleArgs(args),
      });
    };
  });

  const globalHandler = globalThis?.ErrorUtils?.getGlobalHandler?.();
  if (globalThis?.ErrorUtils?.setGlobalHandler) {
    globalThis.ErrorUtils.setGlobalHandler((error, isFatal) => {
      registrarLogSistema({
        level: 'error',
        source: isFatal ? 'global.fatal' : 'global.error',
        message: error?.message || 'Erro global nao tratado.',
        stack: error?.stack || '',
        context: {
          isFatal: Boolean(isFatal),
          name: error?.name || 'Error',
        },
      });

      if (typeof globalHandler === 'function') {
        globalHandler(error, isFatal);
      }
    });
  }

  if (typeof window !== 'undefined' && window?.addEventListener) {
    window.addEventListener('error', (event) => {
      registrarLogSistema({
        level: 'error',
        source: 'window.error',
        message: event?.message || 'Erro de janela nao tratado.',
        stack: event?.error?.stack || '',
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      registrarLogSistema({
        level: 'error',
        source: 'window.unhandledrejection',
        message: stringifyValue(event?.reason || 'Promise rejeitada sem tratamento.'),
      });
    });
  }
}
