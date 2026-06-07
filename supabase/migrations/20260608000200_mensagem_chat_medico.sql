-- Chat bidirecional paciente <-> medico (espelha mensagem_chat nutri)

create table if not exists public.mensagem_chat_medico (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  medico_id uuid not null references public.medico(id_medico_uuid) on delete cascade,
  autor_role text not null check (autor_role in ('paciente', 'medico')),
  texto text not null check (char_length(trim(texto)) > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_mensagem_chat_medico_paciente_medico_created
  on public.mensagem_chat_medico (paciente_id, medico_id, created_at asc);

create index if not exists idx_mensagem_chat_medico_medico_created
  on public.mensagem_chat_medico (medico_id, created_at desc);

create index if not exists idx_mensagem_chat_medico_medico_paciente_created
  on public.mensagem_chat_medico (medico_id, paciente_id, created_at desc);

create index if not exists idx_mensagem_chat_medico_medico_paciente_last
  on public.mensagem_chat_medico (medico_id, paciente_id, created_at desc);

alter table public.mensagem_chat_medico replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'mensagem_chat_medico'
    ) then
      alter publication supabase_realtime add table public.mensagem_chat_medico;
    end if;
  end if;
end $$;

create or replace function public.assert_sessao_chat_medico(
  p_token_sessao uuid,
  p_paciente_id  uuid,
  p_medico_id    uuid,
  p_autor_role   text default null
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

  if not public.paciente_vinculado_a_medico(p_paciente_id, p_medico_id) then
    raise exception 'Paciente nao vinculado a este medico.';
  end if;

  if v_role = 'paciente' then
    if v_actor_type <> 'paciente' or v_actor_id <> p_paciente_id then
      raise exception 'Sessao nao autorizada para enviar mensagem como paciente.';
    end if;
    return;
  end if;

  if v_role = 'medico' then
    if v_actor_type <> 'medico' or v_actor_id <> p_medico_id then
      raise exception 'Sessao nao autorizada para enviar mensagem como medico.';
    end if;
    return;
  end if;

  if v_actor_type = 'medico' and v_actor_id = p_medico_id then
    return;
  end if;

  if v_actor_type = 'paciente' and v_actor_id = p_paciente_id then
    return;
  end if;

  raise exception 'Sessao nao autorizada para este paciente.';
end;
$$;

create or replace function public.listar_mensagens_chat_medico(
  p_paciente_id  uuid,
  p_medico_id    uuid,
  p_limite       integer default 200,
  p_token_sessao uuid default null
)
returns table (
  id uuid,
  paciente_id uuid,
  medico_id uuid,
  autor_role text,
  texto text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_chat_medico(p_token_sessao, p_paciente_id, p_medico_id);

  return query
  select m.id, m.paciente_id, m.medico_id, m.autor_role, m.texto, m.created_at
  from public.mensagem_chat_medico m
  where m.paciente_id = p_paciente_id
    and m.medico_id = p_medico_id
  order by m.created_at asc
  limit greatest(1, least(coalesce(p_limite, 200), 500));
end;
$$;

create or replace function public.enviar_mensagem_chat_medico(
  p_paciente_id  uuid,
  p_medico_id    uuid,
  p_autor_role   text,
  p_texto        text,
  p_token_sessao uuid default null
)
returns public.mensagem_chat_medico
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mensagem_chat_medico;
  v_role text;
begin
  v_role := lower(trim(coalesce(p_autor_role, '')));
  if v_role not in ('paciente', 'medico') then
    raise exception 'Papel de autor invalido.';
  end if;

  if char_length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'Mensagem vazia.';
  end if;

  perform public.assert_sessao_chat_medico(p_token_sessao, p_paciente_id, p_medico_id, v_role);

  insert into public.mensagem_chat_medico (paciente_id, medico_id, autor_role, texto)
  values (p_paciente_id, p_medico_id, v_role, trim(p_texto))
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.listar_mensagens_chat_medico_inbox(
  p_medico_id               uuid,
  p_paciente_ids            uuid[],
  p_mensagens_por_paciente  integer default 12,
  p_token_sessao            uuid default null
)
returns table (
  id uuid,
  paciente_id uuid,
  medico_id uuid,
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
     or v_actor_type <> 'medico'
     or v_actor_id <> p_medico_id then
    raise exception 'Sessao nao autorizada para inbox de chat medico.';
  end if;

  return query
  select
    m.id,
    m.paciente_id,
    m.medico_id,
    m.autor_role,
    m.texto,
    m.created_at
  from unnest(coalesce(p_paciente_ids, array[]::uuid[])) as pid(paciente_id)
  cross join lateral (
    select
      mc.id,
      mc.paciente_id,
      mc.medico_id,
      mc.autor_role,
      mc.texto,
      mc.created_at
    from public.mensagem_chat_medico mc
    where mc.paciente_id = pid.paciente_id
      and mc.medico_id = p_medico_id
      and public.paciente_vinculado_a_medico(mc.paciente_id, p_medico_id)
    order by mc.created_at desc
    limit greatest(1, least(coalesce(p_mensagens_por_paciente, 12), 30))
  ) m
  order by m.paciente_id, m.created_at asc;
end;
$$;

create or replace function public.contar_resumo_chat_medico(p_medico_id uuid)
returns table (
  total_conversas bigint,
  nao_lidas bigint,
  atualizadas_hoje bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ultima as (
    select distinct on (m.paciente_id)
      m.paciente_id,
      m.autor_role,
      m.created_at
    from public.mensagem_chat_medico m
    where m.medico_id = p_medico_id
    order by m.paciente_id, m.created_at desc
  )
  select
    count(*)::bigint,
    count(*) filter (where autor_role = 'paciente')::bigint,
    count(*) filter (
      where created_at >= date_trunc('day', timezone('utc', now()))
    )::bigint
  from ultima;
$$;

alter table public.mensagem_chat_medico enable row level security;
revoke all on table public.mensagem_chat_medico from anon, authenticated;

grant execute on function public.assert_sessao_chat_medico(uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function public.listar_mensagens_chat_medico(uuid, uuid, integer, uuid) to anon, authenticated;
grant execute on function public.enviar_mensagem_chat_medico(uuid, uuid, text, text, uuid) to anon, authenticated;
grant execute on function public.listar_mensagens_chat_medico_inbox(uuid, uuid[], integer, uuid) to anon, authenticated;
grant execute on function public.contar_resumo_chat_medico(uuid) to anon, authenticated;
