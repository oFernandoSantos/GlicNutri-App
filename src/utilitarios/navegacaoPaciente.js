import { CommonActions } from '@react-navigation/native';

const AUTH_STACK_ROUTES = new Set([
  'Intro',
  'Login',
  'Cadastro',
  'ForgotPassword',
]);

export const PATIENT_APP_ROUTE_NAMES = new Set([
  'PacienteOnboarding',
  'HomePaciente',
  'PacienteDiario',
  'PacienteMonitoramento',
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
  'PacienteHistoricoRegistros',
  'PacienteSuporte',
  'RegistroRefeicaoIA',
  'PacienteChatNutricionista',
  'PacienteChatNutricionistaDetalhe',
  'PacienteChatMedicoDetalhe',
  'PacientePrevisaoML',
  'PacientePerfilNutricionista',
  'PacientePerfilMedico',
]);

export function patientAppAlreadyActive(navigation) {
  const routes = navigation?.getState?.()?.routes || [];
  return routes.some((route) => PATIENT_APP_ROUTE_NAMES.has(route.name));
}

/**
 * Remove Intro/Login/Cadastro de qualquer posição da pilha do paciente.
 */
export function stripAuthRoutesFromPatientStack(navigation) {
  if (!navigation?.getState || !navigation?.reset) {
    return false;
  }

  const state = navigation.getState();
  const routes = state?.routes || [];

  if (!routes.length) {
    return false;
  }

  const patientRoutes = routes.filter((route) => !AUTH_STACK_ROUTES.has(route.name));

  if (!patientRoutes.length || patientRoutes.length === routes.length) {
    return false;
  }

  const currentName = routes[state.index]?.name;
  let nextIndex = patientRoutes.findIndex((route) => route.name === currentName);

  if (nextIndex < 0) {
    nextIndex = patientRoutes.length - 1;
  }

  navigation.reset({
    index: nextIndex,
    routes: patientRoutes,
  });

  return true;
}

/**
 * Navegação segura a partir do Início / menu (evita passar pela Login).
 */
export function navigatePatientFeature(navigation, routeName, params = {}) {
  if (!navigation?.navigate) {
    return;
  }

  stripAuthRoutesFromPatientStack(navigation);

  const state = navigation.getState?.();
  const routes = state?.routes || [];
  const index = typeof state?.index === 'number' ? state.index : routes.length - 1;
  const currentRoute = routes[index]?.name;

  if (currentRoute === routeName) {
    return;
  }

  const hasAuthInStack = routes.some((route) => AUTH_STACK_ROUTES.has(route.name));

  if (hasAuthInStack || !routes.length) {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: routeName, params }],
      })
    );
    return;
  }

  if (currentRoute === 'HomePaciente') {
    navigation.navigate(routeName, params);
    return;
  }

  const existingIndex = routes.findIndex((route) => route.name === routeName);
  if (existingIndex >= 0) {
    navigation.navigate(routeName, params);
    return;
  }

  navigation.navigate(routeName, params);
}

/**
 * Após salvar refeição IA: pilha limpa Início → Alimentação (params do diário preservados).
 */
export function voltarParaAlimentacaoAposSalvarRefeicao(navigation, params = {}) {
  if (!navigation?.dispatch) {
    navigation?.replace?.('PacienteDiario', params);
    return;
  }

  stripAuthRoutesFromPatientStack(navigation);

  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        {
          name: 'HomePaciente',
          params: {
            usuarioLogado: params.usuarioLogado,
            mealEntryIA: params.mealEntryIA || null,
            mealIARefreshToken: params.mealIARefreshToken || null,
            mealDataRefresh: params.mealDataRefresh || null,
          },
        },
        {
          name: 'PacienteDiario',
          params,
        },
      ],
    })
  );
}
