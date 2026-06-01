-- PostgREST nao deve ter duas overloads de listar_glicemias_cgm_paciente (uuid vs date range).
drop function if exists public.listar_glicemias_cgm_paciente(
  uuid,
  integer,
  date,
  date
);
