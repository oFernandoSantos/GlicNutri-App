-- ============================================================
-- MIGRATION: paciente_profissional_vinculo (M:N)
-- Substitui o FK 1:1 paciente.id_nutricionista_uuid com vínculo
-- múltiplo e tipado (nutricionista | medico | outro).
-- ADDITIVE: paciente.id_nutricionista_uuid permanece para compat.
-- ============================================================

create table if not exists public.paciente_profissional_vinculo (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  -- profissional (apenas um dos dois pode ser preenchido)
  nutricionista_id    uuid
    references public.nutricionista(id_nutricionista_uuid) on delete cascade,
  medico_id           uuid
    references public.medico(id_medico_uuid) on delete cascade,
  -- tipo do vínculo
  tipo_profissional   text not null
    check (tipo_profissional in ('nutricionista', 'medico', 'outro')),
  -- origem do vínculo
  origem              text not null default 'manual'
    check (origem in ('consulta', 'solicitacao', 'manual', 'admin', 'seed')),
  -- consulta que originou o vínculo (se aplicável)
  consulta_id         uuid
    references public.consulta(id) on delete set null,
  ativo               boolean not null default true,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),

  -- pelo menos um profissional deve estar preenchido
  constraint chk_vinculo_profissional
    check (nutricionista_id is not null or medico_id is not null),

  -- não pode ter os dois ao mesmo tempo
  constraint chk_vinculo_exclusivo
    check (not (nutricionista_id is not null and medico_id is not null))
);

-- Evita vínculo duplicado ativo por tipo + profissional
create unique index if not exists idx_vinculo_paciente_nutri_ativo
  on public.paciente_profissional_vinculo (paciente_id, nutricionista_id)
  where ativo = true and nutricionista_id is not null;

create unique index if not exists idx_vinculo_paciente_medico_ativo
  on public.paciente_profissional_vinculo (paciente_id, medico_id)
  where ativo = true and medico_id is not null;

create index if not exists idx_vinculo_paciente_profissional_tipo
  on public.paciente_profissional_vinculo (paciente_id, tipo_profissional, ativo);

create index if not exists idx_vinculo_nutricionista_ativo
  on public.paciente_profissional_vinculo (nutricionista_id, ativo)
  where nutricionista_id is not null;

-- updated_at
drop trigger if exists trg_touch_vinculo_updated_at on public.paciente_profissional_vinculo;
create trigger trg_touch_vinculo_updated_at
before update on public.paciente_profissional_vinculo
for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS permissiva
-- ============================================================
alter table public.paciente_profissional_vinculo enable row level security;

drop policy if exists "Allow vinculo reads" on public.paciente_profissional_vinculo;
create policy "Allow vinculo reads"
on public.paciente_profissional_vinculo for select to anon, authenticated using (true);

drop policy if exists "Allow vinculo writes" on public.paciente_profissional_vinculo;
create policy "Allow vinculo writes"
on public.paciente_profissional_vinculo for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.paciente_profissional_vinculo to anon, authenticated;

-- ============================================================
-- Seed: migra vínculos existentes
-- 1. paciente.id_nutricionista_uuid → vínculo nutricionista
-- 2. consulta (status != cancelled) → vínculo nutricionista (se não existir)
-- ============================================================

-- De paciente.id_nutricionista_uuid
insert into public.paciente_profissional_vinculo (
  paciente_id,
  nutricionista_id,
  tipo_profissional,
  origem,
  ativo
)
select
  p.id_paciente_uuid,
  p.id_nutricionista_uuid,
  'nutricionista',
  'manual',
  true
from public.paciente p
where p.id_nutricionista_uuid is not null
  and coalesce(p.excluido, false) = false
on conflict do nothing;

-- De consultas existentes (distinct pair por paciente+nutri)
insert into public.paciente_profissional_vinculo (
  paciente_id,
  nutricionista_id,
  tipo_profissional,
  origem,
  consulta_id,
  ativo
)
select distinct on (c.paciente_id, c.nutricionista_id)
  c.paciente_id,
  c.nutricionista_id,
  'nutricionista',
  'consulta',
  c.id,
  true
from public.consulta c
where c.status <> 'cancelled'
  and c.paciente_id is not null
  and c.nutricionista_id is not null
on conflict do nothing;

-- ============================================================
-- RPCs
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

create or replace function public.listar_vinculos_paciente(p_paciente_id uuid)
returns setof public.paciente_profissional_vinculo
language sql
stable
security definer
set search_path = public
as $$
  select * from public.paciente_profissional_vinculo
  where paciente_id = p_paciente_id
    and ativo = true
  order by tipo_profissional, created_at desc;
$$;

grant execute on function public.vincular_paciente_profissional(uuid, uuid, uuid, text, uuid)
  to anon, authenticated;
grant execute on function public.listar_vinculos_paciente(uuid)
  to anon, authenticated;
