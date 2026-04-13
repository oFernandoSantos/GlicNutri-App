type SendPasswordCodeEmailParams = {
  to: string;
  code: string;
  expiresInMinutes: number;
};

const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
const fromEmail =
  Deno.env.get('RESEND_FROM_EMAIL') ||
  Deno.env.get('PASSWORD_RESET_FROM_EMAIL') ||
  'GlicNutri <onboarding@resend.dev>';

function parseResendMessage(details: string) {
  try {
    const parsed = JSON.parse(details);
    return String(parsed?.message || parsed?.error || details);
  } catch {
    return details;
  }
}

function getResendErrorMessage(status: number, details: string) {
  const message = parseResendMessage(details);

  if (status === 401) {
    return 'RESEND_API_KEY invalida ou sem permissao no Resend.';
  }

  if (
    status === 403 ||
    /domain|verified|verify|onboarding|testing/i.test(message)
  ) {
    return 'O Resend bloqueou o envio para este e-mail. Verifique um dominio ou remetente no Resend e configure RESEND_FROM_EMAIL no Supabase.';
  }

  return 'Nao foi possivel enviar o e-mail de verificacao.';
}

async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY nao configurada.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Resend email error', details);
    throw new Error(getResendErrorMessage(response.status, details));
  }
}

export async function sendPasswordCodeEmail({
  to,
  code,
  expiresInMinutes,
}: SendPasswordCodeEmailParams) {
  await sendEmail({
    to,
    subject: 'Codigo para redefinir sua senha no GlicNutri',
    html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
          <h2 style="color: #10b981;">Codigo de verificacao</h2>
          <p>Use o codigo abaixo para redefinir sua senha no GlicNutri.</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">
            ${code}
          </p>
          <p>Este codigo expira em ${expiresInMinutes} minutos.</p>
          <p>Se voce nao solicitou essa alteracao, ignore este e-mail.</p>
        </div>
      `,
    text: `Use o codigo ${code} para redefinir sua senha no GlicNutri. Ele expira em ${expiresInMinutes} minutos. Se voce nao solicitou essa alteracao, ignore este e-mail.`,
  });
}

export async function sendCadastroVerificationEmail({
  to,
  code,
  expiresInMinutes,
}: SendPasswordCodeEmailParams) {
  await sendEmail({
    to,
    subject: 'Confirme seu e-mail no GlicNutri',
    html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
          <h2 style="color: #10b981;">Validacao de cadastro</h2>
          <p>Use o codigo abaixo para confirmar seu e-mail e concluir seu cadastro no GlicNutri.</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">
            ${code}
          </p>
          <p>Este codigo expira em ${expiresInMinutes} minutos.</p>
          <p>Se voce nao iniciou esse cadastro, ignore este e-mail.</p>
        </div>
      `,
    text: `Use o codigo ${code} para confirmar seu e-mail e concluir seu cadastro no GlicNutri. Ele expira em ${expiresInMinutes} minutos. Se voce nao iniciou esse cadastro, ignore este e-mail.`,
  });
}
