import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarraAbasAdmin, {
  ADMIN_TAB_BAR_HEIGHT,
  ADMIN_TAB_BAR_SPACE,
} from '../../componentes/admin/BarraAbasAdmin';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';
import {
  AppLogger,
  MODULOS_LOG_SISTEMA,
  TIPOS_HISTORICO_LOG,
  listarLogsSistema,
} from '../../servicos/servicoLogSistema';
import {
  listarEventosAuditoria,
  registrarLogAuditoria,
} from '../../servicos/servicoAuditoria';
import { isAdminUser } from '../../servicos/servicoAdmin';

const historicoOptions = [
  { value: '', label: 'TODOS' },
  { value: TIPOS_HISTORICO_LOG.CADASTRO, label: 'CADASTRO' },
  { value: TIPOS_HISTORICO_LOG.ALTERACAO, label: 'ALTERAÇÃO' },
  { value: TIPOS_HISTORICO_LOG.EXCLUSAO, label: 'EXCLUSÃO' },
  { value: TIPOS_HISTORICO_LOG.LOGIN, label: 'LOGIN' },
  { value: TIPOS_HISTORICO_LOG.ERRO, label: 'ERRO' },
  { value: TIPOS_HISTORICO_LOG.SINCRONIZACAO, label: 'SINCRONIZAÇÃO' },
  { value: TIPOS_HISTORICO_LOG.ALERTA, label: 'ALERTA' },
];
const LOG_LOOKBACK_DAYS = 3650;
const SYSTEM_LOG_LOOKBACK_DAYS = 30;
const LOG_SYSTEM_LIMIT = 50000;
const LOG_AUDIT_LIMIT = 50000;
const LOG_PAGE_SIZE = 10;
const FIXED_HEADER_TOP_OFFSET = 56;

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function buildComplementoComDispositivo(item) {
  const complemento = String(item?.complemento || '');
  const dispositivo = String(item?.dispositivoResumo || '').trim();

  if (!dispositivo) {
    return complemento;
  }

  return complemento ? `${complemento} | Dispositivo: ${dispositivo}` : `Dispositivo: ${dispositivo}`;
}

function buildExportPreview(logs) {
  const header = 'SEQ;Usuário;Programa;Descrição;Ação;Data/Hora;Complemento';
  const rows = logs.map((item) =>
    [
      item.seq,
      item.usuario,
      item.programa,
      item.descricao,
      item.historico,
      item.dataHoraFormatada,
      buildComplementoComDispositivo(item),
    ]
      .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
      .join(';')
  );

  return [header, ...rows].join('\n');
}

function formatDetailValue(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_error) {
      return String(value);
    }
  }
  return String(value);
}

function buildLogTxtCompleto(item) {
  return [
    'GlicNutri - Log completo',
    '========================',
    '',
    `SEQ: ${formatDetailValue(item?.seq)}`,
    `Usuario: ${formatDetailValue(item?.usuario)}`,
    `Programa: ${formatDetailValue(item?.programa || item?.modulo)}`,
    `Descricao: ${formatDetailValue(item?.descricao)}`,
    `Acao: ${formatDetailValue(item?.historico || item?.acao)}`,
    `Data/Hora: ${formatDetailValue(item?.dataHoraFormatada || item?.dataHora || item?.createdAt)}`,
    `Complemento: ${formatDetailValue(buildComplementoComDispositivo(item))}`,
    `Arquivo: ${formatDetailValue(item?.path)}`,
    `Status: ${formatDetailValue(item?.status)}`,
    '',
    'Payload completo',
    '----------------',
    formatDetailValue(item),
  ].join('\n');
}

function buildSelectedLogsTxt(logs) {
  return logs.map((item) => buildLogTxtCompleto(item)).join('\n\n========================================\n\n');
}

