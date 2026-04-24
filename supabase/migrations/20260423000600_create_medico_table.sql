create extension if not exists pgcrypto;

create table if not exists public.medico (
  id_medico_uuid uuid primary key default gen_random_uuid(),
  nome_completo_medico text not null,
  email_medico text not null unique,
  senha_medico text not null,
  crm_medico text not null unique,
  especialidade_medico text,
  telefone_medico text,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_medico_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_medico_updated_at on public.medico;
create trigger trg_touch_medico_updated_at
before update on public.medico
for each row
execute function public.touch_medico_updated_at();

create or replace function public.hash_medico_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.senha_medico is not null
     and new.senha_medico !~ '^\$2[aby]\$[0-9]{2}\$' then
    new.senha_medico := crypt(new.senha_medico, gen_salt('bf'));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hash_medico_password on public.medico;
create trigger trg_hash_medico_password
before insert or update of senha_medico on public.medico
for each row
execute function public.hash_medico_password();

create or replace function public.verificar_login_medico(
  p_identificador text,
  p_senha text
)
returns setof public.medico
language sql
security definer
set search_path = public, extensions
as $$
  select
    m.id_medico_uuid,
    m.nome_completo_medico,
    m.email_medico,
    null::text as senha_medico,
    m.crm_medico,
    m.especialidade_medico,
    m.telefone_medico,
    m.ativo,
    m.created_at,
    m.updated_at
  from public.medico m
  where m.ativo = true
    and m.senha_medico is not null
    and m.senha_medico = crypt(trim(coalesce(p_senha, '')), m.senha_medico)
    and (
      lower(coalesce(m.email_medico, '')) = lower(trim(coalesce(p_identificador, '')))
      or lower(coalesce(m.crm_medico, '')) = lower(trim(coalesce(p_identificador, '')))
    )
  limit 1;
$$;

grant select, insert, update on public.medico to anon, authenticated;
grant execute on function public.verificar_login_medico(text, text) to anon, authenticated;
