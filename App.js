import React, { useEffect, useRef, useState } from 'react';
import {
  StatusBar,
  View,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TelaIntroducao from './src/telas/autenticacao/TelaIntroducao';
import TelaLogin from './src/telas/autenticacao/TelaLogin';
import TelaCadastro from './src/telas/autenticacao/TelaCadastro';
import ForgotPassword from './src/telas/autenticacao/TelaRecuperarSenha';
import PacienteOnboardingScreen from './src/telas/paciente/TelaOnboardingPaciente';
import HomePaciente from './src/telas/paciente/TelaInicioPaciente';
import HomeNutricionista from './src/telas/nutricionista/TelaInicioNutricionista';
import GerenciarPacientesScreen from './src/telas/nutricionista/TelaPacientesNutricionista';
import NutricionistaAgendaScreen from './src/telas/nutricionista/TelaAgendaNutricionista';
import NutriProntuarioPacienteScreen from './src/telas/nutricionista/TelaProntuarioPacienteNutri';
import NutriConsultaScreen from './src/telas/nutricionista/TelaConsultaNutri';
import NutricionistaMensagensScreen from './src/telas/nutricionista/TelaMensagensNutricionista';
import NutricionistaRelatoriosScreen from './src/telas/nutricionista/TelaRelatoriosNutricionista';
import HomeMedico from './src/telas/medico/TelaInicioMedico';
import MedicoPacientesScreen from './src/telas/medico/TelaPacientesMedico';
import MedicoProntuarioPacienteScreen from './src/telas/medico/TelaProntuarioPacienteMedico';
import MedicoAgendaScreen from './src/telas/medico/TelaAgendaMedico';
import MedicoMensagensScreen from './src/telas/medico/TelaMensagensMedico';
import MedicoRelatoriosScreen from './src/telas/medico/TelaRelatoriosMedico';
import MedicoConsultaScreen from './src/telas/medico/TelaConsultaMedico';
import TelaAuditoriaAdmin from './src/telas/admin/TelaAuditoriaAdmin';
import TelaHomeAdmin from './src/telas/admin/TelaHomeAdmin';
import TelaCadastrosAdmin from './src/telas/admin/TelaCadastrosAdmin';
import TelaCadastroAdministradorAdmin from './src/telas/admin/TelaCadastroAdministradorAdmin';
import TelaOperacoesAdmin from './src/telas/admin/TelaOperacoesAdmin';
import TelaLogsSistemaAdmin from './src/telas/admin/TelaLogsSistemaAdmin';
import TelaDetalheLogSistemaAdmin from './src/telas/admin/TelaDetalheLogSistemaAdmin';
import PacienteDiarioScreen from './src/telas/paciente/TelaDiarioPaciente';
import PacienteMonitoramentoScreen from './src/telas/paciente/TelaMonitoramentoPaciente';
import PacienteIntegracaoSensorScreen from './src/telas/paciente/TelaIntegracaoSensorPaciente';
import PacienteHistoricoRegistrosScreen from './src/telas/paciente/TelaHistoricoRegistrosPaciente';
import PacienteAssistenteScreen from './src/telas/paciente/TelaAssistentePaciente';
import PacienteSuporteScreen from './src/telas/paciente/TelaSuportePaciente';
import PacienteAgendamentosScreen from './src/telas/paciente/TelaConsultasPaciente';
import PacientePerfilNutricionistaScreen from './src/telas/paciente/TelaPerfilNutricionistaAgendamento';
import PacientePerfilMedicoScreen from './src/telas/paciente/TelaPerfilMedicoAgendamento';
import PacientePlanoScreen from './src/telas/paciente/TelaPlanoPaciente';
import PacienteProgressoScreen from './src/telas/paciente/TelaProgressoPaciente';
import PacienteRelatoriosScreen from './src/telas/paciente/TelaRelatoriosPaciente';
import PacientePerfilScreen from './src/telas/paciente/TelaPerfilPaciente';
import PacienteChatNutricionistaScreen from './src/telas/paciente/TelaChatNutricionistaPaciente';
import PacienteChatNutricionistaDetalheScreen from './src/telas/paciente/TelaChatNutricionistaDetalhePaciente';
import RegistroRefeicaoIAScreen from './src/telas/paciente/RegistroRefeicaoIA';
import TelaPrevisaoMl from './src/telas/paciente/TelaPrevisaoMl';
import ReaderTopo from './src/componentes/comum/CabecalhoLeitor';
import SwipeBackContainer from './src/componentes/comum/SwipeBackContainer';
import { supabase, isSupabaseConfigured } from './src/servicos/configSupabase';
import { syncGooglePatientRecord } from './src/servicos/sincronizarPacienteGoogle';
import { configurarCapturaGlobalLogs } from './src/servicos/servicoLogSistema';
import { initObservabilidade } from './src/servicos/servicoObservabilidade';
import { patientTheme } from './src/temas/temaVisualPaciente';
import { INTRO_SEEN_STORAGE_KEY } from './src/constantes/chavesArmazenamento';
import { hasPatientOnboardingSeen } from './src/servicos/servicoOnboardingPaciente';
import { carregarSessaoAdmin, limparSessaoAdmin } from './src/servicos/servicoAdmin';
import {
  carregarSessaoNutricionista,
  limparSessaoNutricionista,
} from './src/servicos/servicoSessaoNutricionista';
import {
  carregarSessaoMedico,
  limparSessaoMedico,
} from './src/servicos/servicoSessaoMedico';
import {
  carregarSessaoPaciente,
  limparSessaoPaciente,
  salvarSessaoPaciente,
} from './src/servicos/servicoSessaoPaciente';
import {
  emitirSessaoRpcOAuthPaciente,
  garantirSessaoRpcClinicaComPerfil,
} from './src/servicos/servicoSessaoRpc';
import { resolveInitialRouteName, isPatientUser } from './src/utilitarios/perfisApp';
import {
  getPatientId,
  prefetchPatientAreaBootstrap,
  warmPatientHomeForLogin,
} from './src/servicos/servicoDadosPaciente';
import {
  hasLibreLinkUpLinked,
  startLibreViewAutoSync,
  stopLibreViewAutoSync,
} from './src/servicos/servicoLibreViewAutoSync';

const Stack = createStackNavigator();
const WEB_SCROLL_STYLE_ID = 'glicnutri-web-document-scroll';
const READER_TOPO_WEB_HEIGHT = 58;
const SCREEN_WIDTH = Dimensions.get('window').width;
const fadeCardInterpolator = ({ current }) => ({
  cardStyle: {
    opacity: current.progress,
  },
});

function useWebDocumentScroll() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    let style = document.getElementById(WEB_SCROLL_STYLE_ID);

    if (!style) {
      style = document.createElement('style');
      style.id = WEB_SCROLL_STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      html,
      body,
      #root {
        min-height: 100%;
      }

      body,
      #root {
        min-height: 100vh;
      }

      html,
      body {
        height: auto !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch;
      }

      #root {
        display: flex;
        height: auto !important;
      }

      @supports (min-height: 100dvh) {
        body,
        #root {
          min-height: 100dvh;
        }
      }

      *,
      *::before,
      *::after {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }

      *::-webkit-scrollbar {
        display: none !important;
        height: 0 !important;
        width: 0 !important;
      }

      a:focus-visible,
      button:focus-visible,
      [role='button']:not(#admin-logs-search-button):focus-visible,
      [tabindex]:focus-visible {
        outline: 2px solid #4fdfa3 !important;
        outline-offset: 2px !important;
      }

      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible,
      #auth-form input:focus-visible,
      #auth-form textarea:focus-visible,
      #auth-form select:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
      }
    `;

    document.documentElement.style.height = 'auto';
    document.documentElement.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = 'hidden';

    return undefined;
  }, []);
}

export default function App() {
  useWebDocumentScroll();

  useEffect(() => {
    configurarCapturaGlobalLogs();
    initObservabilidade();
  }, []);

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [patientOnboardingReady, setPatientOnboardingReady] = useState(false);
  const [patientOnboardingSeen, setPatientOnboardingSeen] = useState(false);
  const [patientSessionOverride, setPatientSessionOverride] = useState(null);
  const [patientLocalSession, setPatientLocalSession] = useState(null);
  const [patientLocalReady, setPatientLocalReady] = useState(false);
  const [adminSession, setAdminSession] = useState(null);
  const [adminReady, setAdminReady] = useState(false);
  const [nutriSession, setNutriSession] = useState(null);
  const [nutriReady, setNutriReady] = useState(false);
  const [medicoSession, setMedicoSession] = useState(null);
  const [medicoReady, setMedicoReady] = useState(false);
  const onboardingUserIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function carregarPacienteLocal() {
      const paciente = await carregarSessaoPaciente();
      if (paciente) {
        let rpcToken = await garantirSessaoRpcClinicaComPerfil(paciente);
        if (!rpcToken) {
          rpcToken = await emitirSessaoRpcOAuthPaciente(paciente);
        }
      }
      if (isMounted) {
        setPatientLocalSession(paciente);
        setPatientLocalReady(true);
      }
    }

    carregarPacienteLocal();
    return () => {
      isMounted = false;
    };
  }, []);

  async function persistirSessaoPacienteApp(user) {
    if (!user || !isPatientUser(user)) {
      await limparSessaoPaciente();
      setPatientLocalSession(null);
      return null;
    }

    const sanitized = await salvarSessaoPaciente(user);
    let rpcToken = await garantirSessaoRpcClinicaComPerfil(sanitized);
    if (!rpcToken) {
      rpcToken = await emitirSessaoRpcOAuthPaciente(sanitized);
    }
    setPatientLocalSession(sanitized);
    return sanitized;
  }

  useEffect(() => {
    let isMounted = true;

    async function carregarAdmin() {
      const admin = await carregarSessaoAdmin();
      if (isMounted) {
        setAdminSession(admin);
        setAdminReady(true);
      }
    }

    carregarAdmin();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function carregarNutri() {
      const nutri = await carregarSessaoNutricionista();
      if (nutri) {
        await garantirSessaoRpcClinicaComPerfil(nutri);
      }
      if (isMounted) {
        setNutriSession(nutri);
        setNutriReady(true);
      }
    }

    carregarNutri();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function carregarMedico() {
      const medico = await carregarSessaoMedico();
      if (medico) {
        await garantirSessaoRpcClinicaComPerfil(medico);
      }
      if (isMounted) {
        setMedicoSession(medico);
        setMedicoReady(true);
      }
    }

    carregarMedico();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (session?.user && adminSession) {
      limparSessaoAdmin();
      setAdminSession(null);
    }
  }, [session, adminSession]);

  useEffect(() => {
    if (session?.user && nutriSession) {
      limparSessaoNutricionista();
      setNutriSession(null);
    }
  }, [session, nutriSession]);

  useEffect(() => {
    if (session?.user && medicoSession) {
      limparSessaoMedico();
      setMedicoSession(null);
    }
  }, [session, medicoSession]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setAuthReady(true);
      return undefined;
    }

    let isMounted = true;

    async function prepararSessao(nextSession) {
      if (!nextSession?.user) {
        return null;
      }

      try {
        const pacienteGoogle = await syncGooglePatientRecord(nextSession.user);

        if (!pacienteGoogle) {
          if (isPatientUser(nextSession.user)) {
            await persistirSessaoPacienteApp(nextSession.user);
          }
          return nextSession;
        }

        const mergedUser = {
          ...nextSession.user,
          ...pacienteGoogle,
          id_paciente_uuid:
            pacienteGoogle.id_paciente_uuid || nextSession.user.id || null,
        };

        await persistirSessaoPacienteApp(mergedUser);

        return {
          ...nextSession,
          user: mergedUser,
        };
      } catch (error) {
        console.log('Erro ao sincronizar Google com tabela paciente:', error);
        return nextSession;
      }
    }

    async function carregarSessao() {
      setAuthReady(false);
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.log('Erro ao carregar sessao inicial:', error.message);
      }

      if (!isMounted) return;

      const sessaoPreparada = await prepararSessao(data?.session || null);

      if (!isMounted) return;

      setSession(sessaoPreparada);
      setAuthReady(true);
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      (async () => {
        if (!isMounted) return;

        const isSilentEvent =
          event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED';

        if (!isSilentEvent) {
          setAuthReady(false);
        }

        if (!nextSession?.user) {
          if (event === 'SIGNED_OUT') {
            await limparSessaoPaciente();
            if (isMounted) {
              setPatientLocalSession(null);
            }
          }
          if (!isMounted) return;
          setSession(null);
          if (!isSilentEvent) {
            setAuthReady(true);
          }
          return;
        }

        const sessaoPreparada = await prepararSessao(nextSession);

        if (!isMounted) return;

        setSession(sessaoPreparada);
        if (!isSilentEvent) {
          setAuthReady(true);
        }
      })();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setPatientSessionOverride(null);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!authReady) return undefined;

    let cancelled = false;

    (async () => {
      const paciente = await carregarSessaoPaciente();
      if (!cancelled && paciente) {
        setPatientLocalSession(paciente);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, session?.user?.id]);

  useEffect(() => {
    const perfilPaciente = session?.user || patientLocalSession;
    const patientId = getPatientId(perfilPaciente);
    if (!patientId || adminSession || nutriSession) return;

    prefetchPatientAreaBootstrap(patientId, perfilPaciente);
    warmPatientHomeForLogin(patientId, perfilPaciente).catch(() => {});
  }, [adminSession, nutriSession, patientLocalSession, session?.user]);

  useEffect(() => {
    const perfilPaciente =
      patientSessionOverride || patientLocalSession || session?.user || null;

    if (!perfilPaciente || !isPatientUser(perfilPaciente) || adminSession || nutriSession) {
      stopLibreViewAutoSync();
      return undefined;
    }

    const patientId = getPatientId(perfilPaciente);
    if (!patientId) {
      stopLibreViewAutoSync();
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const linked = await hasLibreLinkUpLinked(patientId);
      if (cancelled) return;

      if (!linked) {
        stopLibreViewAutoSync();
        return;
      }

      startLibreViewAutoSync({
        patientId,
        patientEmail: perfilPaciente.email_pac || perfilPaciente.email,
        actor: perfilPaciente,
        runImmediately: false,
      });
    })();

    return () => {
      cancelled = true;
      stopLibreViewAutoSync();
    };
  }, [
    adminSession,
    nutriSession,
    patientLocalSession,
    patientSessionOverride,
    session?.user,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function carregarOnboardingPaciente() {
      if (!authReady || !patientLocalReady) return;

      const perfilPaciente =
        patientSessionOverride || patientLocalSession || session?.user || null;

      if (!perfilPaciente || !isPatientUser(perfilPaciente)) {
        if (isMounted) {
          setPatientOnboardingSeen(false);
          setPatientOnboardingReady(true);
        }
        return;
      }

      const userKey = perfilPaciente.id_paciente_uuid || perfilPaciente.id || perfilPaciente.email;
      if (onboardingUserIdRef.current === userKey && patientOnboardingReady) {
        return;
      }

      const onboardingVisto = await hasPatientOnboardingSeen(perfilPaciente);

      if (isMounted) {
        onboardingUserIdRef.current = userKey;
        setPatientOnboardingSeen(onboardingVisto);
        setPatientOnboardingReady(true);
      }
    }

    carregarOnboardingPaciente();

    return () => {
      isMounted = false;
    };
  }, [
    authReady,
    patientLocalReady,
    patientLocalSession,
    patientSessionOverride,
    patientOnboardingReady,
    session?.user?.id,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function carregarIntroVista() {
      try {
        const value = await AsyncStorage.getItem(INTRO_SEEN_STORAGE_KEY);

        if (isMounted) {
          setIntroSeen(value === 'true');
        }
      } catch (error) {
        console.log('Erro ao carregar status da intro:', error);
      } finally {
        if (isMounted) {
          setIntroReady(true);
        }
      }
    }

    carregarIntroVista();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <View
            style={[
              styles.appRoot,
              Platform.OS === 'web' && styles.webDocumentRoot,
              { justifyContent: 'center' },
            ]}
          >
            <StatusBar
              barStyle="dark-content"
              backgroundColor={patientTheme.colors.background}
            />
            <View style={{ paddingHorizontal: 28, maxWidth: 520, alignSelf: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
                Configuracao incompleta
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#444', textAlign: 'center' }}>
                Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no ambiente de
                deploy ou no ficheiro .env local (desenvolvimento). Reinicie o servidor apos
                alterar as variaveis.
              </Text>
            </View>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (
    !authReady ||
    !introReady ||
    !patientOnboardingReady ||
    !patientLocalReady ||
    !adminReady ||
    !nutriReady ||
    !medicoReady
  ) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <View
            style={[styles.appRoot, Platform.OS === 'web' && styles.webDocumentRoot]}
          >
            <StatusBar
              barStyle="dark-content"
              backgroundColor={patientTheme.colors.background}
            />
            <View style={styles.loadingBody}>
              <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
            </View>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  function getPacienteProps(props) {
    const routeMeta = props.route?.params?.usuarioLogado || null;
    const sessionUser =
      routeMeta || patientSessionOverride || patientLocalSession || session?.user || null;

    const usuarioLogado = sessionUser
      ? {
          ...(routeMeta && typeof routeMeta === 'object' ? routeMeta : {}),
          ...(sessionUser && typeof sessionUser === 'object' ? sessionUser : {}),
          id_paciente_uuid:
            getPatientId(sessionUser) ||
            getPatientId(routeMeta) ||
            routeMeta?.id_paciente_uuid ||
            sessionUser?.user_metadata?.id_paciente_uuid ||
            null,
        }
      : null;

    return {
      ...props,
      usuarioLogado,
    };
  }

  function getAdminProps(props) {
    return {
      ...props,
      usuarioLogado: props.route?.params?.usuarioLogado || adminSession || null,
      onAdminLogout: async () => {
        await limparSessaoAdmin();
        setAdminSession(null);
      },
    };
  }

  function getMedicoProps(props) {
    const sessionMedico = medicoSession || null;
    const routeMeta = props.route?.params?.usuarioLogado || null;

    return {
      ...props,
      route: {
        ...props.route,
        params: {
          ...props.route?.params,
          usuarioLogado: sessionMedico
            ? {
                ...(routeMeta && typeof routeMeta === 'object' ? routeMeta : {}),
                ...sessionMedico,
                id_medico_uuid:
                  sessionMedico?.id_medico_uuid || routeMeta?.id_medico_uuid || null,
              }
            : null,
        },
      },
      navigation: props.navigation,
      onMedicoLogout: async () => {
        await limparSessaoMedico();
        setMedicoSession(null);
        props.navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      },
    };
  }

  function getNutriProps(props) {
    const sessionNutri = nutriSession || null;
    const routeMeta = props.route?.params?.usuarioLogado || null;

    return {
      ...props,
      route: {
        ...props.route,
        params: {
          ...props.route?.params,
          usuarioLogado: sessionNutri
            ? {
                ...(routeMeta && typeof routeMeta === 'object' ? routeMeta : {}),
                ...sessionNutri,
                id_nutricionista_uuid:
                  sessionNutri?.id_nutricionista_uuid ||
                  routeMeta?.id_nutricionista_uuid ||
                  null,
              }
            : null,
        },
      },
      navigation: props.navigation,
      onNutriLogout: async () => {
        await limparSessaoNutricionista();
        setNutriSession(null);
        props.navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      },
    };
  }

  function withSwipeBack(props, content) {
    return (
      <SwipeBackContainer navigation={props.navigation}>
        {content}
      </SwipeBackContainer>
    );
  }

  const initialRouteName = resolveInitialRouteName({
    adminSession,
    nutriSession,
    medicoSession,
    supabaseSession: session,
    patientLocalSession,
    patientOnboardingSeen,
    introSeen,
  });
  const useFullBleedIntro = initialRouteName === 'Intro';

  const readerScreenOptions = {
    animationEnabled: true,
    cardStyle:
      Platform.OS === 'web' ? styles.webStackCard : styles.nativeStackCard,
    cardStyleInterpolator: fadeCardInterpolator,
    gestureEnabled: Platform.OS !== 'web',
    gestureDirection: 'horizontal',
    gestureResponseDistance: {
      horizontal: SCREEN_WIDTH,
    },
    header: (props) => <ReaderTopo {...props} />,
    headerShown: true,
  };

  const mainTabReaderOptions = {
    ...readerScreenOptions,
    animationEnabled: false,
  };

  return (
    <GestureHandlerRootView style={[styles.gestureRoot, Platform.OS === 'web' && styles.webDocumentRoot]}>
      <SafeAreaProvider>
        <View
          style={[styles.appRoot, Platform.OS === 'web' && styles.webDocumentRoot]}
        >
          {!useFullBleedIntro ? (
            <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />
          ) : null}

          <View
            style={[styles.appBody, Platform.OS === 'web' && styles.webDocumentBody]}
          >
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName={initialRouteName}
                screenOptions={{
                  animationEnabled: true,
                  cardStyle:
                    Platform.OS === 'web' && !useFullBleedIntro ? styles.webStackCard : undefined,
                  cardStyleInterpolator: fadeCardInterpolator,
                  gestureEnabled: Platform.OS !== 'web',
                  gestureDirection: 'horizontal',
                  gestureResponseDistance: {
                    horizontal: SCREEN_WIDTH,
                  },
                  headerShown: false,
                }}
              >
              <Stack.Screen name="Intro">
                {(props) => (
                  withSwipeBack(
                    props,
                    <TelaIntroducao
                      {...props}
                      session={session}
                      onIntroFinished={() => setIntroSeen(true)}
                    />
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="Login" options={readerScreenOptions}>
                {(props) => (
                  withSwipeBack(
                    props,
                    <TelaLogin
                      {...props}
                      session={session}
                      route={{
                        ...props.route,
                        params: {
                          ...(props.route?.params || {}),
                          onAdminLogin: (adminUser) => setAdminSession(adminUser),
                          onNutriLogin: (nutriUser) => setNutriSession(nutriUser),
                          onMedicoLogin: (medicoUser) => setMedicoSession(medicoUser),
                          onPatientLogin: (patientUser) => persistirSessaoPacienteApp(patientUser),
                        },
                      }}
                    />
                  )
                )}
              </Stack.Screen>

              <Stack.Screen
                name="Cadastro"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <TelaCadastro {...props} />)}
              </Stack.Screen>
              <Stack.Screen
                name="ForgotPassword"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <ForgotPassword {...props} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteOnboarding">
                {(props) => (
                  withSwipeBack(
                    props,
                    <PacienteOnboardingScreen
                      {...getPacienteProps(props)}
                      onOnboardingFinished={(updatedPatient) => {
                        if (updatedPatient) {
                          setPatientSessionOverride(updatedPatient);
                          persistirSessaoPacienteApp(updatedPatient);
                        }
                        setPatientOnboardingSeen(true);
                      }}
                    />
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="HomePaciente" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <HomePaciente {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteDiario" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <PacienteDiarioScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteMonitoramento" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <PacienteMonitoramentoScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteHistoricoRegistros" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteHistoricoRegistrosScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteAssistente" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteAssistenteScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteSuporte" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteSuporteScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteAgendamentos" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <PacienteAgendamentosScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfilNutricionista" options={readerScreenOptions}>
                {(props) =>
                  withSwipeBack(props, <PacientePerfilNutricionistaScreen {...getPacienteProps(props)} />)
                }
              </Stack.Screen>
              <Stack.Screen name="PacientePerfilMedico" options={readerScreenOptions}>
                {(props) =>
                  withSwipeBack(props, <PacientePerfilMedicoScreen {...getPacienteProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="PacientePlano" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <PacientePlanoScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteChatNutricionista" options={readerScreenOptions}>
                {(props) =>
                  withSwipeBack(props, <PacienteChatNutricionistaScreen {...getPacienteProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="PacienteChatNutricionistaDetalhe" options={readerScreenOptions}>
                {(props) =>
                  withSwipeBack(
                    props,
                    <PacienteChatNutricionistaDetalheScreen {...getPacienteProps(props)} />
                  )
                }
              </Stack.Screen>

              <Stack.Screen name="PacienteProgresso" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteProgressoScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteRelatorios" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteRelatoriosScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfil" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePerfilScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfilContato" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePerfilScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfilSaude" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePerfilScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfilNotificacoes" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePerfilScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfilPrivacidade" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePerfilScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfilIntegracao" options={readerScreenOptions}>
                {(props) =>
                  withSwipeBack(props, <PacienteIntegracaoSensorScreen {...getPacienteProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="PacientePerfilInsulinas" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePerfilScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePrevisaoML" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <TelaPrevisaoMl {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen
                name="RegistroRefeicaoIA"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <RegistroRefeicaoIAScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen
                name="HomeMedico"
                initialParams={
                  medicoSession ? { usuarioLogado: medicoSession } : undefined
                }
                options={mainTabReaderOptions}
              >
                {(props) => withSwipeBack(props, <HomeMedico {...getMedicoProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="MedicoPacientes" options={mainTabReaderOptions}>
                {(props) =>
                  withSwipeBack(props, <MedicoPacientesScreen {...getMedicoProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="MedicoAgenda" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <MedicoAgendaScreen {...getMedicoProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="MedicoMensagens" options={mainTabReaderOptions}>
                {(props) =>
                  withSwipeBack(props, <MedicoMensagensScreen {...getMedicoProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="MedicoRelatorios" options={mainTabReaderOptions}>
                {(props) =>
                  withSwipeBack(props, <MedicoRelatoriosScreen {...getMedicoProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="MedicoProntuarioPaciente" options={readerScreenOptions}>
                {(props) =>
                  withSwipeBack(props, <MedicoProntuarioPacienteScreen {...getMedicoProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="MedicoConsulta" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <MedicoConsultaScreen {...getMedicoProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen
                name="HomeNutricionista"
                initialParams={
                  nutriSession ? { usuarioLogado: nutriSession } : undefined
                }
                options={mainTabReaderOptions}
              >
                {(props) => withSwipeBack(props, <HomeNutricionista {...getNutriProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen
                name="GerenciarPacientes"
                options={mainTabReaderOptions}
              >
                {(props) =>
                  withSwipeBack(props, <GerenciarPacientesScreen {...getNutriProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen
                name="NutricionistaAgenda"
                options={mainTabReaderOptions}
              >
                {(props) =>
                  withSwipeBack(props, <NutricionistaAgendaScreen {...getNutriProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen
                name="NutriProntuarioPaciente"
                options={readerScreenOptions}
              >
                {(props) =>
                  withSwipeBack(props, <NutriProntuarioPacienteScreen {...getNutriProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen
                name="NutriConsultaNutri"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <NutriConsultaScreen {...getNutriProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen
                name="NutricionistaMensagens"
                options={mainTabReaderOptions}
              >
                {(props) =>
                  withSwipeBack(props, <NutricionistaMensagensScreen {...getNutriProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen
                name="NutricionistaRelatorios"
                options={mainTabReaderOptions}
              >
                {(props) =>
                  withSwipeBack(props, <NutricionistaRelatoriosScreen {...getNutriProps(props)} />)
                }
              </Stack.Screen>

              <Stack.Screen name="AdminHome" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <TelaHomeAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminAuditoria" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <TelaAuditoriaAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminCadastros" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <TelaCadastrosAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminCadastroAdministrador" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <TelaCadastroAdministradorAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminOperacoes" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <TelaOperacoesAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminLogsSistema" options={mainTabReaderOptions}>
                {(props) => withSwipeBack(props, <TelaLogsSistemaAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminDetalheLogSistema" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <TelaDetalheLogSistemaAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>
              </Stack.Navigator>
            </NavigationContainer>
          </View>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    minHeight: 0,
  },
  appRoot: {
    flex: 1,
    minHeight: 0,
    backgroundColor: patientTheme.colors.background,
  },
  appBody: {
    flex: 1,
    minHeight: 0,
  },
  loadingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webDocumentRoot: {
    minHeight: '100vh',
    overflow: 'visible',
  },
  webDocumentBody: {
    minHeight: 0,
    overflow: 'visible',
  },
  webStackCard: {
    overflow: 'visible',
    paddingTop: READER_TOPO_WEB_HEIGHT,
  },
  nativeStackCard: {
    flex: 1,
    backgroundColor: patientTheme.colors.background,
  },
});
