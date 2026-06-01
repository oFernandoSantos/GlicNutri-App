import { brand } from '../temas/designSystem';
import {
  buildMealCaloriesDailySeries,
  buildMealCarbsDailySeries,
  buildMealDailySeries,
  buildMealMacroBreakdownSeries,
  buildMealMacroTotals,
  buildMealTypeSeries,
  enrichMealsForReport,
  groupReportEntriesByDay,
} from './relatorioPacienteAnalytics';

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

const PAGE_MARGIN = 18;
const PAGE_TOP = 24;
const PAGE_BOTTOM_PADDING = 22;
const CHART_BLOCK_HEIGHT = 58;
const BRAND_RGB = [47, 157, 120];
const BRAND_LIGHT_RGB = [79, 223, 163];
const BRAND_DARK_RGB = [39, 125, 94];
const BRAND_SOFT_RGB = [232, 255, 245];
const MUTED_RGB = [92, 107, 117];

const CHART_BLUE = [66, 153, 225];
const CHART_PURPLE = [159, 122, 234];
const CHART_ORANGE = [237, 137, 54];
const GLUCOSE_LOW = [252, 129, 129];
const GLUCOSE_HIGH = [237, 137, 54];
const GLUCOSE_OK = [47, 157, 120];

const CATEGORY_COLORS = {
  alimentacao: CHART_BLUE,
  glicose: BRAND_RGB,
  insulina: CHART_PURPLE,
  medicacao: CHART_ORANGE,
};

const GLUCOSE_CHART_MIN = 0;
const GLUCOSE_CHART_MAX = 400;
const GLUCOSE_CHART_STEP = 50;
const GLUCOSE_TARGET_LOW = 70;
const GLUCOSE_TARGET_HIGH = 180;
const GLUCOSE_VERY_HIGH = 250;
const GLUCOSE_DAILY_CHART_PLOT_H = 36;

const PIE_PALETTE = [
  BRAND_RGB,
  CHART_BLUE,
  CHART_ORANGE,
  CHART_PURPLE,
  GLUCOSE_LOW,
  [72, 187, 187],
  [102, 126, 234],
  BRAND_LIGHT_RGB,
  BRAND_DARK_RGB,
  [232, 184, 74],
  [176, 122, 204],
  GLUCOSE_HIGH,
];

const REPORT_CARD_GAP = 5;
const REPORT_CARD_HEIGHT = 28;
const REPORT_CARD_RADIUS = 3;
const REPORT_SECTION_GAP = 12;
const REPORT_BLOCK_GAP = 8;
const REPORT_CHART_HEIGHT = 38;
const REPORT_PANEL_PAD = 6;
const REPORT_PANEL_RADIUS = 3;
const REPORT_TEXT = {
  caption: 7.5,
  body: 9,
  subsection: 10.5,
  section: 13,
  header: 16,
  metric: 16,
  metricSuffix: 7,
};

function getReportContentWidth(doc) {
  return doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2;
}

function addSectionSpacer(y, size = REPORT_SECTION_GAP) {
  return y + size;
}

function drawSoftPanel(doc, x, y, width, height) {
  doc.setFillColor(252, 253, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, width, height, REPORT_PANEL_RADIUS, REPORT_PANEL_RADIUS, 'FD');
}

function drawMetricCard(doc, x, y, width, height, { label, value, suffix = '', accentColor = BRAND_RGB }) {
  drawSoftPanel(doc, x, y, width, height);
  doc.setFillColor(...accentColor);
  doc.roundedRect(x, y + 0.2, width, 3, REPORT_CARD_RADIUS, REPORT_CARD_RADIUS, 'F');

  const centerX = x + width / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(REPORT_TEXT.caption);
  doc.setTextColor(...MUTED_RGB);
  doc.text(pdfText(label), centerX, y + 10, { align: 'center', maxWidth: width - 8 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(REPORT_TEXT.metric);
  doc.setTextColor(30, 41, 51);
  doc.text(pdfText(String(value)), centerX, y + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  if (suffix) {
    doc.setFontSize(REPORT_TEXT.metricSuffix);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(suffix), centerX, y + 24.5, { align: 'center' });
  }
}

function pdfText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function assignPieColors(series = [], preserveExisting = true) {
  return (series || [])
    .filter((item) => Number(item.value) > 0)
    .map((item, index) => ({
      ...item,
      color:
        preserveExisting && item.color
          ? item.color
          : PIE_PALETTE[index % PIE_PALETTE.length],
    }));
}

function ensureDailySeries(entries = [], series = [], periodLabel = 'Período') {
  if (Array.isArray(series) && series.length) return series;
  if (!entries.length) return [];
  return [{ date: 'period', label: periodLabel || 'Período', value: entries.length }];
}

function ensureBreakdownSeries(entries = [], builtSeries = [], fallbackLabel, fallbackColor) {
  if (Array.isArray(builtSeries) && builtSeries.length) return builtSeries;
  if (!entries.length) return [];
  return [{ label: fallbackLabel, value: entries.length, color: fallbackColor }];
}

function buildGlycemicRangeSeries(readings = []) {
  let inRange = 0;
  let high = 0;
  let low = 0;

  readings.forEach((entry) => {
    const value = Number(entry?.value);
    if (!Number.isFinite(value) || value <= 0) return;
    if (value < GLUCOSE_TARGET_LOW) low += 1;
    else if (value > GLUCOSE_TARGET_HIGH) high += 1;
    else inRange += 1;
  });

  const slices = [
    { label: 'No alvo', value: inRange, color: BRAND_RGB },
    { label: 'Alta', value: high, color: GLUCOSE_HIGH },
    { label: 'Baixa', value: low, color: GLUCOSE_LOW },
  ].filter((item) => item.value > 0);

  return slices;
}

function buildGlycemicIndicatorBars(metrics = {}) {
  return [
    {
      label: 'Média glicose',
      value: metrics.average ?? 0,
      display: metrics.average != null ? `${metrics.average} mg/dL` : '—',
      max: GLUCOSE_CHART_MAX,
      color: BRAND_RGB,
    },
    {
      label: 'Tempo no alvo',
      value: metrics.tir ?? 0,
      display: metrics.tir != null ? `${metrics.tir}%` : '—',
      max: 100,
      color: BRAND_LIGHT_RGB,
    },
    {
      label: 'Variabilidade',
      value: metrics.variability ?? 0,
      display: metrics.variability != null ? `${metrics.variability} mg/dL` : '—',
      max: 120,
      color: CHART_ORANGE,
    },
    {
      label: 'GMI estimado',
      value: metrics.gmi ?? 0,
      display: metrics.gmi != null ? `${metrics.gmi}%` : '—',
      max: 12,
      color: CHART_BLUE,
    },
  ].filter((item) => Number(item.value) > 0);
}

function buildCategoryBreakdownSeries(entries = [], getLabel, palette) {
  const map = new Map();
  entries.forEach((entry) => {
    const label = pdfText(getLabel(entry) || 'Outros').slice(0, 18) || 'Outros';
    map.set(label, (map.get(label) || 0) + 1);
  });

  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, value], index) => ({
      label,
      value,
      color: palette[index % palette.length],
    }));
}

function buildInsulinBreakdownSeries(entries = []) {
  return buildCategoryBreakdownSeries(
    entries,
    (entry) => entry?.insulinCategory || entry?.medicineName || 'Insulina',
    [CHART_PURPLE, BRAND_RGB, CHART_ORANGE, CHART_BLUE, BRAND_DARK_RGB]
  );
}

function buildMedicationBreakdownSeries(entries = []) {
  return buildCategoryBreakdownSeries(
    entries,
    (entry) => entry?.medicineName || entry?.nome_medicamento || entry?.label || 'Medicamento',
    [CHART_ORANGE, CHART_PURPLE, CHART_BLUE, BRAND_RGB, GLUCOSE_HIGH]
  );
}

function resolveFollowUpPeriodLabel(professionalName, periodLabel) {
  const period = periodLabel || '7 dias';
  if (!professionalName || professionalName === '—') return '—';
  return `Acompanhamento ativo · ${period}`;
}

function buildRecordTotalsSeries(summary = {}) {
  return [
    { label: 'Alimentação', value: summary.meals ?? 0, color: CATEGORY_COLORS.alimentacao },
    { label: 'Glicose', value: summary.glucose ?? 0, color: CATEGORY_COLORS.glicose },
    { label: 'Insulina', value: summary.insulin ?? 0, color: CATEGORY_COLORS.insulina },
    { label: 'Medicação', value: summary.medication ?? 0, color: CATEGORY_COLORS.medicacao },
  ];
}

function addPatientHeader(doc, bundle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('GLICNUTRI · RELATÓRIO CLÍNICO', PAGE_MARGIN, 11);
  doc.setFontSize(16);
  doc.text('Relatório Clínico do Paciente', PAGE_MARGIN, 22);
  doc.setFontSize(9);
  doc.text(
    pdfText(bundle.periodRangeLabel || bundle.periodLabel || 'Período selecionado'),
    PAGE_MARGIN,
    30
  );

  doc.setTextColor(47, 52, 56);
  doc.setFontSize(10);
  let y = 44;
  doc.text(`Paciente: ${pdfText(bundle.patientName)}`, PAGE_MARGIN, y);
  y += 5;
  doc.text(
    `Período: ${pdfText(bundle.periodLabel)}  ·  Gerado em: ${pdfText(bundle.generatedAt)}`,
    PAGE_MARGIN,
    y
  );
  y += 5;
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text(
    `Total no relatório: ${(bundle.summary?.meals ?? 0) + (bundle.summary?.glucose ?? 0) + (bundle.summary?.insulin ?? 0) + (bundle.summary?.medication ?? 0)} registros`,
    PAGE_MARGIN,
    y
  );
  return y + 8;
}

function addPersonalProfileSection(doc, startY, profile = {}) {
  let y = addSectionTitle(doc, startY, 'Dados pessoais');
  y = addKpiRow(doc, y, [
    { label: 'Idade', value: profile.age || '—' },
    { label: 'Peso', value: profile.weight || '—' },
    { label: 'Altura', value: profile.height || '—' },
    { label: 'IMC', value: profile.bmi || '—' },
  ]);
  return y;
}

function addFollowUpSection(doc, startY, profile = {}, autoTable, periodLabel) {
  let y = addSectionTitle(doc, startY, 'Equipe de acompanhamento');

  autoTable(doc, {
    startY: y,
    head: [['Papel', 'Profissional', 'Tempo de acompanhamento']],
    body: [
      [
        'Nutricionista',
        pdfText(profile.nutricionistaNome || '—'),
        resolveFollowUpPeriodLabel(profile.nutricionistaNome, periodLabel),
      ],
      [
        'Médico',
        pdfText(profile.medicoNome || '—'),
        resolveFollowUpPeriodLabel(profile.medicoNome, periodLabel),
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND_RGB, fontSize: 9, textColor: 255 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 58 },
      2: { cellWidth: 'auto' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: PAGE_TOP, bottom: PAGE_BOTTOM_PADDING },
    theme: 'grid',
  });

  return (doc.lastAutoTable?.finalY || y) + 8;
}

function addRecordTotalsSection(doc, startY, summary = {}) {
  let y = addSectionTitle(doc, startY, 'Totais de registros no período');
  y = addKpiRow(doc, y, buildRecordTotalsSeries(summary));
  return y;
}

function addSectionTitle(doc, y, title) {
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_RGB);
  doc.text(pdfText(title), PAGE_MARGIN, y);
  doc.setDrawColor(217, 224, 231);
  doc.line(PAGE_MARGIN, y + 2, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y + 2);
  return y + 10;
}

