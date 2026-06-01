import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  CHART_PALETTE,
  FREQ_COLORS,
  ENGAGEMENT_FREQ_COLORS_BY_ID,
  RECORD_BUCKET_COLORS,
  GLUCOSE_COLORS,
  INSULIN_COLORS,
  InteractiveDonutChart,
  InteractiveHorizontalBarChart,
  InteractiveLineChart,
  InteractiveProgressChart,
  MEAL_TYPE_COLORS,
  OBJECTIVE_COLORS,
  RISK_COLORS,
  TREND_COLORS,
  chartPercent,
  sumChartValues,
} from '../../componentes/nutricionista/RelatoriosNutriCharts';
import { DashboardKpiCard } from '../../componentes/comum/CartaoKpiDashboard';
import { SectionCard, nutriDesktopStyles } from '../../componentes/nutricionista/NutriDesktopUI';
import { ScreenLoading } from '../../componentes/comum/ui';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import {
  buildNutritionistReportBundle,
  exportNutritionistReport,
} from '../../servicos/servicoRelatoriosNutricionista';

const METRIC_THEMES = {
  total: { accent: CHART_PALETTE.blue, icon: 'people-outline' },
  good: { accent: CHART_PALETTE.greenDark, icon: 'checkmark-circle-outline' },
  attention: { accent: CHART_PALETTE.orange, icon: 'alert-circle-outline' },
  critical: { accent: CHART_PALETTE.red, icon: 'warning-outline' },
  avgAdherence: { accent: CHART_PALETTE.greenDark, icon: 'trending-up-outline' },
  alerts: { accent: CHART_PALETTE.pink, icon: 'notifications-outline' },
};

const ALERT_SEVERITY = {
  critical: { color: CHART_PALETTE.red, soft: '#FEE2E2', icon: 'warning-outline' },
  highGlucose: { color: CHART_PALETTE.orange, soft: '#FFEDD5', icon: 'pulse-outline' },
  lowAdherence: { color: CHART_PALETTE.yellow, soft: '#FEF3C7', icon: 'restaurant-outline' },
  inactive: { color: CHART_PALETTE.gray, soft: CHART_PALETTE.graySoft, icon: 'time-outline' },
};

const TIR_COLORS = [
  CHART_PALETTE.red,
  CHART_PALETTE.orange,
  CHART_PALETTE.yellow,
  CHART_PALETTE.green,
  CHART_PALETTE.greenDark,
];

const SECTION_ACCENTS = {
  engagement: { accent: CHART_PALETTE.greenDark, soft: CHART_PALETTE.greenSoft },
  nutrition: { accent: CHART_PALETTE.blue, soft: CHART_PALETTE.blueSoft },
  glucose: { accent: CHART_PALETTE.green, soft: CHART_PALETTE.greenSoft },
  therapy: { accent: CHART_PALETTE.purple, soft: CHART_PALETTE.purpleSoft },
  rankings: { accent: CHART_PALETTE.medOrange, soft: '#FFEDD5' },
  alerts: { accent: CHART_PALETTE.red, soft: '#FEE2E2' },
};

function resolveAccentSoft(accent, soft) {
  if (soft) return soft;
  if (accent === CHART_PALETTE.purple) return CHART_PALETTE.purpleSoft;
  if (accent === CHART_PALETTE.blue) return CHART_PALETTE.blueSoft;
  if (accent === CHART_PALETTE.red) return '#FEE2E2';
  if (accent === CHART_PALETTE.medOrange || accent === CHART_PALETTE.orange) return '#FFEDD5';
  return CHART_PALETTE.greenSoft;
}

function seriesTrend(series = []) {
  const valid = series.filter((item) => Number(item.value) > 0);
  if (valid.length < 2) return 'stable';
  const delta = valid[valid.length - 1].value - valid[valid.length - 2].value;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'stable';
}

function MiniKpiCard({ label, value, accent = CHART_PALETTE.green }) {
  return (
    <View style={[styles.miniKpiCard, styles.flatCard]}>
      <Text style={styles.miniKpiLabel}>{label}</Text>
      <Text style={[styles.miniKpiValue, { color: accent }]}>{value}</Text>
      <View style={[styles.miniKpiAccentBar, { backgroundColor: accent }]} />
    </View>
  );
}

function ExportCard({ icon, iconColor, title, helper, onPress, loading, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.exportCard, styles.flatCard, (loading || disabled) && styles.exportCardDisabled]}
      activeOpacity={0.9}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
      ) : (
        <Ionicons name={icon} size={16} color={iconColor} />
      )}
      <Text style={styles.exportTitle}>{title}</Text>
      <Text style={styles.exportHelper}>{helper}</Text>
      <Ionicons name="download-outline" size={15} color={patientTheme.colors.text} />
    </TouchableOpacity>
  );
}

