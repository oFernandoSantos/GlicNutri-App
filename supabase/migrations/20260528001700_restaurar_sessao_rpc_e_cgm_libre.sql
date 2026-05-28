-- Restaura sessao RPC sem senha (app ja autenticado localmente)
-- CGM Libre: exige token na sincronizacao

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
  v_type  text := lower(trim(coalesce(p_actor_type, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ok    boolean := false;
begin
  if v_type not in ('paciente', 'nutricionista', 'medico') then
    raise exception 'Perfil invalido para restaurar sessao RPC.';
  end if;

  if p_actor_id is null or v_email = '' then
    raise exception 'Dados insuficientes para restaurar sessao RPC.';
  end if;

  if v_type = 'paciente' then
    select exists (
      select 1
      from public.paciente p
      where p.id_paciente_uuid = p_actor_id
        and coalesce(p.excluido, false) = false
        and lower(coalesce(p.email_pac, '')) = v_email
    ) into v_ok;
  elsif v_type = 'nutricionista' then
    select exists (
      select 1
      from public.nutricionista n
      where n.id_nutricionista_uuid = p_actor_id
        and coalesce(n.excluido, false) = false
        and lower(coalesce(n.email_acesso, '')) = v_email
    ) into v_ok;
  else
    select exists (
      select 1
      from public.medico m
      where m.id_medico_uuid = p_actor_id
        and coalesce(m.excluido, false) = false
        and lower(coalesce(m.email_medico, '')) = v_email
    ) into v_ok;
  end if;

  if coalesce(v_ok, false) is not true then
    raise exception 'Nao foi possivel validar perfil para restaurar sessao RPC.';
  end if;

  return public._criar_sessao_rpc_interna(v_type, p_actor_id);
end;
$$;

grant execute on function public.criar_sessao_rpc_restaurar_app(text, uuid, text)
  to anon, authenticated;

create or replace function public.sincronizar_glicemia_cgm(
  p_id_paciente_uuid  uuid,
  p_readings          jsonb,
  p_fonte             text default 'librelinkup',
  p_token_sessao      uuid default null
)
returns table (
  inseridos bigint,
  ignorados bigint
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inseridos bigint := 0;
  v_ignorados bigint := 0;
  v_item      jsonb;
  v_fonte     text;
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  if p_id_paciente_uuid is null then
    raise exception 'Paciente sem identificador para sincronizar CGM.';
  end if;

  if not exists (
    select 1 from public.paciente p
    where p.id_paciente_uuid = p_id_paciente_uuid
      and coalesce(p.excluido, false) = false
  ) then
    raise exception 'Paciente nao encontrado.';
  end if;

  v_fonte := coalesce(nullif(trim(p_fonte), ''), 'librelinkup');

  for v_item in select jsonb_array_elements(coalesce(p_readings, '[]'::jsonb))
  loop
    begin
      insert into public.registro_glicemia_cgm (
        id_paciente_uuid,
        valor_glicose_mgdl,
        data,
        hora,
        tendencia,
        fonte,
        device_serial,
        raw_payload
      )
      values (
        p_id_paciente_uuid,
        (v_item->>'value')::numeric,
        (v_item->>'date')::date,
        (v_item->>'time')::time,
        nullif(trim(coalesce(v_item->>'tendencia', '')), ''),
        coalesce(nullif(trim(coalesce(v_item->>'fonte', '')), ''), v_fonte),
        nullif(trim(coalesce(v_item->>'device_serial', '')), ''),
        v_item->'raw'
      )
      on conflict (id_paciente_uuid, data, hora, fonte) do nothing;

      if found then
        v_inseridos := v_inseridos + 1;
      else
        v_ignorados := v_ignorados + 1;
      end if;

    exception when others then
      v_ignorados := v_ignorados + 1;
    end;
  end loop;

  return query select v_inseridos, v_ignorados;
end;
$$;

grant execute on function public.sincronizar_glicemia_cgm(uuid, jsonb, text, uuid)
  to anon, authenticated;
