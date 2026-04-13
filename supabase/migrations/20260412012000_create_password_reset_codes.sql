create extension if not exists pgcrypto;

create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('Paciente', 'Nutricionista')),
  email text not null,
  user_id text,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_codes_lookup_idx
  on public.password_reset_codes (role, email, created_at desc);

create index if not exists password_reset_codes_expires_at_idx
  on public.password_reset_codes (expires_at);

alter table public.password_reset_codes enable row level security;
