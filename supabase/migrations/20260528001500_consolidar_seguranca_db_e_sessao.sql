-- ============================================================
-- CONSOLIDAÇÃO: segurança DB + sessão RPC em fluxos clínicos
-- ADDITIVE
-- ============================================================

-- Garante tabela glicemia manual (criada fora do repo em alguns ambientes)
create table if not exists public.registro_glicemia_manual (
  id_glicemia_manual_uuid uuid primary key default gen_random_uuid(),
  id_paciente_uuid uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  valor_glicose_mgdl numeric not null check (valor_glicose_mgdl > 0),
  data date not null default current_date,
  hora time not null default current_time,
  sintomas_associados text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_glicemia_manual_paciente_data_hora
  on public.registro_glicemia_manual (id_paciente_uuid, data desc, hora desc);

-- ============================================================
-- Sessão: renovar token (app restart sem novo login)
-- ============================================================
create or replace function public.renovar_sessao_rpc(p_token_sessao uuid)
returns uuid
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
    raise exception 'Token de sessao ausente.';
  end if;

  select v.actor_type, v.actor_id, v.valida
  into v_actor_type, v_actor_id, v_valida
  from public.validar_sessao_rpc(p_token_sessao) v
  limit 1;

  if coalesce(v_valida, false) is not true then
    raise exception 'Sessao RPC invalida ou expirada. Faca login novamente.';
  end if;

  return public._criar_sessao_rpc_interna(v_actor_type, v_actor_id);
end;
$$;

grant execute on function public.renovar_sessao_rpc(uuid) to anon, authenticated;

-- Chat: valida token + papel do autor
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

  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);
end;
$$;

-- ============================================================
-- RPCs com p_token_sessao (app state, chat, alertas, prontuario)
-- ============================================================
create or replace function public.obter_paciente_app_state(
  p_paciente_id  uuid,
  p_token_sessao uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);
  return coalesce(
    (select estado from public.paciente_app_state where paciente_id = p_paciente_id),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.salvar_paciente_app_state(
  p_paciente_id  uuid,
  p_estado       jsonb,
  p_token_sessao uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  insert into public.paciente_app_state (paciente_id, estado, updated_at)
  values (p_paciente_id, coalesce(p_estado, '{}'::jsonb), timezone('utc', now()))
  on conflict (paciente_id) do update
  set estado = excluded.estado,
      updated_at = excluded.updated_at;

  return (select estado from public.paciente_app_state where paciente_id = p_paciente_id);
end;
$$;

create or replace function public.listar_mensagens_chat(
  p_paciente_id       uuid,
  p_nutricionista_id  uuid,
  p_limite            integer default 200,
  p_token_sessao      uuid default null
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
begin
  perform public.assert_sessao_chat(p_token_sessao, p_paciente_id, p_nutricionista_id);

  return query
  select m.id, m.paciente_id, m.nutricionista_id, m.autor_role, m.texto, m.created_at
  from public.mensagem_chat m
  where m.paciente_id = p_paciente_id
    and m.nutricionista_id = p_nutricionista_id
  order by m.created_at asc
  limit greatest(1, least(coalesce(p_limite, 200), 500));
end;
$$;

create or replace function public.enviar_mensagem_chat(
  p_paciente_id       uuid,
  p_nutricionista_id  uuid,
  p_autor_role        text,
  p_texto             text,
  p_token_sessao      uuid default null
)
returns public.mensagem_chat
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mensagem_chat;
  v_role text;
begin
  v_role := lower(trim(coalesce(p_autor_role, '')));
  if v_role not in ('paciente', 'nutricionista') then
    raise exception 'Papel de autor invalido.';
  end if;

  if char_length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'Mensagem vazia.';
  end if;

  perform public.assert_sessao_chat(p_token_sessao, p_paciente_id, p_nutricionista_id, v_role);

  insert into public.mensagem_chat (paciente_id, nutricionista_id, autor_role, texto)
  values (p_paciente_id, p_nutricionista_id, v_role, trim(p_texto))
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.listar_alertas_paciente(
  p_paciente_id        uuid,
  p_apenas_nao_lidos   boolean default true,
  p_limite             integer default 30,
  p_token_sessao       uuid default null
)
returns setof public.alerta_clinico
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  return query
  select *
  from public.alerta_clinico a
  where a.paciente_id = p_paciente_id
    and (not p_apenas_nao_lidos or a.lido_paciente = false)
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limite, 30), 100));
end;
$$;

