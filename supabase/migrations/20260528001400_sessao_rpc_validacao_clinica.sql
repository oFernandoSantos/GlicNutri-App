-- ============================================================
-- FASE 4: Sessão RPC (token) + validação em RPCs clínicas
-- App envia p_token_sessao emitido no login.
-- ============================================================

create table if not exists public.sessao_rpc (
  token        uuid primary key default gen_random_uuid(),
  actor_type   text not null check (actor_type in ('paciente', 'nutricionista', 'medico')),
  actor_id     uuid not null,
  expires_at   timestamptz not null,
  revogado_em  timestamptz,
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists idx_sessao_rpc_actor_ativo
  on public.sessao_rpc (actor_type, actor_id)
  where revogado_em is null;

alter table public.sessao_rpc enable row level security;

revoke all on table public.sessao_rpc from anon, authenticated;

-- ============================================================
-- Helpers sessão
-- ============================================================
create or replace function public._criar_sessao_rpc_interna(
  p_actor_type text,
  p_actor_id   uuid,
  p_ttl        interval default interval '7 days'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  if p_actor_id is null or nullif(trim(p_actor_type), '') is null then
    raise exception 'Actor invalido para sessao RPC.';
  end if;

  update public.sessao_rpc
  set revogado_em = timezone('utc', now())
  where actor_type = p_actor_type
    and actor_id = p_actor_id
    and revogado_em is null;

  insert into public.sessao_rpc (token, actor_type, actor_id, expires_at)
  values (v_token, lower(trim(p_actor_type)), p_actor_id, timezone('utc', now()) + p_ttl);

  return v_token;
end;
$$;

create or replace function public.validar_sessao_rpc(p_token_sessao uuid)
returns table (
  actor_type text,
  actor_id   uuid,
  valida     boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_token_sessao is null then
    return query select null::text, null::uuid, false;
    return;
  end if;

  return query
  select
    s.actor_type,
    s.actor_id,
    (s.revogado_em is null and s.expires_at > timezone('utc', now())) as valida
  from public.sessao_rpc s
  where s.token = p_token_sessao
  limit 1;
end;
$$;

create or replace function public.assert_sessao_acesso_paciente(
  p_token_sessao uuid,
  p_paciente_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_type text;
  v_actor_id   uuid;
  v_valida     boolean;
begin
  if p_paciente_id is null then
    raise exception 'Paciente sem identificador.';
  end if;

  if p_token_sessao is null then
    raise exception 'Sessao RPC ausente. Faca login novamente.';
  end if;

  select v.actor_type, v.actor_id, v.valida
  into v_actor_type, v_actor_id, v_valida
  from public.validar_sessao_rpc(p_token_sessao) v
  limit 1;

  if coalesce(v_valida, false) is not true then
    raise exception 'Sessao RPC invalida ou expirada. Faca login novamente.';
  end if;

  if v_actor_type = 'paciente' then
    if v_actor_id <> p_paciente_id then
      raise exception 'Sessao nao autorizada para este paciente.';
    end if;
    return;
  end if;

  if v_actor_type = 'nutricionista' then
    if not public.paciente_vinculado_a_nutri(p_paciente_id, v_actor_id) then
      raise exception 'Nutricionista sem vinculo com este paciente.';
    end if;
    return;
  end if;

  if v_actor_type = 'medico' then
    if not public.paciente_vinculado_a_medico(p_paciente_id, v_actor_id) then
      raise exception 'Medico sem vinculo com este paciente.';
    end if;
    return;
  end if;

  raise exception 'Tipo de sessao RPC nao suportado: %', v_actor_type;
end;
$$;

create or replace function public.criar_sessao_rpc_pos_credencial(
  p_actor_type    text,
  p_identificador text,
  p_senha         text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_type text := lower(trim(coalesce(p_actor_type, '')));
  v_id   uuid;
begin
  if v_type = 'paciente' then
    select p.id_paciente_uuid into v_id
    from public.verificar_login_paciente(p_identificador, p_senha) p
    limit 1;
  elsif v_type = 'nutricionista' then
    select n.id_nutricionista_uuid into v_id
    from public.verificar_login_nutricionista(p_identificador, p_senha) n
    limit 1;
  elsif v_type = 'medico' then
    select m.id_medico_uuid into v_id
    from public.verificar_login_medico(p_identificador, p_senha) m
    limit 1;
  else
    raise exception 'actor_type invalido: %', p_actor_type;
  end if;

  if v_id is null then
    raise exception 'Credenciais invalidas para emitir sessao RPC.';
  end if;

  return public._criar_sessao_rpc_interna(v_type, v_id);
end;
$$;

create or replace function public.criar_sessao_rpc_oauth_paciente()
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_uid   uuid := auth.uid();
  v_id    uuid;
begin
  if v_uid is null or v_email = '' then
    raise exception 'OAuth Supabase ausente para emitir sessao RPC.';
  end if;

  select p.id_paciente_uuid into v_id
  from public.paciente p
  where coalesce(p.excluido, false) = false
    and lower(coalesce(p.email_pac, '')) = v_email
  limit 1;

  if v_id is null then
    raise exception 'Paciente nao encontrado para o email OAuth.';
  end if;

  return public._criar_sessao_rpc_interna('paciente', v_id);
end;
$$;

create or replace function public.revogar_sessao_rpc(p_token_sessao uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token_sessao is null then
    return false;
  end if;

  update public.sessao_rpc
  set revogado_em = timezone('utc', now())
  where token = p_token_sessao
    and revogado_em is null;

  return found;
end;
$$;

grant execute on function public.criar_sessao_rpc_pos_credencial(text, text, text) to anon, authenticated;
grant execute on function public.criar_sessao_rpc_oauth_paciente() to anon, authenticated;
grant execute on function public.revogar_sessao_rpc(uuid) to anon, authenticated;

-- ============================================================
-- RPCs clínicas: exige p_token_sessao
-- ============================================================

create or replace function public.registrar_glicemia_manual_paciente(
  p_id_paciente_uuid uuid,
  p_valor_glicose_mgdl numeric,
  p_data date default current_date,
  p_hora time default current_time,
  p_sintomas_associados text default 'Registro manual pelo app',
  p_token_sessao uuid default null
)
returns table (
  id_glicemia_manual_uuid uuid,
  id_paciente_uuid uuid,
  valor_glicose_mgdl numeric,
  data date,
  hora time,
  sintomas_associados text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  if p_id_paciente_uuid is null then
    raise exception 'Paciente sem identificador para registrar glicemia.';
  end if;

  if p_valor_glicose_mgdl is null or p_valor_glicose_mgdl <= 0 then
    raise exception 'Valor de glicose invalido.';
  end if;

  if not exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = p_id_paciente_uuid
      and coalesce(p.excluido, false) = false
  ) then
    raise exception 'Paciente nao encontrado para registrar glicemia.';
  end if;

  return query
  insert into public.registro_glicemia_manual (
    id_glicemia_manual_uuid,
    id_paciente_uuid,
    valor_glicose_mgdl,
    data,
    hora,
    sintomas_associados
  )
  values (
    gen_random_uuid(),
    p_id_paciente_uuid,
    p_valor_glicose_mgdl,
    p_data,
    p_hora,
    p_sintomas_associados
  )
  returning
    id_glicemia_manual_uuid,
    id_paciente_uuid,
    valor_glicose_mgdl,
    data,
    hora,
    sintomas_associados;
end;
$$;

create or replace function public.listar_glicemias_manuais_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120,
  p_token_sessao uuid default null
)
returns setof public.registro_glicemia_manual
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  return query
  select *
  from public.registro_glicemia_manual
  where id_paciente_uuid = p_id_paciente_uuid
  order by data desc, hora desc
  limit greatest(coalesce(p_limite, 120), 1);
end;
$$;

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
  p_observacao        text default null,
  p_token_sessao      uuid default null
)
returns setof public.registro_insulina
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

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
  p_limite integer default 120,
  p_token_sessao uuid default null
)
returns setof public.registro_insulina
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  return query
  select *
  from public.registro_insulina
  where id_paciente_uuid = p_id_paciente_uuid
  order by data desc, hora desc
  limit greatest(coalesce(p_limite, 120), 1);
end;
$$;

create or replace function public.registrar_refeicao_ia_paciente(
  p_paciente_id              uuid,
  p_foto_url                 text default null,
  p_alimentos                jsonb default '[]'::jsonb,
  p_carboidratos_total       numeric default null,
  p_calorias_total           numeric default null,
  p_proteinas_total          numeric default null,
  p_gorduras_total           numeric default null,
  p_fibras_total             numeric default null,
  p_acucares_total           numeric default null,
  p_gorduras_saturadas_total numeric default null,
  p_sodio_total              numeric default null,
  p_confirmado               boolean default false,
  p_created_at               timestamptz default null,
  p_token_sessao             uuid default null
)
returns setof public.refeicao_ia
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  if p_paciente_id is null then
    raise exception 'Paciente sem identificador para registrar refeicao.';
  end if;

  if not exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = p_paciente_id
      and coalesce(p.excluido, false) = false
  ) then
    raise exception 'Paciente nao encontrado para registrar refeicao.';
  end if;

  return query
  insert into public.refeicao_ia (
    paciente_id,
    foto_url,
    alimentos,
    carboidratos_total,
    calorias_total,
    proteinas_total,
    gorduras_total,
    fibras_total,
    acucares_total,
    gorduras_saturadas_total,
    sodio_total,
    confirmado,
    created_at
  )
  values (
    p_paciente_id,
    nullif(trim(coalesce(p_foto_url, '')), ''),
    coalesce(p_alimentos, '[]'::jsonb),
    p_carboidratos_total,
    p_calorias_total,
    p_proteinas_total,
    p_gorduras_total,
    p_fibras_total,
    p_acucares_total,
    p_gorduras_saturadas_total,
    p_sodio_total,
    coalesce(p_confirmado, false),
    coalesce(p_created_at, timezone('utc', now()))
  )
  returning *;
end;
$$;

create or replace function public.listar_refeicoes_ia_paciente(
  p_paciente_id uuid,
  p_limite      integer default 120,
  p_token_sessao uuid default null
)
returns setof public.refeicao_ia
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  return query
  select *
  from public.refeicao_ia
  where paciente_id = p_paciente_id
  order by created_at desc
  limit greatest(coalesce(p_limite, 120), 1);
end;
$$;

-- registrar_medicacao + listar_medicacoes (versao 060002 + token)
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
  p_id_registro_legado text default null,
  p_token_sessao uuid default null
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
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

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
  select * from upserted;
end;
$$;

create or replace function public.listar_medicacoes_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120,
  p_token_sessao uuid default null
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
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  return query
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
end;
$$;

grant execute on function public.registrar_glicemia_manual_paciente(
  uuid, numeric, date, time, text, uuid
) to anon, authenticated;

grant execute on function public.listar_glicemias_manuais_paciente(uuid, integer, uuid)
  to anon, authenticated;

grant execute on function public.registrar_insulina_paciente(
  uuid, text, text, numeric, text, text, date, time, text, text, uuid
) to anon, authenticated;

grant execute on function public.listar_insulinas_paciente(uuid, integer, uuid)
  to anon, authenticated;

grant execute on function public.registrar_refeicao_ia_paciente(
  uuid, text, jsonb, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, boolean, timestamptz, uuid
) to anon, authenticated;

grant execute on function public.listar_refeicoes_ia_paciente(uuid, integer, uuid)
  to anon, authenticated;

grant execute on function public.registrar_medicacao_paciente(
  uuid, text, text, text, text, text, date, time, integer, boolean, text, text, uuid
) to anon, authenticated;

grant execute on function public.listar_medicacoes_paciente(uuid, integer, uuid)
  to anon, authenticated;
