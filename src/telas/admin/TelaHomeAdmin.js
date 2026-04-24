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
import { supabase } from '../../servicos/configSupabase';
import { isAdminUser } from '../../servicos/servicoAdmin';
import { listarEventosAuditoria } from '../../servicos/servicoAuditoria';
import { listarLogsSistema } from '../../servicos/servicoLogSistema';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';

const modules = [
  {
    key: 'auditoria',
    title: 'Auditoria Central',
    subtitle: 'Rastreabilidade de negocio',
    helper: 'Eventos de cadastro, alteracao, exclusao logica e movimentacoes sensiveis.',
    icon: 'shield-checkmark-outline',
    route: 'AdminAuditoria',
  },
  {
    key: 'logs',
    title: 'Observabilidade',
    subtitle: 'Erros e sinais tecnicos',
    helper: 'Ocorrencias tecnicas, warnings e falhas de execucao consolidadas.',
    icon: 'pulse-outline',
    route: 'AdminLogsSistema',
  },
];

const initialDashboardState = {
  activePatients: 0,
  excludedPatients: 0,
  nutritionists: 0,
  doctors: 0,
  activeAdmins: 0,
  auditEventsToday: 0,
  auditEventsWeek: 0,
  failedAuditEvents: 0,
  systemErrorsToday: 0,
  systemWarningsToday: 0,
  recentAuditEvents: [],
  recentSystemErrors: [],
  lastUpdatedAt: null,
};

function DashboardCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function formatDateTime(value) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function prettifyAction(value) {
  return String(value || 'acao_nao_informada')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function startOfDay(date = new Date()) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  return current;
}

function buildAlertItems(state) {
  const alerts = [];

  if (state.failedAuditEvents > 0) {
    alerts.push({
      key: 'audit-failures',
      tone: 'danger',
      title: `${state.failedAuditEvents} falha(s) na trilha de auditoria`,
      helper: 'Revise os eventos com status de falha e confirme a rastreabilidade do fluxo.',
    });
  }

  if (state.systemErrorsToday > 0) {
    alerts.push({
      key: 'system-errors',
      tone: 'warning',
      title: `${state.systemErrorsToday} erro(s) tecnicos hoje`,
      helper: 'Acompanhe os erros do sistema antes que eles virem regressao operacional.',
    });
  }

  if (state.excludedPatients > 0) {
    alerts.push({
      key: 'lgpd-review',
      tone: 'info',
      title: `${state.excludedPatients} paciente(s) em exclusao logica`,
      helper: 'Valide acesso, historico e politica de retencao associada a esses registros.',
    });
  }

  if (!alerts.length) {
    alerts.push({
      key: 'stable',
      tone: 'success',
      title: 'Operacao estavel neste momento',
      helper: 'Nao ha alertas prioritarios ativos nos indicadores acompanhados pela home.',
    });
  }

  return alerts;
}

async function fetchCount(queryBuilder) {
  const { count, error } = await queryBuilder;

  if (error) {
    throw error;
  }

  return count || 0;
}

function getAlertStyle(tone) {
  if (tone === 'danger') return [styles.alertCard, styles.alertDanger];
  if (tone === 'warning') return [styles.alertCard, styles.alertWarning];
  if (tone === 'info') return [styles.alertCard, styles.alertInfo];
  if (tone === 'success') return [styles.alertCard, styles.alertSuccess];
  return [styles.alertCard];
}

