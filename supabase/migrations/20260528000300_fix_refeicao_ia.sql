-- ============================================================
-- MIGRATION: Correção de refeicao_ia
-- 1. Adiciona FK para paciente (NOT VALID — não bloqueia rows existentes)
-- 2. Converte created_at de timestamp → timestamptz
-- 3. Adiciona updated_at faltante
-- ============================================================

-- ============================================================
-- 1. FK paciente_id → paciente (NOT VALID: seguro para dados existentes)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_refeicao_ia_paciente'
      and conrelid = 'public.refeicao_ia'::regclass
  ) then
    -- Limpa registros órfãos antes de adicionar FK
    delete from public.refeicao_ia
    where paciente_id is null
       or not exists (
         select 1 from public.paciente p
         where p.id_paciente_uuid = refeicao_ia.paciente_id
       );

    alter table public.refeicao_ia
      add constraint fk_refeicao_ia_paciente
      foreign key (paciente_id)
      references public.paciente(id_paciente_uuid)
      on delete cascade
      not valid;

    -- valida a constraint (silencioso se tabela vazia ou tudo válido)
    alter table public.refeicao_ia
      validate constraint fk_refeicao_ia_paciente;
  end if;
end;
$$;

-- ============================================================
-- 2. Converte created_at: timestamp → timestamptz (interpreta como UTC)
-- ============================================================
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'refeicao_ia'
      and column_name = 'created_at'
      and data_type = 'timestamp without time zone'
  ) then
    alter table public.refeicao_ia
      alter column created_at type timestamptz
      using created_at at time zone 'UTC';
  end if;
end;
$$;

-- ============================================================
-- 3. Adiciona updated_at se não existir
-- ============================================================
alter table public.refeicao_ia
  add column if not exists updated_at timestamptz not null
    default timezone('utc', now());

-- Preenche updated_at com created_at para rows existentes
update public.refeicao_ia
set updated_at = created_at
where updated_at = timezone('utc', now())
  and created_at < timezone('utc', now()) - interval '1 minute';

-- Trigger updated_at
drop trigger if exists trg_touch_refeicao_ia_updated_at on public.refeicao_ia;
create trigger trg_touch_refeicao_ia_updated_at
before update on public.refeicao_ia
for each row execute function public.touch_updated_at();

-- ============================================================
-- 4. Índice em updated_at (útil para sync incremental)
-- ============================================================
create index if not exists idx_refeicao_ia_paciente_updated_at
  on public.refeicao_ia (paciente_id, updated_at desc);
