/**
 * Helpers visuais compartilhados entre PDFs do GlicNutri
 * (mesmo padrão do relatório resumido do paciente).
 */

export const PAGE_MARGIN = 18;
export const PAGE_TOP = 24;
export const PAGE_BOTTOM_PADDING = 22;

export const BRAND_RGB = [47, 157, 120];
export const BRAND_LIGHT_RGB = [79, 223, 163];
export const BRAND_DARK_RGB = [39, 125, 94];
export const BRAND_SOFT_RGB = [232, 255, 245];
export const MUTED_RGB = [92, 107, 117];

export const CHART_BLUE = [66, 153, 225];
export const CHART_PURPLE = [159, 122, 234];
export const CHART_ORANGE = [237, 137, 54];
export const GLUCOSE_LOW = [252, 129, 129];
export const GLUCOSE_HIGH = [237, 137, 54];
export const GLUCOSE_OK = [47, 157, 120];
export const GLUCOSE_CRITICAL = [229, 62, 62];

export const REPORT_CARD_GAP = 5;
export const REPORT_CARD_HEIGHT = 28;
export const REPORT_CARD_RADIUS = 3;
export const REPORT_SECTION_GAP = 12;
export const REPORT_BLOCK_GAP = 8;
export const REPORT_PANEL_PAD = 6;
export const REPORT_PANEL_RADIUS = 3;

export const REPORT_TEXT = {
  caption: 7.5,
  body: 9,
  subsection: 10.5,
  section: 13,
  header: 16,
  metric: 16,
  metricSuffix: 7,
};

export const CONTROL_COLORS = {
  bom: GLUCOSE_OK,
  atencao: GLUCOSE_HIGH,
  critico: GLUCOSE_CRITICAL,
};

export function pdfText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getReportContentWidth(doc) {
  return doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2;
}

export function addSectionSpacer(y, size = REPORT_SECTION_GAP) {
  return y + size;
}

export function drawSoftPanel(doc, x, y, width, height) {
  doc.setFillColor(252, 253, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, width, height, REPORT_PANEL_RADIUS, REPORT_PANEL_RADIUS, 'FD');
}

export function drawMetricCard(doc, x, y, width, height, { label, value, suffix = '', accentColor = BRAND_RGB }) {
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

export function ensurePageSpace(doc, y, neededHeight = 58) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - PAGE_BOTTOM_PADDING;

  if (y + neededHeight > bottomLimit) {
    doc.addPage();
    return PAGE_TOP;
  }

  return y;
}

export function addModernHeader(
  doc,
  {
    brandLabel = 'GLICNUTRI',
    title,
    subtitle,
    metaRight = '',
    brandRgb = BRAND_RGB,
  } = {}
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerH = 36;

  doc.setFillColor(...brandRgb);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(pdfText(brandLabel), PAGE_MARGIN, 11);
  doc.setFontSize(REPORT_TEXT.header);
  doc.text(pdfText(title), PAGE_MARGIN, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(REPORT_TEXT.body);
  if (subtitle) {
    doc.text(pdfText(subtitle), PAGE_MARGIN, 29);
  }
  if (metaRight) {
    doc.setTextColor(230, 240, 245);
    doc.setFontSize(REPORT_TEXT.caption);
    doc.text(pdfText(metaRight), pageWidth - PAGE_MARGIN, 29, { align: 'right' });
  }

  return headerH + 8;
}

export function addModernSectionTitle(
  doc,
  y,
  title,
  { brandDarkRgb = BRAND_DARK_RGB, brandLightRgb = BRAND_LIGHT_RGB } = {}
) {
  y = ensurePageSpace(doc, y, 20);
  y = addSectionSpacer(y, REPORT_BLOCK_GAP);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(REPORT_TEXT.section);
  doc.setTextColor(...brandDarkRgb);
  doc.text(pdfText(title), PAGE_MARGIN, y);
  doc.setDrawColor(...brandLightRgb);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y + 3, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y + 3);
  doc.setFont('helvetica', 'normal');
  return y + 12;
}

