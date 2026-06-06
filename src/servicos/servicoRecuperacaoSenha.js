import { supabaseAnonKey, supabaseUrl } from './configSupabase';

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizarRoleRecuperacao(role) {
  const perfil = String(role || '').trim();

  if (
    perfil === 'Nutricionista' ||
    perfil === 'Profissional da Saúde' ||
    perfil === 'Medico'
  ) {
    return 'Nutricionista';
  }

  if (perfil === 'Admin') {
    return 'Admin';
  }

  return 'Paciente';
}

function obterMensagemErro(data, fallback = 'Nao foi possivel concluir a recuperacao de senha.') {
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  return fallback;
}

async function chamarPasswordRecovery(body) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/password-recovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        obterMensagemErro(
          data,
          `Erro ao recuperar senha (${response.status}).`
        )
      );
    }

    if (!data || data.ok === false) {
      throw new Error(obterMensagemErro(data));
    }

    return data;
  } catch (error) {
    if (error?.message === 'Failed to fetch') {
      throw new Error('Nao foi possivel conectar ao Supabase para enviar o codigo.');
    }

    throw new Error(error?.message || 'Nao foi possivel concluir a recuperacao de senha.');
  }
}

export async function solicitarCodigoRecuperacaoSenha({ role, email }) {
  return chamarPasswordRecovery({
    action: 'request-code',
    role: normalizarRoleRecuperacao(role),
    email: normalizarEmail(email),
  });
}

export async function confirmarCodigoRecuperacaoSenha({
  role,
  email,
  code,
  newPassword,
}) {
  return chamarPasswordRecovery({
    action: 'reset-password',
    role: normalizarRoleRecuperacao(role),
    email: normalizarEmail(email),
    code: String(code || '').replace(/\D/g, ''),
    newPassword,
  });
}
