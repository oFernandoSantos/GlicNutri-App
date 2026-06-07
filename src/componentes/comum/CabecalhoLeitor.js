import React from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { nutriTheme } from '../../temas/temaVisualNutricionista';
import { adminTheme } from '../../temas/temaVisualAdmin';
import { StackActions } from '@react-navigation/native';
import { stripAuthRoutesFromPatientStack } from '../../utilitarios/navegacaoPaciente';

const HOME_ROUTES = new Set(['HomePaciente', 'HomeNutricionista', 'HomeMedico', 'AdminHome']);
const AUTH_BACK_ROUTES = new Set(['Cadastro', 'ForgotPassword']);
const PATIENT_ROUTES = new Set([
  'PacienteDiario',
  'PacienteMonitoramento',
  'PacienteHistoricoRegistros',
  'PacienteSuporte',
  'PacienteAgendamentos',
  'PacientePlano',
  'PacienteProgresso',
  'PacienteRelatorios',
  'PacientePerfil',
  'PacientePerfilContato',
  'PacientePerfilSaude',
  'PacientePerfilNotificacoes',
  'PacientePerfilPrivacidade',
  'PacientePerfilIntegracao',
  'PacientePerfilInsulinas',
  'PacientePrevisaoML',
  'RegistroRefeicaoIA',
  'PacienteChatNutricionista',
  'PacienteChatNutricionistaDetalhe',
  'PacientePerfilNutricionista',
  'PacientePerfilMedico',
]);
const NUTRITIONIST_ROUTES = new Set([
  'GerenciarPacientes',
  'NutricionistaAgenda',
  'NutricionistaMensagens',
  'NutricionistaRelatorios',
  'NutriProntuarioPaciente',
  'NutriConsultaNutri',
]);
const ADMIN_ROUTES = new Set([
  'AdminAuditoria',
  'AdminCadastros',
  'AdminCadastroAdministrador',
  'AdminOperacoes',
  'AdminLogsSistema',
  'AdminDetalheLogSistema',
]);
const MEDICO_ROUTES = new Set([
  'MedicoPacientes',
  'MedicoAgenda',
  'MedicoMensagens',
  'MedicoRelatorios',
  'MedicoProntuarioPaciente',
  'MedicoConsulta',
]);

const routeTitles = {
  HomePaciente: 'GlicNutri',
  Login: 'GlicNutri',
  Cadastro: 'Cadastro',
  ForgotPassword: 'Recuperar senha',
  PacienteDiario: 'Alimentação',
  PacienteMonitoramento: 'Glicose',
  PacienteHistoricoRegistros: 'Histórico de Registros',
  PacienteSuporte: 'Suporte',
  PacienteAgendamentos: 'Agendamentos',
  PacientePlano: 'Plano',
  PacienteProgresso: 'Progresso',
  PacienteRelatorios: 'Relatórios',
  PacientePerfil: 'Perfil',
  PacientePerfilContato: 'Identificação e contato',
  PacientePerfilSaude: 'Saúde, metas e rotina',
  PacientePerfilNotificacoes: 'Notificações',
  PacientePerfilPrivacidade: 'Privacidade e segurança',
  PacientePerfilIntegracao: 'Integração do sensor',
  PacientePerfilInsulinas: 'Insulinas em uso',
  PacientePrevisaoML: 'Previsão (IA)',
  RegistroRefeicaoIA: 'Registrar Refeição',
  PacienteChatNutricionista: 'Mensagens',
  PacienteChatNutricionistaDetalhe: 'Conversa',
  PacientePerfilNutricionista: 'Nutricionista',
  PacientePerfilMedico: 'Médico',
  HomeNutricionista: 'GlicNutri',
  AdminHome: 'Admin',
  AdminAuditoria: 'Auditoria',
  AdminCadastros: 'Cadastros',
  AdminCadastroAdministrador: 'Cadastrar admin',
  AdminOperacoes: 'Operacoes',
  AdminLogsSistema: 'Auditoria/Log',
  AdminDetalheLogSistema: 'Detalhe do Log',
  GerenciarPacientes: 'Pacientes',
  NutricionistaAgenda: 'Agenda',
  NutricionistaMensagens: 'Mensagens',
  NutricionistaRelatorios: 'Relatórios',
  NutriProntuarioPaciente: 'Prontuário',
  NutriConsultaNutri: 'Consulta',
  HomeMedico: 'GlicNutri',
  MedicoAgenda: 'Agenda',
  MedicoPacientes: 'Pacientes',
  MedicoMensagens: 'Mensagens',
  MedicoRelatorios: 'Relatórios',
  MedicoProntuarioPaciente: 'Prontuário',
  MedicoConsulta: 'Consulta',
};