function addSubsectionTitle(doc, y, title) {
  doc.setFontSize(10);
  doc.setTextColor(47, 52, 56);
  doc.text(pdfText(title), PAGE_MARGIN, y);
  return y + 7;
}

function addReportPartTitle(doc, y, partNumber, title, subtitle = '') {
  const pageWidth = doc.internal.pageSize.getWidth();
  y = ensurePageSpace(doc, y, subtitle ? 22 : 16);
  doc.setFillColor(...BRAND_SOFT_RGB);
  doc.roundedRect(PAGE_MARGIN, y - 3, pageWidth - PAGE_MARGIN * 2, subtitle ? 14 : 10, 1.5, 1.5, 'F');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_DARK_RGB);
  doc.text(`${partNumber}. ${pdfText(title)}`, PAGE_MARGIN + 3, y + 4);
  if (subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(subtitle), PAGE_MARGIN + 3, y + 9);
    return y + 16;
  }
  return y + 12;
}

const TABLE_MARGIN = {
  left: PAGE_MARGIN,
  right: PAGE_MARGIN,
  top: PAGE_TOP,
  bottom: PAGE_BOTTOM_PADDING,
};

const TABLE_HEAD_STYLE = { fillColor: BRAND_RGB, textColor: 255, fontStyle: 'bold', fontSize: 8.5 };
const TABLE_BODY_STYLE = { fontSize: 8, cellPadding: 2.2, textColor: [47, 52, 56] };

function renderRecordsTable(
  doc,
  autoTable,
  startY,
  title,
  head,
  rows,
  emptyMessage,
  columns = 3,
  theme = 'striped'
) {
  let y = ensurePageSpace(doc, startY, 28);
  y = addSectionTitle(doc, y, title);
  autoTable(doc, {
    startY: y,
    head,
    body: buildTableBody(rows, emptyMessage, columns),
    styles: TABLE_BODY_STYLE,
    headStyles: TABLE_HEAD_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: TABLE_MARGIN,
    theme,
    showHead: 'everyPage',
  });
  return (doc.lastAutoTable?.finalY || y) + 10;
}

function addKpiRow(doc, startY, items) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const gap = 4;
  const cardW = (pageWidth - PAGE_MARGIN * 2 - gap * (items.length - 1)) / items.length;
  let x = PAGE_MARGIN;

  items.forEach((item) => {
    doc.setFillColor(247, 249, 251);
    doc.setDrawColor(216, 224, 231);
    doc.roundedRect(x, startY, cardW, 22, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(item.label), x + 3, startY + 7);
    doc.setFontSize(13);
    doc.setTextColor(...BRAND_DARK_RGB);
    doc.text(pdfText(String(item.value)), x + 3, startY + 17);
    x += cardW + gap;
  });

  return startY + 28;
}

function ensurePageSpace(doc, y, neededHeight = CHART_BLOCK_HEIGHT) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - PAGE_BOTTOM_PADDING;

  if (y + neededHeight > bottomLimit) {
    doc.addPage();
    return PAGE_TOP;
  }

  return y;
}

function drawEmptyChartMessage(doc, y, message = 'Sem registros no período selecionado.') {
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_RGB);
  doc.text(pdfText(message), PAGE_MARGIN, y + 4);
  return y + 12;
}

function drawPieSlice(doc, cx, cy, radius, startAngle, endAngle, rgb) {
  const steps = Math.max(40, Math.ceil(((endAngle - startAngle) / (2 * Math.PI)) * 100));
  const sliceAngle = endAngle - startAngle;
  doc.setFillColor(...rgb);
  doc.setDrawColor(...rgb);
  doc.setLineWidth(0);

  const segments = [];
  let prevX = cx;
  let prevY = cy;
  const arcStartX = cx + radius * Math.cos(startAngle);
  const arcStartY = cy + radius * Math.sin(startAngle);
  segments.push([arcStartX - prevX, arcStartY - prevY]);
  prevX = arcStartX;
  prevY = arcStartY;

  for (let i = 1; i <= steps; i += 1) {
    const angle = startAngle + (sliceAngle * i) / steps;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    segments.push([x - prevX, y - prevY]);
    prevX = x;
    prevY = y;
  }

  segments.push([cx - prevX, cy - prevY]);
  doc.lines(segments, cx, cy, [1, 1], 'F');
}

function drawPieChart(doc, startY, title, series, { preserveColors = true } = {}) {
  let y = ensurePageSpace(doc, startY, 82);
  y = addSectionTitle(doc, y, title);

  const slices = assignPieColors(series, preserveColors);
  const total = slices.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  if (!total) {
    return drawEmptyChartMessage(doc, y);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const cx = PAGE_MARGIN + 28;
  const cy = y + 26;
  const radius = 24;
  let angle = -Math.PI / 2;

  slices.forEach((slice) => {
    const portion = (Number(slice.value) || 0) / total;
    const endAngle = angle + portion * 2 * Math.PI;
    drawPieSlice(doc, cx, cy, radius, angle, endAngle, slice.color || BRAND_RGB);
    angle = endAngle;
  });

  const legendX = PAGE_MARGIN + 62;
  let legendY = y + 8;
  const legendMaxW = pageWidth - legendX - PAGE_MARGIN;
  slices.forEach((slice) => {
    const pct = Math.round(((Number(slice.value) || 0) / total) * 100);
    doc.setFillColor(...(slice.color || BRAND_RGB));
    doc.roundedRect(legendX, legendY - 3.5, 4.5, 4.5, 0.5, 0.5, 'F');
    doc.setFontSize(8);
    doc.setTextColor(47, 52, 56);
    doc.text(
      `${pdfText(slice.label)}: ${slice.value} (${pct}%)`,
      legendX + 7,
      legendY,
      { maxWidth: legendMaxW }
    );
    legendY += 6.5;
  });

  return Math.max(cy + radius + 10, legendY + 4);
}

function drawHorizontalBarChart(doc, startY, title, series) {
  let y = ensurePageSpace(doc, startY, 52);
  y = addSectionTitle(doc, y, title);

  const items = series || [];
  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);
  const pageWidth = doc.internal.pageSize.getWidth();
  const barAreaW = pageWidth - PAGE_MARGIN * 2 - 38;
  const barH = 7;
  const gap = 5;

  if (!items.some((item) => Number(item.value) > 0)) {
    return drawEmptyChartMessage(doc, y);
  }

  items.forEach((item) => {
    const val = Number(item.value) || 0;
    const barW = Math.max(2, (val / max) * barAreaW);
    doc.setFontSize(8);
    doc.setTextColor(47, 52, 56);
    doc.text(pdfText(item.label).slice(0, 14), PAGE_MARGIN, y + 5);
    doc.setFillColor(240, 244, 247);
    doc.roundedRect(PAGE_MARGIN + 36, y, barAreaW, barH, 1, 1, 'F');
    doc.setFillColor(...(item.color || BRAND_RGB));
    doc.roundedRect(PAGE_MARGIN + 36, y, barW, barH, 1, 1, 'F');
    doc.text(String(val), PAGE_MARGIN + 36 + barAreaW + 3, y + 5);
    y += barH + gap;
  });

  return y + 4;
}

function drawColumnChart(doc, startY, title, series, { valueSuffix = '', color = BRAND_RGB, maxValue } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const chartW = pageWidth - PAGE_MARGIN * 2;
  const chartH = 36;
  const trackH = chartH - 6;
  let y = ensurePageSpace(doc, startY, CHART_BLOCK_HEIGHT);
  y = addSectionTitle(doc, y, title);

  if (!series?.length) {
    return drawEmptyChartMessage(doc, y);
  }

  const max = maxValue || Math.max(...series.map((s) => Number(s.value) || 0), 1);
  const count = series.length;
  const slotW = chartW / count;
  const barW = Math.min(7, Math.max(4, slotW * 0.28));
  const baseY = y + chartH;
  const trackTop = baseY - trackH;
  const trackRadius = 1.2;

  series.forEach((point, index) => {
    const val = Number(point.value) || 0;
    const fillH = val > 0 ? Math.max(3, (val / max) * trackH) : 0;
    const slotCenter = PAGE_MARGIN + slotW * index + slotW / 2;
    const x = slotCenter - barW / 2;
    const barColor = point.color || color;
    const rgb = Array.isArray(barColor) ? barColor : color;

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(x, trackTop, barW, trackH, trackRadius, trackRadius, 'F');

    if (fillH > 0) {
      doc.setFillColor(...rgb);
      doc.roundedRect(x, baseY - fillH, barW, fillH, trackRadius, trackRadius, 'F');
    }

    doc.setFontSize(7);
    doc.setTextColor(47, 52, 56);
    doc.text(pdfText(point.label).slice(0, 8), slotCenter, baseY + 5, { align: 'center' });
    if (point.rangeLabel) {
      doc.setFontSize(5.5);
      doc.setTextColor(...MUTED_RGB);
      doc.text(pdfText(point.rangeLabel).slice(0, 14), slotCenter, baseY + 9, { align: 'center' });
    }
    if (val > 0 && count <= 7) {
      doc.setTextColor(...rgb);
      doc.text(`${val}${valueSuffix}`, slotCenter, baseY - fillH - 2.5, { align: 'center' });
    }
  });

  return baseY + (series.some((point) => point.rangeLabel) ? 16 : 12);
}

