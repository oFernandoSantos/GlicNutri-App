-- Disponibilidade por data especifica (alem do weekday legado).

alter table public.nutri_disponibilidade
  add column if not exists availability_date date;

alter table public.medico_disponibilidade
  add column if not exists availability_date date;

create index if not exists idx_nutri_disponibilidade_data
  on public.nutri_disponibilidade (nutricionista_id, availability_date, start_time);

create index if not exists idx_medico_disponibilidade_data
  on public.medico_disponibilidade (medico_id, availability_date, start_time);
