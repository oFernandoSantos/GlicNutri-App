create or replace function public.criar_sessao_rpc_restaurar_app(
  p_actor_type text,
  p_actor_id   uuid,
  p_email      text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := lower(trim(coalesce(p_actor_type, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ok boolean := false;
  v_has_excluido_nutri boolean := false;
  v_has_excluido_medico boolean := false;
begin
  if v_type not in ('paciente', 'nutricionista', 'medico') then
    raise exception 'Perfil invalido para restaurar sessao RPC.';
  end if;

  if p_actor_id is null or v_email = '' then
    raise exception 'Dados insuficientes para restaurar sessao RPC.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nutricionista'
      and column_name = 'excluido'
  ) into v_has_excluido_nutri;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medico'
      and column_name = 'excluido'
  ) into v_has_excluido_medico;

  if v_type = 'paciente' then
    select exists (
      select 1
      from public.paciente p
      where p.id_paciente_uuid = p_actor_id
        and coalesce(p.excluido, false) = false
        and lower(coalesce(p.email_pac, '')) = v_email
    ) into v_ok;
  elsif v_type = 'nutricionista' then
    if v_has_excluido_nutri then
      execute $sql$
        select exists (
          select 1
          from public.nutricionista n
          where n.id_nutricionista_uuid = $1
            and coalesce(n.excluido, false) = false
            and lower(coalesce(n.email_acesso, '')) = $2
        )
      $sql$
      into v_ok
      using p_actor_id, v_email;
    else
      select exists (
        select 1
        from public.nutricionista n
        where n.id_nutricionista_uuid = p_actor_id
          and lower(coalesce(n.email_acesso, '')) = v_email
      ) into v_ok;
    end if;
  else
    if v_has_excluido_medico then
      execute $sql$
        select exists (
          select 1
          from public.medico m
          where m.id_medico_uuid = $1
            and coalesce(m.excluido, false) = false
            and lower(coalesce(m.email_medico, '')) = $2
        )
      $sql$
      into v_ok
      using p_actor_id, v_email;
    else
      select exists (
        select 1
        from public.medico m
        where m.id_medico_uuid = p_actor_id
          and lower(coalesce(m.email_medico, '')) = v_email
      ) into v_ok;
    end if;
  end if;

  if coalesce(v_ok, false) is not true then
    raise exception 'Nao foi possivel validar perfil para restaurar sessao RPC.';
  end if;

  return public._criar_sessao_rpc_interna(v_type, p_actor_id);
end;
$$;

grant execute on function public.criar_sessao_rpc_restaurar_app(text, uuid, text)
  to anon, authenticated;
