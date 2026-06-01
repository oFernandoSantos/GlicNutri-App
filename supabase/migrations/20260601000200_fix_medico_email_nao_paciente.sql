-- f.limadossantos04@gmail.com e conta de paciente; medico demo usa e-mail proprio.
update public.medico
set
  email_medico = 'fernando.lima@glicnutri.demo',
  updated_at = timezone('utc', now())
where lower(email_medico) = 'f.limadossantos04@gmail.com';

insert into public.medico (
  nome_completo_medico,
  email_medico,
  senha_medico,
  crm_medico,
  especialidade_medico,
  ativo
)
values (
  'Dr. Fernando Lima',
  'fernando.lima@glicnutri.demo',
  'GlicNutri@Medico1',
  'CRM-SP 552211',
  'Clinica medica / diabetes',
  true
)
on conflict (email_medico) do update
set
  nome_completo_medico = excluded.nome_completo_medico,
  crm_medico = excluded.crm_medico,
  especialidade_medico = excluded.especialidade_medico,
  ativo = true,
  updated_at = timezone('utc', now());
