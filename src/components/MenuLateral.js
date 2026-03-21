import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function MenuLateral({ visivel, aoFechar, onNavigate, usuario }) {
  return (
    <Modal
      animationType="fade" // Troque para fade para testar a visibilidade
      transparent={true}
      visible={visivel}
      onRequestClose={aoFechar} // Para o botão "voltar" do Android
    >
      <View style={styles.containerPrincipal}>
        {/* Área para fechar ao clicar fora (lado direito) */}
        <TouchableOpacity 
          style={styles.fecharArea} 
          activeOpacity={1} 
          onPress={aoFechar} 
        />
        
        {/* Conteúdo que desliza da esquerda */}
        <SafeAreaView style={styles.menuConteudo}>
          <View style={styles.headerMenu}>
            <Text style={styles.logoMenu}>Menu</Text>
            <TouchableOpacity onPress={aoFechar}>
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.opcoes}>
            <TouchableOpacity style={styles.item} onPress={() => onNavigate('HomePaciente')}>
              <Ionicons name="home" size={24} color="#27ae60" />
              <Text style={styles.textoItem}>Início</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} onPress={() => onNavigate('Login')}>
              <Ionicons name="log-out-outline" size={24} color="#E74C3C" />
              <Text style={[styles.textoItem, {color: '#E74C3C'}]}>Sair</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  containerPrincipal: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)', // Escurece o fundo
  },
  menuConteudo: {
    width: width * 0.7, // 70% da largura da tela
    backgroundColor: '#FFF',
    height: '100%',
  },
  fecharArea: {
    width: width * 0.3, // 30% restante para fechar
    height: '100%',
  },
  headerMenu: {
    backgroundColor: '#27ae60',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50
  },
  logoMenu: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  opcoes: { padding: 20 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  textoItem: { marginLeft: 15, fontSize: 16, color: '#333' }
});