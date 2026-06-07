import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';
import {
  DashboardKpiCard,
  DashboardMiniKpiCard,
  dashboardKpiStyles,
} from '../comum/CartaoKpiDashboard';
import {
  nutriClinicalStatus,
  nutriColors,
  nutriKpiAccents,
} from '../../temas/designSystemNutricionista';
import {
  formatPatientRiskLabelFromBucket,
  resolvePatientRiskBucket,
} from '../../utilitarios/adesaoNutricional';

export { DashboardKpiCard, DashboardMiniKpiCard, dashboardKpiStyles };
export const KPI_ACCENTS = nutriKpiAccents;
export { nutriClinicalStatus };

export function SectionCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function AvatarBadge({ name, size = 48, subtle = false, theme }) {
  const palette = theme?.colors || patientTheme.colors;
  const initials = String(name || 'Paciente')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <View
      style={[
        styles.avatar,
        subtle ? styles.avatarSubtle : styles.avatarStrong,
        subtle && { backgroundColor: palette.primarySoft },
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          subtle && styles.avatarTextSubtle,
          subtle && { color: palette.primaryDark },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, tone = 'default' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          tone === 'danger' && styles.progressDanger,
          tone === 'warning' && styles.progressWarning,
          tone === 'success' && styles.progressSuccess,
          { width: `${clamped}%` },
        ]}
      />
    </View>
  );
}

export function formatPatientRiskLabel(patient) {
  return formatPatientRiskLabelFromBucket(resolvePatientRiskBucket(patient));
}

export function getPatientRiskPalette(patient) {
  const bucket = resolvePatientRiskBucket(patient);
  if (bucket === 'alto') {
    return { label: 'Alto Risco', ...nutriClinicalStatus.critical };
  }
  if (bucket === 'moderado') {
    return { label: 'Médio Risco', ...nutriClinicalStatus.attention };
  }
  return { label: 'Baixo Risco', ...nutriClinicalStatus.normal };
}

export function RiskBadge({ risk }) {
  const normalized = String(risk || '').toLowerCase();
  const isHigh = normalized.includes('alto');
  const isMedium = normalized.includes('moderado') || normalized.includes('medio');

  return (
    <View
      style={[
        styles.riskBadge,
        isHigh ? styles.riskBadgeHigh : isMedium ? styles.riskBadgeMedium : styles.riskBadgeLow,
      ]}
    >
      <Text
        style={[
          styles.riskBadgeText,
          isHigh ? styles.riskTextHigh : isMedium ? styles.riskTextMedium : styles.riskTextLow,
        ]}
      >
        {risk}
      </Text>
    </View>
  );
}

export function MetricCard({ icon, label, value, helper, tone = 'default', style }) {
  return (
    <DashboardKpiCard
      icon={icon}
      label={label}
      value={value}
      accent={tone === 'danger' ? KPI_ACCENTS.red : KPI_ACCENTS.green}
      style={style}
    />
  );
}

export function ActionCard({ icon, title, subtitle, helper, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color={patientTheme.colors.primary} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
      <Text style={styles.actionHelper}>{helper}</Text>
    </TouchableOpacity>
  );
}

/** Mesmos raios do acesso paciente (histórico / seletores). */
const TAB_RADIUS_MAIN = 18;
const TAB_RADIUS_COMPACT = 16;

