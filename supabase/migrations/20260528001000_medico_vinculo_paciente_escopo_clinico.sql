-- ============================================================
-- Médico ↔ Paciente (paridade com nutricionista)
-- Escopo: médico = clínico (diabetes, glicose, medicação, insulina)
--         nutricionista = alimentar (plano, refeições, metas nutricionais)
-- ADDITIVE: não remove paciente.id_nutricionista_uuid
-- ============================================================

-- Vínculo direto no paciente (compat com id_nutricionista_uuid)
alter table public.paciente
  add column if not exists id_medico_uuid uuid
    references public.medico(id_medico_uuid) on delete set null;

create index if not exists idx_paciente_medico_uuid
  on public.paciente (id_medico_uuid)
  where id_medico_uuid is not null;

-- ============================================================
-- RPC: paciente vinculado ao médico?
-- ============================================================
create or replace function public.paciente_vinculado_a_medico(
  p_paciente_id uuid,
  p_medico_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = p_paciente_id
      and coalesce(p.excluido, false) = false
      and (
        p.id_medico_uuid = p_medico_id
        or exists (
          select 1
          from public.paciente_profissional_vinculo v
          where v.paciente_id = p_paciente_id
            and v.medico_id = p_medico_id
            and v.ativo = true
        )
        or exists (
          select 1
          from public.consulta c
          where c.paciente_id = p_paciente_id
            and c.medico_id = p_medico_id
            and c.status <> 'cancelled'
        )
      )
  );
$$;

-- ============================================================
-- Garantir vínculo médico (consulta ou manual)
-- ============================================================
create or replace function public.garantir_vinculo_medico_paciente(
  p_paciente_id   uuid,
  p_medico_id     uuid,
  p_origem        text default 'manual',
  p_consulta_id   uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_paciente_id is null or p_medico_id is null then
    return false;
  end if;

  insert into public.paciente_profissional_vinculo (
    paciente_id,
    medico_id,
    tipo_profissional,
    origem,
    consulta_id,
    ativo
  )
  values (
    p_paciente_id,
    p_medico_id,
    'medico',
    coalesce(nullif(trim(p_origem), ''), 'manual'),
    p_consulta_id,
    true
  )
  on conflict do nothing;

  update public.paciente
  set
    id_medico_uuid = p_medico_id,
    data_hora_ultima_atualizacao = timezone('utc', now())
  where id_paciente_uuid = p_paciente_id;

  return true;
end;
$$;

-- ============================================================
-- Trigger: consulta com medico_id → vínculo automático
-- ============================================================
create or replace function public.trg_consulta_vincular_medico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.medico_id is not null
     and new.paciente_id is not null
     and new.status <> 'cancelled'
  then
    perform public.garantir_vinculo_medico_paciente(
      new.paciente_id,
      new.medico_id,
      'consulta',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_consulta_vincular_medico on public.consulta;
create trigger trg_consulta_vincular_medico
after insert or update of medico_id, status, paciente_id on public.consulta
for each row
execute function public.trg_consulta_vincular_medico();

-- ============================================================
-- Seed: vínculos de consultas com medico_id
-- ============================================================
insert into public.paciente_profissional_vinculo (
  paciente_id,
  medico_id,
  tipo_profissional,
  origem,
  consulta_id,
  ativo
)
select distinct on (c.paciente_id, c.medico_id)
  c.paciente_id,
  c.medico_id,
  'medico',
  'consulta',
  c.id,
  true
from public.consulta c
where c.medico_id is not null
  and c.paciente_id is not null
  and c.status <> 'cancelled'
on conflict do nothing;

update public.paciente p
set id_medico_uuid = sub.medico_id
from (
  select distinct on (c.paciente_id)
    c.paciente_id,
    c.medico_id
  from public.consulta c
  where c.medico_id is not null
    and c.status <> 'cancelled'
  order by c.paciente_id, c.scheduled_at desc nulls last
) sub
where p.id_paciente_uuid = sub.paciente_id
  and p.id_medico_uuid is null;

-- ============================================================
-- Desvincular médico
-- ============================================================
create or replace function public.desvincular_paciente_medico(
  p_paciente_id uuid,
  p_medico_id   uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.paciente_profissional_vinculo
  set ativo = false, updated_at = timezone('utc', now())
  where paciente_id = p_paciente_id
    and medico_id = p_medico_id
    and ativo = true;

  update public.paciente
  set
    id_medico_uuid = null,
    data_hora_ultima_atualizacao = timezone('utc', now())
  where id_paciente_uuid = p_paciente_id
    and id_medico_uuid = p_medico_id;

  return true;
end;
$$;

-- ============================================================
-- Atualiza vincular_paciente_profissional para setar id_medico_uuid
-- ============================================================
create or replace function public.vincular_paciente_profissional(
  p_paciente_id       uuid,
  p_nutricionista_id  uuid default null,
  p_medico_id         uuid default null,
  p_origem            text default 'manual',
  p_consulta_id       uuid default null
)
returns setof public.paciente_profissional_vinculo
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  if p_nutricionista_id is null and p_medico_id is null then
    raise exception 'Informe nutricionista_id ou medico_id para criar vinculo.';
  end if;

  v_tipo := case
    when p_nutricionista_id is not null then 'nutricionista'
    else 'medico'
  end;

  insert into public.paciente_profissional_vinculo (
    paciente_id,
    nutricionista_id,
    medico_id,
    tipo_profissional,
    origem,
    consulta_id,
    ativo
  )
  values (
    p_paciente_id,
    p_nutricionista_id,
    p_medico_id,
    v_tipo,
    coalesce(nullif(trim(p_origem), ''), 'manual'),
    p_consulta_id,
    true
  )
  on conflict do nothing;

  if p_medico_id is not null then
    update public.paciente
    set id_medico_uuid = p_medico_id,
        data_hora_ultima_atualizacao = timezone('utc', now())
    where id_paciente_uuid = p_paciente_id;
  end if;

  if p_nutricionista_id is not null then
    update public.paciente
    set id_nutricionista_uuid = p_nutricionista_id,
        data_hora_ultima_atualizacao = timezone('utc', now())
    where id_paciente_uuid = p_paciente_id;
  end if;

  return query
  select * from public.paciente_profissional_vinculo
  where paciente_id = p_paciente_id
    and ativo = true
    and (
      (p_nutricionista_id is not null and nutricionista_id = p_nutricionista_id)
      or (p_medico_id is not null and medico_id = p_medico_id)
    );
end;
$$;

grant execute on function public.paciente_vinculado_a_medico(uuid, uuid) to anon, authenticated;
grant execute on function public.garantir_vinculo_medico_paciente(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.desvincular_paciente_medico(uuid, uuid) to anon, authenticated;
