-- ============================================================
-- MIGRATION: Integrar médico ao fluxo clínico
-- 1. Adiciona medico_id nullable em consulta
-- 2. Adiciona medico_id nullable em prontuario_nota
-- 3. Cria RPC de login médico (já existia, mantém compatibilidade)
-- 4. Cria view medico_consulta_resumo para dashboard médico
-- ============================================================

-- ============================================================
-- 1. consulta: adiciona medico_id (nullable, sem quebrar frontend)
-- ============================================================
alter table public.consulta
  add column if not exists medico_id uuid
    references public.medico(id_medico_uuid) on delete set null;

create index if not exists idx_consulta_medico_scheduled_at
  on public.consulta (medico_id, scheduled_at desc)
  where medico_id is not null;

-- ============================================================
-- 2. prontuario_nota: adiciona medico_id (nullable)
-- ============================================================
alter table public.prontuario_nota
  add column if not exists medico_id uuid
    references public.medico(id_medico_uuid) on delete set null;

-- ============================================================
-- 3. Adiciona updated_at em prontuario_nota (faltava)
-- ============================================================
alter table public.prontuario_nota
  add column if not exists updated_at timestamptz
    not null default timezone('utc', now());

drop trigger if exists trg_touch_prontuario_nota_updated_at on public.prontuario_nota;
create trigger trg_touch_prontuario_nota_updated_at
before update on public.prontuario_nota
for each row execute function public.touch_updated_at();

-- ============================================================
-- 4. RPCs médico
-- ============================================================

-- Consultas do médico
create or replace function public.listar_consultas_medico(
  p_medico_id uuid,
  p_limit     integer default 120
)
returns setof public.consulta
language sql
stable
security definer
set search_path = public
as $$
  select * from public.consulta
  where medico_id = p_medico_id
  order by scheduled_at desc
  limit greatest(1, coalesce(p_limit, 120));
$$;

-- Pacientes do médico (via vínculo)
create or replace function public.listar_pacientes_medico(
  p_medico_id uuid,
  p_limit     integer default 200
)
returns table (
  id_paciente_uuid  uuid,
  nome_completo     text,
  email_pac         text,
  data_nascimento   date,
  vinculo_id        uuid,
  vinculado_em      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id_paciente_uuid,
    p.nome_completo,
    p.email_pac,
    p.data_nascimento,
    v.id as vinculo_id,
    v.created_at as vinculado_em
  from public.paciente_profissional_vinculo v
  inner join public.paciente p on p.id_paciente_uuid = v.paciente_id
  where v.medico_id = p_medico_id
    and v.ativo = true
    and coalesce(p.excluido, false) = false
  order by p.nome_completo
  limit greatest(1, coalesce(p_limit, 200));
$$;

-- Registrar nota no prontuário (aceita medico_id OU nutricionista_id)
create or replace function public.registrar_evolucao_prontuario(
  p_paciente_id       uuid,
  p_nutricionista_id  uuid default null,
  p_medico_id         uuid default null,
  p_consulta_id       uuid default null,
  p_subjetivo         text default null,
  p_avaliacao         text default null,
  p_plano             text default null,
  p_orientacoes       text default null
)
returns setof public.prontuario_evolucao
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_nutricionista_id is null and p_medico_id is null then
    raise exception 'Informe nutricionista_id ou medico_id para registrar evolucao.';
  end if;

  if p_paciente_id is null then
    raise exception 'Paciente sem identificador para registrar evolucao.';
  end if;

  return query
  insert into public.prontuario_evolucao (
    paciente_id,
    nutricionista_id,
    medico_id,
    consulta_id,
    subjetivo,
    avaliacao,
    plano,
    orientacoes_gerais
  )
  values (
    p_paciente_id,
    p_nutricionista_id,
    p_medico_id,
    p_consulta_id,
    nullif(trim(coalesce(p_subjetivo, '')), ''),
    nullif(trim(coalesce(p_avaliacao, '')), ''),
    nullif(trim(coalesce(p_plano, '')), ''),
    nullif(trim(coalesce(p_orientacoes, '')), '')
  )
  returning *;
end;
$$;

grant execute on function public.listar_consultas_medico(uuid, integer) to anon, authenticated;
grant execute on function public.listar_pacientes_medico(uuid, integer) to anon, authenticated;
grant execute on function public.registrar_evolucao_prontuario(uuid, uuid, uuid, uuid, text, text, text, text)
  to anon, authenticated;

-- ============================================================
-- 5. View: resumo do médico para dashboard
-- ============================================================
create or replace view public.medico_dashboard_resumo as
select
  m.id_medico_uuid,
  m.nome_completo_medico,
  m.especialidade_medico,
  count(distinct v.paciente_id) filter (where v.ativo = true) as total_pacientes_ativos,
  count(distinct c.id) filter (
    where c.status in ('scheduled', 'confirmed')
    and c.scheduled_at >= now()
  ) as consultas_futuras,
  count(distinct c.id) filter (
    where c.status = 'done'
    and c.scheduled_at >= date_trunc('month', now())
  ) as consultas_realizadas_mes
from public.medico m
left join public.paciente_profissional_vinculo v on v.medico_id = m.id_medico_uuid
left join public.consulta c on c.medico_id = m.id_medico_uuid
where m.ativo = true
group by m.id_medico_uuid, m.nome_completo_medico, m.especialidade_medico;

grant select on public.medico_dashboard_resumo to anon, authenticated;
