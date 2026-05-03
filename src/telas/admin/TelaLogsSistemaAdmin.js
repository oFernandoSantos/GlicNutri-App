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
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';
import { listarLogsSistema } from '../../servicos/servicoLogSistema';
import { registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import { isAdminUser } from '../../servicos/servicoAdmin';

const levelFilters = [
  { key: '', label: 'Todos' },
  { key: 'log', label: 'Logs' },
  { key: 'warn', label: 'Warnings' },
  { key: 'error', label: 'Erros' },
];

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function buildSummary(logs) {
  return {
    total: logs.length,
    logs: logs.filter((item) => item.level === 'log').length,
    warnings: logs.filter((item) => item.level === 'warn').length,
    errors: logs.filter((item) => item.level === 'error').length,
  };
}

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export default function TelaLogsSistemaAdmin({ navigation, route, usuarioLogado }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');

  async function carregarLogs({ isRefresh = false } = {}) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await listarLogsSistema({
        days: 7,
        limit: 80,
        level,
        search,
      });

      setLogs(data);

      if (isAdminUser(adminUser)) {
        await registrarLogAuditoria({
          actor: adminUser,
          actorType: 'admin',
          action: 'admin_consulta_logs_sistema',
          entity: 'painel_logs',
          entityId: adminUser?.id_admin_uuid || null,
          origin: 'admin_logs',
          status: 'sucesso',
          details: {
            filtro_nivel: level || 'todos',
            resultado_logs: data.length,
          },
        });
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarLogs();
  }, [level]);

  const summary = useMemo(() => buildSummary(logs), [logs]);

  if (!isAdminUser(adminUser)) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <SectionCard style={styles.heroCard}>
          <Text style={styles.heroTitle}>Acesso negado</Text>
          <Text style={styles.heroText}>Entre com um perfil administrador para consultar os logs do sistema.</Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login', params: { roleInicial: 'Admin' } }],
              })
            }
          >
            <Text style={styles.searchButtonText}>Ir para login admin</Text>
          </TouchableOpacity>
        </SectionCard>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />

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
        <SectionCard style={styles.heroCard}>
          <Text style={styles.eyebrow}>Painel administrativo</Text>
          <Text style={styles.heroTitle}>Logs do sistema</Text>
          <Text style={styles.heroText}>
            Monitore eventos tecnicos, erros, warnings e mensagens operacionais capturadas do app inteiro.
          </Text>
        </SectionCard>

        <View style={styles.summaryGrid}>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>{summary.total}</Text>
          </SectionCard>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Logs</Text>
            <Text style={styles.summaryValue}>{summary.logs}</Text>
          </SectionCard>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Warnings</Text>
            <Text style={styles.summaryValue}>{summary.warnings}</Text>
          </SectionCard>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Erros</Text>
            <Text style={styles.summaryValue}>{summary.errors}</Text>
          </SectionCard>
        </View>

        <SectionCard style={styles.filterCard}>
          <Text style={styles.filterTitle}>Consulta tecnica</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por mensagem, source ou stack"
            placeholderTextColor={adminTheme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => carregarLogs()}>
            <Ionicons name="search-outline" size={18} color={adminTheme.colors.onPrimary} />
            <Text style={styles.searchButtonText}>Atualizar consulta</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
            {levelFilters.map((item) => {
              const active = level === item.key;
              return (
                <TouchableOpacity
                  key={item.key || 'todos'}
                  style={[styles.filterTab, active && styles.filterTabActive]}
                  onPress={() => setLevel(item.key)}
                >
                  <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SectionCard>

        <Text style={styles.sectionTitle}>Ocorrencias recentes</Text>

        {loading ? (
          <SectionCard style={styles.stateCard}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.stateText}>Carregando logs do sistema...</Text>
          </SectionCard>
        ) : logs.length === 0 ? (
          <SectionCard style={styles.stateCard}>
            <Text style={styles.stateText}>Nenhum log encontrado para os filtros atuais.</Text>
          </SectionCard>
        ) : (
          logs.map((item) => (
            <SectionCard key={item.path || item.id} style={styles.eventCard}>
              <View style={styles.eventTopRow}>
                <Text style={styles.eventAction}>{item.source || 'sistema'}</Text>
                <View
                  style={[
                    styles.statusPill,
                    item.level === 'error'
                      ? styles.statusPillError
                      : item.level === 'warn'
                        ? styles.statusPillWarn
                        : styles.statusPillSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      item.level === 'error'
                        ? styles.statusPillTextError
                        : item.level === 'warn'
                          ? styles.statusPillTextWarn
                          : styles.statusPillTextSuccess,
                    ]}
                  >
                    {String(item.level || 'log').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.eventMeta}>{formatDateTime(item.createdAt)} • {item.platform || Platform.OS}</Text>
              <Text style={styles.eventMessage}>{item.message || 'Mensagem nao informada.'}</Text>
              <Text style={styles.eventPath}>{item.path || 'arquivo nao informado'}</Text>

              {item.context ? (
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsTitle}>Contexto</Text>
                  <Text style={styles.detailsText}>
                    {typeof item.context === 'string'
                      ? item.context
                      : JSON.stringify(item.context, null, 2)}
                  </Text>
                </View>
              ) : null}

              {item.stack ? (
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsTitle}>Stack</Text>
                  <Text style={styles.detailsText}>{item.stack}</Text>
                </View>
              ) : null}
            </SectionCard>
          ))
        )}
      </ScrollView>
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
    padding: adminTheme.spacing.screen,
    paddingBottom: 40,
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  sectionCard: {
    backgroundColor: adminTheme.colors.panel,
    borderRadius: adminTheme.radius.xl,
    padding: adminTheme.spacing.card,
    ...adminShadow,
  },
  heroCard: {
    marginTop: 6,
    backgroundColor: adminTheme.colors.panelStrong,
    borderWidth: 1.5,
  },
  eyebrow: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: adminTheme.colors.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 10,
  },
  heroText: {
    color: adminTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  summaryCard: {
    borderColor: adminTheme.colors.primary,
    borderWidth: 1.1,
    minHeight: 110,
    width: '48%',
  },
  summaryLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
  },
  summaryValue: {
    color: adminTheme.colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 10,
  },
  filterCard: {
    marginTop: 18,
  },
  filterTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  searchInput: {
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1.4,
    color: adminTheme.colors.text,
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 46,
  },
  searchButtonText: {
    color: adminTheme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  filterTabs: {
    gap: 10,
    marginTop: 14,
    paddingRight: 10,
  },
  filterTab: {
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterTabActive: {
    backgroundColor: adminTheme.colors.primary,
  },
  filterTabText: {
    color: adminTheme.colors.text,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: adminTheme.colors.onPrimary,
  },
  sectionTitle: {
    color: adminTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 24,
  },
  stateCard: {
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  stateText: {
    color: adminTheme.colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  eventCard: {
    borderColor: adminTheme.colors.primary,
    borderWidth: 1.1,
    marginBottom: 12,
  },
  eventTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventAction: {
    color: adminTheme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: adminTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillSuccess: {
    backgroundColor: adminTheme.colors.infoSoft,
  },
  statusPillWarn: {
    backgroundColor: adminTheme.colors.warningSoft,
  },
  statusPillError: {
    backgroundColor: adminTheme.colors.dangerSoft,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillTextSuccess: {
    color: adminTheme.colors.info,
  },
  statusPillTextWarn: {
    color: adminTheme.colors.warning,
  },
  statusPillTextError: {
    color: adminTheme.colors.danger,
  },
  eventMeta: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  eventMessage: {
    color: adminTheme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  eventPath: {
    color: adminTheme.colors.info,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  detailsBox: {
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  detailsTitle: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  detailsText: {
    color: adminTheme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
