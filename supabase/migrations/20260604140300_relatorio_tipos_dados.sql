-- Melhorias de tipos e metadados para relatório clínico (camada de dados)

alter table public.registro_glicemia_manual
  add column if not exists reading_time_utc timestamptz,
  add column if not exists fonte text not null default 'manual';

comment on column public.registro_glicemia_manual.reading_time_utc is
  'Instante real da medição em UTC; data/hora locais derivadas apenas para exibição.';

update public.registro_glicemia_manual
set reading_time_utc = (data + hora) at time zone 'America/Sao_Paulo'
where reading_time_utc is null
  and data is not null
  and hora is not null;

create index if not exists idx_glicemia_manual_paciente_reading_time
  on public.registro_glicemia_manual (id_paciente_uuid, reading_time_utc desc);

comment on column public.registro_medicacao.quantidade is
  'Dose registrada; preferir valor numérico em UI para insulina via registro_insulina.dose_ui.';

comment on column public.refeicao_ia.paciente_id is
  'FK obrigatória do paciente dono da refeição (nome legado; equivalente a id_paciente_uuid).';