export function addMetaLine(doc, y, text) {
  doc.setFontSize(REPORT_TEXT.body);
  doc.setTextColor(...MUTED_RGB);
  doc.text(pdfText(text), PAGE_MARGIN, y);
  return y + 6;
}

export function addSummaryCardGrid(doc, startY, items = [], cols = 4) {
  const contentWidth = getReportContentWidth(doc);
  const cardW = (contentWidth - REPORT_CARD_GAP * (cols - 1)) / cols;
  const cardH = REPORT_CARD_HEIGHT;
  const rows = Math.ceil(items.length / cols);
  let y = ensurePageSpace(doc, startY, rows * (cardH + REPORT_CARD_GAP) + REPORT_BLOCK_GAP);

  items.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = PAGE_MARGIN + col * (cardW + REPORT_CARD_GAP);
    const itemY = y + row * (cardH + REPORT_CARD_GAP);
    drawMetricCard(doc, x, itemY, cardW, cardH, {
      label: item.label,
      value: item.value,
      suffix: item.suffix || '',
      accentColor: item.color || BRAND_RGB,
    });
  });

  return y + rows * (cardH + REPORT_CARD_GAP) + REPORT_BLOCK_GAP;
}

export function addInsightBox(doc, startY, messages = []) {
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

export function addBulletListPanel(doc, startY, title, lines = [], accentColor = BRAND_RGB) {
  const contentWidth = getReportContentWidth(doc);
  const safeLines = lines.length ? lines : ['Nenhum paciente nesta categoria.'];
  const panelH = 12 + safeLines.length * 5.5;
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, panelH);
  doc.setFillColor(...accentColor);
  doc.roundedRect(PAGE_MARGIN, y, 3.5, panelH, REPORT_PANEL_RADIUS, 0, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(REPORT_TEXT.subsection);
  doc.setTextColor(...BRAND_DARK_RGB);
  doc.text(pdfText(title), PAGE_MARGIN + 8, y + 7);
  doc.setFont('helvetica', 'normal');

  let lineY = y + 13;
  doc.setFontSize(REPORT_TEXT.body);
  doc.setTextColor(47, 52, 56);
  safeLines.slice(0, 6).forEach((line) => {
    doc.text(`• ${pdfText(line)}`, PAGE_MARGIN + 8, lineY, { maxWidth: contentWidth - 14 });
    lineY += 5.5;
  });

  return y + panelH + REPORT_BLOCK_GAP;
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

export function drawDistributionPanel(doc, startY, title, series = []) {
  const contentWidth = getReportContentWidth(doc);
  const panelH = 52;
  let y = ensurePageSpace(doc, startY, panelH + REPORT_BLOCK_GAP);

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, panelH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(REPORT_TEXT.subsection);
  doc.setTextColor(...BRAND_DARK_RGB);
  doc.text(pdfText(title), PAGE_MARGIN + REPORT_PANEL_PAD, y + 8);
  doc.setFont('helvetica', 'normal');

  const slices = (series || []).filter((item) => Number(item.value) > 0);
  const total = slices.reduce((sum, item) => sum + Number(item.value), 0);
  const cx = PAGE_MARGIN + 22;
  const cy = y + 30;
  const radius = 16;

  if (!total) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados no período', PAGE_MARGIN + 48, y + 30);
    return y + panelH + REPORT_BLOCK_GAP;
  }

  let angle = -Math.PI / 2;
  slices.forEach((slice) => {
    const portion = Number(slice.value) / total;
    const endAngle = angle + portion * 2 * Math.PI;
    drawPieSlice(doc, cx, cy, radius, angle, endAngle, slice.color || BRAND_RGB);
    angle = endAngle;
  });

  let legendY = y + 14;
  const legendX = PAGE_MARGIN + 48;
  slices.forEach((slice) => {
    const pct = Math.round((Number(slice.value) / total) * 100);
    doc.setFillColor(...(slice.color || BRAND_RGB));
    doc.roundedRect(legendX, legendY - 3.5, 4.5, 4.5, 0.5, 0.5, 'F');
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(47, 52, 56);
    doc.text(`${pdfText(slice.label)}: ${slice.value} (${pct}%)`, legendX + 7, legendY);
    legendY += 6.5;
  });

  return y + panelH + REPORT_BLOCK_GAP;
}

export function drawHorizontalBarChart(doc, startY, title, series = [], { maxItems = 8 } = {}) {
  let y = ensurePageSpace(doc, startY, 52);
  y = addModernSectionTitle(doc, y, title);

  const items = (series || []).slice(0, maxItems);
  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);
  const pageWidth = doc.internal.pageSize.getWidth();
  const barAreaW = pageWidth - PAGE_MARGIN * 2 - 42;
  const barH = 7;
  const gap = 5;

  if (!items.some((item) => Number(item.value) > 0)) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados no período', PAGE_MARGIN, y + 4);
    return y + 12;
  }

  items.forEach((item) => {
    const val = Number(item.value) || 0;
    const barW = Math.max(2, (val / max) * barAreaW);
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(47, 52, 56);
    doc.text(pdfText(item.label).slice(0, 18), PAGE_MARGIN, y + 5);
    doc.setFillColor(240, 244, 247);
    doc.roundedRect(PAGE_MARGIN + 40, y, barAreaW, barH, 1, 1, 'F');
    doc.setFillColor(...(item.color || BRAND_RGB));
    doc.roundedRect(PAGE_MARGIN + 40, y, barW, barH, 1, 1, 'F');
    doc.text(item.display != null ? String(item.display) : String(val), PAGE_MARGIN + 40 + barAreaW + 3, y + 5);
    y += barH + gap;
  });

  return y + 4;
}