function drawMetricBarChart(doc, startY, title, series) {
  let y = ensurePageSpace(doc, startY, 52);
  y = addSectionTitle(doc, y, title);

  const items = (series || []).filter((item) => Number(item.value) > 0);
  if (!items.length) {
    return drawEmptyChartMessage(doc, y);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const barAreaW = pageWidth - PAGE_MARGIN * 2 - 52;
  const barH = 7;
  const gap = 5;

  items.forEach((item) => {
    const val = Number(item.value) || 0;
    const max = Number(item.max) || Math.max(val, 1);
    const barW = Math.max(2, (val / max) * barAreaW);
    doc.setFontSize(8);
    doc.setTextColor(47, 52, 56);
    doc.text(pdfText(item.label).slice(0, 16), PAGE_MARGIN, y + 5);
    doc.setFillColor(240, 244, 247);
    doc.roundedRect(PAGE_MARGIN + 40, y, barAreaW, barH, 1, 1, 'F');
    doc.setFillColor(...(item.color || BRAND_RGB));
    doc.roundedRect(PAGE_MARGIN + 40, y, barW, barH, 1, 1, 'F');
    doc.text(String(item.display ?? val), PAGE_MARGIN + 40 + barAreaW + 3, y + 5);
    y += barH + gap;
  });

  return y + 4;
}

function computeTrendChartScale(values = [], { minValue = 0, maxValue } = {}) {
  const dataMax = Math.max(...values.map((value) => Number(value) || 0), 0);
  let max = Number(maxValue);
  if (!Number.isFinite(max) || max <= minValue) {
    max = Math.max(Math.ceil(dataMax * 1.2), minValue + 1);
  }
  if (max <= 6) max = Math.max(max, Math.ceil(dataMax) + 1);
  else if (max <= 12) max = Math.ceil(max / 2) * 2;
  else max = Math.ceil(max / 5) * 5;

  let step = 1;
  if (max <= 6) step = 1;
  else if (max <= 12) step = 2;
  else step = Math.max(1, Math.ceil(max / 4));

  return { minValue, maxValue: max, step };
}

function buildLineChartPoints(series, chartX, chartW, baseY, plotH, minValue, maxValue, padX = 5) {
  const count = series.length;
  const plotW = Math.max(chartW - padX * 2, 1);
  const range = Math.max(maxValue - minValue, 1);
  const stepX = count > 1 ? plotW / (count - 1) : 0;

  return series.map((point, index) => {
    const val = Number(point.value) || 0;
    const px = count > 1 ? chartX + padX + index * stepX : chartX + chartW / 2;
    const clamped = Math.min(maxValue, Math.max(minValue, val));
    const py = baseY - ((clamped - minValue) / range) * plotH;
    return { px, py, val, label: point.label };
  });
}

function drawLineChartFrame(doc, boxX, boxY, boxW, boxH, chartX, chartW, baseY, plotH, {
  minValue,
  maxValue,
  step,
  labelW,
  unitLabel = '',
  targetBand = null,
}) {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(216, 224, 231);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');

  if (targetBand) {
    const targetTopY = baseY - ((targetBand.high - minValue) / Math.max(maxValue - minValue, 1)) * plotH;
    const targetBottomY = baseY - ((targetBand.low - minValue) / Math.max(maxValue - minValue, 1)) * plotH;
    doc.setFillColor(...(targetBand.color || BRAND_SOFT_RGB));
    doc.rect(chartX, targetTopY, chartW, targetBottomY - targetTopY, 'F');
  }

  for (let mark = minValue; mark <= maxValue; mark += step) {
    const gridY = baseY - ((mark - minValue) / Math.max(maxValue - minValue, 1)) * plotH;
    doc.setDrawColor(235, 240, 245);
    doc.setLineWidth(0.25);
    doc.line(chartX, gridY, chartX + chartW, gridY);
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED_RGB);
    doc.text(String(mark), boxX + labelW - 2, gridY + 1, { align: 'right' });
  }

  if (unitLabel) {
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED_RGB);
    doc.text(unitLabel, boxX + 2, boxY + 4);
  }
}

function drawLineChartSeries(
  doc,
  points,
  {
    color = BRAND_RGB,
    valueSuffix = '',
    baseY,
    boxY,
    dotRadius = 2.2,
    showAllValues = false,
    showAxisLabels = true,
    minMaxLabelsOnly = false,
  } = {}
) {
  if (points.length < 1) return;

  doc.setDrawColor(...color);
  doc.setLineWidth(1.2);
  for (let i = 1; i < points.length; i += 1) {
    doc.line(points[i - 1].px, points[i - 1].py, points[i].px, points[i].py);
  }

  let minIndex = 0;
  let maxIndex = 0;
  if (minMaxLabelsOnly && points.length > 1) {
    points.forEach((point, index) => {
      if (point.val < points[minIndex].val) minIndex = index;
      if (point.val > points[maxIndex].val) maxIndex = index;
    });
  }

  points.forEach((point, index) => {
    doc.setFillColor(...color);
    doc.circle(point.px, point.py, dotRadius, 'F');

    const shouldShowValue =
      showAllValues || (minMaxLabelsOnly && (index === minIndex || index === maxIndex));

    if (shouldShowValue) {
      const valueY = point.py - (dotRadius + 2.5);
      const safeValueY = Math.max(boxY + 5, valueY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(47, 52, 56);
      doc.text(`${point.val}${valueSuffix}`, point.px, safeValueY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    }

    if (showAxisLabels && point.axisLabel) {
      doc.setFontSize(6);
      doc.setTextColor(...MUTED_RGB);
      doc.text(pdfText(point.axisLabel).slice(0, 8), point.px, baseY + 4.5, { align: 'center' });
    }
  });
}

function drawTrendLineChart(
  doc,
  startY,
  title,
  series,
  { color = BRAND_RGB, minValue = 0, maxValue, step, valueSuffix = '', unitLabel = '' } = {}
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const labelW = 14;
  const padX = 5;
  const padTop = 8;
  const padBottom = 10;
  const plotH = 32;
  const boxW = pageWidth - PAGE_MARGIN * 2;
  const chartW = boxW - labelW - 4;
  const boxH = padTop + plotH + padBottom;
  let y = ensurePageSpace(doc, startY, boxH + 16);
  y = addSectionTitle(doc, y, title);

  if (!series?.length) {
    return drawEmptyChartMessage(doc, y);
  }

  const values = series.map((point) => point.value);
  const scale = computeTrendChartScale(values, { minValue, maxValue });
  const chartStep = step || scale.step;
  const boxY = y + 1;
  const chartX = PAGE_MARGIN + labelW;
  const baseY = boxY + padTop + plotH;

  drawLineChartFrame(doc, PAGE_MARGIN, boxY, boxW, boxH, chartX, chartW, baseY, plotH, {
    minValue: scale.minValue,
    maxValue: scale.maxValue,
    step: chartStep,
    labelW,
    unitLabel,
  });

  const points = buildLineChartPoints(
    series,
    chartX,
    chartW,
    baseY,
    plotH,
    scale.minValue,
    scale.maxValue,
    padX
  );

  drawLineChartSeries(doc, points, {
    color,
    valueSuffix,
    baseY,
    boxY,
    dotRadius: 2.2,
  });

  return boxY + boxH + 6;
}

function drawGlucoseAverageChart(doc, startY, title, series) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const labelW = 14;
  const padX = 5;
  const padTop = 8;
  const padBottom = 10;
  const plotH = 34;
  const boxW = pageWidth - PAGE_MARGIN * 2;
  const chartW = boxW - labelW - 4;
  const boxH = padTop + plotH + padBottom;
  let y = ensurePageSpace(doc, startY, boxH + 16);
  y = addSectionTitle(doc, y, title);

  if (!series?.length) {
    return drawEmptyChartMessage(doc, y);
  }

  const boxY = y + 1;
  const chartX = PAGE_MARGIN + labelW;
  const baseY = boxY + padTop + plotH;

  drawLineChartFrame(doc, PAGE_MARGIN, boxY, boxW, boxH, chartX, chartW, baseY, plotH, {
    minValue: GLUCOSE_CHART_MIN,
    maxValue: GLUCOSE_CHART_MAX,
    step: GLUCOSE_CHART_STEP,
    labelW,
    unitLabel: 'mg/dL',
    targetBand: {
      low: GLUCOSE_TARGET_LOW,
      high: GLUCOSE_TARGET_HIGH,
      color: BRAND_SOFT_RGB,
    },
  });

  const points = buildLineChartPoints(
    series,
    chartX,
    chartW,
    baseY,
    plotH,
    GLUCOSE_CHART_MIN,
    GLUCOSE_CHART_MAX,
    padX
  );

  drawLineChartSeries(doc, points.map((point) => ({ ...point, axisLabel: point.label })), {
    color: BRAND_RGB,
    baseY,
    boxY,
    dotRadius: 2.4,
    showAllValues: true,
    showAxisLabels: true,
  });

  return boxY + boxH + 6;
}

function addFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_RGB);
    doc.text(
      `GlicNutri · Uso pessoal · Página ${page} de ${pageCount}`,
      PAGE_MARGIN,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.setTextColor(brand.slate);
  }
}

function ensureGlucoseChartSeries(readings = [], series = []) {
  if (Array.isArray(series) && series.some((item) => Number(item.value) > 0)) {
    return series;
  }

  const buckets = new Map();
  (readings || []).forEach((entry) => {
    const date = String(entry?.date || entry?.data || '').slice(0, 10);
    const value = Number(entry?.value);
    if (!date || !Number.isFinite(value) || value <= 0) return;
    const bucket = buckets.get(date) || { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(date, bucket);
  });

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => {
      const avg = Math.round(stats.sum / stats.count);
      return {
        date,
        label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
        value: avg,
        color: avg < 70 ? GLUCOSE_LOW : avg > 180 ? GLUCOSE_HIGH : GLUCOSE_OK,
      };
    });
}

function ensureWeeklySeries(entries = [], series = [], periodLabel = 'Período') {
  if (Array.isArray(series) && series.length) return series;
  if (!entries.length) return [];
  return [{ date: 'week', label: 'Semana', value: entries.length, rangeLabel: periodLabel }];
}

function drawDailyWeeklyCharts(
  doc,
  startY,
  titlePrefix,
  dailySeries,
  weeklySeries,
  { color = BRAND_RGB, unitLabel = 'registros' } = {}
) {
  let y = startY;

  y = addSubsectionTitle(doc, y, 'Por dia');
  y = drawColumnChart(doc, y, `${titlePrefix} — colunas`, dailySeries, { color });
  y = drawTrendLineChart(doc, y, `${titlePrefix} — linhas`, dailySeries, {
    color,
    unitLabel,
  });

  if (Array.isArray(weeklySeries) && weeklySeries.length) {
    y = addSubsectionTitle(doc, y, 'Por semana');
    y = drawColumnChart(doc, y, `${titlePrefix} — colunas`, weeklySeries, { color });
    y = drawTrendLineChart(doc, y, `${titlePrefix} — linhas`, weeklySeries, {
      color,
      unitLabel,
    });
  }

  return y;
}

function buildTableBody(rows, emptyMessage, columns = 3) {
  if (Array.isArray(rows) && rows.length) return rows;
  return [Array.from({ length: columns }, (_, index) => (index === 0 ? emptyMessage : '—'))];
}

function drawGlucoseTimelineChart(doc, startY, title, series) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const labelW = 14;
  const padX = 4;
  const padTop = 8;
  const padBottom = 12;
  const plotH = 38;
  const boxW = pageWidth - PAGE_MARGIN * 2;
  const chartW = boxW - labelW - 4;
  const boxH = padTop + plotH + padBottom;
  let y = ensurePageSpace(doc, startY, boxH + 16);
  y = addSectionTitle(doc, y, title);

  if (!series?.length) {
    return drawEmptyChartMessage(doc, y);
  }

  const boxY = y + 1;
  const chartX = PAGE_MARGIN + labelW;
  const baseY = boxY + padTop + plotH;

  drawLineChartFrame(doc, PAGE_MARGIN, boxY, boxW, boxH, chartX, chartW, baseY, plotH, {
    minValue: GLUCOSE_CHART_MIN,
    maxValue: GLUCOSE_CHART_MAX,
    step: GLUCOSE_CHART_STEP,
    labelW,
    unitLabel: 'mg/dL',
    targetBand: {
      low: GLUCOSE_TARGET_LOW,
      high: GLUCOSE_TARGET_HIGH,
      color: BRAND_SOFT_RGB,
    },
  });

  const points = buildLineChartPoints(
    series,
    chartX,
    chartW,
    baseY,
    plotH,
    GLUCOSE_CHART_MIN,
    GLUCOSE_CHART_MAX,
    padX
  );

  drawLineChartSeries(doc, points, {
    color: BRAND_RGB,
    baseY,
    boxY,
    dotRadius: 1.8,
  });

  return boxY + boxH + 6;
}

