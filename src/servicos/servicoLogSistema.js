import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './configSupabase';

const SYSTEM_LOG_BUCKET = 'system-logs';
const LOG_PREFIX = 'consulta-sistema';
const LOCAL_LOG_STORAGE_KEY = '@glicnutri:logs_sistema_usuario:v1';
const MAX_LOCAL_LOGS = 300;
const MAX_LOG_FILE_SIZE = 1024 * 1024;

export const TIPOS_HISTORICO_LOG = {
  ABRIR: 'ABRIR',
  CADASTRO: 'CADASTRO',
  ALTERACAO: 'ALTERAÇÃO',
  EXCLUSAO: 'EXCLUSÃO',
  LOGIN: 'LOGIN',
  ERRO: 'ERRO',
  SINCRONIZACAO: 'SINCRONIZAÇÃO',
  ALERTA: 'ALERTA',
};

export const MODULOS_LOG_SISTEMA = {
  LOGIN: 'LOGIN',
  ADMIN: 'ADMIN',
  PACIENTE: 'PACIENTE',
  NUTRICIONISTA: 'NUTRICIONISTA',
  GLICEMIA: 'GLICEMIA',
  ALIMENTACAO: 'ALIMENTAÇÃO',
  PLANO_ALIMENTAR: 'PLANO_ALIMENTAR',
  CONSULTA: 'CONSULTA',
  FIREBASE: 'FIREBASE',
  NOTIFICACAO: 'NOTIFICAÇÃO',
};

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

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatIsoDate(date = new Date()) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function formatStamp(date = new Date()) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    String(date.getUTCMilliseconds()).padStart(3, '0'),
  ].join('');
}

export function formatarDataHoraLog(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function sanitizeFileNamePart(value) {
  return String(value || 'log')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .toLowerCase() || 'log';
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
  if (typeof fileData.text === 'function') return await fileData.text();

  if (typeof fileData.arrayBuffer === 'function') {
    const buffer = await fileData.arrayBuffer();
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(buffer);
    }
    return String.fromCharCode(...new Uint8Array(buffer));
  }

  return '';
}

async function listarLogsLocais() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_LOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

async function salvarLogLocal(log) {
  try {
    const atuais = await listarLogsLocais();
    const proximos = [log, ...atuais.filter((item) => item.id !== log.id)].slice(0, MAX_LOCAL_LOGS);
    await AsyncStorage.setItem(LOCAL_LOG_STORAGE_KEY, JSON.stringify(proximos));
  } catch (_error) {
    /* persistencia remota ainda sera tentada */
  }
}

function normalizarModulo(programa) {
  const normalized = String(programa || MODULOS_LOG_SISTEMA.ADMIN).trim().toUpperCase();
  const semAcento = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (semAcento === 'ALIMENTACAO') return MODULOS_LOG_SISTEMA.ALIMENTACAO;
  if (semAcento === 'NOTIFICACAO') return MODULOS_LOG_SISTEMA.NOTIFICACAO;
  if (Object.values(MODULOS_LOG_SISTEMA).includes(normalized)) return normalized;
  return normalized || MODULOS_LOG_SISTEMA.ADMIN;
}

function normalizarHistorico(tipo) {
  const normalized = String(tipo || TIPOS_HISTORICO_LOG.CADASTRO).trim().toUpperCase();
  const semAcento = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (semAcento === 'ALTERACAO') return TIPOS_HISTORICO_LOG.ALTERACAO;
  if (semAcento === 'EXCLUSAO') return TIPOS_HISTORICO_LOG.EXCLUSAO;
  if (semAcento === 'SINCRONIZACAO') return TIPOS_HISTORICO_LOG.SINCRONIZACAO;
  if (Object.values(TIPOS_HISTORICO_LOG).includes(normalized)) return normalized;
  return normalized || TIPOS_HISTORICO_LOG.CADASTRO;
}

