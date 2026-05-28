import { isAdminUser } from '../servicos/servicoAdmin';
import { isNutriUser } from '../servicos/servicoSessaoNutricionista';
import { isGoogleUser } from '../servicos/sincronizarPacienteGoogle';

/** ID do paciente na sessão Supabase (após sync Google ou login com perfil). */
export function getSessionPatientId(user) {
  if (!user) return null;
  return (
    user.id_paciente_uuid ||
    user.user_metadata?.id_paciente_uuid ||
    (isGoogleUser(user) ? user.id : null) ||
    user.patient_id ||
    null
  );
}

export function isPatientUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (isAdminUser(user) || isNutriUser(user)) return false;
  if (getSessionPatientId(user)) return true;
  return Boolean(
    user.tipo_perfil === 'paciente' ||
      user.perfil === 'paciente' ||
      (user.user_metadata?.tipo_perfil === 'paciente' && !user.id_nutricionista_uuid)
  );
}

export function isSupabasePatientSession(session) {
  const user = session?.user;
  if (!user) return false;
  if (isNutriUser(user) || isAdminUser(user)) return false;
  return isPatientUser(user);
}

function resolvePatientHomeRoute(patientOnboardingSeen) {
  return patientOnboardingSeen ? 'HomePaciente' : 'PacienteOnboarding';
}

/**
 * Define rota inicial após bootstrap (admin > nutri persistido > paciente > intro/login).
 */
export function resolveInitialRouteName({
  adminSession,
  nutriSession,
  supabaseSession,
  patientLocalSession,
  patientOnboardingSeen,
  introSeen,
}) {
  if (adminSession) return 'AdminHome';
  if (nutriSession) return 'HomeNutricionista';

  if (patientLocalSession && isPatientUser(patientLocalSession)) {
    return resolvePatientHomeRoute(patientOnboardingSeen);
  }

  if (supabaseSession && isSupabasePatientSession(supabaseSession)) {
    return resolvePatientHomeRoute(patientOnboardingSeen);
  }

  return introSeen ? 'Login' : 'Intro';
}
