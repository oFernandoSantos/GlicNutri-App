create extension if not exists pgcrypto;

do $$
declare
  v_start_date date := current_date - 29;
  v_end_date date := current_date;
  v_start_ts timestamptz := timezone('utc', v_start_date::timestamp);
  v_end_ts timestamptz := timezone('utc', (v_end_date + 1)::timestamp);
begin
  with active_patients as (
    select
      p.id_paciente_uuid,
      coalesce(
        p.id_nutricionista_uuid,
        latest_consulta.nutricionista_id
      ) as nutricionista_id
    from public.paciente p
    left join lateral (
      select c.nutricionista_id
      from public.consulta c
      where c.paciente_id = p.id_paciente_uuid
        and c.status <> 'cancelled'
      order by c.scheduled_at desc
      limit 1
    ) latest_consulta on true
    where coalesce(p.excluido, false) = false
  )
  delete from public.mensagem_chat mc
  using active_patients ap
  where mc.paciente_id = ap.id_paciente_uuid
    and mc.nutricionista_id = ap.nutricionista_id
    and mc.created_at >= v_start_ts
    and mc.created_at < v_end_ts
    and mc.texto like '%[hist-seed-30d]%';

  delete from public.registro_glicemia_manual
  where data between v_start_date and v_end_date
    and sintomas_associados like 'Uso 30d auto seed%';

  delete from public.registro_medicacao
  where data between v_start_date and v_end_date
    and id_registro_legado like 'seed-30d-%';

  delete from public.refeicao_ia
  where created_at >= v_start_ts
    and created_at < v_end_ts
    and foto_url = 'seed://monthly-usage';

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
  glucose_templates as (
    select *
    from (
      values
        ('Jejum'::text, time '07:05:00', 96::numeric),
        ('Pos-almoco'::text, time '13:12:00', 142::numeric),
        ('Antes de dormir'::text, time '21:08:00', 124::numeric)
    ) as t(label, slot_time, base_value)
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
    greatest(
      78,
      round(
        gt.base_value
        + ((ap.patient_seq % 9) - 4)
        + ((ds.day_number % 7) - 3)
        + case gt.label when 'Pos-almoco' then (ap.patient_seq % 5) else 0 end
      )
    ),
    ds.ref_date,
    gt.slot_time + ((((ap.patient_seq + ds.day_number) % 9)::int) * interval '1 minute'),
    'Uso 30d auto seed | Tipo da glicemia: ' || gt.label
  from active_patients ap
  cross join daily_slots ds
  cross join glucose_templates gt;

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
  meal_templates as (
    select *
    from (
      values
        (
          'cafe'::text,
          time '07:35:00',
          248::numeric,
          31::numeric,
          12::numeric,
          8::numeric,
          jsonb_build_array(
            jsonb_build_object('nome', 'Pao integral', 'categoria', 'Cafe da manha', 'quantidade_gramas', 50, 'calorias', 128, 'carboidratos', 24, 'proteinas', 5, 'gorduras', 2),
            jsonb_build_object('nome', 'Ovo cozido', 'categoria', 'Proteina', 'quantidade_gramas', 50, 'calorias', 78, 'carboidratos', 0.6, 'proteinas', 6.3, 'gorduras', 5.3),
            jsonb_build_object('nome', 'Cafe sem acucar', 'categoria', 'Bebida', 'quantidade_gramas', 180, 'calorias', 4, 'carboidratos', 0, 'proteinas', 0, 'gorduras', 0)
          )
        ),
        (
          'almoco'::text,
          time '12:28:00',
          438::numeric,
          46::numeric,
          41::numeric,
          7::numeric,
          jsonb_build_array(
            jsonb_build_object('nome', 'Arroz integral', 'categoria', 'Almoco', 'quantidade_gramas', 110, 'calorias', 136, 'carboidratos', 28, 'proteinas', 3, 'gorduras', 1),
            jsonb_build_object('nome', 'Feijao carioca', 'categoria', 'Leguminosa', 'quantidade_gramas', 90, 'calorias', 68, 'carboidratos', 13, 'proteinas', 4.5, 'gorduras', 0.4),
            jsonb_build_object('nome', 'Frango grelhado', 'categoria', 'Proteina', 'quantidade_gramas', 120, 'calorias', 198, 'carboidratos', 0, 'proteinas', 37, 'gorduras', 4.2),
            jsonb_build_object('nome', 'Salada verde', 'categoria', 'Vegetais', 'quantidade_gramas', 70, 'calorias', 18, 'carboidratos', 3, 'proteinas', 1, 'gorduras', 0)
          )
        ),
        (
          'jantar'::text,
          time '19:24:00',
          292::numeric,
          28::numeric,
          18::numeric,
          9::numeric,
          jsonb_build_array(
            jsonb_build_object('nome', 'Sopa de legumes', 'categoria', 'Jantar', 'quantidade_gramas', 280, 'calorias', 160, 'carboidratos', 24, 'proteinas', 6, 'gorduras', 4),
            jsonb_build_object('nome', 'Iogurte natural', 'categoria', 'Laticinio', 'quantidade_gramas', 170, 'calorias', 92, 'carboidratos', 8, 'proteinas', 6, 'gorduras', 4),
            jsonb_build_object('nome', 'Fruta da noite', 'categoria', 'Fruta', 'quantidade_gramas', 90, 'calorias', 40, 'carboidratos', 10, 'proteinas', 0.5, 'gorduras', 0.1)
          )
        )
    ) as t(slot_key, slot_time, calorias_total, carboidratos_total, proteinas_total, gorduras_total, alimentos)
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
    confirmado,
    created_at
  )
  select
    gen_random_uuid(),
    ap.id_paciente_uuid,
    'seed://monthly-usage',
    mt.alimentos,
    mt.carboidratos_total + ((ap.patient_seq + ds.day_number) % 4),
    mt.calorias_total + (((ap.patient_seq + ds.day_number) % 5) * 12),
    mt.proteinas_total + ((ap.patient_seq + ds.day_number) % 3),
    mt.gorduras_total + (((ap.patient_seq + ds.day_number) % 4) * 0.5),
    true,
    timezone('utc', ds.ref_date::timestamp + mt.slot_time + ((((ap.patient_seq + ds.day_number) % 11)::int) * interval '1 minute'))
  from active_patients ap
  cross join daily_slots ds
  cross join meal_templates mt;

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
    ap.id_paciente_uuid,
    'medicine',
    'Metformina apos cafe da manha',
    'Metformina',
    'mg',
    case when (ap.patient_seq + ds.day_number) % 4 = 0 then '500' else '850' end,
    ds.ref_date,
    time '08:00:00' + ((((ap.patient_seq + ds.day_number) % 9)::int) * interval '1 minute'),
    null::integer,
    true::boolean,
    'Uso continuo | seed 30d',
    'seed-30d-med-' || ap.id_paciente_uuid::text || '-' || ds.ref_date::text
  from active_patients ap
  cross join daily_slots ds
  union all
  select
    gen_random_uuid(),
    ap.id_paciente_uuid,
    'insulin',
    'Insulina basal noturna',
    'Insulina Glargina',
    'UI',
    (10 + ((ap.patient_seq + ds.day_number) % 8))::text,
    ds.ref_date,
    time '21:45:00' + ((((ap.patient_seq + ds.day_number) % 8)::int) * interval '1 minute'),
    null::integer,
    true::boolean,
    E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Seed 30d',
    'seed-30d-ins-' || ap.id_paciente_uuid::text || '-' || ds.ref_date::text
  from active_patients ap
  cross join daily_slots ds;

  with active_patients as (
    select
      p.id_paciente_uuid,
      p.nome_completo,
      coalesce(
        p.id_nutricionista_uuid,
        latest_consulta.nutricionista_id
      ) as nutricionista_id,
      row_number() over (order by p.id_paciente_uuid) as patient_seq
    from public.paciente p
    left join lateral (
      select c.nutricionista_id
      from public.consulta c
      where c.paciente_id = p.id_paciente_uuid
        and c.status <> 'cancelled'
      order by c.scheduled_at desc
      limit 1
    ) latest_consulta on true
    where coalesce(p.excluido, false) = false
  ),
  interaction_days as (
    select
      gs::date as ref_date,
      extract(day from gs)::int as day_number
    from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '3 day') gs
  )
  insert into public.mensagem_chat (
    paciente_id,
    nutricionista_id,
    autor_role,
    texto,
    created_at
  )
  select
    ap.id_paciente_uuid,
    ap.nutricionista_id,
    'paciente',
    case ((ap.patient_seq + iday.day_number) % 4)
      when 0 then 'Bom dia! Registrei minhas refeicoes e glicemias do dia. [hist-seed-30d]'
      when 1 then 'Oi, consegui seguir o plano quase todo hoje e deixei os registros atualizados. [hist-seed-30d]'
      when 2 then 'Boa tarde! Tive uma pequena variacao na glicose apos o almoco, pode revisar depois? [hist-seed-30d]'
      else 'Ola! Atualizei glicose, alimentacao e medicacoes no app. [hist-seed-30d]'
    end,
    timezone('utc', iday.ref_date::timestamp + time '09:12:00' + (((ap.patient_seq % 7)::int) * interval '1 minute'))
  from active_patients ap
  join interaction_days iday on true
  where ap.nutricionista_id is not null
  union all
  select
    ap.id_paciente_uuid,
    ap.nutricionista_id,
    'nutricionista',
    case ((ap.patient_seq + iday.day_number) % 4)
      when 0 then 'Perfeito, vi seus registros. Mantenha a hidratacao e siga observando os horarios. [hist-seed-30d]'
      when 1 then 'Otimo andamento. Continue com o fracionamento das refeicoes e me avise se notar sintomas. [hist-seed-30d]'
      when 2 then 'Revisei aqui. Vamos manter a observacao do pos-almoco e priorizar fibras nessa refeicao. [hist-seed-30d]'
      else 'Recebi seus dados. Seu acompanhamento esta em dia e os registros ficaram consistentes. [hist-seed-30d]'
    end,
    timezone('utc', iday.ref_date::timestamp + time '16:40:00' + (((ap.patient_seq % 9)::int) * interval '1 minute'))
  from active_patients ap
  join interaction_days iday on true
  where ap.nutricionista_id is not null;

  update public.paciente p
     set data_hora_ultima_atualizacao = timezone('utc', now())
   where coalesce(p.excluido, false) = false;

  raise notice 'Seed mensal aplicada para todos os pacientes ativos entre % e %.', v_start_date, v_end_date;
end $$;
