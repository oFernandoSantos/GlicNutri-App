create extension if not exists pgcrypto;

create table if not exists public.administrador (
  id_admin_uuid uuid primary key default gen_random_uuid(),
  nome_completo_admin text not null,
  email_acesso text not null unique,
  senha_admin text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_administrador_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_administrador_updated_at on public.administrador;
create trigger trg_touch_administrador_updated_at
before update on public.administrador
for each row
execute function public.touch_administrador_updated_at();

create or replace function public.hash_admin_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.senha_admin is not null
     and new.senha_admin !~ '^\$2[aby]\$[0-9]{2}\$' then
    new.senha_admin := crypt(new.senha_admin, gen_salt('bf'));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hash_admin_password on public.administrador;
create trigger trg_hash_admin_password
before insert or update of senha_admin on public.administrador
for each row
execute function public.hash_admin_password();

create or replace function public.verificar_login_admin(
  p_identificador text,
  p_senha text
)
returns setof public.administrador
language sql
security definer
set search_path = public, extensions
as $$
  select
    a.id_admin_uuid,
    a.nome_completo_admin,
    a.email_acesso,
    null::text as senha_admin,
    a.ativo,
    a.created_at,
    a.updated_at
  from public.administrador a
  where a.ativo = true
    and a.senha_admin is not null
    and a.senha_admin = crypt(trim(coalesce(p_senha, '')), a.senha_admin)
    and lower(coalesce(a.email_acesso, '')) = lower(trim(coalesce(p_identificador, '')))
  limit 1;
$$;

insert into public.administrador (
  nome_completo_admin,
  email_acesso,
  senha_admin,
  ativo
)
select
  'Administrador GlicNutri',
  'admin@glicnutri.local',
  extensions.crypt('Admin@123!', extensions.gen_salt('bf')),
  true
where not exists (
  select 1
  from public.administrador
  where lower(email_acesso) = 'admin@glicnutri.local'
);

grant select, insert, update on public.administrador to anon, authenticated;
grant execute on function public.verificar_login_admin(text, text) to anon, authenticated;
