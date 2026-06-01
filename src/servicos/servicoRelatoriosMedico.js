import { fetchGlucoseReadings } from './servicoDadosPaciente';
import { formatConsultaDateTime } from './servicoConsultas';
import { getMedicoId, listConsultasMedicoComPaciente, listPatientsByDoctor } from './servicoVinculosMedico';
import { downloadCsvFile, downloadTextFile } from '../utilitarios/exportarArquivo';

function average(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function buildDoctorReportBundle(medicoId, usuarioLogado) {
  const patients = await listPatientsByDoctor(medicoId);
  const consultas = await listConsultasMedicoComPaciente(medicoId, { limit: 80 }).catch(() => []);

  const rows = [];
  for (const patient of patients.slice(0, 40)) {
    const readings = await fetchGlucoseReadings(patient.id, 30).catch(() => []);
    const values = (readings || [])
      .map((r) => Number(r.value_mg_dl ?? r.glucose_mg_dl ?? r.valor))
      .filter((v) => Number.isFinite(v) && v > 0);
    rows.push({
      id: patient.id,
      name: patient.name,
      avgGlucose: average(values),
      lastGlucose: values[0] ?? null,
      readingsCount: values.length,
      objective: patient.objective || patient.specialtyTag,
    });
  }

  const highRisk = rows.filter((r) => (r.avgGlucose || 0) >= 180).length;
  const upcoming = consultas.filter((c) =>
    ['scheduled', 'confirmed'].includes(String(c.status || '').toLowerCase())
  ).length;

  return {
    generatedAt: new Date().toLocaleString('pt-BR'),
    medicoNome: usuarioLogado?.nome_completo_medico || usuarioLogado?.nome || 'Médico',
    totals: {
      patients: patients.length,
      highRisk,
      upcomingConsultas: upcoming,
      avgPortfolioGlucose: average(rows.map((r) => r.avgGlucose).filter(Boolean)),
    },
    patients: rows,
    consultas: consultas.slice(0, 20).map((c) => ({
      id: c.id,
      patientName: c.paciente?.nome_completo || 'Paciente',
      when: formatConsultaDateTime(c.scheduled_at),
      status: c.status,
      motivo: c.motivo,
    })),
  };
}

export async function exportDoctorReportCsv(bundle) {
  const header = 'Paciente;Media glicose;Ultima glicose;Leituras;Foco clinico';
  const lines = (bundle.patients || []).map(
    (p) =>
      `${p.name};${p.avgGlucose ?? ''};${p.lastGlucose ?? ''};${p.readingsCount};${String(p.objective || '').replace(/;/g, ',')}`
  );
  await downloadCsvFile(`relatorio-medico-${Date.now()}.csv`, [header, ...lines].join('\n'));
}

export async function exportDoctorReportSummary(bundle) {
  const text = [
    `Relatório clínico — ${bundle.medicoNome}`,
    `Gerado em: ${bundle.generatedAt}`,
    '',
    `Pacientes: ${bundle.totals.patients}`,
    `Alto risco glicêmico (≥180): ${bundle.totals.highRisk}`,
    `Consultas futuras: ${bundle.totals.upcomingConsultas}`,
    `Média glicêmica carteira: ${bundle.totals.avgPortfolioGlucose ?? '—'} mg/dL`,
    '',
    'Escopo: diabetes, glicose, medicação e exames. Plano alimentar: nutricionista.',
  ].join('\n');
  await downloadTextFile(`resumo-medico-${Date.now()}.txt`, text);
}

export { getMedicoId };
