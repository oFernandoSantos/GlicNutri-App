import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import IntroScreen from './src/screens/IntroScreen';
import LoginScreen from './src/screens/LoginScreen';
import CadastroScreen from './src/screens/CadastroScreenFixed';
import ForgotPassword from './src/screens/ForgotPassword';
import PacienteOnboardingScreen from './src/screens/paciente/PacienteOnboardingScreen';
import HomePaciente from './src/screens/paciente/PacienteHomeScreen';
import HomeNutricionista from './src/screens/nutricionista/NutricionistaHomeDashboardScreen';
import GerenciarPacientesScreen from './src/screens/nutricionista/GerenciarPacientesStyled';
import NutricionistaSectionScreen from './src/screens/nutricionista/NutricionistaSectionScreen';
import PacienteDiarioScreen from './src/screens/paciente/PacienteDiarioScreen';
import PacienteMonitoramentoScreen from './src/screens/paciente/PacienteMonitoramentoScreen';
import PacienteAssistenteScreen from './src/screens/paciente/PacienteAssistenteScreen';
import PacienteBemEstarScreen from './src/screens/paciente/PacienteBemEstarScreen';
import PacientePlanoScreen from './src/screens/paciente/PacientePlanoScreen';
import PacientePerfilScreen from './src/screens/paciente/PacientePerfilScreen';
import ReaderTopo from './src/components/ReaderTopo';
import { supabase } from './src/services/supabaseConfig';
import { syncGooglePatientRecord } from './src/services/googlePatientSync';
import { patientTheme } from './src/theme/patientTheme';
import { INTRO_SEEN_STORAGE_KEY } from './src/constants/storageKeys';
import { hasPatientOnboardingSeen } from './src/services/patientOnboardingService';

const Stack = createStackNavigator();
const WEB_SCROLL_STYLE_ID = 'glicnutri-web-document-scroll';
const READER_TOPO_WEB_HEIGHT = 59;

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

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [patientOnboardingReady, setPatientOnboardingReady] = useState(false);
  const [patientOnboardingSeen, setPatientOnboardingSeen] = useState(false);

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

  if (!authReady || !introReady || !patientOnboardingReady) {
    return (
      <SafeAreaView
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
      </SafeAreaView>
    );
  }

  function getPacienteProps(props) {
    return {
      ...props,
      usuarioLogado: props.route?.params?.usuarioLogado || session?.user || null,
    };
  }

  const initialRouteName = session
    ? patientOnboardingSeen
      ? 'HomePaciente'
      : 'PacienteOnboarding'
    : introSeen
      ? 'Login'
      : 'Intro';
  const useFullBleedIntro = initialRouteName === 'Intro';
  const AppSurface = useFullBleedIntro ? View : SafeAreaView;

  const readerScreenOptions = {
    animationEnabled: false,
    cardStyle: Platform.OS === 'web' ? styles.webStackCard : undefined,
    cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
    gestureEnabled: false,
    header: (props) => <ReaderTopo {...props} />,
    headerShown: true,
  };

  return (
    <GestureHandlerRootView style={[styles.gestureRoot, Platform.OS === 'web' && styles.webDocumentRoot]}>
      <SafeAreaProvider>
        <AppSurface
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
                  session
                    ? patientOnboardingSeen
                      ? 'auth'
                      : 'auth-onboarding'
                    : introSeen
                      ? 'guest-seen'
                      : 'guest-first'
                }
                initialRouteName={initialRouteName}
                screenOptions={{
                  cardStyle: Platform.OS === 'web' ? styles.webStackCard : undefined,
                  headerShown: false,
                }}
              >
              <Stack.Screen name="Intro">
                {(props) => (
                  <IntroScreen
                    {...props}
                    session={session}
                    onIntroFinished={() => setIntroSeen(true)}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Login" options={readerScreenOptions}>
                {(props) => (
                  <LoginScreen
                    {...props}
                    session={session}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen
                name="Cadastro"
                component={CadastroScreen}
                options={readerScreenOptions}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPassword}
                options={readerScreenOptions}
              />

              <Stack.Screen name="PacienteOnboarding">
                {(props) => (
                  <PacienteOnboardingScreen
                    {...getPacienteProps(props)}
                    onOnboardingFinished={() => setPatientOnboardingSeen(true)}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="HomePaciente" options={readerScreenOptions}>
                {(props) => <HomePaciente {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteDiario" options={readerScreenOptions}>
                {(props) => <PacienteDiarioScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteMonitoramento" options={readerScreenOptions}>
                {(props) => <PacienteMonitoramentoScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteAssistente" options={readerScreenOptions}>
                {(props) => <PacienteAssistenteScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteBemEstar" options={readerScreenOptions}>
                {(props) => <PacienteBemEstarScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacientePlano" options={readerScreenOptions}>
                {(props) => <PacientePlanoScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacientePerfil" options={readerScreenOptions}>
                {(props) => <PacientePerfilScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen
                name="HomeNutricionista"
                component={HomeNutricionista}
                options={readerScreenOptions}
              />

              <Stack.Screen
                name="GerenciarPacientes"
                component={GerenciarPacientesScreen}
                options={readerScreenOptions}
              />

              <Stack.Screen
                name="NutricionistaAgenda"
                component={NutricionistaSectionScreen}
                options={readerScreenOptions}
              />

              <Stack.Screen
                name="NutricionistaMensagens"
                component={NutricionistaSectionScreen}
                options={readerScreenOptions}
              />

              <Stack.Screen
                name="NutricionistaRelatorios"
                component={NutricionistaSectionScreen}
                options={readerScreenOptions}
              />
              </Stack.Navigator>
            </NavigationContainer>
          </View>
        </AppSurface>
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
