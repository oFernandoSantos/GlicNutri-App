-- Seed 7 refeicoes/dia (7 periodos do app) x 7 dias para pacientes reais (nao seed.demo).
do $$
declare
  v_patient record;
  v_seed_tag constant text := 'seed://7refeicoes-semana-v1';
  v_end_date date := current_date;
  v_start_date date := current_date - 6;
  v_inserted integer := 0;
begin
  for v_patient in
    select p.id_paciente_uuid
    from public.paciente p
    where coalesce(p.excluido, false) = false
      and coalesce(p.email_pac, '') not like 'seed.paciente%@glicnutri.demo'
  loop
    delete from public.refeicao_ia
    where paciente_id = v_patient.id_paciente_uuid
      and coalesce(foto_url, '') = v_seed_tag
      and created_at >= v_start_date::timestamp
      and created_at < (v_end_date + 1)::timestamp;

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
          (
            0,
            'Cafe da Manha',
            time '07:30:00',
            31::numeric,
            248::numeric,
            13::numeric,
            9::numeric,
            4::numeric,
            8::numeric,
            3::numeric,
            120::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Pao integral', 'categoria', 'Cafe da manha', 'quantidade_gramas', 50, 'calorias', 128, 'carboidratos', 24, 'proteinas', 5, 'gorduras', 2, 'fibras', 3, 'acucares', 2, 'gorduras_saturadas', 0.5, 'sodio', 180, 'mealLabel', 'Cafe da Manha', 'mealTypeLabel', 'Cafe da Manha'),
              jsonb_build_object('nome', 'Ovo mexido', 'categoria', 'Proteina', 'quantidade_gramas', 60, 'calorias', 90, 'carboidratos', 1, 'proteinas', 7, 'gorduras', 6, 'fibras', 0, 'acucares', 0, 'gorduras_saturadas', 2, 'sodio', 120, 'mealLabel', 'Cafe da Manha', 'mealTypeLabel', 'Cafe da Manha'),
              jsonb_build_object('nome', 'Cafe sem acucar', 'categoria', 'Bebida', 'quantidade_gramas', 200, 'calorias', 30, 'carboidratos', 6, 'proteinas', 1, 'gorduras', 1, 'fibras', 0, 'acucares', 6, 'gorduras_saturadas', 0.5, 'sodio', 10, 'mealLabel', 'Cafe da Manha', 'mealTypeLabel', 'Cafe da Manha')
            )
          ),
          (
            1,
            'Lanche da Manha',
            time '10:00:00',
            18::numeric,
            142::numeric,
            4::numeric,
            5::numeric,
            3::numeric,
            4::numeric,
            1::numeric,
            45::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Banana', 'categoria', 'Fruta', 'quantidade_gramas', 90, 'calorias', 81, 'carboidratos', 21, 'proteinas', 1, 'gorduras', 0.3, 'fibras', 2.5, 'acucares', 12, 'gorduras_saturadas', 0, 'sodio', 1, 'mealLabel', 'Lanche da Manha', 'mealTypeLabel', 'Lanche da Manha'),
              jsonb_build_object('nome', 'Castanha do para', 'categoria', 'Oleaginosa', 'quantidade_gramas', 15, 'calorias', 61, 'carboidratos', 3, 'proteinas', 3, 'gorduras', 4.7, 'fibras', 0.5, 'acucares', 0, 'gorduras_saturadas', 1, 'sodio', 0, 'mealLabel', 'Lanche da Manha', 'mealTypeLabel', 'Lanche da Manha')
            )
          ),
          (
            2,
            'Almoco',
            time '12:30:00',
            48::numeric,
            462::numeric,
            49::numeric,
            7::numeric,
            8::numeric,
            6::numeric,
            2::numeric,
            320::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Arroz integral', 'categoria', 'Almoco', 'quantidade_gramas', 120, 'calorias', 148, 'carboidratos', 31, 'proteinas', 3, 'gorduras', 1, 'fibras', 2, 'acucares', 0, 'gorduras_saturadas', 0.2, 'sodio', 5, 'mealLabel', 'Almoco', 'mealTypeLabel', 'Almoco'),
              jsonb_build_object('nome', 'Feijao carioca', 'categoria', 'Leguminosa', 'quantidade_gramas', 100, 'calorias', 76, 'carboidratos', 14, 'proteinas', 5, 'gorduras', 0.5, 'fibras', 4, 'acucares', 0, 'gorduras_saturadas', 0.1, 'sodio', 220, 'mealLabel', 'Almoco', 'mealTypeLabel', 'Almoco'),
              jsonb_build_object('nome', 'Peito de frango grelhado', 'categoria', 'Proteina', 'quantidade_gramas', 130, 'calorias', 215, 'carboidratos', 0, 'proteinas', 40, 'gorduras', 5, 'fibras', 0, 'acucares', 0, 'gorduras_saturadas', 1.2, 'sodio', 95, 'mealLabel', 'Almoco', 'mealTypeLabel', 'Almoco'),
              jsonb_build_object('nome', 'Salada verde', 'categoria', 'Vegetais', 'quantidade_gramas', 80, 'calorias', 23, 'carboidratos', 3, 'proteinas', 1, 'gorduras', 0.2, 'fibras', 2, 'acucares', 2, 'gorduras_saturadas', 0, 'sodio', 15, 'mealLabel', 'Almoco', 'mealTypeLabel', 'Almoco')
            )
          ),
          (
            3,
            'Lanche da Tarde',
            time '15:30:00',
            22::numeric,
            168::numeric,
            6::numeric,
            6::numeric,
            4::numeric,
            10::numeric,
            2::numeric,
            90::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Iogurte natural', 'categoria', 'Laticinio', 'quantidade_gramas', 170, 'calorias', 92, 'carboidratos', 8, 'proteinas', 6, 'gorduras', 4, 'fibras', 0, 'acucares', 8, 'gorduras_saturadas', 2.5, 'sodio', 70, 'mealLabel', 'Lanche da Tarde', 'mealTypeLabel', 'Lanche da Tarde'),
              jsonb_build_object('nome', 'Granola sem acucar', 'categoria', 'Cereal', 'quantidade_gramas', 30, 'calorias', 76, 'carboidratos', 14, 'proteinas', 2, 'gorduras', 2, 'fibras', 2, 'acucares', 2, 'gorduras_saturadas', 0.5, 'sodio', 20, 'mealLabel', 'Lanche da Tarde', 'mealTypeLabel', 'Lanche da Tarde')
            )
          ),
          (
            4,
            'Jantar',
            time '19:30:00',
            28::numeric,
            286::numeric,
            18::numeric,
            10::numeric,
            6::numeric,
            5::numeric,
            2::numeric,
            410::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Sopa de legumes', 'categoria', 'Jantar', 'quantidade_gramas', 300, 'calorias', 160, 'carboidratos', 24, 'proteinas', 6, 'gorduras', 4, 'fibras', 4, 'acucares', 5, 'gorduras_saturadas', 1, 'sodio', 320, 'mealLabel', 'Jantar', 'mealTypeLabel', 'Jantar'),
              jsonb_build_object('nome', 'Omelete de claras', 'categoria', 'Proteina', 'quantidade_gramas', 120, 'calorias', 96, 'carboidratos', 2, 'proteinas', 12, 'gorduras', 4, 'fibras', 0, 'acucares', 0, 'gorduras_saturadas', 1.2, 'sodio', 90, 'mealLabel', 'Jantar', 'mealTypeLabel', 'Jantar'),
              jsonb_build_object('nome', 'Salada de tomate', 'categoria', 'Vegetais', 'quantidade_gramas', 70, 'calorias', 30, 'carboidratos', 2, 'proteinas', 1, 'gorduras', 2, 'fibras', 2, 'acucares', 2, 'gorduras_saturadas', 0.3, 'sodio', 10, 'mealLabel', 'Jantar', 'mealTypeLabel', 'Jantar')
            )
          ),
          (
            5,
            'Ceia',
            time '21:30:00',
            12::numeric,
            118::numeric,
            8::numeric,
            4::numeric,
            2::numeric,
            6::numeric,
            1::numeric,
            55::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Leite desnatado', 'categoria', 'Bebida', 'quantidade_gramas', 200, 'calorias', 70, 'carboidratos', 10, 'proteinas', 7, 'gorduras', 0.5, 'fibras', 0, 'acucares', 10, 'gorduras_saturadas', 0.3, 'sodio', 50, 'mealLabel', 'Ceia', 'mealTypeLabel', 'Ceia'),
              jsonb_build_object('nome', 'Maca', 'categoria', 'Fruta', 'quantidade_gramas', 120, 'calorias', 48, 'carboidratos', 2, 'proteinas', 1, 'gorduras', 3.5, 'fibras', 2, 'acucares', 6, 'gorduras_saturadas', 0.6, 'sodio', 2, 'mealLabel', 'Ceia', 'mealTypeLabel', 'Ceia')
            )
          ),
          (
            6,
            'Outro Momento',
            time '16:45:00',
            15::numeric,
            132::numeric,
            5::numeric,
            4::numeric,
            3::numeric,
            8::numeric,
            1::numeric,
            60::numeric,
            jsonb_build_array(
              jsonb_build_object('nome', 'Mix de nuts', 'categoria', 'Lanche', 'quantidade_gramas', 20, 'calorias', 116, 'carboidratos', 4, 'proteinas', 4, 'gorduras', 10, 'fibras', 2, 'acucares', 1, 'gorduras_saturadas', 1.5, 'sodio', 40, 'mealLabel', 'Outro Momento', 'mealTypeLabel', 'Outro Momento'),
              jsonb_build_object('nome', 'Cha verde sem acucar', 'categoria', 'Bebida', 'quantidade_gramas', 200, 'calorias', 16, 'carboidratos', 11, 'proteinas', 1, 'gorduras', 0, 'fibras', 1, 'acucares', 8, 'gorduras_saturadas', 0, 'sodio', 20, 'mealLabel', 'Outro Momento', 'mealTypeLabel', 'Outro Momento')
            )
          )
      ) as t(
        slot_index,
        meal_label,
        slot_time,
        carboidratos_total,
        calorias_total,
        proteinas_total,
        gorduras_total,
        fibras_total,
        acucares_total,
        gorduras_saturadas_total,
        sodio_total,
        alimentos
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
      v_seed_tag,
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
    raise notice 'Paciente %: % refeicoes inseridas (% a %).',
      v_patient.id_paciente_uuid,
      v_inserted,
      v_start_date,
      v_end_date;
  end loop;
end;
$$;
