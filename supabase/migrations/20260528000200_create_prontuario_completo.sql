-- ============================================================
-- MIGRATION: Prontuário completo
-- Cria: prontuario, prontuario_evolucao, prontuario_antropometria,
--       prontuario_meta_clinica
-- ADDITIVE: prontuario_nota existente permanece intacto.
-- ============================================================

-- ============================================================
-- 1. prontuario (1:1 com paciente — dados estáticos e base)
-- ============================================================
create table if not exists public.prontuario (
  id                        uuid primary key default gen_random_uuid(),
  paciente_id               uuid not null unique
    references public.paciente(id_paciente_uuid) on delete cascade,
  -- anamnese
  queixa_principal          text,
  historico_doenca_atual    text,
  historico_familiar        text,
  comorbidades              text[],   -- ex: ['DM2', 'HAS', 'Dislipidemia']
  alergias                  text[],
  -- diagnósticos (CID-10 livre)
  diagnosticos_cid          text[],   -- ex: ['E11', 'I10']
  diagnosticos_descricao    text,
  -- tipo diabetes
  tipo_diabetes             text
    check (tipo_diabetes in ('DM1', 'DM2', 'DMGE', 'LADA', 'MODY', 'outro', null)),
  ano_diagnostico_diabetes  integer,
  -- uso insulina
  usa_insulina              boolean default false,
  esquema_insulina          text,     -- ex: 'basal-bolus', 'basal', 'bomba'
  -- outros campos clínicos
  atividade_fisica          text,
  tabagismo                 boolean default false,
  etilismo                  boolean default false,
  observacoes_gerais        text,
  -- auditoria
  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now())
);

create index if not exists idx_prontuario_paciente
  on public.prontuario (paciente_id);

-- ============================================================
-- 2. prontuario_evolucao (1:N consulta — evolução por atendimento)
-- ============================================================
create table if not exists public.prontuario_evolucao (
  id                    uuid primary key default gen_random_uuid(),
  paciente_id           uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  -- profissional responsável pela evolução
  nutricionista_id      uuid
    references public.nutricionista(id_nutricionista_uuid) on delete set null,
  medico_id             uuid
    references public.medico(id_medico_uuid) on delete set null,
  -- consulta associada (optional)
  consulta_id           uuid
    references public.consulta(id) on delete set null,
  -- conteúdo da evolução
  subjetivo             text,   -- O que o paciente relata (S)
  objetivo              text,   -- Dados objetivos: exames, medidas (O)
  avaliacao             text,   -- Avaliação clínica (A)
  plano                 text,   -- Plano terapêutico (P)
  -- evolução nutricional
  adesao_plano_alimentar text
    check (adesao_plano_alimentar in ('otima', 'boa', 'regular', 'ruim', null)),
  dificuldades_relatadas text,
  ajustes_plano         text,
  -- orientações
  orientacoes_gerais    text,
  retorno_em            date,   -- data prevista próxima consulta
  created_at            timestamptz not null default timezone('utc', now())
);

create index if not exists idx_prontuario_evolucao_paciente_created
  on public.prontuario_evolucao (paciente_id, created_at desc);

create index if not exists idx_prontuario_evolucao_consulta
  on public.prontuario_evolucao (consulta_id)
  where consulta_id is not null;

-- ============================================================
-- 3. prontuario_antropometria (série temporal: peso, altura, IMC)
-- ============================================================
create table if not exists public.prontuario_antropometria (
  id                uuid primary key default gen_random_uuid(),
  paciente_id       uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  -- profissional que aferiu
  nutricionista_id  uuid
    references public.nutricionista(id_nutricionista_uuid) on delete set null,
  medico_id         uuid
    references public.medico(id_medico_uuid) on delete set null,
  data_afericao     date not null default current_date,
  peso_kg           numeric,
  altura_cm         numeric,
  imc               numeric generated always as (
    case when altura_cm > 0 and peso_kg > 0
      then round((peso_kg / ((altura_cm / 100.0) ^ 2))::numeric, 2)
      else null
    end
  ) stored,
  circunferencia_abdominal_cm numeric,
  circunferencia_quadril_cm   numeric,
  percentual_gordura          numeric,
  pressao_sistolica           integer,
  pressao_diastolica          integer,
  observacao                  text,
  created_at        timestamptz not null default timezone('utc', now())
);

create index if not exists idx_prontuario_antropometria_paciente_data
  on public.prontuario_antropometria (paciente_id, data_afericao desc);

-- ============================================================
-- 4. prontuario_meta_clinica (metas HbA1c, glicemia, etc.)
-- ============================================================
create table if not exists public.prontuario_meta_clinica (
  id                    uuid primary key default gen_random_uuid(),
  paciente_id           uuid not null
    references public.paciente(id_paciente_uuid) on delete cascade,
  nutricionista_id      uuid
    references public.nutricionista(id_nutricionista_uuid) on delete set null,
  medico_id             uuid
    references public.medico(id_medico_uuid) on delete set null,
  -- metas glicêmicas
  meta_hba1c_pct        numeric,    -- ex: 7.0
  meta_glicemia_jejum_mgdl  integer,   -- ex: 100
  meta_glicemia_pos_prandial_mgdl integer,  -- ex: 140
  -- metas nutricionais
  meta_calorias_dia     integer,
  meta_carboidratos_g   integer,
  meta_proteinas_g      integer,
  meta_gorduras_g       integer,
  meta_fibras_g         integer,
  meta_agua_litros      numeric,
  -- metas antropométricas
  meta_peso_kg          numeric,
  meta_imc              numeric,
  -- validade
  vigente               boolean not null default true,
  vigente_desde         date not null default current_date,
  vigente_ate           date,
  observacao            text,
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);

