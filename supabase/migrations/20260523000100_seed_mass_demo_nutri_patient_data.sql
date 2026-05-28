create extension if not exists pgcrypto;

do $$
declare
  v_seed_password constant text := '123456';
begin
  delete from public.consulta_notificacao cn
  using public.consulta c
  where cn.consulta_id = c.id
    and (
      c.paciente_id in (
        select id_paciente_uuid
        from public.paciente
        where email_pac like 'seed.paciente%@glicnutri.demo'
      )
      or c.nutricionista_id in (
        select id_nutricionista_uuid
        from public.nutricionista
        where email_acesso like 'seed.nutri%@glicnutri.demo'
      )
    );

  delete from public.prontuario_nota
  where paciente_id in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  );

  delete from public.plano_alimentar
  where paciente_id in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  );

  delete from public.consulta
  where paciente_id in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  )
  or nutricionista_id in (
    select id_nutricionista_uuid
    from public.nutricionista
    where email_acesso like 'seed.nutri%@glicnutri.demo'
  );

  delete from public.nutri_disponibilidade
  where nutricionista_id in (
    select id_nutricionista_uuid
    from public.nutricionista
    where email_acesso like 'seed.nutri%@glicnutri.demo'
  );

  delete from public.solicitacao_acompanhamento_nutri
  where paciente_id in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  )
  or nutricionista_id in (
    select id_nutricionista_uuid
    from public.nutricionista
    where email_acesso like 'seed.nutri%@glicnutri.demo'
  );

  delete from public.refeicao_ia
  where paciente_id in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  );

  delete from public.registro_medicacao
  where id_paciente_uuid in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  );

  delete from public.registro_glicemia_manual
  where id_paciente_uuid in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  );

  delete from public.paciente
  where email_pac like 'seed.paciente%@glicnutri.demo';

  delete from public.nutricionista
  where email_acesso like 'seed.nutri%@glicnutri.demo';

  insert into public.nutricionista (
    id_nutricionista_uuid,
    nome_completo_nutri,
    crm_numero,
    email_acesso,
    senha_nutri,
    data_nascimento,
    especialidade,
    especialidades,
    bio_resumo,
    valor_consulta_centavos,
    meet_link_padrao,
    aceita_convenio,
    formacao_resumo
  )
  select
    gen_random_uuid(),
    'Nutricionista ' || lpad(gs::text, 3, '0'),
    lpad((10000 + gs)::text, 5, '0') || '/' ||
      (array['SP','RJ','MG','PR','RS','SC','BA','PE','GO','DF'])[((gs - 1) % 10) + 1],
    'seed.nutri' || lpad(gs::text, 3, '0') || '@glicnutri.demo',
    v_seed_password,
    date '1980-01-01' + (((gs - 1) % 9000) * interval '1 day'),
    (array[
      'Nutricao clinica',
      'Controle glicemico',
      'Nutricao esportiva',
      'Emagrecimento',
      'Reeducacao alimentar'
    ])[((gs - 1) % 5) + 1],
    array[
      'Nutricao clinica',
      'Controle glicemico',
      'Nutricao esportiva'
    ],
    'Atendimento por teleconsulta com foco em alimentacao personalizada, adesao e acompanhamento continuo.',
    9000 + (((gs - 1) % 8) * 1500),
    'https://meet.google.com/seed-' || lpad(gs::text, 3, '0') || '-glic',
    (gs % 4) <> 0,
    'Graduacao em Nutricao e experiencia em acompanhamento clinico e controle glicemico.'
  from generate_series(1, 100) gs;

  insert into public.paciente (
    id_paciente_uuid,
    nome_completo,
    cpf_paciente,
    email_pac,
    senha_pac,
    sexo_biologico,
    telefone,
    data_nascimento,
    cep,
    logradouro,
    numero,
    bairro,
    cidade,
    uf,
    excluido,
    data_exclusao,
    id_nutricionista_uuid
  )
  select
    gen_random_uuid(),
    'Paciente ' || lpad(gs::text, 3, '0'),
    lpad((10000000000 + gs)::text, 11, '0'),
    'seed.paciente' || lpad(gs::text, 3, '0') || '@glicnutri.demo',
    v_seed_password,
    case when gs % 2 = 0 then 'Feminino' else 'Masculino' end,
    '(21) 9' || lpad((20000000 + gs)::text, 8, '0'),
    date '1990-01-01' + (((gs - 1) % 10000) * interval '1 day'),
    '01001000',
    'Rua Demo ' || lpad(gs::text, 3, '0'),
    ((gs % 900) + 1)::text,
    'Centro',
    (array['Sao Paulo','Rio de Janeiro','Belo Horizonte','Curitiba','Porto Alegre'])[((gs - 1) % 5) + 1],
    (array['SP','RJ','MG','PR','RS'])[((gs - 1) % 5) + 1],
    false,
    null,
    n.id_nutricionista_uuid
  from generate_series(1, 500) gs
  join public.nutricionista n
    on n.email_acesso = 'seed.nutri' || lpad((((gs - 1) / 5) + 1)::text, 3, '0') || '@glicnutri.demo';

  insert into public.nutri_disponibilidade (
    nutricionista_id,
    weekday,
    start_time,
    end_time,
    slot_minutes,
    active
  )
  select
    n.id_nutricionista_uuid,
    weekday_slot.weekday,
    weekday_slot.start_time,
    weekday_slot.end_time,
    30,
    true
  from public.nutricionista n
  cross join (
    select weekday, start_time, end_time
    from (
      values
        (1::smallint, time '08:00:00', time '12:00:00'),
        (1::smallint, time '14:00:00', time '18:00:00'),
        (2::smallint, time '08:00:00', time '12:00:00'),
        (2::smallint, time '14:00:00', time '18:00:00'),
        (3::smallint, time '08:00:00', time '12:00:00'),
        (3::smallint, time '14:00:00', time '18:00:00'),
        (4::smallint, time '08:00:00', time '12:00:00'),
        (4::smallint, time '14:00:00', time '18:00:00'),
        (5::smallint, time '08:00:00', time '12:00:00'),
        (5::smallint, time '14:00:00', time '18:00:00')
    ) as t(weekday, start_time, end_time)
  ) weekday_slot
  where n.email_acesso like 'seed.nutri%@glicnutri.demo';

  with synthetic_patients as (
    select
      p.id_paciente_uuid,
      p.id_nutricionista_uuid,
      p.nome_completo,
      p.email_pac,
      row_number() over (order by p.email_pac) as rn
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
  )
  insert into public.consulta (
    id,
    nutricionista_id,
    paciente_id,
    scheduled_at,
    status,
    motivo,
    observacoes_nutri,
    meet_link,
    canal,
    tipo_consulta,
    convenio,
    especialidade,
    valor_centavos,
    notificacao_paciente_lida,
    notificacao_nutri_lida
  )
  select
    gen_random_uuid(),
    sp.id_nutricionista_uuid,
    sp.id_paciente_uuid,
    date_trunc('hour', timezone('utc', now()))
      + (((sp.rn % 21) - 10) * interval '1 day')
      + (((sp.rn % 8) + 8) * interval '1 hour'),
    case
      when sp.rn % 5 = 0 then 'done'
      when sp.rn % 7 = 0 then 'confirmed'
      else 'scheduled'
    end,
    case
      when sp.rn % 4 = 0 then 'Ajuste do plano alimentar'
      when sp.rn % 4 = 1 then 'Consulta inicial'
      when sp.rn % 4 = 2 then 'Revisao de exames'
      else 'Acompanhamento glicemico'
    end,
    'Seed automatico para testes de agenda e prontuario.',
    'https://meet.google.com/consulta-' || lpad(sp.rn::text, 4, '0'),
    'google_meet',
    'Teleconsulta',
    case when sp.rn % 6 = 0 then 'Convenio' else 'Particular' end,
    case
      when sp.rn % 5 = 0 then 'Nutricao esportiva'
      when sp.rn % 5 = 1 then 'Controle glicemico'
      when sp.rn % 5 = 2 then 'Emagrecimento'
      when sp.rn % 5 = 3 then 'Reeducacao alimentar'
      else 'Nutricao clinica'
    end,
    12000 + ((sp.rn % 6) * 1000),
    sp.rn % 3 = 0,
    sp.rn % 4 = 0
  from synthetic_patients sp;

  insert into public.consulta_notificacao (
    consulta_id,
    destinatario_tipo,
    destinatario_id,
    evento,
    titulo,
    mensagem,
    lida
  )
  select
    c.id,
    'paciente',
    c.paciente_id,
    case when c.status = 'done' then 'confirmada' else 'agendada' end,
    case when c.status = 'done' then 'Consulta registrada' else 'Consulta agendada' end,
    'Sua consulta foi registrada automaticamente para fins de demonstracao.',
    c.notificacao_paciente_lida
  from public.consulta c
  where c.paciente_id in (
    select id_paciente_uuid
    from public.paciente
    where email_pac like 'seed.paciente%@glicnutri.demo'
  );

  with synthetic_patients as (
    select
      p.id_paciente_uuid,
      p.id_nutricionista_uuid,
      row_number() over (order by p.email_pac) as rn
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
  )
  insert into public.plano_alimentar (
    nutricionista_id,
    paciente_id,
    titulo,
    descricao,
    metas,
    inicio_em,
    fim_em,
    ativo
  )
  select
    sp.id_nutricionista_uuid,
    sp.id_paciente_uuid,
    'Plano alimentar ' || lpad(sp.rn::text, 3, '0'),
    'Plano com distribuicao de refeicoes, foco em adesao e monitoramento de glicose.',
    jsonb_build_object(
      'agua_litros', 2 + (sp.rn % 2),
      'refeicoes_dia', 5,
      'carboidratos_meta_g', 180 + ((sp.rn % 5) * 10),
      'proteina_meta_g', 80 + ((sp.rn % 4) * 5)
    ),
    current_date - ((sp.rn % 20)::int),
    current_date + 60,
    true
  from synthetic_patients sp;

  with synthetic_patients as (
    select
      p.id_paciente_uuid,
      p.id_nutricionista_uuid,
      row_number() over (order by p.email_pac) as rn
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
  ),
  latest_consulta as (
    select distinct on (c.paciente_id)
      c.paciente_id,
      c.id
    from public.consulta c
    where c.paciente_id in (select id_paciente_uuid from synthetic_patients)
    order by c.paciente_id, c.scheduled_at desc
  )
  insert into public.prontuario_nota (
    nutricionista_id,
    paciente_id,
    consulta_id,
    texto
  )
  select
    sp.id_nutricionista_uuid,
    sp.id_paciente_uuid,
    lc.id,
    'Paciente em acompanhamento. Reforcada adesao ao plano, rotina de sono e revisao de sintomas associados.'
  from synthetic_patients sp
  left join latest_consulta lc on lc.paciente_id = sp.id_paciente_uuid;

  with synthetic_patients as (
    select
      p.id_paciente_uuid,
      row_number() over (order by p.email_pac) as rn
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
  ),
  glucose_slots as (
    select
      sp.id_paciente_uuid,
      sp.rn,
      gs.slot_index,
      current_date - ((gs.slot_index / 3)::int) as reading_date,
      (array['07:00:00','13:00:00','21:00:00'])[(gs.slot_index % 3) + 1]::time as reading_time
    from synthetic_patients sp
    cross join generate_series(0, 5) as gs(slot_index)
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
    gs.id_paciente_uuid,
    88 + ((gs.rn % 40) + (gs.slot_index * 7)),
    gs.reading_date,
    gs.reading_time,
    case
      when gs.slot_index % 3 = 0 then 'Seed massivo | Tipo da glicemia: Jejum'
      when gs.slot_index % 3 = 1 then 'Seed massivo | Tipo da glicemia: Pos-almoco'
      else 'Seed massivo | Tipo da glicemia: Antes de dormir'
    end
  from glucose_slots gs;

  with synthetic_patients as (
    select
      p.id_paciente_uuid,
      row_number() over (order by p.email_pac) as rn
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
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
    sp.id_paciente_uuid,
    case when med.slot_index = 2 then 'insulin' else 'medicine' end,
    case
      when med.slot_index = 0 then 'Metformina apos cafe da manha'
      when med.slot_index = 1 then 'Losartana apos almoco'
      else 'Insulina basal noturna'
    end,
    case
      when med.slot_index = 0 then 'Metformina'
      when med.slot_index = 1 then 'Losartana'
      else 'Insulina Glargina'
    end,
    case
      when med.slot_index = 2 then 'UI'
      else 'mg'
    end,
    case
      when med.slot_index = 0 then '850'
      when med.slot_index = 1 then '50'
      else (10 + (sp.rn % 8))::text
    end,
    current_date - (med.slot_index::int),
    (array['08:00:00','13:30:00','22:00:00'])[med.slot_index + 1]::time,
    null,
    true,
    case
      when med.slot_index = 2 then E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno'
      else 'Seed massivo de medicacoes'
    end,
    'seed-med-' || lpad(sp.rn::text, 4, '0') || '-' || med.slot_index::text
  from synthetic_patients sp
  cross join generate_series(0, 2) as med(slot_index);

  with synthetic_patients as (
    select
      p.id_paciente_uuid,
      row_number() over (order by p.email_pac) as rn
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
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
    sp.id_paciente_uuid,
    null,
    case meal.slot_index
      when 0 then
        jsonb_build_array(
          jsonb_build_object('nome', 'Pao integral', 'categoria', 'Cafe da manha', 'quantidade_gramas', 50, 'calorias', 128, 'carboidratos', 24, 'proteinas', 5, 'gorduras', 2),
          jsonb_build_object('nome', 'Ovo cozido', 'categoria', 'Proteina', 'quantidade_gramas', 50, 'calorias', 78, 'carboidratos', 0.6, 'proteinas', 6, 'gorduras', 5),
          jsonb_build_object('nome', 'Cafe sem acucar', 'categoria', 'Bebida', 'quantidade_gramas', 180, 'calorias', 4, 'carboidratos', 0, 'proteinas', 0, 'gorduras', 0)
        )
      when 1 then
        jsonb_build_array(
          jsonb_build_object('nome', 'Arroz integral', 'categoria', 'Almoco', 'quantidade_gramas', 110, 'calorias', 136, 'carboidratos', 28, 'proteinas', 3, 'gorduras', 1),
          jsonb_build_object('nome', 'Feijao carioca', 'categoria', 'Leguminosa', 'quantidade_gramas', 90, 'calorias', 68, 'carboidratos', 13, 'proteinas', 4.5, 'gorduras', 0.4),
          jsonb_build_object('nome', 'Frango grelhado', 'categoria', 'Proteina', 'quantidade_gramas', 120, 'calorias', 198, 'carboidratos', 0, 'proteinas', 37, 'gorduras', 4.2)
        )
      else
        jsonb_build_array(
          jsonb_build_object('nome', 'Sopa de legumes', 'categoria', 'Jantar', 'quantidade_gramas', 280, 'calorias', 160, 'carboidratos', 24, 'proteinas', 6, 'gorduras', 4),
          jsonb_build_object('nome', 'Iogurte natural', 'categoria', 'Laticinio', 'quantidade_gramas', 170, 'calorias', 92, 'carboidratos', 8, 'proteinas', 6, 'gorduras', 4)
        )
    end,
    case meal.slot_index when 0 then 24.6 when 1 then 41 when 2 then 32 end,
    case meal.slot_index when 0 then 210 when 1 then 402 when 2 then 252 end,
    case meal.slot_index when 0 then 11 when 1 then 44.5 when 2 then 12 end,
    case meal.slot_index when 0 then 7 when 1 then 5.6 when 2 then 8 end,
    true,
    date_trunc('day', timezone('utc', now()))
      - ((sp.rn % 4) * interval '1 day')
      + case meal.slot_index
          when 0 then interval '7 hours 30 minutes'
          when 1 then interval '12 hours 30 minutes'
          else interval '19 hours 30 minutes'
        end
  from synthetic_patients sp
  cross join generate_series(0, 2) as meal(slot_index);

  with synthetic_patients as (
    select
      p.id_paciente_uuid,
      p.id_nutricionista_uuid,
      row_number() over (order by p.email_pac) as rn
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
  )
  insert into public.solicitacao_acompanhamento_nutri (
    nutricionista_id,
    paciente_id,
    mensagem,
    status,
    created_at
  )
  select
    sp.id_nutricionista_uuid,
    sp.id_paciente_uuid,
    'Solicitacao automatica de acompanhamento para ambiente de demonstracao.',
    case
      when sp.rn % 6 = 0 then 'approved'
      when sp.rn % 7 = 0 then 'rejected'
      else 'pending'
    end,
    timezone('utc', now()) - ((sp.rn % 15) * interval '1 day')
  from synthetic_patients sp
  where sp.rn <= 180;

  raise notice 'Seed massivo concluido: 100 nutricionistas e 500 pacientes com registros.';
end;
$$;