function BlockHeader({ title, subtitle, accentColor }) {
  return (
    <View style={styles.blockHeader}>
      {accentColor ? <View style={[styles.blockAccent, { backgroundColor: accentColor }]} /> : null}
      <View style={styles.blockHeaderCopy}>
        <Text style={styles.blockTitle}>{title}</Text>
        {subtitle ? <Text style={styles.blockSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function FilterChipRow({ items, activeId, onChange, accent = CHART_PALETTE.greenDark }) {
  return (
    <View style={styles.reportPeriodRow}>
      {items.map((item) => {
        const active = activeId === item.id;
        const useBrandGreen = accent === CHART_PALETTE.greenDark || accent === CHART_PALETTE.green;
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.reportPeriodChip,
              active &&
                (useBrandGreen
                  ? styles.reportPeriodChipActiveBrand
                  : { backgroundColor: `${accent}18`, borderColor: accent }),
            ]}
            onPress={() => onChange(item.id)}
          >
            <Text
              style={[
                styles.reportPeriodChipText,
                active &&
                  (useBrandGreen
                    ? styles.reportPeriodChipTextActiveBrand
                    : { color: accent, fontWeight: '800' }),
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DetailToggle({
  open,
  onPress,
  labelOpen = 'Ver menos',
  labelClosed = 'Ver detalhes',
  accent = CHART_PALETTE.greenDark,
  soft,
}) {
  const softBg = resolveAccentSoft(accent, soft);
  return (
    <TouchableOpacity
      style={[styles.detailToggle, { backgroundColor: softBg, borderColor: `${accent}55` }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.detailToggleText, { color: accent }]}>{open ? labelOpen : labelClosed}</Text>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={accent} />
    </TouchableOpacity>
  );
}

function DetailSection({ title, subtitle, accentColor, accentSoft, summary, open, onToggle, children }) {
  const soft = resolveAccentSoft(accentColor, accentSoft);
  return (
    <SectionCard
      style={[styles.detailSection, styles.flatCard, accentColor ? { borderColor: `${accentColor}33` } : null]}
    >
      <BlockHeader title={title} subtitle={subtitle} accentColor={accentColor} />
      {summary}
      <DetailToggle open={open} onPress={onToggle} accent={accentColor} soft={soft} />
      {open ? <View style={styles.detailBody}>{children}</View> : null}
    </SectionCard>
  );
}

function CompactRankingList({
  items,
  valueKey = 'displayValue',
  limit = 3,
  showAll,
  onToggleShowAll,
  toggleAccent = CHART_PALETTE.greenDark,
  toggleSoft,
}) {
  const visible = showAll ? items : items.slice(0, limit);
  if (!items?.length) {
    return <Text style={styles.emptyRanking}>Nenhum dado disponível no período.</Text>;
  }

  return (
    <>
      <View style={styles.rankingList}>
        {visible.map((item, index) => (
          <View key={item.id} style={styles.rankingRow}>
            <View style={styles.rankingLeft}>
              <View style={[styles.rankingIndex, index === 0 && { backgroundColor: CHART_PALETTE.greenSoft }]}>
                <Text style={styles.rankingIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.rankingCopy}>
                <Text style={styles.rankingName}>{item.patientName}</Text>
                <Text style={styles.rankingMeta} numberOfLines={1}>
                  {item.streak} · {item.objective}
                </Text>
              </View>
            </View>
            <Text style={styles.rankingValue}>{item[valueKey] || item.display}</Text>
          </View>
        ))}
      </View>
      {items.length > limit ? (
        <DetailToggle
          open={showAll}
          onPress={onToggleShowAll}
          labelClosed={`Ver todos (${items.length})`}
          labelOpen="Mostrar top 3"
          accent={toggleAccent}
          soft={toggleSoft}
        />
      ) : null}
    </>
  );
}

function AlertChip({ item, onPress }) {
  const meta = ALERT_SEVERITY[item.severity] || ALERT_SEVERITY.inactive;
  return (
    <View style={[styles.alertChip, { backgroundColor: meta.soft, borderColor: `${meta.color}55` }]}>
      <View style={styles.alertChipTop}>
        <View style={[styles.alertChipIcon, { backgroundColor: `${meta.color}22` }]}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
        </View>
        <View style={styles.alertChipCopy}>
          <Text style={styles.alertChipName}>{item.name}</Text>
          <Text style={[styles.alertChipReason, { color: meta.color }]}>{item.reason}</Text>
          <Text style={styles.alertChipIndicator}>{item.indicator}</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.alertActionButton, { borderColor: meta.color }]} onPress={onPress} activeOpacity={0.9}>
        <Text style={[styles.alertActionText, { color: meta.color }]}>Ver paciente</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TelaRelatoriosNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [exportingKey, setExportingKey] = useState('');
  const [reportPeriod, setReportPeriod] = useState('7days');
  const [trendMetric, setTrendMetric] = useState('adherence');
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState({
    engagement: false,
    nutrition: false,
    glucose: false,
    therapy: false,
    rankings: false,
  });
  const [rankingExpanded, setRankingExpanded] = useState({
    attention: false,
    evolution: false,
    lowAdherence: false,
  });

  const dashboard = bundle?.dashboardAnalytics;

  const loadReports = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        setLoadError('');
        const nextBundle = await buildNutritionistReportBundle(usuarioLogado, { period: reportPeriod });
        setBundle(nextBundle);
      } catch (error) {
        console.log('Erro ao carregar relatorios do nutricionista:', error);
        setLoadError(error?.message || 'Nao foi possivel carregar os relatorios.');
        setBundle(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [usuarioLogado, reportPeriod]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => loadReports({ silent: true }));
    return unsubscribe;
  }, [navigation, loadReports]);

  const openPatient = useCallback(
    (patientId) => {
      const patient = bundle?.patients?.find((row) => row.id === patientId);
      if (!patient) return;
      navigation.navigate('NutriProntuarioPaciente', {
        usuarioLogado,
        pacienteId: patientId,
        paciente: patient,
      });
    },
    [navigation, usuarioLogado, bundle]
  );

  const adherenceTrend = useMemo(
    () => seriesTrend(dashboard?.weeklyTrend?.adherence || []),
    [dashboard]
  );

  const overviewCards = useMemo(() => {
    const overview = dashboard?.overview;
    if (!bundle || !overview) {
      return [
        { id: 'total', label: 'Total Pacientes', value: '—', trend: 'stable' },
        { id: 'good', label: 'Bom Controle', value: '—', trend: 'stable' },
        { id: 'attention', label: 'Atenção', value: '—', trend: 'stable', invertTrend: true },
        { id: 'critical', label: 'Críticos', value: '—', trend: 'stable', invertTrend: true },
        { id: 'avgAdherence', label: 'Adesão Média', value: '—', trend: 'stable' },
        { id: 'alerts', label: 'Alertas', value: '—', trend: 'stable', invertTrend: true },
      ];
    }

    return [
      { id: 'total', label: 'Total Pacientes', value: String(bundle.metrics.totalPatients), trend: 'stable' },
      { id: 'good', label: 'Bom Controle', value: String(overview.goodControl), trend: adherenceTrend },
      { id: 'attention', label: 'Atenção', value: String(overview.attention), trend: 'stable', invertTrend: true },
      { id: 'critical', label: 'Críticos', value: String(overview.critical), trend: 'stable', invertTrend: true },
      { id: 'avgAdherence', label: 'Adesão Média', value: `${bundle.metrics.averageAdherence}%`, trend: adherenceTrend },
      { id: 'alerts', label: 'Alertas', value: String(bundle.metrics.alertsTotal), trend: 'stable', invertTrend: true },
    ];
  }, [bundle, dashboard, adherenceTrend]);

  const objectiveChartItems = useMemo(() => {
    const rows = dashboard?.objectiveEnhanced?.length
      ? dashboard.objectiveEnhanced
      : bundle?.objectiveDistribution || [];
    return rows.map((item) => ({ id: item.id, label: item.label, value: item.value }));
  }, [bundle, dashboard]);

  const trendChartItems = useMemo(() => {
    if (!dashboard?.weeklyTrend) return [];
    if (trendMetric === 'glucose') return dashboard.weeklyTrend.glucose || [];
    if (trendMetric === 'tir') return dashboard.weeklyTrend.tir || [];
    return dashboard.weeklyTrend.adherence || [];
  }, [dashboard, trendMetric]);

  const trendColor = TREND_COLORS[trendMetric] || CHART_PALETTE.green;

  const totalMeals = useMemo(() => sumChartValues(dashboard?.nutrition?.mealsByDay || []), [dashboard]);

  const engagementCounts = useMemo(() => {
    const freq = dashboard?.engagementFrequency || [];
    const find = (id) => freq.find((item) => item.id === id)?.value || 0;
    return {
      inactive: find('inativo'),
      daily: find('diario'),
      sporadic: find('esporadico'),
    };
  }, [dashboard]);

  const rankingAttention = useMemo(() => {
    return (dashboard?.rankingLists?.highestRisk || []).slice(0, 5).map((item) => ({
      ...item,
      displayValue: item.display || item.risk,
    }));
  }, [dashboard]);

  const rankingEvolution = useMemo(() => {
    return (dashboard?.rankingLists?.bestTir || []).slice(0, 5).map((item) => ({
      ...item,
      displayValue: item.display || `${item.glucoseTir ?? item.value}%`,
    }));
  }, [dashboard]);

  const rankingLowAdherence = useMemo(() => {
    return (dashboard?.rankingLists?.lowestAdherence || []).slice(0, 5).map((item) => ({
      ...item,
      displayValue: item.display || `${item.adherence ?? item.value}%`,
    }));
  }, [dashboard]);

  const flatAlerts = useMemo(() => {
    if (!bundle?.patients?.length) return [];
    const patients = bundle.patients;
    const severityOrder = { critical: 0, highGlucose: 1, lowAdherence: 2, inactive: 3 };

    const pickIndicator = (row) => {
      if (Number(row.glucoseAverage) >= 180) return `Glicose ${row.glucoseAverage} mg/dL`;
      if (Number(row.adherence) > 0 && Number(row.adherence) < 60) return `Adesão ${row.adherence}%`;
      if (Number(row.glucoseTir) > 0) return `TIR ${row.glucoseTir}%`;
      return `Adesão ${row.adherence ?? '—'}%`;
    };

    const build = (rows, severity, reasonFn) =>
      rows.map((row) => ({
        id: `${severity}-${row.id}`,
        patientId: row.id,
        name: row.name,
        severity,
        reason: typeof reasonFn === 'function' ? reasonFn(row) : reasonFn,
        indicator: pickIndicator(row),
      }));

    const merged = [
      ...build(
        patients.filter((row) => row.controlBucket === 'critico'),
        'critical',
        'Controle crítico no período'
      ),
      ...build(
        patients.filter((row) => Number(row.glucoseAverage) >= 180),
        'highGlucose',
        (row) => `Glicose média ${row.glucoseAverage} mg/dL`
      ),
      ...build(
        patients.filter((row) => Number(row.adherence) > 0 && Number(row.adherence) < 60),
        'lowAdherence',
        (row) => `Adesão alimentar ${row.adherence}%`
      ),
      ...build(patients.filter((row) => row.inactive), 'inactive', 'Sem registros recentes'),
    ];

    const unique = [];
    const seen = new Set();
    merged
      .sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))
      .forEach((item) => {
        if (seen.has(item.patientId)) return;
        seen.add(item.patientId);
        unique.push(item);
      });

    return unique;
  }, [bundle]);

  const visibleAlerts = showAllAlerts ? flatAlerts : flatAlerts.slice(0, 3);
  const riskTotal = sumChartValues(bundle?.riskDistribution || []);

  const toggleDetail = (key) => {
    setExpandedDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function handleExport(type) {
    if (!bundle) {
      Alert.alert('Relatórios', 'Aguarde o carregamento dos dados antes de exportar.');
      return;
    }

    const key = `${type}-pdf`;
    try {
      setExportingKey(key);
      const result = await exportNutritionistReport({ bundle, type, format: 'pdf' });
      if (result?.ok) {
        Alert.alert(
          'PDF gerado',
          Platform.OS === 'web'
            ? 'O PDF foi baixado para o seu dispositivo.'
            : 'O PDF foi gerado. Escolha onde salvar ou compartilhar.'
        );
      }
    } catch (error) {
      Alert.alert('Exportação', error?.message || 'Não foi possível exportar o relatório.');
    } finally {
      setExportingKey('');
    }
  }

  const metricCardWidth = isCompact ? '48%' : Platform.OS === 'web' ? '15.5%' : '48%';

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'NutricionistaRelatorios'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadReports({ silent: true });
          }}
          colors={[patientTheme.colors.primaryDark]}
        />
      }
    >
      <View style={nutriDesktopStyles.pageGap}>
        {bundle?.generatedAt ? (
          <Text style={styles.generatedAt}>
            Atualizado em {bundle.generatedAt}
            {bundle.consultas?.upcoming ? ` · ${bundle.consultas.upcoming} consulta(s) proxima(s)` : ''}
          </Text>
        ) : null}

        <FilterChipRow
          items={[
            { id: '7days', label: '7 dias' },
            { id: '15days', label: '15 dias' },
            { id: '30days', label: '30 dias' },
          ]}
          activeId={reportPeriod}
          onChange={setReportPeriod}
          accent={CHART_PALETTE.greenDark}
        />

        <View style={[styles.metricGrid, isCompact && styles.metricGridCompact]}>
          {overviewCards.map((item) => {
            const theme = METRIC_THEMES[item.id] || METRIC_THEMES.total;
            return (
              <View key={item.id} style={{ width: metricCardWidth, flexGrow: 1 }}>
                <DashboardKpiCard
                  icon={theme.icon}
                  accent={theme.accent}
                  label={item.label}
                  value={item.value}
                  trend={item.trend}
                  invertTrend={item.invertTrend}
                />
              </View>
            );
          })}
        </View>

        {loading ? <ScreenLoading label="Consolidando dados da carteira..." persona="nutricionista" /> : null}

        {!loading && loadError ? (
          <SectionCard style={styles.flatCard}>
            <Text style={styles.errorTitle}>Nao foi possivel carregar</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadReports()}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </SectionCard>
        ) : null}

        {!loading && !loadError && bundle ? (
          <>
            <SectionCard style={[styles.sectionCard, styles.flatCard]}>
              <BlockHeader
                title="Saúde da carteira"
                subtitle="Risco, objetivos e tempo no alvo"
                accentColor={CHART_PALETTE.greenDark}
              />
              <View style={[isCompact ? styles.stackCol : nutriDesktopStyles.desktopRow, styles.splitRow]}>
                <View style={styles.splitPanel}>
                  <Text style={styles.chartTitle}>Distribuição de risco</Text>
                  <InteractiveDonutChart
                    items={bundle.riskDistribution}
                    colors={RISK_COLORS}
                    centerValue={riskTotal}
                    centerLabel="pacientes"
                    formatTooltip={(item, total) =>
                      `${item.value} paciente${item.value === 1 ? '' : 's'} (${chartPercent(item.value, total)}%)`
                    }
                  />
                </View>
                <View style={styles.splitPanel}>
                  <Text style={styles.chartTitle}>Objetivos dos pacientes</Text>
                  <InteractiveHorizontalBarChart items={objectiveChartItems} colors={OBJECTIVE_COLORS} />
                </View>
              </View>
              <Text style={[styles.chartTitle, styles.chartTitleSpaced]}>Faixas de tempo no alvo (TIR)</Text>
              <InteractiveProgressChart
                items={dashboard?.tirDistribution || []}
                colors={TIR_COLORS}
                percentBase={bundle?.metrics?.totalPatients}
              />
            </SectionCard>

            <SectionCard style={[styles.sectionCard, styles.flatCard]}>
              <BlockHeader title="Tendência da carteira" subtitle="Evolução semanal no período" accentColor={trendColor} />
              <FilterChipRow
                items={[
                  { id: 'adherence', label: 'Adesão' },
                  { id: 'glucose', label: 'Glicose' },
                  { id: 'tir', label: 'Tempo no alvo' },
                ]}
                activeId={trendMetric}
                onChange={setTrendMetric}
                accent={trendMetric === 'adherence' ? CHART_PALETTE.greenDark : trendColor}
              />
              <InteractiveLineChart
                items={trendChartItems.length ? trendChartItems : bundle.weeklyAdherence}
                color={trendColor}
                axisUnit={trendMetric === 'glucose' ? 'mg/dL' : '%'}
                formatAxisValue={(value) => String(value ?? '—')}
                formatValue={(value) =>
                  trendMetric === 'glucose' ? `${value ?? '—'} mg/dL` : `${value ?? '—'}%`
                }
              />
            </SectionCard>

            <SectionCard style={[styles.alertPanel, styles.flatCard]}>
              <BlockHeader title="Alertas inteligentes" subtitle="Priorize ação imediata" accentColor={CHART_PALETTE.red} />
              {visibleAlerts.length ? (
                <View style={styles.alertChipGrid}>
                  {visibleAlerts.map((item) => (
                    <AlertChip key={item.id} item={item} onPress={() => openPatient(item.patientId)} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyRanking}>Nenhum alerta prioritário identificado no período.</Text>
              )}
              {flatAlerts.length > 3 ? (
                <DetailToggle
                  open={showAllAlerts}
                  onPress={() => setShowAllAlerts((prev) => !prev)}
                  labelClosed={`Ver todos os alertas (${flatAlerts.length})`}
                  labelOpen="Mostrar apenas 3 alertas"
                  accent={SECTION_ACCENTS.alerts.accent}
                  soft={SECTION_ACCENTS.alerts.soft}
                />
              ) : null}
            </SectionCard>

            <SectionCard style={[styles.insightPanel, styles.flatCard]}>
              <View style={styles.insightHeader}>
                <Ionicons name="bulb" size={20} color={CHART_PALETTE.greenDark} />
                <Text style={styles.insightTitle}>Insights automáticos</Text>
              </View>
              <Text style={styles.insightText}>
                {dashboard?.insightsText ||
                  'Consolide registros dos pacientes para gerar insights automáticos da carteira.'}
              </Text>
            </SectionCard>

            <DetailSection
              title="Engajamento"
              subtitle="Frequência de uso da carteira"
              accentColor={SECTION_ACCENTS.engagement.accent}
              accentSoft={SECTION_ACCENTS.engagement.soft}
              open={expandedDetails.engagement}
              onToggle={() => toggleDetail('engagement')}
              summary={
                <View style={styles.miniKpiRow}>
                  <MiniKpiCard label="Inativos" value={String(engagementCounts.inactive)} accent={ENGAGEMENT_FREQ_COLORS_BY_ID.inativo} />
                  <MiniKpiCard label="Uso diário" value={String(engagementCounts.daily)} accent={ENGAGEMENT_FREQ_COLORS_BY_ID.diario} />
                  <MiniKpiCard label="Esporádicos" value={String(engagementCounts.sporadic)} accent={ENGAGEMENT_FREQ_COLORS_BY_ID.esporadico} />
                </View>
              }
            >
              <View style={[isCompact ? styles.stackCol : nutriDesktopStyles.desktopRow, styles.splitRow]}>
                <View style={styles.splitPanel}>
                  <InteractiveDonutChart
                    items={dashboard?.engagementFrequency || []}
                    colors={FREQ_COLORS}
                    centerValue={sumChartValues(dashboard?.engagementFrequency || [])}
                    centerLabel="pacientes"
                  />
                </View>
                <View style={styles.splitPanel}>
                  <Text style={styles.chartTitle}>Quantidade de registros</Text>
                  <InteractiveHorizontalBarChart
                    items={dashboard?.engagementRecords || []}
                    colors={RECORD_BUCKET_COLORS}
                  />
                </View>
              </View>
            </DetailSection>

            <DetailSection
              title="Alimentação"
              subtitle="Resumo alimentar da carteira"
              accentColor={SECTION_ACCENTS.nutrition.accent}
              accentSoft={SECTION_ACCENTS.nutrition.soft}
              open={expandedDetails.nutrition}
              onToggle={() => toggleDetail('nutrition')}
              summary={
                <View style={styles.miniKpiRow}>
                  <MiniKpiCard label="Total refeições" value={String(totalMeals)} accent={CHART_PALETTE.blue} />
                  <MiniKpiCard label="Média kcal/dia" value={String(dashboard?.nutrition?.avgCalories ?? 0)} accent={CHART_PALETTE.blue} />
                  <MiniKpiCard label="Média carb/dia" value={`${dashboard?.nutrition?.avgCarbs ?? 0} g`} accent={CHART_PALETTE.blue} />
                  <MiniKpiCard label="Sem registros" value={String(dashboard?.nutrition?.noMealPatients ?? 0)} accent={CHART_PALETTE.orange} />
                </View>
              }
            >
              <Text style={styles.chartTitle}>Refeições por dia</Text>
              <InteractiveLineChart
                items={dashboard?.nutrition?.mealsByDay || []}
                color={CHART_PALETTE.blue}
                axisUnit="ref."
                formatAxisValue={(value) => String(value ?? 0)}
                formatValue={(value) => `${value ?? 0} ref.`}
              />
              <Text style={[styles.chartTitle, styles.chartTitleSpaced]}>Tipos de refeição</Text>
              <InteractiveDonutChart
                items={dashboard?.nutrition?.mealTypes || []}
                colors={MEAL_TYPE_COLORS}
                centerValue={sumChartValues(dashboard?.nutrition?.mealTypes || [])}
                centerLabel="registros"
              />
            </DetailSection>

            <DetailSection
              title="Glicose"
              subtitle="Controle glicêmico"
              accentColor={SECTION_ACCENTS.glucose.accent}
              accentSoft={SECTION_ACCENTS.glucose.soft}
              open={expandedDetails.glucose}
              onToggle={() => toggleDetail('glucose')}
              summary={
                <View style={styles.miniKpiRow}>
                  <MiniKpiCard label="Média geral" value={String(dashboard?.glucose?.portfolioAvg ?? '—')} accent={SECTION_ACCENTS.glucose.accent} />
                  <MiniKpiCard label="Tempo no alvo" value={dashboard?.glucose?.portfolioTir != null ? `${dashboard.glucose.portfolioTir}%` : '—'} accent={CHART_PALETTE.blue} />
                  <MiniKpiCard label="Acima da meta" value={String(dashboard?.glucose?.aboveTarget ?? 0)} accent={CHART_PALETTE.orange} />
                  <MiniKpiCard label="Críticos" value={String(dashboard?.overview?.critical ?? 0)} accent={CHART_PALETTE.red} />
                </View>
              }
            >
              <InteractiveDonutChart
                items={dashboard?.glucose?.rangeDistribution || []}
                colors={GLUCOSE_COLORS}
                centerValue={sumChartValues(dashboard?.glucose?.rangeDistribution || [])}
                centerLabel="leituras"
              />
              <Text style={[styles.chartTitle, styles.chartTitleSpaced]}>Média glicêmica semanal</Text>
              <InteractiveLineChart
                items={dashboard?.weeklyTrend?.glucose || []}
                color={CHART_PALETTE.orange}
                axisUnit="mg/dL"
                formatAxisValue={(value) => String(value ?? '—')}
                formatValue={(value) => `${value ?? '—'} mg/dL`}
              />
            </DetailSection>

            <DetailSection
              title="Insulina e medicação"
              subtitle="Terapias registradas"
              accentColor={SECTION_ACCENTS.therapy.accent}
              accentSoft={SECTION_ACCENTS.therapy.soft}
              open={expandedDetails.therapy}
              onToggle={() => toggleDetail('therapy')}
              summary={
                <View style={styles.miniKpiRow}>
                  <MiniKpiCard label="Aplicações" value={String(dashboard?.insulin?.totalApplications ?? 0)} accent={CHART_PALETTE.purple} />
                  <MiniKpiCard label="Insulinizados" value={String(dashboard?.insulin?.insulinizedPatients ?? 0)} accent={CHART_PALETTE.purple} />
                  <MiniKpiCard label="Adesão med." value={`${dashboard?.medication?.overallAdherence ?? 0}%`} accent={CHART_PALETTE.medOrange} />
                </View>
              }
            >
              <InteractiveDonutChart
                items={dashboard?.insulin?.basalBolus || []}
                colors={INSULIN_COLORS}
                centerValue={dashboard?.insulin?.totalApplications ?? 0}
                centerLabel="aplicações"
              />
              <Text style={[styles.chartTitle, styles.chartTitleSpaced]}>Medicação por medicamento</Text>
              <InteractiveProgressChart
                items={dashboard?.medication?.topMedications || []}
                colors={[CHART_PALETTE.medOrange, CHART_PALETTE.orange, CHART_PALETTE.yellow, CHART_PALETTE.red, CHART_PALETTE.pink]}
                valueSuffix="registros"
              />
            </DetailSection>

            <DetailSection
              title="Rankings"
              subtitle="Comparativo rápido da carteira"
              accentColor={SECTION_ACCENTS.rankings.accent}
              accentSoft={SECTION_ACCENTS.rankings.soft}
              open={expandedDetails.rankings}
              onToggle={() => toggleDetail('rankings')}
              summary={
                <Text style={styles.summaryHint}>
                  Top 3 em atenção, evolução (TIR) e baixa adesão. Expanda para ver gráficos completos.
                </Text>
              }
            >
              <View style={[isCompact ? styles.stackCol : styles.rankingsCompact]}>
                <View style={styles.rankingBlock}>
                  <Text style={styles.rankingBlockTitle}>Precisam de atenção</Text>
                  <CompactRankingList
                    items={rankingAttention}
                    showAll={rankingExpanded.attention}
                    onToggleShowAll={() =>
                      setRankingExpanded((prev) => ({ ...prev, attention: !prev.attention }))
                    }
                    toggleAccent={SECTION_ACCENTS.rankings.accent}
                    toggleSoft={SECTION_ACCENTS.rankings.soft}
                  />
                </View>
                <View style={styles.rankingBlock}>
                  <Text style={styles.rankingBlockTitle}>Melhores evoluções (TIR)</Text>
                  <CompactRankingList
                    items={rankingEvolution}
                    showAll={rankingExpanded.evolution}
                    onToggleShowAll={() =>
                      setRankingExpanded((prev) => ({ ...prev, evolution: !prev.evolution }))
                    }
                    toggleAccent={SECTION_ACCENTS.rankings.accent}
                    toggleSoft={SECTION_ACCENTS.rankings.soft}
                  />
                </View>
                <View style={styles.rankingBlock}>
                  <Text style={styles.rankingBlockTitle}>Baixa adesão</Text>
                  <CompactRankingList
                    items={rankingLowAdherence}
                    showAll={rankingExpanded.lowAdherence}
                    onToggleShowAll={() =>
                      setRankingExpanded((prev) => ({ ...prev, lowAdherence: !prev.lowAdherence }))
                    }
                    toggleAccent={SECTION_ACCENTS.rankings.accent}
                    toggleSoft={SECTION_ACCENTS.rankings.soft}
                  />
                </View>
              </View>
            </DetailSection>

            <SectionCard style={[styles.exportSection, styles.flatCard]}>
              <Text style={styles.sectionTitle}>Relatório da carteira</Text>
              <Text style={styles.exportIntro}>
                Emita o PDF consolidado ou relatórios complementares da carteira no período selecionado.
              </Text>
              <TouchableOpacity
                style={[
                  styles.primaryPdfButton,
                  (exportingKey === 'geral-pdf' || Boolean(exportingKey)) && styles.primaryPdfButtonDisabled,
                ]}
                onPress={() => handleExport('geral')}
                disabled={Boolean(exportingKey)}
                activeOpacity={0.9}
              >
                {exportingKey === 'geral-pdf' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                )}
                <Text style={styles.primaryPdfButtonText}>Emitir relatório da carteira</Text>
              </TouchableOpacity>
              <Text style={styles.secondaryPdfTitle}>Outros relatórios em PDF</Text>
              <View style={styles.exportRow}>
                <ExportCard
                  icon="restaurant-outline"
                  iconColor={CHART_PALETTE.greenDark}
                  title="Adesão alimentar"
                  helper="PDF da adesão da carteira"
                  loading={exportingKey === 'adesao-pdf'}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('adesao')}
                />
                <ExportCard
                  icon="pulse-outline"
                  iconColor={CHART_PALETTE.red}
                  title="Risco glicêmico"
                  helper="PDF por nível de risco"
                  loading={exportingKey === 'risco-pdf'}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('risco')}
                />
              </View>
            </SectionCard>
          </>
        ) : null}
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  flatCard: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    shadowColor: 'transparent',
    elevation: 0,
  },
  generatedAt: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricGridCompact: {
    justifyContent: 'space-between',
  },
  metricCard: {
    minWidth: 150,
    minHeight: 92,
    padding: 14,
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricTrend: {
    fontSize: 14,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
  },
  metricAccentBar: {
    marginTop: 8,
    width: 28,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  metricTrendUp: {
    color: CHART_PALETTE.greenDark,
  },
  metricTrendDown: {
    color: CHART_PALETTE.red,
  },
  metricLabel: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  metricValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  blockAccent: {
    width: 4,
    height: 36,
    borderRadius: 4,
    marginTop: 2,
  },
  blockHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  blockTitle: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  blockSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    gap: 16,
    padding: 16,
  },
  detailSection: {
    gap: 12,
    padding: 16,
  },
  detailBody: {
    gap: 14,
    marginTop: 4,
  },
  detailToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
  },
  detailToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  summaryHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  miniKpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniKpiCard: {
    flex: 1,
    minWidth: 120,
    minHeight: 72,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.background,
  },
  miniKpiLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  miniKpiValue: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  miniKpiAccentBar: {
    marginTop: 8,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  exportSection: {
    gap: 16,
    padding: 16,
  },
  exportIntro: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  reportPeriodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportPeriodChip: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: patientTheme.colors.background,
  },
  reportPeriodChipText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  reportPeriodChipActiveBrand: {
    backgroundColor: CHART_PALETTE.greenSoft,
    borderColor: CHART_PALETTE.greenDark,
  },
  reportPeriodChipTextActiveBrand: {
    color: CHART_PALETTE.greenDark,
    fontWeight: '800',
  },
  primaryPdfButton: {
    backgroundColor: '#4CD197',
    borderRadius: patientTheme.radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryPdfButtonDisabled: {
    opacity: 0.7,
  },
  primaryPdfButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryPdfTitle: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  exportRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  exportCard: {
    flex: 1,
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  exportCardDisabled: {
    opacity: 0.65,
  },
  exportTitle: {
    marginTop: 8,
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  exportHelper: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  errorTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    padding: 16,
  },
  errorText: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  retryButton: {
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  retryButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  splitRow: {
    alignItems: 'stretch',
    gap: 16,
  },
  stackCol: {
    flexDirection: 'column',
    gap: 16,
  },
  splitPanel: {
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  chartTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  chartTitleSpaced: {
    marginTop: 8,
  },
  alertPanel: {
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFBFB',
    borderColor: '#FECACA',
  },
  alertChipGrid: {
    gap: 10,
  },
  alertChip: {
    borderWidth: 1,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    gap: 10,
  },
  alertChipTop: {
    flexDirection: 'row',
    gap: 10,
  },
  alertChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertChipCopy: {
    flex: 1,
    gap: 2,
  },
  alertChipName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  alertChipReason: {
    fontSize: 12,
    fontWeight: '700',
  },
  alertChipIndicator: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  alertActionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1.5,
    backgroundColor: patientTheme.colors.background,
  },
  alertActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  insightPanel: {
    gap: 10,
    padding: 16,
    backgroundColor: CHART_PALETTE.greenSoft,
    borderColor: `${CHART_PALETTE.greenDark}44`,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightTitle: {
    color: CHART_PALETTE.greenDark,
    fontSize: 15,
    fontWeight: '800',
  },
  insightText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  rankingsCompact: {
    flexDirection: 'row',
    gap: 12,
  },
  rankingBlock: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  rankingBlockTitle: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  rankingList: {
    gap: 8,
  },
  emptyRanking: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rankingRow: {
    minHeight: 54,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  rankingIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHART_PALETTE.graySoft,
  },
  rankingIndexText: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  rankingCopy: {
    flex: 1,
    minWidth: 0,
  },
  rankingName: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rankingMeta: {
    marginTop: 2,
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  rankingValue: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
});
