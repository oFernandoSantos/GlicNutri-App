create extension if not exists pgcrypto;

create or replace function public.registrar_glicemia_manual_paciente(
  p_id_paciente_uuid uuid,
  p_valor_glicose_mgdl numeric,
  p_data date default current_date,
  p_hora time default current_time,
  p_sintomas_associados text default 'Registro manual pelo app'
)
returns table (
  id_glicemia_manual_uuid uuid,
  id_paciente_uuid uuid,
  valor_glicose_mgdl numeric,
  data date,
  hora time,
  sintomas_associados text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_id_paciente_uuid is null then
    raise exception 'Paciente sem identificador para registrar glicemia.';
  end if;

  if p_valor_glicose_mgdl is null or p_valor_glicose_mgdl <= 0 then
    raise exception 'Valor de glicose invalido.';
  end if;

  if not exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = p_id_paciente_uuid
      and coalesce(p.excluido, false) = false
  ) then
    raise exception 'Paciente nao encontrado para registrar glicemia.';
  end if;

  return query
  insert into public.registro_glicemia_manual (
    id_glicemia_manual_uuid,
    id_paciente_uuid,
    valor_glicose_mgdl,
    data,
    hora,
    sintomas_associados
  )
  values (
    gen_random_uuid(),
    p_id_paciente_uuid,
    p_valor_glicose_mgdl,
    coalesce(p_data, current_date),
    coalesce(p_hora, current_time),
    coalesce(nullif(trim(p_sintomas_associados), ''), 'Registro manual pelo app')
  )
  returning
    registro_glicemia_manual.id_glicemia_manual_uuid,
    registro_glicemia_manual.id_paciente_uuid,
    registro_glicemia_manual.valor_glicose_mgdl,
    registro_glicemia_manual.data,
    registro_glicemia_manual.hora,
    registro_glicemia_manual.sintomas_associados;
end;
$$;

grant execute on function public.registrar_glicemia_manual_paciente(
  uuid,
  numeric,
  date,
  time,
  text
) to anon, authenticated;
