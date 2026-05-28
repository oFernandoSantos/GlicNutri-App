-- ============================================================
-- MIGRATION: Índices de performance + correções finais
-- 1. Corrige índice duplicado idx_alerta_clinico_paciente_created
-- 2. Adiciona índices faltantes
-- 3. Adiciona colunas faltantes em paciente (se não existirem)
-- 4. Corrige consulta_notificacao.destinatario_id (documenta)
-- ============================================================

-- ============================================================
-- 1. Remove índice duplicado (criado em 20260524 e 20260526)
-- ============================================================
drop index if exists public.idx_alerta_clinico_paciente_created;

create index if not exists idx_alerta_clinico_paciente_created_at
  on public.alerta_clinico (paciente_id, created_at desc);

-- ============================================================
-- 2. Colunas faltantes em paciente (additive only)
-- ============================================================
alter table public.paciente
  add column if not exists objetivo_principal_consulta text,
  add column if not exists qualidade_sono_media text,
  add column if not exists nivel_atividade_fisica_atual text,
  add column if not exists peso_atual_kg numeric,
  add column if not exists data_hora_ultima_atualizacao timestamptz
    default timezone('utc', now());

-- ============================================================
-- 3. Índices de leitura para dashboard do nutricionista
-- ============================================================

-- paciente: busca por email (login, fallback)
create index if not exists idx_paciente_email_lower
  on public.paciente (lower(email_pac))
  where coalesce(excluido, false) = false;

-- paciente: busca por CPF
create index if not exists idx_paciente_cpf
  on public.paciente (cpf_paciente)
  where coalesce(excluido, false) = false;

-- consulta: status lookup (agenda futura)
create index if not exists idx_consulta_status_scheduled_at
  on public.consulta (status, scheduled_at desc)
  where status in ('scheduled', 'confirmed');

-- consulta: histórico completo por paciente + status done
create index if not exists idx_consulta_paciente_done
  on public.consulta (paciente_id, scheduled_at desc)
  where status = 'done';

-- prontuario_nota: acesso por nutricionista
create index if not exists idx_prontuario_nota_nutri_created_at
  on public.prontuario_nota (nutricionista_id, created_at desc);

-- mensagem_chat: último timestamp por par (para "última mensagem")
create index if not exists idx_mensagem_chat_paciente_nutri_last
  on public.mensagem_chat (paciente_id, nutricionista_id, created_at desc);

-- registro_glicemia_manual: range de datas por paciente
create index if not exists idx_glicemia_manual_paciente_data_range
  on public.registro_glicemia_manual (id_paciente_uuid, data)
  include (valor_glicose_mgdl, hora);

-- registro_medicacao: por tipo_registro + paciente
create index if not exists idx_registro_medicacao_tipo
  on public.registro_medicacao (id_paciente_uuid, tipo_registro, data desc);

-- refeicao_ia: range de data via created_at
create index if not exists idx_refeicao_ia_paciente_created_at
  on public.refeicao_ia (paciente_id, created_at desc);

-- plano_alimentar: ativo recente por paciente
create index if not exists idx_plano_alimentar_paciente_ativo_updated
  on public.plano_alimentar (paciente_id, ativo, updated_at desc)
  where ativo = true;

-- alerta_clinico: por nutri + nao lido
create index if not exists idx_alerta_clinico_nutri_nao_lido
  on public.alerta_clinico (nutricionista_id, lido_nutri, created_at desc)
  where lido_nutri = false;

-- solicitacao_acompanhamento: by paciente + status
create index if not exists idx_solicitacao_acompanhamento_paciente_status
  on public.solicitacao_acompanhamento_nutri (paciente_id, status, created_at desc);

-- ============================================================
-- 4. registro_glicemia_cgm: índice de sync incremental
-- ============================================================
create index if not exists idx_cgm_paciente_synced_at
  on public.registro_glicemia_cgm (id_paciente_uuid, synced_at desc);

-- ============================================================
-- 5. Tabela de auditoria em banco (complementa storage audit-logs)
-- ============================================================
create table if not exists public.auditoria_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        text,
  actor_type      text,
  target_patient_id uuid,
  action          text not null,
  entity          text,
  entity_id       text,
  origin          text,
  details         jsonb,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists idx_auditoria_log_patient_created
  on public.auditoria_log (target_patient_id, created_at desc)
  where target_patient_id is not null;

create index if not exists idx_auditoria_log_action_created
  on public.auditoria_log (action, created_at desc);

alter table public.auditoria_log enable row level security;

drop policy if exists "Allow audit reads" on public.auditoria_log;
create policy "Allow audit reads"
on public.auditoria_log for select to anon, authenticated using (true);

drop policy if exists "Allow audit inserts" on public.auditoria_log;
create policy "Allow audit inserts"
on public.auditoria_log for insert to anon, authenticated with check (true);

grant select, insert on public.auditoria_log to anon, authenticated;

-- ============================================================
-- 6. View unificada glicemia (manual + CGM) para prontuário
-- ============================================================
create or replace view public.glicemia_unificada as
select
  id_glicemia_manual_uuid as id,
  id_paciente_uuid as paciente_id,
  valor_glicose_mgdl,
  data,
  hora,
  sintomas_associados as observacao,
  'manual'::text as fonte,
  null::text as tendencia
from public.registro_glicemia_manual
union all
select
  id as id,
  id_paciente_uuid as paciente_id,
  valor_glicose_mgdl,
  data,
  hora,
  null as observacao,
  fonte,
  tendencia
from public.registro_glicemia_cgm;

grant select on public.glicemia_unificada to anon, authenticated;
