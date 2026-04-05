import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MenuLateral({
  visivel,
  aoFechar,
  onNavigate,
  onLogout,
  usuario,
}) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const drawerWidth = Math.min(width - 12, compact ? width * 0.88 : width * 0.72, 360);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visivel}
      onRequestClose={aoFechar}
    >
      <View style={styles.containerPrincipal}>
        <TouchableOpacity
          style={styles.fecharArea}
          activeOpacity={1}
          onPress={aoFechar}
        />

        <SafeAreaView style={[styles.menuConteudo, { width: drawerWidth }]}>
          <View style={[styles.headerMenu, compact && styles.headerMenuCompact]}>
            <View style={styles.headerInfo}>
              <Text style={[styles.logoMenu, compact && styles.logoMenuCompact]}>Menu</Text>
              {!!usuario && (
                <Text
                  style={[styles.usuarioTexto, compact && styles.usuarioTextoCompact]}
                  numberOfLines={2}
                >
                  {usuario}
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.botaoFechar} onPress={aoFechar}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.opcoes, compact && styles.opcoesCompact]}>
            <TouchableOpacity
              style={[styles.item, compact && styles.itemCompact]}
              onPress={() => {
                aoFechar();
                setTimeout(() => {
                  onNavigate('HomePaciente');
                }, 100);
              }}
            >
              <Ionicons name="home" size={24} color="#27ae60" />
              <Text style={styles.textoItem}>Início</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.item, compact && styles.itemCompact]}
              onPress={() => {
                aoFechar();
                setTimeout(() => {
                  if (onLogout) onLogout();
                }, 150);
              }}
            >
              <Ionicons name="log-out-outline" size={24} color="#E74C3C" />
              <Text
                style={[
                  styles.textoItem,
                  compact && styles.textoItemCompact,
                  styles.textoSair,
                ]}
              >
                Sair
              </Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  containerPrincipal: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fecharArea: {
    flex: 1,
  },
  menuConteudo: {
    backgroundColor: '#f4f4f4',
    height: '100%',
    maxWidth: '100%',
    borderWidth: 1.5,
    borderColor: '#f4f4f4',
  },
  headerMenu: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerMenuCompact: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 28,
  },
  headerInfo: {
    flex: 1,
    paddingRight: 12,
  },
  logoMenu: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },
  logoMenuCompact: {
    fontSize: 20,
  },
  usuarioTexto: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  usuarioTextoCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  botaoFechar: {
    marginLeft: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  opcoes: {
    padding: 20,
  },
  opcoesCompact: {
    padding: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  itemCompact: {
    paddingVertical: 14,
  },
  textoItem: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
  },
  textoItemCompact: {
    marginLeft: 12,
    fontSize: 15,
  },
  textoSair: {
    color: '#E74C3C',
  },
});