function extrairUsuario(usuario) {
  if (typeof usuario === 'string') {
    return usuario;
  }

  if (!usuario || typeof usuario !== 'object') {
    return '';
  }

  return (
    usuario.nome_completo_admin ||
    usuario.nome_completo_nutri ||
    usuario.nome_nutri ||
    usuario.nome_completo_medico ||
    usuario.nome_medico ||
    usuario.nome_completo ||
    usuario.nome ||
    usuario.user_metadata?.full_name ||
    usuario.email_acesso ||
    usuario.email_pac ||
    usuario.email_nutri ||
    usuario.email ||
    usuario.id_admin_uuid ||
    usuario.id_nutricionista_uuid ||
    usuario.id_paciente_uuid ||
    usuario.id ||
    ''
  );
}

function sanitizeComplemento(value) {
  return String(value || '')
    .replace(/senha\s*[:=]\s*[^|,\s]+/gi, 'senha=[REDACTED]')
    .replace(/token\s*[:=]\s*[^|,\s]+/gi, 'token=[REDACTED]')
    .slice(0, 1200);
}

function getDeviceInfo() {
  const constants = Platform.constants || {};
  const webNavigator = typeof navigator !== 'undefined' ? navigator : null;

  return {
    plataforma: Platform.OS,
    versaoSistema: Platform.Version ? String(Platform.Version) : '',
    fabricante: constants.Manufacturer || constants.Brand || '',
    modelo:
      constants.Model ||
      constants.model ||
      constants.systemName ||
      constants.interfaceIdiom ||
      '',
    userAgent: Platform.OS === 'web' ? webNavigator?.userAgent || '' : '',
  };
}

