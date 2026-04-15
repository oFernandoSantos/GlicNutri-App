alter table if exists public.paciente
  add column if not exists data_nascimento date;

alter table if exists public.nutricionista
  add column if not exists data_nascimento date;
