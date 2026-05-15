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
import {
  listarEventosAuditoria,
  listarEventosAuditoriaRecentesDireto,
  registrarLogAuditoria,
} from '../../servicos/servicoAuditoria';
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
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [detalharLog, setDetalharLog] = useState(true);
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
          listarEventosAuditoriaRecentesDireto({
            days: SYSTEM_LOG_LOOKBACK_DAYS,
            limit: LOG_AUDIT_LIMIT,
          })
            .then((eventos) => {
              if (eventos.length) return eventos;
              return listarEventosAuditoria({
                days: LOG_LOOKBACK_DAYS,
                limit: LOG_AUDIT_LIMIT,
              });
            })
            .catch(() => []),
          30000,
          []
        ),
      ]);

      const logsAuditoria = eventosAuditoria
        .map(mapAuditEventToLogUsuario)
        .filter(Boolean)
        .filter((item) => matchesTelaFilters(item, filtrosConsulta));
      const data = prepararResultadoTabela([...logsSistema, ...logsAuditoria]);

      setLogs(data);
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

  function handleSelecionarLog(item) {
    navigation.navigate('AdminDetalheLogSistema', {
      usuarioLogado: adminUser,
      log: item,
    });
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
          onNavigate={(routeName, params = {}) => handleNavigate(routeName, params)}
          onLogout={handleLogout}
          currentRoute={route?.name || 'AdminLogsSistema'}
          userName={adminUser?.nome_completo_admin || adminUser?.email_acesso || 'Administrador'}
          userSubtitle="Auditoria, logs e rastreamento de acoes"
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
            <Text style={styles.headerTitle}>Auditoria/Log</Text>
            <Text style={styles.headerSubtitle}>Eventos de cadastro, alteracao, exclusao e rastreamento operacional</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => carregarLogs()}>
              <Ionicons name="search-outline" size={17} color={adminTheme.colors.onPrimary} />
              <Text style={styles.actionButtonText}>Pesquisar</Text>
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
