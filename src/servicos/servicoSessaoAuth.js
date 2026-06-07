import { supabase } from './configSupabase';
import { limparSessaoPaciente } from './servicoSessaoPaciente';
import { limparRpcSessionToken } from './servicoSessaoRpc';

export function isErroRefreshTokenInvalido(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('refresh token revoked')
  );
}

export async function limparSessaoAuthLocal() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
    await Promise.all([limparSessaoPaciente(), limparRpcSessionToken()]);
  } catch (_error) {
    /* noop */
  }
}

export async function obterSessaoAuthSegura() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error && isErroRefreshTokenInvalido(error)) {
      await limparSessaoAuthLocal();
      return { session: null, error: null };
    }

    if (error) {
      return { session: null, error };
    }

    return { session: data?.session || null, error: null };
  } catch (error) {
    if (isErroRefreshTokenInvalido(error)) {
      await limparSessaoAuthLocal();
      return { session: null, error: null };
    }

    return { session: null, error };
  }
}
