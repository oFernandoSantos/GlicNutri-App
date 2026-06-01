-- Disponibilidade de agenda do medico (espelho de nutri_disponibilidade).

create table if not exists public.medico_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medico(id_medico_uuid) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 10 and 180),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_time > start_time)
);

create index if not exists idx_medico_disponibilidade_medico_weekday
  on public.medico_disponibilidade (medico_id, weekday, start_time);

drop trigger if exists trg_touch_medico_disponibilidade_updated_at on public.medico_disponibilidade;
create trigger trg_touch_medico_disponibilidade_updated_at
before update on public.medico_disponibilidade
for each row
execute function public.touch_updated_at();

alter table public.medico_disponibilidade enable row level security;

drop policy if exists "Allow medico availability reads" on public.medico_disponibilidade;
create policy "Allow medico availability reads"
on public.medico_disponibilidade
for select
to anon, authenticated
using (true);

drop policy if exists "Allow medico availability writes" on public.medico_disponibilidade;
create policy "Allow medico availability writes"
on public.medico_disponibilidade
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.medico_disponibilidade to anon, authenticated;
