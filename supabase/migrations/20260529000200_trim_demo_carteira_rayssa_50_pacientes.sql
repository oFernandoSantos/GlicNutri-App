-- ============================================================
-- Demo trim: 50 pacientes seed + 10 nutricionistas
-- Carteira: rayssa.lira@gmail.com
-- Historico app: ultimos 30 dias (re-seed)
-- NAO apaga contas reais (fora do padrao seed.*@glicnutri.demo)
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  v_rayssa_id uuid;
  v_start_date date := current_date - 29;
  v_end_date date := current_date;
  v_start_ts timestamptz := timezone('utc', v_start_date::timestamp);
  v_end_ts timestamptz := timezone('utc', (v_end_date + 1)::timestamp);
  v_deleted_patients int;
  v_deleted_nutris int;
begin
  select n.id_nutricionista_uuid
    into v_rayssa_id
  from public.nutricionista n
  where lower(trim(n.email_acesso)) = 'rayssa.lira@gmail.com'
  order by n.id_nutricionista_uuid
  limit 1;

  if v_rayssa_id is null then
    raise exception 'Nutricionista rayssa.lira@gmail.com nao encontrada.';
  end if;

  create temporary table tmp_keep_patients on commit drop as
  select p.id_paciente_uuid
  from public.paciente p
  where p.email_pac like 'seed.paciente%@glicnutri.demo'
  order by p.email_pac
  limit 50;

  if (select count(*) from tmp_keep_patients) < 50 then
    raise notice 'Aviso: menos de 50 pacientes seed encontrados (=%).',
      (select count(*) from tmp_keep_patients);
  end if;

  create temporary table tmp_keep_nutris on commit drop as
  select n.id_nutricionista_uuid
  from public.nutricionista n
  where n.id_nutricionista_uuid = v_rayssa_id
     or n.email_acesso ~ '^seed\.nutri00[1-9]@glicnutri\.demo$';

  -- Carteira Rayssa nos 50 mantidos
  update public.paciente p
     set id_nutricionista_uuid = v_rayssa_id,
         data_hora_ultima_atualizacao = timezone('utc', now())
  from tmp_keep_patients kp
  where p.id_paciente_uuid = kp.id_paciente_uuid;

  update public.consulta c
     set nutricionista_id = v_rayssa_id,
         updated_at = timezone('utc', now())
  from tmp_keep_patients kp
  where c.paciente_id = kp.id_paciente_uuid
    and c.nutricionista_id is distinct from v_rayssa_id;

  update public.plano_alimentar pa
     set nutricionista_id = v_rayssa_id,
         updated_at = timezone('utc', now())
  from tmp_keep_patients kp
  where pa.paciente_id = kp.id_paciente_uuid
    and pa.nutricionista_id is distinct from v_rayssa_id;

  update public.prontuario_nota pn
     set nutricionista_id = v_rayssa_id,
         updated_at = timezone('utc', now())
  from tmp_keep_patients kp
  where pn.paciente_id = kp.id_paciente_uuid
    and pn.nutricionista_id is distinct from v_rayssa_id;

  update public.prontuario_evolucao pe
     set nutricionista_id = v_rayssa_id
  from tmp_keep_patients kp
  where pe.paciente_id = kp.id_paciente_uuid
    and pe.nutricionista_id is distinct from v_rayssa_id;

  update public.prontuario_antropometria pa
     set nutricionista_id = v_rayssa_id
  from tmp_keep_patients kp
  where pa.paciente_id = kp.id_paciente_uuid
    and pa.nutricionista_id is distinct from v_rayssa_id;

  update public.prontuario_meta_clinica pm
     set nutricionista_id = v_rayssa_id,
         updated_at = timezone('utc', now())
  from tmp_keep_patients kp
  where pm.paciente_id = kp.id_paciente_uuid
    and pm.nutricionista_id is distinct from v_rayssa_id;

  update public.mensagem_chat mc
     set nutricionista_id = v_rayssa_id
  from tmp_keep_patients kp
  where mc.paciente_id = kp.id_paciente_uuid
    and mc.nutricionista_id is distinct from v_rayssa_id;

  -- Apaga pacientes seed excedentes (450+)
  delete from public.paciente p
  where p.email_pac like 'seed.paciente%@glicnutri.demo'
    and p.id_paciente_uuid not in (select id_paciente_uuid from tmp_keep_patients);

  get diagnostics v_deleted_patients = row_count;

  -- Limpa historico dos 50 mantidos (re-seed 30d)
  delete from public.mensagem_chat mc
  using tmp_keep_patients kp
  where mc.paciente_id = kp.id_paciente_uuid;

  delete from public.registro_glicemia_manual rg
  using tmp_keep_patients kp
  where rg.id_paciente_uuid = kp.id_paciente_uuid;

  delete from public.registro_glicemia_cgm rg
  using tmp_keep_patients kp
  where rg.id_paciente_uuid = kp.id_paciente_uuid;

  delete from public.registro_insulina ri
  using tmp_keep_patients kp
  where ri.id_paciente_uuid = kp.id_paciente_uuid;

  delete from public.registro_medicacao rm
  using tmp_keep_patients kp
  where rm.id_paciente_uuid = kp.id_paciente_uuid;

  delete from public.refeicao_ia ri
  using tmp_keep_patients kp
  where ri.paciente_id = kp.id_paciente_uuid;

  delete from public.alerta_clinico ac
  using tmp_keep_patients kp
  where ac.paciente_id = kp.id_paciente_uuid;

  delete from public.alertas_ia ai
  using tmp_keep_patients kp
  where ai.id_paciente_uuid = kp.id_paciente_uuid;

  delete from public.consulta_notificacao cn
  using public.consulta c, tmp_keep_patients kp
  where cn.consulta_id = c.id
    and c.paciente_id = kp.id_paciente_uuid;

  delete from public.consulta c
  using tmp_keep_patients kp
  where c.paciente_id = kp.id_paciente_uuid;

  delete from public.plano_alimentar_item pai
  using public.plano_alimentar_refeicao par, public.plano_alimentar pa, tmp_keep_patients kp
  where pai.refeicao_id = par.id
    and par.plano_id = pa.id
    and pa.paciente_id = kp.id_paciente_uuid;

  delete from public.plano_alimentar_refeicao par
  using public.plano_alimentar pa, tmp_keep_patients kp
  where par.plano_id = pa.id
    and pa.paciente_id = kp.id_paciente_uuid;

  delete from public.plano_alimentar pa
  using tmp_keep_patients kp
  where pa.paciente_id = kp.id_paciente_uuid;

  -- Vinculos formais Rayssa
  delete from public.paciente_profissional_vinculo ppv
  using tmp_keep_patients kp
  where ppv.paciente_id = kp.id_paciente_uuid;

  insert into public.paciente_profissional_vinculo (
    paciente_id,
    nutricionista_id,
    tipo_profissional,
    origem,
    ativo
  )
  select
    kp.id_paciente_uuid,
    v_rayssa_id,
    'nutricionista',
    'seed',
    true
  from tmp_keep_patients kp;

  -- Nutricionistas seed excedentes (mantem Rayssa + seed.nutri001-009)
  delete from public.solicitacao_acompanhamento_nutri s
  where s.nutricionista_id not in (select id_nutricionista_uuid from tmp_keep_nutris);

  delete from public.nutri_disponibilidade nd
  where nd.nutricionista_id not in (select id_nutricionista_uuid from tmp_keep_nutris);

  delete from public.consulta c
  where c.nutricionista_id not in (select id_nutricionista_uuid from tmp_keep_nutris);

  delete from public.plano_alimentar pa
  where pa.nutricionista_id not in (select id_nutricionista_uuid from tmp_keep_nutris);

  delete from public.prontuario_nota pn
  where pn.nutricionista_id not in (select id_nutricionista_uuid from tmp_keep_nutris);

  delete from public.mensagem_chat mc
  where mc.nutricionista_id not in (select id_nutricionista_uuid from tmp_keep_nutris);

  delete from public.nutricionista n
  where n.email_acesso like 'seed.nutri%@glicnutri.demo'
    and n.id_nutricionista_uuid not in (select id_nutricionista_uuid from tmp_keep_nutris);

  get diagnostics v_deleted_nutris = row_count;

  -- ========== Re-seed 30 dias (50 pacientes / Rayssa) ==========
  with active_patients as (
    select
      p.id_paciente_uuid,
      v_rayssa_id as nutricionista_id,
      row_number() over (order by p.email_pac) as patient_seq
    from public.paciente p
    join tmp_keep_patients kp on kp.id_paciente_uuid = p.id_paciente_uuid
  ),
  daily_slots as (
    select gs::date as ref_date, extract(day from gs)::int as day_number
    from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
  ),
  glucose_templates as (
    select * from (values
      ('Jejum'::text, time '07:05:00', 96::numeric),
      ('Pos-almoco'::text, time '13:12:00', 142::numeric),
      ('Antes de dormir'::text, time '21:08:00', 124::numeric)
    ) as t(label, slot_time, base_value)
  )
  insert into public.registro_glicemia_manual (
    id_glicemia_manual_uuid, id_paciente_uuid, valor_glicose_mgdl, data, hora, sintomas_associados
  )
  select
    gen_random_uuid(),
    ap.id_paciente_uuid,
    greatest(78, round(
      gt.base_value + ((ap.patient_seq % 9) - 4) + ((ds.day_number % 7) - 3)
      + case gt.label when 'Pos-almoco' then (ap.patient_seq % 5) else 0 end
    )),
    ds.ref_date,
    gt.slot_time + ((((ap.patient_seq + ds.day_number) % 9)::int) * interval '1 minute'),
    'Uso 30d auto seed | Tipo da glicemia: ' || gt.label
  from active_patients ap
  cross join daily_slots ds
  cross join glucose_templates gt;

  with active_patients as (
    select p.id_paciente_uuid, row_number() over (order by p.email_pac) as patient_seq
    from public.paciente p
    join tmp_keep_patients kp on kp.id_paciente_uuid = p.id_paciente_uuid
  ),
  daily_slots as (
    select gs::date as ref_date, extract(day from gs)::int as day_number
    from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
  ),
  meal_templates as (
    select * from (values
      ('cafe'::text, time '07:35:00', 248::numeric, 31::numeric, 12::numeric, 8::numeric,
        jsonb_build_array(
          jsonb_build_object('nome','Pao integral','categoria','Cafe','quantidade_gramas',50,'calorias',128,'carboidratos',24,'proteinas',5,'gorduras',2),
          jsonb_build_object('nome','Ovo cozido','categoria','Proteina','quantidade_gramas',50,'calorias',78,'carboidratos',0.6,'proteinas',6.3,'gorduras',5.3)
        )),
      ('almoco'::text, time '12:28:00', 438::numeric, 46::numeric, 41::numeric, 7::numeric,
        jsonb_build_array(
          jsonb_build_object('nome','Arroz integral','categoria','Almoco','quantidade_gramas',110,'calorias',136,'carboidratos',28,'proteinas',3,'gorduras',1),
          jsonb_build_object('nome','Frango grelhado','categoria','Proteina','quantidade_gramas',120,'calorias',198,'carboidratos',0,'proteinas',37,'gorduras',4.2)
        )),
      ('jantar'::text, time '19:24:00', 292::numeric, 28::numeric, 18::numeric, 9::numeric,
        jsonb_build_array(
          jsonb_build_object('nome','Sopa de legumes','categoria','Jantar','quantidade_gramas',280,'calorias',160,'carboidratos',24,'proteinas',6,'gorduras',4),
          jsonb_build_object('nome','Iogurte natural','categoria','Laticinio','quantidade_gramas',170,'calorias',92,'carboidratos',8,'proteinas',6,'gorduras',4)
        ))
    ) as t(slot_key, slot_time, calorias_total, carboidratos_total, proteinas_total, gorduras_total, alimentos)
  )
  insert into public.refeicao_ia (
    id, paciente_id, foto_url, alimentos,
    carboidratos_total, calorias_total, proteinas_total, gorduras_total,
    confirmado, created_at
  )
  select
    gen_random_uuid(), ap.id_paciente_uuid, 'seed://monthly-usage', mt.alimentos,
    mt.carboidratos_total + ((ap.patient_seq + ds.day_number) % 4),
    mt.calorias_total + (((ap.patient_seq + ds.day_number) % 5) * 12),
    mt.proteinas_total + ((ap.patient_seq + ds.day_number) % 3),
    mt.gorduras_total + (((ap.patient_seq + ds.day_number) % 4) * 0.5),
    true,
    timezone('utc', ds.ref_date::timestamp + mt.slot_time)
  from active_patients ap
  cross join daily_slots ds
  cross join meal_templates mt;

  with active_patients as (
    select p.id_paciente_uuid, row_number() over (order by p.email_pac) as patient_seq
    from public.paciente p
    join tmp_keep_patients kp on kp.id_paciente_uuid = p.id_paciente_uuid
  ),
  daily_slots as (
    select gs::date as ref_date, extract(day from gs)::int as day_number
    from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '1 day') gs
  )
  insert into public.registro_medicacao (
    id_registro_medicacao_uuid, id_paciente_uuid, tipo_registro, descricao,
    nome_medicamento, unidade_medida, quantidade, data, hora,
    uso_continuo, observacao, id_registro_legado
  )
  select
    gen_random_uuid(), ap.id_paciente_uuid, 'medicine', 'Metformina apos cafe',
    'Metformina', 'mg',
    case when (ap.patient_seq + ds.day_number) % 4 = 0 then '500' else '850' end,
    ds.ref_date, time '08:00:00', true, 'Uso continuo | seed 30d',
    'seed-30d-med-' || ap.id_paciente_uuid::text || '-' || ds.ref_date::text
  from active_patients ap
  cross join daily_slots ds;

  with active_patients as (
    select
      p.id_paciente_uuid,
      v_rayssa_id as nutricionista_id,
      row_number() over (order by p.email_pac) as patient_seq
    from public.paciente p
    join tmp_keep_patients kp on kp.id_paciente_uuid = p.id_paciente_uuid
  ),
  interaction_days as (
    select gs::date as ref_date, extract(day from gs)::int as day_number
    from generate_series(v_start_date::timestamp, v_end_date::timestamp, interval '3 day') gs
  )
  insert into public.mensagem_chat (paciente_id, nutricionista_id, autor_role, texto, created_at)
  select
    ap.id_paciente_uuid, ap.nutricionista_id, 'paciente',
    'Registrei glicemias e refeicoes do dia. [hist-seed-30d]',
    timezone('utc', iday.ref_date::timestamp + time '09:12:00')
  from active_patients ap
  join interaction_days iday on true
  union all
  select
    ap.id_paciente_uuid, ap.nutricionista_id, 'nutricionista',
    'Recebi seus registros. Continue o acompanhamento. [hist-seed-30d]',
    timezone('utc', iday.ref_date::timestamp + time '16:40:00')
  from active_patients ap
  join interaction_days iday on true;

  insert into public.consulta (
    id, nutricionista_id, paciente_id, scheduled_at, status, motivo,
    canal, tipo_consulta, convenio, valor_centavos
  )
  select
    gen_random_uuid(),
    v_rayssa_id,
    x.id_paciente_uuid,
    timezone('utc', now())
      + ((x.rn % 14 - 7) * interval '1 day')
      + (x.rn * interval '23 minutes'),
    case when x.rn % 3 = 0 then 'done' else 'scheduled' end,
    'Acompanhamento glicemico',
    'google_meet', 'Teleconsulta', 'Particular', 12000
  from (
    select
      kp.id_paciente_uuid,
      row_number() over (order by p.email_pac) as rn
    from tmp_keep_patients kp
    join public.paciente p on p.id_paciente_uuid = kp.id_paciente_uuid
  ) x;

  update public.paciente p
     set data_hora_ultima_atualizacao = timezone('utc', now())
  from tmp_keep_patients kp
  where p.id_paciente_uuid = kp.id_paciente_uuid;

  raise notice 'Pacientes seed removidos: %', v_deleted_patients;
  raise notice 'Nutricionistas seed removidos: %', v_deleted_nutris;
  raise notice 'Mantidos: 50 pacientes na carteira de rayssa.lira@gmail.com';
  raise notice 'Nutricionistas mantidos: % (Rayssa + seed.nutri001-009)',
    (select count(*) from tmp_keep_nutris);
  raise notice 'Historico app re-seed: % a %', v_start_date, v_end_date;
end $$;