function drawStackedDailyBars(doc, startY, title, seriesA, seriesB, { labelA = 'Basal', labelB = 'Bolus', colorA = CHART_PURPLE, colorB = BRAND_RGB } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const chartW = pageWidth - PAGE_MARGIN * 2;
  const chartH = 38;
  const trackH = chartH - 6;
  let y = ensurePageSpace(doc, startY, CHART_BLOCK_HEIGHT);
  y = addSectionTitle(doc, y, title);

  const count = Math.max(seriesA?.length || 0, seriesB?.length || 0);
  if (!count) return drawEmptyChartMessage(doc, y);

  const max = Math.max(
    ...Array.from({ length: count }, (_, index) => (Number(seriesA[index]?.value) || 0) + (Number(seriesB[index]?.value) || 0)),
    1
  );
  const slotW = chartW / count;
  const barW = Math.min(8, Math.max(5, slotW * 0.32));
  const baseY = y + chartH;
  const trackTop = baseY - trackH;

  for (let index = 0; index < count; index += 1) {
    const basal = Number(seriesA[index]?.value) || 0;
    const bolus = Number(seriesB[index]?.value) || 0;
    const total = basal + bolus;
    const fillH = total > 0 ? Math.max(3, (total / max) * trackH) : 0;
    const basalH = total > 0 ? (basal / total) * fillH : 0;
    const bolusH = fillH - basalH;
    const slotCenter = PAGE_MARGIN + slotW * index + slotW / 2;
    const x = slotCenter - barW / 2;
    const label = seriesA[index]?.label || seriesB[index]?.label || '—';

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(x, trackTop, barW, trackH, 1.2, 1.2, 'F');

    if (fillH > 0) {
      if (basalH > 0) {
        doc.setFillColor(...colorA);
        doc.roundedRect(x, baseY - fillH, barW, basalH, 1.2, 1.2, 'F');
      }
      if (bolusH > 0) {
        doc.setFillColor(...colorB);
        doc.rect(x, baseY - bolusH, barW, bolusH, 'F');
      }
    }

    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(label).slice(0, 8), slotCenter, baseY + 5, { align: 'center' });
    if (total > 0) {
      doc.setTextColor(47, 52, 56);
      doc.text(String(Math.round(total * 10) / 10), slotCenter, baseY - fillH - 2, { align: 'center' });
    }
  }

  doc.setFontSize(7);
  doc.setTextColor(...MUTED_RGB);
  doc.text(`${labelA} + ${labelB} (UI/dia)`, PAGE_MARGIN, baseY + 11);
  return baseY + 16;
}

function drawGlucoseDayProfileChart(doc, startY, profile) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const labelW = 14;
  const padX = 4;
  const padTop = 6;
  const padBottom = 10;
  const plotH = 28;
  const boxW = pageWidth - PAGE_MARGIN * 2;
  const chartW = boxW - labelW - 4;
  const boxH = padTop + plotH + padBottom;
  const title = `Curva 24h — ${profile.label} (${profile.count} leituras · média ${profile.avg} mg/dL)`;
  let y = ensurePageSpace(doc, startY, boxH + 14);
  y = addSubsectionTitle(doc, y, title);

  const series = (profile.points || []).map((point) => ({
    label: point.label,
    value: point.value,
  }));

  if (!series.length) return y;

  const boxY = y + 1;
  const chartX = PAGE_MARGIN + labelW;
  const baseY = boxY + padTop + plotH;

  drawLineChartFrame(doc, PAGE_MARGIN, boxY, boxW, boxH, chartX, chartW, baseY, plotH, {
    minValue: GLUCOSE_CHART_MIN,
    maxValue: GLUCOSE_CHART_MAX,
    step: GLUCOSE_CHART_STEP,
    labelW,
    unitLabel: 'mg/dL',
    targetBand: { low: GLUCOSE_TARGET_LOW, high: GLUCOSE_TARGET_HIGH, color: BRAND_SOFT_RGB },
  });

  const points = buildLineChartPoints(
    series,
    chartX,
    chartW,
    baseY,
    plotH,
    GLUCOSE_CHART_MIN,
    GLUCOSE_CHART_MAX,
    padX
  ).map((point, index) => ({
    ...point,
    axisLabel: index % Math.max(1, Math.ceil(series.length / 6)) === 0 ? series[index]?.label : '',
  }));

  drawLineChartSeries(doc, points, {
    color: BRAND_RGB,
    baseY,
    boxY,
    dotRadius: 1.6,
    minMaxLabelsOnly: true,
    showAxisLabels: true,
  });

  return boxY + boxH + 4;
}

function drawGlucoseMinAvgMaxChart(doc, startY, title, series = []) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const chartW = pageWidth - PAGE_MARGIN * 2;
  const chartH = 40;
  const trackH = chartH - 8;
  let y = ensurePageSpace(doc, startY, chartH + 18);
  y = addSectionTitle(doc, y, title);

  const items = (series || []).filter((item) => item.count > 0);
  if (!items.length) return drawEmptyChartMessage(doc, y);

  const max = Math.max(...items.flatMap((item) => [item.min, item.avg, item.max]), 1);
  const count = items.length;
  const slotW = chartW / count;
  const groupW = Math.min(14, Math.max(8, slotW * 0.55));
  const barW = groupW / 3 - 0.5;
  const baseY = y + chartH;
  const trackTop = baseY - trackH;

  items.forEach((item, index) => {
    const slotCenter = PAGE_MARGIN + slotW * index + slotW / 2;
    const groupX = slotCenter - groupW / 2;
    const bars = [
      { value: item.min, color: CHART_BLUE },
      { value: item.avg, color: BRAND_RGB },
      { value: item.max, color: GLUCOSE_HIGH },
    ];

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(groupX, trackTop, groupW, trackH, 1, 1, 'F');

    bars.forEach((bar, barIndex) => {
      const fillH = bar.value > 0 ? Math.max(2, (bar.value / max) * trackH) : 0;
      const x = groupX + barIndex * (barW + 0.5);
      if (fillH > 0) {
        doc.setFillColor(...bar.color);
        doc.roundedRect(x, baseY - fillH, barW, fillH, 0.8, 0.8, 'F');
      }
    });

    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(item.label).slice(0, 8), slotCenter, baseY + 5, { align: 'center' });
  });

  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text('Min (azul) · Média (verde) · Máx (laranja)', PAGE_MARGIN, baseY + 11);
  return baseY + 16;
}

function drawStackedPercentBar(doc, startY, title, series = []) {
  let y = ensurePageSpace(doc, startY, 28);
  y = addSectionTitle(doc, y, title);

  const slices = assignPieColors(series, true);
  const total = slices.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  if (!total) return drawEmptyChartMessage(doc, y);

  const pageWidth = doc.internal.pageSize.getWidth();
  const barW = pageWidth - PAGE_MARGIN * 2 - 40;
  const barH = 8;
  let x = PAGE_MARGIN + 36;

  slices.forEach((slice) => {
    const portion = (Number(slice.value) || 0) / total;
    const w = Math.max(1, portion * barW);
    doc.setFillColor(...(slice.color || BRAND_RGB));
    doc.roundedRect(x, y, w, barH, 1, 1, 'F');
    x += w;
  });

  doc.setFontSize(7);
  doc.setTextColor(...MUTED_RGB);
  doc.text('0%', PAGE_MARGIN, y + 5);
  doc.text('100%', PAGE_MARGIN + 36 + barW + 2, y + 5);

  let legendY = y + barH + 5;
  slices.forEach((slice) => {
    const pct = Math.round(((Number(slice.value) || 0) / total) * 100);
    doc.setFillColor(...(slice.color || BRAND_RGB));
    doc.roundedRect(PAGE_MARGIN, legendY - 3, 3.5, 3.5, 0.5, 0.5, 'F');
    doc.setTextColor(47, 52, 56);
    doc.text(`${pdfText(slice.label)}: ${slice.value} (${pct}%)`, PAGE_MARGIN + 6, legendY);
    legendY += 5;
  });

  return legendY + 4;
}

function addExecutiveAlertsSection(doc, startY, alerts = []) {
  let y = ensurePageSpace(doc, startY, 24);
  y = addSubsectionTitle(doc, y, 'Alertas e destaques automáticos');

  if (!alerts.length) {
    return drawEmptyChartMessage(doc, y, 'Sem alertas automáticos para o período.');
  }

  alerts.forEach((alert, index) => {
    y = ensurePageSpace(doc, y, 8);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(237, 137, 54);
    doc.roundedRect(PAGE_MARGIN, y, doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2, 7, 1, 1, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(47, 52, 56);
    doc.text(`${index + 1}. ${pdfText(alert)}`, PAGE_MARGIN + 3, y + 4.5);
    y += 9;
  });

  return y + 2;
}

function renderGroupedRecordsTable(
  doc,
  autoTable,
  startY,
  title,
  head,
  groups,
  formatRow,
  emptyMessage,
  columnCount,
  columnStyles = {},
  theme = 'striped'
) {
  let y = ensurePageSpace(doc, startY, 28);
  y = addSectionTitle(doc, y, title);

  const body = [];
  if (!groups?.length) {
    body.push(...buildTableBody([], emptyMessage, columnCount));
  } else {
    groups.forEach((group) => {
      body.push([
        {
          content: `${group.label} — ${group.entries.length} registro(s)`,
          colSpan: columnCount,
          styles: {
            fillColor: BRAND_SOFT_RGB,
            fontStyle: 'bold',
            textColor: BRAND_DARK_RGB,
            fontSize: 8,
          },
        },
      ]);
      group.entries.forEach((entry) => body.push(formatRow(entry)));
    });
  }

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { ...TABLE_BODY_STYLE, overflow: 'linebreak', cellWidth: 'wrap' },
    headStyles: TABLE_HEAD_STYLE,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: TABLE_MARGIN,
    theme,
    showHead: 'everyPage',
    columnStyles,
  });

  return (doc.lastAutoTable?.finalY || y) + 10;
}

function formatReadingRow(entry) {
  return [
    entry.displayDateTime || `${entry.date || '—'} ${entry.time || ''}`.trim(),
    entry.value != null ? `${entry.value} mg/dL` : '—',
    pdfText(entry.sourceLabel || entry.source || '—').slice(0, 16),
    pdfText(entry.classificationLabel || '—'),
  ];
}

function formatMealRow(entry) {
  return [
    entry.displayDateTime || `${entry.date || '—'} ${String(entry.time || entry.hora || '').slice(0, 5)}`.trim(),
    pdfText(entry.mealTypeLabel || entry.mealLabel || entry.title || 'Refeição'),
    pdfText(entry.foodsText || entry.description || entry.title || '—'),
    `${entry.kcal || 0}`,
    `${entry.carbsG || 0}`,
    `${entry.proteinG || 0}`,
    `${entry.fatG || 0}`,
  ];
}

