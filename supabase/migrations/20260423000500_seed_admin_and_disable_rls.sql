alter table public.administrador disable row level security;

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
