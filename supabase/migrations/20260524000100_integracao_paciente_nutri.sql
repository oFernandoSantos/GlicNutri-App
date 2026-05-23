-- Integração paciente <-> nutricionista: chat, estado do app separado, alertas clínicos

create table if not exists public.mensagem_chat (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  nutricionista_id uuid not null references public.nutricionista(id_nutricionista_uuid) on delete cascade,
  autor_role text not null check (autor_role in ('paciente', 'nutricionista')),
  texto text not null check (char_length(trim(texto)) > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_mensagem_chat_paciente_nutri_created
  on public.mensagem_chat (paciente_id, nutricionista_id, created_at asc);

create table if not exists public.paciente_app_state (
  paciente_id uuid primary key references public.paciente(id_paciente_uuid) on delete cascade,
  estado jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.alerta_clinico (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.paciente(id_paciente_uuid) on delete cascade,
  nutricionista_id uuid references public.nutricionista(id_nutricionista_uuid) on delete set null,
  tipo text not null,
  titulo text not null,
  mensagem text not null default '',
  severidade text not null default 'info' check (severidade in ('info', 'warning', 'danger')),
  lido_paciente boolean not null default false,
  lido_nutri boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_alerta_clinico_paciente_created
  on public.alerta_clinico (paciente_id, created_at desc);

create index if not exists idx_alerta_clinico_nutri_lido
  on public.alerta_clinico (nutricionista_id, lido_nutri, created_at desc);

-- Vínculo paciente-nutri (consulta ativa ou vínculo direto)
create or replace function public.paciente_vinculado_a_nutri(
  p_paciente_id uuid,
  p_nutricionista_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = p_paciente_id
      and coalesce(p.excluido, false) = false
      and (
        p.id_nutricionista_uuid = p_nutricionista_id
        or exists (
          select 1
          from public.consulta c
          where c.paciente_id = p_paciente_id
            and c.nutricionista_id = p_nutricionista_id
            and c.status <> 'cancelled'
        )
      )
  );
$$;

create or replace function public.listar_mensagens_chat(
  p_paciente_id uuid,
  p_nutricionista_id uuid,
  p_limite integer default 200
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
  if not public.paciente_vinculado_a_nutri(p_paciente_id, p_nutricionista_id) then
    raise exception 'Paciente nao vinculado a este nutricionista.';
  end if;

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
  p_paciente_id uuid,
  p_nutricionista_id uuid,
  p_autor_role text,
  p_texto text
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

  if not public.paciente_vinculado_a_nutri(p_paciente_id, p_nutricionista_id) then
    raise exception 'Paciente nao vinculado a este nutricionista.';
  end if;

  insert into public.mensagem_chat (paciente_id, nutricionista_id, autor_role, texto)
  values (p_paciente_id, p_nutricionista_id, v_role, trim(p_texto))
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.obter_paciente_app_state(p_paciente_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select estado from public.paciente_app_state where paciente_id = p_paciente_id),
    '{}'::jsonb
  );
$$;

create or replace function public.salvar_paciente_app_state(
  p_paciente_id uuid,
  p_estado jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_paciente_id is null then
    raise exception 'Paciente sem identificador.';
  end if;

  insert into public.paciente_app_state (paciente_id, estado, updated_at)
  values (p_paciente_id, coalesce(p_estado, '{}'::jsonb), timezone('utc', now()))
  on conflict (paciente_id) do update
  set estado = excluded.estado,
      updated_at = excluded.updated_at;

  return (select estado from public.paciente_app_state where paciente_id = p_paciente_id);
end;
$$;

create or replace function public.listar_alertas_paciente(
  p_paciente_id uuid,
  p_apenas_nao_lidos boolean default true,
  p_limite integer default 30
)
returns setof public.alerta_clinico
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.alerta_clinico a
  where a.paciente_id = p_paciente_id
    and (not p_apenas_nao_lidos or a.lido_paciente = false)
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limite, 30), 100));
$$;

create or replace function public.listar_alertas_nutricionista(
  p_nutricionista_id uuid,
  p_apenas_nao_lidos boolean default true,
  p_limite integer default 50
)
returns setof public.alerta_clinico
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.alerta_clinico a
  inner join public.paciente p on p.id_paciente_uuid = a.paciente_id
  where a.nutricionista_id = p_nutricionista_id
    and coalesce(p.excluido, false) = false
    and (
      p.id_nutricionista_uuid = p_nutricionista_id
      or exists (
        select 1 from public.consulta c
        where c.paciente_id = a.paciente_id
          and c.nutricionista_id = p_nutricionista_id
          and c.status <> 'cancelled'
      )
    )
    and (not p_apenas_nao_lidos or a.lido_nutri = false)
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limite, 50), 200));
$$;

grant select, insert, update, delete on public.mensagem_chat to anon, authenticated;
grant select, insert, update, delete on public.paciente_app_state to anon, authenticated;
grant select, insert, update, delete on public.alerta_clinico to anon, authenticated;

grant execute on function public.paciente_vinculado_a_nutri(uuid, uuid) to anon, authenticated;
grant execute on function public.listar_mensagens_chat(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.enviar_mensagem_chat(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.obter_paciente_app_state(uuid) to anon, authenticated;
grant execute on function public.salvar_paciente_app_state(uuid, jsonb) to anon, authenticated;
grant execute on function public.listar_alertas_paciente(uuid, boolean, integer) to anon, authenticated;
grant execute on function public.listar_alertas_nutricionista(uuid, boolean, integer) to anon, authenticated;

alter table public.mensagem_chat enable row level security;
alter table public.paciente_app_state enable row level security;
alter table public.alerta_clinico enable row level security;

create policy "mensagem_chat_all" on public.mensagem_chat for all to anon, authenticated using (true) with check (true);
create policy "paciente_app_state_all" on public.paciente_app_state for all to anon, authenticated using (true) with check (true);
create policy "alerta_clinico_all" on public.alerta_clinico for all to anon, authenticated using (true) with check (true);