create index if not exists idx_prontuario_meta_clinica_paciente_vigente
  on public.prontuario_meta_clinica (paciente_id, vigente, vigente_desde desc);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_prontuario_updated_at on public.prontuario;
create trigger trg_touch_prontuario_updated_at
before update on public.prontuario
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_prontuario_meta_clinica_updated_at on public.prontuario_meta_clinica;
create trigger trg_touch_prontuario_meta_clinica_updated_at
before update on public.prontuario_meta_clinica
for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS permissiva (mantém padrão atual do projeto)
-- ============================================================
alter table public.prontuario enable row level security;
alter table public.prontuario_evolucao enable row level security;
alter table public.prontuario_antropometria enable row level security;
alter table public.prontuario_meta_clinica enable row level security;

drop policy if exists "Allow prontuario reads" on public.prontuario;
create policy "Allow prontuario reads"
on public.prontuario for select to anon, authenticated using (true);

drop policy if exists "Allow prontuario writes" on public.prontuario;
create policy "Allow prontuario writes"
on public.prontuario for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow prontuario_evolucao reads" on public.prontuario_evolucao;
create policy "Allow prontuario_evolucao reads"
on public.prontuario_evolucao for select to anon, authenticated using (true);

drop policy if exists "Allow prontuario_evolucao writes" on public.prontuario_evolucao;
create policy "Allow prontuario_evolucao writes"
on public.prontuario_evolucao for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow prontuario_antropometria reads" on public.prontuario_antropometria;
create policy "Allow prontuario_antropometria reads"
on public.prontuario_antropometria for select to anon, authenticated using (true);

drop policy if exists "Allow prontuario_antropometria writes" on public.prontuario_antropometria;
create policy "Allow prontuario_antropometria writes"
on public.prontuario_antropometria for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow prontuario_meta_clinica reads" on public.prontuario_meta_clinica;
create policy "Allow prontuario_meta_clinica reads"
on public.prontuario_meta_clinica for select to anon, authenticated using (true);

drop policy if exists "Allow prontuario_meta_clinica writes" on public.prontuario_meta_clinica;
create policy "Allow prontuario_meta_clinica writes"
on public.prontuario_meta_clinica for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.prontuario to anon, authenticated;
grant select, insert, update, delete on public.prontuario_evolucao to anon, authenticated;
grant select, insert, update, delete on public.prontuario_antropometria to anon, authenticated;
grant select, insert, update, delete on public.prontuario_meta_clinica to anon, authenticated;

-- ============================================================
-- Seed: cria prontuario vazio para cada paciente existente
-- (apenas se ainda não existir, safe)
-- ============================================================
insert into public.prontuario (paciente_id)
select p.id_paciente_uuid
from public.paciente p
where coalesce(p.excluido, false) = false
  and not exists (
    select 1 from public.prontuario pr
    where pr.paciente_id = p.id_paciente_uuid
  )
on conflict do nothing;

-- ============================================================
-- Seed: migra prontuario_nota existente → prontuario_evolucao
-- Preserva conteúdo textual, associa consulta_id quando disponível.
-- ============================================================
insert into public.prontuario_evolucao (
  paciente_id,
  nutricionista_id,
  consulta_id,
  subjetivo,
  avaliacao,
  plano,
  created_at
)
select
  pn.paciente_id,
  pn.nutricionista_id,
  pn.consulta_id,
  null,
  pn.texto,
  null,
  pn.created_at
from public.prontuario_nota pn
where not exists (
  select 1
  from public.prontuario_evolucao pe
  where pe.paciente_id = pn.paciente_id
    and pe.created_at = pn.created_at
    and pe.nutricionista_id = pn.nutricionista_id
);

-- ============================================================
-- Seed: migra peso_atual_kg de paciente → prontuario_antropometria
-- Se coluna existir e valor não for nulo.
-- ============================================================
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'paciente'
      and column_name = 'peso_atual_kg'
  ) then
    insert into public.prontuario_antropometria (
      paciente_id,
      data_afericao,
      peso_kg
    )
    select
      p.id_paciente_uuid,
      coalesce(p.data_hora_ultima_atualizacao::date, current_date),
      (p.peso_atual_kg::text)::numeric
    from public.paciente p
    where coalesce(p.excluido, false) = false
      and p.peso_atual_kg is not null
      and not exists (
        select 1
        from public.prontuario_antropometria pa
        where pa.paciente_id = p.id_paciente_uuid
      );
  end if;
end;
$$;

-- ============================================================
-- RPCs
-- ============================================================
create or replace function public.obter_prontuario_paciente(p_paciente_id uuid)
returns setof public.prontuario
language sql
stable
security definer
set search_path = public
as $$
  select * from public.prontuario where paciente_id = p_paciente_id limit 1;
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
  p_observacoes_gerais       text default null
)
returns setof public.prontuario
language plpgsql
security definer
set search_path = public
as $$
begin
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

grant execute on function public.obter_prontuario_paciente(uuid) to anon, authenticated;
grant execute on function public.upsert_prontuario_paciente(uuid, text, text, text, text[], text[], text[], text, integer, boolean, text, text)
  to anon, authenticated;
