import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarraAbasAdmin, {
  ADMIN_TAB_BAR_HEIGHT,
  ADMIN_TAB_BAR_SPACE,
} from '../../componentes/admin/BarraAbasAdmin';
import MenuAdmin from '../../componentes/admin/MenuAdmin';
import { supabase } from '../../servicos/configSupabase';
import { isAdminUser } from '../../servicos/servicoAdmin';
import { listarEventosAuditoria, registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';

const USERS_LIMIT = 8;

const initialDashboardState = {
  pacientesAtivos: 0,
  pacientesExcluidos: 0,
  nutricionistas: 0,
  medicos: 0,
  administradores: 0,
  eventosHoje: 0,
  alertasHoje: 0,
  falhasHoje: 0,
  pacientesRecentes: [],
  nutricionistasRecentes: [],
  medicosRecentes: [],
  adminsRecentes: [],
  eventosRecentes: [],
  lastUpdatedAt: null,
};

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function QuickAction({ icon, title, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} activeOpacity={0.84} onPress={onPress}>
      <View style={styles.quickActionLeading}>
        <View style={styles.quickActionIcon}>
          <Ionicons name={icon} size={16} color={adminTheme.colors.primary} />
        </View>
        <Text style={styles.quickActionTitle}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={16} color={adminTheme.colors.primary} />
    </TouchableOpacity>
  );
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getDisplayDate(item) {
  return (
    item?.created_at ||
    item?.data_hora_cadastro ||
    item?.data_hora_ultima_atualizacao ||
    item?.updated_at ||
    item?.createdAt ||
    null
  );
}

function mapUserRow(row, type) {
  const id =
    row?.id_paciente_uuid ||
    row?.id_nutricionista_uuid ||
    row?.id_medico_uuid ||
    row?.id_admin_uuid ||
    row?.id ||
    `${type}-${Math.random()}`;
  const name =
    row?.nome_completo ||
    row?.nome_completo_nutri ||
    row?.nome_nutri ||
    row?.nome_completo_medico ||
    row?.nome_medico ||
    row?.nome_completo_admin ||
    row?.email_pac ||
    row?.email_acesso ||
    row?.email_medico ||
    row?.email ||
    'Nome nao informado';
  const email = row?.email_pac || row?.email_acesso || row?.email_medico || row?.email || '';
  const document = row?.cpf_paciente || row?.crm_numero || row?.crm_medico || row?.documento || '';
  const isInactive = row?.excluido === true || row?.ativo === false || row?.status === 'inativo';

  return {
    id,
    type,
    name,
    email,
    document,
    status: isInactive ? 'Inativo' : 'Ativo',
    date: getDisplayDate(row),
  };
}

async function fetchCount(queryBuilder) {
  const { count, error } = await queryBuilder;
  if (error) throw error;
  return count || 0;
}

async function fetchAdminCount() {
  const { data, error } = await supabase.rpc('contar_administradores');
  if (error) throw error;
  return Number(data) || 0;
}

async function fetchRows(tableName, type, orderColumn) {
  let query = supabase.from(tableName).select('*').limit(USERS_LIMIT);
  if (orderColumn) {
    query = query.order(orderColumn, { ascending: false });
  }

  const { data, error } = await query;
  if (error && orderColumn) {
    const retry = await supabase.from(tableName).select('*').limit(USERS_LIMIT);
    if (retry.error) return [];
    return (retry.data || []).map((row) => mapUserRow(row, type));
  }
  if (error) return [];
  return (data || []).map((row) => mapUserRow(row, type));
}

function getUserTypeMeta(type) {
  if (type === 'paciente') {
    return { label: 'Pacientes', icon: 'person-outline', color: adminTheme.colors.primary };
  }
  if (type === 'nutricionista') {
    return { label: 'Nutricionistas', icon: 'nutrition-outline', color: adminTheme.colors.success };
  }
  if (type === 'medico') {
    return { label: 'Medicos', icon: 'medkit-outline', color: adminTheme.colors.info };
  }
  return { label: 'Administradores', icon: 'shield-checkmark-outline', color: adminTheme.colors.warning };
}

function getLatestEntry(items) {
  return items?.length ? items[0] : null;
}

function getRecentLabel(item) {
  if (!item) return 'Sem registro recente';
  return item.name || item.email || item.document || 'Sem registro recente';
}

export default function TelaHomeAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(initialDashboardState);
  const [menuVisible, setMenuVisible] = useState(false);

  async function handleLogout() {
    setMenuVisible(false);

    if (adminUser) {
      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'logout_admin',
        entity: 'sessao',
        entityId: adminUser?.id_admin_uuid || null,
        origin: 'admin_home',
        status: 'sucesso',
        details: {},
      });
    }

    await onAdminLogout?.();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }

  async function carregarDashboard({ isRefresh = false } = {}) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        pacientesAtivos,
        pacientesExcluidos,
        nutricionistas,
        medicos,
        administradores,
        pacientesRecentes,
        nutricionistasRecentes,
        medicosRecentes,
        adminsRecentes,
        eventosRecentes,
      ] = await Promise.all([
        fetchCount(
          supabase
            .from('paciente')
            .select('*', { count: 'exact', head: true })
            .or('excluido.is.null,excluido.eq.false')
        ).catch(() => 0),
        fetchCount(
          supabase
            .from('paciente')
            .select('*', { count: 'exact', head: true })
            .eq('excluido', true)
        ).catch(() => 0),
        fetchCount(supabase.from('nutricionista').select('*', { count: 'exact', head: true })).catch(() => 0),
        fetchCount(supabase.from('medico').select('*', { count: 'exact', head: true })).catch(() => 0),
        fetchAdminCount().catch(() => 0),
        fetchRows('paciente', 'paciente', 'data_hora_ultima_atualizacao'),
        fetchRows('nutricionista', 'nutricionista', 'created_at'),
        fetchRows('medico', 'medico', 'created_at'),
        fetchRows('administrador', 'admin', 'created_at'),
        listarEventosAuditoria({ days: 2, limit: 12 }).catch(() => []),
      ]);

      const eventosHoje = eventosRecentes.filter((item) => {
        const createdAt = new Date(item.createdAt || 0);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= todayStart;
      });

      setDashboard({
        pacientesAtivos,
        pacientesExcluidos,
        nutricionistas,
        medicos,
        administradores,
        eventosHoje: eventosHoje.length,
        alertasHoje: eventosHoje.filter((item) => normalizeText(item.status) === 'alerta').length,
        falhasHoje: eventosHoje.filter((item) => normalizeText(item.status) === 'falha').length,
        pacientesRecentes,
        nutricionistasRecentes,
        medicosRecentes,
        adminsRecentes,
        eventosRecentes,
        lastUpdatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.log('Erro ao carregar home admin:', error);
      setDashboard(initialDashboardState);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  function handleNavigate(routeName, params = {}) {
    navigation.navigate(routeName, { usuarioLogado: adminUser, ...params });
  }

  useEffect(() => {
    if (isAdminUser(adminUser)) {
      carregarDashboard();
    }
  }, [adminUser]);

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: isAdminUser(adminUser) ? () => setMenuVisible(true) : undefined,
      readerMenuDisabled: !isAdminUser(adminUser),
      readerMenuLoading: false,
      readerRightAction: isAdminUser(adminUser)
        ? () => carregarDashboard({ isRefresh: true })
        : undefined,
      readerRightIcon: 'refresh-outline',
      readerRightAccessibilityLabel: 'Atualizar painel',
      readerRightDisabled: refreshing || loading,
      readerRightLoading: refreshing,
    });
  }, [navigation, adminUser, refreshing, loading]);

  const totalUsers =
    dashboard.pacientesAtivos +
    dashboard.nutricionistas +
    dashboard.medicos +
    dashboard.administradores;

  const priorityCount = dashboard.alertasHoje + dashboard.falhasHoje + dashboard.pacientesExcluidos;

  const metrics = useMemo(
    () => [
      {
        key: 'usuarios',
        title: 'Usuarios ativos',
        value: totalUsers,
        helper: 'Base principal',
        icon: 'people-outline',
      },
      {
        key: 'eventos',
        title: 'Eventos hoje',
        value: dashboard.eventosHoje,
        helper: 'Fluxo operacional',
        icon: 'pulse-outline',
      },
      {
        key: 'inativos',
        title: 'Pacientes inativos',
        value: dashboard.pacientesExcluidos,
        helper: 'Exclusao logica',
        icon: 'archive-outline',
      },
    ],
    [dashboard, totalUsers]
  );

  const userOverview = useMemo(
    () => [
      {
        key: 'paciente',
        count: dashboard.pacientesAtivos,
        helper: `${dashboard.pacientesExcluidos} em exclusao logica`,
        recent: getRecentLabel(getLatestEntry(dashboard.pacientesRecentes)),
      },
      {
        key: 'nutricionista',
        count: dashboard.nutricionistas,
        helper: 'Equipe de acompanhamento',
        recent: getRecentLabel(getLatestEntry(dashboard.nutricionistasRecentes)),
      },
      {
        key: 'medico',
        count: dashboard.medicos,
        helper: 'Perfis clinicos',
        recent: getRecentLabel(getLatestEntry(dashboard.medicosRecentes)),
      },
      {
        key: 'admin',
        count: dashboard.administradores,
        helper: 'Acesso institucional',
        recent: getRecentLabel(getLatestEntry(dashboard.adminsRecentes)),
      },
    ],
    [dashboard]
  );

  if (!isAdminUser(adminUser)) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <Card style={styles.accessDeniedCard}>
          <Text style={styles.accessDeniedTitle}>Acesso restrito</Text>
          <Text style={styles.accessDeniedText}>
            Entre com um perfil administrador para abrir o centro de controle.
          </Text>
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
        </Card>
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
          currentRoute={route?.name || 'AdminHome'}
          userName={adminUser?.nome_completo_admin || adminUser?.email_acesso || 'Administrador'}
          userSubtitle="Centro de controle"
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => carregarDashboard({ isRefresh: true })}
            tintColor={adminTheme.colors.primary}
          />
        }
      >
        {loading ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.loadingText}>Carregando centro de controle...</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Visao geral</Text>
                  <Text style={styles.sectionSubtitle}>Somente o que precisa de leitura imediata</Text>
                </View>
                <View style={styles.overviewMiniRow}>
                  <View style={styles.overviewMiniCard}>
                    <Text style={styles.overviewMiniLabel}>Pontos de atencao</Text>
                    <Text style={styles.overviewMiniValue}>{priorityCount}</Text>
                    <Text style={styles.overviewMiniMeta}>
                      {dashboard.alertasHoje} alertas • {dashboard.falhasHoje} falhas • {dashboard.pacientesExcluidos} inativos
                    </Text>
                  </View>
                  <View style={styles.overviewMiniCard}>
                    <Text style={styles.overviewMiniLabel}>Atualizado</Text>
                    <Text style={styles.overviewMiniDate}>{formatDateTime(dashboard.lastUpdatedAt)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.metricsRow}>
                {metrics.map((item) => (
                  <View key={item.key} style={styles.metricCard}>
                    <View style={styles.metricTop}>
                      <View style={styles.metricIcon}>
                        <Ionicons name={item.icon} size={16} color={adminTheme.colors.primary} />
                      </View>
                      <Text style={styles.metricValue}>{item.value}</Text>
                    </View>
                    <Text style={styles.metricTitle}>{item.title}</Text>
                    <Text style={styles.metricHelper}>{item.helper}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Acesso rapido</Text>
                  <Text style={styles.sectionSubtitle}>Entradas principais do admin</Text>
                </View>
              </View>

              <View style={styles.quickActionsRow}>
                <QuickAction icon="person-add-outline" title="Cadastros" onPress={() => handleNavigate('AdminCadastros')} />
                <QuickAction icon="briefcase-outline" title="Operacoes" onPress={() => handleNavigate('AdminOperacoes')} />
                <QuickAction icon="pulse-outline" title="Auditoria/Log" onPress={() => handleNavigate('AdminLogsSistema')} />
              </View>
            </Card>

            <View style={styles.contentGrid}>
              <Card style={[styles.sectionCard, styles.contentPanel]}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Usuarios</Text>
                    <Text style={styles.sectionSubtitle}>Distribuicao e ultimo movimento por perfil</Text>
                  </View>
                  <TouchableOpacity style={styles.linkButton} onPress={() => handleNavigate('AdminCadastros')}>
                    <Text style={styles.linkButtonText}>Abrir cadastros</Text>
                    <Ionicons name="chevron-forward-outline" size={15} color={adminTheme.colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.userList}>
                  {userOverview.map((item) => {
                    const meta = getUserTypeMeta(item.key);

                    return (
                      <View key={item.key} style={styles.userRow}>
                        <View style={[styles.userIconWrap, { borderColor: meta.color }]}>
                          <Ionicons name={meta.icon} size={16} color={meta.color} />
                        </View>

                        <View style={styles.userInfo}>
                          <View style={styles.userHeaderRow}>
                            <Text style={styles.userTitle}>{meta.label}</Text>
                            <Text style={styles.userCount}>{item.count}</Text>
                          </View>
                          <Text style={styles.userHelper} numberOfLines={1}>{item.helper}</Text>
                          <Text style={styles.userRecent} numberOfLines={1}>Ultimo: {item.recent}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card style={[styles.sectionCard, styles.contentPanel]}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Eventos recentes</Text>
                    <Text style={styles.sectionSubtitle}>Ultimas atividades registradas</Text>
                  </View>
                </View>

                <View style={styles.eventsList}>
                  {dashboard.eventosRecentes.length ? (
                    dashboard.eventosRecentes.slice(0, 5).map((item) => (
                      <View key={item.path || item.id} style={styles.eventRow}>
                        <View style={styles.eventMarker} />
                        <View style={styles.eventInfo}>
                          <Text style={styles.eventTitle} numberOfLines={1}>
                            {String(item.action || 'acao').replace(/_/g, ' ')}
                          </Text>
                          <Text style={styles.eventMeta} numberOfLines={1}>
                            {item.actorName || item.actorType || 'Usuario nao identificado'}
                          </Text>
                          <Text style={styles.eventMeta} numberOfLines={1}>
                            {formatDateTime(item.createdAt)}
                          </Text>
                        </View>
                        <Text style={styles.eventStatus}>{item.status || 'ok'}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyBlock}>
                      <Text style={styles.emptyTitle}>Sem eventos recentes</Text>
                      <Text style={styles.emptyText}>As atividades do sistema aparecem aqui em tempo real.</Text>
                    </View>
                  )}
                </View>
              </Card>
            </View>
          </>
        )}
      </ScrollView>

      <BarraAbasAdmin
        navigation={navigation}
        rotaAtual={route?.name || 'AdminHome'}
        usuarioLogado={adminUser}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: adminTheme.colors.background,
  },
  containerWeb: {
    minHeight: '100%',
    overflow: 'visible',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 12,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 30,
  },
  card: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    padding: 16,
    ...adminShadow,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
  },
  loadingText: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  accessDeniedCard: {
    margin: adminTheme.spacing.screen,
    marginTop: 40,
  },
  accessDeniedTitle: {
    color: adminTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  accessDeniedText: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.md,
    marginTop: 16,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: adminTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionCard: {
    marginTop: 12,
  },
  sectionHeader: {
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: adminTheme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  overviewMiniRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 8,
  },
  overviewMiniCard: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: Platform.OS === 'web' ? 150 : '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  overviewMiniLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  overviewMiniValue: {
    color: adminTheme.colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'center',
  },
  overviewMiniDate: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  overviewMiniMeta: {
    color: adminTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  alertPill: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alertPillLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  alertPillValue: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  metricCard: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 180,
    padding: 14,
    width: Platform.OS === 'web' ? '31%' : '100%',
  },
  metricTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricIcon: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  metricValue: {
    color: adminTheme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  metricTitle: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },
  metricHelper: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  quickActionsRow: {
    gap: 10,
    marginTop: 16,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickActionLeading: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  quickActionIcon: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  quickActionTitle: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
  },
  contentGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    marginTop: 14,
  },
  contentPanel: {
    flex: 1,
    minWidth: 280,
  },
  linkButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  linkButtonText: {
    color: adminTheme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  userList: {
    gap: 10,
    marginTop: 16,
  },
  userRow: {
    alignItems: 'flex-start',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  userIconWrap: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panel,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userTitle: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  userCount: {
    color: adminTheme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  userHelper: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  userRecent: {
    color: adminTheme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  eventsList: {
    gap: 8,
    marginTop: 16,
  },
  eventRow: {
    alignItems: 'flex-start',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  eventMarker: {
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    width: 10,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  eventMeta: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  eventStatus: {
    color: adminTheme.colors.primary,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
});
