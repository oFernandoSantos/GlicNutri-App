import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

const initialState = {
  consultas: 0,
  glicemiasCriticas: 0,
  refeicoesPendentes: 0,
  pacientesSemNutri: 0,
  alertasAuditoria: 0,
  falhasAuditoria: 0,
  eventosRecentes: [],
  detalhes: {
    consultas: [],
    glicemiasCriticas: [],
    refeicoesPendentes: [],
    pacientesSemNutri: [],
    alertasAuditoria: [],
    falhasAuditoria: [],
  },
};

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function countRows(table, modifier) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (modifier) query = modifier(query);
  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

async function fetchRows(table, modifier, limit = 20) {
  let query = supabase.from(table).select('*').limit(limit);
  if (modifier) query = modifier(query);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

function OperationCard({ icon, title, value, helper, tone = 'normal', active = false, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      style={[
        styles.operationCard,
        active && styles.operationActive,
        tone === 'danger' && styles.operationDanger,
        tone === 'warning' && styles.operationWarning,
      ]}
      onPress={onPress}
    >
      <View style={styles.operationTop}>
        <View style={styles.operationIcon}>
          <Ionicons name={icon} size={20} color={adminTheme.colors.primary} />
        </View>
        <Text style={styles.operationValue}>{value}</Text>
      </View>
      <Text style={styles.operationTitle}>{title}</Text>
      <Text style={styles.operationHelper}>{helper}</Text>
      <View style={styles.openHint}>
        <Text style={styles.openHintText}>Ver detalhes</Text>
        <Ionicons name="chevron-forward-outline" size={15} color={adminTheme.colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

function getDetailTitle(key) {
  const titles = {
    consultas: 'Consultas futuras',
    glicemiasCriticas: 'Glicemias criticas hoje',
    refeicoesPendentes: 'Refeicoes pendentes',
    pacientesSemNutri: 'Pacientes sem nutricionista',
    alertasAuditoria: 'Alertas de hoje',
    falhasAuditoria: 'Falhas de hoje',
  };
  return titles[key] || 'Detalhes';
}

function getDetailDescription(key) {
  const descriptions = {
    consultas: 'Agendamentos encontrados a partir de hoje.',
    glicemiasCriticas: 'Registros manuais de glicemia acima de 250 mg/dL hoje.',
    refeicoesPendentes: 'Refeicoes de IA ainda sem confirmacao.',
    pacientesSemNutri: 'Pacientes ativos sem vinculo com nutricionista.',
    alertasAuditoria: 'Eventos de auditoria marcados como alerta hoje.',
    falhasAuditoria: 'Eventos de auditoria com status de falha hoje.',
  };
  return descriptions[key] || '';
}

function formatDetailItem(key, item) {
  if (key === 'consultas') {
    return {
      title: item?.motivo || item?.status || 'Consulta agendada',
      meta: `Paciente: ${item?.paciente_id || 'n/a'} | Nutri: ${item?.nutricionista_id || 'n/a'}`,
      extra: formatDateTime(item?.scheduled_at || item?.created_at),
    };
  }
  if (key === 'glicemiasCriticas') {
    return {
      title: `${item?.valor_glicose_mgdl || '--'} mg/dL`,
      meta: `Paciente: ${item?.id_paciente_uuid || 'n/a'}`,
      extra: `${item?.data || '--'} ${String(item?.hora || '').slice(0, 5)}`,
    };
  }
  if (key === 'refeicoesPendentes') {
    return {
      title: 'Refeicao pendente',
      meta: `Paciente: ${item?.paciente_id || 'n/a'} | Carboidratos: ${item?.carboidratos_total ?? '--'}`,
      extra: formatDateTime(item?.created_at),
    };
  }
  if (key === 'pacientesSemNutri') {
    return {
      title: item?.nome_completo || item?.email_pac || 'Paciente sem nome',
      meta: item?.email_pac || 'Email nao informado',
      extra: item?.cpf_paciente || item?.id_paciente_uuid || '',
    };
  }
  return {
    title: String(item?.action || 'Evento').replace(/_/g, ' '),
    meta: item?.actorName || item?.actorType || 'Usuario nao identificado',
    extra: formatDateTime(item?.createdAt),
  };
}

export default function TelaOperacoesAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [state, setState] = useState(initialState);
  const [activeDetail, setActiveDetail] = useState('glicemiasCriticas');
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  async function handleLogout() {
    setMenuVisible(false);
    if (adminUser) {
      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'logout_admin',
        entity: 'sessao',
        entityId: adminUser?.id_admin_uuid || null,
        origin: 'admin_operacoes',
        status: 'sucesso',
        details: {},
      });
    }
    await onAdminLogout?.();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  async function carregar({ isRefresh = false } = {}) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isoToday = today.toISOString().slice(0, 10);

      const [
        consultas,
        glicemiasCriticas,
        refeicoesPendentes,
        pacientesSemNutri,
        consultasRows,
        glicemiasRows,
        refeicoesRows,
        pacientesSemNutriRows,
        eventosRecentes,
      ] =
        await Promise.all([
          countRows('consulta', (q) => q.gte('scheduled_at', today.toISOString())),
          countRows('registro_glicemia_manual', (q) => q.gte('valor_glicose_mgdl', 250).gte('data', isoToday)),
          countRows('refeicao_ia', (q) => q.eq('confirmado', false)),
          countRows('paciente', (q) => q.is('id_nutricionista_uuid', null).or('excluido.is.null,excluido.eq.false')),
          fetchRows('consulta', (q) => q.gte('scheduled_at', today.toISOString()).order('scheduled_at', { ascending: true })),
          fetchRows('registro_glicemia_manual', (q) => q.gte('valor_glicose_mgdl', 250).gte('data', isoToday).order('data', { ascending: false })),
          fetchRows('refeicao_ia', (q) => q.eq('confirmado', false).order('created_at', { ascending: false })),
          fetchRows('paciente', (q) => q.is('id_nutricionista_uuid', null).or('excluido.is.null,excluido.eq.false')),
          listarEventosAuditoria({ days: 2, limit: 10 }).catch(() => []),
        ]);

      const eventosHoje = eventosRecentes.filter((item) => {
        const createdAt = new Date(item.createdAt || 0);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= today;
      });

      setState({
        consultas,
        glicemiasCriticas,
        refeicoesPendentes,
        pacientesSemNutri,
        alertasAuditoria: eventosHoje.filter((item) => String(item.status || '').toLowerCase() === 'alerta').length,
        falhasAuditoria: eventosHoje.filter((item) => String(item.status || '').toLowerCase() === 'falha').length,
        eventosRecentes,
        detalhes: {
          consultas: consultasRows,
          glicemiasCriticas: glicemiasRows,
          refeicoesPendentes: refeicoesRows,
          pacientesSemNutri: pacientesSemNutriRows,
          alertasAuditoria: eventosHoje.filter((item) => String(item.status || '').toLowerCase() === 'alerta'),
          falhasAuditoria: eventosHoje.filter((item) => String(item.status || '').toLowerCase() === 'falha'),
        },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isAdminUser(adminUser)) carregar();
  }, [adminUser]);

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: isAdminUser(adminUser) ? () => setMenuVisible(true) : undefined,
      readerMenuDisabled: !isAdminUser(adminUser),
      readerRightAction: () => carregar({ isRefresh: true }),
      readerRightIcon: 'refresh-outline',
      readerRightLoading: refreshing,
    });
  }, [navigation, adminUser, refreshing]);

  const prioridade = useMemo(
    () => state.glicemiasCriticas + state.refeicoesPendentes + state.pacientesSemNutri + state.falhasAuditoria,
    [state]
  );
  const detailItems = state.detalhes?.[activeDetail] || [];

  function abrirDetalhes(key) {
    setActiveDetail(key);
    setDetailModalVisible(true);
  }

  if (!isAdminUser(adminUser)) {
    return (
      <View style={styles.container}>
        <Text style={styles.accessText}>Entre com um perfil administrador.</Text>
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
          onNavigate={(routeName, params = {}) => navigation.navigate(routeName, { usuarioLogado: adminUser, ...params })}
          onLogout={handleLogout}
          currentRoute="AdminOperacoes"
          userName={adminUser?.nome_completo_admin || adminUser?.email_acesso || 'Administrador'}
          userSubtitle="Operacao do app"
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar({ isRefresh: true })} />}
      >
        <View style={styles.hero}>
          <View>
            <Text style={styles.heroKicker}>Operacoes</Text>
            <Text style={styles.heroTitle}>Painel operacional</Text>
            <Text style={styles.heroText}>Acompanhe riscos, pendencias e atividades que pedem acao do administrador.</Text>
          </View>
          <View style={styles.priorityBox}>
            <Text style={styles.priorityValue}>{prioridade}</Text>
            <Text style={styles.priorityLabel}>prioridades</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.loadingText}>Carregando operacoes...</Text>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <OperationCard icon="calendar-outline" title="Consultas futuras" value={state.consultas} helper="Agendamentos a partir de hoje." active={activeDetail === 'consultas'} onPress={() => abrirDetalhes('consultas')} />
              <OperationCard icon="alert-circle-outline" title="Glicemias criticas hoje" value={state.glicemiasCriticas} helper="Registros acima de 250 mg/dL." tone="danger" active={activeDetail === 'glicemiasCriticas'} onPress={() => abrirDetalhes('glicemiasCriticas')} />
              <OperationCard icon="restaurant-outline" title="Refeicoes pendentes" value={state.refeicoesPendentes} helper="Analises de refeicao ainda nao confirmadas." tone="warning" active={activeDetail === 'refeicoesPendentes'} onPress={() => abrirDetalhes('refeicoesPendentes')} />
              <OperationCard icon="people-outline" title="Pacientes sem nutri" value={state.pacientesSemNutri} helper="Pacientes ativos sem vinculo nutricional." tone="warning" active={activeDetail === 'pacientesSemNutri'} onPress={() => abrirDetalhes('pacientesSemNutri')} />
              <OperationCard icon="notifications-outline" title="Alertas hoje" value={state.alertasAuditoria} helper="Eventos marcados como alerta." active={activeDetail === 'alertasAuditoria'} onPress={() => abrirDetalhes('alertasAuditoria')} />
              <OperationCard icon="bug-outline" title="Falhas hoje" value={state.falhasAuditoria} helper="Eventos com status de falha." tone="danger" active={activeDetail === 'falhasAuditoria'} onPress={() => abrirDetalhes('falhasAuditoria')} />
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AdminCadastros', { usuarioLogado: adminUser })}>
                <Ionicons name="person-add-outline" size={22} color={adminTheme.colors.primary} />
                <Text style={styles.actionTitle}>Ver cadastros</Text>
                <Text style={styles.actionText}>Revisar usuarios, perfis e acessos cadastrados.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AdminLogsSistema', { usuarioLogado: adminUser })}>
                <Ionicons name="pulse-outline" size={22} color={adminTheme.colors.primary} />
                <Text style={styles.actionTitle}>Abrir Auditoria/Log</Text>
                <Text style={styles.actionText}>Investigar alertas, falhas e acoes sensiveis.</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Atividades recentes</Text>
              {state.eventosRecentes.length ? state.eventosRecentes.map((item) => (
                <View key={item.path || item.id} style={styles.eventRow}>
                  <View style={styles.eventDot} />
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{String(item.action || 'acao').replace(/_/g, ' ')}</Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>{item.actorName || item.actorType || 'Usuario'} | {formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.eventStatus}>{item.status || 'ok'}</Text>
                </View>
              )) : (
                <Text style={styles.emptyText}>Nenhuma atividade recente.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => setDetailModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>{getDetailTitle(activeDetail)}</Text>
                <Text style={styles.detailSubtitle}>{getDetailDescription(activeDetail)}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close-outline" size={22} color={adminTheme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalCount}>{detailItems.length} registro(s)</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {detailItems.length ? detailItems.map((item, index) => {
                const detail = formatDetailItem(activeDetail, item);
                return (
                  <View key={item.id || item.path || item.id_glicemia_manual_uuid || item.id_paciente_uuid || index} style={styles.detailRow}>
                    <View style={styles.detailNumber}>
                      <Text style={styles.detailNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.detailInfo}>
                      <Text style={styles.detailTitle} numberOfLines={1}>{detail.title}</Text>
                      <Text style={styles.detailMeta} numberOfLines={1}>{detail.meta}</Text>
                      <Text style={styles.detailExtra} numberOfLines={1}>{detail.extra}</Text>
                    </View>
                  </View>
                );
              }) : (
                <Text style={styles.emptyText}>Nenhum registro encontrado para este bloco.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BarraAbasAdmin navigation={navigation} rotaAtual="AdminOperacoes" usuarioLogado={adminUser} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.background },
  containerWeb: { minHeight: '100%', overflow: 'visible' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 10,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 30,
  },
  hero: {
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.xl,
    borderWidth: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 16,
    padding: 18,
    ...adminShadow,
  },
  heroKicker: { color: adminTheme.colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: adminTheme.colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  heroText: { color: adminTheme.colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 620 },
  priorityBox: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    minWidth: 130,
    padding: 16,
  },
  priorityValue: { color: adminTheme.colors.text, fontSize: 34, fontWeight: '900' },
  priorityLabel: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '900' },
  loadingCard: { alignItems: 'center', gap: 10, marginTop: 22 },
  loadingText: { color: adminTheme.colors.textMuted, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  operationCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 210,
    padding: 16,
    width: Platform.OS === 'web' ? '31%' : '100%',
    ...adminShadow,
  },
  operationActive: {
    backgroundColor: adminTheme.colors.primarySoft,
    borderColor: adminTheme.colors.primary,
  },
  operationDanger: { borderColor: adminTheme.colors.danger },
  operationWarning: { borderColor: adminTheme.colors.primaryStrong },
  operationTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  operationIcon: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderRadius: adminTheme.radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  operationValue: { color: adminTheme.colors.text, fontSize: 28, fontWeight: '900' },
  operationTitle: { color: adminTheme.colors.text, fontSize: 15, fontWeight: '900', marginTop: 12 },
  operationHelper: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 5 },
  openHint: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 12 },
  openHintText: { color: adminTheme.colors.primary, fontSize: 12, fontWeight: '900' },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  detailSubtitle: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  detailCount: {
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    color: adminTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailRow: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    padding: 12,
  },
  detailNumber: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelMuted,
    borderRadius: adminTheme.radius.md,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  detailNumberText: { color: adminTheme.colors.primary, fontSize: 12, fontWeight: '900' },
  detailInfo: { flex: 1, minWidth: 0 },
  detailTitle: { color: adminTheme.colors.text, fontSize: 14, fontWeight: '900' },
  detailMeta: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  detailExtra: { color: adminTheme.colors.primary, fontSize: 12, fontWeight: '800', marginTop: 3 },
  modalOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  modalCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.xl,
    borderWidth: 1,
    maxHeight: '78%',
    maxWidth: 680,
    padding: 16,
    width: '100%',
    ...adminShadow,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modalTitleWrap: { flex: 1, minWidth: 0 },
  modalTitle: { color: adminTheme.colors.text, fontSize: 19, fontWeight: '900' },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  modalCount: {
    color: adminTheme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  modalList: { marginTop: 6 },
  modalListContent: { paddingBottom: 4 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
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
  actionTitle: { color: adminTheme.colors.text, fontSize: 15, fontWeight: '900', marginTop: 10 },
  actionText: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 5 },
  panel: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
    ...adminShadow,
  },
  sectionTitle: { color: adminTheme.colors.text, fontSize: 16, fontWeight: '900', marginBottom: 6 },
  eventRow: {
    alignItems: 'center',
    borderBottomColor: adminTheme.colors.panelBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  eventDot: { backgroundColor: adminTheme.colors.primary, borderRadius: 5, height: 10, width: 10 },
  eventInfo: { flex: 1, minWidth: 0 },
  eventTitle: { color: adminTheme.colors.text, fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  eventMeta: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  eventStatus: { color: adminTheme.colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  emptyText: { color: adminTheme.colors.textMuted, fontSize: 13, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  accessText: { color: adminTheme.colors.text, margin: 20 },
});
