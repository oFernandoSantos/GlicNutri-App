import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BarraAbasPaciente, { PATIENT_TAB_BAR_SPACE } from '../../components/BarraAbasPaciente';
import PatientDrawer from '../../components/PatientDrawer';
import BotaoMenuHamburguer from '../../components/BotaoMenuHamburguer';
import { supabase } from '../../services/supabaseConfig';
import { patientTheme, patientShadow } from '../../theme/patientTheme';
import {
  glucoseSparkline,
  buildHomeInsights,
  getTrendMeta,
} from '../../data/patientExperienceData';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getLatestGlucose,
  getPatientDisplayName,
  getPatientId,
  savePatientAppState,
} from '../../services/patientSupabaseService';
import { syncGooglePatientRecord } from '../../services/googlePatientSync';

function getGreetingMeta(name) {
  const hour = new Date().getHours();
  const firstName = (name || 'Paciente').split(' ')[0];

  if (hour < 12) {
    return {
      title: `Bom dia, ${firstName}!`,
      subtitle: 'Otimo inicio de dia. Vamos manter sua curva estavel.',
    };
  }

  if (hour < 18) {
    return {
      title: `Boa tarde, ${firstName}!`,
      subtitle: 'Seu dia esta no ritmo certo. Vamos acompanhar os proximos passos.',
    };
  }

  return {
    title: `Boa noite, ${firstName}!`,
    subtitle: 'Hora de fechar o dia com escolhas leves e tranquilas.',
  };
}

function Sparkline({ data }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);

  return (
    <View style={styles.sparklineRow}>
      {data.map((value, index) => {
        const height = 20 + ((value - min) / range) * 46;

        return (
          <View key={`${value}-${index}`} style={styles.sparklineTrack}>
            <View style={[styles.sparklineBar, { height }]} />
          </View>
        );
      })}
    </View>
  );
}

