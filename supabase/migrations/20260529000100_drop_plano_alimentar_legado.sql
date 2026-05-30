-- ============================================================
-- Remove schema legado de plano alimentar (substituído por
-- plano_alimentar + plano_alimentar_refeicao + plano_alimentar_item).
-- App não referencia estas tabelas.
-- ============================================================

-- diario_rotina pode apontar para refeicoes legado — CASCADE no DROP
-- remove só a FK, mantém a tabela diario_rotina.

-- 1) Filha
drop table if exists public.plano_alimentar_itens cascade;

-- 2) Refeições legado (vários nomes de FK no Supabase real)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'diario_rotina'
  ) then
    alter table public.diario_rotina
      drop constraint if exists diario_rotina_id_refeicao_planejada_uuid_fkey;
  end if;
end;
$$;

drop table if exists public.plano_alimentar_refeicoes cascade;

-- 3) Cabeçalho legado (órfão após drop acima)
drop table if exists public.plano_alimentar_mestre cascade;
