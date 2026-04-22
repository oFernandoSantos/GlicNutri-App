create extension if not exists pgcrypto;

create table if not exists public.registro_medicacao (
  id_registro_medicacao_uuid uuid primary key default gen_random_uuid(),
  id_paciente_uuid uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  tipo_registro text not null default 'medicine' check (tipo_registro in ('medicine', 'insulin')),
  descricao text not null default '',
  nome_medicamento text,
  unidade_medida text,
  quantidade text,
  data date not null default current_date,
  hora time not null default current_time,
  dias_tratamento integer,
  uso_continuo boolean not null default false,
  observacao text,
  id_registro_legado text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_registro_medicacao_paciente_data_hora
  on public.registro_medicacao (id_paciente_uuid, data desc, hora desc);

create unique index if not exists idx_registro_medicacao_legado
  on public.registro_medicacao (id_paciente_uuid, id_registro_legado)
  where id_registro_legado is not null;

create or replace function public.touch_registro_medicacao_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_registro_medicacao_updated_at on public.registro_medicacao;
create trigger trg_touch_registro_medicacao_updated_at
before update on public.registro_medicacao
for each row
execute function public.touch_registro_medicacao_updated_at();

create or replace function public.registrar_medicacao_paciente(
  p_id_paciente_uuid uuid,
  p_tipo_registro text default 'medicine',
  p_descricao text default '',
  p_nome_medicamento text default null,
  p_unidade_medida text default null,
  p_quantidade text default null,
  p_data date default current_date,
  p_hora time default current_time,
  p_dias_tratamento integer default null,
  p_uso_continuo boolean default false,
  p_observacao text default null,
  p_id_registro_legado text default null
)
returns table (
  id_registro_medicacao_uuid uuid,
  id_paciente_uuid uuid,
  tipo_registro text,
  descricao text,
  nome_medicamento text,
  unidade_medida text,
  quantidade text,
  data date,
  hora time,
  dias_tratamento integer,
  uso_continuo boolean,
  observacao text,
  id_registro_legado text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tipo_registro text;
begin
  if p_id_paciente_uuid is null then
    raise exception 'Paciente sem identificador para registrar medicacao.';
  end if;

  if not exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = p_id_paciente_uuid
      and coalesce(p.excluido, false) = false
  ) then
    raise exception 'Paciente nao encontrado para registrar medicacao.';
  end if;

  v_tipo_registro := case
    when lower(coalesce(trim(p_tipo_registro), 'medicine')) = 'insulin' then 'insulin'
    else 'medicine'
  end;

  return query
  insert into public.registro_medicacao (
    id_paciente_uuid,
    tipo_registro,
    descricao,
    nome_medicamento,
    unidade_medida,
    quantidade,
    data,
    hora,
    dias_tratamento,
    uso_continuo,
    observacao,
    id_registro_legado
  )
  values (
    p_id_paciente_uuid,
    v_tipo_registro,
    coalesce(nullif(trim(p_descricao), ''), 'Medicacao / insulina'),
    nullif(trim(p_nome_medicamento), ''),
    nullif(trim(p_unidade_medida), ''),
    nullif(trim(p_quantidade), ''),
    coalesce(p_data, current_date),
    coalesce(p_hora, current_time),
    case when coalesce(p_uso_continuo, false) then null else p_dias_tratamento end,
    coalesce(p_uso_continuo, false),
    nullif(trim(p_observacao), ''),
    nullif(trim(p_id_registro_legado), '')
  )
  on conflict (id_paciente_uuid, id_registro_legado)
  where id_registro_legado is not null
  do update set
    tipo_registro = excluded.tipo_registro,
    descricao = excluded.descricao,
    nome_medicamento = excluded.nome_medicamento,
    unidade_medida = excluded.unidade_medida,
    quantidade = excluded.quantidade,
    data = excluded.data,
    hora = excluded.hora,
    dias_tratamento = excluded.dias_tratamento,
    uso_continuo = excluded.uso_continuo,
    observacao = excluded.observacao,
    updated_at = timezone('utc', now())
  returning
    registro_medicacao.id_registro_medicacao_uuid,
    registro_medicacao.id_paciente_uuid,
    registro_medicacao.tipo_registro,
    registro_medicacao.descricao,
    registro_medicacao.nome_medicamento,
    registro_medicacao.unidade_medida,
    registro_medicacao.quantidade,
    registro_medicacao.data,
    registro_medicacao.hora,
    registro_medicacao.dias_tratamento,
    registro_medicacao.uso_continuo,
    registro_medicacao.observacao,
    registro_medicacao.id_registro_legado;
end;
$$;

create or replace function public.listar_medicacoes_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120
)
returns table (
  id_registro_medicacao_uuid uuid,
  id_paciente_uuid uuid,
  tipo_registro text,
  descricao text,
  nome_medicamento text,
  unidade_medida text,
  quantidade text,
  data date,
  hora time,
  dias_tratamento integer,
  uso_continuo boolean,
  observacao text,
  id_registro_legado text
)
language sql
security definer
set search_path = public
as $$
  select
    rm.id_registro_medicacao_uuid,
    rm.id_paciente_uuid,
    rm.tipo_registro,
    rm.descricao,
    rm.nome_medicamento,
    rm.unidade_medida,
    rm.quantidade,
    rm.data,
    rm.hora,
    rm.dias_tratamento,
    rm.uso_continuo,
    rm.observacao,
    rm.id_registro_legado
  from public.registro_medicacao rm
  where rm.id_paciente_uuid = p_id_paciente_uuid
  order by rm.data desc, rm.hora desc
  limit greatest(coalesce(p_limite, 120), 1);
$$;

create or replace function public.excluir_medicacao_paciente(
  p_id_paciente_uuid uuid,
  p_id_registro_medicacao_uuid uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.registro_medicacao
  where id_paciente_uuid = p_id_paciente_uuid
    and id_registro_medicacao_uuid = p_id_registro_medicacao_uuid;

  return found;
end;
$$;

grant select, insert, update, delete on public.registro_medicacao to anon, authenticated;

grant execute on function public.registrar_medicacao_paciente(
  uuid,
  text,
  text,
  text,
  text,
  text,
  date,
  time,
  integer,
  boolean,
  text,
  text
) to anon, authenticated;

grant execute on function public.listar_medicacoes_paciente(
  uuid,
  integer
) to anon, authenticated;

grant execute on function public.excluir_medicacao_paciente(
  uuid,
  uuid
) to anon, authenticated;