function TimeInRangeBar() {
  return (
    <View>
      <View style={styles.rangeBar}>
        <View style={[styles.rangeSegment, styles.rangePrimary, { flex: 80 }]} />
        <View style={[styles.rangeSegment, styles.rangeWarning, { flex: 15 }]} />
        <View style={[styles.rangeSegment, styles.rangeInfo, { flex: 5 }]} />
      </View>

      <View style={styles.rangeLegend}>
        <Text style={styles.rangeLegendText}>80% na meta</Text>
        <Text style={styles.rangeLegendText}>15% acima</Text>
        <Text style={styles.rangeLegendText}>5% abaixo</Text>
      </View>
    </View>
  );
}

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export default function PacienteHomeScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const [paciente, setPaciente] = useState(null);
  const [clinicalObjective, setClinicalObjective] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());
  const [glucoseReadings, setGlucoseReadings] = useState([]);

  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;

  const idPaciente = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const canResolvePatient = useMemo(
    () =>
      Boolean(
        idPaciente ||
        usuarioLogado?.id_paciente_uuid ||
        usuarioLogado?.cpf_paciente ||
        usuarioLogado?.email_pac ||
        usuarioLogado?.email ||
        usuarioLogado?.id
      ),
    [idPaciente, usuarioLogado]
  );

  const nomeBaseUsuario = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);

  async function carregarDados() {
    try {
      setLoading(true);
      if (!canResolvePatient) {
        setPaciente({
          nome_completo: nomeBaseUsuario,
          email_pac: usuarioLogado?.email || null,
        });
        setAppState(createDefaultAppState());
        setClinicalObjective('');
        setGlucoseReadings([]);
        return;
      }

      let experience = await fetchPatientExperience(idPaciente, {
        patientContext: usuarioLogado,
      });

      if (!experience.patient && usuarioLogado?.id) {
        const pacienteSincronizado = await syncGooglePatientRecord(usuarioLogado);

        if (pacienteSincronizado?.id_paciente_uuid) {
          experience = {
            ...experience,
            patient: pacienteSincronizado,
          };
        }
      }

      setPaciente(
        experience.patient || {
          ...usuarioLogado,
          id_paciente_uuid: idPaciente,
          nome_completo: nomeBaseUsuario,
          email_pac: usuarioLogado?.email || null,
        }
      );
      setAppState(experience.appState);
      setClinicalObjective(experience.clinicalObjective);
      setGlucoseReadings(experience.glucoseReadings);
    } catch (error) {
      console.log('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function persistirAppState(nextState) {
    if (!canResolvePatient) {
      setAppState(nextState);
      return;
    }

    const saved = await savePatientAppState({
      patientId: idPaciente,
      objectiveText: clinicalObjective,
      appState: nextState,
      currentPatient: paciente,
      patientContext: usuarioLogado,
    });

    setPaciente(saved.patient || paciente);
    setAppState(saved.appState);
    setClinicalObjective(saved.clinicalObjective || clinicalObjective);
  }

  async function handleLogout() {
    try {
      setMenuVisible(false);
      setSaindo(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.log('Erro ao sair:', error.message);
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.log('Erro inesperado no logout:', error);
      Alert.alert('Erro', 'Nao foi possivel sair da conta.');
    } finally {
      setSaindo(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [idPaciente, canResolvePatient]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarDados();
  };

  const nomeUsuario = paciente?.nome_completo || nomeBaseUsuario;

  const emailUsuario =
    paciente?.email_pac || usuarioLogado?.email_pac || usuarioLogado?.email || null;

  const latestGlucose = getLatestGlucose(glucoseReadings);
  const currentGlucose = latestGlucose?.value || 105;
  const trendMeta = getTrendMeta(currentGlucose);
  const greetingMeta = getGreetingMeta(nomeUsuario);
  const mealEntries = appState?.mealEntries || [];
  const planSections = appState?.planSections || [];
  const waterCount = appState?.waterCount || 0;
  const insights = buildHomeInsights(currentGlucose, mealEntries.length);
  const sparklineData =
    glucoseReadings.length >= 2
      ? glucoseReadings
          .slice(0, 10)
          .reverse()
          .map((item) => item.value)
      : glucoseSparkline;

  const quickActions = [
    {
      id: 'meal',
      label: 'Registrar refeicao',
      helper: 'Foto, texto ou voz',
      icon: 'camera-outline',
      action: () => navigation.navigate('PacienteDiario', { usuarioLogado }),
    },
    {
      id: 'water',
      label: 'Hidratacao',
      helper: `+1 copo (agora ${waterCount})`,
      icon: 'water-outline',
      action: async () => {
        const next = waterCount + 1;
        const nextState = {
          ...appState,
          waterCount: next,
        };

        setAppState(nextState);

        try {
          await persistirAppState(nextState);
          Alert.alert('Hidratacao registrada', `Agora voce tem ${next} copos registrados hoje.`);
        } catch (error) {
          console.log('Erro ao salvar hidratacao:', error);
          Alert.alert('Erro', 'Nao foi possivel salvar a hidratacao agora.');
          setAppState(appState);
        }
      },
    },
    {
      id: 'activity',
      label: 'Atividade fisica',
      helper: 'Registrar treino',
      icon: 'walk-outline',
      action: () => navigation.navigate('PacienteBemEstar', { usuarioLogado }),
    },
    {
      id: 'medication',
      label: 'Medicacao',
      helper: 'Insulina e rotina',
      icon: 'medical-outline',
      action: () =>
        navigation.navigate('PacienteMonitoramento', {
          usuarioLogado,
          openMedication: true,
        }),
    },
  ];

  const exploreCards = [
    {
      title: 'Monitoramento',
      subtitle: 'Grafico do dia, media, variabilidade e GMI.',
      route: 'PacienteMonitoramento',
      icon: 'pulse-outline',
    },
    {
      title: 'Assistente IA',
      subtitle: 'Alertas humanizados e tira-duvidas rapido.',
      route: 'PacienteAssistente',
      icon: 'sparkles-outline',
    },
    {
      title: 'Bem-estar',
      subtitle: 'Sintomas, sono, estresse e comportamento.',
      route: 'PacienteBemEstar',
      icon: 'body-outline',
    },
    {
      title: 'Meu plano',
      subtitle: 'Plano alimentar, substituicoes e canal com a nutri.',
      route: 'PacientePlano',
      icon: 'chatbubbles-outline',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
        <Text style={styles.loadingText}>Montando seu painel de cuidado...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      {menuVisible ? (
        <PatientDrawer
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={(screen) => navigation.navigate(screen, { usuarioLogado })}
          onLogout={handleLogout}
          currentRoute={route?.name || 'HomePaciente'}
          userName={nomeUsuario}
          userSubtitle={emailUsuario}
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
            <Text style={styles.greeting}>{greetingMeta.title}</Text>
            <Text style={styles.headerSubtitle}>{greetingMeta.subtitle}</Text>
          </View>

          <View style={styles.headerActions}>
            <BotaoMenuHamburguer
              onPress={() => setMenuVisible(true)}
              disabled={saindo}
            />
          </View>
        </View>

        <SectionCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.eyebrow}>Glicose em tempo real</Text>
              <Text style={styles.glucoseValue}>{currentGlucose} mg/dL</Text>
            </View>

            <View style={styles.trendBadge}>
              <Ionicons
                name={trendMeta.icon}
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.trendBadgeText}>{trendMeta.label}</Text>
            </View>
          </View>

          <Text style={styles.heroHelper}>{trendMeta.helper}</Text>
          <Sparkline data={sparklineData} />

          <View style={styles.sparklineFooter}>
            <Text style={styles.sparklineLabel}>Ultimas 3 horas</Text>
            <Text style={styles.sparklineLabel}>Atualizado agora</Text>
          </View>

          <View style={styles.rangeHeader}>
            <Text style={styles.rangeTitle}>Time in range hoje</Text>
            <Text style={styles.rangeValue}>80% dentro da meta</Text>
          </View>
          <TimeInRangeBar />
        </SectionCard>

        <View style={styles.summaryRow}>
          <SectionCard style={styles.summaryCard}>
            <Ionicons name="water-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.summaryLabel}>Hidratacao</Text>
            <Text style={styles.summaryValue}>{waterCount} copos</Text>
          </SectionCard>

          <SectionCard style={styles.summaryCard}>
            <MaterialCommunityIcons
              name="food-apple-outline"
              size={18}
              color={patientTheme.colors.primaryDark}
            />
            <Text style={styles.summaryLabel}>Refeicoes</Text>
            <Text style={styles.summaryValue}>{mealEntries.length || 0} no dia</Text>
          </SectionCard>

          <SectionCard style={styles.summaryCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={patientTheme.colors.primaryDark}
            />
            <Text style={styles.summaryLabel}>Plano</Text>
            <Text style={styles.summaryValue}>Em dia</Text>
          </SectionCard>
        </View>

        <Text style={styles.sectionTitle}>Acoes rapidas</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((item) => (
            <TouchableOpacity key={item.id} style={styles.quickCard} onPress={item.action}>
              <View style={styles.quickIconWrap}>
                <Ionicons name={item.icon} size={22} color={patientTheme.colors.primaryDark} />
              </View>
              <Text style={styles.quickTitle}>{item.label}</Text>
              <Text style={styles.quickHelper}>{item.helper}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Feed de insights</Text>
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

        <Text style={styles.sectionTitle}>Explorar sua jornada</Text>
        {exploreCards.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.exploreCard}
            onPress={() => navigation.navigate(item.route, { usuarioLogado })}
          >
            <View style={styles.exploreIcon}>
              <Ionicons name={item.icon} size={20} color={patientTheme.colors.primaryDark} />
            </View>
            <View style={styles.exploreCopy}>
              <Text style={styles.exploreTitle}>{item.title}</Text>
              <Text style={styles.exploreText}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={patientTheme.colors.textMuted} />
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Meu plano de hoje</Text>
        <SectionCard>
          {(planSections.length > 0 ? planSections.slice(0, 3) : [null, null]).map((item, index) => (
            <View key={item?.id || index} style={styles.planItem}>
              <View style={styles.planTime}>
                <Text style={styles.planTimeText}>
                  {item?.time || (index === 0 ? '07:00' : '12:30')}
                </Text>
              </View>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>
                  {item?.title || (index === 0 ? 'Cafe da manha' : 'Almoco equilibrado')}
                </Text>
                <Text style={styles.planText}>
                  {item?.foods?.join(', ') ||
                    (index === 0
                      ? 'Iogurte natural, aveia, chia e fruta.'
                      : 'Arroz integral, feijao, frango e salada.')}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.planButton}
            onPress={() => navigation.navigate('PacientePlano', { usuarioLogado })}
          >
            <Text style={styles.planButtonText}>Abrir plano completo</Text>
          </TouchableOpacity>
        </SectionCard>

        <View style={styles.listFooter} />
      </ScrollView>

      <BarraAbasPaciente
        navigation={navigation}
        rotaAtual={route?.name || 'HomePaciente'}
        usuarioLogado={usuarioLogado}
      />

      {saindo ? (
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
  listFooter: {
    height: 8,
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
  glucoseValue: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  trendBadgeText: {
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
  sparklineRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sparklineTrack: {
    width: '8%',
    height: 76,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: 16,
  },
  sparklineBar: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: patientTheme.colors.primary,
  },
  sparklineFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sparklineLabel: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  rangeHeader: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  rangeValue: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  rangeBar: {
    marginTop: 12,
    height: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  rangeSegment: {
    height: '100%',
  },
  rangePrimary: {
    backgroundColor: patientTheme.colors.primary,
  },
  rangeWarning: {
    backgroundColor: patientTheme.colors.warning,
  },
  rangeInfo: {
    backgroundColor: patientTheme.colors.info,
  },
  rangeLegend: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLegendText: {
    fontSize: 11,
    color: patientTheme.colors.textMuted,
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
  planItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  planTime: {
    width: 64,
    height: 34,
    borderRadius: 17,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planTimeText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  planCopy: {
    flex: 1,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  planText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: patientTheme.colors.textMuted,
  },
  planButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primary,
  },
  planButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
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