create or replace function public.listar_alertas_nutricionista(
  p_nutricionista_id   uuid,
  p_apenas_nao_lidos   boolean default true,
  p_limite             integer default 50,
  p_token_sessao       uuid default null
)
returns setof public.alerta_clinico
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
    raise exception 'Sessao nao autorizada para listar alertas do nutricionista.';
  end if;

  return query
  select a.*
  from public.alerta_clinico a
  inner join public.paciente p on p.id_paciente_uuid = a.paciente_id
  where a.nutricionista_id = p_nutricionista_id
    and (not p_apenas_nao_lidos or a.lido_nutri = false)
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limite, 50), 100));
end;
$$;

create or replace function public.inserir_alertas_clinicos(
  p_paciente_id  uuid,
  p_alertas      jsonb,
  p_token_sessao uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_count integer := 0;
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  if p_alertas is null or jsonb_typeof(p_alertas) <> 'array' then
    return 0;
  end if;

  for v_item in select value from jsonb_array_elements(p_alertas)
  loop
    insert into public.alerta_clinico (
      paciente_id,
      nutricionista_id,
      tipo,
      titulo,
      mensagem,
      severidade
    )
    values (
      p_paciente_id,
      nullif(v_item->>'nutricionista_id', '')::uuid,
      coalesce(nullif(trim(v_item->>'tipo'), ''), 'geral'),
      coalesce(nullif(trim(v_item->>'titulo'), ''), 'Alerta'),
      coalesce(nullif(trim(v_item->>'mensagem'), ''), ''),
      coalesce(nullif(trim(v_item->>'severidade'), ''), 'info')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.obter_prontuario_paciente(
  p_paciente_id  uuid,
  p_token_sessao uuid default null
)
returns setof public.prontuario
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);
  return query select * from public.prontuario where paciente_id = p_paciente_id limit 1;
end;
$$;

create or replace function public.upsert_prontuario_paciente(
  p_paciente_id              uuid,
  p_queixa_principal         text default null,
  p_historico_doenca_atual   text default null,
  p_historico_familiar       text default null,
  p_comorbidades             text[] default null,
  p_alergias                 text[] default null,
  p_diagnosticos_cid         text[] default null,
  p_tipo_diabetes            text default null,
  p_ano_diagnostico_diabetes integer default null,
  p_usa_insulina             boolean default null,
  p_esquema_insulina         text default null,
  p_observacoes_gerais       text default null,
  p_token_sessao             uuid default null
)
returns setof public.prontuario
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  insert into public.prontuario (paciente_id)
  values (p_paciente_id)
  on conflict (paciente_id) do nothing;

  update public.prontuario set
    queixa_principal          = coalesce(p_queixa_principal, queixa_principal),
    historico_doenca_atual    = coalesce(p_historico_doenca_atual, historico_doenca_atual),
    historico_familiar        = coalesce(p_historico_familiar, historico_familiar),
    comorbidades              = coalesce(p_comorbidades, comorbidades),
    alergias                  = coalesce(p_alergias, alergias),
    diagnosticos_cid          = coalesce(p_diagnosticos_cid, diagnosticos_cid),
    tipo_diabetes             = coalesce(p_tipo_diabetes, tipo_diabetes),
    ano_diagnostico_diabetes  = coalesce(p_ano_diagnostico_diabetes, ano_diagnostico_diabetes),
    usa_insulina              = coalesce(p_usa_insulina, usa_insulina),
    esquema_insulina          = coalesce(p_esquema_insulina, esquema_insulina),
    observacoes_gerais        = coalesce(p_observacoes_gerais, observacoes_gerais),
    updated_at                = timezone('utc', now())
  where paciente_id = p_paciente_id;

  return query select * from public.prontuario where paciente_id = p_paciente_id;
end;
$$;

create or replace function public.registrar_evolucao_prontuario(
  p_paciente_id       uuid,
  p_nutricionista_id  uuid default null,
  p_medico_id         uuid default null,
  p_consulta_id       uuid default null,
  p_subjetivo         text default null,
  p_avaliacao         text default null,
  p_plano             text default null,
  p_orientacoes       text default null,
  p_token_sessao      uuid default null
)
returns setof public.prontuario_evolucao
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_paciente_id);

  if p_nutricionista_id is null and p_medico_id is null then
    raise exception 'Informe nutricionista_id ou medico_id para registrar evolucao.';
  end if;

  return query
  insert into public.prontuario_evolucao (
    paciente_id, nutricionista_id, medico_id, consulta_id,
    subjetivo, avaliacao, plano, orientacoes_gerais
  )
  values (
    p_paciente_id, p_nutricionista_id, p_medico_id, p_consulta_id,
    nullif(trim(coalesce(p_subjetivo, '')), ''),
    nullif(trim(coalesce(p_avaliacao, '')), ''),
    nullif(trim(coalesce(p_plano, '')), ''),
    nullif(trim(coalesce(p_orientacoes, '')), '')
  )
  returning *;
