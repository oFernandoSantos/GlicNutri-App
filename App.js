import React, { useEffect, useState } from 'react';
import {
  StatusBar,
  View,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
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
import NutricionistaSectionScreen from './src/telas/nutricionista/TelaSecaoNutricionista';
import TelaAuditoriaAdmin from './src/telas/admin/TelaAuditoriaAdmin';
import TelaHomeAdmin from './src/telas/admin/TelaHomeAdmin';
import TelaLogsSistemaAdmin from './src/telas/admin/TelaLogsSistemaAdmin';
import PacienteDiarioScreen from './src/telas/paciente/TelaDiarioPaciente';
import PacienteMonitoramentoScreen from './src/telas/paciente/TelaMonitoramentoPaciente';
import PacienteHistoricoRegistrosScreen from './src/telas/paciente/TelaHistoricoRegistrosPaciente';
import PacienteAssistenteScreen from './src/telas/paciente/TelaAssistentePaciente';
import PacienteAgendamentosScreen from './src/telas/paciente/TelaConsultasPaciente';
import PacienteBemEstarScreen from './src/telas/paciente/TelaBemEstarPaciente';
import PacientePlanoScreen from './src/telas/paciente/TelaPlanoPaciente';
import PacientePerfilScreen from './src/telas/paciente/TelaPerfilPaciente';
import RegistroRefeicaoIAScreen from './src/telas/paciente/RegistroRefeicaoIA';
import ReaderTopo from './src/componentes/comum/CabecalhoLeitor';
import SwipeBackContainer from './src/componentes/comum/SwipeBackContainer';
import { supabase } from './src/servicos/configSupabase';
import { syncGooglePatientRecord } from './src/servicos/sincronizarPacienteGoogle';
import { configurarCapturaGlobalLogs } from './src/servicos/servicoLogSistema';
import { patientTheme } from './src/temas/temaVisualPaciente';
import { INTRO_SEEN_STORAGE_KEY } from './src/constantes/chavesArmazenamento';
import { hasPatientOnboardingSeen } from './src/servicos/servicoOnboardingPaciente';
import { carregarSessaoAdmin, limparSessaoAdmin } from './src/servicos/servicoAdmin';

const Stack = createStackNavigator();
const WEB_SCROLL_STYLE_ID = 'glicnutri-web-document-scroll';
const READER_TOPO_WEB_HEIGHT = 59;
const SCREEN_WIDTH = Dimensions.get('window').width;

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
  }, []);

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [patientOnboardingReady, setPatientOnboardingReady] = useState(false);
  const [patientOnboardingSeen, setPatientOnboardingSeen] = useState(false);
  const [patientSessionOverride, setPatientSessionOverride] = useState(null);
  const [adminSession, setAdminSession] = useState(null);
  const [adminReady, setAdminReady] = useState(false);

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
    if (session?.user && adminSession) {
      limparSessaoAdmin();
      setAdminSession(null);
    }
  }, [session, adminSession]);

  useEffect(() => {
    let isMounted = true;

    async function prepararSessao(nextSession) {
      if (!nextSession?.user) {
        return null;
      }

      try {
        const pacienteGoogle = await syncGooglePatientRecord(nextSession.user);

        if (!pacienteGoogle) {
          return nextSession;
        }

        return {
          ...nextSession,
          user: {
            ...nextSession.user,
            ...pacienteGoogle,
            id_paciente_uuid:
              pacienteGoogle.id_paciente_uuid || nextSession.user.id || null,
          },
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      (async () => {
        if (!isMounted) return;

        setAuthReady(false);
        const sessaoPreparada = await prepararSessao(nextSession || null);

        if (!isMounted) return;

        setSession(sessaoPreparada);
        setAuthReady(true);
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
    let isMounted = true;

    async function carregarOnboardingPaciente() {
      if (!authReady) return;

      if (!session?.user) {
        if (isMounted) {
          setPatientOnboardingSeen(false);
          setPatientOnboardingReady(true);
        }
        return;
      }

      setPatientOnboardingReady(false);

      const onboardingVisto = await hasPatientOnboardingSeen(session.user);

      if (isMounted) {
        setPatientOnboardingSeen(onboardingVisto);
        setPatientOnboardingReady(true);
      }
    }

    carregarOnboardingPaciente();

    return () => {
      isMounted = false;
    };
  }, [authReady, session]);

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

  if (!authReady || !introReady || !patientOnboardingReady || !adminReady) {
    return (
      <View
        style={[styles.appRoot, Platform.OS === 'web' && styles.webDocumentRoot]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={patientTheme.colors.background}
        />
        <View
          style={styles.loadingBody}
        >
          <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
        </View>
      </View>
    );
  }

  function getPacienteProps(props) {
    return {
      ...props,
      usuarioLogado:
        props.route?.params?.usuarioLogado ||
        patientSessionOverride ||
        session?.user ||
        null,
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

  function withSwipeBack(props, content) {
    return (
      <SwipeBackContainer navigation={props.navigation}>
        {content}
      </SwipeBackContainer>
    );
  }

  const initialRouteName = adminSession
    ? 'AdminHome'
    : session
      ? patientOnboardingSeen
        ? 'HomePaciente'
        : 'PacienteOnboarding'
      : introSeen
        ? 'Login'
        : 'Intro';
  const useFullBleedIntro = initialRouteName === 'Intro';

  const readerScreenOptions = {
    animationEnabled: Platform.OS !== 'web',
    cardStyle: Platform.OS === 'web' ? styles.webStackCard : undefined,
    cardStyleInterpolator:
      Platform.OS === 'ios'
        ? CardStyleInterpolators.forHorizontalIOS
        : Platform.OS === 'web'
          ? CardStyleInterpolators.forNoAnimation
          : undefined,
    gestureEnabled: Platform.OS !== 'web',
    gestureDirection: 'horizontal',
    gestureResponseDistance: {
      horizontal: SCREEN_WIDTH,
    },
    header: (props) => <ReaderTopo {...props} />,
    headerShown: true,
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
                key={
                  adminSession
                    ? 'admin-auth'
                    : session
                      ? patientOnboardingSeen
                        ? 'auth'
                        : 'auth-onboarding'
                      : introSeen
                        ? 'guest-seen'
                        : 'guest-first'
                }
                initialRouteName={initialRouteName}
                screenOptions={{
                  animationEnabled: Platform.OS !== 'web',
                  cardStyle: Platform.OS === 'web' ? styles.webStackCard : undefined,
                  cardStyleInterpolator:
                    Platform.OS === 'ios'
                      ? CardStyleInterpolators.forHorizontalIOS
                      : Platform.OS === 'web'
                        ? CardStyleInterpolators.forNoAnimation
                        : undefined,
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
                        }
                        setPatientOnboardingSeen(true);
                      }}
                    />
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="HomePaciente" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <HomePaciente {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteDiario" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteDiarioScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteMonitoramento" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteMonitoramentoScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteHistoricoRegistros" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteHistoricoRegistrosScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteAssistente" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteAssistenteScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteAgendamentos" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteAgendamentosScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacienteBemEstar" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacienteBemEstarScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePlano" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePlanoScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfil" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <PacientePerfilScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen
                name="RegistroRefeicaoIA"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <RegistroRefeicaoIAScreen {...getPacienteProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen
                name="HomeNutricionista"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <HomeNutricionista {...props} />)}
              </Stack.Screen>

              <Stack.Screen
                name="GerenciarPacientes"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <GerenciarPacientesScreen {...props} />)}
              </Stack.Screen>

              <Stack.Screen
                name="NutricionistaAgenda"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <NutricionistaSectionScreen {...props} />)}
              </Stack.Screen>

              <Stack.Screen
                name="NutricionistaMensagens"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <NutricionistaSectionScreen {...props} />)}
              </Stack.Screen>

              <Stack.Screen
                name="NutricionistaRelatorios"
                options={readerScreenOptions}
              >
                {(props) => withSwipeBack(props, <NutricionistaSectionScreen {...props} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminHome" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <TelaHomeAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminAuditoria" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <TelaAuditoriaAdmin {...getAdminProps(props)} />)}
              </Stack.Screen>

              <Stack.Screen name="AdminLogsSistema" options={readerScreenOptions}>
                {(props) => withSwipeBack(props, <TelaLogsSistemaAdmin {...getAdminProps(props)} />)}
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
});
