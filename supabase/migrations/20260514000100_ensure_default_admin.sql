create extension if not exists pgcrypto;

insert into public.administrador (
  nome_completo_admin,
  email_acesso,
  senha_admin,
  ativo
)
values (
  'Administrador GlicNutri',
  'admin@glicnutri.local',
  extensions.crypt('Admin@123!', extensions.gen_salt('bf')),
  true
)
on conflict (email_acesso)
do update set
  nome_completo_admin = excluded.nome_completo_admin,
  senha_admin = excluded.senha_admin,
  ativo = true,
  updated_at = timezone('utc', now());
