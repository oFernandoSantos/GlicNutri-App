import {
  nutriGreenRgb,
  nutriGreenRgbDark,
  nutriGreenRgbLight,
} from '../temas/designSystemNutricionista';
import {
  CHART_BLUE,
  CHART_ORANGE,
  CHART_PURPLE,
  PAGE_MARGIN,
  addBulletListPanel,
  addInsightBox,
  addMetaLine,
  addModernFooter,
  addModernHeader,
  addModernSectionTitle,
  addSummaryCardGrid,
  drawColumnChart,
  drawDistributionPanel,
  drawHorizontalBarChart,
  pdfText,
} from './relatorioPdfDesign';

const NUTRI_BRAND_RGB = nutriGreenRgb;
const NUTRI_GLUCOSE_OK = nutriGreenRgb;
const NUTRI_SECTION_BRAND = {
  brandDarkRgb: nutriGreenRgbDark,
  brandLightRgb: nutriGreenRgbLight,
};

let pdfModulesPromise = null;

async function loadPdfModules() {
  if (!pdfModulesPromise) {
    pdfModulesPromise = Promise.all([import('jspdf'), import('jspdf-autotable')]).then(
      ([jspdfModule, autoTableModule]) => ({
        jsPDF: jspdfModule.jsPDF,
        autoTable: autoTableModule.default,
      })
    );
  }
  return pdfModulesPromise;
}

export function buildPortfolioSummaryPdf(bundle, { jsPDF }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const analytics = bundle.portfolioAnalytics || {};
  const metrics = bundle.metrics || {};
  const periodLabel = bundle.periodLabel || 'Últimos 7 dias';

  let y = addModernHeader(doc, {
    title: 'Relatório da Carteira',
    subtitle: pdfText(bundle.nutricionista?.nome || 'Nutricionista'),
    metaRight: periodLabel,
    brandRgb: NUTRI_BRAND_RGB,
  });

  y = addMetaLine(
    doc,
    y,
    `Gerado em ${pdfText(bundle.generatedAt)} · ${metrics.totalPatients ?? 0} paciente(s) vinculado(s)`
  );
  y += 4;

  y = addModernSectionTitle(doc, y, '1. Visão geral da carteira', NUTRI_SECTION_BRAND);
  y = addSummaryCardGrid(doc, y, [
    { label: 'Pacientes', value: metrics.totalPatients ?? 0, color: NUTRI_BRAND_RGB },
    { label: 'Ativos', value: analytics.activePatients ?? 0, color: NUTRI_GLUCOSE_OK },
    { label: 'Sem registros', value: analytics.inactivePatients ?? 0, color: CHART_ORANGE },
    { label: 'Glicose média', value: analytics.portfolioAvgGlucose ?? '—', suffix: 'mg/dL', color: NUTRI_BRAND_RGB },
    { label: 'Tempo no alvo', value: analytics.portfolioAvgTir ?? '—', suffix: '%', color: NUTRI_GLUCOSE_OK },
    { label: 'Adesão média', value: metrics.averageAdherence ?? 0, suffix: '%', color: CHART_BLUE },
    { label: 'Refeições', value: analytics.totals?.meals ?? 0, color: CHART_BLUE },
    { label: 'Glicose', value: analytics.totals?.glucose ?? 0, color: NUTRI_BRAND_RGB },
    { label: 'Insulina', value: analytics.totals?.insulin ?? 0, color: CHART_PURPLE },
    { label: 'Medicações', value: analytics.totals?.medication ?? 0, color: CHART_ORANGE },
  ]);

  y = drawDistributionPanel(doc, y, 'Distribuição por faixa de controle', analytics.controlDistribution);

  y = drawHorizontalBarChart(doc, y, 'Ranking · tempo no alvo', analytics.tirRanking);
  y = drawHorizontalBarChart(doc, y, 'Média glicêmica por paciente', analytics.glucoseAvgRanking);

  y = addModernSectionTitle(doc, y, '2. Engajamento e evolução', NUTRI_SECTION_BRAND);
  y = drawHorizontalBarChart(doc, y, 'Quantidade de registros por paciente', analytics.recordsRanking);
  y = drawHorizontalBarChart(doc, y, 'Adesão alimentar por paciente', analytics.adherenceRanking);

  const showEvolution = (analytics.evolutionTirSeries || []).some((item) => item.value > 0);
  if (showEvolution) {
    y = drawColumnChart(doc, y, 'Evolução do tempo no alvo (carteira)', analytics.evolutionTirSeries, {
      color: NUTRI_GLUCOSE_OK,
      valueSuffix: '%',
    });
  } else {
    y = drawColumnChart(doc, y, 'Evolução da adesão semanal', bundle.weeklyAdherence || [], {
      color: CHART_BLUE,
      valueSuffix: '%',
    });
  }

  y = addModernSectionTitle(doc, y, '3. Pacientes em destaque', NUTRI_SECTION_BRAND);
  y = addBulletListPanel(doc, y, 'Melhor controle glicêmico', analytics.bestControlPatients, NUTRI_GLUCOSE_OK);
  y = addBulletListPanel(doc, y, 'Precisam de atenção', analytics.needsAttentionPatients, CHART_ORANGE);
  y = addBulletListPanel(doc, y, 'Baixa adesão alimentar', analytics.lowAdherencePatients, CHART_BLUE);
  y = addBulletListPanel(
    doc,
    y,
    `Sem registros nos últimos ${bundle.inactiveDays || 7} dias`,
    analytics.inactivePatientsList,
    CHART_ORANGE
  );

  const insights = [
    metrics.highRiskCount
      ? `${metrics.highRiskCount} paciente(s) classificado(s) como alto risco.`
      : 'Nenhum paciente em alto risco no momento.',
    metrics.alertsTotal
      ? `${metrics.alertsTotal} alerta(s) clínico(s) ativo(s) na carteira.`
      : 'Sem alertas clínicos ativos registrados.',
    bundle.consultas?.upcoming
      ? `${bundle.consultas.upcoming} consulta(s) agendada(s) nos próximos dias.`
      : 'Nenhuma consulta próxima agendada.',
  ];
  y = addModernSectionTitle(doc, y, '4. Resumo para gestão', NUTRI_SECTION_BRAND);
  y = addInsightBox(doc, y, insights);

  addModernFooter(doc, 'GlicNutri · Relatório da carteira');
  return doc;
}