end;
$$;

create or replace function public.listar_glicemias_cgm_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120,
  p_token_sessao uuid default null
)
returns setof public.registro_glicemia_cgm
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  return query
  select *
  from public.registro_glicemia_cgm
  where id_paciente_uuid = p_id_paciente_uuid
  order by data desc, hora desc
  limit greatest(coalesce(p_limite, 120), 1);
end;
$$;

grant execute on function public.obter_paciente_app_state(uuid, uuid) to anon, authenticated;
grant execute on function public.salvar_paciente_app_state(uuid, jsonb, uuid) to anon, authenticated;
grant execute on function public.listar_mensagens_chat(uuid, uuid, integer, uuid) to anon, authenticated;
grant execute on function public.enviar_mensagem_chat(uuid, uuid, text, text, uuid) to anon, authenticated;
grant execute on function public.listar_alertas_paciente(uuid, boolean, integer, uuid) to anon, authenticated;
grant execute on function public.listar_alertas_nutricionista(uuid, boolean, integer, uuid) to anon, authenticated;
grant execute on function public.inserir_alertas_clinicos(uuid, jsonb, uuid) to anon, authenticated;
grant execute on function public.obter_prontuario_paciente(uuid, uuid) to anon, authenticated;
grant execute on function public.upsert_prontuario_paciente(
  uuid, text, text, text, text[], text[], text[], text, integer, boolean, text, text, uuid
) to anon, authenticated;
grant execute on function public.registrar_evolucao_prontuario(
  uuid, uuid, uuid, uuid, text, text, text, text, uuid
) to anon, authenticated;
grant execute on function public.listar_glicemias_cgm_paciente(uuid, integer, uuid) to anon, authenticated;

-- ============================================================
-- RLS fase 4b: bloqueia acesso direto (somente RPC)
-- ============================================================
alter table public.registro_insulina enable row level security;
alter table public.registro_glicemia_manual enable row level security;
alter table public.registro_glicemia_cgm enable row level security;
alter table public.mensagem_chat enable row level security;
alter table public.paciente_app_state enable row level security;
alter table public.alerta_clinico enable row level security;

revoke all on table public.registro_insulina from anon, authenticated;
revoke all on table public.registro_glicemia_manual from anon, authenticated;
revoke all on table public.registro_glicemia_cgm from anon, authenticated;
revoke all on table public.mensagem_chat from anon, authenticated;
revoke all on table public.paciente_app_state from anon, authenticated;
revoke all on table public.alerta_clinico from anon, authenticated;
