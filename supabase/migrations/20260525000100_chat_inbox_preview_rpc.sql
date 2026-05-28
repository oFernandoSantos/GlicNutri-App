-- Ultimas mensagens por paciente para inbox do nutricionista (1 query, sem misturar conversas).
create or replace function public.listar_mensagens_chat_inbox(
  p_nutricionista_id uuid,
  p_paciente_ids uuid[],
  p_mensagens_por_paciente integer default 12
)
returns table (
  id uuid,
  paciente_id uuid,
  nutricionista_id uuid,
  autor_role text,
  texto text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.paciente_id,
    m.nutricionista_id,
    m.autor_role,
    m.texto,
    m.created_at
  from unnest(coalesce(p_paciente_ids, array[]::uuid[])) as pid(paciente_id)
  cross join lateral (
    select
      mc.id,
      mc.paciente_id,
      mc.nutricionista_id,
      mc.autor_role,
      mc.texto,
      mc.created_at
    from public.mensagem_chat mc
    where mc.paciente_id = pid.paciente_id
      and mc.nutricionista_id = p_nutricionista_id
    order by mc.created_at desc
    limit greatest(1, least(coalesce(p_mensagens_por_paciente, 12), 30))
  ) m
  order by m.paciente_id, m.created_at asc;
$$;

grant execute on function public.listar_mensagens_chat_inbox(uuid, uuid[], integer) to anon, authenticated;