function baixarTxtNoWeb(fileName, content) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof Blob === 'undefined') {
    return false;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
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

function applyDateMask(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function humanizarToken(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferirProgramaAuditoria(text) {
  if (text.includes('login') || text.includes('sessao')) return MODULOS_LOG_SISTEMA.LOGIN;
  if (text.includes('glic')) return MODULOS_LOG_SISTEMA.GLICEMIA;
  if (text.includes('refeicao') || text.includes('aliment')) return MODULOS_LOG_SISTEMA.ALIMENTACAO;
  if (text.includes('plano')) return MODULOS_LOG_SISTEMA.PLANO_ALIMENTAR;
  if (text.includes('consulta') || text.includes('agenda') || text.includes('disponibilidade')) return MODULOS_LOG_SISTEMA.CONSULTA;
  if (text.includes('nutri')) return MODULOS_LOG_SISTEMA.NUTRICIONISTA;
  if (text.includes('admin')) return MODULOS_LOG_SISTEMA.ADMIN;
  if (text.includes('notific')) return MODULOS_LOG_SISTEMA.NOTIFICACAO;
  return MODULOS_LOG_SISTEMA.PACIENTE;
}

function inferirHistoricoAuditoria(action, status) {
  const actionText = normalizeSearchText(action);
  const statusText = normalizeSearchText(status);

  if (statusText === 'falha' || actionText.includes('falha') || actionText.includes('erro')) {
    return TIPOS_HISTORICO_LOG.ERRO;
  }
  if (actionText.includes('login')) return TIPOS_HISTORICO_LOG.LOGIN;
  if (statusText === 'alerta' || actionText.includes('alert')) return TIPOS_HISTORICO_LOG.ALERTA;
  if (
    actionText.includes('delete') ||
    actionText.includes('exclu') ||
    actionText.includes('remov') ||
    actionText.includes('ocult') ||
    actionText.includes('arquiv') ||
    actionText.includes('inativ')
  ) {
    return TIPOS_HISTORICO_LOG.EXCLUSAO;
  }
  if (actionText.includes('sync') || actionText.includes('sincron')) return TIPOS_HISTORICO_LOG.SINCRONIZACAO;
  if (
    actionText.includes('create') ||
    actionText.includes('insert') ||
    actionText.includes('cadastro') ||
    actionText.includes('cadastrad') ||
    actionText.includes('registr') ||
    actionText.includes('salv')
  ) {
    return TIPOS_HISTORICO_LOG.CADASTRO;
  }
  return TIPOS_HISTORICO_LOG.ALTERACAO;
}

function montarDescricaoAuditoria(action, entity, programa, historico) {
  const actionText = normalizeSearchText(action);

  if (programa === MODULOS_LOG_SISTEMA.LOGIN) return 'Tela de autenticacao';
  if (programa === MODULOS_LOG_SISTEMA.GLICEMIA) {
    if (historico === TIPOS_HISTORICO_LOG.ALERTA) return 'Alerta de glicemia alta';
    if (historico === TIPOS_HISTORICO_LOG.EXCLUSAO) return 'Exclusao de registro de glicemia';
    if (historico === TIPOS_HISTORICO_LOG.CADASTRO) return 'Registro de glicemia';
    return 'Alteracao de registro de glicemia';
  }
  if (programa === MODULOS_LOG_SISTEMA.ALIMENTACAO) {
    if (historico === TIPOS_HISTORICO_LOG.EXCLUSAO) return 'Exclusao de alimentacao';
    if (historico === TIPOS_HISTORICO_LOG.CADASTRO) return 'Registro de alimentacao';
    return 'Alteracao de alimentacao';
  }
  if (programa === MODULOS_LOG_SISTEMA.PLANO_ALIMENTAR) return 'Plano alimentar do paciente';
  if (actionText.includes('disponibilidade')) return 'Disponibilidade do nutricionista';
  if (actionText.includes('medic')) return 'Registro de medicacao';
  return humanizarToken(entity || action || 'Acao do usuario') || 'Acao do usuario';
}

function montarComplementoAuditoria(event, historico, programa) {
  const action = String(event?.action || 'acao');
  const details = event?.details || {};
  const partes = [];

  if (historico === TIPOS_HISTORICO_LOG.EXCLUSAO) {
    partes.push(programa === MODULOS_LOG_SISTEMA.GLICEMIA
      ? 'Registro de glicemia excluido'
      : `${humanizarToken(event?.entity || 'registro')} excluido`);
  } else if (historico === TIPOS_HISTORICO_LOG.CADASTRO) {
    partes.push(`${humanizarToken(event?.entity || 'registro')} incluido`);
  } else if (historico === TIPOS_HISTORICO_LOG.ALTERACAO) {
    partes.push(`${humanizarToken(event?.entity || 'registro')} alterado`);
  } else if (historico === TIPOS_HISTORICO_LOG.LOGIN) {
    const isGoogle = action.includes('google') || details.provedor === 'google';
    partes.push(action.includes('falha')
      ? `Falha de login${details.motivo ? ` | Motivo: ${details.motivo}` : ''}`
      : isGoogle
        ? 'Login efetuado com sucesso via Google'
        : 'Login efetuado com sucesso');
  } else if (historico === TIPOS_HISTORICO_LOG.ALERTA) {
    partes.push(programa === MODULOS_LOG_SISTEMA.GLICEMIA
      ? 'Alerta gerado por glicemia alta'
      : humanizarToken(action));
  } else {
    partes.push(humanizarToken(action));
  }

  if (details.valorMgDl != null) partes.push(`Valor: ${details.valorMgDl} mg/dL`);
  if (details.valor != null) partes.push(`Valor: ${details.valor}`);
  if (details.data) partes.push(`Data: ${details.data}`);
  if (details.hora) partes.push(`Hora: ${details.hora}`);
  if (details.tipoGlicemia) partes.push(`Tipo: ${details.tipoGlicemia}`);
  if (details.pacienteNome) partes.push(`Paciente: ${details.pacienteNome}`);
  if (details.nomePaciente) partes.push(`Paciente: ${details.nomePaciente}`);
  if (details.email) partes.push(`Email: ${details.email}`);
  if (event?.entityId) partes.push(`ID: ${event.entityId}`);
  if (event?.status) partes.push(`Status: ${event.status}`);
  if (!partes.length) partes.push(`${action} | ${event?.status || 'status nao informado'}`);

  return partes.join(' | ');
}

function mapAuditEventToLog(event) {
  const action = String(event?.action || '').toLowerCase();
  const isGoogle = action.includes('google') || event?.details?.provedor === 'google';

  return {
    id: `audit-${event.id}`,
    seq: '',
    programa: MODULOS_LOG_SISTEMA.LOGIN,
    descricao: 'Tela de autenticação',
    usuario: event.actorName || event.actorPatientId || event.actorNutritionistId || event.actorAdminId || 'Usuário',
    historico: action.includes('falha') ? TIPOS_HISTORICO_LOG.ERRO : TIPOS_HISTORICO_LOG.LOGIN,
    dataHora: event.createdAt,
    createdAt: event.createdAt,
    dataHoraFormatada: formatDateTime(event.createdAt),
    complemento: action.includes('falha')
      ? `Falha de login${event.details?.motivo ? ` | Motivo: ${event.details.motivo}` : ''}`
      : isGoogle
        ? 'Login efetuado com sucesso via Google'
        : 'Login efetuado com sucesso',
    origem: 'auditoria_login',
  };
}

function mapAuditEventToLogUsuario(event) {
  const action = String(event?.action || '').toLowerCase();
  const entity = String(event?.entity || '').toLowerCase();
  const origin = String(event?.origin || '').toLowerCase();
  const details = event?.details || {};
  const text = `${action} ${entity} ${origin}`;

  if (!event || action === 'admin_consulta_logs_sistema') {
    return null;
  }

  const programa = inferirProgramaAuditoria(text);

  const historico = inferirHistoricoAuditoria(action, event?.status);

  const descricao = action.includes('login')
    ? 'Tela de autenticação'
    : action.includes('glic')
      ? 'Registro de glicemia'
      : action.includes('refeicao')
        ? 'Registro de alimentação'
        : action.includes('plano')
          ? 'Plano alimentar do paciente'
          : event?.entity || 'Ação do usuário';

  let complemento = `${event?.action || 'ação'} | ${event?.status || 'status não informado'}`;

  if (action.includes('login')) {
    const isGoogle = action.includes('google') || details.provedor === 'google';
    complemento = action.includes('falha')
      ? `Falha de login${details.motivo ? ` | Motivo: ${details.motivo}` : ''}`
      : isGoogle
        ? 'Login efetuado com sucesso via Google'
        : 'Login efetuado com sucesso';
  }

  if (action.includes('glicemia')) {
    const partes = [];
    if (action.includes('ocult')) partes.push('Registro de glicemia excluído da visão do paciente');
    if (action.includes('cadastrad')) partes.push('Registro de glicemia incluído');
    if (details.valorMgDl != null) partes.push(`Valor: ${details.valorMgDl} mg/dL`);
    if (details.data) partes.push(`Data: ${details.data}`);
    if (details.hora) partes.push(`Hora: ${details.hora}`);
    if (details.tipoGlicemia) partes.push(`Tipo: ${details.tipoGlicemia}`);
    complemento = partes.join(' | ') || complemento;
  }

  const descricaoFinal = montarDescricaoAuditoria(action, event?.entity, programa, historico) || descricao;
  const complementoFinal = montarComplementoAuditoria(event, historico, programa) || complemento;

  return {
    id: `audit-${event.id}`,
    seq: '',
    programa,
    descricao: descricaoFinal,
    usuario: event.actorName || event.actorPatientId || event.actorNutritionistId || event.actorAdminId || 'Usuário',
    historico,
    dataHora: event.createdAt,
    createdAt: event.createdAt,
    dataHoraFormatada: formatDateTime(event.createdAt),
    complemento: complementoFinal,
    detalhes: details,
    path: event.path,
    atorTipo: event.actorType,
    entidade: event.entity,
    entidadeId: event.entityId,
    status: event.status,
    origem: 'auditoria',
  };
}

function matchesTelaFilters(item, filters) {
  const dataInicial = parseFilterDate(filters.dataInicial);
  const dataFinal = parseFilterDate(filters.dataFinal, true);
  const dataHora = new Date(item.dataHora || item.createdAt || 0);
  const usuario = normalizeSearchText(filters.usuario);
  const historico = normalizeSearchText(filters.historico);
  const complemento = normalizeSearchText(filters.complemento);

  if (dataInicial && (!dataHora || dataHora < dataInicial)) return false;
  if (dataFinal && (!dataHora || dataHora > dataFinal)) return false;
  if (usuario && !normalizeSearchText(item.usuario).includes(usuario)) return false;
  if (historico && !normalizeSearchText(item.historico).includes(historico)) return false;

  if (complemento) {
    const searchable = normalizeSearchText([
      item.programa,
      item.descricao,
      item.historico,
      item.complemento,
      item.usuario,
      item.entidade,
      item.entidadeId,
      item.status,
      JSON.stringify(item.detalhes || {}),
    ].filter(Boolean).join(' '));
    if (!searchable.includes(complemento)) return false;
  }

  return true;
}

function prepararResultadoTabela(items) {
  return Array.from(
    new Map(items.filter(Boolean).map((item) => [item.id || `${item.dataHora}-${item.usuario}-${item.historico}`, item])).values()
  )
    .sort((left, right) => String(right.dataHora || right.createdAt || '').localeCompare(String(left.dataHora || left.createdAt || '')))
    .map((item, index) => ({
      ...item,
      seq: String(index + 1).padStart(3, '0'),
      dataHoraFormatada: item.dataHoraFormatada || formatDateTime(item.dataHora || item.createdAt),
    }));
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallbackValue), timeoutMs);
    }),
  ]);
}

