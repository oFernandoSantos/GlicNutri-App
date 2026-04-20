import React from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

const HOME_ROUTES = new Set(['HomePaciente', 'HomeNutricionista']);
const AUTH_BACK_ROUTES = new Set(['Cadastro', 'ForgotPassword']);
const PATIENT_ROUTES = new Set([
  'PacienteDiario',
  'PacienteMonitoramento',
  'PacienteAssistente',
  'PacienteAgendamentos',
  'PacienteBemEstar',
  'PacientePlano',
  'PacientePerfil',
]);
const NUTRITIONIST_ROUTES = new Set([
  'GerenciarPacientes',
  'NutricionistaAgenda',
  'NutricionistaMensagens',
  'NutricionistaRelatorios',
]);

const routeTitles = {
  HomePaciente: 'GlicNutri',
  Login: 'GlicNutri',
  Cadastro: 'Cadastro',
  ForgotPassword: 'Recuperar senha',
  PacienteDiario: 'Diário',
  PacienteMonitoramento: 'Glicose',
  PacienteAssistente: 'IA',
  PacienteAgendamentos: 'Agendamentos',
  PacienteBemEstar: 'Bem-estar',
  PacientePlano: 'Plano',
  PacientePerfil: 'Perfil',
  HomeNutricionista: 'GlicNutri',
  GerenciarPacientes: 'Pacientes',
  NutricionistaAgenda: 'Agenda',
  NutricionistaMensagens: 'Mensagens',
  NutricionistaRelatorios: 'Relatórios',
};

function getTitle(route) {
  if (HOME_ROUTES.has(route?.name)) {
    return 'GlicNutri';
  }

  return routeTitles[route?.name] || route?.name || 'GlicNutri';
}

function getHomeRoute(route) {
  if (route?.name === 'HomeNutricionista' || NUTRITIONIST_ROUTES.has(route?.name)) {
    return 'HomeNutricionista';
  }

  if (route?.name === 'HomePaciente' || PATIENT_ROUTES.has(route?.name)) {
    return 'HomePaciente';
  }

  return 'HomePaciente';
}

export default function ReaderTopo({ navigation, route, options }) {
  const title = getTitle(route);
  const topSpacing = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  const isHome = HOME_ROUTES.has(route?.name);
  const isLogin = route?.name === 'Login';
  const isAuthBack = AUTH_BACK_ROUTES.has(route?.name);
  const hideCenteredTitle = isLogin || isAuthBack;
  const isPatientHome = route?.name === 'HomePaciente';
  const menuAction = options?.readerOnMenuPress;
  const menuDisabled = options?.readerMenuDisabled;
  const menuLoading = options?.readerMenuLoading;
  const notificationCount = Number(options?.readerNotificationCount || 0);
  const notificationAction = options?.readerOnNotificationPress;
  const notificationDisabled = options?.readerNotificationDisabled;
  const hasNotifications = notificationCount > 0;

  function handleBack() {
    if (isAuthBack) {
      navigation?.navigate?.('Login');
      return;
    }

    const homeRoute = getHomeRoute(route);
    const params = route?.params || {};

    if (navigation?.reset) {
      navigation.reset({
        index: 0,
        routes: [{ name: homeRoute, params }],
      });
      return;
    }

    navigation?.navigate?.(homeRoute, params);
  }

  return (
    <View style={[styles.reader, Platform.OS === 'web' && styles.readerWebFixed]}>
      <View style={{ height: topSpacing }} />

      <View style={styles.bar}>
        <View style={[styles.side, isLogin && styles.brandSide]}>
          {isLogin ? (
            <Text style={styles.brandText} numberOfLines={1}>
              GlicNutri
            </Text>
          ) : isPatientHome ? (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel="Abrir menu"
              accessibilityRole="button"
              disabled={menuDisabled || menuLoading}
              onPress={menuAction}
              style={[styles.readerButton, (menuDisabled || menuLoading) && styles.readerButtonDisabled]}
            >
              {menuLoading ? (
                <ActivityIndicator size="small" color={patientTheme.colors.primary} />
              ) : (
                <Ionicons name="menu-outline" size={22} color={patientTheme.colors.primary} />
              )}
            </TouchableOpacity>
          ) : isAuthBack || !isHome ? (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              onPress={handleBack}
              style={styles.readerButton}
            >
              <Ionicons name="chevron-back" size={22} color={patientTheme.colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!hideCenteredTitle ? (
          <View pointerEvents="none" style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>
        ) : null}

        <View style={[styles.side, styles.sideRight]}>
          {isPatientHome ? (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel={
                hasNotifications
                  ? `${notificationCount} notificacoes`
                  : 'Nenhuma notificação'
              }
              accessibilityRole="button"
              disabled={notificationDisabled}
              onPress={notificationAction}
              style={[
                styles.readerButton,
                notificationDisabled && styles.readerButtonDisabled,
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color={patientTheme.colors.primary}
              />
              {hasNotifications ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : isHome ? (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel="Abrir menu"
              accessibilityRole="button"
              disabled={menuDisabled || menuLoading}
              onPress={menuAction}
              style={[styles.readerButton, (menuDisabled || menuLoading) && styles.readerButtonDisabled]}
            >
              {menuLoading ? (
                <ActivityIndicator size="small" color={patientTheme.colors.primary} />
              ) : (
                <Ionicons name="menu-outline" size={22} color={patientTheme.colors.primary} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reader: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#ffffff',
    borderBottomWidth: 1,
    width: '100%',
    ...patientShadow,
    borderColor: '#ffffff',
    borderBottomColor: '#ffffff',
  },
  readerWebFixed: {
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'relative',
  },
  side: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 56,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  brandSide: {
    flex: 1,
    width: 'auto',
  },
  brandText: {
    color: patientTheme.colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  readerButton: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderColor: '#f4f4f4',
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
    ...patientShadow,
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: '#ff1f1f',
    borderColor: '#ffffff',
    borderRadius: 9,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -2,
    top: -2,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  readerButtonDisabled: {
    opacity: 0.6,
  },
  titleWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 78,
    position: 'absolute',
    right: 78,
    top: 0,
  },
  title: {
    color: patientTheme.colors.primary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
