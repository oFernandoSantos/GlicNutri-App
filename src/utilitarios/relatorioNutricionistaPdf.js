import { brand } from '../temas/designSystem';
import { riskBucketLabel } from './adesaoNutricional';

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

const PAGE_MARGIN = 14;
const BRAND_RGB = [47, 157, 120];
const MUTED_RGB = [92, 107, 117];
const DANGER_RGB = [217, 107, 107];

function pdfText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function addReportHeader(doc, bundle, title) {
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text('GLICNUTRI', PAGE_MARGIN, 12);
  doc.setFontSize(15);
  doc.text(pdfText(title), PAGE_MARGIN, 22);

  doc.setTextColor(47, 52, 56);
  doc.setFontSize(10);
  let y = 38;
  doc.text(`Gerado em: ${pdfText(bundle.generatedAt)}`, PAGE_MARGIN, y);
  y += 6;
  doc.text(`Profissional: ${pdfText(bundle.nutricionista.nome)}`, PAGE_MARGIN, y);
  y += 6;
  doc.text(`E-mail: ${pdfText(bundle.nutricionista.email || 'Nao informado')}`, PAGE_MARGIN, y);
  y += 6;
  doc.text(`Pacientes na carteira: ${bundle.metrics.totalPatients}`, PAGE_MARGIN, y);
  return y + 8;
}

function addSectionTitle(doc, y, title) {
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_RGB);
  doc.text(pdfText(title), PAGE_MARGIN, y);
  doc.setDrawColor(217, 224, 231);
  doc.line(PAGE_MARGIN, y + 2, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y + 2);
  return y + 10;
}

function addSummaryBullets(doc, startY, lines) {
  let y = startY;
  doc.setFontSize(10);
  doc.setTextColor(47, 52, 56);
  lines.forEach((line) => {
    doc.text(`• ${pdfText(line)}`, PAGE_MARGIN, y);
    y += 6;
  });
  return y + 4;
}

