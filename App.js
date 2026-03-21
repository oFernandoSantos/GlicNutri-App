import React, { useState } from 'react';
import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import SeletorAbas from './src/components/SeletorAbas';
import LoginScreen from './src/screens/LoginScreen';
import CadastroScreen from './src/screens/CadastroScreen';
import HomePaciente from './src/screens/HomePaciente';
import HomeNutricionista from './src/screens/HomeNutricionista';
import ForgotPasswordScreen from './src/screens/ForgotPassword'; 

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function App() {
  const [esconderCabecalho, setEsconderCabecalho] = useState(false);

  function onNavigationStateChange() {
    if (navigationRef.isReady()) {
      const rotaAtual = navigationRef.getCurrentRoute()?.name;
      // Definimos quais telas NÃO devem mostrar o logo GlicNutri do topo
      const telasLogadas = ['HomePaciente', 'HomeNutricionista'];
      setEsconderCabecalho(telasLogadas.includes(rotaAtual));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }} 
      >
        {!esconderCabecalho && (
          <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 10 }}>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#27ae60' }}>GlicNutri</Text>
            <Text style={{ color: '#95a5a6', fontSize: 16, marginBottom: 20 }}>
              Sua saúde, em qualquer lugar
            </Text>
            <SeletorAbas onNavigate={(nome) => navigationRef.navigate(nome)} /> 
          </View>
        )}

        <NavigationContainer 
          ref={navigationRef}
          onStateChange={onNavigationStateChange}
        >
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Cadastro" component={CadastroScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="HomePaciente" component={HomePaciente} />
            <Stack.Screen name="HomeNutricionista" component={HomeNutricionista} />
          </Stack.Navigator>
        </NavigationContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}