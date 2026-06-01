create or replace function public.limpar_glicemia_cgm_fonte(
  p_id_paciente_uuid uuid,
  p_fonte            text default 'librelinkup',
  p_token_sessao     uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_removidos bigint := 0;
  v_fonte     text;
begin
  perform public.assert_sessao_acesso_paciente(p_token_sessao, p_id_paciente_uuid);

  if p_id_paciente_uuid is null then
    raise exception 'Paciente sem identificador para limpar leituras CGM.';
  end if;

  v_fonte := coalesce(nullif(trim(p_fonte), ''), 'librelinkup');

  delete from public.registro_glicemia_cgm
  where id_paciente_uuid = p_id_paciente_uuid
    and fonte = v_fonte;

  get diagnostics v_removidos = row_count;
  return v_removidos;
end;
$$;

grant execute on function public.limpar_glicemia_cgm_fonte(uuid, text, uuid)
  to anon, authenticated;

alter function public.limpar_glicemia_cgm_fonte(uuid, text, uuid) owner to postgres;
