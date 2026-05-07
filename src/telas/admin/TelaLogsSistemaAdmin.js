import React, { useEffect, useMemo, useState } from 'react';
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
import MenuAdmin from '../../componentes/admin/MenuAdmin';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';
import {
  AppLogger,
  MODULOS_LOG_SISTEMA,
  TIPOS_HISTORICO_LOG,
  listarLogsSistema,
} from '../../servicos/servicoLogSistema';
import { listarEventosAuditoria, registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import { isAdminUser } from '../../servicos/servicoAdmin';

const historicoOptions = [
  '',
  TIPOS_HISTORICO_LOG.CADASTRO,
  TIPOS_HISTORICO_LOG.ALTERACAO,
  TIPOS_HISTORICO_LOG.EXCLUSAO,
  TIPOS_HISTORICO_LOG.LOGIN,
  TIPOS_HISTORICO_LOG.ERRO,
  TIPOS_HISTORICO_LOG.SINCRONIZACAO,
  TIPOS_HISTORICO_LOG.ALERTA,
];
const LOG_LOOKBACK_DAYS = 3650;
const SYSTEM_LOG_LOOKBACK_DAYS = 30;
const LOG_SYSTEM_LIMIT = 500;
const LOG_AUDIT_LIMIT = 120;

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

function DetailItem({ label, value, mono = false }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailValueMono]} selectable>
        {formatDetailValue(value)}
      </Text>
    </View>
  );
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

  const programa = text.includes('login') || text.includes('sessao')
    ? MODULOS_LOG_SISTEMA.LOGIN
    : text.includes('glic')
      ? MODULOS_LOG_SISTEMA.GLICEMIA
      : text.includes('refeicao') || text.includes('aliment')
        ? MODULOS_LOG_SISTEMA.ALIMENTACAO
        : text.includes('plano')
          ? MODULOS_LOG_SISTEMA.PLANO_ALIMENTAR
          : text.includes('consulta')
            ? MODULOS_LOG_SISTEMA.CONSULTA
            : text.includes('nutri')
              ? MODULOS_LOG_SISTEMA.NUTRICIONISTA
              : text.includes('admin')
                ? MODULOS_LOG_SISTEMA.ADMIN
                : MODULOS_LOG_SISTEMA.PACIENTE;

  const historico = String(event?.status || '').toLowerCase() === 'falha' || action.includes('falha') || action.includes('erro')
    ? TIPOS_HISTORICO_LOG.ERRO
    : action.includes('login')
      ? TIPOS_HISTORICO_LOG.LOGIN
      : action.includes('delete') || action.includes('exclu') || action.includes('remov') || action.includes('ocult')
        ? TIPOS_HISTORICO_LOG.EXCLUSAO
        : action.includes('sync') || action.includes('sincron')
          ? TIPOS_HISTORICO_LOG.SINCRONIZACAO
          : action.includes('alert')
            ? TIPOS_HISTORICO_LOG.ALERTA
            : action.includes('create') || action.includes('insert') || action.includes('cadastro') || action.includes('cadastrad') || action.includes('registr')
              ? TIPOS_HISTORICO_LOG.CADASTRO
              : TIPOS_HISTORICO_LOG.ALTERACAO;

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

  return {
    id: `audit-${event.id}`,
    seq: '',
    programa,
    descricao,
    usuario: event.actorName || event.actorPatientId || event.actorNutritionistId || event.actorAdminId || 'Usuário',
    historico,
    dataHora: event.createdAt,
    createdAt: event.createdAt,
    dataHoraFormatada: formatDateTime(event.createdAt),
    complemento,
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
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [detalharLog, setDetalharLog] = useState(true);
  const [exportText, setExportText] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [filters, setFilters] = useState({
    dataInicial: '',
    dataFinal: '',
    usuario: '',
    historico: '',
    complemento: '',
  });

  const totalErros = useMemo(
    () => logs.filter((item) => item.historico === TIPOS_HISTORICO_LOG.ERRO).length,
    [logs]
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
    setMenuVisible(false);

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
        descricao: 'Consulta Log do Sistema',
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

  function handleNavigate(routeName) {
    navigation.navigate(routeName, { usuarioLogado: adminUser });
  }

  async function carregarLogs({ isRefresh = false, filtersOverride = null } = {}) {
    const filtrosConsulta = filtersOverride || filters;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

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
        .filter((item) => matchesTelaFilters(item, filtrosConsulta));
      const data = prepararResultadoTabela([...logsSistema, ...logsAuditoria]);

      setLogs(data);
      setSelectedLog((current) => {
        if (!current) return null;
        return data.find((item) => item.id === current.id || item.path === current.path) || null;
      });
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
      setRefreshing(false);
      setLoading(false);
    }
  }

  function handleExportar() {
    const csvText = buildExportPreview(logs);
    setExportText(csvText);

  }

  function handleSelecionarLog(item) {
    setSelectedLog((current) => {
      const currentKey = current?.path || current?.id;
      const nextKey = item?.path || item?.id;
      return currentKey === nextKey ? null : item;
    });
  }

  function handleExportarRegistro(item) {
    setExportText(buildExportPreview([item]));
    setSelectedLog(item);
  }

  function handleVoltar() {
    navigation.navigate('AdminHome', { usuarioLogado: adminUser });
  }

  useEffect(() => {
    carregarLogs();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: isAdminUser(adminUser) ? () => setMenuVisible(true) : undefined,
      readerMenuDisabled: !isAdminUser(adminUser),
      readerMenuLoading: false,
    });
  }, [navigation, adminUser]);

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

      {menuVisible ? (
        <MenuAdmin
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          currentRoute={route?.name || 'AdminLogsSistema'}
          userName={adminUser?.nome_completo_admin || adminUser?.email_acesso || 'Administrador'}
          userSubtitle="Consulta e rastreamento de logs"
        />
      ) : null}

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.webScrollContent,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => carregarLogs({ isRefresh: true })} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Consulta Log do Sistema</Text>
            <Text style={styles.headerSubtitle}>Consulta administrativa para auditoria e rastreamento operacional</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => carregarLogs()}>
              <Ionicons name="search-outline" size={17} color={adminTheme.colors.onPrimary} />
              <Text style={styles.actionButtonText}>Pesquisar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={handleExportar}>
              <Ionicons name="print-outline" size={17} color={adminTheme.colors.text} />
              <Text style={styles.secondaryActionButtonText}>Imprimir/Exportar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exitButton} onPress={handleVoltar}>
              <Ionicons name="arrow-back-outline" size={17} color={adminTheme.colors.danger} />
              <Text style={styles.exitButtonText}>Sair/Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SectionCard style={styles.filterCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Filtros</Text>
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

          <View style={styles.filterGrid}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Data inicial</Text>
              <TextInput
                style={styles.input}
                value={filters.dataInicial}
                onChangeText={(value) => updateFilter('dataInicial', value)}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={adminTheme.colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Data final</Text>
              <TextInput
                style={styles.input}
                value={filters.dataFinal}
                onChangeText={(value) => updateFilter('dataFinal', value)}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={adminTheme.colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Usuário</Text>
              <TextInput
                style={styles.input}
                value={filters.usuario}
                onChangeText={(value) => updateFilter('usuario', value)}
                placeholder="email ou nome"
                placeholderTextColor={adminTheme.colors.textMuted}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.fieldWide}>
              <Text style={styles.fieldLabel}>Tipo de acao / Historico</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {historicoOptions.map((item) => {
                  const active = filters.historico === item;
                  return (
                    <TouchableOpacity
                      key={item || 'todos-historicos'}
                      style={[styles.optionButton, active && styles.optionButtonActive]}
                      onPress={() => updateFilter('historico', item, { searchAfterChange: true })}
                    >
                      <Text style={[styles.optionButtonText, active && styles.optionButtonTextActive]}>
                        {item || 'TODOS'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.fieldWide}>
              <Text style={styles.fieldLabel}>Complemento</Text>
              <TextInput
                style={styles.input}
                value={filters.complemento}
                onChangeText={(value) => updateFilter('complemento', value)}
                placeholder="texto livre, descricao ou detalhe do log"
                placeholderTextColor={adminTheme.colors.textMuted}
              />
            </View>
          </View>
        </SectionCard>

        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>Resultado</Text>
          <Text style={styles.resultMeta}>
            {logs.length} registro(s) encontrado(s) - {totalErros} erro(s)
          </Text>
        </View>

        <SectionCard style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
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
                      (selectedLog?.path || selectedLog?.id) === (item.path || item.id) && styles.tableRowSelected,
                    ]}
                    activeOpacity={0.82}
                    onPress={() => handleSelecionarLog(item)}
                  >
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
        </SectionCard>

        {selectedLog ? (
          <SectionCard style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailTitleWrap}>
                <Text style={styles.detailTitle}>Detalhes do registro {selectedLog.seq}</Text>
                <Text style={styles.detailSubtitle}>
                  {(selectedLog.historico || selectedLog.acao || 'Acao')} em {selectedLog.dataHoraFormatada || '-'}
                </Text>
              </View>
              <View style={styles.detailActions}>
                <TouchableOpacity style={styles.secondaryActionButton} onPress={() => handleExportarRegistro(selectedLog)}>
                  <Ionicons name="download-outline" size={17} color={adminTheme.colors.text} />
                  <Text style={styles.secondaryActionButtonText}>Exportar registro</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearExportButton} onPress={() => setSelectedLog(null)}>
                  <Ionicons name="close-outline" size={18} color={adminTheme.colors.danger} />
                  <Text style={styles.clearExportButtonText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <DetailItem label="Usuario" value={selectedLog.usuario} />
              <DetailItem label="Programa" value={selectedLog.programa || selectedLog.modulo} />
              <DetailItem label="Descricao" value={selectedLog.descricao} />
              <DetailItem label="Historico / Acao" value={selectedLog.historico || selectedLog.acao} />
              <DetailItem label="Data e hora" value={selectedLog.dataHoraFormatada || selectedLog.dataHora || selectedLog.createdAt} />
              <DetailItem label="Origem" value={selectedLog.origem} />
              <DetailItem label="Status" value={selectedLog.status} />
              <DetailItem label="Entidade" value={selectedLog.entidade || selectedLog.entity} />
              <DetailItem label="Complemento" value={buildComplementoComDispositivo(selectedLog)} />
              <DetailItem label="Caminho do arquivo" value={selectedLog.path} mono />
              <DetailItem label="Detalhes tecnicos" value={selectedLog.detalhes} mono />
              <DetailItem label="Stack / erro" value={selectedLog.stack} mono />
            </View>
          </SectionCard>
        ) : null}

        {exportText ? (
          <SectionCard style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <Text style={styles.exportTitle}>Bloco de texto para exportacao</Text>
              <TouchableOpacity style={styles.clearExportButton} onPress={() => setExportText('')}>
                <Ionicons name="close-outline" size={18} color={adminTheme.colors.danger} />
                <Text style={styles.clearExportButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.exportTextArea}
              value={exportText}
              multiline
              editable={false}
              selectTextOnFocus
            />
          </SectionCard>
        ) : null}
      </ScrollView>

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
    minHeight: '100%',
    overflow: 'visible',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    overflowX: 'hidden',
    overflowY: 'visible',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 6,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 26,
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  sectionCard: {
    backgroundColor: adminTheme.colors.panel,
    borderRadius: 8,
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
  headerBar: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  headerTitleWrap: {
    marginBottom: 14,
  },
  headerTitle: {
    color: adminTheme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 5,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: adminTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  secondaryActionButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  secondaryActionButtonText: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 7,
  },
  exitButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.dangerSoft,
    borderColor: adminTheme.colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  exitButtonText: {
    color: adminTheme.colors.danger,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
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
  fieldWide: {
    flexBasis: '100%',
    flexGrow: 1,
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
    borderRadius: 8,
    borderWidth: 1,
    color: adminTheme.colors.text,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  optionRow: {
    gap: 8,
    paddingRight: 8,
  },
  optionButton: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 10,
  },
  optionButtonActive: {
    backgroundColor: adminTheme.colors.primary,
  },
  optionButtonText: {
    color: adminTheme.colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  optionButtonTextActive: {
    color: adminTheme.colors.onPrimary,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  resultTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  resultMeta: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tableCard: {
    padding: 0,
    overflow: 'hidden',
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
  tableRowSelected: {
    borderColor: adminTheme.colors.primary,
    borderWidth: 1,
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
  detailCard: {
    borderColor: adminTheme.colors.primary,
    borderWidth: 1,
    marginTop: 12,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailTitleWrap: {
    flex: 1,
    minWidth: 220,
  },
  detailTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  detailSubtitle: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  detailActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  detailItem: {
    backgroundColor: adminTheme.colors.background,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    padding: 12,
  },
  detailLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: adminTheme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  detailValueMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  exportCard: {
    marginTop: 12,
  },
  exportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  exportTitle: {
    color: adminTheme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  clearExportButton: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 34,
  },
  clearExportButtonText: {
    color: adminTheme.colors.danger,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 4,
  },
  exportTextArea: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    color: adminTheme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
    minHeight: 220,
    padding: 12,
    textAlignVertical: 'top',
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
