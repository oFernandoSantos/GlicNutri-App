import { CommonActions } from '@react-navigation/native';
import { stripAuthRoutesFromPatientStack } from './navegacaoPaciente';

export const PATIENT_MAIN_TAB_ROUTES = new Set([
  'PacienteDiario',
  'PacienteMonitoramento',
  'HomePaciente',
  'PacienteAgendamentos',
  'PacientePlano',
]);

export const NUTRI_MAIN_TAB_ROUTES = new Set([
  'NutricionistaAgenda',
  'GerenciarPacientes',
  'HomeNutricionista',
  'NutricionistaMensagens',
  'NutricionistaRelatorios',
]);

export const ADMIN_MAIN_TAB_ROUTES = new Set([
  'AdminCadastros',
  'AdminHome',
  'AdminOperacoes',
  'AdminLogsSistema',
]);

function navigateToMainTab(navigation, { tabRoute, mainTabRoutes, params = {} }) {
  if (!navigation?.dispatch) {
    navigation?.navigate?.(tabRoute, params);
    return;
  }

  const state = navigation.getState?.();
  const routes = state?.routes || [];
  const index = typeof state?.index === 'number' ? state.index : Math.max(routes.length - 1, 0);
  const currentRoute = routes[index]?.name;

  if (currentRoute === tabRoute) {
    return;
  }

  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: tabRoute, params }],
    })
  );
}

export function isPatientMainTabRoute(routeName) {
  return PATIENT_MAIN_TAB_ROUTES.has(routeName);
}

export function isNutriMainTabRoute(routeName) {
  return NUTRI_MAIN_TAB_ROUTES.has(routeName);
}

export function isAdminMainTabRoute(routeName) {
  return ADMIN_MAIN_TAB_ROUTES.has(routeName);
}

export function navigatePatientTab(navigation, tabRoute, usuarioLogado, extraParams = {}) {
  stripAuthRoutesFromPatientStack(navigation);

  navigateToMainTab(navigation, {
    tabRoute,
    mainTabRoutes: PATIENT_MAIN_TAB_ROUTES,
    params: { usuarioLogado, ...extraParams },
  });
}

export function navigateNutriTab(navigation, tabRoute, usuarioLogado) {
  navigateToMainTab(navigation, {
    tabRoute,
    mainTabRoutes: NUTRI_MAIN_TAB_ROUTES,
    params: { usuarioLogado },
  });
}

export function navigateAdminTab(navigation, tabRoute, usuarioLogado) {
  navigateToMainTab(navigation, {
    tabRoute,
    mainTabRoutes: ADMIN_MAIN_TAB_ROUTES,
    params: { usuarioLogado },
  });
}
