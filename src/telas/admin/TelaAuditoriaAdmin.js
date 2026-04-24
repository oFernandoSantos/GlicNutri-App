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
import { listarEventosAuditoria } from '../../servicos/servicoAuditoria';
import { isAdminUser } from '../../servicos/servicoAdmin';

const actorFilters = [
  { key: '', label: 'Todos' },
  { key: 'paciente', label: 'Pacientes' },
  { key: 'nutricionista', label: 'Nutris' },
  { key: 'medico', label: 'Medicos' },
  { key: 'sistema', label: 'Sistema' },
];

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

function buildSummary(events) {
  return {
    total: events.length,
    pacientes: events.filter((item) => item.actorType === 'paciente').length,
    nutricionistas: events.filter((item) => item.actorType === 'nutricionista').length,
    falhas: events.filter((item) => item.status === 'falha').length,
  };
}

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export default function TelaAuditoriaAdmin({ navigation, route, usuarioLogado }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [actorType, setActorType] = useState('');

  async function carregarEventos({ isRefresh = false } = {}) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await listarEventosAuditoria({
        days: 14,
        limit: 80,
        actorType,
        search,
      });

      setEvents(data);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarEventos();
  }, [actorType]);

  const summary = useMemo(() => buildSummary(events), [events]);

  if (!isAdminUser(adminUser)) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <SectionCard style={styles.heroCard}>
          <Text style={styles.heroTitle}>Acesso negado</Text>
          <Text style={styles.heroText}>Entre com um perfil administrador para consultar a auditoria.</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={() => carregarEventos({ isRefresh: true })} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionCard style={styles.heroCard}>
          <Text style={styles.eyebrow}>Painel administrativo</Text>
          <Text style={styles.heroTitle}>Auditoria central</Text>
          <Text style={styles.heroText}>
            Acompanhe movimentacoes do sistema em arquivos de auditoria separados da base principal.
          </Text>
        </SectionCard>

        <View style={styles.summaryGrid}>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Eventos</Text>
            <Text style={styles.summaryValue}>{summary.total}</Text>
          </SectionCard>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pacientes</Text>
            <Text style={styles.summaryValue}>{summary.pacientes}</Text>
          </SectionCard>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Nutris</Text>
            <Text style={styles.summaryValue}>{summary.nutricionistas}</Text>
          </SectionCard>
          <SectionCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Falhas</Text>
            <Text style={styles.summaryValue}>{summary.falhas}</Text>
          </SectionCard>
        </View>

        <SectionCard style={styles.filterCard}>
          <Text style={styles.filterTitle}>Filtros</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por acao, entidade, ator ou paciente"
            placeholderTextColor={adminTheme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => carregarEventos()}>
            <Ionicons name="search-outline" size={18} color={adminTheme.colors.onPrimary} />
            <Text style={styles.searchButtonText}>Atualizar consulta</Text>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabs}
          >
            {actorFilters.map((item) => {
              const active = actorType === item.key;
              return (
                <TouchableOpacity
                  key={item.key || 'todos'}
                  style={[styles.filterTab, active && styles.filterTabActive]}
                  onPress={() => setActorType(item.key)}
                >
                  <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SectionCard>

        <Text style={styles.sectionTitle}>Eventos recentes</Text>

        {loading ? (
          <SectionCard style={styles.stateCard}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.stateText}>Carregando auditoria...</Text>
          </SectionCard>
        ) : events.length === 0 ? (
          <SectionCard style={styles.stateCard}>
            <Text style={styles.stateText}>Nenhum evento encontrado para os filtros atuais.</Text>
          </SectionCard>
        ) : (
          events.map((item) => (
            <SectionCard key={item.path || item.id} style={styles.eventCard}>
              <View style={styles.eventTopRow}>
                <Text style={styles.eventAction}>{prettifyAction(item.action)}</Text>
                <View
                  style={[
                    styles.statusPill,
                    item.status === 'falha' ? styles.statusPillError : styles.statusPillSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      item.status === 'falha'
                        ? styles.statusPillTextError
                        : styles.statusPillTextSuccess,
                    ]}
                  >
                    {String(item.status || 'sucesso').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.eventMeta}>
                {item.actorType || 'anonimo'} • {item.actorName || 'Sem nome'} • {formatDateTime(item.createdAt)}
              </Text>
              <Text style={styles.eventMeta}>
                Entidade: {item.entity || 'n/a'} {item.entityId ? `• ID ${item.entityId}` : ''}
              </Text>
              <Text style={styles.eventMeta}>
                Paciente alvo: {item.targetPatientId || 'n/a'} • Origem: {item.origin || 'app'}
              </Text>
              <Text style={styles.eventPath}>{item.path || 'arquivo nao informado'}</Text>

              <View style={styles.detailsBox}>
                <Text style={styles.detailsText}>
                  {JSON.stringify(item.details || {}, null, 2)}
                </Text>
              </View>
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
    backgroundColor: adminTheme.colors.primarySoft,
  },
  statusPillError: {
    backgroundColor: adminTheme.colors.dangerSoft,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillTextSuccess: {
    color: adminTheme.colors.success,
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
  detailsText: {
    color: adminTheme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
