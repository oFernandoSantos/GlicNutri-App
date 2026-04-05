import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseConfig';
import { patientTheme, patientShadow } from '../theme/patientTheme';
import NutricionistaDrawer from '../components/NutricionistaDrawer';
import BarraAbasNutricionista, {
  NUTRI_TAB_BAR_SPACE,
} from '../components/BarraAbasNutricionista';
import { nutritionistDashboardData } from '../data/nutritionistDashboardData';

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function getInitials(name) {
  return (name || 'Nutricionista')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || '')
    .join('');
}

function getRiskTone(risk) {
  if (risk === 'Alto Risco') {
    return {
      backgroundColor: '#fff1f1',
      textColor: '#c35a5a',
    };
  }

  if (risk === 'Medio Risco') {
    return {
      backgroundColor: '#fff8e8',
      textColor: '#b5842f',
    };
  }

  return {
    backgroundColor: '#eefaf4',
    textColor: '#3c9a67',
  };
}

export default function NutricionistaHomeDashboardScreen({ route, navigation }) {
  const { usuarioLogado } = route.params || {};
  const [menuVisible, setMenuVisible] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);

  const nomeNutri =
    usuarioLogado?.nome_completo_nutri ||
    usuarioLogado?.nome_nutri ||
    'Nutricionista';

  const crnNutri = usuarioLogado?.crm_numero || '12345';

  const menuPills = useMemo(
    () => [
      { label: 'Dashboard', route: 'HomeNutricionista' },
      { label: 'Gerenciamento de Pacientes', route: 'GerenciarPacientes' },
      { label: 'Agenda', route: 'NutricionistaAgenda' },
      { label: 'Mensagens', route: 'NutricionistaMensagens' },
      { label: 'Relatorios', route: 'NutricionistaRelatorios' },
    ],
    []
  );

  async function handleLogout() {
    try {
      setMenuVisible(false);
      setLoadingLogout(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.log('Erro ao encerrar sessao:', error.message);
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.log('Erro inesperado no logout:', error);
      Alert.alert('Erro', 'Nao foi possivel sair da conta.');
    } finally {
      setLoadingLogout(false);
    }
  }

  function handleNavigate(routeName) {
    navigation.navigate(routeName, { usuarioLogado });
  }

  const priorityTone = getRiskTone(nutritionistDashboardData.priorityPatient.risk);

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      {menuVisible ? (
        <NutricionistaDrawer
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          currentRoute={route?.name || 'HomeNutricionista'}
          userName={`Dra. ${nomeNutri}`}
          userSubtitle={`CRN ${crnNutri}`}
        />
      ) : null}

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
        <SectionCard style={styles.professionalCard}>
          <View style={styles.professionalTop}>
            <View style={styles.professionalCopy}>
              <Text style={styles.professionalName}>{`Dra. ${nomeNutri}`}</Text>
              <Text style={styles.professionalMeta}>{`CRN ${crnNutri}`}</Text>
            </View>

            <View style={styles.professionalActions}>
              <TouchableOpacity style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(nomeNutri)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuVisible(true)}
                disabled={loadingLogout}
              >
                <Ionicons name="menu-outline" size={24} color={patientTheme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.professionalFooter}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              {loadingLogout ? (
                <ActivityIndicator color="#d96666" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#d96666" />
                  <Text style={styles.logoutButtonText}>Sair</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SectionCard>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.menuPills}
        >
          {menuPills.map((item) => {
            const ativo = item.route === 'HomeNutricionista';

            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.menuPill, ativo && styles.menuPillActive]}
                onPress={() => handleNavigate(item.route)}
              >
                <Text style={[styles.menuPillText, ativo && styles.menuPillTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.indicatorsGrid}>
          {nutritionistDashboardData.indicators.map((item) => (
            <SectionCard key={item.id} style={styles.indicatorCard}>
              <View style={styles.indicatorIconWrap}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={patientTheme.colors.primaryDark}
                />
              </View>
              <Text style={styles.indicatorLabel}>{item.label}</Text>
              <Text style={styles.indicatorValue}>{item.value}</Text>
            </SectionCard>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Atalhos de gestao</Text>
        <View style={styles.shortcutsGrid}>
          {nutritionistDashboardData.shortcuts.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.shortcutCard}
              onPress={() => handleNavigate(item.route)}
            >
              <View style={styles.shortcutIconWrap}>
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={patientTheme.colors.primaryDark}
                />
              </View>
              <Text style={styles.shortcutTitle}>{item.title}</Text>
              <Text style={styles.shortcutSubtitle}>{item.subtitle}</Text>
              <Text style={styles.shortcutHelper}>{item.helper}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Pacientes prioritarios</Text>
        <View style={[styles.priorityCard, { backgroundColor: '#fff6f6' }]}>
          <View style={styles.priorityHeader}>
            <View>
              <Text style={styles.priorityName}>
                {nutritionistDashboardData.priorityPatient.name}
              </Text>
              <View
                style={[
                  styles.riskBadge,
                  { backgroundColor: priorityTone.backgroundColor },
                ]}
              >
                <Text style={[styles.riskBadgeText, { color: priorityTone.textColor }]}>
                  {nutritionistDashboardData.priorityPatient.risk}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.priorityAction}
              onPress={() => handleNavigate('GerenciarPacientes')}
            >
              <Ionicons name="arrow-forward" size={18} color={patientTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.priorityMetrics}>
            <View style={styles.priorityMetricPill}>
              <Text style={styles.priorityMetricLabel}>Alertas ativos</Text>
              <Text style={styles.priorityMetricValue}>
                {nutritionistDashboardData.priorityPatient.alerts}
              </Text>
            </View>

            <View style={styles.priorityMetricPill}>
              <Text style={styles.priorityMetricLabel}>Adesao</Text>
              <Text style={styles.priorityMetricValue}>
                {nutritionistDashboardData.priorityPatient.adherence}
              </Text>
            </View>
          </View>

          <Text style={styles.priorityUpdate}>
            Ultima atualizacao: {nutritionistDashboardData.priorityPatient.updatedAt}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Atualizacoes recentes</Text>
          <TouchableOpacity onPress={() => handleNavigate('GerenciarPacientes')}>
            <Text style={styles.sectionAction}>Ver Todos</Text>
          </TouchableOpacity>
        </View>

        {nutritionistDashboardData.recentUpdates.map((item) => {
          const tone = getRiskTone(item.risk);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.updateCard}
              onPress={() => handleNavigate('GerenciarPacientes')}
            >
              <View style={styles.updateTopRow}>
                <Text style={styles.updateName}>{item.name}</Text>
                <Text style={styles.updateTime}>{item.updatedAt}</Text>
              </View>

              <View style={styles.updateMetaRow}>
                <View style={[styles.riskBadge, { backgroundColor: tone.backgroundColor }]}>
                  <Text style={[styles.riskBadgeText, { color: tone.textColor }]}>
                    {item.risk}
                  </Text>
                </View>

                <Text style={styles.updateInlineText}>{`${item.alerts} alertas`}</Text>
                <Text style={styles.updateInlineText}>{`${item.age} anos`}</Text>
                <Text style={styles.updateInlineText}>{`Adesao ${item.adherence}`}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.listFooter} />
      </ScrollView>

      <BarraAbasNutricionista
        navigation={navigation}
        rotaAtual={route?.name || 'HomeNutricionista'}
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
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  professionalCard: {
    marginTop: 14,
  },
  professionalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  professionalCopy: {
    flex: 1,
    paddingRight: 12,
  },
  professionalName: {
    fontSize: 28,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  professionalMeta: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: patientTheme.colors.textMuted,
  },
  professionalActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 19,
    fontWeight: '700',
  },
  menuButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  professionalFooter: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#fff4f4',
  },
  logoutButtonText: {
    marginLeft: 8,
    color: '#d96666',
    fontWeight: '700',
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
  indicatorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  indicatorCard: {
    width: '48%',
    minHeight: 132,
  },
  indicatorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorLabel: {
    marginTop: 14,
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  indicatorValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  shortcutsGrid: {
    gap: 12,
  },
  shortcutCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  shortcutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  shortcutSubtitle: {
    marginTop: 6,
    fontSize: 15,
    color: patientTheme.colors.text,
  },
  shortcutHelper: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: patientTheme.colors.textMuted,
  },
  priorityCard: {
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    borderWidth: 1.5,
    borderColor: '#f6dede',
  },
  priorityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priorityName: {
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  priorityAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: patientTheme.radius.pill,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  priorityMetrics: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  priorityMetricPill: {
    flex: 1,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    backgroundColor: '#ffffff',
  },
  priorityMetricLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: patientTheme.colors.textMuted,
  },
  priorityMetricValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  priorityUpdate: {
    marginTop: 16,
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionAction: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  updateCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    marginBottom: 10,
    ...patientShadow,
  },
  updateTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateName: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  updateTime: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  updateMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  updateInlineText: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  listFooter: {
    height: 8,
  },
});
