# Password Recovery Edge Function

Esta function envia um codigo de 6 digitos por e-mail e valida o codigo antes de
atualizar a senha nas tabelas `paciente` ou `nutricionista`.

## Variaveis obrigatorias

- `RESEND_API_KEY`: chave da API do Resend.
- `PASSWORD_RESET_FROM_EMAIL`: remetente verificado no Resend.
- `PASSWORD_RESET_CODE_SECRET`: segredo usado para gerar o hash dos codigos.

O Supabase fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente
no ambiente das Edge Functions.

## Deploy

```bash
supabase db push
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set PASSWORD_RESET_FROM_EMAIL="GlicNutri <recuperacao@seudominio.com>"
supabase secrets set PASSWORD_RESET_CODE_SECRET="um-segredo-longo"
supabase functions deploy password-recovery
```
