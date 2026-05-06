create extension if not exists pgcrypto;

-- ============================================================
-- Nutri portal: disponibilidade (slots), consultas, plano alimentar, notas
-- ============================================================

create table if not exists public.nutri_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references public.nutricionista(id_nutricionista_uuid) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 10 and 180),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_time > start_time)
);

create index if not exists idx_nutri_disponibilidade_nutri_weekday
  on public.nutri_disponibilidade (nutricionista_id, weekday, start_time);

create table if not exists public.consulta (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references public.nutricionista(id_nutricionista_uuid) on delete restrict,
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'cancelled', 'done', 'no_show')),
  motivo text,
  observacoes_nutri text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_consulta_nutri_scheduled_at
  on public.consulta (nutricionista_id, scheduled_at desc);

create index if not exists idx_consulta_paciente_scheduled_at
  on public.consulta (paciente_id, scheduled_at desc);

create unique index if not exists idx_consulta_unique_slot
  on public.consulta (nutricionista_id, scheduled_at)
  where status in ('scheduled', 'confirmed');

create table if not exists public.plano_alimentar (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references public.nutricionista(id_nutricionista_uuid) on delete restrict,
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  titulo text not null default 'Plano alimentar',
  descricao text not null default '',
  metas jsonb,
  inicio_em date,
  fim_em date,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_plano_alimentar_paciente_ativo
  on public.plano_alimentar (paciente_id, ativo, updated_at desc);

create table if not exists public.prontuario_nota (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references public.nutricionista(id_nutricionista_uuid) on delete restrict,
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  consulta_id uuid references public.consulta(id) on delete set null,
  texto text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_prontuario_nota_paciente_created_at
  on public.prontuario_nota (paciente_id, created_at desc);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_nutri_disponibilidade_updated_at on public.nutri_disponibilidade;
create trigger trg_touch_nutri_disponibilidade_updated_at
before update on public.nutri_disponibilidade
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_touch_consulta_updated_at on public.consulta;
create trigger trg_touch_consulta_updated_at
before update on public.consulta
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_touch_plano_alimentar_updated_at on public.plano_alimentar;
create trigger trg_touch_plano_alimentar_updated_at
before update on public.plano_alimentar
for each row
execute function public.touch_updated_at();

-- ============================================================
-- RLS (mínimo para não quebrar o app atual)
-- Observação: hoje o app usa anon key + login custom (RPC), então políticas estritas
-- por auth.uid() quebrariam o fluxo. Mantemos políticas permissivas por enquanto.
-- ============================================================

alter table public.nutri_disponibilidade enable row level security;
alter table public.consulta enable row level security;
alter table public.plano_alimentar enable row level security;
alter table public.prontuario_nota enable row level security;

drop policy if exists "Allow availability reads" on public.nutri_disponibilidade;
create policy "Allow availability reads"
on public.nutri_disponibilidade
for select
to anon, authenticated
using (true);

drop policy if exists "Allow availability writes" on public.nutri_disponibilidade;
create policy "Allow availability writes"
on public.nutri_disponibilidade
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow consultation reads" on public.consulta;
create policy "Allow consultation reads"
on public.consulta
for select
to anon, authenticated
using (true);

drop policy if exists "Allow consultation writes" on public.consulta;
create policy "Allow consultation writes"
on public.consulta
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow meal plan reads" on public.plano_alimentar;
create policy "Allow meal plan reads"
on public.plano_alimentar
for select
to anon, authenticated
using (true);

drop policy if exists "Allow meal plan writes" on public.plano_alimentar;
create policy "Allow meal plan writes"
on public.plano_alimentar
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow prontuario note reads" on public.prontuario_nota;
create policy "Allow prontuario note reads"
on public.prontuario_nota
for select
to anon, authenticated
using (true);

drop policy if exists "Allow prontuario note writes" on public.prontuario_nota;
create policy "Allow prontuario note writes"
on public.prontuario_nota
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.nutri_disponibilidade to anon, authenticated;
grant select, insert, update, delete on public.consulta to anon, authenticated;
grant select, insert, update, delete on public.plano_alimentar to anon, authenticated;
grant select, insert, update, delete on public.prontuario_nota to anon, authenticated;

