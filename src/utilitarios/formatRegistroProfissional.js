function formatRegistro(prefix, value, emptyLabel) {
  const raw = String(value || '').trim();
  if (!raw) return emptyLabel;
  const re = new RegExp(`^${prefix}\\b`, 'i');
  if (re.test(raw)) return raw;
  return `${prefix} ${raw}`;
}

export function formatCrmMedico(crmMedico) {
  return formatRegistro('CRM', crmMedico, 'CRM não informado');
}

export function formatCrnNutricionista(crn) {
  return formatRegistro('CRN', crn, 'CRN não informado');
}
