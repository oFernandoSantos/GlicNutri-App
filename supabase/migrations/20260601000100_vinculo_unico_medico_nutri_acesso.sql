-- Um medico + um nutricionista por paciente; seed de acesso medico.
create extension if not exists pgcrypto;

create or replace function public.garantir_vinculo_medico_paciente(
  p_paciente_id   uuid,
  p_medico_id     uuid,
  p_origem        text default 'manual',
  p_consulta_id   uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_medico_atual uuid;
begin
  if p_paciente_id is null or p_medico_id is null then
    return false;
  end if;

  select p.id_medico_uuid
  into v_medico_atual
  from public.paciente p
  where p.id_paciente_uuid = p_paciente_id
    and coalesce(p.excluido, false) = false;

  if v_medico_atual is not null and v_medico_atual <> p_medico_id then
    raise exception 'Paciente ja possui medico vinculado. Desvincule o acompanhamento atual antes de solicitar outro.';
  end if;

  update public.paciente_profissional_vinculo
  set ativo = false, updated_at = timezone('utc', now())
  where paciente_id = p_paciente_id
    and medico_id is not null
    and medico_id <> p_medico_id
    and ativo = true;

  insert into public.paciente_profissional_vinculo (
    paciente_id,
    medico_id,
    tipo_profissional,
    origem,
    consulta_id,
    ativo
  )
  values (
    p_paciente_id,
    p_medico_id,
    'medico',
    coalesce(nullif(trim(p_origem), ''), 'manual'),
    p_consulta_id,
    true
  )
  on conflict do nothing;

  update public.paciente
  set
    id_medico_uuid = p_medico_id,
    data_hora_ultima_atualizacao = timezone('utc', now())
  where id_paciente_uuid = p_paciente_id;

  return true;
end;
$$;

insert into public.medico (
  nome_completo_medico,
  email_medico,
  senha_medico,
  crm_medico,
  especialidade_medico,
  ativo
)
values
  (
    'Dr. Caio Bueno',
    'caio.bueno@glicnutri.demo',
    'GlicNutri@Medico1',
    'CRM-SP 198877',
    'Endocrinologia e diabetes',
    true
  ),
  (
    'Dr. Fernando Lima',
    'fernando.lima@glicnutri.demo',
    'GlicNutri@Medico1',
    'CRM-SP 552211',
    'Clinica medica / diabetes',
    true
  )
on conflict (email_medico) do update
set
  nome_completo_medico = excluded.nome_completo_medico,
  crm_medico = excluded.crm_medico,
  especialidade_medico = excluded.especialidade_medico,
  ativo = true,
  updated_at = timezone('utc', now());
