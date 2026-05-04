import React, { useEffect, useRef, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarraAbasAdmin, {
  ADMIN_TAB_BAR_HEIGHT,
  ADMIN_TAB_BAR_SPACE,
} from '../../componentes/admin/BarraAbasAdmin';
import MenuAdmin from '../../componentes/admin/MenuAdmin';
import { supabase } from '../../servicos/configSupabase';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';
import {
  contarEventosAuditoriaTotal,
  listarEventosAuditoria,
  registrarLogAuditoria,
} from '../../servicos/servicoAuditoria';
import { isAdminUser } from '../../servicos/servicoAdmin';

const PAGE_SIZE = 10;
const AUDIT_LOOKBACK_DAYS = 3650;
const AUDIT_SUMMARY_LIMIT = 50000;

const actorFilters = [
  { key: '', label: 'Todos' },
  { key: 'paciente', label: 'Pacientes' },
  { key: 'nutricionista', label: 'Nutricionistas' },
  { key: 'medico', label: 'Médicos' },
  { key: 'admin', label: 'Admins' },
];

const statusFilters = [
  { key: 'sucesso', label: 'Sucessos' },
  { key: 'falha', label: 'Falhas' },
];

function normalizeAuditStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isFailureStatus(value) {
  return normalizeAuditStatus(value) === 'falha';
}

function countFailureEvents(items) {
  if (!Array.isArray(items)) {
    return 0;
  }

  return items.filter((item) => isFailureStatus(item?.status)).length;
}

function buildAuditQueryKey({ actorType = '', status = '', textSearch = '', dateRange = '' } = {}) {
  return JSON.stringify({
    actorType: String(actorType || '').trim(),
    status: String(status || '').trim(),
    textSearch: String(textSearch || '').trim(),
    dateRange: String(dateRange || '').trim(),
  });
}

function getKnownEventsTotal(summaryState, cachedEventsLength = 0) {
  return Math.max(
    Number(summaryState?.filteredTotal) || 0,
    Number(summaryState?.total) || 0,
    Number(cachedEventsLength) || 0
  );
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

function buildSearchPlaceholder(isDateRangeEnabled) {
  if (isDateRangeEnabled) {
    return 'De dd/mm/aaaa até dd/mm/aaaa';
  }

  return 'Buscar por ação, entidade, ator ou paciente';
}

function applyDateRangeMask(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 16);
  const parts = [];

  if (digits.length > 0) {
    parts.push(digits.slice(0, 2));
  }
  if (digits.length > 2) {
    parts.push(digits.slice(2, 4));
  }
  if (digits.length > 4) {
    parts.push(digits.slice(4, 8));
  }

  let masked = '';
  if (parts.length > 0) {
    masked = parts[0];
  }
  if (parts.length > 1) {
    masked += `/${parts[1]}`;
  }
  if (parts.length > 2) {
    masked += `/${parts[2]}`;
  }

  if (digits.length > 8) {
    const endDigits = digits.slice(8);
    const endParts = [];

    if (endDigits.length > 0) {
      endParts.push(endDigits.slice(0, 2));
    }
    if (endDigits.length > 2) {
      endParts.push(endDigits.slice(2, 4));
    }
    if (endDigits.length > 4) {
      endParts.push(endDigits.slice(4, 8));
    }

    masked += ' até ';
    masked += endParts[0] || '';
    if (endParts.length > 1) {
      masked += `/${endParts[1]}`;
    }
    if (endParts.length > 2) {
      masked += `/${endParts[2]}`;
    }
  }

  return masked;
}

const initialSummaryState = {
  total: 0,
  filteredTotal: 0,
  pacientes: 0,
  nutricionistas: 0,
  medicos: 0,
  administradores: 0,
  falhas: 0,
};

async function fetchCount(queryBuilder) {
  const { count, error } = await queryBuilder;

  if (error) {
    throw error;
  }

  return count || 0;
}

async function fetchAdminCount() {
  const { data, error } = await supabase.rpc('contar_administradores');

  if (error) {
    throw error;
  }

  return Number(data) || 0;
}

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export default function TelaAuditoriaAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const { width, height } = useWindowDimensions();
  const eventsCountRef = useRef(0);
  const loadingRef = useRef(false);
  const refreshingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastScrollMetricsRef = useRef(null);
  const rightWebScrollRef = useRef(null);
  const rightListViewportHeightRef = useRef(0);
  const rightListContentHeightRef = useRef(0);
  const baseSummaryLoadedRef = useRef(false);
  const summaryRefreshSeqRef = useRef(0);
  const cachedFilteredEventsRef = useRef([]);
  const cachedQueryKeyRef = useRef('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(initialSummaryState);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isDateRangeEnabled, setIsDateRangeEnabled] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const isDesktopWeb = Platform.OS === 'web' && width >= 1280;
  const webSplitGap = 40;
  const desktopPaneWidth = isDesktopWeb
    ? Math.max(((width - (adminTheme.spacing.screen * 2) - webSplitGap) / 2), 520)
    : width;
  const desktopWorkspaceHeight = isDesktopWeb
    ? Math.max(height - ADMIN_TAB_BAR_HEIGHT - ADMIN_TAB_BAR_SPACE - 78, 560)
    : null;
  const contentWidthBase = isDesktopWeb ? desktopPaneWidth - 16 : width - 40;
  const summaryColumns = 6;
  const summaryCardSize = isDesktopWeb
    ? Math.max((contentWidthBase - ((summaryColumns - 1) * 6)) / summaryColumns, 72)
    : Math.max((contentWidthBase - ((summaryColumns - 1) * 6)) / summaryColumns, 52);
  const summaryScaleFactor = isDesktopWeb ? 0.4 : width < 520 ? 0.38 : width > 980 ? 0.56 : 0.46;
  const summaryLabelFactor = isDesktopWeb ? 0.12 : width < 520 ? 0.1 : width > 980 ? 0.19 : 0.16;
  const summaryValueSize = Math.max(Math.min(summaryCardSize * summaryScaleFactor, 56), 16);
  const summaryLabelSize = Math.max(Math.min(summaryCardSize * summaryLabelFactor, 18), 5.5);
  const summaryLabelMarginTop = Math.max(Math.min(summaryCardSize * (width < 520 ? 0.05 : 0.045), 5), 1.5);
  const summaryCardRadius = Math.max(Math.min(summaryCardSize * 0.2, 22), 16);
  const summaryCardDynamicStyle = isDesktopWeb
    ? {
      ...styles.summaryCardDesktop,
      width: summaryCardSize,
      minWidth: summaryCardSize,
      maxWidth: summaryCardSize,
      height: Math.max(summaryCardSize * 0.9, 76),
      borderRadius: summaryCardRadius,
    }
    : { width: summaryCardSize, height: summaryCardSize, borderRadius: summaryCardRadius };
  const desktopReservedHeight = isDesktopWeb ? Math.max(summaryCardSize + 220, 320) : 0;
  const desktopEventCardEstimate = 270;
  const desktopPinnedEvents = isDesktopWeb
    ? Math.max(Math.floor((desktopWorkspaceHeight - desktopReservedHeight) / desktopEventCardEstimate), 1)
    : 0;
  const statusTabWidth = Math.max((contentWidthBase - ((statusFilters.length - 1) * 8)) / statusFilters.length, 120);
  const filterTabWidth = Math.max((contentWidthBase - ((actorFilters.length - 1) * 8)) / actorFilters.length, 54);
  const filterTabHeight = Math.max(Math.min(filterTabWidth * 0.44, 36), 28);
  const filterTabFontSize = Math.max(Math.min(filterTabWidth * 0.13, 11), 6);

  function handleSearchChange(value) {
    setSearch(isDateRangeEnabled ? applyDateRangeMask(value) : value);
  }

  async function carregarResumoBase() {
    const [totalEventosCount, pacientesCount, nutricionistasCount, medicosCount, adminsCount] = await Promise.all([
      contarEventosAuditoriaTotal({ maxItems: AUDIT_SUMMARY_LIMIT }).catch(() => summary.total),
      fetchCount(
        supabase
          .from('paciente')
          .select('*', { count: 'exact', head: true })
          .or('excluido.is.null,excluido.eq.false')
      ).catch(() => summary.pacientes),
      fetchCount(
        supabase.from('nutricionista').select('*', { count: 'exact', head: true })
      ).catch(() => summary.nutricionistas),
      fetchCount(
        supabase
          .from('medico')
          .select('*', { count: 'exact', head: true })
          .eq('ativo', true)
      ).catch(() => summary.medicos),
      fetchAdminCount().catch(() => summary.administradores),
    ]);

    const adminCountWithCurrentUser = Number.isFinite(adminsCount)
      ? adminsCount
      : (isAdminUser(adminUser) ? 1 : 0);

    setSummary((current) => ({
      ...current,
      total: Number.isFinite(totalEventosCount) ? totalEventosCount : current.total,
      filteredTotal: Number.isFinite(totalEventosCount) && !selectedFilter && !selectedStatus && !search.trim() && !isDateRangeEnabled
        ? totalEventosCount
        : current.filteredTotal,
      pacientes: Number.isFinite(pacientesCount) ? pacientesCount : current.pacientes,
      nutricionistas: Number.isFinite(nutricionistasCount) ? nutricionistasCount : current.nutricionistas,
      medicos: Number.isFinite(medicosCount) ? medicosCount : current.medicos,
      administradores: adminCountWithCurrentUser || current.administradores,
    }));
  }

  async function carregarResumoAuditoria({ actorType, status, textSearch, dateRange } = {}) {
    const hasActiveFilters = Boolean(actorType || status || textSearch || dateRange);
    const queryKey = buildAuditQueryKey({ actorType, status, textSearch, dateRange });
    const [allEventsResult, filteredEventsResult] =
      await Promise.allSettled([
        listarEventosAuditoria({
          days: AUDIT_LOOKBACK_DAYS,
          limit: AUDIT_SUMMARY_LIMIT,
        }),
        listarEventosAuditoria({
          days: AUDIT_LOOKBACK_DAYS,
          limit: AUDIT_SUMMARY_LIMIT,
          actorType,
          status,
          search: textSearch,
          dateRange,
        }),
      ]);

    const allEvents = allEventsResult.status === 'fulfilled' ? allEventsResult.value : null;
    const filteredEvents = filteredEventsResult.status === 'fulfilled' ? filteredEventsResult.value : null;

    if (filteredEvents) {
      cachedFilteredEventsRef.current = filteredEvents;
      cachedQueryKeyRef.current = queryKey;
    }

    setSummary((current) => ({
      total: Math.max(current.total, allEvents ? allEvents.length : 0),
      filteredTotal: hasActiveFilters
        ? (filteredEvents ? filteredEvents.length : current.filteredTotal)
        : Math.max(current.total, allEvents ? allEvents.length : 0, current.filteredTotal || 0),
      pacientes: current.pacientes,
      nutricionistas: current.nutricionistas,
      medicos: current.medicos,
      administradores: current.administradores,
      falhas: allEvents
        ? allEvents.filter((item) => normalizeAuditStatus(item.status) === 'falha').length
        : current.falhas,
    }));

    const totalForPagination = hasActiveFilters
      ? (filteredEvents ? filteredEvents.length : eventsCountRef.current)
      : (allEvents ? allEvents.length : eventsCountRef.current);

    if (totalForPagination > eventsCountRef.current) {
      hasMoreRef.current = true;
      setHasMore(true);
    } else {
      hasMoreRef.current = false;
      setHasMore(false);
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
        origin: 'admin_auditoria',
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

  function handleNavigate(routeName) {
    navigation.navigate(routeName, { usuarioLogado: adminUser });
  }

  async function carregarPainelResumoAtual({ actorType, status, textSearch, dateRange } = {}) {
    await carregarResumoBase().catch(() => {});
    carregarResumoAuditoria({
      actorType,
      status,
      textSearch,
      dateRange,
    }).catch(() => {});
  }

  function atualizarResumoEmSegundoPlano({
    actorType,
    status,
    textSearch,
    dateRange,
    forceBase = false,
  } = {}) {
    const refreshSeq = summaryRefreshSeqRef.current + 1;
    summaryRefreshSeqRef.current = refreshSeq;

    Promise.resolve().then(async () => {
      if (forceBase || !baseSummaryLoadedRef.current) {
        await carregarResumoBase().catch(() => {});
        if (summaryRefreshSeqRef.current !== refreshSeq) {
          return;
        }
        baseSummaryLoadedRef.current = true;
      }

      await carregarResumoAuditoria({
        actorType,
        status,
        textSearch,
        dateRange,
      }).catch(() => {});

      if (summaryRefreshSeqRef.current !== refreshSeq) {
        return;
      }

      maybeLoadMoreFromMetrics(lastScrollMetricsRef.current);
      maybeAutofillRightColumn();
    });
  }

  async function carregarEventos({ isRefresh = false, append = false } = {}) {
    if (append && (loadingRef.current || refreshingRef.current || loadingMoreRef.current || !hasMoreRef.current)) {
      return;
    }

    try {
      if (append) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else if (isRefresh) {
        refreshingRef.current = true;
        setRefreshing(true);
      } else {
        loadingRef.current = true;
        setLoading(true);
      }

      const actorType = selectedFilter;
      const status = selectedStatus;
      const trimmedSearch = search.trim();
      const textSearch = isDateRangeEnabled ? '' : trimmedSearch;
      const dateRange = isDateRangeEnabled ? trimmedSearch : '';
      const queryKey = buildAuditQueryKey({ actorType, status, textSearch, dateRange });
      const currentLoadedCount = eventsCountRef.current;
      const requestLimit = append || !isDesktopWeb ? PAGE_SIZE : PAGE_SIZE + desktopPinnedEvents;

      if (
        append &&
        cachedQueryKeyRef.current === queryKey &&
        cachedFilteredEventsRef.current.length > eventsCountRef.current
      ) {
        const nextEvents = cachedFilteredEventsRef.current.slice(0, eventsCountRef.current + PAGE_SIZE);
        eventsCountRef.current = nextEvents.length;
        setEvents(nextEvents);
        const hasMoreByCache = cachedFilteredEventsRef.current.length > nextEvents.length;
        hasMoreRef.current = hasMoreByCache;
        setHasMore(hasMoreByCache);
        setSummary((current) => ({
          ...current,
          total: Math.max(current.total, nextEvents.length),
          filteredTotal: Math.max(current.filteredTotal, cachedFilteredEventsRef.current.length),
          falhas: Math.max(current.falhas, countFailureEvents(nextEvents)),
        }));
        return;
      }

      const data = await listarEventosAuditoria({
        days: AUDIT_LOOKBACK_DAYS,
        limit: requestLimit,
        offset: append ? eventsCountRef.current : 0,
        actorType,
        status,
        search: textSearch,
        dateRange,
      });

      setEvents((current) => {
        const nextEvents = append ? [...current, ...data] : data;
        eventsCountRef.current = nextEvents.length;
        setSummary((summaryCurrent) => ({
          ...summaryCurrent,
          total: Math.max(summaryCurrent.total, nextEvents.length),
          filteredTotal: Math.max(summaryCurrent.filteredTotal, nextEvents.length),
          falhas: Math.max(summaryCurrent.falhas, countFailureEvents(nextEvents)),
        }));
        return nextEvents;
      });
      const nextEventsLength = (append ? currentLoadedCount : 0) + data.length;
      const knownEventsTotal = getKnownEventsTotal(summary, cachedFilteredEventsRef.current.length);
      const hasMoreByPage =
        knownEventsTotal > nextEventsLength || data.length === requestLimit;
      hasMoreRef.current = hasMoreByPage;
      setHasMore(hasMoreByPage);

      if (!append) {
        setSummary((current) => ({
          ...current,
          filteredTotal: Math.max(current.filteredTotal, data.length),
          falhas: Math.max(current.falhas, countFailureEvents(data)),
        }));
        atualizarResumoEmSegundoPlano({
          actorType,
          status,
          textSearch,
          dateRange,
          forceBase: isRefresh,
        });
      }

      if (isAdminUser(adminUser)) {
        registrarLogAuditoria({
          actor: adminUser,
          actorType: 'admin',
          action: 'admin_consulta_auditoria',
          entity: 'painel_auditoria',
          entityId: adminUser?.id_admin_uuid || null,
          origin: 'admin_auditoria',
          status: 'sucesso',
          details: {
            filtro_actor: selectedFilter || 'todos',
            filtro_status: selectedStatus || 'todos',
            filtro_data: isDateRangeEnabled ? 'periodo' : 'desligado',
            resultado_eventos: append ? eventsCountRef.current : data.length,
          },
        }).catch(() => {});
      }
    } finally {
      loadingRef.current = false;
      refreshingRef.current = false;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setRefreshing(false);
      setLoading(false);
    }
  }

  function maybeLoadMoreFromMetrics(metrics) {
    if (
      !metrics ||
      loadingRef.current ||
      refreshingRef.current ||
      loadingMoreRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }

    const { layoutMeasurement, contentOffset, contentSize } = metrics;
    const distanceToBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);

    if (distanceToBottom <= 240) {
      carregarEventos({ append: true });
    }
  }

  function maybeAutofillRightColumn() {
    if (!isDesktopWeb) {
      return;
    }

    if (
      loadingRef.current ||
      refreshingRef.current ||
      loadingMoreRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }

    const viewportHeight = rightListViewportHeightRef.current;
    const contentHeight = rightListContentHeightRef.current;

    if (!viewportHeight || !contentHeight) {
      return;
    }

    const knownEventsTotal = getKnownEventsTotal(summary, cachedFilteredEventsRef.current.length);
    const stillHasKnownEvents = knownEventsTotal > eventsCountRef.current;
    const contentFitsWithoutScroll = contentHeight <= viewportHeight + 24;

    if (stillHasKnownEvents && contentFitsWithoutScroll) {
      carregarEventos({ append: true });
    }
  }

  function handleScroll(event) {
    const metrics = event?.nativeEvent || null;
    lastScrollMetricsRef.current = metrics;
    maybeLoadMoreFromMetrics(metrics);
  }

  function handleContentSizeChange(width, height) {
    rightListContentHeightRef.current = Number(height) || 0;
    maybeLoadMoreFromMetrics(lastScrollMetricsRef.current);
    maybeAutofillRightColumn();
  }

  function handleRightListLayout(event) {
    rightListViewportHeightRef.current = Number(event?.nativeEvent?.layout?.height) || 0;
    maybeAutofillRightColumn();
  }

  function handleLoadMore() {
    if (
      loadingRef.current ||
      refreshingRef.current ||
      loadingMoreRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }

    carregarEventos({ append: true });
  }

  function resolveScrollableElement(node) {
    if (!node) return null;
    if (typeof node.getScrollableNode === 'function') {
      return node.getScrollableNode();
    }
    if (typeof node.getInnerViewNode === 'function') {
      return node.getInnerViewNode();
    }
    return node;
  }

  function renderPaginationFooter() {
    if (loadingMore) {
      return (
        <View style={styles.loadingMoreWrap}>
          <ActivityIndicator color={adminTheme.colors.primary} />
          <Text style={styles.loadingMoreText}>Carregando</Text>
        </View>
      );
    }

    if (events.length > 0 && !hasMore) {
      return (
        <View style={styles.loadingMoreWrap}>
          <Text style={styles.loadingMoreText}>Não há mais eventos para carregar.</Text>
        </View>
      );
    }

    return <View style={styles.loadingMoreSpacer} />;
  }

  function renderEventCard(item) {
    return (
      <SectionCard key={item.path || item.id} style={styles.eventCard}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventAction}>{prettifyAction(item.action)}</Text>
          <View
            style={[
              styles.statusPill,
              isFailureStatus(item.status) ? styles.statusPillError : styles.statusPillSuccess,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                isFailureStatus(item.status)
                  ? styles.statusPillTextError
                  : styles.statusPillTextSuccess,
              ]}
            >
              {String(item.status || 'sucesso').toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.eventMeta}>
          {item.actorType || 'anônimo'} • {item.actorName || 'Sem nome'} • {formatDateTime(item.createdAt)}
        </Text>
        <Text style={styles.eventMeta}>
          Entidade: {item.entity || 'n/a'} {item.entityId ? `• ID ${item.entityId}` : ''}
        </Text>
        <Text style={styles.eventMeta}>
          Paciente alvo: {item.targetPatientId || 'n/a'} • Origem: {item.origin || 'app'}
        </Text>
        <Text style={styles.eventPath}>{item.path || 'arquivo não informado'}</Text>

        <View style={styles.detailsBox}>
          <Text style={styles.detailsText}>
            {JSON.stringify(item.details || {}, null, 2)}
          </Text>
        </View>
      </SectionCard>
    );
  }

  function renderFiltersArea() {
    return (
      <>
        <Text style={styles.sectionTitle}>Eventos</Text>

        <View style={styles.searchFieldWrap}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearchChange}
            onSubmitEditing={() => carregarEventos()}
            placeholder={buildSearchPlaceholder(isDateRangeEnabled)}
            placeholderTextColor={adminTheme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchIconButton, styles.calendarIconButton]}
            onPress={() => {
              setIsDateRangeEnabled((current) => {
                const nextValue = !current;
                setSearch('');
                return nextValue;
              });
            }}
            accessibilityLabel="Filtrar por data"
          >
            <Ionicons
              name={isDateRangeEnabled ? 'calendar' : 'calendar-outline'}
              size={18}
              color={adminTheme.colors.onPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => carregarEventos()}
            accessibilityLabel="Buscar auditoria"
          >
            <Ionicons name="search-outline" size={18} color={adminTheme.colors.onPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterTabs}>
          {actorFilters.map((item) => {
            const active = selectedFilter === item.key;

            return (
              <TouchableOpacity
                key={item.key || 'todos'}
                style={[
                  styles.filterTab,
                  { width: filterTabWidth, minWidth: filterTabWidth, minHeight: filterTabHeight },
                  active && styles.filterTabActive,
                ]}
                onPress={() => setSelectedFilter(item.key)}
              >
                <Text
                  style={[styles.filterTabText, { fontSize: filterTabFontSize }, active && styles.filterTabTextActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.statusTabs}>
          {statusFilters.map((item) => {
            const active = selectedStatus === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterTab,
                  { width: statusTabWidth, minWidth: statusTabWidth, minHeight: filterTabHeight },
                  active && styles.filterTabActive,
                ]}
                onPress={() =>
                  setSelectedStatus((current) => (current === item.key ? '' : item.key))
                }
              >
                <Text
                  style={[styles.filterTabText, { fontSize: filterTabFontSize }, active && styles.filterTabTextActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  useEffect(() => {
    carregarResumoBase()
      .then(() => {
        baseSummaryLoadedRef.current = true;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    eventsCountRef.current = events.length;
  }, [events]);

  useEffect(() => {
    loadingRef.current = loading;
    refreshingRef.current = refreshing;
    loadingMoreRef.current = loadingMore;
    hasMoreRef.current = hasMore;
  }, [loading, refreshing, loadingMore, hasMore]);

  useEffect(() => {
    const actorType = selectedFilter;
    const status = selectedStatus;
    const trimmedSearch = search.trim();
    const textSearch = isDateRangeEnabled ? '' : trimmedSearch;
    const dateRange = isDateRangeEnabled ? trimmedSearch : '';

    carregarEventos();
  }, [selectedFilter, selectedStatus, isDateRangeEnabled]);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      isDesktopWeb ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return undefined;
    }

    function handleWindowScroll() {
      if (loadingRef.current || refreshingRef.current || loadingMoreRef.current || !hasMoreRef.current) {
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;
      const fullHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0
      );

      if (fullHeight - scrollPosition <= 160) {
        carregarEventos({ append: true });
      }
    }

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [selectedFilter, selectedStatus, isDateRangeEnabled, search, isDesktopWeb]);

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: isAdminUser(adminUser) ? () => setMenuVisible(true) : undefined,
      readerMenuDisabled: !isAdminUser(adminUser),
      readerMenuLoading: false,
      readerRightAction: isAdminUser(adminUser)
        ? () => carregarEventos({ isRefresh: true })
        : undefined,
      readerRightIcon: 'refresh-outline',
      readerRightAccessibilityLabel: 'Recarregar auditoria',
      readerRightDisabled: refreshing || loading,
      readerRightLoading: refreshing,
    });
  }, [navigation, adminUser, refreshing, loading]);

  useEffect(() => {
    if (!isDesktopWeb || Platform.OS !== 'web') {
      return undefined;
    }

    const scrollableElement = resolveScrollableElement(rightWebScrollRef.current);

    if (!scrollableElement || typeof scrollableElement.addEventListener !== 'function') {
      return undefined;
    }

    function handleNativeRightScroll() {
      if (
        loadingRef.current ||
        refreshingRef.current ||
        loadingMoreRef.current ||
        !hasMoreRef.current
      ) {
        return;
      }

      const clientHeight = Number(scrollableElement.clientHeight) || 0;
      const scrollTop = Number(scrollableElement.scrollTop) || 0;
      const scrollHeight = Number(scrollableElement.scrollHeight) || 0;
      const distanceToBottom = scrollHeight - (clientHeight + scrollTop);

      if (distanceToBottom <= 240) {
        carregarEventos({ append: true });
      }
    }

    scrollableElement.addEventListener('scroll', handleNativeRightScroll, { passive: true });
    return () => {
      scrollableElement.removeEventListener('scroll', handleNativeRightScroll);
    };
  }, [isDesktopWeb, selectedFilter, selectedStatus, isDateRangeEnabled, search]);

  useEffect(() => {
    if (!isDesktopWeb || Platform.OS !== 'web') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (
        loadingRef.current ||
        refreshingRef.current ||
        loadingMoreRef.current ||
        !hasMoreRef.current
      ) {
        return;
      }

      const scrollableElement = resolveScrollableElement(rightWebScrollRef.current);

      if (!scrollableElement) {
        return;
      }

      const clientHeight = Number(scrollableElement.clientHeight) || 0;
      const scrollTop = Number(scrollableElement.scrollTop) || 0;
      const scrollHeight = Number(scrollableElement.scrollHeight) || 0;

      if (!clientHeight || !scrollHeight) {
        return;
      }

      const distanceToBottom = scrollHeight - (clientHeight + scrollTop);
      const contentFitsWithoutScroll = scrollHeight <= clientHeight + 24;

      if (contentFitsWithoutScroll || distanceToBottom <= 240) {
        carregarEventos({ append: true });
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isDesktopWeb, selectedFilter, selectedStatus, isDateRangeEnabled, search]);

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

  const leftColumnEvents = isDesktopWeb ? events.slice(0, desktopPinnedEvents) : events;
  const rightColumnEvents = isDesktopWeb ? events.slice(desktopPinnedEvents) : [];
  const totalAvailableEvents = Math.max(summary.filteredTotal || 0, summary.total || 0, events.length);
  const hasNoEventsInDatabase = !loading && summary.total === 0;

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />

      {menuVisible ? (
        <MenuAdmin
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          currentRoute={route?.name || 'AdminAuditoria'}
          userName={adminUser?.nome_completo_admin || adminUser?.email_acesso || 'Administrador'}
          userSubtitle="Auditoria central"
        />
      ) : null}

      {isDesktopWeb ? (
        <View style={[styles.webSplitLayout, { height: desktopWorkspaceHeight, maxHeight: desktopWorkspaceHeight }]}>
          <View
            style={[
              styles.webColumnLeft,
              {
                width: desktopPaneWidth,
                minWidth: desktopPaneWidth,
                maxWidth: desktopPaneWidth,
                height: desktopWorkspaceHeight,
                maxHeight: desktopWorkspaceHeight,
              },
            ]}
          >
            <View style={[styles.summaryGrid, isDesktopWeb && styles.summaryGridDesktop]}>
              <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
                <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
                  {summary.total}
                </Text>
                <Text
                  style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  Eventos
                </Text>
              </SectionCard>
              <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
                <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
                  {summary.pacientes}
                </Text>
                <Text
                  style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  Pacientes
                </Text>
              </SectionCard>
              <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
                <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
                  {summary.nutricionistas}
                </Text>
                <Text
                  style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  Nutricionistas
                </Text>
              </SectionCard>
              <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
                <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
                  {summary.medicos}
                </Text>
                <Text
                  style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  Médicos
                </Text>
              </SectionCard>
              <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
                <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
                  {summary.administradores}
                </Text>
                <Text
                  style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  Admins
                </Text>
              </SectionCard>
              <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
                <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
                  {summary.falhas}
                </Text>
                <Text
                  style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  Falhas
                </Text>
              </SectionCard>
            </View>

            {renderFiltersArea()}

            {events.length > 0 ? (
              <Text style={styles.paginationHint}>
                Mostrando {events.length} eventos de {totalAvailableEvents}
              </Text>
            ) : null}

            {leftColumnEvents.length > 0 ? (
              leftColumnEvents.map(renderEventCard)
            ) : loading ? (
              <SectionCard style={styles.stateCard}>
                <ActivityIndicator color={adminTheme.colors.primary} />
                <Text style={styles.stateText}>Carregando auditoria...</Text>
              </SectionCard>
            ) : leftColumnEvents.length === 0 ? (
              <SectionCard style={styles.stateCard}>
                <Text style={styles.stateText}>
                  {hasNoEventsInDatabase
                    ? 'Nenhum evento de auditoria encontrado no banco de dados.'
                    : 'Nenhum evento encontrado para os filtros atuais.'}
                </Text>
              </SectionCard>
            ) : null}
          </View>

          <View style={[styles.webColumnRight, { height: desktopWorkspaceHeight, maxHeight: desktopWorkspaceHeight }]}>
            <Text style={styles.webRightTitle}>Mais eventos</Text>
            <ScrollView
              ref={rightWebScrollRef}
              style={styles.webRightList}
              contentContainerStyle={styles.webColumnContent}
              onLayout={handleRightListLayout}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => carregarEventos({ isRefresh: true })} />
              }
              keyboardShouldPersistTaps="handled"
              onScroll={handleScroll}
              onContentSizeChange={handleContentSizeChange}
              onScrollEndDrag={handleScroll}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              {rightColumnEvents.length > 0 ? (
                rightColumnEvents.map(renderEventCard)
              ) : loading ? (
                <SectionCard style={styles.stateCard}>
                  <ActivityIndicator color={adminTheme.colors.primary} />
                  <Text style={styles.stateText}>Carregando auditoria...</Text>
                </SectionCard>
              ) : !hasNoEventsInDatabase ? (
                <SectionCard style={styles.stateCard}>
                  <Text style={styles.stateText}>Os próximos eventos aparecem aqui conforme você carrega mais.</Text>
                </SectionCard>
              ) : null}

              {renderPaginationFooter()}
            </ScrollView>
          </View>
        </View>
      ) : (
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
          onScroll={handleScroll}
          onScrollEndDrag={handleScroll}
          onMomentumScrollEnd={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.summaryGrid}>
          <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
            <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
              {summary.total}
            </Text>
            <Text
              style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              Eventos
            </Text>
          </SectionCard>
          <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
            <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
              {summary.pacientes}
            </Text>
            <Text
              style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              Pacientes
            </Text>
          </SectionCard>
          <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
            <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
              {summary.nutricionistas}
            </Text>
            <Text
              style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              Nutricionistas
            </Text>
          </SectionCard>
          <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
            <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
              {summary.medicos}
            </Text>
            <Text
              style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              Médicos
            </Text>
          </SectionCard>
          <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
            <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
              {summary.administradores}
            </Text>
            <Text
              style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              Admins
            </Text>
          </SectionCard>
          <SectionCard style={[styles.summaryCard, summaryCardDynamicStyle]}>
            <Text style={[styles.summaryValue, { fontSize: summaryValueSize, lineHeight: summaryValueSize + 2 }]}>
              {summary.falhas}
            </Text>
            <Text
              style={[styles.summaryLabel, { fontSize: summaryLabelSize, marginTop: summaryLabelMarginTop }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              Falhas
            </Text>
          </SectionCard>
        </View>

        <Text style={styles.sectionTitle}>Eventos</Text>

        <View style={styles.searchFieldWrap}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearchChange}
            onSubmitEditing={() => carregarEventos()}
            placeholder={buildSearchPlaceholder(isDateRangeEnabled)}
            placeholderTextColor={adminTheme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchIconButton, styles.calendarIconButton]}
            onPress={() => {
              setIsDateRangeEnabled((current) => {
                const nextValue = !current;
                setSearch('');
                return nextValue;
              });
            }}
            accessibilityLabel="Filtrar por data"
          >
            <Ionicons
              name={isDateRangeEnabled ? 'calendar' : 'calendar-outline'}
              size={18}
              color={adminTheme.colors.onPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => carregarEventos()}
            accessibilityLabel="Buscar auditoria"
          >
            <Ionicons name="search-outline" size={18} color={adminTheme.colors.onPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterTabs}>
          {actorFilters.map((item) => {
            const active = selectedFilter === item.key;

            return (
              <TouchableOpacity
                key={item.key || 'todos'}
                style={[
                  styles.filterTab,
                  { width: filterTabWidth, minWidth: filterTabWidth, minHeight: filterTabHeight },
                  active && styles.filterTabActive,
                ]}
                onPress={() => setSelectedFilter(item.key)}
              >
                <Text
                  style={[styles.filterTabText, { fontSize: filterTabFontSize }, active && styles.filterTabTextActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.statusTabs}>
          {statusFilters.map((item) => {
            const active = selectedStatus === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterTab,
                  { width: statusTabWidth, minWidth: statusTabWidth, minHeight: filterTabHeight },
                  active && styles.filterTabActive,
                ]}
                onPress={() =>
                  setSelectedStatus((current) => (current === item.key ? '' : item.key))
                }
              >
                <Text
                  style={[styles.filterTabText, { fontSize: filterTabFontSize }, active && styles.filterTabTextActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {events.length > 0 ? (
          <Text style={styles.paginationHint}>
            Mostrando {events.length} eventos de {totalAvailableEvents}
          </Text>
        ) : null}

        {loading ? (
          <SectionCard style={styles.stateCard}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.stateText}>Carregando auditoria...</Text>
          </SectionCard>
        ) : events.length === 0 ? (
          <SectionCard style={styles.stateCard}>
            <Text style={styles.stateText}>
              {hasNoEventsInDatabase
                ? 'Nenhum evento de auditoria encontrado no banco de dados.'
                : 'Nenhum evento encontrado para os filtros atuais.'}
            </Text>
          </SectionCard>
        ) : (
          events.map((item) => (
            <SectionCard key={item.path || item.id} style={styles.eventCard}>
              <View style={styles.eventTopRow}>
                <Text style={styles.eventAction}>{prettifyAction(item.action)}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isFailureStatus(item.status) ? styles.statusPillError : styles.statusPillSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isFailureStatus(item.status)
                        ? styles.statusPillTextError
                        : styles.statusPillTextSuccess,
                    ]}
                  >
                    {String(item.status || 'sucesso').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.eventMeta}>
                {item.actorType || 'anônimo'} • {item.actorName || 'Sem nome'} • {formatDateTime(item.createdAt)}
              </Text>
              <Text style={styles.eventMeta}>
                Entidade: {item.entity || 'n/a'} {item.entityId ? `• ID ${item.entityId}` : ''}
              </Text>
              <Text style={styles.eventMeta}>
                Paciente alvo: {item.targetPatientId || 'n/a'} • Origem: {item.origin || 'app'}
              </Text>
              <Text style={styles.eventPath}>{item.path || 'arquivo não informado'}</Text>

              <View style={styles.detailsBox}>
                <Text style={styles.detailsText}>
                  {JSON.stringify(item.details || {}, null, 2)}
                </Text>
              </View>
            </SectionCard>
          ))
        )}

        {loadingMore ? (
          <View style={styles.loadingMoreWrap}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.loadingMoreText}>Carregando</Text>
          </View>
        ) : events.length > 0 ? (
          <View style={styles.loadingMoreWrap}>
            <Text style={styles.loadingMoreText}>
              {hasMore ? '' : 'Não há mais eventos para carregar.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      )}

      <BarraAbasAdmin
        navigation={navigation}
        rotaAtual={route?.name || 'AdminAuditoria'}
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
  webSplitLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    minHeight: 0,
    alignItems: 'stretch',
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 6,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 26,
  },
  webColumnLeft: {
    minHeight: 0,
    overflow: 'hidden',
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  webColumnRight: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  webRightList: {
    flex: 1,
    minHeight: 0,
  },
  webColumnContent: {
    paddingBottom: 12,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  webRightTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: adminTheme.colors.panel,
    borderRadius: adminTheme.radius.xl,
    padding: adminTheme.spacing.card,
    ...adminShadow,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
    marginTop: 2,
    width: '100%',
  },
  summaryGridDesktop: {
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryCardDesktop: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderWidth: 1.1,
    borderRadius: adminTheme.radius.md,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  summaryLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 8,
    marginTop: 3,
    textAlign: 'center',
    width: '100%',
  },
  summaryValue: {
    color: adminTheme.colors.text,
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 28,
    textAlign: 'center',
  },
  statusTabs: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
    width: '100%',
  },
  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
  },
  filterTab: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  filterTabActive: {
    backgroundColor: adminTheme.colors.primary,
  },
  filterTabText: {
    color: adminTheme.colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterTabTextActive: {
    color: adminTheme.colors.onPrimary,
  },
  searchFieldWrap: {
    marginTop: 6,
    marginBottom: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1.4,
    color: adminTheme.colors.text,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 98,
  },
  searchIconButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.md,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    width: 34,
  },
  calendarIconButton: {
    right: 47,
  },
  sectionTitle: {
    color: adminTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 10,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    minHeight: 120,
    justifyContent: 'center',
  },
  stateText: {
    color: adminTheme.colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  paginationHint: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  loadMoreButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadMoreButtonText: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadMoreHintText: {
    color: adminTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  loadingMoreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingMoreSpacer: {
    height: 12,
  },
  loadingMoreText: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderWidth: 1.1,
    marginBottom: 10,
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
    backgroundColor: adminTheme.colors.background,
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



