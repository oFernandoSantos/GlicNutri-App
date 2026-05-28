create extension if not exists pgcrypto;

do $$
declare
  v_start_date date := current_date - 29;
  v_end_date date := current_date;
begin
  delete from public.registro_glicemia_manual
  where data between v_start_date and v_end_date
    and sintomas_associados like 'Uso 30d auto seed%';

  with active_patients as (
    select
      p.id_paciente_uuid,
      row_number() over (order by p.id_paciente_uuid) as patient_seq
    from public.paciente p
    where coalesce(p.excluido, false) = false
  ),
  daily_slots as (
    select
      gs::date as ref_date,
      extract(day from gs)::int as day_number
    from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
  )
  insert into public.registro_glicemia_manual (
    id_glicemia_manual_uuid,
    id_paciente_uuid,
    valor_glicose_mgdl,
    data,
    hora,
    sintomas_associados
  )
  select
    gen_random_uuid(),
    ap.id_paciente_uuid,
    (92 + ((ap.patient_seq + ds.day_number) % 18)),
    ds.ref_date,
    time '07:00:00',
    'Uso 30d auto seed | Tipo da glicemia: Jejum'
  from active_patients ap
  cross join daily_slots ds
  union all
  select
    gen_random_uuid(),
    ap.id_paciente_uuid,
    (136 + ((ap.patient_seq + ds.day_number) % 28)),
    ds.ref_date,
    time '13:15:00',
    'Uso 30d auto seed | Tipo da glicemia: Pos-almoco'
  from active_patients ap
  cross join daily_slots ds
  union all
  select
    gen_random_uuid(),
    ap.id_paciente_uuid,
    (118 + ((ap.patient_seq + ds.day_number) % 20)),
    ds.ref_date,
    time '21:10:00',
    'Uso 30d auto seed | Tipo da glicemia: Antes de dormir'
  from active_patients ap
  cross join daily_slots ds;

  raise notice 'Seed mensal de glicose aplicada para todos os pacientes ativos entre % e %.', v_start_date, v_end_date;
end $$;
