do $$
declare
  v_nutricionista_id uuid;
begin
  select n.id_nutricionista_uuid
    into v_nutricionista_id
  from public.nutricionista n
  where lower(trim(n.email_acesso)) = 'rayssa.lira@gmail.com'
  order by n.id_nutricionista_uuid
  limit 1;

  if v_nutricionista_id is null then
    raise notice 'Nutricionista rayssa.lira@gmail.com nao encontrada. Nenhum vinculo foi aplicado.';
    return;
  end if;

  with target_patients as (
    select p.id_paciente_uuid
    from public.paciente p
    where p.email_pac like 'seed.paciente%@glicnutri.demo'
    order by p.email_pac
    limit 100
  )
  update public.paciente p
     set id_nutricionista_uuid = v_nutricionista_id,
         data_hora_ultima_atualizacao = now()
  from target_patients tp
  where p.id_paciente_uuid = tp.id_paciente_uuid
    and p.id_nutricionista_uuid is distinct from v_nutricionista_id;
end $$;