/** Mantém compatibilidade com exportações legadas (adesão/risco) no formato resumido. */
export function buildRelatorioAdesaoPdf(bundle, { jsPDF }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addModernHeader(doc, {
    title: 'Adesão alimentar da carteira',
    subtitle: pdfText(bundle.nutricionista?.nome || 'Nutricionista'),
    metaRight: bundle.periodLabel || 'Período',
    brandRgb: NUTRI_BRAND_RGB,
  });
  y = addSummaryCardGrid(doc, y, [
    { label: 'Adesão média', value: bundle.metrics?.averageAdherence ?? 0, suffix: '%', color: CHART_BLUE },
    { label: 'Melhor dia', value: bundle.metrics?.bestDay ?? 0, suffix: '%', color: NUTRI_GLUCOSE_OK },
    { label: 'Pior dia', value: bundle.metrics?.worstDay ?? 0, suffix: '%', color: CHART_ORANGE },
  ]);
  y = drawColumnChart(doc, y, 'Evolução semanal da carteira', bundle.weeklyAdherence || [], {
    color: CHART_BLUE,
    valueSuffix: '%',
  });
  y = drawHorizontalBarChart(
    doc,
    y,
    'Ranking de adesão',
    (bundle.ranking || []).map((item) => ({
      label: item.patientName,
      value: item.adherence,
      display: `${item.adherence}%`,
      color: CHART_BLUE,
    }))
  );
  addModernFooter(doc, 'GlicNutri · Adesão da carteira');
  return doc;
}

export function buildRelatorioRiscoPdf(bundle, { jsPDF }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const analytics = bundle.portfolioAnalytics || {};
  let y = addModernHeader(doc, {
    title: 'Risco glicêmico da carteira',
    subtitle: pdfText(bundle.nutricionista?.nome || 'Nutricionista'),
    metaRight: bundle.periodLabel || 'Período',
    brandRgb: NUTRI_BRAND_RGB,
  });
  y = drawDistributionPanel(doc, y, 'Distribuição por controle', analytics.controlDistribution);
  y = addBulletListPanel(doc, y, 'Pacientes que precisam de atenção', analytics.needsAttentionPatients, CHART_ORANGE);
  y = drawHorizontalBarChart(doc, y, 'Média glicêmica por paciente', analytics.glucoseAvgRanking);
  addModernFooter(doc, 'GlicNutri · Risco da carteira');
  return doc;
}

/** Alias legado */
export function buildRelatorioGeralPdf(bundle, modules) {
  return buildPortfolioSummaryPdf(bundle, modules);
}

export async function buildNutritionistReportPdf(bundle, type = 'geral') {
  const { jsPDF, autoTable } = await loadPdfModules();
  const modules = { jsPDF, autoTable };

  if (type === 'adesao') return buildRelatorioAdesaoPdf(bundle, modules);
  if (type === 'risco') return buildRelatorioRiscoPdf(bundle, modules);
  return buildPortfolioSummaryPdf(bundle, modules);
}

export async function buildNutritionistPatientReportPdf(bundle, { mode = 'visual' } = {}) {
  const { buildNutritionistPatientClinicalPdf } = await import('./relatorioPacientePdf');
  const { jsPDF, autoTable } = await loadPdfModules();
  return buildNutritionistPatientClinicalPdf(bundle, { jsPDF, autoTable, reportMode: mode });
}