function resolveMealsForPdf(bundle = {}) {
  const analyticsMeals = bundle.analytics?.meals;
  if (analyticsMeals?.entries?.length) {
    return analyticsMeals;
  }

  const entries = enrichMealsForReport(bundle.mealEntries || []);
  if (!entries.length) {
    return {
      entries: [],
      hasData: false,
      typeSeries: [],
      dailySeries: [],
      macroTotals: { kcal: 0, carbsG: 0, proteinG: 0, fatG: 0 },
    };
  }

  const periodBounds = bundle.periodBounds || bundle.analytics?.periodBounds || {};
  return {
    entries,
    hasData: true,
    typeSeries: buildMealTypeSeries(entries),
    dailySeries: buildMealDailySeries(entries, periodBounds),
    caloriesDailySeries: buildMealCaloriesDailySeries(entries, periodBounds),
    carbsDailySeries: buildMealCarbsDailySeries(entries, periodBounds),
    macroBreakdownSeries: buildMealMacroBreakdownSeries(entries),
    macroTotals: buildMealMacroTotals(entries),
    groupedByDay: groupReportEntriesByDay(entries),
  };
}

function buildMealEmptyMessage(bundle = {}) {
  const period = bundle.periodRangeLabel || bundle.periodLabel || 'período selecionado';
  return `Nenhuma refeição registrada em ${period}.`;
}

function formatMedRow(entry) {
  const status = entry.statusLabel || entry.medicationStatus || 'Tomado';
  return [
    entry.displayDateTime || `${entry.date || '—'} ${entry.time || ''}`.trim(),
    pdfText(entry.medicineName || '—'),
    pdfText(entry.doseText || '—'),
    pdfText(entry.usageLabel || '—'),
    pdfText(status),
  ];
}

function formatInsulinRow(entry) {
  const note = entry.observacao || entry.medicineNote || entry.note || '';
  return [
    entry.displayDateTime || `${entry.date || '—'} ${entry.time || ''}`.trim(),
    pdfText(entry.medicineName || 'Insulina'),
    entry.doseUi ? `${entry.doseUi}` : '—',
    pdfText(entry.insulinTypeLabel || entry.insulinCategory || '—'),
    pdfText(note || '—'),
  ];
}

function drawPanelSubsectionTitle(doc, x, y, title) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(REPORT_TEXT.subsection);
  doc.setTextColor(30, 41, 51);
  doc.text(pdfText(title), x, y);
  doc.setFont('helvetica', 'normal');
  return y + 7;
}

function addFriendlyHeader(doc, bundle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerH = 36;

  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('GLICNUTRI', PAGE_MARGIN, 11);
  doc.setFontSize(REPORT_TEXT.header);
  doc.text('Seu resumo da semana', PAGE_MARGIN, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(REPORT_TEXT.body);
  doc.text(pdfText(bundle.patientName || 'Paciente'), PAGE_MARGIN, 29);
  doc.setTextColor(230, 240, 245);
  doc.setFontSize(REPORT_TEXT.caption);
  doc.text(
    pdfText(bundle.periodRangeLabel || bundle.periodLabel || 'Últimos 7 dias'),
    pageWidth - PAGE_MARGIN,
    29,
    { align: 'right' }
  );

  return headerH + 8;
}

function addFriendlySectionTitle(doc, y, title) {
  y = ensurePageSpace(doc, y, 20);
  y = addSectionSpacer(y, REPORT_BLOCK_GAP);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(REPORT_TEXT.section);
  doc.setTextColor(...BRAND_DARK_RGB);
  doc.text(pdfText(title), PAGE_MARGIN, y);
  doc.setDrawColor(...BRAND_LIGHT_RGB);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y + 3, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y + 3);
  doc.setFont('helvetica', 'normal');
  return y + 12;
}

function addLargeSummaryCards(doc, startY, cards = {}) {
  const contentWidth = getReportContentWidth(doc);
  const items = [
    { label: 'Glicose média', value: cards.average != null ? `${cards.average}` : '—', suffix: 'mg/dL', color: BRAND_RGB },
    { label: 'Tempo no alvo', value: cards.tir != null ? `${cards.tir}` : '—', suffix: '%', color: BRAND_RGB },
    { label: 'Glicose máxima', value: cards.max != null ? `${cards.max}` : '—', suffix: 'mg/dL', color: GLUCOSE_HIGH },
    { label: 'Glicose mínima', value: cards.min != null ? `${cards.min}` : '—', suffix: 'mg/dL', color: GLUCOSE_LOW },
    { label: 'Refeições', value: cards.meals ?? 0, suffix: '', color: CHART_BLUE },
    { label: 'Insulina', value: cards.insulinApps ?? 0, suffix: 'aplic.', color: CHART_PURPLE },
    { label: 'Medicações', value: cards.medications ?? 0, suffix: 'reg.', color: CHART_ORANGE },
  ];

  const cols = 4;
  const cardW = (contentWidth - REPORT_CARD_GAP * (cols - 1)) / cols;
  const cardH = REPORT_CARD_HEIGHT;
  const row2Cols = 3;
  const row2Width = cardW * row2Cols + REPORT_CARD_GAP * (row2Cols - 1);
  const row2StartX = PAGE_MARGIN + (contentWidth - row2Width) / 2;

  let y = ensurePageSpace(doc, startY, cardH * 2 + REPORT_CARD_GAP + REPORT_BLOCK_GAP);

  items.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    let x;
    if (row === 0) {
      x = PAGE_MARGIN + col * (cardW + REPORT_CARD_GAP);
    } else {
      x = row2StartX + (index - cols) * (cardW + REPORT_CARD_GAP);
    }
    const itemY = y + row * (cardH + REPORT_CARD_GAP);
    drawMetricCard(doc, x, itemY, cardW, cardH, {
      label: item.label,
      value: item.value,
      suffix: item.suffix,
      accentColor: item.color,
    });
  });

  return y + cardH * 2 + REPORT_CARD_GAP + REPORT_BLOCK_GAP;
}

function addInsightBox(doc, startY, messages = []) {
  if (!messages.length) return startY;

  const contentWidth = getReportContentWidth(doc);
  let y = startY + REPORT_BLOCK_GAP;

  messages.forEach((message) => {
    const lines = doc.splitTextToSize(pdfText(message), contentWidth - 14);
    const boxH = Math.max(14, lines.length * 4.4 + 10);
    y = ensurePageSpace(doc, y, boxH + REPORT_CARD_GAP);

    drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, boxH);
    doc.setFillColor(...BRAND_RGB);
    doc.roundedRect(PAGE_MARGIN, y, 3.5, boxH, REPORT_PANEL_RADIUS, 0, 'F');

    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...BRAND_DARK_RGB);
    doc.text(lines, PAGE_MARGIN + 9, y + 8);
    y += boxH + REPORT_CARD_GAP;
  });

  return y;
}

function addStatLine(doc, startY, stats = []) {
  const contentWidth = getReportContentWidth(doc);
  const count = Math.max(stats.length, 1);
  const cols = Math.min(count, 4);
  const cardW = (contentWidth - REPORT_CARD_GAP * (cols - 1)) / cols;
  const defaultCardH = 20;

  const layout = stats.map((stat, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cardH = stat.cardH || defaultCardH;
    return { ...stat, row, col, cardH };
  });

  const rows = Math.ceil(count / cols);
  const rowHeights = Array.from({ length: rows }, () => defaultCardH);
  layout.forEach((stat) => {
    rowHeights[stat.row] = Math.max(rowHeights[stat.row], stat.cardH);
  });

  let yCursor = 0;
  const rowOffsets = rowHeights.map((height) => {
    const offset = yCursor;
    yCursor += height + REPORT_CARD_GAP;
    return offset;
  });
  const totalH = yCursor - REPORT_CARD_GAP;

  let y = ensurePageSpace(doc, startY, totalH + REPORT_BLOCK_GAP);

  layout.forEach((stat) => {
    const x = PAGE_MARGIN + stat.col * (cardW + REPORT_CARD_GAP);
    const itemY = y + rowOffsets[stat.row];
    const cardH = rowHeights[stat.row];

    drawSoftPanel(doc, x, itemY, cardW, cardH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(stat.label), x + cardW / 2, itemY + 7, { align: 'center', maxWidth: cardW - 8 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(stat.multiline ? 9.5 : 11.5);
    doc.setTextColor(30, 41, 51);
    if (stat.multiline) {
      const lines = splitPdfLines(doc, String(stat.value), cardW - 8, 9.5);
      doc.text(lines, x + cardW / 2, itemY + 12.5, { align: 'center' });
    } else {
      doc.text(pdfText(String(stat.value)), x + cardW / 2, itemY + 15.5, {
        align: 'center',
        maxWidth: cardW - 8,
      });
    }
    doc.setFont('helvetica', 'normal');
  });

  return y + totalH + REPORT_BLOCK_GAP;
}

function drawCompactColumnChart(doc, startY, title, series, { color = BRAND_RGB } = {}) {
  const contentWidth = getReportContentWidth(doc);
  const panelPad = REPORT_PANEL_PAD;
  const chartH = REPORT_CHART_HEIGHT;
  const labelH = 9;
  const titleH = 8;
  const panelH = panelPad * 2 + titleH + chartH + labelH;
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, panelH);
  const innerX = PAGE_MARGIN + panelPad;
  const innerW = contentWidth - panelPad * 2;
  let innerY = y + panelPad;
  innerY = drawPanelSubsectionTitle(doc, innerX, innerY, title);

  if (!series?.length || !series.some((point) => Number(point.value) > 0)) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados nesta semana.', innerX, innerY + 6);
    return y + panelH + REPORT_BLOCK_GAP;
  }

  const trackH = chartH - 8;
  const baseY = innerY + chartH;
  const trackTop = baseY - trackH;
  const max = Math.max(...series.map((point) => Number(point.value) || 0), 1);
  const count = series.length;
  const slotW = innerW / count;
  const barW = Math.min(10, Math.max(5, slotW * 0.42));

  series.forEach((point, index) => {
    const val = Number(point.value) || 0;
    const fillH = val > 0 ? Math.max(2.5, (val / max) * trackH) : 0;
    const slotCenter = innerX + slotW * index + slotW / 2;
    const barX = slotCenter - barW / 2;
    const rgb = Array.isArray(point.color) ? point.color : color;

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(barX, trackTop, barW, trackH, 1.2, 1.2, 'F');
    if (fillH > 0) {
      doc.setFillColor(...rgb);
      doc.roundedRect(barX, baseY - fillH, barW, fillH, 1.2, 1.2, 'F');
    }

    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(point.label), slotCenter, baseY + 5, { align: 'center', maxWidth: slotW - 2 });
  });

  return y + panelH + REPORT_BLOCK_GAP;
}

