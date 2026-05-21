import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

const SECTION_META = {
  patient: {
    icon: 'person-outline',
    accent: patientTheme.colors.primarySoft,
    iconColor: patientTheme.colors.primaryDark,
  },
  clinical: {
    icon: 'pulse-outline',
    accent: patientTheme.colors.surfaceMuted,
    iconColor: patientTheme.colors.text,
  },
  pharmacology: {
    icon: 'medkit-outline',
    accent: patientTheme.colors.surfaceMuted,
    iconColor: patientTheme.colors.text,
  },
};

export function ProfileDataSectionCard({
  sectionKey,
  title,
  helper,
  previewLines = [],
  badge,
  open,
  onToggle,
  hideHeader = false,
  children,
}) {
  const meta = SECTION_META[sectionKey] || SECTION_META.patient;

  return (
    <View style={styles.sectionCard}>
      {hideHeader ? (
        <View style={styles.bodyNoHeader}>{children}</View>
      ) : (
        <>
          <TouchableOpacity activeOpacity={0.78} onPress={onToggle} style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: meta.accent }]}>
              <Ionicons name={meta.icon} size={22} color={meta.iconColor} />
            </View>

            <View style={styles.copy}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{title}</Text>
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.helper}>{helper}</Text>

              {!open && previewLines.length ? (
                <View style={styles.previewWrap}>
                  {previewLines.slice(0, 3).map((line) => (
                    <Text key={`${sectionKey}-${line}`} style={styles.previewLine} numberOfLines={1}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={patientTheme.colors.primaryDark}
            />
          </TouchableOpacity>

          {open ? <View style={styles.body}>{children}</View> : null}
        </>
      )}
    </View>
  );
}

export function TherapyQuickStrip({ options, plansByCategory, onPressCategory }) {
  return (
    <View style={styles.therapyQuickCard}>
      <Text style={styles.therapyQuickTitle}>Insulinas em uso</Text>
      <Text style={styles.therapyQuickHelper}>
        Toque para revisar doses e horarios. Seu nutricionista usa esses dados no plano.
      </Text>

      <View style={styles.therapyQuickRow}>
        {options.map((option) => {
          const plan = plansByCategory[option.value];
          const configured = Boolean(plan?.marca);
          const doseText = plan?.dose ? `${plan.dose} ${plan.dose_unidade || 'UI'}` : '';
          const usageText = plan?.frequencia_uso || plan?.modo_uso || plan?.status || '';
          const scheduleCount = (plan?.tabela_horarios || []).filter((item) =>
            String(item?.horario || item?.dose || item?.dia_semana).trim()
          ).length;
          const metaText = configured
            ? [usageText, doseText, scheduleCount ? `${scheduleCount} horario(s)` : '']
                .filter(Boolean)
                .join(' • ') || 'Plano salvo'
            : 'Toque para preencher';

          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.82}
              onPress={() => onPressCategory(option.value)}
              style={[
                styles.therapyQuickItem,
                configured ? styles.therapyQuickItemActive : styles.therapyQuickItemEmpty,
              ]}
            >
              <Text style={styles.therapyQuickLabel}>{option.label}</Text>
              <Text style={styles.therapyQuickValue} numberOfLines={2}>
                {configured ? plan.marca : 'Configurar'}
              </Text>
              <Text style={styles.therapyQuickMeta} numberOfLines={3}>
                {metaText}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function isMissingValue(value) {
  const text = String(value || '').trim().toLowerCase();
  return !text || text === 'não informado' || text === 'nao informado';
}

export function IntroHealthOverviewCard({ rows = [] }) {
  return (
    <View style={styles.healthInfoCard}>
      <Text style={styles.healthInfoTitle}>Informações de Saúde</Text>

      <View style={styles.healthInfoList}>
        {rows.map((row) => (
          <View key={row.label} style={styles.healthInfoRow}>
            <Text style={styles.healthInfoLabel}>{row.label}</Text>
            <Text
              style={[
                styles.healthInfoValue,
                isMissingValue(row.value) ? styles.healthInfoValueMuted : null,
              ]}
              numberOfLines={2}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProfileSectionHub({ items, onSelect }) {
  return (
    <View style={styles.hubRow}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.82}
          onPress={() => onSelect(item.key)}
          style={[styles.hubPill, item.active ? styles.hubPillActive : null]}
        >
          <Ionicons
            name={item.icon}
            size={16}
            color={item.active ? patientTheme.colors.primaryDark : patientTheme.colors.textMuted}
          />
          <Text style={[styles.hubPillText, item.active ? styles.hubPillTextActive : null]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  helper: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  previewWrap: {
    gap: 3,
    marginTop: 10,
  },
  previewLine: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  body: {
    marginTop: 4,
  },
  bodyNoHeader: {
    marginTop: 0,
  },
  therapyQuickCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginTop: 14,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  therapyQuickTitle: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  therapyQuickHelper: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  therapyQuickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  therapyQuickItem: {
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 108,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  therapyQuickItemActive: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primary,
  },
  therapyQuickItemEmpty: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderStyle: 'dashed',
  },
  therapyQuickLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  therapyQuickValue: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 6,
  },
  therapyQuickMeta: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  hubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  hubPill: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hubPillActive: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primary,
  },
  hubPillText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  hubPillTextActive: {
    color: patientTheme.colors.primaryDark,
  },
  healthInfoCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginTop: 14,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  healthInfoTitle: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
  },
  healthInfoList: {
    gap: 10,
  },
  healthInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  healthInfoLabel: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    paddingRight: 12,
  },
  healthInfoValue: {
    color: patientTheme.colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    maxWidth: '55%',
    textAlign: 'right',
  },
  healthInfoValueMuted: {
    color: patientTheme.colors.textMuted,
  },
});
