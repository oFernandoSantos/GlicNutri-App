import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

export default function HomeNutricionista({ route, navigation }) {
  const { usuarioLogado } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Dr(a). {usuarioLogado?.nome_nutri || 'Nutricionista'}</Text>
        <Text style={styles.subtitle}>Painel de Controle Profissional</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Dados Profissionais</Text>
          <Text style={styles.infoText}>CRM: {usuarioLogado?.crm_numero}</Text>
        </View>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => alert('Em breve: Lista de Pacientes')}
        >
          <Text style={styles.actionText}>Ver Meus Pacientes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 30, backgroundColor: '#2980b9', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  welcome: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitle: { color: '#E3F2FD', fontSize: 16 },
  content: { flex: 1, padding: 20 },
  cardInfo: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 3, marginTop: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 10 },
  infoText: { color: '#7f8c8d', fontSize: 16 },
  actionButton: { backgroundColor: '#2980b9', padding: 18, borderRadius: 15, marginTop: 20, alignItems: 'center' },
  actionText: { color: '#FFF', fontWeight: 'bold' },
  logoutButton: { marginTop: 30, alignItems: 'center' },
  logoutText: { color: '#e74c3c', fontWeight: 'bold' }
});