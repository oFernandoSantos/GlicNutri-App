import { StackActions } from '@react-navigation/native';

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

/**
 * Troca entre abas principais sem reset pesado nem animação de pilha.
 */
function navigateToMainTab(navigation, { homeRoute, tabRoute, mainTabRoutes, params = {} }) {
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

  const targetIndex = routes.findIndex((route) => route.name === tabRoute);

  if (targetIndex >= 0 && targetIndex < index) {
    navigation.dispatch(StackActions.pop(index - targetIndex));
    return;
  }

  if (currentRoute && mainTabRoutes.has(currentRoute) && mainTabRoutes.has(tabRoute)) {
    navigation.dispatch(StackActions.replace(tabRoute, params));
    return;
  }

  if (tabRoute === homeRoute) {
    const homeIndex = routes.findIndex((route) => route.name === homeRoute);
    if (homeIndex >= 0 && index > homeIndex) {
      navigation.dispatch(StackActions.pop(index - homeIndex));
      return;
    }
    navigation.navigate(homeRoute, params);
    return;
  }

  navigation.navigate(tabRoute, params);
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
  navigateToMainTab(navigation, {
    homeRoute: 'HomePaciente',
    tabRoute,
    mainTabRoutes: PATIENT_MAIN_TAB_ROUTES,
    params: { usuarioLogado, ...extraParams },
  });
}

export function navigateNutriTab(navigation, tabRoute, usuarioLogado) {
  navigateToMainTab(navigation, {
    homeRoute: 'HomeNutricionista',
    tabRoute,
    mainTabRoutes: NUTRI_MAIN_TAB_ROUTES,
    params: { usuarioLogado },
  });
}

export function navigateAdminTab(navigation, tabRoute, usuarioLogado) {
  navigateToMainTab(navigation, {
    homeRoute: 'AdminHome',
    tabRoute,
    mainTabRoutes: ADMIN_MAIN_TAB_ROUTES,
    params: { usuarioLogado },
  });
}
