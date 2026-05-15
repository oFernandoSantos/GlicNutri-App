import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
    raw: row,
  };
}

async function fetchCount(queryBuilder) {
  const { count, error } = await queryBuilder;
  if (error) throw error;
  return count || 0;
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
    return { label: 'Paciente', icon: 'person-outline', color: adminTheme.colors.primary };
  }
  if (type === 'nutricionista') {
    return { label: 'Nutricionista', icon: 'nutrition-outline', color: adminTheme.colors.success };
  }
  if (type === 'medico') {
    return { label: 'Medico', icon: 'medkit-outline', color: adminTheme.colors.info };
  }
  return { label: 'Admin', icon: 'shield-checkmark-outline', color: adminTheme.colors.warning };
}

function UserRow({ item }) {
  const meta = getUserTypeMeta(item.type);

  return (
    <View style={styles.userRow}>
      <View style={[styles.userIcon, { borderColor: meta.color }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
      </View>
      <View style={styles.userInfo}>
        <View style={styles.userTopLine}>
          <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.statusPill, item.status === 'Ativo' ? styles.statusActive : styles.statusInactive]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.userMeta} numberOfLines={1}>
          {meta.label}{item.email ? ` | ${item.email}` : ''}
        </Text>
        <Text style={styles.userMeta} numberOfLines={1}>
          {item.document || 'Documento nao informado'} | {formatDateTime(item.date)}
        </Text>
      </View>
    </View>
  );
}

