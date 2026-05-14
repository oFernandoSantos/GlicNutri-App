do $$
declare
  v_patient_id constant uuid := 'dfb3e6cd-b121-4abc-8dc4-1af226064df5';
begin
  if not exists (
    select 1
    from public.paciente p
    where p.id_paciente_uuid = v_patient_id
      and coalesce(p.excluido, false) = false
  ) then
    raise notice 'Paciente % nao encontrado. Seed ignorado.', v_patient_id;
    return;
  end if;

  delete from public.registro_glicemia_manual
  where id_paciente_uuid = v_patient_id
    and data between date '2026-04-30' and date '2026-05-06';

  delete from public.registro_medicacao
  where id_paciente_uuid = v_patient_id
    and data between date '2026-04-30' and date '2026-05-06';

  delete from public.refeicao_ia
  where paciente_id = v_patient_id
    and created_at >= timestamp '2026-04-30 00:00:00'
    and created_at < timestamp '2026-05-07 00:00:00';

  insert into public.registro_glicemia_manual (
    id_glicemia_manual_uuid,
    id_paciente_uuid,
    valor_glicose_mgdl,
    data,
    hora,
    sintomas_associados
  )
  values
    (gen_random_uuid(), v_patient_id, 106, date '2026-04-30', time '07:10:00', 'Seed 7 dias | Tipo da glicemia: Jejum'),
    (gen_random_uuid(), v_patient_id, 142, date '2026-04-30', time '13:20:00', 'Seed 7 dias | Tipo da glicemia: Pos-almoco'),
    (gen_random_uuid(), v_patient_id, 124, date '2026-04-30', time '21:10:00', 'Seed 7 dias | Tipo da glicemia: Antes de dormir'),
    (gen_random_uuid(), v_patient_id, 102, date '2026-05-01', time '07:05:00', 'Seed 7 dias | Tipo da glicemia: Jejum'),
    (gen_random_uuid(), v_patient_id, 148, date '2026-05-01', time '13:15:00', 'Seed 7 dias | Tipo da glicemia: Pos-almoco'),
    (gen_random_uuid(), v_patient_id, 126, date '2026-05-01', time '21:05:00', 'Seed 7 dias | Tipo da glicemia: Antes de dormir'),
    (gen_random_uuid(), v_patient_id, 109, date '2026-05-02', time '07:12:00', 'Seed 7 dias | Tipo da glicemia: Jejum'),
    (gen_random_uuid(), v_patient_id, 151, date '2026-05-02', time '13:18:00', 'Seed 7 dias | Tipo da glicemia: Pos-almoco'),
    (gen_random_uuid(), v_patient_id, 128, date '2026-05-02', time '21:18:00', 'Seed 7 dias | Tipo da glicemia: Antes de dormir'),
    (gen_random_uuid(), v_patient_id, 104, date '2026-05-03', time '07:08:00', 'Seed 7 dias | Tipo da glicemia: Jejum'),
    (gen_random_uuid(), v_patient_id, 139, date '2026-05-03', time '13:22:00', 'Seed 7 dias | Tipo da glicemia: Pos-almoco'),
    (gen_random_uuid(), v_patient_id, 121, date '2026-05-03', time '21:00:00', 'Seed 7 dias | Tipo da glicemia: Antes de dormir'),
    (gen_random_uuid(), v_patient_id, 101, date '2026-05-04', time '07:00:00', 'Seed 7 dias | Tipo da glicemia: Jejum'),
    (gen_random_uuid(), v_patient_id, 145, date '2026-05-04', time '13:12:00', 'Seed 7 dias | Tipo da glicemia: Pos-almoco'),
    (gen_random_uuid(), v_patient_id, 123, date '2026-05-04', time '21:12:00', 'Seed 7 dias | Tipo da glicemia: Antes de dormir'),
    (gen_random_uuid(), v_patient_id, 108, date '2026-05-05', time '07:14:00', 'Seed 7 dias | Tipo da glicemia: Jejum'),
    (gen_random_uuid(), v_patient_id, 150, date '2026-05-05', time '13:25:00', 'Seed 7 dias | Tipo da glicemia: Pos-almoco'),
    (gen_random_uuid(), v_patient_id, 127, date '2026-05-05', time '21:20:00', 'Seed 7 dias | Tipo da glicemia: Antes de dormir'),
    (gen_random_uuid(), v_patient_id, 103, date '2026-05-06', time '07:06:00', 'Seed 7 dias | Tipo da glicemia: Jejum'),
    (gen_random_uuid(), v_patient_id, 143, date '2026-05-06', time '13:16:00', 'Seed 7 dias | Tipo da glicemia: Pos-almoco'),
    (gen_random_uuid(), v_patient_id, 122, date '2026-05-06', time '21:08:00', 'Seed 7 dias | Tipo da glicemia: Antes de dormir');

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
  values
    (gen_random_uuid(), v_patient_id, 'medicine', 'Metformina apos cafe da manha', 'Metformina', 'mg', '850', date '2026-04-30', time '08:00:00', null, true, 'Uso cronico para controle glicemico', 'seed-med-2026-04-30'),
    (gen_random_uuid(), v_patient_id, 'medicine', 'Metformina apos cafe da manha', 'Metformina', 'mg', '850', date '2026-05-01', time '08:05:00', null, true, 'Uso cronico para controle glicemico', 'seed-med-2026-05-01'),
    (gen_random_uuid(), v_patient_id, 'medicine', 'Metformina apos cafe da manha', 'Metformina', 'mg', '850', date '2026-05-02', time '08:00:00', null, true, 'Uso cronico para controle glicemico', 'seed-med-2026-05-02'),
    (gen_random_uuid(), v_patient_id, 'medicine', 'Metformina apos cafe da manha', 'Metformina', 'mg', '850', date '2026-05-03', time '08:10:00', null, true, 'Uso cronico para controle glicemico', 'seed-med-2026-05-03'),
    (gen_random_uuid(), v_patient_id, 'medicine', 'Metformina apos cafe da manha', 'Metformina', 'mg', '850', date '2026-05-04', time '08:00:00', null, true, 'Uso cronico para controle glicemico', 'seed-med-2026-05-04'),
    (gen_random_uuid(), v_patient_id, 'medicine', 'Metformina apos cafe da manha', 'Metformina', 'mg', '850', date '2026-05-05', time '08:07:00', null, true, 'Uso cronico para controle glicemico', 'seed-med-2026-05-05'),
    (gen_random_uuid(), v_patient_id, 'medicine', 'Metformina apos cafe da manha', 'Metformina', 'mg', '850', date '2026-05-06', time '08:03:00', null, true, 'Uso cronico para controle glicemico', 'seed-med-2026-05-06'),
    (gen_random_uuid(), v_patient_id, 'insulin', 'Insulina basal noturna', 'Insulina Glargina', 'UI', '12', date '2026-04-30', time '22:00:00', null, true, E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Aplicacao abdominal', 'seed-ins-2026-04-30'),
    (gen_random_uuid(), v_patient_id, 'insulin', 'Insulina basal noturna', 'Insulina Glargina', 'UI', '12', date '2026-05-01', time '22:00:00', null, true, E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Aplicacao abdominal', 'seed-ins-2026-05-01'),
    (gen_random_uuid(), v_patient_id, 'insulin', 'Insulina basal noturna', 'Insulina Glargina', 'UI', '12', date '2026-05-02', time '22:05:00', null, true, E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Aplicacao abdominal', 'seed-ins-2026-05-02'),
    (gen_random_uuid(), v_patient_id, 'insulin', 'Insulina basal noturna', 'Insulina Glargina', 'UI', '11', date '2026-05-03', time '22:00:00', null, true, E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Aplicacao abdominal', 'seed-ins-2026-05-03'),
    (gen_random_uuid(), v_patient_id, 'insulin', 'Insulina basal noturna', 'Insulina Glargina', 'UI', '12', date '2026-05-04', time '22:02:00', null, true, E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Aplicacao abdominal', 'seed-ins-2026-05-04'),
    (gen_random_uuid(), v_patient_id, 'insulin', 'Insulina basal noturna', 'Insulina Glargina', 'UI', '12', date '2026-05-05', time '22:04:00', null, true, E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Aplicacao abdominal', 'seed-ins-2026-05-05'),
    (gen_random_uuid(), v_patient_id, 'insulin', 'Insulina basal noturna', 'Insulina Glargina', 'UI', '12', date '2026-05-06', time '22:01:00', null, true, E'Categoria da insulina: Basal\nObjetivo do uso: Controle noturno\nObservacoes: Aplicacao abdominal', 'seed-ins-2026-05-06');

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
  values
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Pao integral","categoria":"Cafe da manha","quantidade_gramas":50,"calorias":128,"carboidratos":24,"proteinas":5,"gorduras":2},{"nome":"Ovo mexido","categoria":"Proteina","quantidade_gramas":60,"calorias":90,"carboidratos":1,"proteinas":7,"gorduras":6},{"nome":"Cafe sem acucar","categoria":"Bebida","quantidade_gramas":200,"calorias":4,"carboidratos":0,"proteinas":0,"gorduras":0}]'::jsonb,
      25, 222, 12, 8, true, timestamp '2026-04-30 07:40:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Arroz integral","categoria":"Almoco","quantidade_gramas":120,"calorias":148,"carboidratos":31,"proteinas":3,"gorduras":1},{"nome":"Feijao carioca","categoria":"Leguminosa","quantidade_gramas":100,"calorias":76,"carboidratos":14,"proteinas":5,"gorduras":0.5},{"nome":"Peito de frango grelhado","categoria":"Proteina","quantidade_gramas":130,"calorias":215,"carboidratos":0,"proteinas":40,"gorduras":5},{"nome":"Salada verde","categoria":"Vegetais","quantidade_gramas":80,"calorias":20,"carboidratos":3,"proteinas":1,"gorduras":0}]'::jsonb,
      48, 459, 49, 6.5, true, timestamp '2026-04-30 12:25:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Sopa de legumes","categoria":"Jantar","quantidade_gramas":300,"calorias":160,"carboidratos":24,"proteinas":6,"gorduras":4},{"nome":"Iogurte natural","categoria":"Laticinio","quantidade_gramas":170,"calorias":92,"carboidratos":8,"proteinas":6,"gorduras":4}]'::jsonb,
      32, 252, 12, 8, true, timestamp '2026-04-30 19:30:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Tapioca","categoria":"Cafe da manha","quantidade_gramas":80,"calorias":136,"carboidratos":34,"proteinas":0,"gorduras":0},{"nome":"Queijo branco","categoria":"Laticinio","quantidade_gramas":40,"calorias":106,"carboidratos":1,"proteinas":7,"gorduras":8},{"nome":"Mamao","categoria":"Fruta","quantidade_gramas":100,"calorias":40,"carboidratos":10,"proteinas":0.5,"gorduras":0}]'::jsonb,
      45, 282, 7.5, 8, true, timestamp '2026-05-01 07:35:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Arroz integral","categoria":"Almoco","quantidade_gramas":110,"calorias":136,"carboidratos":28,"proteinas":3,"gorduras":1},{"nome":"Lentilha","categoria":"Leguminosa","quantidade_gramas":90,"calorias":104,"carboidratos":18,"proteinas":8,"gorduras":0.4},{"nome":"Carne magra","categoria":"Proteina","quantidade_gramas":120,"calorias":230,"carboidratos":0,"proteinas":32,"gorduras":10}]'::jsonb,
      46, 470, 43, 11.4, true, timestamp '2026-05-01 12:30:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Omelete","categoria":"Jantar","quantidade_gramas":120,"calorias":180,"carboidratos":2,"proteinas":14,"gorduras":13},{"nome":"Batata-doce","categoria":"Carboidrato","quantidade_gramas":100,"calorias":86,"carboidratos":20,"proteinas":1.6,"gorduras":0.1},{"nome":"Salada de tomate","categoria":"Vegetais","quantidade_gramas":70,"calorias":15,"carboidratos":3,"proteinas":0.7,"gorduras":0}]'::jsonb,
      25, 281, 16.3, 13.1, true, timestamp '2026-05-01 19:20:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Aveia com banana","categoria":"Cafe da manha","quantidade_gramas":180,"calorias":210,"carboidratos":38,"proteinas":6,"gorduras":4},{"nome":"Leite desnatado","categoria":"Bebida","quantidade_gramas":200,"calorias":70,"carboidratos":10,"proteinas":7,"gorduras":0.5}]'::jsonb,
      48, 280, 13, 4.5, true, timestamp '2026-05-02 07:45:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Macarrao integral","categoria":"Almoco","quantidade_gramas":120,"calorias":188,"carboidratos":37,"proteinas":7,"gorduras":1.3},{"nome":"Molho de tomate","categoria":"Molho","quantidade_gramas":80,"calorias":34,"carboidratos":7,"proteinas":1,"gorduras":0.2},{"nome":"Frango desfiado","categoria":"Proteina","quantidade_gramas":100,"calorias":165,"carboidratos":0,"proteinas":31,"gorduras":3.6}]'::jsonb,
      44, 387, 39, 5.1, true, timestamp '2026-05-02 12:40:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Sanduiche integral","categoria":"Jantar","quantidade_gramas":160,"calorias":260,"carboidratos":28,"proteinas":16,"gorduras":9},{"nome":"Suco natural sem acucar","categoria":"Bebida","quantidade_gramas":200,"calorias":52,"carboidratos":12,"proteinas":0,"gorduras":0}]'::jsonb,
      40, 312, 16, 9, true, timestamp '2026-05-02 19:25:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Pao integral","categoria":"Cafe da manha","quantidade_gramas":50,"calorias":128,"carboidratos":24,"proteinas":5,"gorduras":2},{"nome":"Ricota","categoria":"Laticinio","quantidade_gramas":45,"calorias":62,"carboidratos":2,"proteinas":5,"gorduras":4},{"nome":"Pera","categoria":"Fruta","quantidade_gramas":110,"calorias":63,"carboidratos":17,"proteinas":0.4,"gorduras":0.1}]'::jsonb,
      43, 253, 10.4, 6.1, true, timestamp '2026-05-03 08:00:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Quinoa","categoria":"Almoco","quantidade_gramas":100,"calorias":120,"carboidratos":21,"proteinas":4,"gorduras":2},{"nome":"Feijao preto","categoria":"Leguminosa","quantidade_gramas":90,"calorias":69,"carboidratos":12,"proteinas":4.5,"gorduras":0.5},{"nome":"Peixe grelhado","categoria":"Proteina","quantidade_gramas":130,"calorias":208,"carboidratos":0,"proteinas":28,"gorduras":10}]'::jsonb,
      33, 397, 36.5, 12.5, true, timestamp '2026-05-03 12:20:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Creme de abobora","categoria":"Jantar","quantidade_gramas":280,"calorias":150,"carboidratos":24,"proteinas":4,"gorduras":4},{"nome":"Queijo cottage","categoria":"Laticinio","quantidade_gramas":80,"calorias":78,"carboidratos":3,"proteinas":9,"gorduras":3}]'::jsonb,
      27, 228, 13, 7, true, timestamp '2026-05-03 19:35:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Iogurte natural","categoria":"Cafe da manha","quantidade_gramas":170,"calorias":92,"carboidratos":8,"proteinas":6,"gorduras":4},{"nome":"Granola sem acucar","categoria":"Cereal","quantidade_gramas":30,"calorias":120,"carboidratos":18,"proteinas":3,"gorduras":4},{"nome":"Morango","categoria":"Fruta","quantidade_gramas":100,"calorias":32,"carboidratos":7,"proteinas":0.7,"gorduras":0.3}]'::jsonb,
      33, 244, 9.7, 8.3, true, timestamp '2026-05-04 07:30:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Arroz integral","categoria":"Almoco","quantidade_gramas":100,"calorias":124,"carboidratos":26,"proteinas":2.7,"gorduras":1},{"nome":"Feijao carioca","categoria":"Leguminosa","quantidade_gramas":90,"calorias":68,"carboidratos":13,"proteinas":4.5,"gorduras":0.4},{"nome":"File de frango","categoria":"Proteina","quantidade_gramas":120,"calorias":198,"carboidratos":0,"proteinas":37,"gorduras":4.2},{"nome":"Brocolis","categoria":"Vegetais","quantidade_gramas":80,"calorias":28,"carboidratos":5,"proteinas":2.4,"gorduras":0.3}]'::jsonb,
      44, 418, 46.6, 5.9, true, timestamp '2026-05-04 12:28:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Wrap integral","categoria":"Jantar","quantidade_gramas":140,"calorias":240,"carboidratos":26,"proteinas":14,"gorduras":8},{"nome":"Cha sem acucar","categoria":"Bebida","quantidade_gramas":200,"calorias":2,"carboidratos":0,"proteinas":0,"gorduras":0}]'::jsonb,
      26, 242, 14, 8, true, timestamp '2026-05-04 19:15:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Cuscuz","categoria":"Cafe da manha","quantidade_gramas":100,"calorias":112,"carboidratos":25,"proteinas":2.5,"gorduras":0.7},{"nome":"Ovo cozido","categoria":"Proteina","quantidade_gramas":50,"calorias":78,"carboidratos":0.6,"proteinas":6.3,"gorduras":5.3},{"nome":"Melancia","categoria":"Fruta","quantidade_gramas":120,"calorias":36,"carboidratos":9,"proteinas":0.7,"gorduras":0.2}]'::jsonb,
      34.6, 226, 9.5, 6.2, true, timestamp '2026-05-05 07:42:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Pure de batata-doce","categoria":"Almoco","quantidade_gramas":130,"calorias":114,"carboidratos":27,"proteinas":2,"gorduras":0.1},{"nome":"Feijao fradinho","categoria":"Leguminosa","quantidade_gramas":90,"calorias":102,"carboidratos":18,"proteinas":6,"gorduras":0.5},{"nome":"Patinho moido","categoria":"Proteina","quantidade_gramas":120,"calorias":250,"carboidratos":0,"proteinas":29,"gorduras":15}]'::jsonb,
      45, 466, 37, 15.6, true, timestamp '2026-05-05 12:34:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Canja de galinha","categoria":"Jantar","quantidade_gramas":300,"calorias":190,"carboidratos":20,"proteinas":14,"gorduras":6},{"nome":"Laranja","categoria":"Fruta","quantidade_gramas":120,"calorias":56,"carboidratos":14,"proteinas":1,"gorduras":0.2}]'::jsonb,
      34, 246, 15, 6.2, true, timestamp '2026-05-05 19:40:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Pao integral","categoria":"Cafe da manha","quantidade_gramas":50,"calorias":128,"carboidratos":24,"proteinas":5,"gorduras":2},{"nome":"Pasta de ricota","categoria":"Laticinio","quantidade_gramas":35,"calorias":60,"carboidratos":2,"proteinas":4,"gorduras":4},{"nome":"Cafe com leite sem acucar","categoria":"Bebida","quantidade_gramas":200,"calorias":48,"carboidratos":5,"proteinas":3,"gorduras":2}]'::jsonb,
      31, 236, 12, 8, true, timestamp '2026-05-06 07:38:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Arroz integral","categoria":"Almoco","quantidade_gramas":110,"calorias":136,"carboidratos":28,"proteinas":3,"gorduras":1},{"nome":"Feijao carioca","categoria":"Leguminosa","quantidade_gramas":90,"calorias":68,"carboidratos":13,"proteinas":4.5,"gorduras":0.4},{"nome":"Tilapia grelhada","categoria":"Proteina","quantidade_gramas":130,"calorias":166,"carboidratos":0,"proteinas":34,"gorduras":3},{"nome":"Abobrinha refogada","categoria":"Vegetais","quantidade_gramas":80,"calorias":24,"carboidratos":4,"proteinas":1.5,"gorduras":0.3}]'::jsonb,
      45, 394, 43, 4.7, true, timestamp '2026-05-06 12:26:00'
    ),
    (
      gen_random_uuid(),
      v_patient_id,
      null,
      '[{"nome":"Salada com frango","categoria":"Jantar","quantidade_gramas":250,"calorias":220,"carboidratos":12,"proteinas":25,"gorduras":8},{"nome":"Iogurte natural","categoria":"Laticinio","quantidade_gramas":170,"calorias":92,"carboidratos":8,"proteinas":6,"gorduras":4}]'::jsonb,
      20, 312, 31, 12, true, timestamp '2026-05-06 19:22:00'
    );
end;
$$;
