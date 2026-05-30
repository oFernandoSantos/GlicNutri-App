import React from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';

export function SectionCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function AvatarBadge({ name, size = 48, subtle = false }) {
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
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, subtle && styles.avatarTextSubtle]}>{initials}</Text>
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
    <SectionCard style={[styles.metricCard, tone === 'danger' && styles.metricDanger, style]}>
      <View style={[styles.metricIconWrap, tone === 'danger' && styles.metricIconDanger]}>
        <Ionicons
          name={icon}
          size={18}
          color={tone === 'danger' ? '#c55b5b' : patientTheme.colors.primaryDark}
        />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </SectionCard>
  );
}

export function ActionCard({ icon, title, subtitle, helper, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color={patientTheme.colors.primaryDark} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
      <Text style={styles.actionHelper}>{helper}</Text>
    </TouchableOpacity>
  );
}

export function FilterTabs({ items, active, onChange, compact = false }) {
  return (
    <View style={[styles.tabsWrap, compact && styles.tabsWrapCompact]}>
      {items.map((item) => {
        const selected = active === item.value;
        return (
          <TouchableOpacity
            key={item.value}
            style={[styles.tabChip, selected && styles.tabChipActive, compact && styles.tabChipCompact]}
            onPress={() => onChange(item.value)}
            activeOpacity={0.9}
          >
            <Text style={[styles.tabChipText, selected && styles.tabChipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
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

export function TrendChartCard({ title, subtitle, data }) {
  const values = data.map((item) => Number(item.value) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  const range = Math.max(max - min, 1);

  return (
    <SectionCard style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
      <View style={styles.trendArea}>
        <View style={styles.trendBaseLine} />
        {data.map((item) => {
          const offset = ((Number(item.value) - min) / range) * 90;
          return (
            <View key={item.id} style={styles.trendPointWrap}>
              <Text style={styles.trendValue}>{item.value}</Text>
              <View style={styles.trendLane}>
                <View style={[styles.trendDot, { bottom: `${offset}%` }]} />
              </View>
              <Text style={styles.trendLabel}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

export const nutriDesktopStyles = StyleSheet.create({
  pageGap: {
    gap: 14,
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
    fontSize: 20,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  sectionHelper: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.xl,
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
    backgroundColor: patientTheme.colors.primarySoft,
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
    height: 9,
    borderRadius: 999,
    backgroundColor: '#e3e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  progressDanger: {
    backgroundColor: '#d96767',
  },
  progressWarning: {
    backgroundColor: '#d7a54b',
  },
  progressSuccess: {
    backgroundColor: patientTheme.colors.text,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  riskBadgeHigh: {
    backgroundColor: '#fff0f0',
  },
  riskBadgeMedium: {
    backgroundColor: '#fff8e6',
  },
  riskBadgeLow: {
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  riskBadgeText: {
    fontWeight: '800',
    fontSize: 12,
  },
  riskTextHigh: {
    color: '#c55b5b',
  },
  riskTextMedium: {
    color: '#b4872e',
  },
  riskTextLow: {
    color: patientTheme.colors.text,
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
    backgroundColor: patientTheme.colors.primarySoft,
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
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.primarySoft,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 6,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  tabsWrapCompact: {
    gap: 6,
  },
  tabChip: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  tabChipCompact: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabChipActive: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    elevation: 3,
    shadowColor: patientTheme.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tabChipText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '800',
  },
  tabChipTextActive: {
    color: patientTheme.colors.text,
  },
  searchWrap: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: patientTheme.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    minHeight: 260,
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
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 20,
  },
  barFillDanger: {
    backgroundColor: '#d96767',
  },
  barFillSuccess: {
    backgroundColor: patientTheme.colors.text,
  },
  barLabel: {
    marginTop: 10,
    fontSize: 12,
    textAlign: 'center',
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  trendArea: {
    marginTop: 18,
    minHeight: 176,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  trendBaseLine: {
    position: 'absolute',
    right: 0,
    bottom: 25,
    left: 0,
    height: 1,
    backgroundColor: '#dce4e8',
  },
  trendPointWrap: {
    flex: 1,
    alignItems: 'center',
  },
  trendValue: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  trendLane: {
    width: '100%',
    minHeight: 120,
    position: 'relative',
  },
  trendDot: {
    position: 'absolute',
    left: '50%',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  trendLabel: {
    marginTop: 10,
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
});