function formatDeviceInfo(deviceInfo) {
  return [
    deviceInfo?.plataforma,
    deviceInfo?.fabricante,
    deviceInfo?.modelo,
    deviceInfo?.versaoSistema ? `SO ${deviceInfo.versaoSistema}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function criarLogSistema({
  seq,
  programa,
  modulo,
  descricao,
  usuario,
  usuarioEmail,
  historico,
  acao,
  dataHora,
  complemento,
  detalhes,
  stack,
  origem = 'app',
} = {}) {
  const createdAt = dataHora || new Date().toISOString();
  const programaModulo = normalizarModulo(programa || modulo);
  const historicoAcao = normalizarHistorico(historico || acao);
  const resolvedUsuario = usuarioEmail || extrairUsuario(usuario) || 'sistema';
  const dispositivo = getDeviceInfo();
  const dispositivoResumo = formatDeviceInfo(dispositivo);
  const resolvedComplemento =
    complemento ||
    (detalhes && typeof detalhes === 'object' ? JSON.stringify(detalhes) : detalhes) ||
    '';

  return {
    id: buildUuid(),
    seq: seq || '',
    programa: programaModulo,
    modulo: programaModulo,
    descricao: descricao || programaModulo,
    usuario: String(resolvedUsuario),
    historico: historicoAcao,
    acao: historicoAcao,
    dataHora: createdAt,
    createdAt,
    dataHoraFormatada: formatarDataHoraLog(createdAt),
    complemento: sanitizeComplemento(resolvedComplemento),
    dispositivo,
    dispositivoResumo,
    detalhes: {
      ...(detalhes && typeof detalhes === 'object' && !Array.isArray(detalhes)
        ? detalhes
        : detalhes
          ? { valor: detalhes }
          : {}),
      dispositivo,
    },
    stack: stack || '',
    origem,
    plataforma: Platform.OS,
  };
}

function buildLogPath(log) {
  const date = new Date(log.createdAt || Date.now());
  return `${LOG_PREFIX}/${formatIsoDate(date)}/${formatStamp(date)}-${sanitizeFileNamePart(log.programa)}-${sanitizeFileNamePart(log.historico)}-${log.id}.txt`;
}

function parseLogSistemaText(text, path) {
  try {
    const payload = JSON.parse(text);
    return {
      ...payload,
      path,
      dataHoraFormatada: payload.dataHoraFormatada || formatarDataHoraLog(payload.dataHora || payload.createdAt),
    };
  } catch (_error) {
    return null;
  }
}

function buildRecentDatePrefixes(days, prefix = LOG_PREFIX) {
  const totalDays = Math.max(Number(days) || 1, 1);
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const prefixes = [];

  for (let index = 0; index < totalDays; index += 1) {
    const current = new Date(base);
    current.setUTCDate(base.getUTCDate() - index);
    prefixes.push(`${prefix}/${formatIsoDate(current)}`);
  }

  return prefixes;
}

function parseFilterDate(value, endOfDay = false) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  let date = null;
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    date = new Date(Number(year), Number(month) - 1, Number(day));
  } else if (brMatch) {
    const [, day, month, year] = brMatch;
    date = new Date(Number(year), Number(month) - 1, Number(day));
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

function matchesLogFilter(log, filters = {}) {
  const dataInicial = parseFilterDate(filters.dataInicial);
  const dataFinal = parseFilterDate(filters.dataFinal, true);
  const usuario = normalizeSearchText(filters.usuario);
  const modulo = normalizeSearchText(filters.modulo || filters.programa);
  const historico = normalizeSearchText(filters.historico || filters.acao);
  const complemento = normalizeSearchText(filters.complemento || filters.search);
  const createdAt = new Date(log.dataHora || log.createdAt || 0);

  if (dataInicial && (!createdAt || createdAt < dataInicial)) return false;
  if (dataFinal && (!createdAt || createdAt > dataFinal)) return false;

  if (usuario && !normalizeSearchText(log.usuario).includes(usuario)) return false;
  if (modulo && !normalizeSearchText(log.programa || log.modulo).includes(modulo)) return false;
  if (historico && !normalizeSearchText(log.historico || log.acao).includes(historico)) return false;

  if (complemento) {
    const searchable = [
      log.descricao,
      log.complemento,
      log.historico,
      log.programa,
      JSON.stringify(log.detalhes || {}),
      log.stack,
    ]
      .filter(Boolean)
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!searchable.includes(complemento)) return false;
  }

  return true;
}

function prepararLogsParaTabela(logs, limit) {
  return logs
    .sort((left, right) => String(right.dataHora || right.createdAt || '').localeCompare(String(left.dataHora || left.createdAt || '')))
    .slice(0, Math.max(Number(limit) || 1, 1))
    .map((item, index) => ({
      ...item,
      seq: item.seq || String(index + 1).padStart(3, '0'),
      dataHoraFormatada: item.dataHoraFormatada || formatarDataHoraLog(item.dataHora || item.createdAt),
    }));
}

async function listarLogsPorPrefixo(prefix, limit, parser) {
  const parsedLogs = [];
  const { data, error } = await supabase.storage.from(SYSTEM_LOG_BUCKET).list(prefix, {
    limit: Math.max(limit * 2, 80),
    offset: 0,
  });

  if (error) return parsedLogs;

  for (const file of data || []) {
    const fileName = String(file?.name || '');
    if (!fileName.endsWith('.json') && !fileName.endsWith('.txt')) continue;

    const fullPath = `${prefix}/${fileName}`;
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(SYSTEM_LOG_BUCKET)
      .download(fullPath);

    if (downloadError) continue;

    const parsed = parser(await readDownloadedText(downloadData), fullPath);
    if (parsed) parsedLogs.push(parsed);
  }

  return parsedLogs;
}

export const exemplosLogsSistema = [
  criarLogSistema({
    seq: '001',
    programa: MODULOS_LOG_SISTEMA.LOGIN,
    descricao: 'Tela de autenticacao',
    usuario: 'paciente@email.com',
    historico: TIPOS_HISTORICO_LOG.LOGIN,
    dataHora: '2026-05-06T20:15:22',
    complemento: 'Login efetuado com sucesso',
    origem: 'exemplo',
  }),
  criarLogSistema({
    seq: '002',
    programa: MODULOS_LOG_SISTEMA.GLICEMIA,
    descricao: 'Registro de glicemia',
    usuario: 'paciente@email.com',
    historico: TIPOS_HISTORICO_LOG.ALTERACAO,
    dataHora: '2026-05-06T20:18:10',
    complemento: 'Valor anterior: 120 mg/dL | Valor novo: 180 mg/dL',
    origem: 'exemplo',
  }),
  criarLogSistema({
    seq: '003',
    programa: MODULOS_LOG_SISTEMA.PLANO_ALIMENTAR,
    descricao: 'Plano alimentar do paciente',
    usuario: 'nutricionista@email.com',
    historico: TIPOS_HISTORICO_LOG.CADASTRO,
    dataHora: '2026-05-06T20:22:44',
    complemento: 'Novo plano alimentar vinculado ao paciente',
    origem: 'exemplo',
  }),
];

export async function salvarLogSistema(config = {}) {
  const log = criarLogSistema(config);
  const path = buildLogPath(log);
  const body = JSON.stringify(log, null, 2);
  const encoded = encodeTextPayload(body);

  if (encoded.byteLength > MAX_LOG_FILE_SIZE) {
    return null;
  }

  await salvarLogLocal(log);
  internalWriteInProgress = true;

  try {
    const { error } = await supabase.storage
      .from(SYSTEM_LOG_BUCKET)
      .upload(path, encoded, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (error) throw error;

    return {
      ...log,
      path,
    };
  } catch (error) {
    void error;
    return log;
  } finally {
    internalWriteInProgress = false;
  }
}

export async function listarLogsSistema({
  days = 30,
  limit = 120,
  dataInicial = '',
  dataFinal = '',
  usuario = '',
  modulo = '',
  programa = '',
  historico = '',
  acao = '',
  complemento = '',
  search = '',
  incluirExemplos = true,
  level = '',
} = {}) {
  const prefixes = buildRecentDatePrefixes(days, LOG_PREFIX);
  const logs = await listarLogsLocais();

  for (const prefix of prefixes) {
    logs.push(...(await listarLogsPorPrefixo(prefix, limit, parseLogSistemaText)));
  }

  const logsUnicos = Array.from(
    new Map(logs.filter(Boolean).map((item) => [item.id || `${item.dataHora}-${item.programa}-${item.complemento}`, item])).values()
  );

  const filtrosAtivos = {
    dataInicial,
    dataFinal,
    usuario,
    modulo: modulo || programa,
    historico: historico || acao || level,
    complemento: complemento || search,
  };

  const filtered = logsUnicos
    .filter((item) => String(item.usuario || '').trim().toLowerCase() !== 'sistema')
    .filter((item) => !String(item.programa || '').toLowerCase().startsWith('console.'))
    .filter((item) => matchesLogFilter(item, filtrosAtivos));

  if (filtered.length) {
    return prepararLogsParaTabela(filtered, limit);
  }

  if (incluirExemplos) {
    const exemplosFiltrados = exemplosLogsSistema.filter((item) => matchesLogFilter(item, filtrosAtivos));
    return prepararLogsParaTabela(exemplosFiltrados, limit);
  }

  return [];
}

export async function registrarLogSistema({
  level = 'log',
  source = 'app',
  message = '',
  context = null,
  stack = '',
} = {}) {
  void level;
  void source;
  void message;
  void context;
  void stack;
  return null;
}

export const AppLogger = {
  registrar(config) {
    return salvarLogSistema(config);
  },
  abrir(programa, descricao, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.CADASTRO,
    });
  },
  cadastro(programa, descricao, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.CADASTRO,
    });
  },
  alteracao(programa, descricao, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.ALTERACAO,
    });
  },
  exclusao(programa, descricao, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.EXCLUSAO,
    });
  },
  login(programa, descricao, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.LOGIN,
    });
  },
  erro(programa, descricao, error, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.ERRO,
      complemento: options.complemento || error?.message || String(error || ''),
      stack: error?.stack || options.stack || '',
    });
  },
  sincronizacao(programa, descricao, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.SINCRONIZACAO,
    });
  },
  alerta(programa, descricao, options = {}) {
    return salvarLogSistema({
      ...options,
      programa,
      descricao,
      historico: TIPOS_HISTORICO_LOG.ALERTA,
    });
  },
};

export function configurarCapturaGlobalLogs() {
  if (captureConfigured) return;

  captureConfigured = true;
  originalConsoleMethods = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const globalHandler = globalThis?.ErrorUtils?.getGlobalHandler?.();
  if (globalThis?.ErrorUtils?.setGlobalHandler) {
    globalThis.ErrorUtils.setGlobalHandler((error, isFatal) => {
      if (typeof globalHandler === 'function') {
        globalHandler(error, isFatal);
      }
    });
  }
}
