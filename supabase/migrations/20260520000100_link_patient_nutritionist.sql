alter table if exists public.paciente
  add column if not exists id_nutricionista_uuid uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_paciente_nutricionista_vinculo'
  ) then
    alter table public.paciente
      add constraint fk_paciente_nutricionista_vinculo
      foreign key (id_nutricionista_uuid)
      references public.nutricionista(id_nutricionista_uuid)
      on delete set null;
  end if;
end $$;

create index if not exists idx_paciente_nutricionista_uuid
  on public.paciente (id_nutricionista_uuid)
  where id_nutricionista_uuid is not null;

update public.paciente p
set id_nutricionista_uuid = vinculo.nutricionista_id
from (
  select distinct on (c.paciente_id)
    c.paciente_id,
    c.nutricionista_id
  from public.consulta c
  where c.status <> 'cancelled'
  order by c.paciente_id, c.scheduled_at desc
) vinculo
where p.id_paciente_uuid = vinculo.paciente_id
  and p.id_nutricionista_uuid is null;