function drawCaloriesDailyChart(doc, startY, title, series) {
  const points = enrichCalorieSeriesForPdf(series);
  const contentWidth = getReportContentWidth(doc);
  const panelPad = REPORT_PANEL_PAD;
  const valueH = 5;
  const chartH = REPORT_CHART_HEIGHT;
  const legendH = 8;
  const labelH = 8;
  const titleH = 8;
  const panelH = panelPad * 2 + titleH + valueH + chartH + labelH + legendH;
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, panelH);
  const innerX = PAGE_MARGIN + panelPad;
  const innerW = contentWidth - panelPad * 2;
  let innerY = y + panelPad;
  innerY = drawPanelSubsectionTitle(doc, innerX, innerY, title);

  if (!points.some((point) => point.value > 0)) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados nesta semana.', innerX, innerY + 6);
    return y + panelH + REPORT_BLOCK_GAP;
  }

  const trackH = chartH - 4;
  const chartTop = innerY + valueH;
  const baseY = chartTop + trackH;
  const trackTop = chartTop;
  const max = Math.max(...points.map((point) => point.value), 1);
  const count = points.length;
  const slotW = innerW / count;
  const barW = Math.min(10, Math.max(5, slotW * 0.42));

  points.forEach((point, index) => {
    const val = point.value;
    const slotCenter = innerX + slotW * index + slotW / 2;
    const barX = slotCenter - barW / 2;
    const fillH = val > 0 ? Math.max(2.5, (val / max) * trackH) : 0;
    const rgb = point.color || CALORIE_COLOR_MID;

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(barX, trackTop, barW, trackH, 1.2, 1.2, 'F');
    if (fillH > 0) {
      doc.setFillColor(...rgb);
      doc.roundedRect(barX, baseY - fillH, barW, fillH, 1.2, 1.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 51);
      doc.text(`${Math.round(val)}`, slotCenter, Math.max(chartTop + 2, baseY - fillH - 1.2), {
        align: 'center',
        maxWidth: slotW - 1,
      });
      doc.setFont('helvetica', 'normal');
    }

    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(point.label), slotCenter, baseY + 4.5, { align: 'center', maxWidth: slotW - 2 });
  });

  drawInlineLegend(doc, innerX, baseY + 8, [
    { label: 'Menor consumo', color: CALORIE_COLOR_LOW },
    { label: 'Consumo médio', color: CALORIE_COLOR_MID },
    { label: 'Maior consumo', color: CALORIE_COLOR_HIGH },
  ], innerW);

  return y + panelH + REPORT_BLOCK_GAP;
}

function drawInsulinStackedDailyChart(doc, startY, title, basalSeries, bolusSeries, mixPercents = {}) {
  const stack = mergeInsulinDailyStack(basalSeries, bolusSeries);
  const contentWidth = getReportContentWidth(doc);
  const panelPad = REPORT_PANEL_PAD;
  const valueH = 5;
  const chartH = REPORT_CHART_HEIGHT;
  const legendH = 8;
  const labelH = 8;
  const titleH = 8;
  const panelH = panelPad * 2 + titleH + valueH + chartH + labelH + legendH;
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, panelH);
  const innerX = PAGE_MARGIN + panelPad;
  const innerW = contentWidth - panelPad * 2;
  let innerY = y + panelPad;
  innerY = drawPanelSubsectionTitle(doc, innerX, innerY, title);

  if (!stack.some((day) => day.total > 0)) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados nesta semana.', innerX, innerY + 6);
    return y + panelH + REPORT_BLOCK_GAP;
  }

  const trackH = chartH - 4;
  const chartTop = innerY + valueH;
  const baseY = chartTop + trackH;
  const max = Math.max(...stack.map((day) => day.total), 1);
  const count = stack.length;
  const slotW = innerW / count;
  const barW = Math.min(10, Math.max(5, slotW * 0.42));

  stack.forEach((day, index) => {
    const slotCenter = innerX + slotW * index + slotW / 2;
    const barX = slotCenter - barW / 2;
    const basalH = day.basal > 0 ? Math.max(1.5, (day.basal / max) * trackH) : 0;
    const bolusH = day.bolus > 0 ? Math.max(1.5, (day.bolus / max) * trackH) : 0;

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(barX, chartTop, barW, trackH, 1.2, 1.2, 'F');

    if (basalH > 0) {
      doc.setFillColor(...INSULIN_BASAL_COLOR);
      doc.roundedRect(barX, baseY - basalH, barW, basalH, 1.2, 1.2, 'F');
    }
    if (bolusH > 0) {
      doc.setFillColor(...INSULIN_BOLUS_COLOR);
      doc.roundedRect(barX, baseY - basalH - bolusH, barW, bolusH, 1.2, 1.2, 'F');
    }

    if (day.total > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 51);
      doc.text(`${day.total} UI`, slotCenter, Math.max(chartTop + 2, baseY - basalH - bolusH - 1.2), {
        align: 'center',
        maxWidth: slotW - 1,
      });
      doc.setFont('helvetica', 'normal');
    }

    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(day.label), slotCenter, baseY + 4.5, { align: 'center', maxWidth: slotW - 2 });
  });

  drawInlineLegend(doc, innerX, baseY + 8, [
    { label: `Basal (${mixPercents.basal ?? 0}%)`, color: INSULIN_BASAL_COLOR },
    { label: `Bolus (${mixPercents.bolus ?? 0}%)`, color: INSULIN_BOLUS_COLOR },
  ], innerW);

  return y + panelH + REPORT_BLOCK_GAP;
}

function drawDonutChart(doc, startY, title, series, { centerX = null, boxWidth = null } = {}) {
  const contentWidth = boxWidth || getReportContentWidth(doc);
  const panelPad = REPORT_PANEL_PAD;
  const legendLineH = 7;
  const slices = assignPieColors(series, true);
  const total = slices.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const legendRows = Math.max(slices.length, 1);
  const panelH = panelPad * 2 + 8 + Math.max(42, legendRows * legendLineH + 8);
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  const panelX = centerX != null ? centerX - contentWidth / 2 : PAGE_MARGIN;
  drawSoftPanel(doc, panelX, y, contentWidth, panelH);
  const innerX = panelX + panelPad;
  let innerY = y + panelPad;
  innerY = drawPanelSubsectionTitle(doc, innerX, innerY, title);

  if (!total) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados nesta semana.', innerX, innerY + 6);
    return y + panelH + REPORT_BLOCK_GAP;
  }

  const cx = innerX + 24;
  const cy = innerY + 22;
  const radius = 20;
  const hole = 10;
  let angle = -Math.PI / 2;

  slices.forEach((slice) => {
    const portion = (Number(slice.value) || 0) / total;
    const endAngle = angle + portion * 2 * Math.PI;
    drawPieSlice(doc, cx, cy, radius, angle, endAngle, slice.color || BRAND_RGB);
    angle = endAngle;
  });

  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, hole, 'F');

  const legendX = cx + radius + 10;
  let legendY = innerY + 8;
  const legendMaxW = panelX + contentWidth - legendX - panelPad;

  slices.forEach((slice) => {
    const pct = Math.round(((Number(slice.value) || 0) / total) * 100);
    doc.setFillColor(...(slice.color || BRAND_RGB));
    doc.roundedRect(legendX, legendY - 3.5, 4, 4, 0.6, 0.6, 'F');
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(30, 41, 51);
    doc.text(`${pdfText(slice.label)} · ${pct}%`, legendX + 7, legendY, { maxWidth: legendMaxW });
    legendY += legendLineH;
  });

  return y + panelH + REPORT_BLOCK_GAP;
}

function splitPdfLines(doc, text, maxWidth, fontSize = REPORT_TEXT.body) {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(pdfText(text), Math.max(maxWidth, 8));
}

function drawInlineLegend(doc, x, y, items = [], maxWidth = 120) {
  if (!items.length) return y;
  let cursorX = x;
  let rowY = y;
  const gap = 3.5;

  items.forEach((item) => {
    doc.setFontSize(REPORT_TEXT.caption);
    const label = pdfText(item.label);
    const itemW = 4 + doc.getTextWidth(label) + gap;
    if (cursorX + itemW > x + maxWidth && cursorX > x) {
      cursorX = x;
      rowY += 4.5;
    }
    doc.setFillColor(...(item.color || BRAND_RGB));
    doc.roundedRect(cursorX, rowY - 2.5, 3, 3, 0.5, 0.5, 'F');
    doc.setTextColor(...MUTED_RGB);
    doc.text(label, cursorX + 4.5, rowY);
    cursorX += itemW;
  });

  return rowY + 5;
}

function buildGlucoseDistributionDisplaySeries(glucose = {}) {
  const mapping = [
    { key: '70 a 180', label: 'Dentro da meta', color: GLUCOSE_OK },
    { key: '181 a 250', label: 'Acima da meta', color: GLUCOSE_HIGH },
    { key: 'Acima de 250', label: 'Muito acima da meta', color: [229, 62, 62] },
    { key: 'Abaixo de 70', label: 'Abaixo da meta', color: GLUCOSE_LOW },
  ];
  const tir = glucose.tirDetailedSeries || [];

  if (tir.length) {
    return mapping.map(({ key, label, color }) => {
      const item = tir.find((entry) => entry.label === key);
      return { label, value: Number(item?.value) || 0, color };
    });
  }

  const fallback = glucose.rangeSeries || [];
  const labelMap = {
    'No alvo': 'Dentro da meta',
    Alta: 'Acima da meta',
    Baixa: 'Abaixo da meta',
  };
  return mapping.map(({ label, color }) => {
    const fallbackItem = fallback.find((entry) => labelMap[entry.label] === label);
    return { label, value: Number(fallbackItem?.value) || 0, color };
  });
}

const CALORIE_COLOR_LOW = GLUCOSE_OK;
const CALORIE_COLOR_MID = CHART_BLUE;
const CALORIE_COLOR_HIGH = GLUCOSE_HIGH;
const INSULIN_BASAL_COLOR = CHART_PURPLE;
const INSULIN_BOLUS_COLOR = BRAND_RGB;

function enrichCalorieSeriesForPdf(series = []) {
  const points = (series || []).map((point) => ({
    ...point,
    value: Number(point.value) || 0,
  }));
  const active = points.filter((point) => point.value > 0);
  if (!active.length) return points;

  const values = active.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  return points.map((point) => {
    if (point.value <= 0) return { ...point, tier: 'none' };
    if (active.length === 1 || min === max) {
      return { ...point, color: CALORIE_COLOR_MID, tier: 'mid' };
    }
    if (point.value === max) return { ...point, color: CALORIE_COLOR_HIGH, tier: 'high' };
    if (point.value === min) return { ...point, color: CALORIE_COLOR_LOW, tier: 'low' };
    if (Math.abs(point.value - avg) <= Math.max(avg * 0.08, 20)) {
      return { ...point, color: CALORIE_COLOR_MID, tier: 'mid' };
    }
    return {
      ...point,
      color: point.value > avg ? CALORIE_COLOR_HIGH : CALORIE_COLOR_MID,
      tier: point.value > avg ? 'high' : 'mid',
    };
  });
}

