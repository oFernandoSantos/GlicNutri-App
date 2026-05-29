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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import { ProgressBar, SectionCard, nutriDesktopStyles } from '../../componentes/nutricionista/NutriDesktopUI';
import { ScreenLoading } from '../../componentes/comum/ui';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import {
  buildNutritionistReportBundle,
  exportNutritionistReport,
} from '../../servicos/servicoRelatoriosNutricionista';

function MetricCard({ icon, iconColor, label, value, valueStyle }) {
  return (
    <SectionCard style={[styles.metricCard, styles.flatCard]}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[styles.metricValue, valueStyle]}>{value}</Text>
    </SectionCard>
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

function MiniBarChart({ items, color }) {
  const safeItems = items?.length ? items : [{ id: 'empty', label: '—', value: 0 }];
  const max = Math.max(...safeItems.map((item) => Number(item.value) || 0), 1);

  return (
    <View style={styles.chartBox}>
      <View style={styles.chartAxisY}>
        <Text style={styles.axisText}>max</Text>
        <Text style={styles.axisText}>75%</Text>
        <Text style={styles.axisText}>50%</Text>
        <Text style={styles.axisText}>25%</Text>
        <Text style={styles.axisText}>0</Text>
      </View>
      <View style={styles.chartColumnsWrap}>
        <View style={styles.chartColumns}>
          {safeItems.map((item) => (
            <View key={item.id} style={styles.chartColumnItem}>
              <View style={styles.chartColumnTrack}>
                <View
                  style={[
                    styles.chartColumnFill,
                    { backgroundColor: color, height: `${Math.max(8, (Number(item.value) / max) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.chartColumnLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function RiskBarChart({ items }) {
  const safeItems = items?.length
    ? items
    : [
        { id: 'r1', label: 'Alto', value: 0 },
        { id: 'r2', label: 'Mod.', value: 0 },
        { id: 'r3', label: 'Baixo', value: 0 },
      ];
  const max = Math.max(...safeItems.map((item) => Number(item.value) || 0), 1);
  const colorMap = [patientTheme.colors.danger, patientTheme.colors.warning, patientTheme.colors.primaryDark];

  return (
    <View style={styles.chartBox}>
      <View style={styles.chartAxisY}>
        <Text style={styles.axisText}>{max}</Text>
        <Text style={styles.axisText} />
        <Text style={styles.axisText} />
        <Text style={styles.axisText} />
        <Text style={styles.axisText}>0</Text>
      </View>
      <View style={styles.chartColumnsWrap}>
        <View style={styles.chartColumns}>
          {safeItems.map((item, index) => (
            <View key={item.id} style={styles.chartColumnItem}>
              <View style={styles.chartColumnTrack}>
                <View
                  style={[
                    styles.chartColumnFill,
                    {
                      backgroundColor: colorMap[index] || patientTheme.colors.primaryDark,
                      height: `${Math.max(8, (Number(item.value) / max) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartColumnLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function TrendLineChart({ items }) {
  const safeItems = items?.length
    ? items
    : [{ id: 'w0', label: '-', value: 0 }];

  return (
    <View style={styles.trendChartWrap}>
      <View style={styles.trendGrid} />
      <View style={styles.trendLineLayer}>
        {safeItems.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.trendPoint,
              {
                left: `${(index / Math.max(safeItems.length - 1, 1)) * 100}%`,
                top: `${100 - Number(item.value || 0)}%`,
              },
            ]}
          />
        ))}
        <View style={styles.trendPolyline}>
          <View style={styles.trendPolylineInner} />
        </View>
      </View>
      <View style={styles.trendLabelsRow}>
        {safeItems.map((item) => (
          <Text key={item.id} style={styles.trendDayLabel}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function TelaRelatoriosNutricionista({ navigation, route, onNutriLogout }) {
  const { usuarioLogado } = route.params || {};
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [exportingKey, setExportingKey] = useState('');

  const loadReports = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        setLoadError('');
        const nextBundle = await buildNutritionistReportBundle(usuarioLogado);
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
    [usuarioLogado]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => loadReports({ silent: true }));
    return unsubscribe;
  }, [navigation, loadReports]);

  const metrics = useMemo(() => {
    if (!bundle) {
      return [
        { id: 'm1', label: 'Total Pacientes', value: '—', icon: 'people-outline', iconColor: patientTheme.colors.primaryDark, valueStyle: styles.metricValueDefault },
        { id: 'm2', label: 'Alto Risco', value: '—', icon: 'trending-up-outline', iconColor: patientTheme.colors.danger, valueStyle: styles.metricValueHighRisk },
        { id: 'm3', label: 'Adesão Média', value: '—', icon: 'trending-up-outline', iconColor: patientTheme.colors.primaryDark, valueStyle: styles.metricValueAdherence },
        { id: 'm4', label: 'Alertas Ativos', value: '—', icon: 'calendar-outline', iconColor: patientTheme.colors.danger, valueStyle: styles.metricValueAlerts },
      ];
    }

    return [
      {
        id: 'm1',
        label: 'Total Pacientes',
        value: String(bundle.metrics.totalPatients),
        icon: 'people-outline',
        iconColor: patientTheme.colors.primaryDark,
        valueStyle: styles.metricValueDefault,
      },
      {
        id: 'm2',
        label: 'Alto Risco',
        value: String(bundle.metrics.highRiskCount),
        icon: 'trending-up-outline',
        iconColor: patientTheme.colors.danger,
        valueStyle: styles.metricValueHighRisk,
      },
      {
        id: 'm3',
        label: 'Adesão Média',
        value: `${bundle.metrics.averageAdherence}%`,
        icon: 'trending-up-outline',
        iconColor: patientTheme.colors.primaryDark,
        valueStyle: styles.metricValueAdherence,
      },
      {
        id: 'm4',
        label: 'Alertas Ativos',
        value: String(bundle.metrics.alertsTotal),
        icon: 'calendar-outline',
        iconColor: patientTheme.colors.danger,
        valueStyle: styles.metricValueAlerts,
      },
    ];
  }, [bundle]);

  const objectiveChartItems = useMemo(() => {
    if (!bundle?.objectiveDistribution?.length) return [];
    const max = Math.max(...bundle.objectiveDistribution.map((item) => item.value), 1);
    return bundle.objectiveDistribution.map((item) => ({
      id: item.id,
      label: String(item.label).slice(0, 8),
      value: Math.round((item.value / max) * 100),
      count: item.value,
    }));
  }, [bundle]);

  async function handleExport(type, format) {
    if (!bundle) {
      Alert.alert('Relatorios', 'Aguarde o carregamento dos dados antes de exportar.');
      return;
    }

    const key = `${type}-${format}`;
    try {
      setExportingKey(key);
      const result = await exportNutritionistReport({ bundle, type, format });
      if (result?.ok) {
        Alert.alert(
          'Exportacao concluida',
          Platform.OS === 'web'
            ? format === 'pdf'
              ? 'O PDF foi baixado para o seu dispositivo.'
              : 'O arquivo foi baixado para o seu dispositivo.'
            : format === 'pdf'
              ? 'O PDF foi gerado. Escolha onde salvar ou compartilhar.'
              : 'O relatorio foi preparado para compartilhamento ou salvamento.'
        );
      }
    } catch (error) {
      console.log('Erro ao exportar relatorio:', error);
      Alert.alert('Exportacao', error?.message || 'Nao foi possivel exportar o relatorio.');
    } finally {
      setExportingKey('');
    }
  }

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
            {bundle.consultas?.upcoming
              ? ` · ${bundle.consultas.upcoming} consulta(s) proxima(s)`
              : ''}
          </Text>
        ) : null}

        <View style={styles.metricGrid}>
          {metrics.map((item) => (
            <MetricCard key={item.id} {...item} />
          ))}
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
            <SectionCard style={[styles.exportSection, styles.flatCard]}>
              <Text style={styles.sectionTitle}>Exportar Relatórios</Text>
              <Text style={styles.exportIntro}>
                Arquivos completos com todos os pacientes vinculados, metricas, consultas e detalhamento
                clinico. Os tres relatorios principais sao gerados em PDF; use CSV, TXT ou JSON para outros
                formatos.
              </Text>

              <View style={styles.exportRow}>
                <ExportCard
                  icon="document-text-outline"
                  iconColor={patientTheme.colors.textMuted}
                  title="Relatório Geral"
                  helper="PDF completo da carteira"
                  loading={exportingKey === 'geral-pdf'}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('geral', 'pdf')}
                />
                <ExportCard
                  icon="trending-up-outline"
                  iconColor={patientTheme.colors.primaryDark}
                  title="Relatório de Adesão"
                  helper="PDF com refeicoes por dia"
                  loading={exportingKey === 'adesao-pdf'}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('adesao', 'pdf')}
                />
                <ExportCard
                  icon="trending-up-outline"
                  iconColor={patientTheme.colors.danger}
                  title="Relatório de Risco"
                  helper="PDF por nivel de risco"
                  loading={exportingKey === 'risco-pdf'}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('risco', 'pdf')}
                />
              </View>

              <View style={styles.exportFormatRow}>
                <TouchableOpacity
                  style={styles.formatChip}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('geral', 'txt')}
                >
                  {exportingKey === 'geral-txt' ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                  ) : (
                    <Text style={styles.formatChipText}>Geral TXT</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatChip}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('adesao', 'txt')}
                >
                  {exportingKey === 'adesao-txt' ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                  ) : (
                    <Text style={styles.formatChipText}>Adesao TXT</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatChip}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('risco', 'txt')}
                >
                  {exportingKey === 'risco-txt' ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                  ) : (
                    <Text style={styles.formatChipText}>Risco TXT</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatChip}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('geral', 'csv')}
                >
                  {exportingKey === 'geral-csv' ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                  ) : (
                    <Text style={styles.formatChipText}>Geral CSV</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatChip}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('adesao', 'csv')}
                >
                  {exportingKey === 'adesao-csv' ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                  ) : (
                    <Text style={styles.formatChipText}>Adesao CSV</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatChip}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('risco', 'csv')}
                >
                  {exportingKey === 'risco-csv' ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                  ) : (
                    <Text style={styles.formatChipText}>Risco CSV</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.formatChip}
                  disabled={Boolean(exportingKey)}
                  onPress={() => handleExport('geral', 'json')}
                >
                  {exportingKey === 'geral-json' ? (
                    <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                  ) : (
                    <Text style={styles.formatChipText}>JSON completo</Text>
                  )}
                </TouchableOpacity>
              </View>

            </SectionCard>

            <View style={[nutriDesktopStyles.desktopRow, styles.chartsRow]}>
              <SectionCard style={[styles.chartPanel, styles.flatCard]}>
                <Text style={styles.sectionTitle}>Pacientes por Objetivo</Text>
                <MiniBarChart items={objectiveChartItems} color={patientTheme.colors.primaryDark} />

                <View style={styles.objectiveList}>
                  {bundle.objectiveRows.map((item) => (
                    <View key={item.id} style={styles.objectiveRow}>
                      <View style={styles.objectiveRowHeader}>
                        <Text style={styles.objectiveRowLabel}>{item.label}</Text>
                        <Text style={styles.objectiveRowValue}>
                          {item.value} paciente{item.value === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <View style={styles.objectiveTrack}>
                        <View
                          style={[
                            styles.objectiveFill,
                            {
                              width: `${bundle.metrics.totalPatients ? Math.min(100, (item.value / bundle.metrics.totalPatients) * 100) : 0}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </SectionCard>

              <SectionCard style={[styles.chartPanel, styles.flatCard]}>
                <Text style={styles.sectionTitle}>Distribuição de Risco</Text>
                <RiskBarChart items={bundle.riskDistribution} />

                <View style={styles.riskLegendList}>
                  {bundle.riskDistribution.map((item, index) => {
                    const colors = [
                      patientTheme.colors.danger,
                      patientTheme.colors.warning,
                      patientTheme.colors.primaryDark,
                    ];
                    const color = colors[index] || patientTheme.colors.primaryDark;
                    const total = bundle.riskDistribution.reduce(
                      (sum, entry) => sum + Number(entry.value || 0),
                      0
                    );
                    const percentage = total
                      ? Math.round((Number(item.value || 0) / total) * 100)
                      : 0;

                    return (
                      <View key={item.id} style={styles.riskLegendRow}>
                        <View style={styles.riskLegendLeft}>
                          <View style={[styles.riskLegendDot, { backgroundColor: color }]} />
                          <Text style={styles.riskLegendLabel}>{item.label}</Text>
                        </View>
                        <View style={styles.riskLegendRight}>
                          <Text style={styles.riskLegendValue}>{item.value}</Text>
                          <Text style={styles.riskLegendPercent}>{percentage}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </SectionCard>
            </View>

            <SectionCard style={[styles.trendSection, styles.flatCard]}>
              <Text style={styles.sectionTitle}>Tendência de Adesão - Última Semana</Text>
              <TrendLineChart items={bundle.weeklyAdherence} />
              <Text style={styles.trendLegend}>↔ Adesão média da carteira (%)</Text>

              <View style={styles.trendSummaryRow}>
                <View style={[styles.trendSummaryCard, styles.trendSummaryGreen]}>
                  <Text style={styles.trendSummaryLabel}>Média Semanal</Text>
                  <Text style={[styles.trendSummaryValue, styles.metricValueAdherence]}>
                    {bundle.metrics.portfolioAverage}%
                  </Text>
                </View>
                <View style={[styles.trendSummaryCard, styles.trendSummaryBlue]}>
                  <Text style={styles.trendSummaryLabel}>Melhor Dia</Text>
                  <Text style={[styles.trendSummaryValue, styles.metricValueWeekBlue]}>
                    {bundle.metrics.bestDay}%
                  </Text>
                </View>
                <View style={[styles.trendSummaryCard, styles.trendSummaryOrange]}>
                  <Text style={styles.trendSummaryLabel}>Pior Dia</Text>
                  <Text style={[styles.trendSummaryValue, styles.metricValueAlerts]}>
                    {bundle.metrics.worstDay}%
                  </Text>
                </View>
              </View>
            </SectionCard>

            <SectionCard style={[styles.rankingSection, styles.flatCard]}>
              <Text style={styles.sectionTitle}>Ranking de Adesão</Text>

              {bundle.ranking.length ? (
                <View style={styles.rankingList}>
                  {bundle.ranking.map((item, index) => (
                    <View key={item.id} style={styles.rankingRow}>
                      <View style={styles.rankingLeft}>
                        <View
                          style={[
                            styles.rankingIndex,
                            index === 0 && styles.rankingIndexFirst,
                            index === 1 && styles.rankingIndexSecond,
                            index === 2 && styles.rankingIndexThird,
                          ]}
                        >
                          <Text style={styles.rankingIndexText}>{index + 1}</Text>
                        </View>
                        <View style={styles.rankingCopy}>
                          <Text style={styles.rankingName}>{item.patientName}</Text>
                          <Text style={styles.rankingMeta}>
                            {item.streak} · {item.objective}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.rankingRight}>
                        <Text style={styles.rankingValue}>{item.adherence}%</Text>
                        <View style={styles.rankingProgressWrap}>
                          <ProgressBar value={item.adherence} tone="default" />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyRanking}>
                  Nenhum paciente vinculado ainda. Os rankings aparecem quando houver registros.
                </Text>
              )}
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
  metricCard: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    minWidth: 180,
    flexGrow: 1,
    minHeight: 76,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
    fontWeight: '500',
  },
  metricValue: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '900',
  },
  metricValueDefault: {
    color: patientTheme.colors.text,
  },
  metricValueHighRisk: {
    color: patientTheme.colors.danger,
  },
  metricValueAdherence: {
    color: patientTheme.colors.primaryDark,
  },
  metricValueAlerts: {
    color: patientTheme.colors.danger,
  },
  metricValueWeekBlue: {
    color: patientTheme.colors.primaryDark,
  },
  exportSection: {
    gap: 16,
  },
  exportIntro: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
  exportFormatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    backgroundColor: patientTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatChipText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '600',
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
  },
  errorText: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 14,
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
  chartsRow: {
    alignItems: 'stretch',
  },
  chartPanel: {
    flex: 1,
    minWidth: 0,
  },
  chartBox: {
    marginTop: 16,
    flexDirection: 'row',
    minHeight: 210,
  },
  chartAxisY: {
    width: 34,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  axisText: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  chartColumnsWrap: {
    flex: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  chartColumns: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 18,
    paddingHorizontal: 10,
  },
  chartColumnItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartColumnTrack: {
    height: 172,
    width: '72%',
    justifyContent: 'flex-end',
  },
  chartColumnFill: {
    width: '100%',
    borderRadius: 6,
  },
  chartColumnLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  objectiveList: {
    marginTop: 18,
    gap: 12,
  },
  objectiveRow: {
    gap: 6,
  },
  objectiveRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  objectiveRowLabel: {
    color: patientTheme.colors.text,
    fontSize: 12,
  },
  objectiveRowValue: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  objectiveTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: patientTheme.colors.border,
    overflow: 'hidden',
  },
  objectiveFill: {
    height: '100%',
    backgroundColor: '#111827',
  },
  riskLegendList: {
    marginTop: 18,
    gap: 14,
  },
  riskLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskLegendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  riskLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  riskLegendLabel: {
    color: patientTheme.colors.text,
    fontSize: 12,
  },
  riskLegendRight: {
    alignItems: 'flex-end',
  },
  riskLegendValue: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  riskLegendPercent: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  trendSection: {
    gap: 14,
  },
  trendChartWrap: {
    marginTop: 8,
    minHeight: 180,
    position: 'relative',
  },
  trendGrid: {
    position: 'absolute',
    left: 42,
    right: 0,
    top: 20,
    bottom: 26,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  trendLineLayer: {
    position: 'absolute',
    left: 42,
    right: 0,
    top: 20,
    bottom: 26,
  },
  trendPolyline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '18%',
    height: 2,
    backgroundColor: 'transparent',
    transform: [{ rotate: '-2deg' }],
  },
  trendPolylineInner: {
    flex: 1,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  trendPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: patientTheme.colors.primaryDark,
  },
  trendLabelsRow: {
    position: 'absolute',
    left: 36,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendDayLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
  },
  trendLegend: {
    color: patientTheme.colors.primaryDark,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 2,
  },
  trendSummaryRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
  },
  trendSummaryCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: patientTheme.radius.xl,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  trendSummaryGreen: {},
  trendSummaryBlue: {},
  trendSummaryOrange: {},
  trendSummaryLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  trendSummaryValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
  },
  rankingSection: {
    gap: 16,
  },
  rankingList: {
    gap: 12,
  },
  emptyRanking: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rankingRow: {
    minHeight: 66,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankingIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surface,
  },
  rankingIndexFirst: {},
  rankingIndexSecond: {},
  rankingIndexThird: {},
  rankingIndexText: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  rankingCopy: {
    flex: 1,
  },
  rankingName: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rankingMeta: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  rankingRight: {
    width: Platform.OS === 'web' ? 180 : 120,
    alignItems: 'flex-end',
    gap: 8,
  },
  rankingValue: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  rankingProgressWrap: {
    width: '100%',
  },
});
