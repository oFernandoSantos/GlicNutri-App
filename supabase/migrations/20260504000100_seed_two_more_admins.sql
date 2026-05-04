insert into public.administrador (
  nome_completo_admin,
  email_acesso,
  senha_admin,
  ativo
)
select
  'Administrador Teste 02',
  'admin2@glicnutri.local',
  extensions.crypt('Admin@123!', extensions.gen_salt('bf')),
  true
where not exists (
  select 1
  from public.administrador
  where lower(email_acesso) = 'admin2@glicnutri.local'
);

insert into public.administrador (
  nome_completo_admin,
  email_acesso,
  senha_admin,
  ativo
)
select
  'Administrador Teste 03',
  'admin3@glicnutri.local',
  extensions.crypt('Admin@123!', extensions.gen_salt('bf')),
  true
where not exists (
  select 1
  from public.administrador
  where lower(email_acesso) = 'admin3@glicnutri.local'
);