function mergeInsulinDailyStack(basalSeries = [], bolusSeries = []) {
  const count = Math.max(basalSeries.length, bolusSeries.length);
  return Array.from({ length: count }, (_, index) => {
    const basal = Number(basalSeries[index]?.value) || 0;
    const bolus = Number(bolusSeries[index]?.value) || 0;
    return {
      label: basalSeries[index]?.label || bolusSeries[index]?.label || '—',
      basal,
      bolus,
      total: Math.round((basal + bolus) * 10) / 10,
    };
  });
}

function resolveMedicationStatDisplay(medication = {}) {
  const names = (medication.byNameSeries || [])
    .map((item) => pdfText(item.label))
    .filter((name) => name && name !== '—');

  if (!names.length) return { value: '—', multiline: false, cardH: 20 };
  if (names.length >= 3) {
    return { value: `${names.length} medicamentos`, multiline: false, cardH: 20 };
  }

  return { value: names.join('\n'), multiline: true, cardH: 14 + names.length * 4.2 };
}

function getGlucoseDailyAverageBarColor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return [180, 188, 196];
  if (numeric < GLUCOSE_TARGET_LOW) return GLUCOSE_LOW;
  if (numeric <= GLUCOSE_TARGET_HIGH) return GLUCOSE_OK;
  if (numeric <= GLUCOSE_VERY_HIGH) return GLUCOSE_HIGH;
  return [229, 62, 62];
}

function computeGlucoseDailyBarChartScale(values = []) {
  const positive = values.filter((value) => Number(value) > 0).map(Number);
  const dataMax = positive.length ? Math.max(...positive) : GLUCOSE_TARGET_HIGH;
  let maxValue = Math.max(
    GLUCOSE_TARGET_HIGH + 20,
    Math.ceil((dataMax * 1.12) / 50) * 50
  );
  if (maxValue > GLUCOSE_CHART_MAX) maxValue = GLUCOSE_CHART_MAX;

  let step = GLUCOSE_CHART_STEP;
  if (maxValue <= 100) step = 25;
  else if (maxValue <= 150) step = 30;

  return { minValue: GLUCOSE_CHART_MIN, maxValue, step };
}

function drawGlucoseDailyAverageChartInBox(doc, startY, series, { x, width }) {
  const points = series || [];
  const activeValues = points.map((point) => Number(point.value) || 0).filter((value) => value > 0);
  const labelW = 12;
  const valueLabelH = 6;
  const dateLabelH = 7;
  const plotH = GLUCOSE_DAILY_CHART_PLOT_H;
  const chartX = x + labelW;
  const chartW = Math.max(width - labelW, 10);
  const plotTop = startY;
  const baseY = plotTop + valueLabelH + plotH;

  if (!points.length || !activeValues.length) {
    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem leituras', x + width / 2, plotTop + plotH / 2, { align: 'center' });
    return baseY + dateLabelH + 2;
  }

  const scale = computeGlucoseDailyBarChartScale(activeValues);
  const range = Math.max(scale.maxValue - scale.minValue, 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text('mg/dL', x, plotTop + 2.5);

  for (let mark = scale.minValue; mark <= scale.maxValue; mark += scale.step) {
    const gridY = baseY - ((mark - scale.minValue) / range) * plotH;
    doc.setDrawColor(235, 240, 245);
    doc.setLineWidth(0.2);
    doc.line(chartX, gridY, chartX + chartW, gridY);
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED_RGB);
    doc.text(String(mark), chartX - 1.5, gridY + 1, { align: 'right' });
  }

  if (GLUCOSE_TARGET_HIGH >= scale.minValue && GLUCOSE_TARGET_HIGH <= scale.maxValue) {
    const targetY = baseY - ((GLUCOSE_TARGET_HIGH - scale.minValue) / range) * plotH;
    doc.setDrawColor(...GLUCOSE_OK);
    doc.setLineWidth(0.55);
    doc.line(chartX, targetY, chartX + chartW, targetY);
    doc.setFontSize(5.5);
    doc.setTextColor(...GLUCOSE_OK);
    doc.text('Meta 180', chartX + chartW - 1, targetY - 1.2, { align: 'right' });
  }

  const count = points.length;
  const slotW = chartW / count;
  const barW = Math.min(7.5, Math.max(3.5, slotW * 0.46));

  points.forEach((point, index) => {
    const val = Number(point.value) || 0;
    const slotCenter = chartX + slotW * index + slotW / 2;
    const barX = slotCenter - barW / 2;
    const trackTop = plotTop + valueLabelH;

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(barX, trackTop, barW, plotH, 1.2, 1.2, 'F');

    if (val > 0) {
      const fillH = Math.max(2.5, ((val - scale.minValue) / range) * plotH);
      const barColor = getGlucoseDailyAverageBarColor(val);
      doc.setFillColor(...barColor);
      doc.roundedRect(barX, baseY - fillH, barW, fillH, 1.2, 1.2, 'F');

      const valueY = Math.max(plotTop + 2.5, baseY - fillH - 1.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(30, 41, 51);
      doc.text(`${Math.round(val)} mg/dL`, slotCenter, valueY, {
        align: 'center',
        maxWidth: slotW - 1,
      });
      doc.setFont('helvetica', 'normal');
    } else {
      doc.setFontSize(6);
      doc.setTextColor(...MUTED_RGB);
      doc.text('—', slotCenter, baseY - plotH / 2, { align: 'center' });
    }

    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(point.label), slotCenter, baseY + 4.5, { align: 'center', maxWidth: slotW - 1 });
  });

  return baseY + dateLabelH + 2;
}

function drawGlucoseWeekRow(doc, startY, barSeries, donutSeries, glucose = {}) {
  const contentWidth = getReportContentWidth(doc);
  const gap = REPORT_CARD_GAP;
  const panelW = (contentWidth - gap) / 2;
  const distributionSeries = buildGlucoseDistributionDisplaySeries(glucose);
  const legendRows = Math.max(distributionSeries.length, 3);
  const chartBlockH = 8 + GLUCOSE_DAILY_CHART_PLOT_H + 14;
  const leftLegendH = 6;
  const rightLegendExtra = Math.max(0, (legendRows - 3) * 4);
  const panelH = REPORT_PANEL_PAD * 2 + chartBlockH + leftLegendH + rightLegendExtra;
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  drawSoftPanel(doc, PAGE_MARGIN, y, panelW, panelH);
  drawSoftPanel(doc, PAGE_MARGIN + panelW + gap, y, panelW, panelH);

  const leftInnerX = PAGE_MARGIN + REPORT_PANEL_PAD;
  const rightInnerX = PAGE_MARGIN + panelW + gap + REPORT_PANEL_PAD;
  const innerW = panelW - REPORT_PANEL_PAD * 2;
  let titleY = y + REPORT_PANEL_PAD;
  drawPanelSubsectionTitle(doc, leftInnerX, titleY, 'Média por dia');
  drawPanelSubsectionTitle(doc, rightInnerX, titleY, 'Distribuição');

  const chartY = titleY + 8;
  const leftY = drawGlucoseDailyAverageChartInBox(doc, chartY, barSeries, { x: leftInnerX, width: innerW });
  drawInlineLegend(
    doc,
    leftInnerX,
    leftY + 1,
    [
      { label: 'Dentro da meta', color: GLUCOSE_OK },
      { label: 'Acima da meta', color: GLUCOSE_HIGH },
      { label: 'Muito acima', color: [229, 62, 62] },
      { label: 'Abaixo da meta', color: GLUCOSE_LOW },
    ],
    innerW
  );

  const rightY = drawDonutChartInBox(doc, chartY, distributionSeries.length ? distributionSeries : donutSeries, {
    x: rightInnerX,
    width: innerW,
    showAllLegendItems: true,
  });

  return Math.max(y + panelH, leftY + 8, rightY) + REPORT_BLOCK_GAP;
}

function drawCompactColumnChartInBox(doc, startY, series, { x, width, color = BRAND_RGB }) {
  const chartH = REPORT_CHART_HEIGHT - 4;
  const trackH = chartH - 6;
  const baseY = startY + chartH;

  if (!series?.length || !series.some((point) => Number(point.value) > 0)) {
    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem leituras', x + width / 2, startY + chartH / 2, { align: 'center' });
    return baseY + 8;
  }

  const max = Math.max(...series.map((point) => Number(point.value) || 0), 1);
  const count = series.length;
  const slotW = width / count;
  const barW = Math.min(8, Math.max(4, slotW * 0.4));
  const trackTop = baseY - trackH;

  series.forEach((point, index) => {
    const val = Number(point.value) || 0;
    const fillH = val > 0 ? Math.max(2.5, (val / max) * trackH) : 0;
    const slotCenter = x + slotW * index + slotW / 2;
    const barX = slotCenter - barW / 2;
    const rgb = Array.isArray(point.color) ? point.color : color;

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(barX, trackTop, barW, trackH, 1.2, 1.2, 'F');
    if (fillH > 0) {
      doc.setFillColor(...rgb);
      doc.roundedRect(barX, baseY - fillH, barW, fillH, 1.2, 1.2, 'F');
    }
    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(point.label), slotCenter, baseY + 5, { align: 'center', maxWidth: slotW - 2 });
  });

  return baseY + 8;
}

function drawDonutChartInBox(doc, startY, series, { x, width, showAllLegendItems = false } = {}) {
  const legendSeries = (series || []).map((item) => ({
    ...item,
    value: Number(item.value) || 0,
    color: item.color || BRAND_RGB,
  }));
  const pieSlices = legendSeries.filter((item) => item.value > 0);
  const total = legendSeries.reduce((sum, item) => sum + item.value, 0);
  const legendCount = showAllLegendItems ? legendSeries.length : pieSlices.length;
  const legendBlockH = Math.max(18, legendCount * 5.5 + 4);

  if (!total) {
    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem leituras', x + width / 2, startY + 16, { align: 'center' });
    return startY + 36;
  }

  const cx = x + Math.min(20, width * 0.26);
  const cy = startY + 16;
  const radius = 16;
  const hole = 8.5;
  let angle = -Math.PI / 2;

  pieSlices.forEach((slice) => {
    const portion = slice.value / total;
    const endAngle = angle + portion * 2 * Math.PI;
    drawPieSlice(doc, cx, cy, radius, angle, endAngle, slice.color);
    angle = endAngle;
  });

  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, hole, 'F');

  const legendX = cx + radius + 6;
  let legendY = startY + 4;
  const legendMaxW = x + width - legendX - 2;
  const legendItems = showAllLegendItems ? legendSeries : pieSlices;

  legendItems.forEach((slice) => {
    const pct = total ? Math.round((slice.value / total) * 100) : 0;
    doc.setFillColor(...slice.color);
    doc.roundedRect(legendX, legendY - 3, 3.5, 3.5, 0.5, 0.5, 'F');
    doc.setFontSize(6.2);
    doc.setTextColor(30, 41, 51);
    const legendLines = splitPdfLines(doc, `${pdfText(slice.label)}: ${pct}%`, legendMaxW, 6.2);
    doc.text(legendLines, legendX + 5.5, legendY);
    legendY += 5.5 * Math.max(legendLines.length, 1);
  });

  return Math.max(cy + radius + 6, legendY + 2, startY + legendBlockH);
}

