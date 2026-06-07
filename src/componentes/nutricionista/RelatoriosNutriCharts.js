import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { nutriColors } from '../../temas/designSystemNutricionista';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export const CHART_PALETTE = {
  green: nutriColors.primary,
  greenDark: nutriColors.primaryDark,
  greenSoft: nutriColors.primaryLight,
  yellow: nutriColors.warning,
  orange: '#F97316',
  medOrange: '#FB923C',
  red: nutriColors.danger,
  pink: '#EC4899',
  blue: nutriColors.info,
  blueSoft: '#E0F2FE',
  purple: '#8B5CF6',
  purpleSoft: '#EDE9FE',
  gray: '#94A3B8',
  graySoft: '#F1F5F9',
};

export const RISK_COLORS = [CHART_PALETTE.red, CHART_PALETTE.orange, CHART_PALETTE.green];

/** Frequência de uso — ordem: diário, semanal, esporádico, inativo */
export const ENGAGEMENT_FREQ_COLORS_BY_ID = {
  diario: CHART_PALETTE.green,
  semanal: CHART_PALETTE.blue,
  esporadico: CHART_PALETTE.orange,
  inativo: CHART_PALETTE.gray,
};

export const FREQ_COLORS = [
  ENGAGEMENT_FREQ_COLORS_BY_ID.diario,
  ENGAGEMENT_FREQ_COLORS_BY_ID.semanal,
  ENGAGEMENT_FREQ_COLORS_BY_ID.esporadico,
  ENGAGEMENT_FREQ_COLORS_BY_ID.inativo,
];

/** Faixas de registros/paciente — mesma linguagem de cor do engajamento (sem laranja = esporádico) */
export const RECORD_BUCKET_COLORS_BY_ID = {
  r0: ENGAGEMENT_FREQ_COLORS_BY_ID.inativo,
  'r1-20': ENGAGEMENT_FREQ_COLORS_BY_ID.semanal,
  'r21-50': ENGAGEMENT_FREQ_COLORS_BY_ID.diario,
  'r51-100': CHART_PALETTE.greenDark,
  r100: CHART_PALETTE.red,
};

/** Ordem: 0, 1-20, 21-50, 51-100, 100+ */
export const RECORD_BUCKET_COLORS = [
  RECORD_BUCKET_COLORS_BY_ID.r0,
  RECORD_BUCKET_COLORS_BY_ID['r1-20'],
  RECORD_BUCKET_COLORS_BY_ID['r21-50'],
  RECORD_BUCKET_COLORS_BY_ID['r51-100'],
  RECORD_BUCKET_COLORS_BY_ID.r100,
];
export const GLUCOSE_COLORS = [CHART_PALETTE.pink, CHART_PALETTE.green, CHART_PALETTE.orange];
export const INSULIN_COLORS = [CHART_PALETTE.purple, '#C4B5FD'];
export const OBJECTIVE_COLORS = [
  CHART_PALETTE.green,
  CHART_PALETTE.blue,
  CHART_PALETTE.orange,
  CHART_PALETTE.purple,
  CHART_PALETTE.yellow,
  CHART_PALETTE.gray,
];
export const MEAL_TYPE_COLORS = [
  CHART_PALETTE.blue,
  CHART_PALETTE.green,
  CHART_PALETTE.orange,
  '#63B3ED',
  CHART_PALETTE.purple,
  CHART_PALETTE.gray,
];

export const TREND_COLORS = {
  adherence: nutriColors.primary,
  glucose: CHART_PALETTE.orange,
  tir: nutriColors.info,
};

export function sumChartValues(items = []) {
  return items.reduce((sum, item) => sum + Number(item.value || 0), 0);
}

export function chartPercent(value, total) {
  return total ? Math.round((Number(value) / total) * 100) : 0;
}

function buildConicGradient(items = [], colors = [], activeId = null, dimOpacity = 0.28) {
  const total = sumChartValues(items);
  if (!total) return null;
  let acc = 0;
  return items
    .map((item, index) => {
      const pct = (Number(item.value) / total) * 100;
      const start = acc;
      acc += pct;
      const base = colors[index] || CHART_PALETTE.green;
      const faded = activeId && activeId !== item.id;
      const color = faded ? `${base}${Math.round(dimOpacity * 255).toString(16).padStart(2, '0')}` : base;
      return `${color} ${start}% ${acc}%`;
    })
    .join(', ');
}

function useChartFadeIn() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [opacity, scale]);

  return { opacity, scale };
}

