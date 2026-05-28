-- ============================================================
-- FASE 2 RLS: registro_medicacao + refeicao_ia
-- - RLS ON, sem policy para anon/authenticated (deny direto)
-- - Acesso tabela só via RPC security definer
-- - Revoga grants diretos em tabelas
-- ADDITIVE: não apaga dados
-- ============================================================

-- ============================================================
-- 1. RPC refeicao_ia (não existia — app usava .from direto)
-- ============================================================
create or replace function public.registrar_refeicao_ia_paciente(
  p_paciente_id              uuid,
  p_foto_url                 text default null,
  p_alimentos                jsonb default '[]'::jsonb,
  p_carboidratos_total       numeric default null,
  p_calorias_total           numeric default null,
  p_proteinas_total          numeric default null,
  p_gorduras_total           numeric default null,
  p_fibras_total             numeric default null,
  p_acucares_total           numeric default null,
  p_gorduras_saturadas_total numeric default null,
  p_sodio_total              numeric default null,
  p_confirmado               boolean default false,
  p_created_at               timestamptz default null
)
returns setof public.refeicao_ia
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_paciente_id is null then
    raise exception 'Paciente sem identificador para registrar refeicao.';
  end if;

  if not exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = p_paciente_id
      and coalesce(p.excluido, false) = false
  ) then
    raise exception 'Paciente nao encontrado para registrar refeicao.';
  end if;

  return query
  insert into public.refeicao_ia (
    paciente_id,
    foto_url,
    alimentos,
    carboidratos_total,
    calorias_total,
    proteinas_total,
    gorduras_total,
    fibras_total,
    acucares_total,
    gorduras_saturadas_total,
    sodio_total,
    confirmado,
    created_at
  )
  values (
    p_paciente_id,
    nullif(trim(coalesce(p_foto_url, '')), ''),
    coalesce(p_alimentos, '[]'::jsonb),
    p_carboidratos_total,
    p_calorias_total,
    p_proteinas_total,
    p_gorduras_total,
    p_fibras_total,
    p_acucares_total,
    p_gorduras_saturadas_total,
    p_sodio_total,
    coalesce(p_confirmado, false),
    coalesce(p_created_at, timezone('utc', now()))
  )
  returning *;
end;
$$;

create or replace function public.listar_refeicoes_ia_paciente(
  p_paciente_id uuid,
  p_limite      integer default 120
)
returns setof public.refeicao_ia
language sql
security definer
set search_path = public
as $$
  select *
  from public.refeicao_ia
  where paciente_id = p_paciente_id
  order by created_at desc
  limit greatest(coalesce(p_limite, 120), 1);
$$;

grant execute on function public.registrar_refeicao_ia_paciente(
  uuid, text, jsonb, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, boolean, timestamptz
) to anon, authenticated;

grant execute on function public.listar_refeicoes_ia_paciente(uuid, integer)
  to anon, authenticated;

-- Garante RPC medicacao como security definer (idempotente)
create or replace function public.listar_medicacoes_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120
)
returns table (
  id_registro_medicacao_uuid uuid,
  id_paciente_uuid uuid,
  tipo_registro text,
  descricao text,
  nome_medicamento text,
  unidade_medida text,
  quantidade text,
  data date,
  hora time,
  dias_tratamento integer,
  uso_continuo boolean,
  observacao text,
  id_registro_legado text
)
language sql
security definer
set search_path = public
as $$
  select
    rm.id_registro_medicacao_uuid,
    rm.id_paciente_uuid,
    rm.tipo_registro,
    rm.descricao,
    rm.nome_medicamento,
    rm.unidade_medida,
    rm.quantidade,
    rm.data,
    rm.hora,
    rm.dias_tratamento,
    rm.uso_continuo,
    rm.observacao,
    rm.id_registro_legado
  from public.registro_medicacao rm
  where rm.id_paciente_uuid = p_id_paciente_uuid
  order by rm.data desc, rm.hora desc
  limit greatest(coalesce(p_limite, 120), 1);
$$;

-- ============================================================
-- 2. RLS ON — sem policies = deny para roles sem bypass
-- ============================================================
alter table public.registro_medicacao enable row level security;
alter table public.refeicao_ia enable row level security;

-- Remove policies permissivas antigas se existirem
drop policy if exists "Allow medication reads" on public.registro_medicacao;
drop policy if exists "Allow medication writes" on public.registro_medicacao;
drop policy if exists "mensagem_chat_all" on public.refeicao_ia;

-- ============================================================
-- 3. Revoga acesso direto à tabela (anon/authenticated)
--    Mantém EXECUTE nas RPCs acima
-- ============================================================
revoke all on table public.registro_medicacao from anon, authenticated;
revoke all on table public.refeicao_ia from anon, authenticated;

comment on table public.registro_medicacao is
  'RLS fase 2: acesso via RPC registrar/listar/excluir_medicacao_paciente (security definer).';

comment on table public.refeicao_ia is
  'RLS fase 2: acesso via RPC registrar/listar_refeicoes_ia_paciente (security definer).';
