-- Escalabilidade: ~1000 pacientes, ~200 nutricionistas
-- Indices para listas, chat e vinculos

create index if not exists idx_paciente_nutri_atualizado
  on public.paciente (id_nutricionista_uuid, data_hora_ultima_atualizacao desc)
  where coalesce(excluido, false) = false;

create index if not exists idx_consulta_nutri_paciente_ativo
  on public.consulta (nutricionista_id, paciente_id, scheduled_at desc)
  where status <> 'cancelled';

create index if not exists idx_mensagem_chat_nutri_created
  on public.mensagem_chat (nutricionista_id, created_at desc);

create index if not exists idx_mensagem_chat_nutri_paciente_created
  on public.mensagem_chat (nutricionista_id, paciente_id, created_at desc);

create index if not exists idx_alerta_clinico_paciente_created
  on public.alerta_clinico (paciente_id, created_at desc);

-- Resumo de chat para dashboard nutri (1 query, sem carregar todos os pacientes)
create or replace function public.contar_resumo_chat_nutri(p_nutricionista_id uuid)
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
    from public.mensagem_chat m
    where m.nutricionista_id = p_nutricionista_id
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

-- Total de pacientes vinculados (direto + consulta)
create or replace function public.contar_pacientes_nutricionista(p_nutricionista_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct pid)::bigint
  from (
    select p.id_paciente_uuid as pid
    from public.paciente p
    where p.id_nutricionista_uuid = p_nutricionista_id
      and coalesce(p.excluido, false) = false
    union
    select c.paciente_id as pid
    from public.consulta c
    where c.nutricionista_id = p_nutricionista_id
      and c.status <> 'cancelled'
      and c.paciente_id is not null
  ) vinculos;
$$;

grant execute on function public.contar_resumo_chat_nutri(uuid) to anon, authenticated;
grant execute on function public.contar_pacientes_nutricionista(uuid) to anon, authenticated;
