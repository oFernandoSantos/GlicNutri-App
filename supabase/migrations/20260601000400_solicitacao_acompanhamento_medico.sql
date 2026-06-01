-- Solicitacoes de acompanhamento medico (espelho do nutricionista).
create table if not exists public.solicitacao_acompanhamento_medico (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medico(id_medico_uuid) on delete cascade,
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  mensagem text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_solicitacao_acompanhamento_medico_status
  on public.solicitacao_acompanhamento_medico (medico_id, status, created_at desc);

create unique index if not exists idx_solicitacao_acompanhamento_medico_pending
  on public.solicitacao_acompanhamento_medico (medico_id, paciente_id)
  where status = 'pending';

drop trigger if exists trg_touch_solicitacao_acompanhamento_medico_updated_at
  on public.solicitacao_acompanhamento_medico;
create trigger trg_touch_solicitacao_acompanhamento_medico_updated_at
before update on public.solicitacao_acompanhamento_medico
for each row
execute function public.touch_updated_at();

alter table public.solicitacao_acompanhamento_medico enable row level security;

drop policy if exists "Allow doctor follow-up request reads" on public.solicitacao_acompanhamento_medico;
create policy "Allow doctor follow-up request reads"
on public.solicitacao_acompanhamento_medico
for select
to anon, authenticated
using (true);

drop policy if exists "Allow doctor follow-up request writes" on public.solicitacao_acompanhamento_medico;
create policy "Allow doctor follow-up request writes"
on public.solicitacao_acompanhamento_medico
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.solicitacao_acompanhamento_medico to anon, authenticated;
