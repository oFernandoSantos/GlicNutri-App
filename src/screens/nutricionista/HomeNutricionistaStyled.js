import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { supabase } from '../../services/supabaseConfig';
import { patientTheme, patientShadow } from '../../theme/patientTheme';

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function getGreetingMeta(name) {
  const hour = new Date().getHours();
  const firstName = (name || 'Nutricionista').split(' ')[0];

  if (hour < 12) {
    return {
      title: `Bom dia, ${firstName}!`,
      subtitle: 'Seu painel clinico esta pronto para acompanhar a carteira de pacientes.',
    };
  }

  if (hour < 18) {
    return {
      title: `Boa tarde, ${firstName}!`,
      subtitle: 'Revise a carteira ativa e centralize o que precisa de atencao hoje.',
    };
  }

  return {
    title: `Boa noite, ${firstName}!`,
    subtitle: 'Feche o dia com uma visao clara de pacientes ativos e historico arquivado.',
  };
}

export default function HomeNutricionistaStyled({ route, navigation }) {
  const { usuarioLogado } = route.params || {};
  const [loadingPainel, setLoadingPainel] = useState(true);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [carteira, setCarteira] = useState([]);

  const nomeNutri =
    usuarioLogado?.nome_completo_nutri ||
    usuarioLogado?.nome_nutri ||
    'Nutricionista';

  const greetingMeta = useMemo(() => getGreetingMeta(nomeNutri), [nomeNutri]);

  const stats = useMemo(() => {
    const ativos = carteira.filter((item) => item.excluido !== true);
    const excluidos = carteira.filter((item) => item.excluido === true);
    const cidades = new Set(
      ativos.map((item) => item.cidade).filter(Boolean)
    ).size;

    return {
      ativos: ativos.length,
      excluidos: excluidos.length,
      cidades,
      recentes: ativos.slice(0, 3),
    };
  }, [carteira]);

  const insights = useMemo(() => {
    return [
      {
        id: 'ativos',
        title: `${stats.ativos} pacientes ativos acompanhados`,
        text:
          stats.ativos > 0
            ? 'O gerenciamento esta pronto para listar, editar e arquivar com seguranca.'
            : 'Assim que novos pacientes forem cadastrados, eles aparecerao aqui.',
      },
      {
        id: 'cidades',
        title: `${stats.cidades} cidades na carteira`,
        text:
          stats.cidades > 0
            ? 'A distribuicao geografica ajuda a acompanhar o alcance do atendimento.'
            : 'A carteira ainda nao tem pacientes distribuidos por cidade.',
      },
      {
        id: 'arquivados',
        title: `${stats.excluidos} pacientes arquivados`,
        text:
          stats.excluidos > 0
            ? 'Os prontuarios arquivados saem da carteira ativa sem perder o historico.'
            : 'Nenhum paciente foi arquivado ate o momento.',
      },
    ];
  }, [stats]);

  const carregarPainel = useCallback(async () => {
    try {
      setLoadingPainel(true);

      const { data, error } = await supabase
        .from('paciente')
        .select('id_paciente_uuid, nome_completo, cidade, uf, excluido, data_exclusao')
        .order('nome_completo', { ascending: true });

      if (error) throw error;

      setCarteira(data || []);
    } catch (error) {
      console.log('Erro ao carregar painel da nutricionista:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar o painel da nutricionista.');
    } finally {
      setLoadingPainel(false);
    }
  }, []);

  useEffect(() => {
    carregarPainel();

    const unsubscribe = navigation.addListener('focus', () => {
      carregarPainel();
    });

    return unsubscribe;
  }, [navigation, carregarPainel]);

  async function handleLogout() {
    try {
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

  function handleAbrirGerenciamento() {
    navigation.navigate('GerenciarPacientes', { usuarioLogado });
  }

  if (loadingPainel) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
        <Text style={styles.loadingText}>Montando o painel da nutricionista...</Text>
      </View>
    );
  }

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
          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>{greetingMeta.title}</Text>
            <Text style={styles.headerSubtitle}>{greetingMeta.subtitle}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={carregarPainel}
              disabled={loadingPainel}
            >
              <Ionicons name="refresh-outline" size={22} color={patientTheme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <SectionCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.eyebrow}>Painel profissional</Text>
              <Text style={styles.heroValue}>{stats.ativos} pacientes</Text>
            </View>

            <View style={styles.heroBadge}>
              <Ionicons
                name="medkit-outline"
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.heroBadgeText}>Carteira ativa</Text>
            </View>
          </View>

          <Text style={styles.heroHelper}>
            CRN/UF: {usuarioLogado?.crm_numero || 'Nao informado'}
          </Text>
          <Text style={styles.heroHelper}>
            E-mail: {usuarioLogado?.email_acesso || 'Nao informado'}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Arquivados</Text>
              <Text style={styles.metricValue}>{stats.excluidos}</Text>
            </View>

            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Cidades</Text>
              <Text style={styles.metricValue}>{stats.cidades}</Text>
            </View>
          </View>
        </SectionCard>

        <View style={styles.summaryRow}>
          <SectionCard style={styles.summaryCard}>
            <Ionicons name="people-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.summaryLabel}>Ativos</Text>
            <Text style={styles.summaryValue}>{stats.ativos}</Text>
          </SectionCard>

          <SectionCard style={styles.summaryCard}>
            <Ionicons name="archive-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.summaryLabel}>Arquivados</Text>
            <Text style={styles.summaryValue}>{stats.excluidos}</Text>
          </SectionCard>

          <SectionCard style={styles.summaryCard}>
            <Ionicons name="map-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.summaryLabel}>Cidades</Text>
            <Text style={styles.summaryValue}>{stats.cidades}</Text>
          </SectionCard>
        </View>

        <Text style={styles.sectionTitle}>Acoes rapidas</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={handleAbrirGerenciamento}>
            <View style={styles.quickIconWrap}>
              <Ionicons
                name="clipboard-outline"
                size={22}
                color={patientTheme.colors.primaryDark}
              />
            </View>
            <Text style={styles.quickTitle}>Gerenciar pacientes</Text>
            <Text style={styles.quickHelper}>Abrir carteira, editar e arquivar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickCard} onPress={carregarPainel}>
            <View style={styles.quickIconWrap}>
              <Ionicons
                name="pulse-outline"
                size={22}
                color={patientTheme.colors.primaryDark}
              />
            </View>
            <Text style={styles.quickTitle}>Atualizar painel</Text>
            <Text style={styles.quickHelper}>Recarregar indicadores e lista</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Feed de gestao</Text>
        <SectionCard style={styles.feedCard}>
          {insights.map((item, index) => (
            <View key={item.id} style={styles.insightRow}>
              <View style={styles.insightRail}>
                <View style={styles.insightDot} />
                {index < insights.length - 1 ? <View style={styles.insightLine} /> : null}
              </View>

              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{item.title}</Text>
                <Text style={styles.insightText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </SectionCard>

        <Text style={styles.sectionTitle}>Pacientes em destaque</Text>
        {stats.recentes.length > 0 ? (
          stats.recentes.map((paciente) => (
            <TouchableOpacity
              key={paciente.id_paciente_uuid}
              style={styles.exploreCard}
              onPress={handleAbrirGerenciamento}
            >
              <View style={styles.exploreIcon}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={patientTheme.colors.primaryDark}
                />
              </View>
              <View style={styles.exploreCopy}>
                <Text style={styles.exploreTitle}>{paciente.nome_completo}</Text>
                <Text style={styles.exploreText}>
                  {paciente.cidade || 'Cidade nao informada'}
                  {paciente.uf ? ` / ${paciente.uf}` : ''}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={patientTheme.colors.textMuted}
              />
            </TouchableOpacity>
          ))
        ) : (
          <SectionCard>
            <Text style={styles.emptyTitle}>Nenhum paciente ativo por enquanto</Text>
            <Text style={styles.emptyText}>
              Assim que a carteira ganhar movimento, os destaques aparecem aqui.
            </Text>
          </SectionCard>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loadingLogout}
        >
          {loadingLogout ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.logoutButtonText}>Sair da conta</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {loadingLogout ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
          <Text style={styles.overlayText}>Encerrando sessao...</Text>
        </View>
      ) : null}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: patientTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: patientTheme.colors.textMuted,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    padding: patientTheme.spacing.screen,
    paddingBottom: 36,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: patientTheme.colors.textMuted,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  refreshButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroCard: {
    marginTop: 22,
  },
  eyebrow: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroValue: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  heroBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  heroHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  metricRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  metricPill: {
    flex: 1,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    backgroundColor: patientTheme.colors.backgroundSoft,
    ...patientShadow,
  },
  metricLabel: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  summaryRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minHeight: 110,
  },
  summaryLabel: {
    marginTop: 10,
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 18,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickCard: {
    width: '48%',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    ...patientShadow,
  },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  quickHelper: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  feedCard: {
    gap: 10,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  insightRail: {
    width: 18,
    alignItems: 'center',
  },
  insightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: patientTheme.colors.primary,
  },
  insightLine: {
    flex: 1,
    width: 2,
    marginTop: 6,
    backgroundColor: patientTheme.colors.border,
  },
  insightContent: {
    flex: 1,
    paddingBottom: 14,
    paddingLeft: 10,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  insightText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
  exploreCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...patientShadow,
  },
  exploreIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  exploreCopy: {
    flex: 1,
  },
  exploreTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  exploreText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
  },
  logoutButton: {
    marginTop: 22,
    marginBottom: 12,
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  logoutButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    marginTop: 12,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
});
