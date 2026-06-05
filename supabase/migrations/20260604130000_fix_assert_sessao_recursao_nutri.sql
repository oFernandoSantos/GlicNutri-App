-- Corrige recursao infinita: assert_sessao_acesso (nutri) -> assert_sessao_chat (role vazio)
-- -> assert_sessao_acesso -> ... que impedia listar registros no prontuario.

create or replace function public.assert_sessao_chat(
  p_token_sessao      uuid,
  p_paciente_id       uuid,
  p_nutricionista_id  uuid,
  p_autor_role        text default null
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
  v_role       text := lower(trim(coalesce(p_autor_role, '')));
begin
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

  if not public.paciente_vinculado_a_nutri(p_paciente_id, p_nutricionista_id) then
    raise exception 'Paciente nao vinculado a este nutricionista.';
  end if;

  if v_role = 'paciente' then
    if v_actor_type <> 'paciente' or v_actor_id <> p_paciente_id then
      raise exception 'Sessao nao autorizada para enviar mensagem como paciente.';
    end if;
    return;
  end if;

  if v_role = 'nutricionista' then
    if v_actor_type <> 'nutricionista' or v_actor_id <> p_nutricionista_id then
      raise exception 'Sessao nao autorizada para enviar mensagem como nutricionista.';
    end if;
    return;
  end if;

  -- Leitura/listagem (sem papel de autor): valida apenas token + vinculo acima.
  if v_actor_type = 'nutricionista' and v_actor_id = p_nutricionista_id then
    return;
  end if;

  if v_actor_type = 'paciente' and v_actor_id = p_paciente_id then
    return;
  end if;

  raise exception 'Sessao nao autorizada para este paciente.';
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
      raise exception 'Paciente nao vinculado a este nutricionista.';
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
