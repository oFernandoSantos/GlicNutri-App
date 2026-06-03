import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand, radius } from '../../temas/designSystem';

export const KPI_ACCENTS = {
  blue: brand.info,
  green: brand.greenDark,
  greenBright: brand.green,
  orange: '#F97316',
  red: brand.danger,
  pink: '#F472B6',
  purple: '#8B5CF6',
  gray: '#94A3B8',
  yellow: brand.warning,
};

function trendArrow(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

export function DashboardKpiCard({
  icon = 'stats-chart-outline',
  accent = KPI_ACCENTS.green,
  label,
  value,
  trend = 'stable',
  invertTrend = false,
  style,
}) {
  const trendUp = trend === 'up';
  const trendDown = trend === 'down';
  const positive = invertTrend ? trendDown : trendUp;
  const negative = invertTrend ? trendUp : trendDown;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <Text style={[styles.trend, positive && styles.trendUp, negative && styles.trendDown]}>
          {trendArrow(trend)}
        </Text>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
    </View>
  );
}

export function DashboardMiniKpiCard({
  label,
  value,
  helper,
  accent = KPI_ACCENTS.green,
  style,
  labelStyle,
  valueStyle,
  helperStyle,
  accentBarStyle,
}) {
  return (
    <View style={[styles.miniCard, style]}>
      <Text style={[styles.miniLabel, labelStyle]}>{label}</Text>
      <Text style={[styles.miniValue, { color: accent }, valueStyle]}>{value}</Text>
      {helper ? <Text style={[styles.miniHelper, helperStyle]}>{helper}</Text> : null}
      <View style={[styles.miniAccentBar, { backgroundColor: accent }, accentBarStyle]} />
    </View>
  );
}

export const dashboardKpiStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cell: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    minWidth: 150,
    flexGrow: 1,
  },
  miniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniCell: {
    flex: 1,
    minWidth: 120,
  },
});

const styles = StyleSheet.create({
  card: {
    minWidth: 150,
    minHeight: 92,
    padding: 14,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  trend: {
    fontSize: 14,
    fontWeight: '800',
    color: brand.slateMuted,
  },
  trendUp: {
    color: brand.greenDark,
  },
  trendDown: {
    color: brand.danger,
  },
  label: {
    fontSize: 13,
    color: brand.slateMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  value: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  accentBar: {
    marginTop: 8,
    width: 28,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  miniCard: {
    flex: 1,
    minWidth: 120,
    minHeight: 72,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
  },
  miniLabel: {
    color: brand.slateMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  miniValue: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  miniHelper: {
    marginTop: 2,
    color: brand.slateMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  miniAccentBar: {
    marginTop: 8,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
});
