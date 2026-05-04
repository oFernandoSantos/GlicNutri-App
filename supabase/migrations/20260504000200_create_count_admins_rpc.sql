create or replace function public.contar_administradores()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.administrador;
$$;

grant execute on function public.contar_administradores() to anon, authenticated;
