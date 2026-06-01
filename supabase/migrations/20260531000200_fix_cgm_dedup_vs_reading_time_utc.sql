-- idx_registro_glicemia_cgm_dedup (data+hora) conflita com leituras novas por reading_time_utc.
-- Chave canonica = reading_time_utc. Duplicata legacy = ignorar, nao abortar batch.

drop index if exists public.idx_registro_glicemia_cgm_dedup;

create index if not exists idx_registro_glicemia_cgm_paciente_data_hora_fonte
  on public.registro_glicemia_cgm (id_paciente_uuid, data desc, hora desc, fonte);

drop function if exists public.sincronizar_glicemia_cgm(uuid, jsonb, text, uuid);

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
  v_reading_time_utc timestamptz;
  v_synced_at timestamptz := timezone('utc', now());
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
      v_reading_time_utc := nullif(trim(coalesce(v_item->>'readingTimeUtc', '')), '')::timestamptz;

      if v_reading_time_utc is null then
        v_ignorados := v_ignorados + 1;
        continue;
      end if;

      insert into public.registro_glicemia_cgm (
        id_paciente_uuid,
        valor_glicose_mgdl,
        reading_time_utc,
        data,
        hora,
        tendencia,
        fonte,
        device_serial,
        raw_payload,
        synced_at
      )
      values (
        p_id_paciente_uuid,
        (v_item->>'value')::numeric,
        v_reading_time_utc,
        (v_reading_time_utc at time zone 'America/Sao_Paulo')::date,
        (v_reading_time_utc at time zone 'America/Sao_Paulo')::time,
        nullif(trim(coalesce(v_item->>'tendencia', '')), ''),
        coalesce(nullif(trim(coalesce(v_item->>'fonte', '')), ''), v_fonte),
        nullif(trim(coalesce(v_item->>'device_serial', '')), ''),
        v_item->'raw',
        v_synced_at
      )
      on conflict (id_paciente_uuid, reading_time_utc, fonte)
      where reading_time_utc is not null
      do nothing;

      get diagnostics v_row_count = row_count;

      if v_row_count > 0 then
        v_inseridos := v_inseridos + 1;
      else
        v_ignorados := v_ignorados + 1;
      end if;

    exception
      when unique_violation then
        v_ignorados := v_ignorados + 1;
      when others then
        raise exception 'Falha ao inserir leitura CGM (%): %',
          coalesce(v_item->>'readingTimeUtc', '?'),
          sqlerrm;
    end;
  end loop;

  return query select v_inseridos, v_ignorados;
end;
$$;

grant execute on function public.sincronizar_glicemia_cgm(uuid, jsonb, text, uuid)
  to anon, authenticated;

alter function public.sincronizar_glicemia_cgm(uuid, jsonb, text, uuid) owner to postgres;
