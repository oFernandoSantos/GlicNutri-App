-- Alertas: marcar lido via RPC (tabela alerta_clinico sem acesso direto)
-- Chat inbox: exige sessao RPC do nutricionista

create or replace function public.marcar_alerta_paciente_lido(
  p_alerta_id    uuid,
  p_paciente_id  uuid,
  p_token_sessao uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  update public.alerta_clinico
  set lido_paciente = true
  where id = p_alerta_id
    and paciente_id = p_paciente_id;

  return found;
end;
$$;

create or replace function public.marcar_alerta_nutricionista_lido(
  p_alerta_id         uuid,
  p_nutricionista_id  uuid,
  p_token_sessao      uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_type text;
  v_actor_id   uuid;
  v_valida     boolean;
begin
  if p_token_sessao is null then
    raise exception 'Sessao RPC ausente. Faca login novamente.';
  end if;

  select v.actor_type, v.actor_id, v.valida
  into v_actor_type, v_actor_id, v_valida
  from public.validar_sessao_rpc(p_token_sessao) v
  limit 1;

  if coalesce(v_valida, false) is not true
     or v_actor_type <> 'nutricionista'
     or v_actor_id <> p_nutricionista_id then
    raise exception 'Sessao nao autorizada para marcar alerta do nutricionista.';
  end if;

  update public.alerta_clinico
  set lido_nutri = true
  where id = p_alerta_id
    and nutricionista_id = p_nutricionista_id;

  return found;
end;
$$;

create or replace function public.listar_mensagens_chat_inbox(
  p_nutricionista_id        uuid,
  p_paciente_ids            uuid[],
  p_mensagens_por_paciente  integer default 12,
  p_token_sessao            uuid default null
)
returns table (
  id uuid,
  paciente_id uuid,
  nutricionista_id uuid,
  autor_role text,
  texto text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_type text;
  v_actor_id   uuid;
  v_valida     boolean;
begin
  if p_token_sessao is null then
    raise exception 'Sessao RPC ausente. Faca login novamente.';
  end if;

  select v.actor_type, v.actor_id, v.valida
  into v_actor_type, v_actor_id, v_valida
  from public.validar_sessao_rpc(p_token_sessao) v
  limit 1;

  if coalesce(v_valida, false) is not true
     or v_actor_type <> 'nutricionista'
     or v_actor_id <> p_nutricionista_id then
    raise exception 'Sessao nao autorizada para inbox de chat.';
  end if;

  return query
  select
    m.id,
    m.paciente_id,
    m.nutricionista_id,
    m.autor_role,
    m.texto,
    m.created_at
  from unnest(coalesce(p_paciente_ids, array[]::uuid[])) as pid(paciente_id)
  cross join lateral (
    select
      mc.id,
      mc.paciente_id,
      mc.nutricionista_id,
      mc.autor_role,
      mc.texto,
      mc.created_at
    from public.mensagem_chat mc
    where mc.paciente_id = pid.paciente_id
      and mc.nutricionista_id = p_nutricionista_id
      and public.paciente_vinculado_a_nutri(mc.paciente_id, p_nutricionista_id)
    order by mc.created_at desc
    limit greatest(1, least(coalesce(p_mensagens_por_paciente, 12), 30))
  ) m
  order by m.paciente_id, m.created_at asc;
end;
$$;

grant execute on function public.marcar_alerta_paciente_lido(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.marcar_alerta_nutricionista_lido(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.listar_mensagens_chat_inbox(uuid, uuid[], integer, uuid) to anon, authenticated;
