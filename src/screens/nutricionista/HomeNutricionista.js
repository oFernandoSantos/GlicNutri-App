import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { supabase } from '../../services/supabaseConfig';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

export default function HomeNutricionista({ route, navigation }) {
  const { usuarioLogado } = route.params || {};
  const [loadingLogout, setLoadingLogout] = useState(false);

  async function handleLogout() {
    try {
      setLoadingLogout(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.log('Erro ao encerrar sessão:', error.message);
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.log('Erro inesperado no logout:', error);
      Alert.alert('Erro', 'Não foi possível sair da conta.');
    } finally {
      setLoadingLogout(false);
    }
  }

  function handleAbrirGerenciamento() {
    navigation.navigate('GerenciarPacientes', { usuarioLogado });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>
          Dr(a). {usuarioLogado?.nome_nutri || usuarioLogado?.nome_completo_nutri || 'Nutricionista'}
        </Text>
        <Text style={styles.subtitle}>Painel de Controle Profissional</Text>
      </View>

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[
          styles.content,
          Platform.OS === 'web' && styles.webContent,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Dados Profissionais</Text>
          <Text style={styles.infoText}>
            CRN/UF: {usuarioLogado?.crm_numero || 'Não informado'}
          </Text>
          <Text style={styles.infoText}>
            E-mail: {usuarioLogado?.email_acesso || 'Não informado'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAbrirGerenciamento}
        >
          <Text style={styles.actionText}>Gerenciar Pacientes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loadingLogout}
        >
          {loadingLogout ? (
            <ActivityIndicator color="#e74c3c" />
          ) : (
            <Text style={styles.logoutText}>Sair</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF' },
  header: {
    padding: 30,
    backgroundColor: '#27ae60',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  welcome: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitle: { color: '#E3F2FD', fontSize: 16, marginTop: 4 },
  content: { flexGrow: 1, padding: 20 },
  webContent: { flexGrow: 0, minHeight: '100%' },
  cardInfo: {
    backgroundColor: '#f4f4f4',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    ...softGreenBorder,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoText: {
    color: '#7f8c8d',
    fontSize: 16,
    marginBottom: 6,
  },
  actionButton: {
    backgroundColor: '#27ae60',
    padding: 18,
    borderRadius: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  actionText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  logoutButton: {
    marginTop: 30,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 16 },
});
