-- ============================================================
-- FASE 3: produtos_rotulo_cache + views (advisor Supabase)
-- - Cache: RLS ON, SELECT público, escrita só RPC
-- - Views: security_invoker (não rodam como owner)
-- ADDITIVE
-- ============================================================

-- ============================================================
-- 1. produtos_rotulo_cache — RPC busca + upsert
-- ============================================================
create or replace function public.buscar_produtos_rotulo_cache(
  p_query  text,
  p_limite integer default 12
)
returns setof public.produtos_rotulo_cache
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limite, 12), 24));
  v_safe  text;
begin
  if length(v_query) < 2 then
    return;
  end if;

  if v_query ~ '^\d{8,14}$' then
    return query
    select *
    from public.produtos_rotulo_cache
    where code = v_query
    order by updated_at desc
    limit v_limit;
    return;
  end if;

  v_safe := replace(replace(v_query, '\', '\\'), '%', '\%');
  v_safe := replace(v_safe, '_', '\_');

  return query
  select *
  from public.produtos_rotulo_cache
  where nome ilike '%' || v_safe || '%' escape '\'
     or coalesce(marca, '') ilike '%' || v_safe || '%' escape '\'
     or coalesce(categoria, '') ilike '%' || v_safe || '%' escape '\'
  order by updated_at desc
  limit v_limit;
end;
$$;

create or replace function public.upsert_produtos_rotulo_cache(
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if nullif(trim(v_row->>'code'), '') is null then
      continue;
    end if;

    insert into public.produtos_rotulo_cache (
      code,
      nome,
      marca,
      categoria,
      porcao,
      nutriments,
      produto_normalizado,
      fonte,
      updated_at
    )
    values (
      trim(v_row->>'code'),
      coalesce(nullif(trim(v_row->>'nome'), ''), 'Produto'),
      nullif(trim(v_row->>'marca'), ''),
      nullif(trim(v_row->>'categoria'), ''),
      nullif(trim(v_row->>'porcao'), ''),
      coalesce(v_row->'nutriments', '{}'::jsonb),
      coalesce(v_row->'produto_normalizado', '{}'::jsonb),
      coalesce(nullif(trim(v_row->>'fonte'), ''), 'Open Food Facts'),
      coalesce((v_row->>'updated_at')::timestamptz, timezone('utc', now()))
    )
    on conflict (code) do update set
      nome = excluded.nome,
      marca = excluded.marca,
      categoria = excluded.categoria,
      porcao = excluded.porcao,
      nutriments = excluded.nutriments,
      produto_normalizado = excluded.produto_normalizado,
      fonte = excluded.fonte,
      updated_at = excluded.updated_at;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.buscar_produtos_rotulo_cache(text, integer)
  to anon, authenticated;

grant execute on function public.upsert_produtos_rotulo_cache(jsonb)
  to anon, authenticated;

-- ============================================================
-- 2. RLS produtos_rotulo_cache — leitura aberta, escrita bloqueada
-- ============================================================
alter table public.produtos_rotulo_cache enable row level security;

drop policy if exists "rotulo_cache_select_public" on public.produtos_rotulo_cache;
create policy "rotulo_cache_select_public"
  on public.produtos_rotulo_cache
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.produtos_rotulo_cache from anon, authenticated;
grant select on public.produtos_rotulo_cache to anon, authenticated;

comment on table public.produtos_rotulo_cache is
  'Cache rotulos. SELECT via policy ou RPC buscar_produtos_rotulo_cache; UPSERT via RPC upsert_produtos_rotulo_cache.';

-- ============================================================
-- 3. Views — security_invoker (advisor Security Definer View)
-- ============================================================
alter view if exists public.glicemia_unificada
  set (security_invoker = true);

alter view if exists public.medico_dashboard_resumo
  set (security_invoker = true);

alter view if exists public.schema_relacionamentos_resumo
  set (security_invoker = true);

-- Views clínicas: remove anon (app não usa .from nessas views hoje)
revoke select on public.glicemia_unificada from anon;
revoke select on public.medico_dashboard_resumo from anon;

grant select on public.glicemia_unificada to authenticated;
grant select on public.medico_dashboard_resumo to authenticated;

-- Doc schema: authenticated apenas
revoke select on public.schema_relacionamentos_resumo from anon;
grant select on public.schema_relacionamentos_resumo to authenticated;
