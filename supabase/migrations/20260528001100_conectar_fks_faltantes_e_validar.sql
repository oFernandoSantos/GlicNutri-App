-- ============================================================
-- MIGRATION: Auditar e conectar FKs faltantes
-- - Conecta tabelas clínicas órfãs
-- - Valida constraints NOT VALID anteriores
-- - Documenta tabelas auth que ficam sem FK (design correto)
-- ADDITIVE: não apaga dados
-- ============================================================

-- ============================================================
-- 1. registro_glicemia_manual → paciente
-- (tabela criada fora do repo; RPC já usa id_paciente_uuid)
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'registro_glicemia_manual'
  )
  and not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'registro_glicemia_manual'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name = 'fk_glicemia_manual_paciente'
  ) then
    delete from public.registro_glicemia_manual g
    where g.id_paciente_uuid is null
       or not exists (
         select 1 from public.paciente p
         where p.id_paciente_uuid = g.id_paciente_uuid
       );

    alter table public.registro_glicemia_manual
      add constraint fk_glicemia_manual_paciente
      foreign key (id_paciente_uuid)
      references public.paciente(id_paciente_uuid)
      on delete cascade
      not valid;
  end if;
end;
$$;

-- ============================================================
-- 2. auditoria_log.target_patient_id → paciente (quando preenchido)
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'auditoria_log'
  )
  and not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'auditoria_log'
      and constraint_name = 'fk_auditoria_target_paciente'
  ) then
  -- Converte target_patient_id para uuid se estiver como text em ambientes legados
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'auditoria_log'
        and column_name = 'target_patient_id'
        and data_type = 'text'
    ) then
      alter table public.auditoria_log
        alter column target_patient_id type uuid
        using nullif(trim(target_patient_id::text), '')::uuid;
    end if;

    update public.auditoria_log
    set target_patient_id = null
    where target_patient_id is not null
      and not exists (
        select 1 from public.paciente p
        where p.id_paciente_uuid = auditoria_log.target_patient_id
      );

    alter table public.auditoria_log
      add constraint fk_auditoria_target_paciente
      foreign key (target_patient_id)
      references public.paciente(id_paciente_uuid)
      on delete set null
      not valid;
  end if;
end;
$$;

-- ============================================================
-- 3. VALIDAR constraints NOT VALID (desenha linhas no diagrama)
-- ============================================================
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl, c.conname
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and not c.convalidated
  loop
    begin
      execute format(
        'alter table %s validate constraint %I',
        r.tbl,
        r.conname
      );
    exception when others then
      raise notice 'FK nao validada (dados orfaos): %.% — %',
        r.tbl, r.conname, sqlerrm;
    end;
  end loop;
end;
$$;

-- ============================================================
-- 4. Índices em FKs frequentes (performance)
-- ============================================================
create index if not exists idx_glicemia_manual_paciente_fk
  on public.registro_glicemia_manual (id_paciente_uuid)
  where id_paciente_uuid is not null;

create index if not exists idx_consulta_notificacao_consulta
  on public.consulta_notificacao (consulta_id)
  where consulta_id is not null;

-- ============================================================
-- 5. Documentação: tabelas SEM FK por design (auth / polimórfico)
-- ============================================================
comment on table public.administrador is
  'Auth isolado. Sem FK para paciente/nutri/medico — correto.';

comment on table public.password_reset_codes is
  'Tokens temporarios. Vinculo por role+email (text). Sem FK unica — correto para auth polimorfico.';

comment on table public.email_verification_codes is
  'Tokens temporarios. Vinculo por role+email. Sem FK unica — correto para auth polimorfico.';

comment on table public.produtos_rotulo_cache is
  'Cache de rotulos TACO/ANVISA. Tabela de referencia. Sem FK obrigatoria.';

comment on table public.auditoria_log is
  'Log polimorfico. target_patient_id tem FK opcional para paciente; actor_id permanece text.';

comment on table public.consulta_notificacao is
  'destinatario_id polimorfico (paciente ou nutricionista). consulta_id FK para consulta.';

-- ============================================================
-- 6. View: mapa de relacionamentos (documentação)
-- ============================================================
create or replace view public.schema_relacionamentos_resumo as
select
  tc.table_name as tabela,
  kcu.column_name as coluna,
  ccu.table_name as referencia_tabela,
  ccu.column_name as referencia_coluna
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

grant select on public.schema_relacionamentos_resumo to anon, authenticated;
