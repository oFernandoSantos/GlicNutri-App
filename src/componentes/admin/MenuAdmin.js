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
import { Ionicons } from '@expo/vector-icons';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';

const menuItems = [
  { label: 'Inicio', route: 'AdminHome', icon: 'home-outline' },
  { label: 'Cadastros', route: 'AdminCadastros', icon: 'person-add-outline' },
  { label: 'Cadastrar admin', route: 'AdminCadastroAdministrador', icon: 'shield-checkmark-outline' },
  { label: 'Operacoes', route: 'AdminOperacoes', icon: 'briefcase-outline' },
  { label: 'Auditoria/Log', route: 'AdminLogsSistema', icon: 'pulse-outline' },
];

export default function MenuAdmin({
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
  const drawerWidth = Math.min(width - 12, compact ? width * 0.9 : width * 0.78, 400);

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
            <View style={[styles.avatar, compact && styles.avatarCompact]}>
              <Text style={[styles.avatarText, compact && styles.avatarTextCompact]}>
                {(userName || 'A').trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.headerText}>
              <Text style={[styles.title, compact && styles.titleCompact]}>
                Painel administrativo
              </Text>
              <Text
                style={[styles.userName, compact && styles.userNameCompact]}
                numberOfLines={2}
              >
                {userName || 'Administrador'}
              </Text>
              <Text
                style={[styles.userSubtitle, compact && styles.userSubtitleCompact]}
                numberOfLines={3}
              >
                {userSubtitle || 'Governanca, auditoria e observabilidade em um unico lugar'}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={adminTheme.colors.onPrimary} />
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
                        onNavigate(item.route, item.params);
                      }, 120);
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={active ? adminTheme.colors.primary : adminTheme.colors.textMuted}
                    />
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
                <Ionicons name="log-out-outline" size={22} color={adminTheme.colors.danger} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    zIndex: 1,
  },
  drawer: {
    backgroundColor: adminTheme.colors.panel,
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
    borderRadius: adminTheme.radius.xl,
    backgroundColor: adminTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...adminShadow,
  },
  headerCompact: {
    margin: 12,
    padding: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(9,20,19,0.16)',
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
    color: adminTheme.colors.onPrimary,
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
    color: 'rgba(9,20,19,0.76)',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '800',
  },
  titleCompact: {
    fontSize: 11,
  },
  userName: {
    color: adminTheme.colors.onPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  userNameCompact: {
    fontSize: 16,
  },
  userSubtitle: {
    color: 'rgba(9,20,19,0.82)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '600',
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
    borderRadius: adminTheme.radius.lg,
  },
  menuItemCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: adminTheme.colors.primarySoft,
  },
  menuLabel: {
    flexShrink: 1,
    marginLeft: 12,
    fontSize: 15,
    color: adminTheme.colors.text,
    fontWeight: '700',
  },
  menuLabelCompact: {
    marginLeft: 10,
    fontSize: 14,
  },
  menuLabelActive: {
    color: adminTheme.colors.primary,
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
    borderRadius: adminTheme.radius.lg,
    backgroundColor: adminTheme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: adminTheme.colors.danger,
  },
  logoutButtonCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  logoutText: {
    marginLeft: 12,
    fontSize: 15,
    color: adminTheme.colors.danger,
    fontWeight: '800',
  },
  logoutTextCompact: {
    marginLeft: 10,
    fontSize: 14,
  },
});
