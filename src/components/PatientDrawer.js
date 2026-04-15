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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../theme/patientTheme';

const menuItems = [
  { label: 'Inicio', route: 'HomePaciente', icon: 'home-outline', library: 'ion' },
  { label: 'Diario', route: 'PacienteDiario', icon: 'book-outline', library: 'ion' },
  { label: 'Glicose', route: 'PacienteMonitoramento', icon: 'pulse-outline', library: 'ion' },
  { label: 'Assistente IA', route: 'PacienteAssistente', icon: 'sparkles-outline', library: 'ion' },
  { label: 'Bem-estar', route: 'PacienteBemEstar', icon: 'body-outline', library: 'ion' },
  { label: 'Meu plano', route: 'PacientePlano', icon: 'food-apple-outline', library: 'material' },
  { label: 'Perfil', route: 'PacientePerfil', icon: 'person-circle-outline', library: 'ion' },
];

function DrawerIcon({ item, active }) {
  const color = active ? patientTheme.colors.primaryDark : patientTheme.colors.textMuted;

  if (item.library === 'material') {
    return <MaterialCommunityIcons name={item.icon} size={22} color={color} />;
  }

  return <Ionicons name={item.icon} size={22} color={color} />;
}

export default function PatientDrawer({
  visible,
  onClose,
  onNavigate,
  onLogout,
  currentRoute,
  userName,
  userSubtitle,
}) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const drawerWidth = Math.min(width - 12, compact ? width * 0.9 : width * 0.78, 380);

  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <SafeAreaView style={[styles.drawer, { width: drawerWidth }]}>
          <View style={[styles.header, compact && styles.headerCompact]}>
            <View style={[styles.avatar, compact && styles.avatarCompact]}>
              <Text style={[styles.avatarText, compact && styles.avatarTextCompact]}>
                {(userName || 'P').trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.headerText}>
              <Text style={[styles.title, compact && styles.titleCompact]}>Sua jornada</Text>
              <Text
                style={[styles.userName, compact && styles.userNameCompact]}
                numberOfLines={2}
              >
                {userName || 'Paciente'}
              </Text>
              <Text
                style={[styles.userSubtitle, compact && styles.userSubtitleCompact]}
                numberOfLines={3}
              >
                {userSubtitle || 'Acompanhe glicose, rotina e plano alimentar'}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={patientTheme.colors.onPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.menuList, compact && styles.menuListCompact]}>
              {menuItems.map((item) => {
                const active = currentRoute === item.route;

                return (
                  <TouchableOpacity
                    key={item.route}
                    style={[
                      styles.menuItem,
                      compact && styles.menuItemCompact,
                      active && styles.menuItemActive,
                    ]}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        onNavigate(item.route);
                      }, 120);
                    }}
                  >
                    <DrawerIcon item={item} active={active} />
                    <Text
                      style={[
                        styles.menuLabel,
                        compact && styles.menuLabelCompact,
                        active && styles.menuLabelActive,
                      ]}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.logoutButton, compact && styles.logoutButtonCompact]}
                onPress={() => {
                  onClose();
                  setTimeout(() => {
                    if (onLogout) onLogout();
                  }, 120);
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="#d96666" />
                <Text style={[styles.logoutText, compact && styles.logoutTextCompact]}>
                  Sair da conta
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
  root: {
    flex: 1,
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: patientTheme.colors.overlay,
    zIndex: 1,
  },
  drawer: {
    backgroundColor: patientTheme.colors.surface,
    bottom: 0,
    elevation: 2,
    height: '100%',
    left: 0,
    maxWidth: '100%',
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  header: {
    margin: 16,
    padding: 18,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...patientShadow,
  },
  headerCompact: {
    margin: 12,
    padding: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  avatarText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  avatarTextCompact: {
    fontSize: 18,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  titleCompact: {
    fontSize: 11,
  },
  userName: {
    color: patientTheme.colors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  userNameCompact: {
    fontSize: 16,
  },
  userSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  userSubtitleCompact: {
    fontSize: 11,
    lineHeight: 16,
  },
  closeButton: {
    marginLeft: 8,
  },
  menuList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  menuListCompact: {
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: patientTheme.radius.lg,
  },
  menuItemCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  menuLabel: {
    flexShrink: 1,
    marginLeft: 12,
    fontSize: 15,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  menuLabelCompact: {
    marginLeft: 10,
    fontSize: 14,
  },
  menuLabelActive: {
    color: patientTheme.colors.primaryDark,
  },
  footer: {
    marginTop: 'auto',
    padding: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: '#fff4f4',
  },
  logoutButtonCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  logoutText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#d96666',
    fontWeight: '700',
  },
  logoutTextCompact: {
    marginLeft: 10,
    fontSize: 14,
  },
});
