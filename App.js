import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import IntroScreen from './src/screens/IntroScreen';
import LoginScreen from './src/screens/LoginScreen';
import CadastroScreen from './src/screens/CadastroScreenFixed';
import ForgotPassword from './src/screens/ForgotPassword';
import HomePaciente from './src/screens/paciente/PacienteHomeScreen';
import HomeNutricionista from './src/screens/nutricionista/NutricionistaHomeDashboardScreen';
import GerenciarPacientesScreen from './src/screens/nutricionista/GerenciarPacientesStyled';
import NutricionistaSectionScreen from './src/screens/nutricionista/NutricionistaSectionScreen';
import PacienteDiarioScreen from './src/screens/paciente/PacienteDiarioScreen';
import PacienteMonitoramentoScreen from './src/screens/paciente/PacienteMonitoramentoScreen';
import PacienteAssistenteScreen from './src/screens/paciente/PacienteAssistenteScreen';
import PacienteBemEstarScreen from './src/screens/paciente/PacienteBemEstarScreen';
import PacientePlanoScreen from './src/screens/paciente/PacientePlanoScreen';
import { supabase } from './src/services/supabaseConfig';
import { syncGooglePatientRecord } from './src/services/googlePatientSync';
import { patientTheme } from './src/theme/patientTheme';
import { INTRO_SEEN_STORAGE_KEY } from './src/constants/storageKeys';

const Stack = createStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);

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

  if (!authReady || !introReady) {
    return (
      <SafeAreaView
        style={[
          { flex: 1, backgroundColor: patientTheme.colors.background },
          Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh', overflow: 'hidden' },
        ]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={patientTheme.colors.background}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
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
    ? 'HomePaciente'
    : introSeen
      ? 'Login'
      : 'Intro';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[
          { flex: 1, minHeight: 0, backgroundColor: patientTheme.colors.background },
          Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh', overflow: 'hidden' },
        ]}
      >
        <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

        <View
          style={[
            { flex: 1, minHeight: 0 },
            Platform.OS === 'web' && { height: '100%', maxHeight: '100%', overflow: 'hidden' },
          ]}
        >
          <NavigationContainer>
            <Stack.Navigator
              key={session ? 'auth' : introSeen ? 'guest-seen' : 'guest-first'}
              initialRouteName={initialRouteName}
              screenOptions={{ headerShown: false }}
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

              <Stack.Screen name="Login">
                {(props) => (
                  <LoginScreen
                    {...props}
                    session={session}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Cadastro" component={CadastroScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPassword} />

              <Stack.Screen name="HomePaciente">
                {(props) => <HomePaciente {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteDiario">
                {(props) => <PacienteDiarioScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteMonitoramento">
                {(props) => <PacienteMonitoramentoScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteAssistente">
                {(props) => <PacienteAssistenteScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacienteBemEstar">
                {(props) => <PacienteBemEstarScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen name="PacientePlano">
                {(props) => <PacientePlanoScreen {...getPacienteProps(props)} />}
              </Stack.Screen>

              <Stack.Screen
                name="HomeNutricionista"
                component={HomeNutricionista}
              />

              <Stack.Screen
                name="GerenciarPacientes"
                component={GerenciarPacientesScreen}
              />

              <Stack.Screen
                name="NutricionistaAgenda"
                component={NutricionistaSectionScreen}
              />

              <Stack.Screen
                name="NutricionistaMensagens"
                component={NutricionistaSectionScreen}
              />

              <Stack.Screen
                name="NutricionistaRelatorios"
                component={NutricionistaSectionScreen}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
