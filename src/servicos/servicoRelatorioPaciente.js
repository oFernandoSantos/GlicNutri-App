import { downloadTextFile } from '../utilitarios/exportarArquivo';

export function buildPatientProgressTxt({
  patientName,
  generatedAt,
  weightSeries,
  weeklyAdherence,
  glycemicMetrics,
  monthlySummary,
  achievements = [],
  mealEntries = [],
  glucoseReadings = [],
}) {
  const lines = [
    'GLICNUTRI — RELATORIO DE PROGRESSO DO PACIENTE',
    '============================================',
    `Paciente: ${patientName}`,
    `Gerado em: ${generatedAt}`,
    '',
    'RESUMO',
    `Perda de peso no periodo: ${weightSeries?.loss?.toFixed?.(1) ?? weightSeries?.loss} kg`,
    `Peso inicial: ${weightSeries?.initial} kg`,
    `Peso atual: ${weightSeries?.current} kg`,
    `Meta: ${weightSeries?.goal} kg`,
    `Adesao media (7 dias): ${monthlySummary?.adherenceAverage ?? '—'}%`,
    `Dias ativos com registro: ${monthlySummary?.activeDays ?? '—'}`,
    '',
    'GLICEMIA',
    `Media: ${glycemicMetrics?.average ?? '—'} mg/dL`,
    `TIR (70-180): ${glycemicMetrics?.tir ?? '—'}%`,
    `Variabilidade: ${glycemicMetrics?.variability ?? '—'}`,
    `GMI estimado: ${glycemicMetrics?.gmi ?? '—'}`,
    `Total de leituras: ${glycemicMetrics?.total ?? 0}`,
    '',
    'ADERENCIA SEMANAL',
  ];

  (weeklyAdherence || []).forEach((day) => {
    lines.push(`- ${day.label}: ${day.value}%`);
  });

  lines.push('', 'CONQUISTAS');
  achievements.forEach((item) => {
    lines.push(`- ${item.title}: ${item.description}`);
  });

  lines.push('', 'ULTIMAS REFEICOES REGISTRADAS');
  (mealEntries || []).slice(0, 40).forEach((entry, index) => {
    const extras = [
      Number(entry?.fiberG) > 0 ? `fibras ${Math.round(Number(entry.fiberG))}g` : '',
      Number(entry?.sugarsG) > 0 ? `acucares ${Math.round(Number(entry.sugarsG))}g` : '',
      Number(entry?.sodiumMg) > 0 ? `sodio ${Math.round(Number(entry.sodiumMg))}mg` : '',
    ].filter(Boolean);
    lines.push(
      `${index + 1}. ${entry?.date || '—'} ${entry?.time || ''} — ${entry?.title || entry?.name || 'Refeicao'}${extras.length ? ` (${extras.join(', ')})` : ''}`
    );
  });

  lines.push('', 'ULTIMAS LEITURAS DE GLICOSE');
  (glucoseReadings || []).slice(0, 40).forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry?.date || '—'} ${entry?.time || ''} — ${entry?.value} mg/dL (${entry?.context || entry?.mealContext || 'sem contexto'})`
    );
  });

  lines.push('', 'FIM DO RELATORIO');
  return lines.join('\n');
}

export async function exportPatientProgressReport(payload) {
  const stamp = new Date().toISOString().slice(0, 10);
  const body = buildPatientProgressTxt(payload);
  return downloadTextFile(`glicnutri_progresso_${stamp}.txt`, body);
}
