alter table if exists public.paciente
  add column if not exists onboarding_respostas jsonb,
  add column if not exists onboarding_concluido_em timestamptz;
