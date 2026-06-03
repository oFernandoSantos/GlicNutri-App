import React from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

const menuItems = [
  {
    label: 'Agendamentos',
    route: 'PacienteAgendamentos',
    icon: 'calendar-outline',
    library: 'ion',
  },
  { label: 'Alimentação', route: 'PacienteDiario', icon: 'book-outline', library: 'ion' },
  { label: 'Bem-estar', route: 'PacienteBemEstar', icon: 'body-outline', library: 'ion' },
  {
    label: 'Conversas',
    route: 'PacienteChatNutricionista',
    icon: 'chatbubble-ellipses-outline',
    library: 'ion',
  },
  { label: 'Glicose', route: 'PacienteMonitoramento', icon: 'pulse-outline', library: 'ion' },
  {
    label: 'Histórico de Registros',
    route: 'PacienteHistoricoRegistros',
    icon: 'document-text-outline',
    library: 'ion',
  },
  {
    label: 'Relatórios',
    route: 'PacienteRelatorios',
    icon: 'bar-chart-outline',
    library: 'ion',
  },
  {
    label: 'Insulina Basal',
    route: 'PacientePerfilInsulinas',
    params: { initialInsulinProfileKey: 'basal' },
    icon: 'needle',
    library: 'material',
  },
  {
    label: 'Insulina Bolus',
    route: 'PacientePerfilInsulinas',
    params: { initialInsulinProfileKey: 'bolus' },
    icon: 'needle',
    library: 'material',
  },
  { label: 'Plano', route: 'PacientePlano', icon: 'food-apple-outline', library: 'material' },
  { label: 'Previsão (IA)', route: 'PacientePrevisaoML', icon: 'analytics-outline', library: 'ion' },
  {
    label: 'Progresso',
    route: 'PacienteProgresso',
    icon: 'stats-chart-outline',
    library: 'ion',
  },
  { label: 'Suporte', route: 'PacienteSuporte', icon: 'headset', library: 'material' },
];

function DrawerIcon({ item, active }) {
  const color = active ? patientTheme.colors.primaryDark : patientTheme.colors.textMuted;

  if (item.library === 'material') {
    return <MaterialCommunityIcons name={item.icon} size={20} color={color} />;
  }

  return <Ionicons name={item.icon} size={20} color={color} />;
}

function getFirstName(name) {
  return String(name || 'Paciente')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || 'Paciente';
}

export default function PatientDrawer({
  visible,
  onClose,
  onNavigate,
  onLogout,
  currentRoute,
  userName,
}) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const drawerWidth = Math.min(width - 12, compact ? width * 0.9 : width * 0.78, 380);

  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <SafeAreaView
          edges={Platform.OS === 'web' ? undefined : ['top']}
          style={[styles.drawer, { width: drawerWidth }]}
        >
          <View style={[styles.header, compact && styles.headerCompact]}>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.headerProfilePress}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  onNavigate('PacientePerfil');
                }, 120);
              }}
            >
              <View style={[styles.avatar, compact && styles.avatarCompact]}>
                <Text style={[styles.avatarText, compact && styles.avatarTextCompact]}>
                  {(userName || 'P').trim().slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <View style={styles.headerText}>
                <Text style={[styles.title, compact && styles.titleCompact]}>Perfil</Text>
                <Text
                  style={[styles.userName, compact && styles.userNameCompact]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {getFirstName(userName)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar menu"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
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
                    key={`${item.route}-${item.label}`}
                    style={[
                      styles.menuItem,
                      compact && styles.menuItemCompact,
                      active && styles.menuItemActive,
                    ]}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        onNavigate(item.route, item.params);
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
                <Ionicons name="log-out-outline" size={22} color="#dc2626" />
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    ...patientShadow,
  },
  headerProfilePress: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  headerCompact: {
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  avatarTextCompact: {
    fontSize: 16,
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
    fontSize: 17,
    fontWeight: '700',
  },
  userNameCompact: {
    fontSize: 15,
  },
  closeButton: {
    marginLeft: 8,
  },
  menuList: {
    paddingHorizontal: 16,
    gap: 6,
  },
  menuListCompact: {
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.lg,
  },
  menuItemCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  menuItemActive: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  menuLabel: {
    flexShrink: 1,
    marginLeft: 10,
    fontSize: 14,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  menuLabelCompact: {
    marginLeft: 9,
    fontSize: 13,
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
  },
  logoutButtonCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  logoutText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#b91c1c',
    fontWeight: '700',
  },
  logoutTextCompact: {
    marginLeft: 10,
    fontSize: 14,
  },
});
