import { supabaseUrl } from './supabaseConfig';

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function obterMensagemErro(data, fallback = 'Nao foi possivel validar o e-mail.') {
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  return fallback;
}

async function chamarEmailVerification(body) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/email-verification`, {
      method: 'POST',
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
          `Erro ao validar e-mail (${response.status}).`
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

    throw new Error(error?.message || 'Nao foi possivel validar o e-mail.');
  }
}

export async function solicitarCodigoValidacaoEmailCadastro({ role, email }) {
  return chamarEmailVerification({
    action: 'request-code',
    role,
    email: normalizarEmail(email),
  });
}

export async function confirmarCodigoValidacaoEmailCadastro({ role, email, code }) {
  return chamarEmailVerification({
    action: 'verify-code',
    role,
    email: normalizarEmail(email),
    code: String(code || '').replace(/\D/g, ''),
  });
}
