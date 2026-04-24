import { supabase } from './configSupabase';

export function isGoogleUser(user) {
  const provider = user?.app_metadata?.provider || null;
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  const identityProviders = Array.isArray(user?.identities)
    ? user.identities.map((item) => item?.provider).filter(Boolean)
    : [];

  return (
    provider === 'google' ||
    providers.includes('google') ||
    identityProviders.includes('google')
  );
}

export function buildGooglePatientFallback(user) {
  const placeholderCpf = buildGoogleCpfPlaceholder(user);

  return {
    id_paciente_uuid: user?.id || null,
    nome_completo:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      'Paciente',
    email_pac: user?.email?.toLowerCase() || null,
    cpf_paciente: placeholderCpf,
    sexo_biologico: 'Nao informado',
    cep: '00000000',
    logradouro: 'Login Google',
    numero: '0',
    bairro: 'Nao informado',
    cidade: 'Nao informada',
    uf: 'NI',
    excluido: false,
    data_exclusao: null,
  };
}

function sanitizeSensitivePatientData(patient) {
  if (!patient || typeof patient !== 'object') {
    return patient;
  }

  const sanitized = { ...patient };
  delete sanitized.senha_pac;
  delete sanitized.senha_nutri;

  return sanitized;
}

function buildGoogleCpfPlaceholder(user) {
  const source = `${user?.id || ''}${user?.email || ''}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 100000000000;
  }

  return String(hash).padStart(11, '0').slice(0, 11);
}

export async function syncGooglePatientRecord(user) {
  if (!user?.id || !isGoogleUser(user)) {
    return null;
  }

  const fallback = buildGooglePatientFallback(user);

  const { data: pacientePorId, error: erroPacientePorId } = await supabase
    .from('paciente')
    .select('*')
    .eq('id_paciente_uuid', user.id)
    .maybeSingle();

  if (erroPacientePorId) {
    throw erroPacientePorId;
  }

  let pacienteExistente = pacientePorId;

  if (!pacienteExistente && fallback.email_pac) {
    const { data: pacientesPorEmail, error: erroPacientePorEmail } = await supabase
      .from('paciente')
      .select('*')
      .ilike('email_pac', fallback.email_pac);

    if (erroPacientePorEmail) {
      throw erroPacientePorEmail;
    }

    pacienteExistente = (pacientesPorEmail || [])[0] || null;
  }

  if (pacienteExistente) {
    const { data: atualizado, error: erroAtualizacao } = await supabase
      .from('paciente')
      .update({
        nome_completo: pacienteExistente.nome_completo || fallback.nome_completo,
        email_pac: pacienteExistente.email_pac || fallback.email_pac,
        cpf_paciente: pacienteExistente.cpf_paciente || fallback.cpf_paciente,
        sexo_biologico: pacienteExistente.sexo_biologico || fallback.sexo_biologico,
        cep: pacienteExistente.cep || fallback.cep,
        logradouro: pacienteExistente.logradouro || fallback.logradouro,
        numero: pacienteExistente.numero || fallback.numero,
        bairro: pacienteExistente.bairro || fallback.bairro,
        cidade: pacienteExistente.cidade || fallback.cidade,
        uf: pacienteExistente.uf || fallback.uf,
        excluido: pacienteExistente.excluido === true ? false : pacienteExistente.excluido ?? false,
        data_exclusao: null,
      })
      .eq('id_paciente_uuid', pacienteExistente.id_paciente_uuid)
      .select('*')
      .maybeSingle();

    if (erroAtualizacao) {
      throw erroAtualizacao;
    }

    return sanitizeSensitivePatientData(atualizado || pacienteExistente);
  }

  const { data: criado, error: erroInsert } = await supabase
    .from('paciente')
    .insert([fallback])
    .select('*')
    .maybeSingle();

  if (erroInsert) {
    throw erroInsert;
  }

  return sanitizeSensitivePatientData(criado || fallback);
}
