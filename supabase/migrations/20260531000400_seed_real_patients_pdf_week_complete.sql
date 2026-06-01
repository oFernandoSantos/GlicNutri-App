-- Semana completa para pacientes reais: glicose, 7 refeicoes/dia, insulina e medicacao (PDF preenchido).
create extension if not exists pgcrypto;

do $$
declare
  v_patient record;
  v_meal_tag constant text := 'seed://pdf-semana-v1';
  v_glucose_marker constant text := 'PDF semana v1 | Tipo da glicemia:';
  v_insulin_marker constant text := 'PDF semana v1';
  v_med_legado_prefix constant text := 'seed-pdf-v1-';
  v_end_date date := current_date;
  v_start_date date := current_date - 6;
  v_inserted integer;
begin
  for v_patient in
    select p.id_paciente_uuid
    from public.paciente p
    where coalesce(p.excluido, false) = false
      and coalesce(p.email_pac, '') not like 'seed.paciente%@glicnutri.demo'
  loop
    delete from public.registro_glicemia_manual
    where id_paciente_uuid = v_patient.id_paciente_uuid
      and data between v_start_date and v_end_date
      and coalesce(sintomas_associados, '') like v_glucose_marker || '%';

    delete from public.registro_insulina
    where id_paciente_uuid = v_patient.id_paciente_uuid
      and data between v_start_date and v_end_date
      and coalesce(observacao, '') = v_insulin_marker;

    delete from public.registro_medicacao
    where id_paciente_uuid = v_patient.id_paciente_uuid
      and data between v_start_date and v_end_date
      and coalesce(id_registro_legado, '') like v_med_legado_prefix || '%';

    delete from public.refeicao_ia
    where paciente_id = v_patient.id_paciente_uuid
      and coalesce(foto_url, '') in (v_meal_tag, 'seed://7refeicoes-semana-v1')
      and created_at >= v_start_date::timestamp
      and created_at < (v_end_date + 1)::timestamp;

    with daily_slots as (
      select
        gs::date as ref_date,
        (gs::date - v_start_date) as day_index,
        extract(day from gs)::int as day_number
      from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
    ),
    glucose_targets as (
      select *
      from (
        values
          (0::int, 250::numeric),
          (1, 300),
          (2, 100),
          (3, 265),
          (4, 300),
          (5, 181),
          (6, 189)
      ) as t(day_index, target_avg)
    ),
    glucose_slots as (
      select *
      from (
        values
          ('Jejum'::text, time '07:05:00', 0),
          ('Pos-cafe', time '08:35:00', 1),
          ('Pre-almoco', time '11:55:00', 2),
          ('Pos-almoco', time '13:25:00', 3),
          ('Tarde', time '16:15:00', 4),
          ('Pre-jantar', time '19:05:00', 5),
          ('Pos-jantar', time '20:55:00', 6),
          ('Antes de dormir', time '22:20:00', 7),
          ('Madrugada', time '03:10:00', 8)
      ) as t(label, slot_time, slot_idx)
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
      v_patient.id_paciente_uuid,
      greatest(
        70,
        least(
          350,
          round(
            gt.target_avg
            + ((gs.slot_idx % 3) - 1) * 14
            + ((ds.day_number + gs.slot_idx) % 5) * 4
          )
        )
      ),
      ds.ref_date,
      gs.slot_time + (((ds.day_number + gs.slot_idx) % 7)::int * interval '1 minute'),
      v_glucose_marker || ' ' || gs.label
    from daily_slots ds
    join glucose_targets gt on gt.day_index = ds.day_index
    cross join glucose_slots gs;

    with daily_slots as (
      select
        gs::date as ref_date,
        extract(day from gs)::int as day_number
      from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
    ),
    insulin_slots as (
      select *
      from (
        values
          ('basal'::text, 'Insulina Glargina', time '22:05:00', 14::numeric, 'Controle noturno'),
          ('bolus', 'Insulina Lispro', time '07:40:00', 6::numeric, 'Correcao pre-cafe'),
          ('bolus', 'Insulina Lispro', time '12:50:00', 8::numeric, 'Correcao pre-almoco'),
          ('bolus', 'Insulina Lispro', time '19:15:00', 7::numeric, 'Correcao pre-jantar')
      ) as t(categoria, nome, slot_time, dose_base, objetivo)
    )
    insert into public.registro_insulina (
      id_paciente_uuid,
      categoria_insulina,
      nome_insulina,
      dose_ui,
      unidade_medida,
      local_aplicacao,
      data,
      hora,
      objetivo_uso,
      observacao
    )
    select
      v_patient.id_paciente_uuid,
      ins.categoria,
      ins.nome,
      ins.dose_base + ((ds.day_number + extract(hour from ins.slot_time)::int) % 3),
      'UI',
      case when ins.categoria = 'basal' then 'Abdomen' else 'Braco direito' end,
      ds.ref_date,
      ins.slot_time + (((ds.day_number % 5)::int) * interval '1 minute'),
      ins.objetivo,
      v_insulin_marker
    from daily_slots ds
    cross join insulin_slots ins;

    with daily_slots as (
      select
        gs::date as ref_date,
        extract(day from gs)::int as day_number
      from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
    ),
    med_slots as (
      select *
      from (
        values
          ('medicine'::text, 'Metformina 850 mg pos-cafe', 'Metformina', 'mg', '850', time '08:10:00', 'med-am'),
          ('medicine', 'Enalapril 10 mg a noite', 'Enalapril', 'mg', '10', time '20:30:00', 'med-pm'),
          ('medicine', 'Sinvastatina 20 mg a noite', 'Sinvastatina', 'mg', '20', time '21:00:00', 'med-stat')
      ) as t(tipo, descricao, nome, unidade, quantidade, slot_time, slot_key)
    )
    insert into public.registro_medicacao (
      id_registro_medicacao_uuid,
      id_paciente_uuid,
      tipo_registro,
      descricao,
      nome_medicamento,
      unidade_medida,
      quantidade,
      data,
      hora,
      dias_tratamento,
      uso_continuo,
      observacao,
      id_registro_legado
    )
    select
      gen_random_uuid(),
      v_patient.id_paciente_uuid,
      ms.tipo,
      ms.descricao,
      ms.nome,
      ms.unidade,
      ms.quantidade,
      ds.ref_date,
      ms.slot_time + (((ds.day_number + length(ms.slot_key)) % 6)::int * interval '1 minute'),
      null::integer,
      true::boolean,
      v_insulin_marker,
      v_med_legado_prefix || v_patient.id_paciente_uuid::text || '-' || ds.ref_date::text || '-' || ms.slot_key
    from daily_slots ds
    cross join med_slots ms;

    with daily_slots as (
      select
        gs::date as ref_date,
        extract(day from gs)::int as day_number
      from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
    ),
    meal_templates as (
      select *
      from (
        values
          (0, 'Cafe da Manha', time '07:30:00', 31::numeric, 248::numeric, 13::numeric, 9::numeric, 4::numeric, 8::numeric, 3::numeric, 120::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Pao integral', 'quantidade_gramas', 50, 'calorias', 128, 'carboidratos', 24, 'proteinas', 5, 'gorduras', 2, 'mealLabel', 'Cafe da Manha'),
              jsonb_build_object('nome', 'Ovo mexido', 'quantidade_gramas', 60, 'calorias', 90, 'carboidratos', 1, 'proteinas', 7, 'gorduras', 6, 'mealLabel', 'Cafe da Manha'),
              jsonb_build_object('nome', 'Cafe sem acucar', 'quantidade_gramas', 200, 'calorias', 30, 'carboidratos', 6, 'proteinas', 1, 'gorduras', 1, 'mealLabel', 'Cafe da Manha')
            )),
          (1, 'Lanche da Manha', time '10:00:00', 18::numeric, 142::numeric, 4::numeric, 5::numeric, 3::numeric, 4::numeric, 1::numeric, 45::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Banana', 'quantidade_gramas', 90, 'calorias', 81, 'carboidratos', 21, 'proteinas', 1, 'gorduras', 0.3, 'mealLabel', 'Lanche da Manha'),
              jsonb_build_object('nome', 'Castanha do para', 'quantidade_gramas', 15, 'calorias', 61, 'carboidratos', 3, 'proteinas', 3, 'gorduras', 4.7, 'mealLabel', 'Lanche da Manha')
            )),
          (2, 'Almoco', time '12:30:00', 48::numeric, 462::numeric, 49::numeric, 7::numeric, 8::numeric, 6::numeric, 2::numeric, 320::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Arroz integral', 'quantidade_gramas', 120, 'calorias', 148, 'carboidratos', 31, 'proteinas', 3, 'gorduras', 1, 'mealLabel', 'Almoco'),
              jsonb_build_object('nome', 'Feijao carioca', 'quantidade_gramas', 100, 'calorias', 76, 'carboidratos', 14, 'proteinas', 5, 'gorduras', 0.5, 'mealLabel', 'Almoco'),
              jsonb_build_object('nome', 'Peito de frango grelhado', 'quantidade_gramas', 130, 'calorias', 215, 'carboidratos', 0, 'proteinas', 40, 'gorduras', 5, 'mealLabel', 'Almoco')
            )),
          (3, 'Lanche da Tarde', time '15:30:00', 22::numeric, 168::numeric, 6::numeric, 6::numeric, 4::numeric, 10::numeric, 2::numeric, 90::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Iogurte natural', 'quantidade_gramas', 170, 'calorias', 92, 'carboidratos', 8, 'proteinas', 6, 'gorduras', 4, 'mealLabel', 'Lanche da Tarde'),
              jsonb_build_object('nome', 'Granola sem acucar', 'quantidade_gramas', 30, 'calorias', 76, 'carboidratos', 14, 'proteinas', 2, 'gorduras', 2, 'mealLabel', 'Lanche da Tarde')
            )),
          (4, 'Jantar', time '19:30:00', 28::numeric, 286::numeric, 18::numeric, 10::numeric, 6::numeric, 5::numeric, 2::numeric, 410::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Sopa de legumes', 'quantidade_gramas', 300, 'calorias', 160, 'carboidratos', 24, 'proteinas', 6, 'gorduras', 4, 'mealLabel', 'Jantar'),
              jsonb_build_object('nome', 'Omelete de claras', 'quantidade_gramas', 120, 'calorias', 96, 'carboidratos', 2, 'proteinas', 12, 'gorduras', 4, 'mealLabel', 'Jantar')
            )),
          (5, 'Ceia', time '21:30:00', 12::numeric, 118::numeric, 8::numeric, 4::numeric, 2::numeric, 6::numeric, 1::numeric, 55::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Leite desnatado', 'quantidade_gramas', 200, 'calorias', 70, 'carboidratos', 10, 'proteinas', 7, 'gorduras', 0.5, 'mealLabel', 'Ceia'),
              jsonb_build_object('nome', 'Maca', 'quantidade_gramas', 120, 'calorias', 48, 'carboidratos', 2, 'proteinas', 1, 'gorduras', 3.5, 'mealLabel', 'Ceia')
            )),
          (6, 'Outro Momento', time '16:45:00', 15::numeric, 132::numeric, 5::numeric, 4::numeric, 3::numeric, 8::numeric, 1::numeric, 60::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Mix de nuts', 'quantidade_gramas', 20, 'calorias', 116, 'carboidratos', 4, 'proteinas', 4, 'gorduras', 10, 'mealLabel', 'Outro Momento'),
              jsonb_build_object('nome', 'Cha verde sem acucar', 'quantidade_gramas', 200, 'calorias', 16, 'carboidratos', 11, 'proteinas', 1, 'gorduras', 0, 'mealLabel', 'Outro Momento')
            ))
      ) as t(
        slot_index, meal_label, slot_time,
        carboidratos_total, calorias_total, proteinas_total, gorduras_total,
        fibras_total, acucares_total, gorduras_saturadas_total, sodio_total, alimentos
      )
    )
    insert into public.refeicao_ia (
      id,
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
    select
      gen_random_uuid(),
      v_patient.id_paciente_uuid,
      v_meal_tag,
      mt.alimentos,
      mt.carboidratos_total + ((ds.day_number + mt.slot_index) % 3),
      mt.calorias_total + (((ds.day_number + mt.slot_index) % 4) * 8),
      mt.proteinas_total + ((ds.day_number + mt.slot_index) % 2),
      mt.gorduras_total + (((ds.day_number + mt.slot_index) % 3) * 0.4),
      mt.fibras_total,
      mt.acucares_total,
      mt.gorduras_saturadas_total,
      mt.sodio_total,
      true,
      timezone('utc', ds.ref_date::timestamp + mt.slot_time)
    from daily_slots ds
    cross join meal_templates mt;

    get diagnostics v_inserted = row_count;
    raise notice 'PDF semana v1 paciente %: refeicoes=%, periodo % a %.',
      v_patient.id_paciente_uuid,
      v_inserted,
      v_start_date,
      v_end_date;
  end loop;
end;
$$;