export default function TelaHomeAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(initialDashboardState);

  async function handleLogout() {
    await onAdminLogout?.();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login', params: { roleInicial: 'Admin' } }],
    });
  }

  async function carregarDashboard({ isRefresh = false } = {}) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const todayStart = startOfDay();

      const [
        activePatients,
        excludedPatients,
        nutritionists,
        doctors,
        activeAdmins,
        auditEvents,
        systemLogs,
      ] = await Promise.all([
        fetchCount(
          supabase
            .from('paciente')
            .select('*', { count: 'exact', head: true })
            .or('excluido.is.null,excluido.eq.false')
        ),
        fetchCount(
          supabase
            .from('paciente')
            .select('*', { count: 'exact', head: true })
            .eq('excluido', true)
        ),
        fetchCount(supabase.from('nutricionista').select('*', { count: 'exact', head: true })),
        fetchCount(
          supabase
            .from('medico')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true)
        ),
        fetchCount(
          supabase
            .from('administrador')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true)
        ),
        listarEventosAuditoria({ days: 7, limit: 80 }),
        listarLogsSistema({ days: 2, limit: 80 }),
      ]);

      const auditEventsToday = auditEvents.filter((item) => {
        const createdAt = new Date(item.createdAt || 0);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= todayStart;
      });
      const failedAuditEvents = auditEvents.filter((item) => item.status === 'falha');
      const systemErrorsToday = systemLogs.filter((item) => {
        const createdAt = new Date(item.createdAt || 0);
        return item.level === 'error' && !Number.isNaN(createdAt.getTime()) && createdAt >= todayStart;
      });
      const systemWarningsToday = systemLogs.filter((item) => {
        const createdAt = new Date(item.createdAt || 0);
        return item.level === 'warn' && !Number.isNaN(createdAt.getTime()) && createdAt >= todayStart;
      });

      setDashboard({
        activePatients,
        excludedPatients,
        nutritionists,
        doctors,
        activeAdmins,
        auditEventsToday: auditEventsToday.length,
        auditEventsWeek: auditEvents.length,
        failedAuditEvents: failedAuditEvents.length,
        systemErrorsToday: systemErrorsToday.length,
        systemWarningsToday: systemWarningsToday.length,
        recentAuditEvents: auditEvents.slice(0, 4),
        recentSystemErrors: systemLogs
          .filter((item) => item.level === 'error' || item.level === 'warn')
          .slice(0, 4),
        lastUpdatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.log('Erro ao carregar dashboard admin:', error);
      setDashboard(initialDashboardState);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdminUser(adminUser)) {
      return;
    }

    carregarDashboard();
  }, [adminUser]);

  const alerts = useMemo(() => buildAlertItems(dashboard), [dashboard]);
  const openAlertsCount = useMemo(
    () => alerts.filter((item) => item.tone !== 'success').length,
    [alerts]
  );
  const userBaseCount = useMemo(
    () =>
      dashboard.activePatients +
      dashboard.nutritionists +
      dashboard.doctors +
      dashboard.activeAdmins,
    [dashboard]
  );
  const kpis = useMemo(
    () => [
      {
        key: 'patients',
        label: 'Pacientes ativos',
        value: dashboard.activePatients,
        note: 'Base assistida ativa',
      },
      {
        key: 'nutritionists',
        label: 'Nutricionistas',
        value: dashboard.nutritionists,
        note: 'Perfis operacionais',
      },
      {
        key: 'doctors',
        label: 'Medicos',
        value: dashboard.doctors,
        note: 'Perfis clinicos',
      },
      {
        key: 'admins',
        label: 'Admins ativos',
        value: dashboard.activeAdmins,
        note: 'Controle institucional',
      },
    ],
    [dashboard]
  );
  const governanceStats = useMemo(
    () => [
      {
        key: 'audit-week',
        label: 'Auditorias em 7 dias',
        value: dashboard.auditEventsWeek,
      },
      {
        key: 'audit-today',
        label: 'Auditorias hoje',
        value: dashboard.auditEventsToday,
      },
      {
        key: 'warnings',
        label: 'Warnings hoje',
        value: dashboard.systemWarningsToday,
      },
      {
        key: 'excluded',
        label: 'Exclusoes logicas',
        value: dashboard.excludedPatients,
      },
    ],
    [dashboard]
  );

  if (!isAdminUser(adminUser)) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <DashboardCard style={styles.accessDeniedCard}>
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
        </DashboardCard>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />

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
        <View style={styles.heroShell}>
          <View style={styles.heroBackdrop} />
          <DashboardCard style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroIdentityBlock}>
                <Text style={styles.heroEyebrow}>Console Administrativo</Text>
                <Text style={styles.heroTitle}>Visao executiva da plataforma</Text>
                <Text style={styles.heroDescription}>
                  Monitore crescimento, governanca e estabilidade do app em um painel unico.
                </Text>
                <Text style={styles.heroIdentity}>
                  {adminUser?.nome_completo_admin || adminUser?.email_acesso || 'Administrador'}
                </Text>
              </View>

              <View style={styles.heroActionColumn}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => carregarDashboard({ isRefresh: true })}
                >
                  <Ionicons name="refresh-outline" size={16} color={adminTheme.colors.primaryStrong} />
                  <Text style={styles.secondaryButtonText}>Atualizar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={16} color={adminTheme.colors.textOnDark} />
                  <Text style={styles.ghostButtonText}>Sair</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatPill}>
                <Ionicons name="people-outline" size={15} color={adminTheme.colors.primaryStrong} />
                <Text style={styles.heroStatText}>{userBaseCount} usuario(s) monitorados</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Ionicons name="alert-circle-outline" size={15} color={adminTheme.colors.primaryStrong} />
                <Text style={styles.heroStatText}>{openAlertsCount} alerta(s) abertos</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Ionicons name="time-outline" size={15} color={adminTheme.colors.primaryStrong} />
                <Text style={styles.heroStatText}>
                  Atualizado em {formatDateTime(dashboard.lastUpdatedAt)}
                </Text>
              </View>
            </View>
          </DashboardCard>
        </View>

        {loading ? (
          <DashboardCard style={styles.loadingCard}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.loadingText}>Carregando metricas administrativas...</Text>
          </DashboardCard>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Base operacional</Text>
            <View style={styles.kpiGrid}>
              {kpis.map((item) => (
                <DashboardCard key={item.key} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{item.label}</Text>
                  <Text style={styles.kpiValue}>{item.value}</Text>
                  <Text style={styles.kpiNote}>{item.note}</Text>
                </DashboardCard>
              ))}
            </View>

            <View style={styles.splitSection}>
              <View style={styles.splitColumnLarge}>
                <Text style={styles.sectionTitle}>Risco e governanca</Text>
                <View style={styles.metricStrip}>
                  {governanceStats.map((item) => (
                    <DashboardCard key={item.key} style={styles.stripCard}>
                      <Text style={styles.stripLabel}>{item.label}</Text>
                      <Text style={styles.stripValue}>{item.value}</Text>
                    </DashboardCard>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Alertas operacionais</Text>
                {alerts.map((item) => (
                  <DashboardCard key={item.key} style={getAlertStyle(item.tone)}>
                    <Text style={styles.alertTitle}>{item.title}</Text>
                    <Text style={styles.alertHelper}>{item.helper}</Text>
                  </DashboardCard>
                ))}
              </View>

              <View style={styles.splitColumnSmall}>
                <Text style={styles.sectionTitle}>Atalhos</Text>
                {modules.map((item) => {
                  const metric =
                    item.key === 'auditoria'
                      ? `${dashboard.auditEventsToday} evento(s) hoje`
                      : `${dashboard.systemErrorsToday} erro(s) hoje`;

                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={styles.moduleCard}
                      onPress={() => navigation.navigate(item.route)}
                    >
                      <View style={styles.moduleBadge}>
                        <Ionicons name={item.icon} size={20} color={adminTheme.colors.accent} />
                      </View>
                      <Text style={styles.moduleTitle}>{item.title}</Text>
                      <Text style={styles.moduleSubtitle}>{item.subtitle}</Text>
                      <Text style={styles.moduleHelper}>{item.helper}</Text>
                      <Text style={styles.moduleMetric}>{metric}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.splitSection}>
              <View style={styles.splitColumnLarge}>
                <Text style={styles.sectionTitle}>Ultimos eventos de auditoria</Text>
                {dashboard.recentAuditEvents.length ? (
                  dashboard.recentAuditEvents.map((item) => (
                    <TouchableOpacity
                      key={item.path || item.id}
                      style={styles.eventCard}
                      onPress={() => navigation.navigate('AdminAuditoria')}
                    >
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle}>{prettifyAction(item.action)}</Text>
                        <Text style={styles.eventTime}>{formatDateTime(item.createdAt)}</Text>
                      </View>
                      <Text style={styles.eventMeta}>
                        {[item.actorType || 'anonimo', item.actorName || 'Sem nome'].join(' | ')}
                      </Text>
                      <Text style={styles.eventMeta}>
                        {[item.entity || 'entidade', item.entityId || 'sem id'].join(' | ')}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <DashboardCard style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Nenhum evento de auditoria recente.</Text>
                  </DashboardCard>
                )}
              </View>

              <View style={styles.splitColumnSmall}>
                <Text style={styles.sectionTitle}>Sinais tecnicos</Text>
                {dashboard.recentSystemErrors.length ? (
                  dashboard.recentSystemErrors.map((item) => (
                    <TouchableOpacity
                      key={item.path || item.id}
                      style={styles.systemCard}
                      onPress={() => navigation.navigate('AdminLogsSistema')}
                    >
                      <View style={styles.systemLevelRow}>
                        <Text style={styles.systemSource}>{item.source || 'sistema'}</Text>
                        <Text
                          style={[
                            styles.systemLevel,
                            item.level === 'error'
                              ? styles.systemLevelDanger
                              : styles.systemLevelWarning,
                          ]}
                        >
                          {String(item.level || 'log').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.eventTime}>{formatDateTime(item.createdAt)}</Text>
                      <Text style={styles.systemMessage} numberOfLines={3}>
                        {item.message || 'Mensagem nao informada.'}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <DashboardCard style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Sem erros ou warnings recentes.</Text>
                  </DashboardCard>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
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
    padding: adminTheme.spacing.screen,
    paddingBottom: 42,
  },
  card: {
    backgroundColor: adminTheme.colors.panel,
    borderRadius: adminTheme.radius.lg,
    padding: adminTheme.spacing.card,
    ...adminShadow,
  },
  heroShell: {
    marginTop: 6,
    position: 'relative',
  },
  heroBackdrop: {
    backgroundColor: adminTheme.colors.backgroundAccent,
    borderRadius: adminTheme.radius.xl,
    bottom: 12,
    left: 10,
    opacity: 1,
    position: 'absolute',
    right: 10,
    top: 12,
  },
  heroCard: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.panelBorder,
    borderWidth: 1.5,
    padding: 22,
  },
  heroTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  heroIdentityBlock: {
    flex: 1,
    minWidth: 240,
  },
  heroEyebrow: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: adminTheme.colors.textOnDark,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginTop: 10,
  },
  heroDescription: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 620,
  },
  heroIdentity: {
    color: adminTheme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
  },
  heroActionColumn: {
    gap: 10,
    minWidth: 170,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: adminTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primarySoft,
    borderColor: adminTheme.colors.primary,
    borderWidth: 1.5,
    borderRadius: adminTheme.radius.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: adminTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1.2,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  ghostButtonText: {
    color: adminTheme.colors.textOnDark,
    fontSize: 14,
    fontWeight: '800',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  heroStatPill: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  heroStatText: {
    color: adminTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: adminTheme.spacing.section,
    minHeight: 120,
  },
  loadingText: {
    color: adminTheme.colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    color: adminTheme.colors.text,
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: adminTheme.spacing.section,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    borderColor: adminTheme.colors.primary,
    borderWidth: 1.2,
    minHeight: 136,
    width: '48%',
  },
  kpiLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  kpiValue: {
    color: adminTheme.colors.primaryStrong,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 14,
  },
  kpiNote: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  splitSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  splitColumnLarge: {
    flex: 1.35,
    minWidth: 280,
  },
  splitColumnSmall: {
    flex: 1,
    minWidth: 250,
  },
  metricStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stripCard: {
    borderColor: adminTheme.colors.primary,
    borderWidth: 1.2,
    minHeight: 104,
    width: '48%',
  },
  stripLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  stripValue: {
    color: adminTheme.colors.text,
    fontSize: 27,
    fontWeight: '800',
    marginTop: 12,
  },
  alertCard: {
    borderWidth: 1.2,
    marginBottom: 12,
  },
  alertSuccess: {
    backgroundColor: adminTheme.colors.successSoft,
    borderColor: adminTheme.colors.primarySoft,
  },
  alertWarning: {
    backgroundColor: adminTheme.colors.warningSoft,
    borderColor: adminTheme.colors.panelBorder,
  },
  alertDanger: {
    backgroundColor: adminTheme.colors.dangerSoft,
    borderColor: adminTheme.colors.danger,
  },
  alertInfo: {
    backgroundColor: adminTheme.colors.infoSoft,
    borderColor: adminTheme.colors.panelBorder,
  },
  alertTitle: {
    color: adminTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  alertHelper: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  moduleCard: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1.3,
    marginBottom: 12,
    padding: adminTheme.spacing.card,
  },
  moduleBadge: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primarySoft,
    borderColor: adminTheme.colors.primary,
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  moduleTitle: {
    color: adminTheme.colors.textOnDark,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
  },
  moduleSubtitle: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  moduleHelper: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  moduleMetric: {
    color: adminTheme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
  },
  eventCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1.1,
    marginBottom: 12,
    padding: adminTheme.spacing.card,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  eventTitle: {
    color: adminTheme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  eventTime: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  eventMeta: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  systemCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1.1,
    marginBottom: 12,
    padding: adminTheme.spacing.card,
  },
  systemLevelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  systemSource: {
    color: adminTheme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  systemLevel: {
    borderRadius: adminTheme.radius.pill,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  systemLevelDanger: {
    backgroundColor: adminTheme.colors.dangerSoft,
    color: adminTheme.colors.danger,
  },
  systemLevelWarning: {
    backgroundColor: adminTheme.colors.warningSoft,
    color: adminTheme.colors.warning,
  },
  systemMessage: {
    color: adminTheme.colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  emptyCard: {
    minHeight: 108,
    justifyContent: 'center',
  },
  emptyText: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  accessDeniedCard: {
    margin: adminTheme.spacing.screen,
    marginTop: 26,
  },
  accessDeniedTitle: {
    color: adminTheme.colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  accessDeniedText: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
});
