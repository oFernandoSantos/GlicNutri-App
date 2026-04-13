import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { patientTheme, patientShadow } from '../../theme/patientTheme';
import BotaoVoltar from '../../components/BotaoVoltar';
import BarraAbasNutricionista, {
  NUTRI_TAB_BAR_SPACE,
} from '../../components/BarraAbasNutricionista';
import { nutritionistSectionContent } from '../../data/nutritionistDashboardData';

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export default function NutricionistaSectionScreen({ route, navigation }) {
  const { usuarioLogado } = route.params || {};
  const emailNutri = usuarioLogado?.email_acesso || 'Sem e-mail cadastrado';
  const conteudo =
    nutritionistSectionContent[route?.name] || nutritionistSectionContent.NutricionistaAgenda;

  const menuPills = useMemo(
    () => [
      { label: 'Agenda', route: 'NutricionistaAgenda' },
      { label: 'Gerenciamento de Pacientes', route: 'GerenciarPacientes' },
      { label: 'Inicio', route: 'HomeNutricionista' },
      { label: 'Mensagens', route: 'NutricionistaMensagens' },
      { label: 'Relatorios', route: 'NutricionistaRelatorios' },
    ],
    []
  );

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.webScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.headerRow}>
          <BotaoVoltar
            navigation={navigation}
            fallbackRoute="HomeNutricionista"
            fallbackParams={{ usuarioLogado }}
            preferFallback
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.menuPills}
        >
          {menuPills.map((item) => {
            const ativo = route?.name === item.route;

            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.menuPill, ativo && styles.menuPillActive]}
                onPress={() => navigation.navigate(item.route, { usuarioLogado })}
              >
                <Text style={[styles.menuPillText, ativo && styles.menuPillTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <SectionCard style={styles.heroCard}>
          <Text style={styles.eyebrow}>{conteudo.heroLabel}</Text>
          <Text style={styles.heroValue}>{conteudo.heroValue}</Text>
          <Text style={styles.heroHelper}>{conteudo.subtitle}</Text>
          <Text style={styles.heroEmail}>{emailNutri}</Text>
        </SectionCard>

        <Text style={styles.sectionTitle}>Visao da area</Text>
        <SectionCard>
          {conteudo.bullets.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </SectionCard>

        <View style={styles.listFooter} />
      </ScrollView>

      <BarraAbasNutricionista
        navigation={navigation}
        rotaAtual={route?.name}
        usuarioLogado={usuarioLogado}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: patientTheme.colors.background,
  },
  containerWeb: {
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    padding: patientTheme.spacing.screen,
    paddingBottom: 40 + NUTRI_TAB_BAR_SPACE,
  },
  webScroll: {
    height: '100%',
    maxHeight: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  webScrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  headerRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  menuPills: {
    paddingVertical: 18,
    gap: 10,
  },
  menuPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    ...patientShadow,
  },
  menuPillActive: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  menuPillText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  menuPillTextActive: {
    color: patientTheme.colors.primaryDark,
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroCard: {
    marginTop: 4,
  },
  eyebrow: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroValue: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  heroHelper: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
  heroEmail: {
    marginTop: 12,
    fontSize: 13,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
    backgroundColor: patientTheme.colors.primary,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
  listFooter: {
    height: 8,
  },
});
