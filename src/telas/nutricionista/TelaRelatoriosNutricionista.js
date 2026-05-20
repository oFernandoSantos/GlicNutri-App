import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  BarChartCard,
  ProgressBar,
  SectionCard,
  TrendChartCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import { nutritionistReportsMock } from '../../dados/dadosNutricionistaMock';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

function ExportCard({ icon, title, helper }) {
  return (
    <TouchableOpacity style={styles.exportCard} activeOpacity={0.9}>
      <View style={styles.exportIcon}>
        <Ionicons name={icon} size={20} color={patientTheme.colors.primaryDark} />
      </View>
      <Text style={styles.exportTitle}>{title}</Text>
      <Text style={styles.exportHelper}>{helper}</Text>
    </TouchableOpacity>
  );
}

export default function TelaRelatoriosNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Relatorios"
      subtitle="Inteligencia rapida da carteira para priorizacao clinica e acompanhamento."
      showTabBar={route?.name === 'NutricionistaRelatorios'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <View>
          <Text style={nutriDesktopStyles.sectionTitle}>Exportacoes</Text>
          <Text style={nutriDesktopStyles.sectionHelper}>
            Saidas prontas para compartilhar com a equipe ou revisar na rotina da clinica.
          </Text>
        </View>

        <View style={styles.exportRow}>
          <ExportCard icon="document-text-outline" title="Relatorio Geral" helper="Panorama da carteira, consultas e risco." />
          <ExportCard icon="analytics-outline" title="Adesao" helper="Evolucao semanal de engajamento e consistencia." />
          <ExportCard icon="warning-outline" title="Risco" helper="Mapa de alertas metabolicos e prioridades clinicas." />
        </View>

        <View style={[nutriDesktopStyles.desktopRow, styles.chartRow]}>
          <BarChartCard
            title="Pacientes por objetivo"
            subtitle="Volume atual da carteira por objetivo principal."
            data={nutritionistReportsMock.objectiveDistribution}
            tone="success"
          />
          <BarChartCard
            title="Distribuicao de risco"
            subtitle="Alto, moderado e baixo risco no momento."
            data={nutritionistReportsMock.riskDistribution}
            tone="danger"
          />
        </View>

        <TrendChartCard
          title="Tendencia de adesao semanal"
          subtitle="Media consolidada de registros e cumprimento do plano."
          data={nutritionistReportsMock.weeklyAdherence}
        />

        <SectionCard>
          <Text style={styles.rankingTitle}>Ranking de adesao</Text>
          <Text style={styles.rankingHelper}>Pacientes mais engajados nas ultimas semanas.</Text>

          <View style={styles.rankingList}>
            {nutritionistReportsMock.ranking.map((item, index) => (
              <View key={item.id} style={styles.rankingRow}>
                <View style={styles.rankingIndex}>
                  <Text style={styles.rankingIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.rankingCopy}>
                  <Text style={styles.rankingName}>{item.patientName}</Text>
                  <Text style={styles.rankingStreak}>{item.streak}</Text>
                </View>
                <View style={styles.rankingScore}>
                  <Text style={styles.rankingScoreValue}>{item.adherence}%</Text>
                  <ProgressBar value={item.adherence} tone="success" />
                </View>
              </View>
            ))}
          </View>
        </SectionCard>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  exportRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  exportCard: {
    flex: 1,
    minHeight: 146,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  exportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  exportHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  chartRow: {
    alignItems: 'stretch',
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  rankingHelper: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  rankingList: {
    marginTop: 16,
    gap: 12,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    ...patientShadow,
  },
  rankingIndex: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingIndexText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  rankingCopy: {
    flex: 1,
  },
  rankingName: {
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  rankingStreak: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
  },
  rankingScore: {
    width: Platform.OS === 'web' ? 180 : 120,
    gap: 8,
  },
  rankingScoreValue: {
    textAlign: 'right',
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
});
