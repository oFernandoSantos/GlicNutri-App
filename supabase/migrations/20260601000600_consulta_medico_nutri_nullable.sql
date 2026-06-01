-- Consultas medicas usam medico_id; nutricionista_id deixa de ser obrigatorio.

alter table public.consulta
  alter column nutricionista_id drop not null;

alter table public.consulta
  drop constraint if exists consulta_profissional_required;

alter table public.consulta
  add constraint consulta_profissional_required
  check (nutricionista_id is not null or medico_id is not null);

drop index if exists public.idx_consulta_unique_slot;

create unique index if not exists idx_consulta_unique_slot_nutri
  on public.consulta (nutricionista_id, scheduled_at)
  where status in ('scheduled', 'confirmed')
    and nutricionista_id is not null;

create unique index if not exists idx_consulta_unique_slot_medico
  on public.consulta (medico_id, scheduled_at)
  where status in ('scheduled', 'confirmed')
    and medico_id is not null;
