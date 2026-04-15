create extension if not exists pgcrypto;

set search_path = public, extensions;

update public.paciente
set senha_pac = crypt(senha_pac, gen_salt('bf'))
where senha_pac is not null
  and senha_pac !~ '^\$2[aby]\$[0-9]{2}\$';

update public.nutricionista
set senha_nutri = crypt(senha_nutri, gen_salt('bf'))
where senha_nutri is not null
  and senha_nutri !~ '^\$2[aby]\$[0-9]{2}\$';

create or replace function public.hash_paciente_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.senha_pac is not null
     and new.senha_pac !~ '^\$2[aby]\$[0-9]{2}\$' then
    new.senha_pac := crypt(new.senha_pac, gen_salt('bf'));
  end if;

  return new;
end;
$$;

create or replace function public.hash_nutricionista_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.senha_nutri is not null
     and new.senha_nutri !~ '^\$2[aby]\$[0-9]{2}\$' then
    new.senha_nutri := crypt(new.senha_nutri, gen_salt('bf'));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hash_paciente_password on public.paciente;
create trigger trg_hash_paciente_password
before insert or update of senha_pac on public.paciente
for each row
execute function public.hash_paciente_password();

drop trigger if exists trg_hash_nutricionista_password on public.nutricionista;
create trigger trg_hash_nutricionista_password
before insert or update of senha_nutri on public.nutricionista
for each row
execute function public.hash_nutricionista_password();

create or replace function public.verificar_login_paciente(
  p_identificador text,
  p_senha text
)
returns setof public.paciente
language sql
security definer
set search_path = public, extensions
as $$
  select p.*
  from public.paciente p
  where coalesce(p.excluido, false) = false
    and p.senha_pac is not null
    and p.senha_pac = crypt(trim(coalesce(p_senha, '')), p.senha_pac)
    and (
      lower(coalesce(p.email_pac, '')) = lower(trim(coalesce(p_identificador, '')))
      or regexp_replace(coalesce(p.cpf_paciente, ''), '\D', '', 'g') =
         regexp_replace(coalesce(p_identificador, ''), '\D', '', 'g')
    )
  limit 1;
$$;

create or replace function public.verificar_login_nutricionista(
  p_identificador text,
  p_senha text
)
returns setof public.nutricionista
language sql
security definer
set search_path = public, extensions
as $$
  select n.*
  from public.nutricionista n
  where n.senha_nutri is not null
    and n.senha_nutri = crypt(trim(coalesce(p_senha, '')), n.senha_nutri)
    and (
      lower(coalesce(n.email_acesso, '')) = lower(trim(coalesce(p_identificador, '')))
      or upper(trim(coalesce(n.crm_numero, ''))) = upper(trim(coalesce(p_identificador, '')))
    )
  limit 1;
$$;

grant execute on function public.verificar_login_paciente(text, text) to anon, authenticated;
grant execute on function public.verificar_login_nutricionista(text, text) to anon, authenticated;
