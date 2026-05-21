create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.solicitacao_acompanhamento_nutri (
  id uuid primary key default gen_random_uuid(),
  nutricionista_id uuid not null references public.nutricionista(id_nutricionista_uuid) on delete cascade,
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  mensagem text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_solicitacao_acompanhamento_nutri_status
  on public.solicitacao_acompanhamento_nutri (nutricionista_id, status, created_at desc);

create unique index if not exists idx_solicitacao_acompanhamento_nutri_pending
  on public.solicitacao_acompanhamento_nutri (nutricionista_id, paciente_id)
  where status = 'pending';

drop trigger if exists trg_touch_solicitacao_acompanhamento_nutri_updated_at
  on public.solicitacao_acompanhamento_nutri;
create trigger trg_touch_solicitacao_acompanhamento_nutri_updated_at
before update on public.solicitacao_acompanhamento_nutri
for each row
execute function public.touch_updated_at();

alter table public.solicitacao_acompanhamento_nutri enable row level security;

drop policy if exists "Allow follow-up request reads" on public.solicitacao_acompanhamento_nutri;
create policy "Allow follow-up request reads"
on public.solicitacao_acompanhamento_nutri
for select
to anon, authenticated
using (true);

drop policy if exists "Allow follow-up request writes" on public.solicitacao_acompanhamento_nutri;
create policy "Allow follow-up request writes"
on public.solicitacao_acompanhamento_nutri
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.solicitacao_acompanhamento_nutri to anon, authenticated;
