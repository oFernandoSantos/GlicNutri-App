create index if not exists idx_registro_glicemia_paciente_data_hora
  on public.registro_glicemia_manual (id_paciente_uuid, data desc, hora desc);
