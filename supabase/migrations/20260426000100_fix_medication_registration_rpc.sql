do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_registro_medicacao_paciente_legado'
      and conrelid = 'public.registro_medicacao'::regclass
  ) then
    alter table public.registro_medicacao
      add constraint uq_registro_medicacao_paciente_legado
      unique (id_paciente_uuid, id_registro_legado);
  end if;
end;
$$;

drop index if exists public.idx_registro_medicacao_legado;

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
  with upserted as (
    insert into public.registro_medicacao as rm (
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
    on conflict on constraint uq_registro_medicacao_paciente_legado
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
  )
  select
    upserted.id_registro_medicacao_uuid,
    upserted.id_paciente_uuid,
    upserted.tipo_registro,
    upserted.descricao,
    upserted.nome_medicamento,
    upserted.unidade_medida,
    upserted.quantidade,
    upserted.data,
    upserted.hora,
    upserted.dias_tratamento,
    upserted.uso_continuo,
    upserted.observacao,
    upserted.id_registro_legado
  from upserted;
end;
$$;

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