const ROUTE_BACK_FALLBACK = {
  PacienteChatNutricionistaDetalhe: 'PacienteChatNutricionista',
  PacientePerfilNutricionista: 'PacienteAgendamentos',
  PacientePerfilMedico: 'PacienteAgendamentos',
  NutriProntuarioPaciente: 'GerenciarPacientes',
  NutriConsultaNutri: 'NutricionistaAgenda',
  AdminDetalheLogSistema: 'AdminLogsSistema',
  AdminCadastroAdministrador: 'AdminCadastros',
  MedicoProntuarioPaciente: 'MedicoPacientes',
  MedicoConsulta: 'MedicoAgenda',
};

function getTitle(route) {
  if (HOME_ROUTES.has(route?.name)) {
    return 'GlicNutri';
  }

  return routeTitles[route?.name] || route?.name || 'GlicNutri';
}

function getHomeRoute(route) {
  if (ROUTE_BACK_FALLBACK[route?.name]) {
    return ROUTE_BACK_FALLBACK[route.name];
  }

  if (route?.name === 'RegistroRefeicaoIA') {
    return 'PacienteDiario';
  }

  if (route?.name === 'AdminHome' || ADMIN_ROUTES.has(route?.name)) {
    return 'AdminHome';
  }

  if (route?.name === 'HomeNutricionista' || NUTRITIONIST_ROUTES.has(route?.name)) {
    return 'HomeNutricionista';
  }

  if (route?.name === 'HomeMedico' || MEDICO_ROUTES.has(route?.name)) {
    return 'HomeMedico';
  }

  if (route?.name === 'HomePaciente' || PATIENT_ROUTES.has(route?.name)) {
    return 'HomePaciente';
  }

  return 'HomePaciente';
}

