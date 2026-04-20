create or replace function public.listar_glicemias_manuais_paciente(
  p_id_paciente_uuid uuid,
  p_limite integer default 120
)
returns table (
  id_glicemia_manual_uuid uuid,
  id_paciente_uuid uuid,
  valor_glicose_mgdl numeric,
  data date,
  hora time,
  sintomas_associados text
)
language sql
security definer
set search_path = public
as $$
  select
    rgm.id_glicemia_manual_uuid,
    rgm.id_paciente_uuid,
    rgm.valor_glicose_mgdl,
    rgm.data,
    rgm.hora,
    rgm.sintomas_associados
  from public.registro_glicemia_manual rgm
  where rgm.id_paciente_uuid = p_id_paciente_uuid
  order by rgm.data desc, rgm.hora desc
  limit greatest(coalesce(p_limite, 120), 1);
$$;

grant execute on function public.listar_glicemias_manuais_paciente(
  uuid,
  integer
) to anon, authenticated;
