-- ============================================================
-- MIGRATION: Conecta tabelas plano_alimentar_refeicoes e
-- plano_alimentar_itens que existiam sem foreign keys
--
-- Contexto: estas tabelas foram criadas manualmente no Supabase
-- (não rastreadas por migrations anteriores). Não são usadas
-- pelo frontend atual — a implementação atual usa plano_alimentar.metas
-- (JSONB) e as novas tabelas plano_alimentar_refeicao / plano_alimentar_item
-- criadas em 000800.
--
-- Esta migration:
-- 1. Garante que as tabelas existam (create if not exists)
-- 2. Adiciona coluna plano_alimentar_id em plano_alimentar_refeicoes
-- 3. Adiciona FK plano_alimentar_refeicoes → plano_alimentar
-- 4. Adiciona FK plano_alimentar_itens → plano_alimentar_refeicoes
-- 5. Adiciona índices
-- ============================================================

-- ── 1. Garante existência das tabelas (caso não existam) ──────
create table if not exists public.plano_alimentar_refeicoes (
  id_refeicao_planejada_uuid  uuid primary key default gen_random_uuid(),
  nome_refeicao               text not null default 'Refeição',
  horario_sugerido            text,
  carboidratos_totais_g       numeric,
  proteinas_totais_g          numeric,
  gorduras_totais_g           numeric,
  calorias_totais             numeric,
  observacoes                 text,
  ordem                       integer default 0,
  created_at                  timestamptz not null default timezone('utc', now())
);

create table if not exists public.plano_alimentar_itens (
  id_item_uuid                uuid primary key default gen_random_uuid(),
  id_refeicao_planejada_uuid  uuid not null,
  grupo_opcao                 text,
  tipo_alimento               text,
  quantidade_gramas           numeric,
  nome_alimento               text not null default '',
  medida_caseira              text,
  calorias                    numeric,
  carboidratos_g              numeric,
  proteinas_g                 numeric,
  gorduras_g                  numeric,
  ordem                       integer default 0,
  created_at                  timestamptz not null default timezone('utc', now())
);

-- ── 2. Adiciona plano_alimentar_id em plano_alimentar_refeicoes ─
alter table public.plano_alimentar_refeicoes
  add column if not exists plano_alimentar_id uuid;

-- ── 3. FK plano_alimentar_refeicoes → plano_alimentar ─────────
-- NOT VALID = não valida linhas existentes (evita erro em dados órfãos)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_plan_refeicoes_plano'
      and table_name = 'plano_alimentar_refeicoes'
  ) then
    alter table public.plano_alimentar_refeicoes
      add constraint fk_plan_refeicoes_plano
      foreign key (plano_alimentar_id)
      references public.plano_alimentar(id)
      on delete set null
      not valid;
  end if;
end;
$$;

-- ── 4. FK plano_alimentar_itens → plano_alimentar_refeicoes ───
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_plan_itens_refeicao'
      and table_name = 'plano_alimentar_itens'
  ) then
    alter table public.plano_alimentar_itens
      add constraint fk_plan_itens_refeicao
      foreign key (id_refeicao_planejada_uuid)
      references public.plano_alimentar_refeicoes(id_refeicao_planejada_uuid)
      on delete cascade
      not valid;
  end if;
end;
$$;

-- ── 5. Índices ─────────────────────────────────────────────────
create index if not exists idx_plan_refeicoes_plano_id
  on public.plano_alimentar_refeicoes (plano_alimentar_id)
  where plano_alimentar_id is not null;

create index if not exists idx_plan_itens_refeicao_id
  on public.plano_alimentar_itens (id_refeicao_planejada_uuid);

-- ── 6. RLS permissivo (consistente com o restante do app) ─────
alter table public.plano_alimentar_refeicoes enable row level security;
alter table public.plano_alimentar_itens      enable row level security;

drop policy if exists "Allow plan_refeicoes_legacy reads"  on public.plano_alimentar_refeicoes;
drop policy if exists "Allow plan_refeicoes_legacy writes" on public.plano_alimentar_refeicoes;
drop policy if exists "Allow plan_itens_legacy reads"      on public.plano_alimentar_itens;
drop policy if exists "Allow plan_itens_legacy writes"     on public.plano_alimentar_itens;

create policy "Allow plan_refeicoes_legacy reads"
  on public.plano_alimentar_refeicoes for select to anon, authenticated using (true);
create policy "Allow plan_refeicoes_legacy writes"
  on public.plano_alimentar_refeicoes for all to anon, authenticated using (true) with check (true);
create policy "Allow plan_itens_legacy reads"
  on public.plano_alimentar_itens for select to anon, authenticated using (true);
create policy "Allow plan_itens_legacy writes"
  on public.plano_alimentar_itens for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.plano_alimentar_refeicoes to anon, authenticated;
grant select, insert, update, delete on public.plano_alimentar_itens      to anon, authenticated;
