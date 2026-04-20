import { supabase } from './configSupabase';

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function obterMensagemErro(error, data) {
  if (data?.message || data?.error) {
    return data.message || data.error;
  }

  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      return body?.message || body?.error || error.message;
    } catch {
      return error.message;
    }
  }

  return error?.message || 'Nao foi possivel concluir a recuperacao de senha.';
}

async function chamarPasswordRecovery(body) {
  const { data, error } = await supabase.functions.invoke('password-recovery', {
    body,
  });

  if (error || data?.ok === false) {
    throw new Error(await obterMensagemErro(error, data));
  }

  return data;
}

export async function solicitarCodigoRecuperacaoSenha({ role, email }) {
  return chamarPasswordRecovery({
    action: 'request-code',
    role,
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
    role,
    email: normalizarEmail(email),
    code: String(code || '').replace(/\D/g, ''),
    newPassword,
  });
}
