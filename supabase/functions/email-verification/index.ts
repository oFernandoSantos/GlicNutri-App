import { createClient } from 'npm:@supabase/supabase-js@2.100.1';
import { corsHeaders } from '../_shared/cors.ts';
import { sendCadastroVerificationEmail } from '../_shared/resendEmailService.ts';

type Role = 'Paciente' | 'Nutricionista';

type EmailVerificationPayload = {
  action?: 'request-code' | 'verify-code';
  role?: Role;
  email?: string;
  code?: string;
};

const CODE_EXPIRES_IN_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_WAIT_SECONDS = 60;

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const codeSecret =
  Deno.env.get('EMAIL_VERIFICATION_CODE_SECRET') ||
  Deno.env.get('PASSWORD_RESET_CODE_SECRET') ||
  serviceRoleKey ||
  'glicnutri-dev';

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatorias.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeEmail(email?: string) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role?: string): Role | null {
  return role === 'Paciente' || role === 'Nutricionista' ? role : null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateCode() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(random[0] % 1000000).padStart(6, '0');
}

async function hashCode(email: string, code: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${email}:${code}:${codeSecret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function requestCode(role: Role, email: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const createdAfter = new Date(Date.now() - RESEND_WAIT_SECONDS * 1000).toISOString();

  const { data: recentCode, error: recentError } = await supabaseAdmin
    .from('email_verification_codes')
    .select('id')
    .eq('role', role)
    .eq('email', email)
    .gte('created_at', createdAfter)
    .is('used_at', null)
    .limit(1)
    .maybeSingle();

  if (recentError) {
    throw recentError;
  }

  if (recentCode) {
    return jsonResponse(
      {
        ok: false,
        message: 'Aguarde um minuto antes de solicitar outro codigo.',
      },
      429
    );
  }

  await supabaseAdmin
    .from('email_verification_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('role', role)
    .eq('email', email)
    .is('used_at', null);

  const code = generateCode();
  const codeHash = await hashCode(email, code);
  const expiresAt = new Date(
    Date.now() + CODE_EXPIRES_IN_MINUTES * 60 * 1000
  ).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('email_verification_codes')
    .insert({
      role,
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

  if (insertError) {
    throw insertError;
  }

  try {
    await sendCadastroVerificationEmail({
      to: email,
      code,
      expiresInMinutes: CODE_EXPIRES_IN_MINUTES,
    });
  } catch (error) {
    await supabaseAdmin
      .from('email_verification_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('role', role)
      .eq('email', email)
      .eq('code_hash', codeHash);

    throw error;
  }

  return jsonResponse({
    ok: true,
    message: 'Codigo enviado para validar o e-mail.',
  });
}

async function verifyCode(role: Role, email: string, code: string) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!/^\d{6}$/.test(code)) {
    return jsonResponse(
      { ok: false, message: 'Digite o codigo de 6 digitos enviado por e-mail.' },
      400
    );
  }

  const nowIso = new Date().toISOString();
  const { data: verificationCode, error: codeError } = await supabaseAdmin
    .from('email_verification_codes')
    .select('id, code_hash, attempts')
    .eq('role', role)
    .eq('email', email)
    .is('used_at', null)
    .gte('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError) {
    throw codeError;
  }

  if (!verificationCode) {
    return jsonResponse(
      { ok: false, message: 'Codigo expirado ou invalido. Solicite um novo codigo.' },
      400
    );
  }

  if (verificationCode.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from('email_verification_codes')
      .update({ used_at: nowIso })
      .eq('id', verificationCode.id);

    return jsonResponse(
      { ok: false, message: 'Limite de tentativas atingido. Solicite um novo codigo.' },
      429
    );
  }

  const codeHash = await hashCode(email, code);

  if (codeHash !== verificationCode.code_hash) {
    await supabaseAdmin
      .from('email_verification_codes')
      .update({ attempts: verificationCode.attempts + 1 })
      .eq('id', verificationCode.id);

    return jsonResponse(
      { ok: false, message: 'Codigo invalido. Confira o codigo enviado por e-mail.' },
      400
    );
  }

  await supabaseAdmin
    .from('email_verification_codes')
    .update({ used_at: nowIso })
    .eq('id', verificationCode.id);

  return jsonResponse({
    ok: true,
    message: 'E-mail validado com sucesso.',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Metodo nao permitido.' }, 405);
  }

  try {
    const payload = (await req.json()) as EmailVerificationPayload;
    const role = normalizeRole(payload.role);
    const email = normalizeEmail(payload.email);

    if (!role) {
      return jsonResponse({ ok: false, message: 'Perfil invalido.' }, 400);
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ ok: false, message: 'E-mail invalido.' }, 400);
    }

    if (payload.action === 'request-code') {
      return await requestCode(role, email);
    }

    if (payload.action === 'verify-code') {
      return await verifyCode(role, email, String(payload.code || '').replace(/\D/g, ''));
    }

    return jsonResponse({ ok: false, message: 'Acao invalida.' }, 400);
  } catch (error) {
    console.error('email-verification error', error);

    return jsonResponse(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel validar o e-mail.',
      },
      500
    );
  }
});
