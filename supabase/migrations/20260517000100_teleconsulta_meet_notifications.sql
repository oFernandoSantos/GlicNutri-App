-- Teleconsulta: Google Meet, perfil profissional e notificações in-app

alter table if exists public.nutricionista
  add column if not exists especialidade text default 'Nutrição clínica',
  add column if not exists especialidades text[] default array['Nutrição clínica', 'Nutrição esportiva', 'Controle glicêmico'],
  add column if not exists bio_resumo text default '',
  add column if not exists valor_consulta_centavos integer default 12000,
  add column if not exists meet_link_padrao text default '',
  add column if not exists aceita_convenio boolean default true,
  add column if not exists formacao_resumo text default '';

alter table if exists public.consulta
  add column if not exists meet_link text default '',
  add column if not exists canal text default 'google_meet',
  add column if not exists tipo_consulta text default 'Teleconsulta',
  add column if not exists convenio text default 'Particular',
  add column if not exists especialidade text default '',
  add column if not exists valor_centavos integer default 0,
  add column if not exists notificacao_paciente_lida boolean default false,
  add column if not exists notificacao_nutri_lida boolean default false;

create table if not exists public.consulta_notificacao (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid references public.consulta(id) on delete cascade,
  destinatario_tipo text not null check (destinatario_tipo in ('paciente', 'nutricionista')),
  destinatario_id uuid not null,
  evento text not null check (evento in ('agendada', 'confirmada', 'cancelada', 'lembrete', 'meet_disponivel')),
  titulo text not null default '',
  mensagem text not null default '',
  lida boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_consulta_notificacao_dest
  on public.consulta_notificacao (destinatario_tipo, destinatario_id, lida, created_at desc);

alter table public.consulta_notificacao enable row level security;

drop policy if exists "Allow consulta notification reads" on public.consulta_notificacao;
create policy "Allow consulta notification reads"
on public.consulta_notificacao for select to anon, authenticated using (true);

drop policy if exists "Allow consulta notification writes" on public.consulta_notificacao;
create policy "Allow consulta notification writes"
on public.consulta_notificacao for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.consulta_notificacao to anon, authenticated;