export function drawColumnChart(doc, startY, title, series = [], { color = BRAND_RGB, valueSuffix = '' } = {}) {
  const contentWidth = getReportContentWidth(doc);
  const chartH = 38;
  let y = ensurePageSpace(doc, startY, chartH + 24);
  y = addModernSectionTitle(doc, y, title);

  const points = series || [];
  const max = Math.max(...points.map((item) => Number(item.value) || 0), 1);

  if (!points.some((item) => Number(item.value) > 0)) {
    doc.setFontSize(REPORT_TEXT.body);
    doc.setTextColor(...MUTED_RGB);
    doc.text('Sem dados no período', PAGE_MARGIN, y + 4);
    return y + 12;
  }

  drawSoftPanel(doc, PAGE_MARGIN, y, contentWidth, chartH + 14);
  const plotX = PAGE_MARGIN + 6;
  const plotW = contentWidth - 12;
  const plotTop = y + 6;
  const baseY = plotTop + chartH;
  const count = points.length;
  const slotW = plotW / count;
  const barW = Math.min(8, Math.max(3.5, slotW * 0.5));

  points.forEach((point, index) => {
    const val = Number(point.value) || 0;
    const slotCenter = plotX + slotW * index + slotW / 2;
    const barX = slotCenter - barW / 2;
    const fillH = val > 0 ? Math.max(2, (val / max) * chartH) : 0;

    doc.setFillColor(240, 244, 247);
    doc.roundedRect(barX, plotTop, barW, chartH, 1, 1, 'F');
    if (fillH > 0) {
      doc.setFillColor(...(point.color || color));
      doc.roundedRect(barX, baseY - fillH, barW, fillH, 1, 1, 'F');
      doc.setFontSize(6);
      doc.setTextColor(30, 41, 51);
      doc.text(`${val}${valueSuffix}`, slotCenter, baseY - fillH - 1.5, { align: 'center' });
    }

    doc.setFontSize(REPORT_TEXT.caption);
    doc.setTextColor(...MUTED_RGB);
    doc.text(pdfText(point.label), slotCenter, baseY + 4.5, { align: 'center', maxWidth: slotW - 1 });
  });

  return y + chartH + 20;
}

export function addModernFooter(doc, footerLabel = 'Relatório GlicNutri') {
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
