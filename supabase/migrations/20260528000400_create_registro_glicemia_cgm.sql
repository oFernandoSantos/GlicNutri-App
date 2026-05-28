-- ============================================================
-- MIGRATION: registro_glicemia_cgm
-- Armazena leituras de sensor CGM (LibreView, Dexcom, etc.)
-- Separado de registro_glicemia_manual: fonte, frequência e
-- semântica diferentes.
-- ============================================================

create table if not exists public.registro_glicemia_cgm (
  id                      uuid primary key default gen_random_uuid(),
  id_paciente_uuid        uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  -- valor
  valor_glicose_mgdl      numeric not null check (valor_glicose_mgdl > 0),
  data                    date not null,
  hora                    time not null,
  -- tendência (seta do sensor)
  tendencia               text
    check (tendencia in (
      'subindo_rapido', 'subindo', 'estavel', 'descendo', 'descendo_rapido', null
    )),
  -- fonte / dispositivo
  fonte                   text not null default 'librelinkup'
    check (fonte in ('librelinkup', 'dexcom', 'abbottlibreview', 'manual_import', 'outro')),
  device_serial           text,
  -- dados brutos do provider (para auditoria/reprocessamento)
  raw_payload             jsonb,
  synced_at               timestamptz not null default timezone('utc', now()),
  created_at              timestamptz not null default timezone('utc', now())
);

-- Índice principal: busca por paciente e data/hora
create index if not exists idx_registro_glicemia_cgm_paciente_data_hora
  on public.registro_glicemia_cgm (id_paciente_uuid, data desc, hora desc);

-- Índice para detectar duplicatas por data+hora+fonte
create unique index if not exists idx_registro_glicemia_cgm_dedup
  on public.registro_glicemia_cgm (id_paciente_uuid, data, hora, fonte)
  where fonte is not null;

-- ============================================================
-- RLS permissiva
-- ============================================================
alter table public.registro_glicemia_cgm enable row level security;

drop policy if exists "Allow cgm reads" on public.registro_glicemia_cgm;
create policy "Allow cgm reads"
on public.registro_glicemia_cgm for select to anon, authenticated using (true);

drop policy if exists "Allow cgm writes" on public.registro_glicemia_cgm;
create policy "Allow cgm writes"
on public.registro_glicemia_cgm for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.registro_glicemia_cgm to anon, authenticated;

-- ============================================================
-- RPC: sincronizar leituras CGM (upsert por dedup index)
-- Chamada pela Edge Function libreview-sync após normalização.
-- ============================================================
create or replace function public.sincronizar_glicemia_cgm(
  p_id_paciente_uuid  uuid,
  p_readings          jsonb,   -- array de {value, date, time, tendencia?, fonte?, device_serial?, raw?}
  p_fonte             text default 'librelinkup'
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

create or replace function public.listar_glicemias_cgm_paciente(
  p_id_paciente_uuid  uuid,
  p_limite            integer default 288,  -- 24h × 12 leituras/h
  p_data_inicio       date default null,
  p_data_fim          date default null
)
returns setof public.registro_glicemia_cgm
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.registro_glicemia_cgm
  where id_paciente_uuid = p_id_paciente_uuid
    and (p_data_inicio is null or data >= p_data_inicio)
    and (p_data_fim    is null or data <= p_data_fim)
  order by data desc, hora desc
  limit greatest(1, coalesce(p_limite, 288));
$$;

grant execute on function public.sincronizar_glicemia_cgm(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.listar_glicemias_cgm_paciente(uuid, integer, date, date) to anon, authenticated;
