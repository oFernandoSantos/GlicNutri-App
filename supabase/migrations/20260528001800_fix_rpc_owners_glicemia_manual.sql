-- Fix: "permission denied for table registro_glicemia_manual"
-- Causa: RLS sem policy bloqueia role do security definer se != owner da tabela.
-- Solucao: owner postgres nas tabelas clinicas + RPCs; listar retorna TABLE (nao setof).

-- ============================================================
-- 1. Owners das tabelas (postgres bypassa RLS)
-- ============================================================
alter table if exists public.registro_glicemia_manual owner to postgres;
alter table if exists public.registro_insulina owner to postgres;
alter table if exists public.registro_glicemia_cgm owner to postgres;
alter table if exists public.mensagem_chat owner to postgres;
alter table if exists public.paciente_app_state owner to postgres;
alter table if exists public.alerta_clinico owner to postgres;
alter table if exists public.registro_medicacao owner to postgres;
alter table if exists public.refeicao_ia owner to postgres;

-- Fecha grants herdados via PUBLIC (RLS ainda bloqueia anon/authenticated)
revoke all on table public.registro_glicemia_manual from public;
revoke all on table public.registro_insulina from public;
revoke all on table public.registro_glicemia_cgm from public;
revoke all on table public.mensagem_chat from public;
revoke all on table public.paciente_app_state from public;
revoke all on table public.alerta_clinico from public;
revoke all on table public.registro_medicacao from public;
revoke all on table public.refeicao_ia from public;

revoke all on table public.registro_glicemia_manual from anon, authenticated;
revoke all on table public.registro_insulina from anon, authenticated;
revoke all on table public.registro_glicemia_cgm from anon, authenticated;
revoke all on table public.mensagem_chat from anon, authenticated;
revoke all on table public.paciente_app_state from anon, authenticated;
revoke all on table public.alerta_clinico from anon, authenticated;
revoke all on table public.registro_medicacao from anon, authenticated;
revoke all on table public.refeicao_ia from anon, authenticated;

-- ============================================================
-- 2. RPCs glicemia manual (security definer + owner postgres)
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
    coalesce(p_data, current_date),
    coalesce(p_hora, current_time),
    coalesce(nullif(trim(p_sintomas_associados), ''), 'Registro manual pelo app')
  )
  returning
    registro_glicemia_manual.id_glicemia_manual_uuid,
    registro_glicemia_manual.id_paciente_uuid,
    registro_glicemia_manual.valor_glicose_mgdl,
    registro_glicemia_manual.data,
    registro_glicemia_manual.hora,
    registro_glicemia_manual.sintomas_associados;
end;
$$;

drop function if exists public.listar_glicemias_manuais_paciente(uuid, integer, uuid);
drop function if exists public.listar_glicemias_manuais_paciente(uuid, integer);

create or replace function public.listar_glicemias_manuais_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120,
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
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  return query
  select
    g.id_glicemia_manual_uuid,
    g.id_paciente_uuid,
    g.valor_glicose_mgdl,
    g.data,
    g.hora,
    g.sintomas_associados
  from public.registro_glicemia_manual g
  where g.id_paciente_uuid = p_id_paciente_uuid
  order by g.data desc, g.hora desc
  limit greatest(coalesce(p_limite, 120), 1);
end;
$$;

alter function public.registrar_glicemia_manual_paciente(
  uuid, numeric, date, time, text, uuid
) owner to postgres;

alter function public.listar_glicemias_manuais_paciente(
  uuid, integer, uuid
) owner to postgres;

grant execute on function public.registrar_glicemia_manual_paciente(
  uuid, numeric, date, time, text, uuid
) to anon, authenticated;

grant execute on function public.listar_glicemias_manuais_paciente(
  uuid, integer, uuid
) to anon, authenticated;

-- CGM: mesmo padrao owner
alter function public.listar_glicemias_cgm_paciente(uuid, integer, uuid) owner to postgres;
alter function public.sincronizar_glicemia_cgm(uuid, jsonb, text, uuid) owner to postgres;