export default function TelaLogsSistemaAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allLogs, setAllLogs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadedCount, setLoadedCount] = useState(LOG_PAGE_SIZE);
  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const [detalharLog, setDetalharLog] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [fixedHeaderHeight, setFixedHeaderHeight] = useState(0);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [exportText, setExportText] = useState('');
  const scrollMetricsRef = useRef({
    viewportHeight: 0,
    contentHeight: 0,
    offsetY: 0,
  });
  const [filters, setFilters] = useState({
    dataInicial: '',
    dataFinal: '',
    usuario: '',
    historico: '',
    complemento: '',
  });

  const totalErros = useMemo(
    () => allLogs.filter((item) => item.historico === TIPOS_HISTORICO_LOG.ERRO).length,
    [allLogs]
  );
  const hasMoreLogs = logs.length < totalLogsCount;
  const selectedLogs = useMemo(
    () => logs.filter((item, index) => selectedLogIds.includes(item.path || item.id || `${item.seq}-${index}`)),
    [logs, selectedLogIds]
  );

  function updateFilter(field, value, options = {}) {
    const nextFilters = {
      ...filters,
      [field]: value,
    };

    setFilters(nextFilters);

    if (options.searchAfterChange) {
      carregarLogs({ filtersOverride: nextFilters });
    }
  }

  async function handleLogout() {
    if (adminUser) {
      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'logout_admin',
        entity: 'sessao',
        entityId: adminUser?.id_admin_uuid || null,
        origin: 'admin_logs',
        status: 'sucesso',
        details: {},
      });

      await AppLogger.registrar({
        programa: MODULOS_LOG_SISTEMA.ADMIN,
        descricao: 'Auditoria/Log',
        usuario: adminUser,
        historico: TIPOS_HISTORICO_LOG.LOGIN,
        complemento: 'Administrador saiu da consulta de logs',
      });
    }

    await onAdminLogout?.();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }

  function handleNavigate(routeName, params = {}) {
    navigation.navigate(routeName, { usuarioLogado: adminUser, ...params });
  }

  async function carregarTotalLogs(filtrosConsulta) {
    const [logsSistema, eventosAuditoria] = await Promise.all([
      withTimeout(
        listarLogsSistema({
          days: SYSTEM_LOG_LOOKBACK_DAYS,
          limit: LOG_SYSTEM_LIMIT,
          dataInicial: filtrosConsulta.dataInicial,
          dataFinal: filtrosConsulta.dataFinal,
          usuario: filtrosConsulta.usuario,
          historico: filtrosConsulta.historico,
          complemento: filtrosConsulta.complemento,
          incluirExemplos: false,
        }).catch(() => []),
        8000,
        []
      ),
      withTimeout(
        listarEventosAuditoria({
          days: LOG_LOOKBACK_DAYS,
          limit: LOG_AUDIT_LIMIT,
        }).catch(() => []),
        30000,
        []
      ),
    ]);

    const logsAuditoria = eventosAuditoria
      .map(mapAuditEventToLogUsuario)
      .filter(Boolean)
      .filter((item) => matchesTelaFilters(item, filtrosConsulta));

    return prepararResultadoTabela([...logsSistema, ...logsAuditoria]);
  }

  async function carregarLogs({ isRefresh = false, filtersOverride = null, append = false } = {}) {
    const filtrosConsulta = filtersOverride || filters;
    const targetCount = append ? loadedCount + LOG_PAGE_SIZE : LOG_PAGE_SIZE;

    try {
      if (append) {
        setLoadingMore(true);
        const nextCount = Math.min(targetCount, allLogs.length);
        setLoadedCount(nextCount);
        setLogs(allLogs.slice(0, nextCount));
        return;
      } else if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await carregarTotalLogs(filtrosConsulta);
      const firstPageCount = Math.min(LOG_PAGE_SIZE, data.length);

      setAllLogs(data);
      setLogs(data.slice(0, firstPageCount));
      setLoadedCount(firstPageCount);
      setTotalLogsCount(data.length);
      setSelectedLogIds([]);
      setExportText('');
      setRefreshing(false);
      setLoading(false);

      if (isAdminUser(adminUser)) {
        registrarLogAuditoria({
          actor: adminUser,
          actorType: 'admin',
          action: 'admin_consulta_logs_sistema',
          entity: 'painel_logs',
          entityId: adminUser?.id_admin_uuid || null,
          origin: 'admin_logs',
          status: 'sucesso',
          details: {
            filtros: filtrosConsulta,
            resultado_logs: data.length,
          },
        }).catch(() => {});
      }
    } catch (error) {
      await AppLogger.erro(MODULOS_LOG_SISTEMA.ADMIN, 'Erro ao consultar logs do sistema', error, {
        usuario: adminUser,
        complemento: error?.message || 'Falha ao carregar consulta de logs',
      });
      Alert.alert('Erro', 'Nao foi possivel consultar os logs agora.');
    } finally {
      setLoadingMore(false);
      setRefreshing(false);
      setLoading(false);
    }
  }

  function handleSelecionarLog(item) {
    navigation.navigate('AdminDetalheLogSistema', {
      usuarioLogado: adminUser,
      log: item,
    });
  }

  function toggleLogSelection(item, index) {
    const key = item.path || item.id || `${item.seq}-${index}`;
    setSelectedLogIds((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    );
  }

  function toggleSelectAllVisibleLogs() {
    const visibleKeys = logs.map((item, index) => item.path || item.id || `${item.seq}-${index}`);
    const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedLogIds.includes(key));

    setSelectedLogIds((current) => {
      if (allSelected) {
        return current.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...current, ...visibleKeys]));
    });
  }

  function handleExportarSelecionadosTxt() {
    if (!selectedLogs.length) {
      Alert.alert('Selecione registros', 'Marque ao menos um resultado para exportar em .txt.');
      return;
    }

    const content = buildSelectedLogsTxt(selectedLogs);
    const fileName = `glicnutri-logs-selecionados-${selectedLogs.length}.txt`;

    if (!baixarTxtNoWeb(fileName, content)) {
      setExportText(content);
    } else {
      setExportText('');
    }
  }

  function handleVoltar() {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('AdminHome', { usuarioLogado: adminUser });
  }

  function loadMoreLogsIfNeeded() {
    if (!hasMoreLogs || loading || refreshing || loadingMore) {
      return;
    }

    const { viewportHeight, contentHeight, offsetY } = scrollMetricsRef.current;
    if (!viewportHeight || !contentHeight) {
      return;
    }

    const distanceToBottom = contentHeight - (offsetY + viewportHeight);

    if (distanceToBottom <= 160) {
      carregarLogs({ append: true });
    }
  }

  function maybeLoadMoreFromScroll(event) {
    if (!hasMoreLogs || loading || refreshing) {
      return;
    }

      const metrics = event?.nativeEvent;
    if (!metrics) {
      return;
    }

    scrollMetricsRef.current = {
      viewportHeight: metrics.layoutMeasurement.height || 0,
      contentHeight: metrics.contentSize.height || 0,
      offsetY: metrics.contentOffset.y || 0,
    };

    loadMoreLogsIfNeeded();
  }

  function handleContentSizeChange(_width, height) {
    scrollMetricsRef.current = {
      ...scrollMetricsRef.current,
      contentHeight: height || 0,
    };
    loadMoreLogsIfNeeded();
  }

  function handleScrollLayout(event) {
    const height = event?.nativeEvent?.layout?.height || 0;
    scrollMetricsRef.current = {
      ...scrollMetricsRef.current,
      viewportHeight: height,
    };
    loadMoreLogsIfNeeded();
  }

  useEffect(() => {
    carregarLogs();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadMoreLogsIfNeeded();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [logs.length, totalLogsCount, loading, refreshing, loadingMore]);

  useEffect(() => {
    navigation.setOptions({
      readerBackAction: handleVoltar,
      readerOnMenuPress: undefined,
      readerMenuDisabled: true,
      readerMenuLoading: false,
    });
  }, [navigation, adminUser]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const previousBodyOverflow = document.body?.style?.overflow;
    const previousHtmlOverflow = document.documentElement?.style?.overflow;

    if (document.body) {
      document.body.style.overflow = 'hidden';
    }
    if (document.documentElement) {
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      if (document.body) {
        document.body.style.overflow = previousBodyOverflow || '';
      }
      if (document.documentElement) {
        document.documentElement.style.overflow = previousHtmlOverflow || '';
      }
    };
  }, []);

  if (!isAdminUser(adminUser)) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <SectionCard style={styles.accessCard}>
          <Text style={styles.accessTitle}>Acesso negado</Text>
          <Text style={styles.accessText}>Entre com um perfil administrador para consultar os logs do sistema.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login', params: { roleInicial: 'Admin' } }],
              })
            }
          >
            <Text style={styles.primaryButtonText}>Ir para login admin</Text>
          </TouchableOpacity>
        </SectionCard>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />

      <View
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
      >
        <View
          style={[
            styles.scrollContent,
            Platform.OS === 'web' && styles.webScrollContent,
          ]}
        >
        <View
          style={styles.fixedHeaderArea}
          onLayout={(event) => {
            const nextHeight = event?.nativeEvent?.layout?.height || 0;
            if (nextHeight && Math.abs(nextHeight - fixedHeaderHeight) > 1) {
              setFixedHeaderHeight(nextHeight);
            }
          }}
        >
          <View style={styles.searchChipsRow}>
            {historicoOptions.map((item) => {
              const active = filters.historico === item.value;
              return (
                <TouchableOpacity
                  key={item.value || 'todos-historicos-topo'}
                  style={[styles.searchChip, active && styles.searchChipActive]}
                  onPress={() => updateFilter('historico', item.value, { searchAfterChange: true })}
                >
                  <Text style={[styles.searchChipText, active && styles.searchChipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.headerSearchWrap}>
            <TextInput
              nativeID="admin-logs-search-input"
              style={styles.headerSearchInput}
              value={filters.complemento}
              onChangeText={(value) => updateFilter('complemento', value)}
              onSubmitEditing={() => carregarLogs()}
              placeholder="Pesquisar logs"
              placeholderTextColor={adminTheme.colors.textMuted}
            />
            <TouchableOpacity
              style={styles.headerFilterAction}
              onPress={() => setFiltersVisible((current) => !current)}
              accessibilityLabel="Mostrar filtros"
            >
              <Ionicons
                name={filtersVisible ? 'calendar' : 'calendar-outline'}
                size={18}
                color={adminTheme.colors.onPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              nativeID="admin-logs-search-button"
              style={styles.headerSearchAction}
              onPress={() => carregarLogs()}
              accessibilityLabel="Confirmar pesquisa"
            >
              <Ionicons name="search-outline" size={18} color={adminTheme.colors.onPrimary} />
            </TouchableOpacity>
          </View>

          {filtersVisible ? (
            <SectionCard style={styles.filterCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Filtros</Text>
              </View>

              <View style={styles.filterGrid}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Data inicial</Text>
                  <TextInput
                    nativeID="admin-logs-date-start-input"
                    style={styles.input}
                    value={filters.dataInicial}
                    onChangeText={(value) => updateFilter('dataInicial', applyDateMask(value))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Data final</Text>
                  <TextInput
                    nativeID="admin-logs-date-end-input"
                    style={styles.input}
                    value={filters.dataFinal}
                    onChangeText={(value) => updateFilter('dataFinal', applyDateMask(value))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
            </SectionCard>
          ) : null}

          <View style={styles.resultHeader}>
            <View style={styles.resultSide}>
              <Text style={styles.resultTitle}>Resultado</Text>
            </View>
            <View style={styles.resultCenter}>
              <Text style={styles.resultMeta}>
                {totalLogsCount || logs.length} registros encontrados
                {totalErros > 0 ? ` • ${totalErros} erros` : ''}
              </Text>
              {!loading && logs.length > 0 ? (
                <Text style={styles.resultPinnedHint}>
                  Mostrando {logs.length} de {totalLogsCount || logs.length} registros
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setDetalharLog((current) => !current)}
            >
              <View style={[styles.checkbox, detalharLog && styles.checkboxChecked]}>
                {detalharLog ? (
                  <Ionicons name="checkmark" size={14} color={adminTheme.colors.onPrimary} />
                ) : null}
              </View>
              <Text style={styles.checkboxText}>Detalhar LOG</Text>
            </TouchableOpacity>
          </View>
          {exportText ? (
            <View style={styles.exportInlineCard}>
              <View style={styles.exportInlineHeader}>
                <Text style={styles.exportInlineTitle}>Exportação pronta</Text>
                <TouchableOpacity onPress={() => setExportText('')}>
                  <Ionicons name="close-outline" size={18} color={adminTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.exportInlineTextArea}
                value={exportText}
                multiline
                editable={false}
                selectTextOnFocus
              />
            </View>
          ) : null}
        </View>

        <View style={[styles.resultsArea, { paddingTop: fixedHeaderHeight + FIXED_HEADER_TOP_OFFSET + 8 }]}>
        <SectionCard style={styles.tableCard}>
          <View style={styles.tableToolsBar}>
            <TouchableOpacity style={styles.secondaryActionButtonCompact} onPress={toggleSelectAllVisibleLogs}>
              <Ionicons
                name={selectedLogs.length === logs.length && logs.length ? 'checkbox' : 'square-outline'}
                size={16}
                color={adminTheme.colors.text}
              />
              <Text style={styles.secondaryActionButtonCompactText}>Selecionar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButtonCompact} onPress={handleExportarSelecionadosTxt}>
              <Ionicons name="document-text-outline" size={16} color={adminTheme.colors.text} />
              <Text style={styles.secondaryActionButtonCompactText}>Exportar .txt</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.tableVerticalScroll}
            contentContainerStyle={styles.tableVerticalScrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => carregarLogs({ isRefresh: true })} />
            }
            keyboardShouldPersistTaps="handled"
            onLayout={handleScrollLayout}
            onScroll={maybeLoadMoreFromScroll}
            onScrollEndDrag={maybeLoadMoreFromScroll}
            onMomentumScrollEnd={maybeLoadMoreFromScroll}
            onContentSizeChange={handleContentSizeChange}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeaderRow, Platform.OS === 'web' && styles.tableHeaderRowSticky]}>
                <Text style={[styles.cell, styles.selectCell, styles.tableHeaderText]}>SEL</Text>
                <Text style={[styles.cell, styles.seqCell, styles.tableHeaderText]}>SEQ</Text>
                <Text style={[styles.cell, styles.userCell, styles.tableHeaderText]}>Usuário</Text>
                <Text style={[styles.cell, styles.programCell, styles.tableHeaderText]}>Programa</Text>
                <Text style={[styles.cell, styles.descriptionCell, styles.tableHeaderText]}>Descrição</Text>
                <Text style={[styles.cell, styles.historyCell, styles.tableHeaderText]}>Ação</Text>
                <Text style={[styles.cell, styles.dateCell, styles.tableHeaderText]}>Data/Hora</Text>
                <Text style={[styles.cell, styles.complementCell, styles.tableHeaderText]}>Complemento</Text>
              </View>

              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={adminTheme.colors.primary} />
                  <Text style={styles.loadingText}>Carregando logs...</Text>
                </View>
              ) : logs.length === 0 ? (
                <View style={styles.loadingRow}>
                  <Text style={styles.loadingText}>Nenhum log encontrado para os filtros atuais.</Text>
                </View>
              ) : (
                logs.map((item, index) => (
                  <TouchableOpacity
                    key={item.path || item.id || `${item.seq}-${index}`}
                    style={[
                      styles.tableRow,
                      index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                      item.historico === TIPOS_HISTORICO_LOG.ERRO && styles.tableRowError,
                    ]}
                    activeOpacity={0.82}
                    onPress={() => handleSelecionarLog(item)}
                  >
                    <TouchableOpacity
                      style={[styles.cell, styles.selectCell, styles.selectCellWrap]}
                      onPress={() => toggleLogSelection(item, index)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selectedLogIds.includes(item.path || item.id || `${item.seq}-${index}`) && styles.checkboxChecked,
                        ]}
                      >
                        {selectedLogIds.includes(item.path || item.id || `${item.seq}-${index}`) ? (
                          <Ionicons name="checkmark" size={14} color={adminTheme.colors.onPrimary} />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.cell, styles.seqCell]}>{item.seq}</Text>
                    <Text style={[styles.cell, styles.userCell]} numberOfLines={detalharLog ? 3 : 1}>
                      {item.usuario}
                    </Text>
                    <Text style={[styles.cell, styles.programCell]}>{item.programa || item.modulo}</Text>
                    <Text style={[styles.cell, styles.descriptionCell]}>{item.descricao}</Text>
                    <Text style={[styles.cell, styles.historyCell]}>{item.historico || item.acao}</Text>
                    <Text style={[styles.cell, styles.dateCell]}>{item.dataHoraFormatada}</Text>
                    <Text style={[styles.cell, styles.complementCell]} numberOfLines={detalharLog ? 5 : 1}>
                      {buildComplementoComDispositivo(item) || '-'}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
          </ScrollView>
        </SectionCard>
        </View>

        </View>
      </View>

      <BarraAbasAdmin
        navigation={navigation}
        rotaAtual={route?.name || 'AdminLogsSistema'}
        usuarioLogado={adminUser}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: adminTheme.colors.background,
  },
  containerWeb: {
    bottom: 0,
    height: '100dvh',
    left: 0,
    maxHeight: '100dvh',
    minHeight: '100%',
    overflow: 'hidden',
    position: 'fixed',
    right: 0,
    top: 0,
    width: '100vw',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  webScroll: {
    height: '100%',
    maxHeight: '100%',
    overflowX: 'hidden',
    overflowY: 'hidden',
  },
  scrollContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
  },
  webScrollContent: {
    flex: 1,
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  fixedHeaderArea: {
    left: 0,
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 18,
    paddingBottom: 10,
    position: 'absolute',
    right: 0,
    top: FIXED_HEADER_TOP_OFFSET,
    zIndex: 20,
    backgroundColor: adminTheme.colors.background,
  },
  resultsArea: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: adminTheme.spacing.screen,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 28,
  },
  sectionCard: {
    backgroundColor: adminTheme.colors.panel,
    borderRadius: adminTheme.radius.xl,
    padding: adminTheme.spacing.card,
    ...adminShadow,
  },
  accessCard: {
    margin: 18,
  },
  accessTitle: {
    color: adminTheme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  accessText: {
    color: adminTheme.colors.textMuted,
    marginTop: 8,
  },
  headerSearchWrap: {
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
  },
  headerSearchInput: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: 999,
    borderWidth: 1,
    color: adminTheme.colors.text,
    fontSize: 14,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 94,
    ...(Platform.OS === 'web'
      ? {
          outlineColor: 'transparent',
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        }
      : null),
  },
  headerFilterAction: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 50,
    top: 6,
    width: 36,
  },
  headerSearchAction: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 6,
    width: 36,
  },
  searchChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  searchChip: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 14,
  },
  searchChipActive: {
    backgroundColor: adminTheme.colors.primary,
  },
  searchChipText: {
    color: adminTheme.colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  searchChipTextActive: {
    color: adminTheme.colors.onPrimary,
  },
  filterCard: {
    marginBottom: 12,
  },
  cardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 36,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: adminTheme.colors.primary,
    borderRadius: 4,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginRight: 8,
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: adminTheme.colors.primary,
  },
  checkboxText: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  field: {
    minWidth: 180,
    flexGrow: 1,
    flexBasis: '30%',
  },
  fieldLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    color: adminTheme.colors.text,
    minHeight: 48,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web'
      ? {
          outlineColor: 'transparent',
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        }
      : null),
  },
  resultHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 2,
    position: 'relative',
  },
  resultSide: {
    width: 180,
  },
  resultCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    left: '50%',
    paddingHorizontal: 12,
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -160 }],
    width: 320,
  },
  resultTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  resultMeta: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultPinnedHint: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  secondaryActionButtonCompact: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  secondaryActionButtonCompactText: {
    color: adminTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  exportInlineCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  exportInlineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exportInlineTitle: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  exportInlineTextArea: {
    backgroundColor: adminTheme.colors.background,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    maxHeight: 160,
    minHeight: 120,
    padding: 12,
    textAlignVertical: 'top',
  },
  tableCard: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    marginBottom: 18,
    borderRadius: adminTheme.radius.xl,
    padding: 0,
    overflow: 'hidden',
  },
  tableToolsBar: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panel,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  tableVerticalScroll: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
  },
  tableVerticalScrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  table: {
    minWidth: 1160,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 46,
  },
  tableHeaderRow: {
    backgroundColor: '#0B1A17',
  },
  tableHeaderRowSticky: {
    position: 'sticky',
    top: 0,
    zIndex: 4,
  },
  tableRowEven: {
    backgroundColor: adminTheme.colors.panel,
  },
  tableRowOdd: {
    backgroundColor: adminTheme.colors.panelMuted,
  },
  tableRowError: {
    borderLeftColor: adminTheme.colors.danger,
    borderLeftWidth: 4,
  },
  cell: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRightWidth: 1,
    color: adminTheme.colors.text,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  tableHeaderText: {
    color: '#FFFFFF',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  seqCell: {
    width: 58,
  },
  selectCell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
  },
  selectCellWrap: {
    paddingHorizontal: 0,
  },
  programCell: {
    width: 150,
  },
  descriptionCell: {
    width: 190,
  },
  userCell: {
    width: 190,
  },
  historyCell: {
    width: 130,
  },
  dateCell: {
    width: 150,
  },
  complementCell: {
    width: 292,
  },
  loadingRow: {
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingText: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
  },
  primaryButtonText: {
    color: adminTheme.colors.onPrimary,
    fontWeight: '900',
  },
});