export function buildRelatorioGeralPdf(bundle, { jsPDF, autoTable }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addReportHeader(doc, bundle, 'Relatorio Geral da Carteira');

  y = addSectionTitle(doc, y, 'Resumo executivo');
  y = addSummaryBullets(doc, y, [
    `Pacientes ativos: ${bundle.metrics.totalPatients}`,
    `Alto risco: ${bundle.metrics.highRiskCount}`,
    `Adesao media: ${bundle.metrics.averageAdherence}%`,
    `Alertas ativos: ${bundle.metrics.alertsTotal}`,
    `Consultas registradas: ${bundle.consultas.total}`,
    `Proximas consultas: ${bundle.consultas.upcoming}`,
    `Consultas realizadas: ${bundle.consultas.completed}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Objetivo', 'Pacientes']],
    body: bundle.objectiveDistribution.map((item) => [item.label, String(item.value)]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: BRAND_RGB },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 8;
  y = addSectionTitle(doc, y, 'Distribuicao de risco');

  autoTable(doc, {
    startY: y,
    head: [['Nivel', 'Pacientes']],
    body: bundle.riskDistribution.map((item) => [item.label, String(item.value)]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: BRAND_RGB },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 8;
  y = addSectionTitle(doc, y, 'Adesao semanal da carteira');

  autoTable(doc, {
    startY: y,
    head: [['Dia', 'Adesao %']],
    body: bundle.weeklyAdherence.map((item) => [item.label, `${item.value}%`]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: BRAND_RGB },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'striped',
  });

  doc.addPage();
  y = addSectionTitle(doc, 20, 'Detalhamento por paciente');

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Paciente',
        'Risco',
        'Adesao',
        'Glicemia',
        'TIR',
        'Refeicoes/sem',
        'Objetivo',
      ],
    ],
    body: bundle.patients.map((patient) => [
      patient.name,
      patient.risk,
      `${patient.adherence}%`,
      patient.latestGlucose != null ? `${patient.latestGlucose}` : '—',
      patient.glucoseTir != null ? `${patient.glucoseTir}%` : '—',
      String(patient.mealsLoggedWeek),
      pdfText(patient.objective).slice(0, 40),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: BRAND_RGB },
    columnStyles: { 6: { cellWidth: 42 } },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'striped',
  });

  if (bundle.consultas?.items?.length) {
    doc.addPage();
    y = addSectionTitle(doc, 20, 'Agenda e consultas recentes');
    autoTable(doc, {
      startY: y,
      head: [['Data/Hora', 'Paciente', 'Tipo', 'Status']],
      body: bundle.consultas.items.map((item) => [
        item.scheduledLabel,
        item.pacienteNome,
        item.tipo,
        item.status,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BRAND_RGB },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      theme: 'grid',
    });
  }

  addFooter(doc);
  return doc;
}

export function buildRelatorioAdesaoPdf(bundle, { jsPDF, autoTable }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addReportHeader(doc, bundle, 'Relatorio de Adesao Alimentar');

  y = addSectionTitle(doc, y, 'Resumo');
  y = addSummaryBullets(doc, y, [
    `Adesao media da carteira: ${bundle.metrics.averageAdherence}%`,
    `Media semanal agregada: ${bundle.metrics.portfolioAverage}%`,
    `Melhor dia: ${bundle.metrics.bestDay}%`,
    `Pior dia: ${bundle.metrics.worstDay}%`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Dia', 'Adesao carteira %']],
    body: bundle.weeklyAdherence.map((item) => [item.label, `${item.value}%`]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: BRAND_RGB },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'striped',
  });

  y = doc.lastAutoTable.finalY + 8;
  y = addSectionTitle(doc, y, 'Ranking de adesao');

  autoTable(doc, {
    startY: y,
    head: [['#', 'Paciente', 'Adesao', 'Sequencia', 'Risco']],
    body: bundle.ranking.map((item, index) => [
      String(index + 1),
      item.patientName,
      `${item.adherence}%`,
      item.streak,
      item.risk,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BRAND_RGB },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'grid',
  });

  const detailRows = [];
  bundle.patients.forEach((patient) => {
    if (!patient.weeklyItems?.length) {
      detailRows.push([
        patient.name,
        '—',
        '—',
        `${patient.adherence}%`,
        String(patient.mealsLoggedWeek),
      ]);
      return;
    }
    patient.weeklyItems.forEach((day) => {
      detailRows.push([
        patient.name,
        day.label,
        day.isoDate,
        `${day.value}%`,
        String(day.mealsLogged),
      ]);
    });
  });

  doc.addPage();
  y = addSectionTitle(doc, 20, 'Refeicoes por dia (ultimos 7 dias)');

  autoTable(doc, {
    startY: y,
    head: [['Paciente', 'Dia', 'Data', 'Adesao', 'Refeicoes']],
    body: detailRows,
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: BRAND_RGB },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'striped',
  });

  addFooter(doc);
  return doc;
}

export function buildRelatorioRiscoPdf(bundle, { jsPDF, autoTable }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addReportHeader(doc, bundle, 'Relatorio de Risco Glicemico');

  const moderado =
    bundle.riskDistribution.find((item) => item.id === 'moderado')?.value || 0;
  const baixo = bundle.riskDistribution.find((item) => item.id === 'baixo')?.value || 0;

  y = addSectionTitle(doc, y, 'Resumo');
  y = addSummaryBullets(doc, y, [
    `Alto risco: ${bundle.metrics.highRiskCount}`,
    `Moderado: ${moderado}`,
    `Baixo: ${baixo}`,
    `Alertas ativos na carteira: ${bundle.metrics.alertsTotal}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Nivel', 'Quantidade']],
    body: bundle.riskDistribution.map((item) => [item.label, String(item.value)]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: BRAND_RGB },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'grid',
  });

  ['alto', 'moderado', 'baixo'].forEach((bucket, bucketIndex) => {
    const patients = bundle.patients.filter((patient) => patient.riskBucket === bucket);
    if (!patients.length) return;

    if (bucketIndex > 0 || doc.lastAutoTable.finalY > 240) {
      doc.addPage();
      y = 20;
    } else {
      y = doc.lastAutoTable.finalY + 10;
    }

    const headColor = bucket === 'alto' ? DANGER_RGB : bucket === 'moderado' ? [232, 184, 74] : BRAND_RGB;
    y = addSectionTitle(doc, y, `Pacientes — risco ${riskBucketLabel(bucket)}`);

    autoTable(doc, {
      startY: y,
      head: [['Paciente', 'Glicemia', 'Media', 'TIR', 'Adesao', 'Objetivo']],
      body: patients.map((patient) => [
        patient.name,
        patient.latestGlucose != null ? `${patient.latestGlucose} mg/dL` : '—',
        patient.glucoseAverage != null ? `${patient.glucoseAverage} mg/dL` : '—',
        patient.glucoseTir != null ? `${patient.glucoseTir}%` : '—',
        `${patient.adherence}%`,
        pdfText(patient.objective).slice(0, 36),
      ]),
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: headColor },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      theme: 'striped',
    });
  });

  addFooter(doc);
  return doc;
}

function addFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_RGB);
    doc.text(
      `GlicNutri · Relatorio clinico · Pagina ${page} de ${pageCount}`,
      PAGE_MARGIN,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.setTextColor(brand.slate);
  }
}

export async function buildNutritionistReportPdf(bundle, type = 'geral') {
  const { jsPDF, autoTable } = await loadPdfModules();
  const modules = { jsPDF, autoTable };

  if (type === 'adesao') return buildRelatorioAdesaoPdf(bundle, modules);
  if (type === 'risco') return buildRelatorioRiscoPdf(bundle, modules);
  return buildRelatorioGeralPdf(bundle, modules);
}
