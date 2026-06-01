-- Fix: sincronizar_glicemia_cgm falhava silenciosamente porque ON CONFLICT
-- nao incluia o predicado do indice parcial idx_registro_glicemia_cgm_dedup.

drop function if exists public.sincronizar_glicemia_cgm(uuid, jsonb, text);

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
  v_row_count bigint := 0;
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
      on conflict (id_paciente_uuid, data, hora, fonte)
      where fonte is not null
      do nothing;

      get diagnostics v_row_count = row_count;

      if v_row_count > 0 then
        v_inseridos := v_inseridos + 1;
      else
        v_ignorados := v_ignorados + 1;
      end if;

    exception when others then
      raise exception 'Falha ao inserir leitura CGM (%): %',
        coalesce(v_item->>'date', '?') || ' ' || coalesce(v_item->>'time', '?'),
        sqlerrm;
    end;
  end loop;

  return query select v_inseridos, v_ignorados;
end;
$$;

grant execute on function public.sincronizar_glicemia_cgm(uuid, jsonb, text, uuid)
  to anon, authenticated;

alter function public.sincronizar_glicemia_cgm(uuid, jsonb, text, uuid) owner to postgres;

drop function if exists public._debug_cgm_insert_once();
drop function if exists public._debug_cgm_insert_conflict();
