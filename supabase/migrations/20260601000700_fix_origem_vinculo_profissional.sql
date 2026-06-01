-- Normaliza origens invalidas ao gravar paciente_profissional_vinculo.

create or replace function public.normalizar_origem_vinculo(
  p_origem text,
  p_consulta_id uuid default null
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(nullif(trim(p_origem), ''), 'manual') in
      ('consulta', 'solicitacao', 'manual', 'admin', 'seed')
    then coalesce(nullif(trim(p_origem), ''), 'manual')
    when p_consulta_id is not null then 'consulta'
    when coalesce(nullif(trim(p_origem), ''), '') ilike '%solicit%' then 'solicitacao'
    else 'manual'
  end;
$$;

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
declare
  v_medico_atual uuid;
  v_origem text;
begin
  if p_paciente_id is null or p_medico_id is null then
    return false;
  end if;

  v_origem := public.normalizar_origem_vinculo(p_origem, p_consulta_id);

  select p.id_medico_uuid
  into v_medico_atual
  from public.paciente p
  where p.id_paciente_uuid = p_paciente_id
    and coalesce(p.excluido, false) = false;

  if v_medico_atual is not null and v_medico_atual <> p_medico_id then
    raise exception 'Paciente ja possui medico vinculado. Desvincule o acompanhamento atual antes de solicitar outro.';
  end if;

  update public.paciente_profissional_vinculo
  set ativo = false, updated_at = timezone('utc', now())
  where paciente_id = p_paciente_id
    and medico_id is not null
    and medico_id <> p_medico_id
    and ativo = true;

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
    v_origem,
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
  v_origem text;
begin
  if p_nutricionista_id is null and p_medico_id is null then
    raise exception 'Informe nutricionista_id ou medico_id para criar vinculo.';
  end if;

  v_origem := public.normalizar_origem_vinculo(p_origem, p_consulta_id);

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
    v_origem,
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

grant execute on function public.normalizar_origem_vinculo(text, uuid) to anon, authenticated;
