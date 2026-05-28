-- ============================================================
-- MIGRATION: registro_insulina
-- Cria tabela dedicada para registros de insulina.
-- ADDITIVE ONLY: registro_medicacao permanece intacto.
-- Frontend continua lendo tipo_registro='insulin' em registro_medicacao.
-- Nova tabela usada para fluxos clínicos futuros (médico, prontuário).
-- ============================================================

create table if not exists public.registro_insulina (
  id                    uuid primary key default gen_random_uuid(),
  id_paciente_uuid      uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  -- categoria: basal | bolus | rapida | intermediaria | premisturada
  categoria_insulina    text not null default 'basal'
    check (categoria_insulina in ('basal', 'bolus', 'rapida', 'intermediaria', 'premisturada')),
  nome_insulina         text,
  dose_ui               numeric not null check (dose_ui > 0),
  unidade_medida        text not null default 'UI',
  -- local aplicação
  local_aplicacao       text,
  data                  date not null default current_date,
  hora                  time not null default current_time,
  objetivo_uso          text,
  observacao            text,
  -- referencia cruzada para registro_medicacao legado (se migrado)
  id_registro_medicacao_origem uuid
    references public.registro_medicacao(id_registro_medicacao_uuid) on delete set null,
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);

create index if not exists idx_registro_insulina_paciente_data_hora
  on public.registro_insulina (id_paciente_uuid, data desc, hora desc);

create index if not exists idx_registro_insulina_categoria
  on public.registro_insulina (id_paciente_uuid, categoria_insulina, data desc);

-- updated_at trigger
create or replace function public.touch_registro_insulina_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_registro_insulina_updated_at on public.registro_insulina;
create trigger trg_touch_registro_insulina_updated_at
before update on public.registro_insulina
for each row
execute function public.touch_registro_insulina_updated_at();

-- ============================================================
-- RLS permissiva (mantém padrão atual do projeto)
-- ============================================================
alter table public.registro_insulina enable row level security;

drop policy if exists "Allow registro_insulina reads" on public.registro_insulina;
create policy "Allow registro_insulina reads"
on public.registro_insulina for select to anon, authenticated using (true);

drop policy if exists "Allow registro_insulina writes" on public.registro_insulina;
create policy "Allow registro_insulina writes"
on public.registro_insulina for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.registro_insulina to anon, authenticated;

-- ============================================================
-- Copia dados de insulina de registro_medicacao → registro_insulina
-- Mantém id_registro_medicacao_origem para rastreabilidade.
-- SAFE: usa INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================
insert into public.registro_insulina (
  id,
  id_paciente_uuid,
  categoria_insulina,
  nome_insulina,
  dose_ui,
  unidade_medida,
  local_aplicacao,
  data,
  hora,
  objetivo_uso,
  observacao,
  id_registro_medicacao_origem,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  rm.id_paciente_uuid,
  coalesce(
    nullif(
      case lower(trim(
        (
          select (regexp_match(
            coalesce(rm.observacao, ''),
            'Categoria da insulina:\s*([^\n\r]+)',
            'i'
          ))[1]
        )
      ))
        when 'basal'        then 'basal'
        when 'bolus'        then 'bolus'
        when 'rapida'       then 'rapida'
        when 'rápida'       then 'rapida'
        when 'intermediaria' then 'intermediaria'
        when 'intermediária' then 'intermediaria'
        when 'premisturada' then 'premisturada'
        else null
      end,
      null
    ),
    'basal'
  ),
  rm.nome_medicamento,
  coalesce(
    nullif(trim(coalesce(rm.quantidade, '')), '')::numeric,
    1
  ),
  coalesce(nullif(trim(coalesce(rm.unidade_medida, '')), ''), 'UI'),
  null,
  rm.data,
  rm.hora,
  nullif(trim(coalesce(
    (regexp_match(
      coalesce(rm.observacao, ''),
      'Objetivo do uso:\s*([^\n\r]+)',
      'i'
    ))[1],
    ''
  )), ''),
  rm.observacao,
  rm.id_registro_medicacao_uuid,
  coalesce(rm.created_at, timezone('utc', now())),
  coalesce(rm.updated_at, timezone('utc', now()))
from public.registro_medicacao rm
where rm.tipo_registro = 'insulin'
  and not exists (
    select 1
    from public.registro_insulina ri
    where ri.id_registro_medicacao_origem = rm.id_registro_medicacao_uuid
  );

-- ============================================================
-- RPC: registrar insulina (novo endpoint, não substitui RPC existente)
-- ============================================================
create or replace function public.registrar_insulina_paciente(
  p_id_paciente_uuid  uuid,
  p_categoria         text default 'basal',
  p_nome_insulina     text default null,
  p_dose_ui           numeric default null,
  p_unidade_medida    text default 'UI',
  p_local_aplicacao   text default null,
  p_data              date default current_date,
  p_hora              time default current_time,
  p_objetivo_uso      text default null,
  p_observacao        text default null
)
returns setof public.registro_insulina
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_id_paciente_uuid is null then
    raise exception 'Paciente sem identificador para registrar insulina.';
  end if;

  if p_dose_ui is null or p_dose_ui <= 0 then
    raise exception 'Dose de insulina invalida.';
  end if;

  if not exists (
    select 1 from public.paciente p
    where p.id_paciente_uuid = p_id_paciente_uuid
      and coalesce(p.excluido, false) = false
  ) then
    raise exception 'Paciente nao encontrado.';
  end if;

  return query
  insert into public.registro_insulina (
    id_paciente_uuid,
    categoria_insulina,
    nome_insulina,
    dose_ui,
    unidade_medida,
    local_aplicacao,
    data,
    hora,
    objetivo_uso,
    observacao
  )
  values (
    p_id_paciente_uuid,
    coalesce(nullif(trim(p_categoria), ''), 'basal'),
    nullif(trim(coalesce(p_nome_insulina, '')), ''),
    p_dose_ui,
    coalesce(nullif(trim(p_unidade_medida), ''), 'UI'),
    nullif(trim(coalesce(p_local_aplicacao, '')), ''),
    coalesce(p_data, current_date),
    coalesce(p_hora, current_time),
    nullif(trim(coalesce(p_objetivo_uso, '')), ''),
    nullif(trim(coalesce(p_observacao, '')), '')
  )
  returning *;
end;
$$;

create or replace function public.listar_insulinas_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120
)
returns setof public.registro_insulina
language sql
security definer
set search_path = public
as $$
  select *
  from public.registro_insulina
  where id_paciente_uuid = p_id_paciente_uuid
  order by data desc, hora desc
  limit greatest(1, coalesce(p_limite, 120));
$$;

grant execute on function public.registrar_insulina_paciente(uuid, text, text, numeric, text, text, date, time, text, text)
  to anon, authenticated;
grant execute on function public.listar_insulinas_paciente(uuid, integer)
  to anon, authenticated;
