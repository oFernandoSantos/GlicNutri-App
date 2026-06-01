-- Pacientes precisam listar medicos ativos na aba Agendamentos (espelho do nutricionista).
drop policy if exists "Permitir leitura publica de medicos ativos" on public.medico;

create policy "Permitir leitura publica de medicos ativos"
on public.medico
for select
to public
using (coalesce(ativo, true) = true);
