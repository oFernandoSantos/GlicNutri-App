import { fetchPatientExperience } from './servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from './limitesDadosPaciente';
import {
  getNutritionistId,
  listConsultasNutricionistaComPaciente,
  listPatientsByNutritionist,
} from './servicoVinculosNutricionista';
import { formatConsultaDateTime, normalizeConsultaStatus } from './servicoConsultas';
import {
  averageAdherence,
  buildGlycemicSummary,
  buildPortfolioWeeklyAdherence,
  buildWeeklyAdherenceFromMeals,
  categorizeObjectiveText,
  computeAdherenceStreak,
  normalizeRiskBucket,
  riskBucketLabel,
} from '../utilitarios/adesaoNutricional';
import {
  downloadCsvFile,
  downloadJsonFile,
  downloadPdfDocument,
  downloadTextFile,
} from '../utilitarios/exportarArquivo';
import {
  buildAdherenceSeriesForRange,
  buildNutritionistPatientAlerts,
  buildPortfolioReportAnalytics,
  buildReportsDashboardAnalytics,
  enrichPatientRowWithPeriodData,
  resolveReportPeriodLabel,
} from '../utilitarios/relatorioNutricionistaAnalytics';
import {
  buildNutritionistPatientReportPdf,
  buildNutritionistReportPdf,
} from '../utilitarios/relatorioNutricionistaPdf';
import { filterReportEntriesByBounds } from '../utilitarios/relatorioPacienteAnalytics';
import {
  buildPatientClinicalReportBundle,
  enrichReportPayloadFromDatabase,
  getReportPeriodBounds,
  isInsulinMedicationEntry,
  resolvePatientReportProfile,
} from './servicoRelatorioPaciente';

const OBJECTIVE_CATALOG = [
  { id: 'diabetes_t1', label: 'Diabetes T1' },
  { id: 'diabetes_t2', label: 'Diabetes T2' },
  { id: 'gestacional', label: 'D. Gestacional' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'emagrecimento', label: 'Emagrecimento' },
  { id: 'ganho_massa', label: 'Ganho de Massa' },
  { id: 'reeducacao', label: 'Reeducação' },
  { id: 'acompanhamento', label: 'Acompanhamento' },
];

const RISK_CATALOG = [
  { id: 'alto', label: 'Alto' },
  { id: 'moderado', label: 'Moderado' },
  { id: 'baixo', label: 'Baixo' },
];

