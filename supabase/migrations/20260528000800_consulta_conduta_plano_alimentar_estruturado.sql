-- ============================================================
-- MIGRATION: Conduta consulta + Plano alimentar estruturado
-- 1. consulta: adiciona conduta, proximos_passos, duracao_minutos
-- 2. plano_alimentar_refeicao: refeições do plano com macros
-- 3. plano_alimentar_item: alimentos por refeição com quantidades/macros
-- ADDITIVE: não altera estrutura existente
-- ============================================================

-- ============================================================
-- 1. consulta: campos pós-consulta
-- ============================================================
alter table public.consulta
  add column if not exists conduta              text,
  add column if not exists proximos_passos      text,
  add column if not exists duracao_minutos      integer,
  add column if not exists realizada_em         timestamptz;

-- Índice para buscar consultas realizadas recentemente
create index if not exists idx_consulta_realizada_em
  on public.consulta (paciente_id, realizada_em desc)
  where realizada_em is not null;

-- ============================================================
-- 2. plano_alimentar_refeicao
-- Cada linha = uma refeição dentro de um plano
-- ============================================================
create table if not exists public.plano_alimentar_refeicao (
  id                uuid primary key default gen_random_uuid(),
  plano_id          uuid not null
    references public.plano_alimentar(id) on delete cascade,
  paciente_id       uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  nutricionista_id  uuid
    references public.nutricionista(id_nutricionista_uuid) on delete set null,
  nome              text not null default 'Refeição',
  horario           time,
  tipo              text default 'principal'
    check (tipo in ('cafe_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia', 'principal', 'outro')),
  objetivo          text,
  observacoes       text,
  -- macros totais calculados/informados
  calorias_total    numeric,
  carboidratos_g    numeric,
  proteinas_g       numeric,
  gorduras_g        numeric,
  fibras_g          numeric,
  ordem             integer not null default 0,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create index if not exists idx_plano_refeicao_plano_ordem
  on public.plano_alimentar_refeicao (plano_id, ordem);

-- ============================================================
-- 3. plano_alimentar_item
-- Cada linha = um alimento dentro de uma refeição
-- ============================================================
create table if not exists public.plano_alimentar_item (
  id                uuid primary key default gen_random_uuid(),
  refeicao_id       uuid not null
    references public.plano_alimentar_refeicao(id) on delete cascade,
  plano_id          uuid not null
    references public.plano_alimentar(id) on delete cascade,
  paciente_id       uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  -- alimento
  nome_alimento     text not null,
  quantidade        numeric,
  unidade_medida    text default 'g',
  -- macros por porção
  calorias          numeric,
  carboidratos_g    numeric,
  proteinas_g       numeric,
  gorduras_g        numeric,
  fibras_g          numeric,
  -- substituições permitidas (array de nomes)
  substituicoes     text[],
  -- restrição se aplicável
  observacao        text,
  ordem             integer not null default 0,
  created_at        timestamptz not null default timezone('utc', now())
);

create index if not exists idx_plano_item_refeicao_ordem
  on public.plano_alimentar_item (refeicao_id, ordem);

create index if not exists idx_plano_item_plano
  on public.plano_alimentar_item (plano_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
drop trigger if exists trg_touch_plano_refeicao_updated_at on public.plano_alimentar_refeicao;
create trigger trg_touch_plano_refeicao_updated_at
before update on public.plano_alimentar_refeicao
for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS permissiva
-- ============================================================
alter table public.plano_alimentar_refeicao enable row level security;
alter table public.plano_alimentar_item enable row level security;

drop policy if exists "Allow plano_refeicao reads" on public.plano_alimentar_refeicao;
create policy "Allow plano_refeicao reads"
on public.plano_alimentar_refeicao for select to anon, authenticated using (true);

drop policy if exists "Allow plano_refeicao writes" on public.plano_alimentar_refeicao;
create policy "Allow plano_refeicao writes"
on public.plano_alimentar_refeicao for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow plano_item reads" on public.plano_alimentar_item;
create policy "Allow plano_item reads"
on public.plano_alimentar_item for select to anon, authenticated using (true);

drop policy if exists "Allow plano_item writes" on public.plano_alimentar_item;
create policy "Allow plano_item writes"
on public.plano_alimentar_item for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.plano_alimentar_refeicao to anon, authenticated;
grant select, insert, update, delete on public.plano_alimentar_item to anon, authenticated;

-- ============================================================
-- RPCs de plano estruturado
-- ============================================================

-- Busca plano completo com refeições e itens
create or replace function public.buscar_plano_alimentar_completo(p_plano_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select row_to_json(p)
  from (
    select
      pl.*,
      coalesce(
        (
          select json_agg(r order by r.ordem)
          from (
            select
              ref.*,
              coalesce(
                (
                  select json_agg(it order by it.ordem)
                  from (
                    select * from public.plano_alimentar_item
                    where refeicao_id = ref.id
                    order by ordem
                  ) it
                ),
                '[]'::json
              ) as itens
            from public.plano_alimentar_refeicao ref
            where ref.plano_id = p_plano_id
            order by ref.ordem
          ) r
        ),
        '[]'::json
      ) as refeicoes
    from public.plano_alimentar pl
    where pl.id = p_plano_id
  ) p;
$$;

-- Busca histórico de planos do paciente
create or replace function public.listar_planos_paciente(
  p_paciente_id uuid,
  p_limite integer default 10
)
returns setof public.plano_alimentar
language sql
stable
security definer
set search_path = public
as $$
  select * from public.plano_alimentar
  where paciente_id = p_paciente_id
  order by updated_at desc
  limit greatest(1, coalesce(p_limite, 10));
$$;

-- Finalizar consulta com conduta (atomic)
create or replace function public.finalizar_consulta_nutri(
  p_consulta_id     uuid,
  p_conduta         text default null,
  p_proximos_passos text default null,
  p_duracao_minutos integer default null,
  p_nutricionista_id uuid default null,
  p_paciente_id     uuid default null,
  p_nota_evolucao   text default null
)
returns setof public.consulta
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Atualiza consulta
  update public.consulta
  set
    status            = 'done',
    conduta           = coalesce(nullif(trim(p_conduta), ''), conduta),
    proximos_passos   = coalesce(nullif(trim(p_proximos_passos), ''), proximos_passos),
    duracao_minutos   = coalesce(p_duracao_minutos, duracao_minutos),
    realizada_em      = coalesce(realizada_em, timezone('utc', now())),
    updated_at        = timezone('utc', now())
  where id = p_consulta_id;

  -- Se tiver nota, cria evolução no prontuário
  if p_nota_evolucao is not null
     and trim(p_nota_evolucao) <> ''
     and p_paciente_id is not null
     and p_nutricionista_id is not null
  then
    insert into public.prontuario_nota (
      nutricionista_id,
      paciente_id,
      consulta_id,
      texto
    )
    values (
      p_nutricionista_id,
      p_paciente_id,
      p_consulta_id,
      trim(p_nota_evolucao)
    )
    on conflict do nothing;

    -- Também insere em prontuario_evolucao
    insert into public.prontuario_evolucao (
      paciente_id,
      nutricionista_id,
      consulta_id,
      avaliacao,
      plano
    )
    values (
      p_paciente_id,
      p_nutricionista_id,
      p_consulta_id,
      trim(p_nota_evolucao),
      nullif(trim(coalesce(p_proximos_passos, '')), '')
    );
  end if;

  return query
  select * from public.consulta where id = p_consulta_id;
end;
$$;

grant execute on function public.buscar_plano_alimentar_completo(uuid) to anon, authenticated;
grant execute on function public.listar_planos_paciente(uuid, integer) to anon, authenticated;
grant execute on function public.finalizar_consulta_nutri(uuid, text, text, integer, uuid, uuid, text)
  to anon, authenticated;
