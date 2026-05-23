import { isAdminUser } from '../servicos/servicoAdmin';
import { isNutriUser } from '../servicos/servicoSessaoNutricionista';

export function isPatientUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (isAdminUser(user) || isNutriUser(user)) return false;
  return Boolean(
    user.id_paciente_uuid ||
      user.tipo_perfil === 'paciente' ||
      user.perfil === 'paciente' ||
      (user.user_metadata?.tipo_perfil === 'paciente' && !user.id_nutricionista_uuid)
  );
}

export function isSupabasePatientSession(session) {
  const user = session?.user;
  if (!user) return false;
  if (isNutriUser(user) || isAdminUser(user)) return false;
  return Boolean(user.id_paciente_uuid || user.app_metadata?.provider === 'google');
}

/**
 * Define rota inicial após bootstrap (admin > nutri persistido > paciente Supabase > intro/login).
 */
export function resolveInitialRouteName({
  adminSession,
  nutriSession,
  supabaseSession,
  patientOnboardingSeen,
  introSeen,
}) {
  if (adminSession) return 'AdminHome';
  if (nutriSession) return 'HomeNutricionista';
  if (supabaseSession && isSupabasePatientSession(supabaseSession)) {
    return patientOnboardingSeen ? 'HomePaciente' : 'PacienteOnboarding';
  }
  return introSeen ? 'Login' : 'Intro';
}