export default function ReaderTopo({ navigation, route, options }) {
  const insets = useSafeAreaInsets();
  const title = options?.readerTitle || getTitle(route);
  const readerBackgroundColor = options?.readerBackgroundColor || null;
  const readerAccentColor = options?.readerAccentColor || null;
  const topSpacing = Platform.OS === 'web' ? 0 : insets.top || StatusBar.currentHeight || 0;
  const isHome = HOME_ROUTES.has(route?.name);
  const isLogin = route?.name === 'Login';
  const isAdminLogin = isLogin && route?.params?.roleInicial === 'Admin';
  const isAuthBack = AUTH_BACK_ROUTES.has(route?.name);
  const hideCenteredTitle = isLogin || isAuthBack;
  const isPatientHome = route?.name === 'HomePaciente';
  const isNutriHome = route?.name === 'HomeNutricionista';
  const isNutriContext =
    isNutriHome || NUTRITIONIST_ROUTES.has(route?.name);
  const isAdminHome = route?.name === 'AdminHome';
  const isAdminContext = isAdminLogin || isAdminHome || ADMIN_ROUTES.has(route?.name);
  const accentColor =
    readerAccentColor ||
    (isAdminContext
      ? adminTheme.colors.primary
      : isNutriContext
        ? nutriTheme.colors.primary
        : patientTheme.colors.primary);
  const menuAction = options?.readerOnMenuPress;
  const menuDisabled = options?.readerMenuDisabled;
  const menuLoading = options?.readerMenuLoading;
  const notificationCount = Number(options?.readerNotificationCount || 0);
  const notificationAction = options?.readerOnNotificationPress;
  const notificationDisabled = options?.readerNotificationDisabled;
  const rightAction = options?.readerRightAction;
  const rightActionIcon = options?.readerRightIcon || 'refresh-outline';
  const rightActionDisabled = options?.readerRightDisabled;
  const rightActionLoading = options?.readerRightLoading;
  const rightActionLabel = options?.readerRightAccessibilityLabel || 'Acao';
  const extraContent = options?.readerExtraContent;
  const backAction = options?.readerBackAction;
  const hasNotifications = notificationCount > 0;
  const shouldShowNotificationButton = Boolean(notificationAction) && !isAdminContext;
  const shouldShowMenuButton = Boolean(menuAction) && (isHome || isAdminContext);

  function voltarDaAlimentacaoParaInicio() {
    if (route?.name !== 'PacienteDiario') {
      return false;
    }

    const state = navigation?.getState?.();
    const routes = state?.routes || [];
    const index = typeof state?.index === 'number' ? state.index : routes.length - 1;
    const telaAnterior = routes[index - 1]?.name;

    if (
      index <= 0 ||
      !['RegistroRefeicaoIA', 'PacienteDiario'].includes(telaAnterior)
    ) {
      return false;
    }

    stripAuthRoutesFromPatientStack(navigation);
    navigation.dispatch(StackActions.popToTop());
    return true;
  }

  function handleBack() {
    if (backAction) {
      backAction();
      return;
    }

    stripAuthRoutesFromPatientStack(navigation);

    if (voltarDaAlimentacaoParaInicio()) {
      return;
    }

    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

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
    <View
      style={[
        styles.reader,
        isAdminContext && styles.readerAdmin,
        readerBackgroundColor ? { backgroundColor: readerBackgroundColor, borderColor: readerBackgroundColor, borderBottomColor: readerBackgroundColor, shadowOpacity: 0, elevation: 0 } : null,
        Platform.OS === 'web' && styles.readerWebFixed,
      ]}
    >
      <View style={{ height: topSpacing }} />

      <View style={[styles.bar, isAdminContext && styles.barAdmin]}>
        <View style={[styles.side, isAdminContext && styles.sideAdmin, isLogin && styles.brandSide]}>
          {isLogin ? (
            <Text style={[styles.brandText, isAdminContext && styles.brandTextAdmin]} numberOfLines={1}>
              GlicNutri
            </Text>
          ) : shouldShowMenuButton ? (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel="Abrir menu"
              accessibilityRole="button"
              disabled={menuDisabled || menuLoading}
              onPress={menuAction}
              style={[
                styles.readerButton,
                isAdminContext && styles.readerButtonAdmin,
                readerBackgroundColor && styles.readerButtonThemed,
                (menuDisabled || menuLoading) && styles.readerButtonDisabled,
              ]}
            >
              {menuLoading ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Ionicons
                  name="menu-outline"
                  size={22}
                  color={accentColor}
                />
              )}
            </TouchableOpacity>
          ) : isAuthBack || !isHome ? (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              onPress={handleBack}
              style={[
                styles.readerButton,
                isAdminContext && styles.readerButtonAdmin,
                readerBackgroundColor && styles.readerButtonThemed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={accentColor}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {!hideCenteredTitle ? (
          <View pointerEvents="none" style={styles.titleWrap}>
            <Text
              style={[
                styles.title,
                isAdminContext && styles.titleAdmin,
                isNutriContext && styles.titleNutri,
                readerAccentColor ? { color: readerAccentColor } : null,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        ) : null}

        <View style={[styles.side, isAdminContext && styles.sideAdmin, styles.sideRight]}>
          {rightAction ? (
            <TouchableOpacity
              activeOpacity={0.78}
              accessibilityLabel={rightActionLabel}
              accessibilityRole="button"
              disabled={rightActionDisabled || rightActionLoading}
              onPress={rightAction}
              style={[
                styles.readerButton,
                isAdminContext && styles.readerButtonAdmin,
                (rightActionDisabled || rightActionLoading) && styles.readerButtonDisabled,
              ]}
            >
              {rightActionLoading ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Ionicons name={rightActionIcon} size={21} color={accentColor} />
              )}
            </TouchableOpacity>
          ) : shouldShowNotificationButton ? (
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
                isAdminContext && styles.readerButtonAdmin,
                notificationDisabled && styles.readerButtonDisabled,
              ]}
            >
              <Ionicons name="notifications-outline" size={21} color={accentColor} />
              {hasNotifications ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {extraContent ? (
        <View style={[styles.extraContent, isAdminContext && styles.extraContentAdmin]}>{extraContent}</View>
      ) : null}
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
  readerAdmin: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.background,
    borderBottomColor: adminTheme.colors.background,
    borderWidth: 0,
    borderBottomWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
  barAdmin: {
    height: 58,
    paddingHorizontal: 12,
  },
  side: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 56,
  },
  sideAdmin: {
    width: 48,
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
  brandTextAdmin: {
    color: adminTheme.colors.primary,
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
  readerButtonAdmin: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.background,
  },
  readerButtonThemed: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
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
  titleAdmin: {
    color: adminTheme.colors.primary,
  },
  titleNutri: {
    color: nutriTheme.colors.primary,
  },
  extraContent: {
    backgroundColor: '#ffffff',
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  extraContentAdmin: {
    backgroundColor: adminTheme.colors.background,
  },
});
