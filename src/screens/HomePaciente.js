import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MenuLateral from '../components/MenuLateral';

export default function HomePaciente({ navigation, route }) {
  const [menuVisivel, setMenuVisivel] = useState(false);
  const usuario = route.params?.usuarioLogado?.nome_pac || "João Teste";

  // Dados organizados em um Array de Objetos (Mais limpo que múltiplos arrays)
  const refeicoes = [
    { nome: 'Café da Manhã', hora: '07:00', cal: 350, dica: 'Substitua a banana por outra fruta.' },
    { nome: 'Lanche da Manhã', hora: '10:00', cal: 150, dica: 'Prefira iogurte sem açúcar.' },
    { nome: 'Almoço', hora: '12:30', cal: 550, dica: 'Tempere com limão e ervas.' },
    { nome: 'Lanche da Tarde', hora: '15:30', cal: 200, dica: 'Troque por frutas vermelhas.' },
    { nome: 'Jantar', hora: '19:00', cal: 450, dica: 'Evite fritar os alimentos.' },
    { nome: 'Ceia', hora: '21:00', cal: 100, dica: 'Apenas se sentir fome.' },
  ];

  return (
    <View style={styles.safeContainer}>
      
      <MenuLateral 
        visivel={menuVisivel} 
        aoFechar={() => setMenuVisivel(false)} 
        onNavigate={navigation.navigate} 
        usuario={usuario} 
      />

      {/* HEADER FIXO */}
      <View style={styles.header}>
        <Text style={styles.logo}>Glic<Text style={styles.logoDark}>Nutri</Text></Text>
        <TouchableOpacity onPress={() => setMenuVisivel(true)}>
          <Ionicons name="menu-outline" size={35} color="#27ae60" />
        </TouchableOpacity>
      </View>

      {/* SCROLL PRINCIPAL */}
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 15 }}>
          
          <Text style={styles.greeting}>Olá, {usuario}!</Text>
          <Text style={styles.subtitle}>Acompanhe seu plano nutricional</Text>

          {/* SELETOR DE ABAS */}
          <View style={styles.tabSelector}>
            <TouchableOpacity style={styles.activeTab}>
              <Text style={{ fontWeight: 'bold' }}>Meu Diário</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inactiveTab}>
              <Text style={{ color: '#999' }}>Rotina</Text>
            </TouchableOpacity>
          </View>

          {/* CARD DE META */}
          <View style={styles.metaCard}>
            <View style={styles.metaHeader}>
              <Text style={styles.metaTitle}>Segunda</Text>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>Meta: 1800 cal</Text>
              </View>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressBar, { width: '33%' }]} />
            </View>
          </View>

          {/* INDICADORES RÁPIDOS */}
          <View style={styles.row}>
             <View style={styles.infoBox}>
                <MaterialCommunityIcons name="water" size={20} color="#3498db" />
                <Text style={styles.infoBoxText}>Água: 5/8 copos</Text>
             </View>
             <View style={[styles.infoBox, { backgroundColor: '#FDECEA' }]}>
                <Text style={[styles.infoBoxText, { color: '#E74C3C' }]}>Glicose: 160 mg/dL</Text>
             </View>
          </View>

          <Text style={styles.sectionTitle}>Suas Refeições</Text>

          {/* LOOP DAS REFEIÇÕES (USANDO MAP) */}
          {refeicoes.map((item, index) => (
            <View key={index} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Ionicons name="checkbox" size={24} color="#27ae60" />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.mealName}>{item.nome}</Text>
                  <Text style={styles.mealDetails}>{item.hora} • {item.cal} cal</Text>
                </View>
              </View>
              <Text style={styles.mealFoodTitle}>Alimentos:</Text>
              <Text style={styles.mealFoodDesc}>Consulte o plano no seu perfil.</Text>
              
              <View style={styles.tipBox}>
                <Ionicons name="information-circle" size={18} color="#3498db" />
                <Text style={styles.tipText}>{item.dica}</Text>
              </View>
            </View>
          ))}

          {/* RESUMO NUTRICIONAL */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Resumo Nutricional</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}><Text style={styles.summaryValue}>500</Text><Text style={styles.summaryLabel}>Cal/dia</Text></View>
              <View style={styles.summaryItem}><Text style={styles.summaryValueBlue}>2</Text><Text style={styles.summaryLabel}>Refeições</Text></View>
              <View style={styles.summaryItem}><Text style={styles.summaryValuePurple}>5</Text><Text style={styles.summaryLabel}>Água</Text></View>
              <View style={styles.summaryItem}><Text style={styles.summaryValueOrange}>33%</Text><Text style={styles.summaryLabel}>Concluído</Text></View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* RODAPÉ FIXO */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Fernando e Vinicius</Text>
        <Text style={styles.footerText}>03/2026</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingTop: 45, paddingBottom: 15, 
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' 
  },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#27ae60' },
  logoDark: { color: '#333' },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#95a5a6', marginBottom: 20 },
  tabSelector: { flexDirection: 'row', backgroundColor: '#EEE', borderRadius: 10, padding: 4, marginBottom: 20 },
  activeTab: { flex: 1, backgroundColor: '#FFF', borderRadius: 8, padding: 8, alignItems: 'center' },
  inactiveTab: { flex: 1, padding: 8, alignItems: 'center' },
  metaCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 15, borderWidth: 2, borderColor: '#27ae60', marginBottom: 15 },
  metaHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaTitle: { fontSize: 18, fontWeight: 'bold' },
  metaBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, borderRadius: 10 },
  metaBadgeText: { color: '#27ae60', fontWeight: 'bold' },
  progressBg: { height: 8, backgroundColor: '#E9ECEF', borderRadius: 4 },
  progressBar: { height: 8, backgroundColor: '#27ae60', borderRadius: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  infoBox: { flex: 0.48, backgroundColor: '#FFF', borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  infoBoxText: { marginLeft: 8, fontWeight: 'bold', fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  mealCard: { backgroundColor: '#F1F8F1', borderRadius: 20, padding: 15, marginBottom: 12 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  mealName: { fontSize: 16, fontWeight: 'bold', color: '#27ae60' },
  mealDetails: { fontSize: 12, color: '#7f8c8d' },
  mealFoodTitle: { fontWeight: 'bold', fontSize: 13, color: '#333' },
  mealFoodDesc: { fontSize: 13, color: '#666' },
  tipBox: { backgroundColor: '#E3F2FD', borderRadius: 10, padding: 10, flexDirection: 'row', marginTop: 10, alignItems: 'center' },
  tipText: { fontSize: 12, color: '#555', marginLeft: 8, flex: 1 },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 3, marginTop: 10, marginBottom: 20 },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { color: '#27ae60', fontWeight: 'bold' },
  summaryValueBlue: { color: '#3498db', fontWeight: 'bold' },
  summaryValuePurple: { color: '#9b59b6', fontWeight: 'bold' },
  summaryValueOrange: { color: '#e67e22', fontWeight: 'bold' },
  summaryLabel: { fontSize: 10 },
  footer: { backgroundColor: '#2c3e50', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15 },
  footerText: { color: '#27ae60', fontWeight: 'bold' }
});