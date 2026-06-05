-- Distribui variacao de TIR entre pacientes da carteira demo (ultimos 30 dias).
-- Leituras fora de 70-180 mg/dL reduzem o TIR; proporcao varia por paciente.

create extension if not exists pgcrypto;

do $$
declare
  v_start_date date := current_date - 29;
  v_end_date date := current_date;
begin
  delete from public.registro_glicemia_manual
  where data between v_start_date and v_end_date
    and (
      sintomas_associados like 'Uso 30d auto seed%'
      or sintomas_associados like 'TIR distribution seed%'
    );

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
  ),
  reading_plan as (
    select
      ap.id_paciente_uuid,
      ap.patient_seq,
      ds.ref_date,
      ds.day_number,
      slot.reading_slot,
      slot.reading_hour,
      slot.reading_label
    from active_patients ap
    cross join daily_slots ds
    cross join (
      values
        (1, time '07:00:00', 'Jejum'),
        (2, time '13:15:00', 'Pos-almoco'),
        (3, time '21:10:00', 'Antes de dormir')
    ) as slot(reading_slot, reading_hour, reading_label)
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
    rp.id_paciente_uuid,
    case (rp.patient_seq % 5)
      when 0 then
        case
          when (rp.patient_seq + rp.day_number + rp.reading_slot) % 4 = 0
            then 108 + (rp.day_number % 12)
          else 205 + ((rp.patient_seq + rp.day_number) % 25)
        end
      when 1 then
        case
          when (rp.patient_seq + rp.day_number + rp.reading_slot) % 5 < 2
            then 112 + (rp.day_number % 14)
          else 198 + ((rp.patient_seq + rp.day_number) % 30)
        end
      when 2 then
        case
          when (rp.patient_seq + rp.day_number + rp.reading_slot) % 5 < 3
            then 118 + (rp.day_number % 16)
          else 192 + ((rp.patient_seq + rp.day_number) % 28)
        end
      when 3 then
        case
          when (rp.patient_seq + rp.day_number + rp.reading_slot) % 5 < 4
            then 122 + (rp.day_number % 18)
          else 188 + ((rp.patient_seq + rp.day_number) % 22)
        end
      else
        case
          when (rp.patient_seq + rp.day_number + rp.reading_slot) % 20 = 0
            then 215 + (rp.day_number % 10)
          else 95 + ((rp.patient_seq + rp.day_number + rp.reading_slot) % 35)
        end
    end,
    rp.ref_date,
    rp.reading_hour,
    'TIR distribution seed | Tipo da glicemia: ' || rp.reading_label
  from reading_plan rp;

  raise notice 'Seed de TIR variada aplicada entre % e %.', v_start_date, v_end_date;
end $$;