export function FilterTabs({
  items,
  active,
  onChange,
  compact = false,
  scrollable = false,
  fill = true,
  theme,
}) {
  const tabTheme = theme?.colors || patientTheme.colors;
  const { width: windowWidth } = useWindowDimensions();
  const tabGap = compact ? 7 : 10;
  const minChipWidth = compact ? 68 : 84;
  const tabsFitInRow =
    items.length * minChipWidth + Math.max(0, items.length - 1) * tabGap <= windowWidth - 40;
  const useFill = fill && tabsFitInRow;
  const useHorizontalScroll = scrollable && !useFill;

  const chips = items.map((item) => {
    const selected = active === item.value;
    return (
      <TouchableOpacity
        key={item.value}
        style={[
          styles.tabChip,
          compact && styles.tabChipCompact,
          useFill && styles.tabChipFill,
          useHorizontalScroll && styles.tabChipScrollable,
          selected && styles.tabChipActive,
          selected && {
            backgroundColor: tabTheme.primary,
            borderColor: tabTheme.primary,
          },
        ]}
        onPress={() => onChange(item.value)}
        activeOpacity={0.85}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.tabChipText,
            compact && styles.tabChipTextCompact,
            compact && !selected && styles.tabChipTextCompactIdle,
            selected && styles.tabChipTextActive,
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  });

  const wrapStyle = [
    styles.tabsWrap,
    compact && styles.tabsWrapCompact,
    useHorizontalScroll && styles.tabsWrapScrollable,
  ];

  if (useHorizontalScroll) {
    return (
      <View style={wrapStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {chips}
        </ScrollView>
      </View>
    );
  }

  return <View style={wrapStyle}>{chips}</View>;
}

export function SearchInput({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={18} color={patientTheme.colors.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={patientTheme.colors.textMuted}
      />
      {value ? (
        <TouchableOpacity style={styles.clearButton} onPress={() => onChangeText('')}>
          <Ionicons name="close" size={16} color={patientTheme.colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function BarChartCard({ title, subtitle, data, tone = 'default' }) {
  const maxValue = Math.max(...data.map((item) => Number(item.value) || 0), 1);

  return (
    <SectionCard style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
      <View style={styles.barChartWrap}>
        {data.map((item) => {
          const height = `${Math.max(14, (Number(item.value) / maxValue) * 100)}%`;
          return (
            <View key={item.id} style={styles.barColumn}>
              <Text style={styles.barValue}>{item.value}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    tone === 'danger' && styles.barFillDanger,
                    tone === 'success' && styles.barFillSuccess,
                    { height },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

const GLUCOSE_TARGET_MIN = 70;
const GLUCOSE_TARGET_MAX = 180;

function getGlucosePointColor(value) {
  if (value < GLUCOSE_TARGET_MIN) return patientTheme.colors.info;
  if (value <= GLUCOSE_TARGET_MAX) return patientTheme.colors.primary;
  if (value <= 250) return patientTheme.colors.warning;
  return patientTheme.colors.danger;
}

function normalizeTrendChartSeries(data = []) {
  return (Array.isArray(data) ? data : [])
    .map((item, index) => ({
      id: item?.id || `glucose-${index}`,
      value: Number(item?.value ?? item?.valor_glicose_mgdl) || 0,
      label:
        String(item?.label || '').trim() ||
        String(item?.time || '').trim().slice(0, 5) ||
        `${index + 1}h`,
    }))
    .filter((item) => item.value > 0);
}

function buildGlucoseYScale(values = []) {
  if (!values.length) {
    return { min: GLUCOSE_TARGET_MIN, max: 220, ticks: [70, 110, 150, 190, 220] };
  }

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  let min = Math.min(GLUCOSE_TARGET_MIN, Math.floor(dataMin / 20) * 20 - 20);
  let max = Math.max(220, Math.ceil(dataMax / 40) * 40);
  if (max - min < 100) max = min + 100;

  const step = max - min <= 160 ? 20 : 40;
  const ticks = [];
  for (let tick = min; tick <= max; tick += step) {
    ticks.push(tick);
  }

  const lastTick = ticks[ticks.length - 1];
  if (max - lastTick >= step * 0.6) {
    ticks.push(max);
  } else if (lastTick !== max) {
    ticks[ticks.length - 1] = max;
  }

  return { min, max, ticks };
}

function pickVisibleLabelIndexes(length, maxLabels = 6) {
  if (length <= 1) return [0];
  if (length <= maxLabels) {
    return Array.from({ length }, (_, index) => index);
  }

  const indexes = [];
  for (let index = 0; index < maxLabels; index += 1) {
    indexes.push(Math.round((index / (maxLabels - 1)) * (length - 1)));
  }

  return [...new Set(indexes)];
}

function pickSparseIndexesByX(points, minGap = 48) {
  if (!points.length) return [];
  if (points.length === 1) return [0];

  const indexes = [0];
  let anchor = 0;

  for (let index = 1; index < points.length; index += 1) {
    if (points[index].x - points[anchor].x >= minGap) {
      indexes.push(index);
      anchor = index;
    }
  }

  const lastIndex = points.length - 1;
  if (indexes[indexes.length - 1] !== lastIndex) {
    indexes.push(lastIndex);
  }

  return [...new Set(indexes)];
}

function getPointValuePosition(point, index, points, chartContentWidth, paddingTop, paddingLeft) {
  const previous = points[index - 1];
  const next = points[index + 1];
  const crowded =
    (previous && point.x - previous.x < 42) || (next && next.x - point.x < 42);
  const placeBelow = crowded && index % 2 === 1;

  return {
    left: Math.min(Math.max(point.x - 20, paddingLeft), chartContentWidth - 44),
    top: placeBelow ? point.y + 12 : Math.max(point.y - 30, paddingTop),
  };
}

function clampTrendScrollThumbLeft(thumbLeft, trackWidth, thumbWidth) {
  const maxThumbTravel = Math.max(trackWidth - thumbWidth, 0);
  return Math.min(Math.max(thumbLeft, 0), maxThumbTravel);
}

function thumbLeftToScrollX(thumbLeft, trackWidth, thumbWidth, maxScroll) {
  const maxThumbTravel = Math.max(trackWidth - thumbWidth, 0);
  if (maxThumbTravel <= 0) return 0;
  return (thumbLeft / maxThumbTravel) * maxScroll;
}

export function TrendChartCard({ title, subtitle, data, loading = false }) {
  const chartScrollRef = useRef(null);
  const scrollXRef = useRef(0);
  const scrollMetricsRef = useRef({
    trackWidth: 0,
    thumbWidth: 0,
    maxScroll: 0,
    canScroll: false,
  });
  const thumbDragRef = useRef({ startThumbLeft: 0 });
  const webThumbDragRef = useRef({ active: false, startX: 0, startThumbLeft: 0 });
  const [isThumbDragging, setIsThumbDragging] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const chartHeight = 260;
  const paddingLeft = 52;
  const paddingRight = 16;
  const paddingTop = 28;
  const paddingBottom = 44;
  const pointSpacing = 62;

  const series = useMemo(() => normalizeTrendChartSeries(data), [data]);
  const values = useMemo(() => series.map((item) => item.value), [series]);
  const scale = useMemo(() => buildGlucoseYScale(values), [values]);
  const range = Math.max(scale.max - scale.min, 1);

  const chartContentWidth = Math.max(
    chartWidth,
    paddingLeft + paddingRight + Math.max(series.length - 1, 1) * pointSpacing
  );
  const plotWidth = Math.max(chartContentWidth - paddingLeft - paddingRight, 1);
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const canScroll = chartContentWidth > chartWidth + 1;
  const scrollBarMetrics = useMemo(() => {
    if (!canScroll || chartWidth <= 0) {
      return { trackWidth: 0, thumbWidth: 0, thumbLeft: 0 };
    }

    const trackInset = 12;
    const trackWidth = Math.max(chartWidth - trackInset * 2, 0);
    const thumbWidth = Math.max(Math.round((chartWidth / chartContentWidth) * trackWidth), 28);
    const maxScroll = Math.max(chartContentWidth - chartWidth, 1);
    const maxThumbTravel = Math.max(trackWidth - thumbWidth, 0);
    const thumbLeft = (scrollX / maxScroll) * maxThumbTravel;

    return { trackWidth, thumbWidth, thumbLeft, maxScroll };
  }, [canScroll, chartWidth, chartContentWidth, scrollX]);

  const applyScrollFromThumbLeft = useCallback((thumbLeft) => {
    const { trackWidth, thumbWidth, maxScroll } = scrollMetricsRef.current;
    const nextThumbLeft = clampTrendScrollThumbLeft(thumbLeft, trackWidth, thumbWidth);
    const nextScrollX = thumbLeftToScrollX(nextThumbLeft, trackWidth, thumbWidth, maxScroll);

    chartScrollRef.current?.scrollTo?.({ x: nextScrollX, animated: false });
    scrollXRef.current = nextScrollX;
    setScrollX(nextScrollX);
  }, []);

  const thumbPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => scrollMetricsRef.current.canScroll,
        onMoveShouldSetPanResponder: () => scrollMetricsRef.current.canScroll,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const { trackWidth, thumbWidth, maxScroll } = scrollMetricsRef.current;
          const maxThumbTravel = Math.max(trackWidth - thumbWidth, 0);
          thumbDragRef.current.startThumbLeft =
            maxScroll > 0 ? (scrollXRef.current / maxScroll) * maxThumbTravel : 0;
        },
        onPanResponderMove: (_, gestureState) => {
          if (!scrollMetricsRef.current.canScroll) return;
          applyScrollFromThumbLeft(thumbDragRef.current.startThumbLeft + gestureState.dx);
        },
      }),
    [applyScrollFromThumbLeft]
  );

  useEffect(() => {
    scrollXRef.current = scrollX;
  }, [scrollX]);

  useEffect(() => {
    scrollMetricsRef.current = {
      trackWidth: scrollBarMetrics.trackWidth,
      thumbWidth: scrollBarMetrics.thumbWidth,
      maxScroll: scrollBarMetrics.maxScroll || 0,
      canScroll,
    };
  }, [scrollBarMetrics, canScroll]);

  useEffect(() => {
    setScrollX(0);
    scrollXRef.current = 0;
    chartScrollRef.current?.scrollTo?.({ x: 0, animated: false });
  }, [series.length, chartContentWidth]);

  const handleScrollTrackPress = useCallback(
    (event) => {
      if (!scrollMetricsRef.current.canScroll) return;

      const { trackWidth, thumbWidth } = scrollMetricsRef.current;
      const locationX = Number(event?.nativeEvent?.locationX) || 0;
      const targetThumbLeft = locationX - thumbWidth / 2;
      applyScrollFromThumbLeft(targetThumbLeft);
    },
    [applyScrollFromThumbLeft]
  );

  const getCurrentThumbLeft = useCallback(() => {
    const { trackWidth, thumbWidth, maxScroll } = scrollMetricsRef.current;
    const maxThumbTravel = Math.max(trackWidth - thumbWidth, 0);
    return maxScroll > 0 ? (scrollXRef.current / maxScroll) * maxThumbTravel : 0;
  }, []);

  const handleThumbMouseDown = useCallback(
    (event) => {
      if (Platform.OS !== 'web' || !scrollMetricsRef.current.canScroll) return;

      event?.preventDefault?.();
      event?.stopPropagation?.();

      webThumbDragRef.current = {
        active: true,
        startX: event?.clientX ?? event?.nativeEvent?.pageX ?? 0,
        startThumbLeft: getCurrentThumbLeft(),
      };
      setIsThumbDragging(true);
    },
    [getCurrentThumbLeft]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const handleMouseMove = (event) => {
      if (!webThumbDragRef.current.active) return;

      const deltaX = event.clientX - webThumbDragRef.current.startX;
      applyScrollFromThumbLeft(webThumbDragRef.current.startThumbLeft + deltaX);
    };

    const stopDrag = () => {
      if (!webThumbDragRef.current.active) return;
      webThumbDragRef.current.active = false;
      setIsThumbDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [applyScrollFromThumbLeft]);

  const valueToTop = (value) =>
    paddingTop + (1 - (Math.min(Math.max(value, scale.min), scale.max) - scale.min) / range) * plotHeight;

  const points = useMemo(() => {
    if (!plotWidth || !series.length) return [];
    return series.map((item, index) => {
      const x =
        paddingLeft +
        (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
      const y = valueToTop(item.value);
      return { ...item, x, y, color: getGlucosePointColor(item.value) };
    });
  }, [plotWidth, series, scale.min, scale.max]);

  const targetTop = valueToTop(GLUCOSE_TARGET_MAX);
  const targetHeight = Math.max(valueToTop(GLUCOSE_TARGET_MIN) - targetTop, 8);

  return (
    <SectionCard style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}

      <View style={styles.glucoseLegendRow}>
        <View style={styles.glucoseLegendItem}>
          <View style={[styles.glucoseLegendDot, { backgroundColor: patientTheme.colors.success }]} />
          <Text style={styles.glucoseLegendText}>70–180 mg/dL</Text>
        </View>
        <View style={styles.glucoseLegendItem}>
          <View style={[styles.glucoseLegendDot, { backgroundColor: patientTheme.colors.warning }]} />
          <Text style={styles.glucoseLegendText}>181–250</Text>
        </View>
        <View style={styles.glucoseLegendItem}>
          <View style={[styles.glucoseLegendDot, { backgroundColor: patientTheme.colors.danger }]} />
          <Text style={styles.glucoseLegendText}>acima de 250</Text>
        </View>
      </View>

      {loading && !series.length ? (
        <View style={styles.trendLoading}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
          <Text style={styles.trendLoadingText}>Carregando leituras das últimas 12h...</Text>
        </View>
      ) : !series.length ? (
        <View style={styles.trendEmpty}>
          <Text style={styles.trendEmptyText}>Sem leituras nas últimas 12 horas.</Text>
        </View>
      ) : (
        <View
          style={styles.trendPlotViewport}
          onLayout={({ nativeEvent }) => setChartWidth(nativeEvent.layout.width)}
        >
          <ScrollView
            ref={chartScrollRef}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={Platform.OS !== 'web'}
            scrollEventThrottle={16}
            onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)}
            contentContainerStyle={styles.trendPlotScrollContent}
          >
            <View style={[styles.trendPlot, { width: chartContentWidth, height: chartHeight }]}>
              <View
                style={[
                  styles.trendTargetBand,
                  {
                    top: targetTop,
                    height: targetHeight,
                    left: paddingLeft,
                    width: Math.max(plotWidth, 0),
                  },
                ]}
              />

              {scale.ticks.map((tick, tickIndex) => {
                const top = valueToTop(tick);
                const isTopTick = tickIndex === scale.ticks.length - 1;
                if (isTopTick && top < 18) return null;

                return (
                  <View key={`tick-${tick}`} style={[styles.trendGridLine, { top }]}>
                    <Text style={styles.trendYLabel}>{tick}</Text>
                    <View
                      style={[
                        styles.trendGridRule,
                        { left: paddingLeft, width: Math.max(plotWidth, 0) },
                      ]}
                    />
                  </View>
                );
              })}

              {chartWidth > 0 && points.length > 1
                ? points.slice(1).map((point, index) => {
                    const previous = points[index];
                    const dx = point.x - previous.x;
                    const dy = point.y - previous.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = `${Math.atan2(dy, dx)}rad`;

                    return (
                      <View
                        key={`segment-${point.id}`}
                        style={[
                          styles.trendLineSegment,
                          {
                            backgroundColor: point.color,
                            left: previous.x + dx / 2 - length / 2,
                            top: previous.y + dy / 2 - 1.5,
                            width: length,
                            transform: [{ rotate: angle }],
                          },
                        ]}
                      />
                    );
                  })
                : null}

              {chartWidth > 0
                ? points.map((point, index) => (
                    <View key={point.id}>
                      <View
                        style={[
                          styles.trendPointDot,
                          {
                            backgroundColor: point.color,
                            borderColor: '#FFFFFF',
                            left: point.x - 7,
                            top: point.y - 7,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.trendPointValue,
                          {
                            color: point.color,
                            ...getPointValuePosition(
                              point,
                              index,
                              points,
                              chartContentWidth,
                              paddingTop,
                              paddingLeft
                            ),
                          },
                        ]}
                      >
                        {point.value}
                      </Text>
                    </View>
                  ))
                : null}

              {chartWidth > 0 ? (
                <View style={[styles.trendXLabels, { left: paddingLeft, width: plotWidth }]}>
                  {points.map((point, index) => (
                    <Text
                      key={`label-${point.id}`}
                      style={[
                        styles.trendXLabel,
                        {
                          left: Math.min(
                            Math.max(point.x - paddingLeft - 22, 0),
                            Math.max(plotWidth - 44, 0)
                          ),
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {point.label}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
          {canScroll ? (
            <View style={styles.trendScrollBarWrap}>
              <View style={[styles.trendScrollBarTrack, { width: scrollBarMetrics.trackWidth }]}>
                <Pressable
                  style={styles.trendScrollBarTrackPress}
                  onPress={handleScrollTrackPress}
                />
                <View
                  style={[
                    styles.trendScrollBarThumbHit,
                    {
                      width: scrollBarMetrics.thumbWidth,
                      left: scrollBarMetrics.thumbLeft,
                    },
                    Platform.OS === 'web' && styles.trendScrollBarThumbHitWeb,
                    Platform.OS === 'web' && isThumbDragging && styles.trendScrollBarThumbHitDragging,
                  ]}
                  onMouseDown={handleThumbMouseDown}
                  {...thumbPanResponder.panHandlers}
                >
                  <View style={styles.trendScrollBarThumb} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}

export const nutriDesktopStyles = StyleSheet.create({
  pageGap: {
    width: '100%',
    alignSelf: 'stretch',
    gap: patientTheme.spacing.lg,
  },
  desktopColumns: {
    gap: 14,
  },
  desktopRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 14,
  },
  desktopColMain: {
    flex: 1.25,
  },
  desktopColSide: {
    flex: 0.9,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  sectionHelper: {
    marginTop: patientTheme.spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.card,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStrong: {
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  avatarSubtle: {
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  avatarText: {
    color: patientTheme.colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  avatarTextSubtle: {
    color: patientTheme.colors.primaryDark,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: patientTheme.colors.primary,
  },
  progressDanger: {
    backgroundColor: patientTheme.colors.danger,
  },
  progressWarning: {
    backgroundColor: patientTheme.colors.warning,
  },
  progressSuccess: {
    backgroundColor: patientTheme.colors.success,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  riskBadgeHigh: {
    backgroundColor: nutriClinicalStatus.critical.bg,
    borderWidth: 1,
    borderColor: nutriClinicalStatus.critical.border,
  },
  riskBadgeMedium: {
    backgroundColor: nutriClinicalStatus.attention.bg,
    borderWidth: 1,
    borderColor: nutriClinicalStatus.attention.border,
  },
  riskBadgeLow: {
    backgroundColor: nutriClinicalStatus.normal.bg,
    borderWidth: 1,
    borderColor: nutriClinicalStatus.normal.border,
  },
  riskBadgeText: {
    fontWeight: '800',
    fontSize: 12,
  },
  riskTextHigh: {
    color: nutriClinicalStatus.critical.text,
  },
  riskTextMedium: {
    color: nutriClinicalStatus.attention.text,
  },
  riskTextLow: {
    color: nutriClinicalStatus.normal.text,
  },
  metricCard: {
    minHeight: 140,
  },
  metricDanger: {
    borderColor: '#f5dddd',
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconDanger: {
    backgroundColor: '#fff1f1',
  },
  metricLabel: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  metricHelper: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  actionCard: {
    flex: 1,
    minHeight: 164,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.card,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  actionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  actionHelper: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
  },
  tabsWrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 10,
    width: '100%',
  },
  tabsWrapCompact: {
    gap: 7,
  },
  tabsWrapScrollable: {
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  tabsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  tabChip: {
    minHeight: 42,
    borderRadius: TAB_RADIUS_MAIN,
    paddingHorizontal: 6,
    paddingVertical: 12,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  tabChipCompact: {
    minHeight: 36,
    borderRadius: TAB_RADIUS_COMPACT,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderColor: patientTheme.colors.surfaceBorder,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tabChipFill: {
    flex: 1,
    minWidth: 0,
  },
  tabChipScrollable: {
    flexShrink: 0,
  },
  tabChipActive: {
    backgroundColor: patientTheme.colors.primary,
    borderColor: patientTheme.colors.primary,
  },
  tabChipText: {
    fontSize: 12,
    color: patientTheme.colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabChipTextCompact: {
    fontSize: 12,
  },
  tabChipTextCompactIdle: {
    color: patientTheme.colors.textMuted,
  },
  tabChipTextActive: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
  },
  searchWrap: {
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: patientTheme.spacing.lg,
    ...patientShadow,
  },
  searchInput: {
    flex: 1,
    color: patientTheme.colors.text,
    paddingHorizontal: 10,
    fontSize: 15,
  },
  clearButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: patientTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 320,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  chartSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
  },
  barChartWrap: {
    marginTop: 18,
    minHeight: 176,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  barTrack: {
    width: '100%',
    maxWidth: 48,
    height: 118,
    backgroundColor: patientTheme.colors.border,
    borderRadius: 20,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: patientTheme.colors.primary,
    borderRadius: 20,
  },
  barFillDanger: {
    backgroundColor: patientTheme.colors.danger,
  },
  barFillSuccess: {
    backgroundColor: patientTheme.colors.primary,
  },
  barLabel: {
    marginTop: 10,
    fontSize: 12,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  glucoseLegendRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  glucoseLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glucoseLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  glucoseLegendText: {
    fontSize: 11,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  trendPlotViewport: {
    marginTop: 12,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    overflow: 'hidden',
  },
  trendPlotScrollContent: {
    flexGrow: 1,
  },
  trendPlot: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  trendScrollBarWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  trendScrollBarTrack: {
    position: 'relative',
    height: 14,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#D9E2EC',
    overflow: 'hidden',
  },
  trendScrollBarTrackPress: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    zIndex: 1,
  },
  trendScrollBarThumbHit: {
    position: 'absolute',
    top: 0,
    height: 14,
    justifyContent: 'center',
    zIndex: 2,
  },
  trendScrollBarThumbHitWeb: {
    cursor: 'grab',
    userSelect: 'none',
  },
  trendScrollBarThumbHitDragging: {
    cursor: 'grabbing',
  },
  trendScrollBarThumb: {
    height: 6,
    width: '100%',
    borderRadius: 999,
    backgroundColor: patientTheme.colors.textMuted,
  },
  trendTargetBand: {
    position: 'absolute',
    backgroundColor: '#F0F4F8',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  trendGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendYLabel: {
    width: 46,
    fontSize: 11,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
    textAlign: 'right',
    paddingRight: 8,
  },
  trendGridRule: {
    height: 1,
    backgroundColor: patientTheme.colors.border,
  },
  trendLineSegment: {
    position: 'absolute',
    height: 3,
    borderRadius: 999,
    opacity: 0.85,
  },
  trendPointDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  trendPointValue: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 32,
    textAlign: 'center',
  },
  trendXLabels: {
    position: 'absolute',
    bottom: 6,
    height: 24,
  },
  trendXLabel: {
    position: 'absolute',
    width: 44,
    fontSize: 11,
    fontWeight: '700',
    color: patientTheme.colors.text,
    textAlign: 'center',
  },
  trendLoading: {
    marginTop: 16,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  trendLoadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
  },
  trendEmpty: {
    marginTop: 16,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  trendEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: patientTheme.colors.textMuted,
  },
});