export default function TelaHomeAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(initialDashboardState);
  const [menuVisible, setMenuVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('todos');

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
        fetchCount(supabase.from('administrador').select('*', { count: 'exact', head: true })).catch(() => 0),
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

  const userGroups = useMemo(
    () => [
      {
        key: 'paciente',
        title: 'Pacientes',
        count: dashboard.pacientesAtivos,
        helper: `${dashboard.pacientesExcluidos} em exclusao logica`,
        icon: 'person-outline',
        items: dashboard.pacientesRecentes,
      },
      {
        key: 'nutricionista',
        title: 'Nutricionistas',
        count: dashboard.nutricionistas,
        helper: 'Equipe de acompanhamento',
        icon: 'nutrition-outline',
        items: dashboard.nutricionistasRecentes,
      },
      {
        key: 'medico',
        title: 'Medicos',
        count: dashboard.medicos,
        helper: 'Perfis clinicos',
        icon: 'medkit-outline',
        items: dashboard.medicosRecentes,
      },
      {
        key: 'admin',
        title: 'Administradores',
        count: dashboard.administradores,
        helper: 'Acesso institucional',
        icon: 'shield-checkmark-outline',
        items: dashboard.adminsRecentes,
      },
    ],
    [dashboard]
  );

  const allUsers = useMemo(
    () => userGroups.flatMap((group) => group.items),
    [userGroups]
  );

  const visibleUsers = useMemo(() => {
    const query = normalizeText(search);
    return allUsers.filter((item) => {
      if (activeType !== 'todos' && item.type !== activeType) return false;
      if (!query) return true;
      return normalizeText([item.name, item.email, item.document, item.status, item.type].join(' ')).includes(query);
    });
  }, [activeType, allUsers, search]);

  const totalUsers =
    dashboard.pacientesAtivos +
    dashboard.nutricionistas +
    dashboard.medicos +
    dashboard.administradores;

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
            <View style={styles.hero}>
              <View style={styles.heroTitleWrap}>
                <Text style={styles.heroKicker}>Admin</Text>
                <Text style={styles.heroTitle}>Centro de controle</Text>
                <Text style={styles.heroSubtitle}>
                  Controle usuarios, acompanhe perfis ativos e monitore eventos importantes do app.
                </Text>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{totalUsers}</Text>
                  <Text style={styles.heroStatLabel}>usuarios</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{dashboard.eventosHoje}</Text>
                  <Text style={styles.heroStatLabel}>eventos hoje</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{dashboard.alertasHoje + dashboard.falhasHoje}</Text>
                  <Text style={styles.heroStatLabel}>atencoes</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Usuarios do sistema</Text>
              <Text style={styles.sectionNote}>Atualizado em {formatDateTime(dashboard.lastUpdatedAt)}</Text>
            </View>

            <View style={styles.groupGrid}>
              {userGroups.map((group) => (
                <TouchableOpacity
                  key={group.key}
                  style={[
                    styles.groupCard,
                    activeType === group.key && styles.groupCardActive,
                  ]}
                  onPress={() => setActiveType(activeType === group.key ? 'todos' : group.key)}
                >
                  <View style={styles.groupTop}>
                    <View style={styles.groupIcon}>
                      <Ionicons name={group.icon} size={20} color={adminTheme.colors.primary} />
                    </View>
                    <Text style={styles.groupCount}>{group.count}</Text>
                  </View>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupHelper}>{group.helper}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Card style={styles.controlPanel}>
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={18} color={adminTheme.colors.textMuted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar por nome, email, documento ou tipo"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.searchInput}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.filterButton, activeType === 'todos' && styles.filterButtonActive]}
                  onPress={() => setActiveType('todos')}
                >
                  <Text style={[styles.filterText, activeType === 'todos' && styles.filterTextActive]}>Todos</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.userListHeader}>
                <Text style={styles.userListTitle}>Controle rapido de usuarios</Text>
                <Text style={styles.userListCount}>{visibleUsers.length} exibidos</Text>
              </View>

              {visibleUsers.length ? (
                visibleUsers.map((item) => <UserRow key={`${item.type}-${item.id}`} item={item} />)
              ) : (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyTitle}>Nenhum usuario encontrado</Text>
                  <Text style={styles.emptyText}>Ajuste o filtro ou atualize o painel.</Text>
                </View>
              )}
            </Card>

            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionCard} onPress={() => handleNavigate('AdminCadastros')}>
                <Ionicons name="person-add-outline" size={22} color={adminTheme.colors.primary} />
                <Text style={styles.actionTitle}>Abrir cadastros</Text>
                <Text style={styles.actionText}>Consultar pacientes, nutricionistas, medicos e admins.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={() => handleNavigate('AdminOperacoes')}>
                <Ionicons name="briefcase-outline" size={22} color={adminTheme.colors.primary} />
                <Text style={styles.actionTitle}>Abrir operacoes</Text>
                <Text style={styles.actionText}>Acompanhar pendencias, riscos e alertas operacionais.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={() => handleNavigate('AdminLogsSistema')}>
                <Ionicons name="pulse-outline" size={22} color={adminTheme.colors.primary} />
                <Text style={styles.actionTitle}>Auditoria/Log</Text>
                <Text style={styles.actionText}>Ver alertas, exclusoes, alteracoes e ocorrencias tecnicas.</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Eventos recentes</Text>
              <Text style={styles.sectionNote}>Ultimas atividades registradas</Text>
            </View>

            <Card style={styles.eventsPanel}>
              {dashboard.eventosRecentes.length ? (
                dashboard.eventosRecentes.slice(0, 6).map((item) => (
                  <View key={item.path || item.id} style={styles.eventRow}>
                    <View style={styles.eventDot} />
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {String(item.action || 'acao').replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {item.actorName || item.actorType || 'Usuario nao identificado'} | {formatDateTime(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.eventStatus}>{item.status || 'ok'}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyTitle}>Sem eventos recentes</Text>
                  <Text style={styles.emptyText}>Os eventos aparecem aqui conforme o app for utilizado.</Text>
                </View>
              )}
            </Card>
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
    paddingTop: 10,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 30,
  },
  card: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    padding: adminTheme.spacing.card,
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
  hero: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.xl,
    borderWidth: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
    justifyContent: 'space-between',
    padding: 18,
    ...adminShadow,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroKicker: {
    color: adminTheme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: adminTheme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  heroSubtitle: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 620,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStat: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    minWidth: 104,
    padding: 12,
  },
  heroStatValue: {
    color: adminTheme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  sectionTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionNote: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  groupCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 170,
    padding: 14,
    width: Platform.OS === 'web' ? '23%' : '47%',
    ...adminShadow,
  },
  groupCardActive: {
    borderColor: adminTheme.colors.primary,
    backgroundColor: adminTheme.colors.primarySoft,
  },
  groupTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderRadius: adminTheme.radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  groupCount: {
    color: adminTheme.colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  groupTitle: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 12,
  },
  groupHelper: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  controlPanel: {
    marginTop: 16,
  },
  searchRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: adminTheme.colors.text,
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    outlineStyle: 'none',
  },
  filterButton: {
    alignItems: 'center',
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
  },
  filterButtonActive: {
    backgroundColor: adminTheme.colors.primary,
    borderColor: adminTheme.colors.primary,
  },
  filterText: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  filterTextActive: {
    color: adminTheme.colors.onPrimary,
  },
  userListHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
  },
  userListTitle: {
    color: adminTheme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  userListCount: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  userRow: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    padding: 12,
  },
  userIcon: {
    alignItems: 'center',
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  userName: {
    color: adminTheme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  userMeta: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  statusPill: {
    borderRadius: adminTheme.radius.pill,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusActive: {
    backgroundColor: adminTheme.colors.successSoft,
    color: adminTheme.colors.success,
  },
  statusInactive: {
    backgroundColor: adminTheme.colors.dangerSoft,
    color: adminTheme.colors.danger,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  actionCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 220,
    padding: 16,
    width: Platform.OS === 'web' ? '48%' : '100%',
    ...adminShadow,
  },
  actionTitle: {
    color: adminTheme.colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },
  actionText: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  eventsPanel: {
    marginTop: 12,
  },
  eventRow: {
    alignItems: 'center',
    borderBottomColor: adminTheme.colors.panelBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  eventDot: {
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    color: adminTheme.colors.text,
    fontSize: 13,
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
    textTransform: 'uppercase',
  },
  emptyBlock: {
    alignItems: 'center',
    padding: 22,
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