const CHART_PRESS_DELAY_MS = 160;

function ChartTooltip({ visible, title, value, helper }) {
  if (!visible) return null;
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipTitle}>{title}</Text>
      <Text style={styles.tooltipValue}>{value}</Text>
      {helper ? <Text style={styles.tooltipHelper}>{helper}</Text> : null}
    </View>
  );
}

function AnimatedChartShell({ children, style }) {
  const { opacity, scale } = useChartFadeIn();
  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>
  );
}

export function InteractiveDonutChart({
  items,
  colors,
  centerLabel,
  centerValue,
  size = 136,
  formatTooltip,
}) {
  const [activeId, setActiveId] = useState(null);
  const focusId = activeId;

  const safeItems = useMemo(
    () => (items || []).map((item) => ({ ...item, value: Number(item.value) || 0 })),
    [items]
  );
  const total = sumChartValues(safeItems);
  const gradient = buildConicGradient(safeItems, colors, focusId);
  const ringStyle =
    Platform.OS === 'web' && gradient ? { background: `conic-gradient(${gradient})` } : null;

  const focusItem = safeItems.find((item) => item.id === focusId);
  const displayCenterValue = focusItem ? focusItem.value : centerValue;
  const displayCenterLabel = focusItem ? focusItem.label : centerLabel;

  return (
    <AnimatedChartShell style={styles.donutWrap}>
      <View style={styles.donutVisualCol}>
        <View style={[styles.donutRing, { width: size, height: size, borderRadius: size / 2 }, ringStyle]}>
          {!ringStyle ? (
            <View
              style={[
                styles.donutFallbackTrack,
                { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 },
              ]}
            >
              {safeItems.map((item, index) => {
                const dimmed = focusId && focusId !== item.id;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.donutFallbackSegment,
                      {
                        backgroundColor: colors[index] || CHART_PALETTE.green,
                        flex: Math.max(item.value, total ? item.value : 1),
                        opacity: dimmed ? 0.5 : 1,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ) : null}
          <View
            style={[
              styles.donutHole,
              {
                width: size * 0.56,
                height: size * 0.56,
                borderRadius: (size * 0.56) / 2,
              },
            ]}
          >
            {displayCenterValue != null ? (
              <Text style={styles.donutCenterValue}>{displayCenterValue}</Text>
            ) : null}
            {displayCenterLabel ? (
              <Text style={styles.donutCenterLabel} numberOfLines={2}>
                {displayCenterLabel}
              </Text>
            ) : null}
          </View>
        </View>
        <ChartTooltip
          visible={Boolean(focusItem)}
          title={focusItem?.label}
          value={
            focusItem
              ? formatTooltip
                ? formatTooltip(focusItem, total)
                : `${focusItem.value} (${chartPercent(focusItem.value, total)}%)`
              : ''
          }
        />
      </View>
      <View style={styles.donutLegend}>
        {safeItems.map((item, index) => {
          const selected = focusId === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.legendRow, selected && styles.legendRowActive]}
              delayPressIn={CHART_PRESS_DELAY_MS}
              onPress={() => setActiveId(selected ? null : item.id)}
            >
              <View style={styles.legendLeft}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors[index] || CHART_PALETTE.green },
                    selected && styles.legendDotActive,
                  ]}
                />
                <Text style={[styles.legendLabel, selected && styles.legendLabelActive]}>{item.label}</Text>
              </View>
              <Text style={styles.legendValue}>
                {item.value} · {chartPercent(item.value, total)}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </AnimatedChartShell>
  );
}

export function InteractiveHorizontalBarChart({ items, colors, emptyLabel = 'Sem dados no período' }) {
  const [activeId, setActiveId] = useState(null);
  const focusId = activeId;
  const safeItems = items?.length ? items : [];
  const max = Math.max(...safeItems.map((item) => Number(item.value) || 0), 1);
  const total = sumChartValues(safeItems);

  if (!safeItems.length) {
    return <Text style={styles.emptyChartText}>{emptyLabel}</Text>;
  }

  return (
    <AnimatedChartShell style={styles.horizontalBars}>
      {safeItems.map((item, index) => {
        const value = Number(item.value) || 0;
        const widthPct = value <= 0 ? 0 : Math.max(8, (value / max) * 100);
        const color = colors?.[index] || colors || CHART_PALETTE.green;
        const selected = focusId === item.id;
        return (
          <Pressable
            key={item.id}
            style={[styles.horizontalBarRow, selected && styles.barRowActive]}
            delayPressIn={CHART_PRESS_DELAY_MS}
            onPress={() => setActiveId(selected ? null : item.id)}
          >
            <View style={styles.horizontalBarHeader}>
              <Text style={[styles.horizontalBarLabel, selected && styles.labelActive]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.horizontalBarValue}>
                {value} ({chartPercent(value, total)}%)
              </Text>
            </View>
            <View style={styles.horizontalBarTrack}>
              {widthPct > 0 ? (
                <View
                  style={[
                    styles.horizontalBarFill,
                    {
                      width: `${widthPct}%`,
                      backgroundColor: color,
                      opacity: focusId && !selected ? 0.35 : 1,
                    },
                  ]}
                />
              ) : null}
            </View>
            {selected ? (
              <Text style={styles.barTooltipInline}>
                {item.label}: {value} paciente{value === 1 ? '' : 's'} ({chartPercent(value, total)}%)
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </AnimatedChartShell>
  );
}

export function InteractiveProgressChart({ items, colors, valueSuffix = 'pacientes', percentBase }) {
  const [activeId, setActiveId] = useState(null);
  const focusId = activeId;
  const safeItems = items?.length ? items : [];
  const max = Math.max(...safeItems.map((item) => Number(item.value) || 0), 1);
  const total = sumChartValues(safeItems);
  const base = Number(percentBase) > 0 ? Number(percentBase) : total;

  if (!safeItems.length) {
    return <Text style={styles.emptyChartText}>Sem dados no período</Text>;
  }

  return (
    <AnimatedChartShell style={styles.progressList}>
      {safeItems.map((item, index) => {
        const value = Number(item.value) || 0;
        const color = colors?.[index] || CHART_PALETTE.green;
        const selected = focusId === item.id;
        const widthPct = max > 0 ? (value / max) * 100 : 0;
        const barWidth = value <= 0 ? 0 : Math.max(widthPct, 6);
        return (
          <Pressable
            key={item.id}
            style={[styles.progressRow, selected && styles.barRowActive]}
            delayPressIn={CHART_PRESS_DELAY_MS}
            onPress={() => setActiveId(selected ? null : item.id)}
          >
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, selected && styles.labelActive]}>{item.label}</Text>
              <Text style={styles.progressValue}>
                {value} {valueSuffix} · {item.percent ?? chartPercent(value, base)}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              {barWidth > 0 ? (
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${barWidth}%`,
                      backgroundColor: color,
                      opacity: focusId && !selected ? 0.35 : 1,
                    },
                  ]}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </AnimatedChartShell>
  );
}

const LINE_CHART = {
  laneTop: 22,
  dotSize: 12,
  dotSizeActive: 17,
  dotHaloSize: 22,
  dotHaloSizeActive: 28,
  strokeWidth: 3,
  hitSize: 30,
  yAxisWidth: 50,
  tickLength: 5,
};

function withAlpha(hex, alpha = '40') {
  if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) return hex;
  return `${hex}${alpha}`;
}

function clampAxisLabelTop(y, plotHeight, labelHeight = 12) {
  const height = plotHeight || 160;
  const top = y - labelHeight / 2;
  return Math.max(2, Math.min(height - labelHeight - 2, top));
}

function formatDefaultAxisValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return String(Math.round(num));
}

function computeLineChartLayout(items = [], plotWidth = 0, plotHeight = 0) {
  if (!items.length || plotWidth < 8 || plotHeight < 8) {
    return { plotPoints: [], yTicks: [], min: 0, max: 1 };
  }

  const values = items.map((item) => Number(item.value) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const laneHeight = Math.max(plotHeight - LINE_CHART.laneTop, 1);

  const valueToY = (value) => {
    const normalized = ((Number(value) - min) / range) * 82 + 8;
    return LINE_CHART.laneTop + laneHeight * (1 - normalized / 100);
  };

  const plotPoints = items.map((item, index) => {
    const value = Number(item.value) || 0;
    const normalized = ((value - min) / range) * 82 + 8;
    const xRatio = index / Math.max(items.length - 1, 1);
    return {
      ...item,
      index,
      value,
      normalized,
      xRatio,
      x: xRatio * plotWidth,
      y: valueToY(value),
    };
  });

  const tickCount = 4;
  const yTicks = [];
  for (let index = 0; index <= tickCount; index += 1) {
    const value = Math.round(min + (range * index) / tickCount);
    yTicks.push({ value, y: valueToY(value) });
  }

  return { plotPoints, yTicks, min, max };
}

function computeLinePlotPoints(items = [], plotWidth = 0, plotHeight = 0) {
  return computeLineChartLayout(items, plotWidth, plotHeight).plotPoints;
}

function buildLineSegments(plotPoints = []) {
  if (plotPoints.length < 2) return [];

  return plotPoints.slice(0, -1).map((point, index) => {
    const next = plotPoints[index + 1];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    return {
      key: `${point.id}-${next.id}`,
      x1: point.x,
      y1: point.y - LINE_CHART.strokeWidth / 2,
      length,
      angle,
    };
  });
}

function LineChartSvgLayer({ plotPoints, plotLayout, yTicks, color }) {
  if (Platform.OS !== 'web' || plotPoints.length < 1 || plotLayout.width < 8) return null;

  const polylinePoints = plotPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const gridBottom = plotLayout.height - 2;

  return (
    <View style={styles.lineSvgLayer} pointerEvents="none">
      <svg
        width={plotLayout.width}
        height={plotLayout.height}
        viewBox={`0 0 ${plotLayout.width} ${plotLayout.height}`}
        style={{ overflow: 'visible' }}
      >
        {yTicks.map((tick, index) => (
          <line
            key={`grid-h-${index}`}
            x1="0"
            y1={tick.y}
            x2={plotLayout.width}
            y2={tick.y}
            stroke="#CBD5E1"
            strokeWidth="1"
          />
        ))}
        {plotPoints.map((point) => (
          <line
            key={`grid-v-${point.id}`}
            x1={point.x}
            y1={LINE_CHART.laneTop}
            x2={point.x}
            y2={gridBottom}
            stroke="#CBD5E1"
            strokeWidth="1"
          />
        ))}
        {plotPoints.length >= 2 ? (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth={LINE_CHART.strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
    </View>
  );
}

function NativeLineChartGrid({ plotPoints, yTicks, plotHeight }) {
  if (Platform.OS === 'web') return null;

  return (
    <>
      {yTicks.map((tick, index) => (
        <View key={`grid-h-${index}`} style={[styles.lineGridLineH, { top: tick.y }]} />
      ))}
      {plotPoints.map((point) => (
        <View
          key={`grid-v-${point.id}`}
          style={[styles.lineGridLineV, { left: point.x, top: LINE_CHART.laneTop, bottom: 2 }]}
        />
      ))}
    </>
  );
}

function LineChartPlotAxisTicks({ yTicks, plotPoints }) {
  return (
    <>
      {yTicks.map((tick, index) => (
        <View key={`plot-yt-${index}`} style={[styles.linePlotTickY, { top: tick.y }]} />
      ))}
      {plotPoints.map((point) => (
        <View key={`plot-xt-${point.id}`} style={[styles.linePlotTickX, { left: point.x }]} />
      ))}
    </>
  );
}

function LineChartYAxis({ yTicks, formatAxisValue, axisUnit, plotHeight }) {
  const formatTick = formatAxisValue || formatDefaultAxisValue;
  const height = plotHeight || 160;

  if (!yTicks.length) return <View style={styles.lineYAxis} />;

  return (
    <View style={[styles.lineYAxis, { height }]}>
      {axisUnit ? (
        <Text style={styles.lineYUnit} numberOfLines={1}>
          {axisUnit}
        </Text>
      ) : null}
      {yTicks.map((tick, index) => (
        <View
          key={`y-${index}-${tick.value}`}
          style={[styles.lineYTickRow, { top: clampAxisLabelTop(tick.y, height) }]}
        >
          <View style={styles.lineYTickMark} />
          <Text style={styles.lineYLabel} numberOfLines={1}>
            {formatTick(tick.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function InteractiveLineChart({
  items,
  color = CHART_PALETTE.green,
  formatValue = (value) => String(value ?? '—'),
  formatAxisValue,
  axisUnit,
  showAllLabels = false,
}) {
  const [activeId, setActiveId] = useState(null);
  const [plotLayout, setPlotLayout] = useState({ width: 0, height: 0 });
  const focusId = activeId;

  const safeItems = items?.length ? items : [{ id: 'empty', label: '—', value: 0 }];
  const chartLayout = computeLineChartLayout(safeItems, plotLayout.width, plotLayout.height);
  const plotPoints = chartLayout.plotPoints;
  const yTicks = chartLayout.yTicks;
  const lineSegments = Platform.OS === 'web' ? [] : buildLineSegments(plotPoints);
  const focusItem = plotPoints.find((item) => item.id === focusId);

  return (
    <AnimatedChartShell style={styles.lineWrap}>
      <View style={styles.lineChartBody}>
        <LineChartYAxis
          yTicks={yTicks}
          formatAxisValue={formatAxisValue}
          axisUnit={axisUnit}
          plotHeight={plotLayout.height}
        />
        <View style={styles.linePlotArea}>
          <View
            style={styles.linePlot}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setPlotLayout({ width, height });
            }}
          >
            <NativeLineChartGrid plotPoints={plotPoints} yTicks={yTicks} plotHeight={plotLayout.height} />
            <LineChartPlotAxisTicks yTicks={yTicks} plotPoints={plotPoints} />
            <LineChartSvgLayer
              plotPoints={plotPoints}
              plotLayout={plotLayout}
              yTicks={yTicks}
              color={color}
            />
            {lineSegments.map((segment) => (
              <View
                key={segment.key}
                style={[
                  styles.lineSegment,
                  {
                    left: segment.x1,
                    top: segment.y1,
                    width: segment.length,
                    backgroundColor: color,
                    height: LINE_CHART.strokeWidth,
                    transform: [{ rotate: `${segment.angle}deg` }],
                  },
                ]}
              />
            ))}
            {plotPoints.map((point) => {
              const selected = focusId === point.id;
              const dotSize = selected ? LINE_CHART.dotSizeActive : LINE_CHART.dotSize;
              const haloSize = selected ? LINE_CHART.dotHaloSizeActive : LINE_CHART.dotHaloSize;
              const showLabel = selected || showAllLabels;
              const hitOffset = LINE_CHART.hitSize / 2;

              return (
                <Pressable
                  key={point.id}
                  style={[
                    styles.linePointHit,
                    {
                      left: point.x - hitOffset,
                      top: point.y - hitOffset,
                      width: LINE_CHART.hitSize,
                      height: LINE_CHART.hitSize,
                    },
                  ]}
                  delayPressIn={CHART_PRESS_DELAY_MS}
                  onPress={() => setActiveId(selected ? null : point.id)}
                >
                  {showLabel ? (
                    <View style={[styles.linePointValueBadge, selected && styles.linePointValueBadgeActive]}>
                      <Text style={[styles.linePointValueFixed, selected && styles.linePointValueActive]}>
                        {formatValue(point.value)}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.lineDotHalo,
                      {
                        left: hitOffset - haloSize / 2,
                        top: hitOffset - haloSize / 2,
                        width: haloSize,
                        height: haloSize,
                        borderRadius: haloSize / 2,
                        backgroundColor: withAlpha(color, selected ? '44' : '28'),
                        borderColor: withAlpha(color, selected ? '88' : '55'),
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.lineDotFixed,
                      {
                        left: hitOffset - dotSize / 2,
                        top: hitOffset - dotSize / 2,
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: color,
                        borderColor: '#fff',
                        borderWidth: selected ? 3 : 2.5,
                        zIndex: selected ? 4 : 3,
                        ...(Platform.OS === 'web'
                          ? { boxShadow: `0 1px 5px ${withAlpha(color, '88')}` }
                          : { elevation: selected ? 4 : 2 }),
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.lineLabelsRow, { height: 28 }]}>
            {plotPoints.map((point) => (
              <View
                key={`tick-${point.id}`}
                style={[
                  styles.lineXLabelWrap,
                  plotLayout.width > 0
                    ? { left: point.x - 18 }
                    : { left: `${point.xRatio * 100}%`, marginLeft: -18 },
                ]}
              >
                <View style={styles.lineXTickMark} />
                <Text style={styles.lineXLabelText} numberOfLines={1}>
                  {point.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <ChartTooltip
        visible={Boolean(focusItem)}
        title={focusItem?.label}
        value={focusItem ? formatValue(focusItem.value) : ''}
        helper="Toque ou passe o mouse nos pontos para detalhes"
      />
    </AnimatedChartShell>
  );
}

const styles = StyleSheet.create({
  emptyChartText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  tooltip: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  tooltipTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  tooltipValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  tooltipHelper: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 4,
  },
  donutWrap: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: 'center',
    gap: 14,
  },
  donutVisualCol: {
    alignItems: 'center',
  },
  donutRing: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 24px rgba(34, 197, 94, 0.15)' }
      : {}),
  },
  donutFallbackTrack: {
    position: 'absolute',
    overflow: 'hidden',
    flexDirection: 'row',
    transform: [{ rotate: '-90deg' }],
  },
  donutFallbackSegment: {
    height: '100%',
  },
  donutHole: {
    backgroundColor: patientTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  donutCenterValue: {
    color: patientTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  donutCenterLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  donutLegend: {
    flex: 1,
    gap: 8,
    minWidth: 160,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  legendRowActive: {
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legendDot: {
    width: 11,
    height: 11,
    borderRadius: 4,
  },
  legendDotActive: {
    transform: [{ scale: 1.15 }],
  },
  legendLabel: {
    color: patientTheme.colors.text,
    fontSize: 12,
    flex: 1,
  },
  legendLabelActive: {
    fontWeight: '800',
  },
  legendValue: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  horizontalBars: {
    gap: 10,
  },
  horizontalBarRow: {
    gap: 6,
    padding: 8,
    borderRadius: 12,
  },
  barRowActive: {
    backgroundColor: CHART_PALETTE.graySoft,
  },
  horizontalBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  horizontalBarLabel: {
    color: patientTheme.colors.text,
    fontSize: 12,
    flex: 1,
  },
  labelActive: {
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  horizontalBarValue: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  horizontalBarTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: CHART_PALETTE.graySoft,
    overflow: 'hidden',
  },
  horizontalBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  barTooltipInline: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
  progressList: {
    gap: 10,
  },
  progressRow: {
    gap: 6,
    padding: 8,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: patientTheme.colors.text,
    fontSize: 12,
  },
  progressValue: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: CHART_PALETTE.graySoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  lineWrap: {
    gap: 8,
  },
  lineChartBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineYAxis: {
    width: LINE_CHART.yAxisWidth,
    position: 'relative',
    minHeight: 160,
    paddingRight: 2,
    paddingTop: 14,
  },
  lineYUnit: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    textAlign: 'right',
    color: patientTheme.colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  lineYTickRow: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 12,
  },
  lineYTickMark: {
    width: LINE_CHART.tickLength,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#94A3B8',
    marginRight: 4,
  },
  lineYLabel: {
    minWidth: 28,
    textAlign: 'right',
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  linePlotArea: {
    flex: 1,
    minWidth: 0,
  },
  linePlot: {
    minHeight: 160,
    position: 'relative',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFC',
  },
  lineGridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#CBD5E1',
    zIndex: 0,
  },
  lineGridLineV: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#CBD5E1',
    zIndex: 0,
  },
  linePlotTickY: {
    position: 'absolute',
    left: 0,
    width: LINE_CHART.tickLength,
    height: 1.5,
    marginTop: -0.75,
    backgroundColor: '#94A3B8',
    zIndex: 2,
  },
  linePlotTickX: {
    position: 'absolute',
    bottom: 0,
    width: 1.5,
    height: LINE_CHART.tickLength,
    marginLeft: -0.75,
    backgroundColor: '#94A3B8',
    zIndex: 2,
  },
  lineSegment: {
    position: 'absolute',
    borderRadius: 2,
    zIndex: 1,
    ...(Platform.OS === 'web' ? { transformOrigin: '0% 50%' } : {}),
  },
  lineSvgLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  linePointHit: {
    position: 'absolute',
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linePointValueBadge: {
    position: 'absolute',
    top: -22,
    minWidth: 52,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  linePointValueBadgeActive: {
    borderColor: '#CBD5E1',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)' } : { elevation: 3 }),
  },
  linePointValueFixed: {
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  lineDotHalo: {
    position: 'absolute',
    zIndex: 2,
  },
  lineDotFixed: {
    position: 'absolute',
    zIndex: 3,
  },
  linePointWrap: {
    position: 'absolute',
    width: 40,
    bottom: 0,
    top: 0,
    marginLeft: -20,
    zIndex: 2,
  },
  linePointValue: {
    position: 'absolute',
    top: 0,
    left: -6,
    right: -6,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  linePointValueActive: {
    color: patientTheme.colors.text,
    fontSize: 11,
  },
  lineLane: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 18,
    bottom: 0,
  },
  lineDot: {
    position: 'absolute',
    borderWidth: 2,
  },
  lineLabelsRow: {
    position: 'relative',
    marginTop: 2,
  },
  lineXLabelWrap: {
    position: 'absolute',
    width: 36,
    alignItems: 'center',
    gap: 3,
  },
  lineXTickMark: {
    width: 1.5,
    height: LINE_CHART.tickLength,
    borderRadius: 1,
    backgroundColor: '#94A3B8',
  },
  lineXLabelText: {
    width: '100%',
    textAlign: 'center',
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  lineLabelAbsolute: {
    position: 'absolute',
    width: 36,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
});