function formatNowBr() {
  return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function loadPatientClinicalRow(patientCard, periodBounds = {}, inactiveDays = 7) {
  const patientId = patientCard?.id;
  if (!patientId) return null;

  try {
    const experience = await fetchPatientExperience(patientId, {
      ...mesclarLimitesDadosPaciente('relatorio'),
    });

    const allMeals = experience?.appState?.mealEntries || [];
    const allGlucose = experience?.glucoseReadings || [];
    const allMedication = experience?.appState?.medicationEntries || [];
    const filteredMeals = filterReportEntriesByBounds(allMeals, periodBounds);
    const filteredGlucose = filterReportEntriesByBounds(allGlucose, periodBounds);
    const filteredMedication = filterReportEntriesByBounds(allMedication, periodBounds);
    const filteredInsulin = filteredMedication.filter(isInsulinMedicationEntry);
    const filteredPureMeds = filteredMedication.filter((entry) => !isInsulinMedicationEntry(entry));

    const targetMeals = experience?.appState?.planSections?.length || 3;
    const adherenceSeries = buildAdherenceSeriesForRange(filteredMeals, periodBounds, targetMeals);
    const weekly = adherenceSeries.hasRealData
      ? adherenceSeries
      : buildWeeklyAdherenceFromMeals(allMeals, targetMeals);
    const adherence = weekly.hasRealData
      ? averageAdherence(weekly.items)
      : Number(patientCard.adherence) || 0;
    const glucoseSummary = buildGlycemicSummary(filteredGlucose.length ? filteredGlucose : allGlucose);
    const objectiveSource =
      experience?.clinicalObjective ||
      patientCard.objective ||
      patientCard.specialtyTag ||
      'Acompanhamento';
    const objectiveCategory = categorizeObjectiveText(objectiveSource);
    const riskBucket = normalizeRiskBucket(patientCard.risk, glucoseSummary.last);

    const baseRow = {
      id: patientId,
      name: patientCard.name,
      email: patientCard.email || experience?.patient?.email_pac || '',
      age: patientCard.age,
      bmi: patientCard.bmi,
      objective: objectiveSource,
      objectiveCategory,
      risk: riskBucketLabel(riskBucket),
      riskBucket,
      adherence,
      adherenceStreak: computeAdherenceStreak(weekly.items),
      weeklyItems: weekly.items,
      alerts: Number(patientCard.alerts || 0),
      latestGlucose:
        glucoseSummary.last ||
        (patientCard.latestGlucose !== '--' ? patientCard.latestGlucose : null),
      glucoseAverage: glucoseSummary.average,
      glucoseTir: glucoseSummary.tir,
      glucoseCount: glucoseSummary.count,
      mealsLoggedWeek: weekly.items.reduce((sum, item) => sum + (item.mealsLogged || 0), 0),
      mealsInPeriod: filteredMeals.length,
      insulinCount: filteredInsulin.length,
      medicationsInPeriod: filteredPureMeds.length,
      medicationsCount: filteredMedication.length,
      lastConsultaAt: patientCard.lastConsultaAt,
      nextConsultaAt: patientCard.nextConsultaAt,
      notes: patientCard.notes,
    };

    return enrichPatientRowWithPeriodData(
      baseRow,
      {
        filteredMeals,
        filteredGlucose,
        filteredMedication,
        filteredInsulin,
        filteredPureMeds: filteredPureMeds,
      },
      periodBounds,
      inactiveDays
    );
  } catch (error) {
    console.log('Erro ao montar linha clinica do relatorio:', patientId, error);
    const objectiveCategory = categorizeObjectiveText(patientCard.objective);
    const riskBucket = normalizeRiskBucket(patientCard.risk, patientCard.latestGlucose);

    return {
      id: patientId,
      name: patientCard.name,
      email: patientCard.email || '',
      age: patientCard.age,
      bmi: patientCard.bmi,
      objective: patientCard.objective || 'Acompanhamento',
      objectiveCategory,
      risk: riskBucketLabel(riskBucket),
      riskBucket,
      adherence: Number(patientCard.adherence) || 0,
      adherenceStreak: 0,
      weeklyItems: [],
      alerts: Number(patientCard.alerts || 0),
      latestGlucose: patientCard.latestGlucose !== '--' ? patientCard.latestGlucose : null,
      glucoseAverage: null,
      glucoseTir: null,
      glucoseCount: 0,
      mealsLoggedWeek: 0,
      medicationsCount: 0,
      lastConsultaAt: patientCard.lastConsultaAt,
      nextConsultaAt: patientCard.nextConsultaAt,
      notes: patientCard.notes,
      loadError: true,
    };
  }
}

function aggregateObjectiveDistribution(rows) {
  const counts = new Map(OBJECTIVE_CATALOG.map((item) => [item.id, 0]));

  rows.forEach((row) => {
    const key = row?.objectiveCategory?.id || 'acompanhamento';
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return OBJECTIVE_CATALOG.map((item) => ({
    id: item.id,
    label: item.label,
    value: counts.get(item.id) || 0,
  })).filter((item) => item.value > 0);
}

function aggregateRiskDistribution(rows) {
  const counts = { alto: 0, moderado: 0, baixo: 0 };
  rows.forEach((row) => {
    const bucket = row?.riskBucket || 'baixo';
    counts[bucket] = (counts[bucket] || 0) + 1;
  });

  return RISK_CATALOG.map((item) => ({
    id: item.id,
    label: item.label,
    value: counts[item.id] || 0,
  }));
}

function buildRanking(rows) {
  return [...rows]
    .sort((a, b) => Number(b.adherence) - Number(a.adherence))
    .map((row, index) => ({
      id: row.id || `rank-${index}`,
      patientName: row.name,
      adherence: row.adherence,
      streak:
        row.adherenceStreak > 0
          ? `${row.adherenceStreak} dia${row.adherenceStreak === 1 ? '' : 's'} seguidos`
          : 'Sem sequencia recente',
      risk: row.risk,
      objective: row.objectiveCategory?.label || row.objective,
    }));
}

function summarizeConsultas(consultas = []) {
  const active = consultas.filter((item) => item?.status !== 'cancelled');
  const upcoming = active.filter((item) => {
    const time = new Date(item.scheduled_at || 0).getTime();
    return time >= Date.now() && !['done', 'no_show'].includes(normalizeConsultaStatus(item.status));
  });
  const completed = active.filter((item) => normalizeConsultaStatus(item.status) === 'done');

  return {
    total: consultas.length,
    active: active.length,
    upcoming: upcoming.length,
    completed: completed.length,
    items: consultas.slice(0, 80).map((item) => ({
      id: item.id,
      pacienteId: item.paciente_id,
      pacienteNome:
        item.paciente?.nome_completo ||
        item.paciente?.nome_pac ||
        item.paciente?.email_pac ||
        'Paciente',
      status: normalizeConsultaStatus(item.status),
      statusLabel: item.status,
      scheduledAt: item.scheduled_at,
      scheduledLabel: formatConsultaDateTime(item.scheduled_at),
      tipo: item.tipo_consulta || 'Teleconsulta',
      convenio: item.convenio || '',
    })),
  };
}

const MAX_REPORT_PATIENTS = 80;

export async function buildNutritionistReportBundle(
  usuarioLogado,
  { period = '7days', startDate = '', endDate = '', inactiveDays = 7 } = {}
) {
  const nutricionistaId = getNutritionistId(usuarioLogado);
  if (!nutricionistaId) {
    throw new Error('Nutricionista sem identificador para gerar relatorios.');
  }

  const periodBounds = getReportPeriodBounds(period, startDate, endDate);
  const periodLabel = resolveReportPeriodLabel(period, periodBounds);

  const [patientCards, consultas] = await Promise.all([
    listPatientsByNutritionist(nutricionistaId),
    listConsultasNutricionistaComPaciente(nutricionistaId, { limit: 220 }).catch(() => []),
  ]);

  const scopedPatients = (patientCards || []).slice(0, MAX_REPORT_PATIENTS);
  const rows = [];
  const batches = chunkArray(scopedPatients, 2);

  for (const batch of batches) {
    const batchRows = await Promise.all(
      batch.map((patient) => loadPatientClinicalRow(patient, periodBounds, inactiveDays))
    );
    rows.push(...batchRows.filter(Boolean));
  }

  const weeklyPortfolio = buildPortfolioWeeklyAdherence(
    rows.map((row) => ({ items: row.weeklyItems }))
  );
  const adherenceValues = rows.map((row) => row.adherence).filter((value) => value > 0);
  const averageAdherenceValue = adherenceValues.length
    ? Math.round(adherenceValues.reduce((sum, value) => sum + value, 0) / adherenceValues.length)
    : 0;
  const highRiskCount = rows.filter((row) => row.riskBucket === 'alto').length;
  const alertsTotal = rows.reduce((sum, row) => sum + Number(row.alerts || 0), 0);

  const weeklyValues = weeklyPortfolio.map((item) => Number(item.value || 0));
  const bestDay = weeklyValues.length ? Math.max(...weeklyValues) : 0;
  const worstDay = weeklyValues.length ? Math.min(...weeklyValues) : 0;
  const portfolioAverage = weeklyValues.length
    ? Math.round(weeklyValues.reduce((sum, value) => sum + value, 0) / weeklyValues.length)
    : averageAdherenceValue;

  const baseBundle = {
    generatedAt: formatNowBr(),
    period,
    periodBounds,
    periodLabel,
    inactiveDays,
    nutricionista: {
      id: nutricionistaId,
      nome:
        usuarioLogado?.nome_completo_nutri ||
        usuarioLogado?.nome ||
        usuarioLogado?.email ||
        'Nutricionista',
      email: usuarioLogado?.email || usuarioLogado?.email_nutri || '',
    },
    metrics: {
      totalPatients: rows.length,
      highRiskCount,
      averageAdherence: averageAdherenceValue,
      alertsTotal,
      portfolioAverage,
      bestDay,
      worstDay,
    },
    objectiveDistribution: aggregateObjectiveDistribution(rows),
    objectiveRows: OBJECTIVE_CATALOG.map((item) => ({
      ...item,
      value: rows.filter((row) => row.objectiveCategory?.id === item.id).length,
    })),
    riskDistribution: aggregateRiskDistribution(rows),
    weeklyAdherence: weeklyPortfolio,
    ranking: buildRanking(rows),
    patients: rows,
    consultas: summarizeConsultas(consultas),
  };

  return {
    ...baseBundle,
    portfolioAnalytics: buildPortfolioReportAnalytics(baseBundle),
    dashboardAnalytics: buildReportsDashboardAnalytics(baseBundle),
  };
}

function headerBlock(bundle, title) {
  return [
    'GLICNUTRI — RELATORIO CLINICO',
    title,
    '================================',
    `Gerado em: ${bundle.generatedAt}`,
    `Profissional: ${bundle.nutricionista.nome}`,
    `E-mail: ${bundle.nutricionista.email || 'Nao informado'}`,
    `Total de pacientes: ${bundle.metrics.totalPatients}`,
    '',
  ].join('\n');
}

export function buildRelatorioGeralTxt(bundle) {
  const lines = [
    headerBlock(bundle, 'RELATORIO GERAL DA CARTEIRA'),
    'RESUMO EXECUTIVO',
    '----------------',
    `Pacientes ativos: ${bundle.metrics.totalPatients}`,
    `Alto risco: ${bundle.metrics.highRiskCount}`,
    `Adesao media: ${bundle.metrics.averageAdherence}%`,
    `Alertas ativos: ${bundle.metrics.alertsTotal}`,
    `Consultas registradas: ${bundle.consultas.total}`,
    `Proximas consultas: ${bundle.consultas.upcoming}`,
    `Consultas realizadas: ${bundle.consultas.completed}`,
    '',
    'DISTRIBUICAO POR OBJETIVO',
    '-------------------------',
  ];

  bundle.objectiveDistribution.forEach((item) => {
    lines.push(`- ${item.label}: ${item.value} paciente(s)`);
  });

  lines.push('', 'DISTRIBUICAO DE RISCO', '---------------------');
  bundle.riskDistribution.forEach((item) => {
    lines.push(`- ${item.label}: ${item.value} paciente(s)`);
  });

  lines.push('', 'ADERENCIA SEMANAL DA CARTEIRA', '-----------------------------');
  bundle.weeklyAdherence.forEach((item) => {
    lines.push(`- ${item.label}: ${item.value}%`);
  });

  lines.push('', 'RANKING DE ADESAO', '-----------------');
  bundle.ranking.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.patientName} — ${item.adherence}% (${item.streak}) — Risco ${item.risk}`
    );
  });

  lines.push('', 'DETALHAMENTO POR PACIENTE', '=========================');
  bundle.patients.forEach((patient, index) => {
    lines.push(
      '',
      `${index + 1}. ${patient.name}`,
      `   E-mail: ${patient.email || 'Nao informado'}`,
      `   Idade: ${patient.age} | IMC: ${patient.bmi}`,
      `   Objetivo: ${patient.objective}`,
      `   Risco: ${patient.risk}`,
      `   Adesao 7 dias: ${patient.adherence}%`,
      `   Sequencia: ${patient.adherenceStreak} dia(s)`,
      `   Glicemia media: ${patient.glucoseAverage ?? 'Sem dados'} mg/dL`,
      `   TIR estimado: ${patient.glucoseTir ?? 'Sem dados'}%`,
      `   Leituras de glicose: ${patient.glucoseCount}`,
      `   Refeicoes registradas na semana: ${patient.mealsLoggedWeek}`,
      `   Medicacoes/insulinas no periodo: ${patient.medicationsCount}`,
      `   Ultima consulta: ${patient.lastConsultaAt || 'Nao informada'}`,
      `   Proxima consulta: ${patient.nextConsultaAt || 'Nao agendada'}`,
      `   Observacoes: ${patient.notes || 'Sem observacoes'}`
    );
  });

  lines.push('', 'AGENDA / CONSULTAS RECENTES', '===========================');
  bundle.consultas.items.forEach((item) => {
    lines.push(
      `- ${item.scheduledLabel} | ${item.pacienteNome} | ${item.tipo} | ${item.status} | ${item.convenio || 'Particular'}`
    );
  });

  lines.push('', 'FIM DO RELATORIO');
  return lines.join('\n');
}

export function buildRelatorioAdesaoTxt(bundle) {
  const lines = [
    headerBlock(bundle, 'RELATORIO DE ADESAO ALIMENTAR'),
    'RESUMO',
    `Adesao media da carteira: ${bundle.metrics.averageAdherence}%`,
    `Media semanal agregada: ${bundle.metrics.portfolioAverage}%`,
    `Melhor dia: ${bundle.metrics.bestDay}%`,
    `Pior dia: ${bundle.metrics.worstDay}%`,
    '',
    'EVOLUCAO SEMANAL DA CARTEIRA',
  ];

  bundle.weeklyAdherence.forEach((item) => {
    lines.push(`- ${item.label}: ${item.value}%`);
  });

  lines.push('', 'PACIENTES (DETALHE)', '===================');
  bundle.patients.forEach((patient) => {
    lines.push(
      '',
      `${patient.name} — ${patient.adherence}%`,
      `Sequencia: ${patient.adherenceStreak} dia(s)`,
      `Refeicoes na semana: ${patient.mealsLoggedWeek}`
    );
    patient.weeklyItems.forEach((day) => {
      lines.push(`  ${day.label} (${day.isoDate}): ${day.value}% — ${day.mealsLogged} refeicao(oes)`);
    });
  });

  return lines.join('\n');
}

export function buildRelatorioRiscoTxt(bundle) {
  const lines = [
    headerBlock(bundle, 'RELATORIO DE RISCO GLICEMICO'),
    'RESUMO',
    `Alto risco: ${bundle.metrics.highRiskCount}`,
    `Moderado: ${bundle.riskDistribution.find((item) => item.id === 'moderado')?.value || 0}`,
    `Baixo: ${bundle.riskDistribution.find((item) => item.id === 'baixo')?.value || 0}`,
    '',
    'PACIENTES POR NIVEL DE RISCO',
  ];

  ['alto', 'moderado', 'baixo'].forEach((bucket) => {
    lines.push('', riskBucketLabel(bucket).toUpperCase());
    bundle.patients
      .filter((patient) => patient.riskBucket === bucket)
      .forEach((patient) => {
        lines.push(
          `- ${patient.name} | Glicemia: ${patient.latestGlucose ?? '—'} mg/dL | Adesao: ${patient.adherence}% | Objetivo: ${patient.objective}`
        );
      });
  });

  return lines.join('\n');
}

export function buildRelatorioGeralCsv(bundle) {
  const rows = [
    [
      'Paciente',
      'E-mail',
      'Idade',
      'IMC',
      'Objetivo',
      'Risco',
      'Adesao_%',
      'Sequencia_dias',
      'Glicemia_media',
      'TIR_%',
      'Leituras_glicose',
      'Refeicoes_semana',
      'Medicacoes_periodo',
      'Ultima_consulta',
      'Proxima_consulta',
    ],
  ];

  bundle.patients.forEach((patient) => {
    rows.push([
      patient.name,
      patient.email,
      patient.age,
      patient.bmi,
      patient.objective,
      patient.risk,
      patient.adherence,
      patient.adherenceStreak,
      patient.glucoseAverage ?? '',
      patient.glucoseTir ?? '',
      patient.glucoseCount,
      patient.mealsLoggedWeek,
      patient.medicationsCount,
      patient.lastConsultaAt || '',
      patient.nextConsultaAt || '',
    ]);
  });

  return rows;
}

export function buildRelatorioAdesaoCsv(bundle) {
  const rows = [['Paciente', 'Dia', 'Data', 'Adesao_%', 'Refeicoes_registradas']];
  bundle.patients.forEach((patient) => {
    if (!patient.weeklyItems.length) {
      rows.push([patient.name, '-', '-', patient.adherence, patient.mealsLoggedWeek]);
      return;
    }
    patient.weeklyItems.forEach((day) => {
      rows.push([patient.name, day.label, day.isoDate, day.value, day.mealsLogged]);
    });
  });
  return rows;
}

export function buildRelatorioRiscoCsv(bundle) {
  const rows = [
    [
      'Paciente',
      'Risco',
      'Glicemia_recente',
      'Glicemia_media',
      'TIR_%',
      'Adesao_%',
      'Alertas',
      'Objetivo',
    ],
  ];

  bundle.patients.forEach((patient) => {
    rows.push([
      patient.name,
      patient.risk,
      patient.latestGlucose ?? '',
      patient.glucoseAverage ?? '',
      patient.glucoseTir ?? '',
      patient.adherence,
      patient.alerts,
      patient.objective,
    ]);
  });

  return rows;
}

export async function exportNutritionistReport({
  bundle,
  type = 'geral',
  format = 'txt',
}) {
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `glicnutri_${type}_${stamp}`;

  if (format === 'json') {
    return downloadJsonFile(`${baseName}.json`, bundle);
  }

  if (format === 'pdf') {
    const pdfDoc = await buildNutritionistReportPdf(bundle, type);
    return downloadPdfDocument(`${baseName}.pdf`, pdfDoc);
  }

  if (type === 'adesao') {
    if (format === 'csv') {
      return downloadCsvFile(`${baseName}.csv`, buildRelatorioAdesaoCsv(bundle));
    }
    return downloadTextFile(`${baseName}.txt`, buildRelatorioAdesaoTxt(bundle));
  }

  if (type === 'risco') {
    if (format === 'csv') {
      return downloadCsvFile(`${baseName}.csv`, buildRelatorioRiscoCsv(bundle));
    }
    return downloadTextFile(`${baseName}.txt`, buildRelatorioRiscoTxt(bundle));
  }

  if (format === 'csv') {
    return downloadCsvFile(`${baseName}.csv`, buildRelatorioGeralCsv(bundle));
  }

  return downloadTextFile(`${baseName}.txt`, buildRelatorioGeralTxt(bundle));
}

export async function exportNutritionistPortfolioReport(
  usuarioLogado,
  { period = '7days', startDate = '', endDate = '', inactiveDays = 7, format = 'pdf' } = {}
) {
  const bundle = await buildNutritionistReportBundle(usuarioLogado, {
    period,
    startDate,
    endDate,
    inactiveDays,
  });
  return exportNutritionistReport({ bundle, type: 'geral', format });
}

export async function buildNutritionistPatientReportBundle({
  usuarioLogado,
  patient,
  period = '7days',
  startDate = '',
  endDate = '',
}) {
  const nutricionistaId = getNutritionistId(usuarioLogado);
  const patientId = patient?.id || patient?.id_paciente_uuid || patient?.pacienteId;

  if (!nutricionistaId || !patientId) {
    throw new Error('Dados insuficientes para gerar o relatório do paciente.');
  }

  const linkedPatients = await listPatientsByNutritionist(nutricionistaId, { limit: 200 });
  const isLinked = linkedPatients.some((item) => item.id === patientId);
  if (!isLinked) {
    throw new Error('Paciente não vinculado à nutricionista logada.');
  }

  const periodBounds = getReportPeriodBounds(period, startDate, endDate);
  const periodLabel = resolveReportPeriodLabel(period, periodBounds);

  const enrichedPayload = await enrichReportPayloadFromDatabase({
    patient,
    period,
    startDate,
    endDate,
    periodLabel,
    patientName:
      patient?.name || patient?.nome_completo || patient?.nome_pac || patient?.email_pac || 'Paciente',
  });

  const personalProfile = await resolvePatientReportProfile(patient);
  personalProfile.nutricionistaNome =
    usuarioLogado?.nome_completo_nutri ||
    usuarioLogado?.nome ||
    personalProfile.nutricionistaNome;

  const bundle = buildPatientClinicalReportBundle({ ...enrichedPayload, personalProfile });
  bundle.nutricionista = {
    nome:
      usuarioLogado?.nome_completo_nutri ||
      usuarioLogado?.nome ||
      usuarioLogado?.email ||
      'Nutricionista',
    email: usuarioLogado?.email || usuarioLogado?.email_nutri || '',
  };
  bundle.nutritionistAlerts = buildNutritionistPatientAlerts(bundle);

  return bundle;
}

export async function exportNutritionistPatientReport(
  { usuarioLogado, patient, period = '7days', startDate = '', endDate = '' },
  { mode = 'visual', format = 'pdf' } = {}
) {
  const bundle = await buildNutritionistPatientReportBundle({
    usuarioLogado,
    patient,
    period,
    startDate,
    endDate,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = `glicnutri_paciente_${stamp}`;

  if (format !== 'pdf') {
    throw new Error('Relatório do paciente disponível apenas em PDF.');
  }

  const pdfDoc = await buildNutritionistPatientReportPdf(bundle, { mode });
  return downloadPdfDocument(`${safeName}.pdf`, pdfDoc);
}
