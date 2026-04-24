create extension if not exists pgcrypto;

create table if not exists public.log_auditoria_app (
  id_log_auditoria_uuid uuid primary key default gen_random_uuid(),
  tipo_ator text not null default 'anonimo'
    check (tipo_ator in ('paciente', 'nutricionista', 'sistema', 'anonimo')),
  id_paciente_ator uuid references public.paciente(id_paciente_uuid) on delete set null,
  id_nutricionista_ator uuid references public.nutricionista(id_nutricionista_uuid) on delete set null,
  id_paciente_alvo uuid references public.paciente(id_paciente_uuid) on delete set null,
  acao text not null,
  entidade text not null,
  id_entidade text,
  origem text not null default 'app',
  status text not null default 'sucesso'
    check (status in ('sucesso', 'falha')),
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_log_auditoria_app_created_at
  on public.log_auditoria_app (created_at desc);

create index if not exists idx_log_auditoria_app_paciente_alvo
  on public.log_auditoria_app (id_paciente_alvo, created_at desc);

create index if not exists idx_log_auditoria_app_ator
  on public.log_auditoria_app (tipo_ator, id_paciente_ator, id_nutricionista_ator, created_at desc);

create or replace function public.registrar_log_auditoria_app(
  p_tipo_ator text default 'anonimo',
  p_id_paciente_ator uuid default null,
  p_id_nutricionista_ator uuid default null,
  p_id_paciente_alvo uuid default null,
  p_acao text default null,
  p_entidade text default null,
  p_id_entidade text default null,
  p_origem text default 'app',
  p_status text default 'sucesso',
  p_detalhes jsonb default '{}'::jsonb
)
returns public.log_auditoria_app
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo_ator text;
  v_status text;
  v_resultado public.log_auditoria_app;
begin
  if coalesce(trim(p_acao), '') = '' then
    raise exception 'A acao do log de auditoria e obrigatoria.';
  end if;

  if coalesce(trim(p_entidade), '') = '' then
    raise exception 'A entidade do log de auditoria e obrigatoria.';
  end if;

  v_tipo_ator := lower(coalesce(trim(p_tipo_ator), 'anonimo'));
  if v_tipo_ator not in ('paciente', 'nutricionista', 'sistema', 'anonimo') then
    v_tipo_ator := 'anonimo';
  end if;

  v_status := lower(coalesce(trim(p_status), 'sucesso'));
  if v_status not in ('sucesso', 'falha') then
    v_status := 'sucesso';
  end if;

  insert into public.log_auditoria_app (
    tipo_ator,
    id_paciente_ator,
    id_nutricionista_ator,
    id_paciente_alvo,
    acao,
    entidade,
    id_entidade,
    origem,
    status,
    detalhes
  )
  values (
    v_tipo_ator,
    p_id_paciente_ator,
    p_id_nutricionista_ator,
    p_id_paciente_alvo,
    trim(p_acao),
    trim(p_entidade),
    nullif(trim(coalesce(p_id_entidade, '')), ''),
    coalesce(nullif(trim(coalesce(p_origem, '')), ''), 'app'),
    v_status,
    coalesce(p_detalhes, '{}'::jsonb)
  )
  returning * into v_resultado;

  return v_resultado;
end;
$$;

grant execute on function public.registrar_log_auditoria_app(
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to anon, authenticated;
