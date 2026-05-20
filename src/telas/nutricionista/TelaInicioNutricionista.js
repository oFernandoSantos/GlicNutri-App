import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  ActionCard,
  AvatarBadge,
  MetricCard,
  ProgressBar,
  RiskBadge,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  nutritionistDesktopMetrics,
  nutritionistPatientsMock,
  nutritionistQuickActions,
  nutritionistRecentUpdates,
} from '../../dados/dadosNutricionistaMock';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

export default function NutricionistaHomeDashboardScreen({ route, navigation }) {
  const { usuarioLogado } = route.params || {};

  const priorityPatients = useMemo(() => {
    return [...nutritionistPatientsMock]
      .sort((a, b) => {
        if (b.alerts !== a.alerts) return b.alerts - a.alerts;
        return a.adherence - b.adherence;
      })
      .slice(0, 4);
  }, []);

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Dashboard da clinica"
      subtitle="Gestao rapida da carteira, risco metabolico e proximas acoes do dia."
      showTabBar={route?.name === 'HomeNutricionista'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <View style={styles.metricGrid}>
          {nutritionistDesktopMetrics.map((item) => (
            <MetricCard
              key={item.id}
              icon={item.icon}
              label={item.label}
              value={item.value}
              helper={item.helper}
              tone={item.tone}
              style={styles.metricCell}
            />
          ))}
        </View>

        <View>
          <Text style={nutriDesktopStyles.sectionTitle}>Acoes rapidas</Text>
          <Text style={nutriDesktopStyles.sectionHelper}>
            Acesse os pontos mais usados da rotina sem navegar por varios niveis.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {nutritionistQuickActions.map((item) => (
            <ActionCard
              key={item.id}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              helper={item.helper}
              onPress={() => navigation.navigate(item.route, { usuarioLogado })}
            />
          ))}
        </View>

        <View style={nutriDesktopStyles.desktopRow}>
          <View style={styles.mainColumn}>
            <Text style={nutriDesktopStyles.sectionTitle}>Pacientes prioritarios</Text>
            <Text style={nutriDesktopStyles.sectionHelper}>
              Ordenados por alerta clinico e menor adesao recente.
            </Text>

            <View style={styles.priorityList}>
              {priorityPatients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  style={[
                    styles.priorityCard,
                    patient.risk === 'Alto' && styles.priorityCardAlert,
                  ]}
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.navigate('NutriProntuarioPaciente', {
                      usuarioLogado,
                      pacienteId: patient.id,
                    })
                  }
                >
                  <View style={styles.priorityHeader}>
                    <View style={styles.priorityIdentity}>
                      <AvatarBadge name={patient.name} size={52} />
                      <View style={styles.priorityCopy}>
                        <View style={styles.priorityTopRow}>
                          <Text style={styles.priorityName}>{patient.name}</Text>
                          <RiskBadge risk={`${patient.risk} risco`} />
                        </View>
                        <Text style={styles.priorityMeta}>
                          {patient.specialtyTag} · IMC {patient.bmi} · {patient.age} anos
                        </Text>
                        <Text style={styles.priorityNote}>{patient.notes}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.priorityStats}>
                    <View style={styles.priorityPill}>
                      <Text style={styles.priorityPillLabel}>Alertas</Text>
                      <Text style={styles.priorityPillValue}>{patient.alerts}</Text>
                    </View>
                    <View style={styles.priorityPill}>
                      <Text style={styles.priorityPillLabel}>Glicose atual</Text>
                      <Text style={styles.priorityPillValue}>{patient.latestGlucose} mg/dL</Text>
                    </View>
                    <View style={styles.priorityPill}>
                      <Text style={styles.priorityPillLabel}>Consulta</Text>
                      <Text style={styles.priorityPillValue}>{patient.appointmentTime}</Text>
                    </View>
                  </View>

                  <View style={styles.adherenceBlock}>
                    <View style={styles.adherenceRow}>
                      <Text style={styles.adherenceLabel}>Adesao geral</Text>
                      <Text style={styles.adherenceValue}>{patient.adherence}%</Text>
                    </View>
                    <ProgressBar
                      value={patient.adherence}
                      tone={patient.adherence < 70 ? 'danger' : patient.adherence < 80 ? 'warning' : 'success'}
                    />
                    <Text style={styles.adherenceHint}>{patient.trendText}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sideColumn}>
            <Text style={nutriDesktopStyles.sectionTitle}>Atualizacoes recentes</Text>
            <Text style={nutriDesktopStyles.sectionHelper}>
              Pacientes que preencheram o app ou responderam hoje.
            </Text>

            <SectionCard style={styles.timelineCard}>
              {nutritionistRecentUpdates.map((item, index) => (
                <View key={item.id} style={[styles.timelineItem, index !== nutritionistRecentUpdates.length - 1 && styles.timelineItemBorder]}>
                  <View style={styles.timelineTimeWrap}>
                    <Text style={styles.timelineTime}>{item.time}</Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    <Text style={styles.timelineDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </SectionCard>
          </View>
        </View>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCell: {
    width: Platform.OS === 'web' ? '24%' : '48%',
    minWidth: 180,
    flexGrow: 1,
  },
  actionsRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  mainColumn: {
    flex: 1.2,
  },
  sideColumn: {
    flex: 0.82,
  },
  priorityList: {
    marginTop: 14,
    gap: 12,
  },
  priorityCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  priorityCardAlert: {
    borderColor: '#f0d2d2',
    backgroundColor: '#faf5f5',
  },
  priorityHeader: {
    gap: 12,
  },
  priorityIdentity: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  priorityCopy: {
    flex: 1,
    minWidth: 0,
  },
  priorityTopRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 8,
  },
  priorityName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  priorityMeta: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  priorityNote: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  priorityStats: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priorityPill: {
    flex: 1,
    minWidth: 120,
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    ...patientShadow,
  },
  priorityPillLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  priorityPillValue: {
    marginTop: 6,
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  adherenceBlock: {
    marginTop: 16,
    gap: 8,
  },
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adherenceLabel: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  adherenceValue: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  adherenceHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  timelineCard: {
    marginTop: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  timelineItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: patientTheme.colors.border,
  },
  timelineTimeWrap: {
    width: 56,
  },
  timelineTime: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
    fontSize: 13,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    color: patientTheme.colors.text,
    fontWeight: '800',
    lineHeight: 20,
  },
  timelineDetail: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
});