function drawFriendlyMetricBarChart(doc, startY, title, series) {
  const contentWidth = getReportContentWidth(doc);
  const panelPad = REPORT_PANEL_PAD;
  const items = (series || []).filter((item) => Number(item.value) > 0);
  const rowH = 9;
  const rowGap = 7;
  const titleH = 8;
  const itemsH = items.length ? items.length * (rowH + rowGap) - rowGap : 14;
  const panelH = panelPad * 2 + titleH + itemsH + 4;
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, panelH);
  const innerX = PAGE_MARGIN + panelPad;
  const innerW = contentWidth - panelPad * 2;
  let innerY = y + panelPad;
  innerY = drawPanelSubsectionTitle(doc, innerX, innerY, title);

  if (!items.length) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados nesta semana.', innerX, innerY + 5);
    return y + panelH + REPORT_BLOCK_GAP;
  }

  const labelW = 42;
  const valueW = 14;
  const barX = innerX + labelW;
  const barAreaW = innerW - labelW - valueW - 4;

  items.forEach((item) => {
    const val = Number(item.value) || 0;
    const max = Number(item.max) || Math.max(val, 1);
    const barW = Math.max(2, (val / max) * barAreaW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(item.label), innerX, innerY + 6, { maxWidth: labelW - 2 });

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(barX, innerY, barAreaW, rowH, 1.2, 1.2, 'F');
    doc.setFillColor(...(item.color || BRAND_RGB));
    doc.roundedRect(barX, innerY, barW, rowH, 1.2, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(30, 41, 51);
    doc.text(String(item.display ?? val), barX + barAreaW + 4, innerY + 6);
    doc.setFont('helvetica', 'normal');

    innerY += rowH + rowGap;
  });

  return y + panelH + REPORT_BLOCK_GAP;
}

function drawMiniPie(doc, startY, title, series) {
  return drawDonutChart(doc, startY, title, series);
}

function addClosingMessage(doc, startY, message) {
  const contentWidth = getReportContentWidth(doc);
  const boxPad = 10;
  const accentW = 3.5;
  const textX = PAGE_MARGIN + accentW + boxPad;
  const textW = contentWidth - accentW - boxPad * 2;
  const lines = splitPdfLines(doc, message, textW, REPORT_TEXT.body + 0.5);
  const boxH = Math.max(28, lines.length * 4.8 + boxPad * 2);
  const blockH = 14 + boxH + REPORT_BLOCK_GAP;

  let y = ensurePageSpace(doc, startY + REPORT_SECTION_GAP, blockH);
  y = addFriendlySectionTitle(doc, y, '6. Mensagem final');

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, boxH);
  doc.setFillColor(...BRAND_RGB);
  doc.rect(PAGE_MARGIN, y, accentW, boxH, 'F');

  doc.setFontSize(REPORT_TEXT.body + 0.5);
  doc.setTextColor(30, 41, 51);
  doc.text(lines, textX, y + boxPad + 2);

  return y + boxH + REPORT_BLOCK_GAP;
}

function addSimpleFooter(doc, footerLabel = 'GlicNutri · Resumo semanal') {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN, pageHeight - 12, doc.internal.pageSize.getWidth() - PAGE_MARGIN, pageHeight - 12);
    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(`${footerLabel} · Página ${page}/${pageCount}`, PAGE_MARGIN, pageHeight - 8);
  }
}

export function buildPatientClinicalPdf(bundle, { jsPDF, autoTable, audience = 'patient', reportMode = 'visual' } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const analytics = bundle.analytics || {};
  const patient = analytics.patientSummary || {};
  const glucose = analytics.glucose || {};
  const meals = analytics.meals || resolveMealsForPdf(bundle);
  const insulin = analytics.insulin || {};
  const medication = analytics.medication || {};
  const isNutritionist = audience === 'nutritionist';

  let y = isNutritionist ? addNutritionistPatientHeader(doc, bundle) : addFriendlyHeader(doc, bundle);

  if (isNutritionist) {
    y = addNutritionistPatientProfile(doc, y, bundle.personalProfile || {}, bundle);
  }

  // 1. Resumo da semana
  y = addFriendlySectionTitle(
    doc,
    y,
    isNutritionist ? '1. Resumo do período' : '1. Resumo da semana'
  );
  y = addLargeSummaryCards(doc, y, patient.cards || {});

  // 2. Como foi sua glicose?
  y = addFriendlySectionTitle(
    doc,
    y,
    isNutritionist ? '2. Glicose' : '2. Como foi sua glicose?'
  );
  y = drawGlucoseWeekRow(
    doc,
    y,
    glucose.dailyAverageSeries || [],
    patient.donutSeries || glucose.rangeSeries || [],
    glucose
  );
  y = addInsightBox(doc, y, patient.glucoseInsights || []);

  // 3. Alimentação
  y = addFriendlySectionTitle(doc, y, '3. Alimentação');
  y = addStatLine(doc, y, [
    { label: 'Refeições registradas', value: patient.meals?.total ?? meals.entries?.length ?? 0 },
    { label: 'Média kcal/dia', value: patient.meals?.avgKcalDay ?? 0 },
    { label: 'Média carb/dia', value: `${patient.meals?.avgCarbsDay ?? 0} g` },
    { label: 'Mais frequente', value: patient.meals?.topMealType ?? '—' },
  ]);
  y = drawCaloriesDailyChart(doc, y, 'Calorias por dia', meals.caloriesDailySeries || []);
  y = drawMiniPie(doc, y, 'Tipos de refeição', meals.typeSeries || []);

  // 4. Insulina
  y = addFriendlySectionTitle(doc, y, '4. Insulina');
  y = addStatLine(doc, y, [
    { label: 'Total UI', value: patient.insulin?.totalUi ?? 0 },
    { label: 'Média/dia', value: patient.insulin?.dailyAvg ?? 0 },
    { label: 'Basal', value: `${patient.insulin?.basalPercent ?? 0}%` },
    { label: 'Bolus', value: `${patient.insulin?.bolusPercent ?? 0}%` },
  ]);
  y = drawInsulinStackedDailyChart(
    doc,
    y,
    'Insulina por dia (UI)',
    insulin.dailyBasalSeries || [],
    insulin.dailyBolusSeries || [],
    {
      basal: patient.insulin?.basalPercent ?? 0,
      bolus: patient.insulin?.bolusPercent ?? 0,
    }
  );
  y = drawMiniPie(doc, y, 'Basal x bolus', insulin.typeBreakdown || []);

  // 5. Medicações
  y = addFriendlySectionTitle(doc, y, '5. Medicações');
  const medicationStat = resolveMedicationStatDisplay(medication);
  y = addStatLine(doc, y, [
    { label: 'Registros', value: patient.medication?.total ?? 0 },
    { label: 'Adesão', value: `${patient.medication?.adherencePct ?? 0}%` },
    {
      label: 'Medicamentos',
      value: medicationStat.value,
      multiline: medicationStat.multiline,
      cardH: medicationStat.cardH,
    },
  ]);
  y = drawFriendlyMetricBarChart(
    doc,
    y,
    'Adesão por medicamento',
    medication.adherencePercentSeries || []
  );
  y = drawMiniPie(doc, y, 'Medicamentos utilizados', medication.byNameSeries || []);

  if (isNutritionist) {
    y = addFriendlySectionTitle(doc, y, '6. Alertas automáticos');
    y = addInsightBox(doc, y, bundle.nutritionistAlerts || analytics.alerts || []);
  }

  if (isNutritionist && reportMode === 'full') {
    y = addTechnicalDetailSection(doc, y, bundle, autoTable);
  }

  // 6. Mensagem final
  y = addClosingMessage(
    doc,
    y,
    isNutritionist
      ? 'Relatório gerado para acompanhamento profissional. Revise os alertas e registre conduta no prontuário.'
      : patient.closingMessage || 'Continue acompanhando seus registros.'
  );

  addSimpleFooter(doc, isNutritionist ? 'Relatório do paciente · Nutricionista' : undefined);
  return doc;
}

function addNutritionistPatientHeader(doc, bundle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerH = 36;

  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('GLICNUTRI · NUTRICIONISTA', PAGE_MARGIN, 11);
  doc.setFontSize(REPORT_TEXT.header);
  doc.text('Relatório do Paciente', PAGE_MARGIN, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(REPORT_TEXT.body);
  doc.text(pdfText(bundle.patientName || 'Paciente'), PAGE_MARGIN, 29);
  doc.setTextColor(230, 240, 245);
  doc.setFontSize(REPORT_TEXT.caption);
  doc.text(
    pdfText(bundle.periodRangeLabel || bundle.periodLabel || 'Período selecionado'),
    pageWidth - PAGE_MARGIN,
    29,
    { align: 'right' }
  );

  return headerH + 8;
}

function addNutritionistPatientProfile(doc, startY, profile = {}, bundle = {}) {
  let y = ensurePageSpace(doc, startY, 34);
  y = addStatLine(doc, y, [
    { label: 'Idade', value: profile.age || '—' },
    { label: 'Peso', value: profile.weight || '—' },
    { label: 'Altura', value: profile.height || '—' },
    { label: 'IMC', value: profile.bmi || '—' },
  ]);
  y = addStatLine(doc, y, [
    { label: 'Profissional', value: bundle.nutricionista?.nome || profile.nutricionistaNome || '—' },
    { label: 'Período', value: bundle.periodLabel || '—' },
    { label: 'Gerado em', value: bundle.generatedAt || '—' },
  ]);
  return y;
}

function addTechnicalDetailSection(doc, startY, bundle, autoTable) {
  let y = addFriendlySectionTitle(doc, startY, 'Detalhamento técnico');

  const glucoseRows = (bundle.glucoseReadings || []).slice(0, 40).map((entry) => [
    `${entry.date || '—'} ${entry.time || ''}`.trim(),
    `${entry.value ?? '—'} mg/dL`,
    pdfText(entry.context || entry.mealContext || '—'),
  ]);

  y = renderRecordsTable(
    doc,
    autoTable,
    y,
    'Leituras de glicose (amostra)',
    [['Data/Hora', 'Valor', 'Contexto']],
    glucoseRows,
    'Sem leituras no período.',
    3
  );

  const mealRows = (bundle.mealEntries || []).slice(0, 30).map((entry) => [
    `${entry.date || '—'} ${entry.time || ''}`.trim(),
    pdfText(entry.title || entry.mealLabel || 'Refeição').slice(0, 42),
    `${entry.calories ?? entry.kcal ?? '—'} kcal`,
  ]);

  y = renderRecordsTable(
    doc,
    autoTable,
    y,
    'Refeições registradas (amostra)',
    [['Data/Hora', 'Refeição', 'Calorias']],
    mealRows,
    'Sem refeições no período.',
    3
  );

  return y;
}

export function buildNutritionistPatientClinicalPdf(bundle, { jsPDF, autoTable, reportMode = 'visual' } = {}) {
  return buildPatientClinicalPdf(bundle, {
    jsPDF,
    autoTable,
    audience: 'nutritionist',
    reportMode,
  });
}

export async function buildPatientClinicalReportPdf(bundle) {
  const { jsPDF, autoTable } = await loadPdfModules();
  return buildPatientClinicalPdf(bundle, { jsPDF, autoTable });
}
