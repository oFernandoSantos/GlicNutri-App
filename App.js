import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import IntroScreen from './src/screens/IntroScreen';
import LoginScreen from './src/screens/LoginScreen';
import CadastroScreen from './src/screens/CadastroScreen';
import ForgotPassword from './src/screens/ForgotPassword';
import HomePaciente from './src/screens/PacienteHomeScreen';
import HomeNutricionista from './src/screens/HomeNutricionista';
import PacienteDiarioScreen from './src/screens/PacienteDiarioScreen';
import PacienteMonitoramentoScreen from './src/screens/PacienteMonitoramentoScreen';
import PacienteAssistenteScreen from './src/screens/PacienteAssistenteScreen';
import PacienteBemEstarScreen from './src/screens/PacienteBemEstarScreen';
import PacientePlanoScreen from './src/screens/PacientePlanoScreen';
import { supabase } from './src/services/supabaseConfig';
import { patientTheme } from './src/theme/patientTheme';

const Stack = createStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function carregarSessao() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.log('Erro ao carregar sessao inicial:', error.message);
      }

      if (!isMounted) return;

      setSession(data?.session || null);
      setAuthReady(true);
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession || null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
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
              key={session ? 'auth' : 'guest'}
              initialRouteName={session ? 'HomePaciente' : 'Intro'}
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name="Intro">
                {(props) => <IntroScreen {...props} session={session} />}
              </Stack.Screen>
              <Stack.Screen name="Login">
                {(props) => <LoginScreen {...props} session={session} />}
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
              <Stack.Screen name="HomeNutricionista" component={HomeNutricionista} />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
