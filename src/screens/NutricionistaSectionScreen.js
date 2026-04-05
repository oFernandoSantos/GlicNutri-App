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
import { nutritionistSectionContent } from '../data/nutritionistDashboardData';

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

export default function NutricionistaSectionScreen({ route, navigation }) {
  const { usuarioLogado } = route.params || {};
  const [menuVisible, setMenuVisible] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);

  const nomeNutri =
    usuarioLogado?.nome_completo_nutri ||
    usuarioLogado?.nome_nutri ||
    'Nutricionista';

  const crnNutri = usuarioLogado?.crm_numero || 'Nao informado';
  const emailNutri = usuarioLogado?.email_acesso || 'Sem e-mail cadastrado';
  const conteudo =
    nutritionistSectionContent[route?.name] || nutritionistSectionContent.NutricionistaAgenda;

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

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      {menuVisible ? (
        <NutricionistaDrawer
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={(screen) => navigation.navigate(screen, { usuarioLogado })}
          onLogout={handleLogout}
          currentRoute={route?.name}
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
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.professionalName}>{`Dra. ${nomeNutri}`}</Text>
            <Text style={styles.professionalMeta}>{`CRN ${crnNutri}`}</Text>
          </View>

          <View style={styles.headerActions}>
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

        <View style={styles.headerToolbar}>
          <TouchableOpacity style={styles.inlineLogout} onPress={handleLogout}>
            {loadingLogout ? (
              <ActivityIndicator color="#d96666" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color="#d96666" />
                <Text style={styles.inlineLogoutText}>Sair</Text>
              </>
            )}
          </TouchableOpacity>
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

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('HomeNutricionista', { usuarioLogado })}
        >
          <Text style={styles.primaryButtonText}>Voltar ao dashboard</Text>
        </TouchableOpacity>

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
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  professionalName: {
    fontSize: 26,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  professionalMeta: {
    marginTop: 8,
    fontSize: 15,
    color: patientTheme.colors.textMuted,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: patientTheme.colors.surface,
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
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  headerToolbar: {
    marginTop: 14,
    alignItems: 'flex-start',
  },
  inlineLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#fff4f4',
  },
  inlineLogoutText: {
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
  primaryButton: {
    marginTop: 20,
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  listFooter: {
    height: 8,
  },
});
