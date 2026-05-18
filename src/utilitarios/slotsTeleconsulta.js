const MS_DAY = 24 * 60 * 60 * 1000;

function getStableSeedHash(seed) {
  const text = String(seed || '0');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getGreetingName(usuario) {
  const raw =
    usuario?.nome_completo ||
    usuario?.nome_completo_nutri ||
    usuario?.nome_nutri ||
    usuario?.email_pac ||
    usuario?.email ||
    '';
  const first = String(raw).trim().split(/\s+/)[0];
  return first || 'você';
}

export function getStableRating(seed) {
  const normalized = 4.2 + (getStableSeedHash(seed) % 8) / 10;
  return normalized.toFixed(1);
}

export function getStableReviewCount(seed) {
  return 12 + (getStableSeedHash(seed) % 89);
}

export function getStableExperienceYears(seed) {
  return 2 + (getStableSeedHash(seed) % 18);
}

export function formatSlotDateKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDayLabel(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function formatTimeLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function isSameDay(isoA, isoB) {
  return formatSlotDateKey(isoA) === formatSlotDateKey(isoB);
}

export function isTodayKey(dateKey) {
  return dateKey === formatSlotDateKey(new Date().toISOString());
}

export function isTomorrowKey(dateKey) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateKey === formatSlotDateKey(tomorrow.toISOString());
}

export function markSlotsWithBooking(slots, consultas = []) {
  const booked = new Set(
    (consultas || [])
      .filter((item) => item?.status !== 'cancelled' && item?.scheduled_at)
      .map((item) => new Date(item.scheduled_at).toISOString())
  );

  return (slots || []).map((slot) => {
    const bookedSlot = booked.has(slot.scheduledAt);
    return {
      ...slot,
      status: bookedSlot ? 'occupied' : 'available',
    };
  });
}

export function groupSlotsByDay(slots) {
  const map = new Map();
  (slots || []).forEach((slot) => {
    const key = formatSlotDateKey(slot.scheduledAt);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(slot);
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, daySlots]) => ({
      dateKey,
      label: formatDayLabel(dateKey),
      slots: daySlots.sort((left, right) =>
        String(left.scheduledAt).localeCompare(String(right.scheduledAt))
      ),
    }));
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getNutriEspecialidadeLabel(nutri) {
  return nutri?.especialidade || nutri?.especialidades?.[0] || 'Nutrição clínica';
}

export function matchesNutriAdvancedFilters(nutri, filters = {}) {
  const especialidade = String(filters.especialidade || '').trim();
  const convenio = String(filters.convenio || '').trim();
  const maxValorCentavos = Number(filters.maxValorCentavos) || 0;
  const ratingMinimo = Number(filters.ratingMinimo) || 0;
  const somenteConvenio = Boolean(filters.somenteConvenio);

  if (especialidade && especialidade !== 'Todas') {
    const specs = [
      nutri?.especialidade,
      ...(Array.isArray(nutri?.especialidades) ? nutri.especialidades : []),
    ].filter(Boolean);
    const target = normalizeSearchText(especialidade);
    const ok = specs.some((item) => normalizeSearchText(item).includes(target));
    if (!ok) return false;
  }

  if (convenio && convenio !== 'Particular' && nutri?.aceita_convenio === false) {
    return false;
  }

  if (somenteConvenio && nutri?.aceita_convenio === false) {
    return false;
  }

  if (maxValorCentavos > 0) {
    const valor = Number(nutri?.valor_consulta_centavos) || 0;
    if (valor > maxValorCentavos) return false;
  }

  if (ratingMinimo > 0) {
    const rating = Number(getStableRating(nutri?.id_nutricionista_uuid));
    if (rating < ratingMinimo) return false;
  }

  return true;
}

export function filterNutritionists(nutritionists, filters = {}) {
  const { query, quickFilter } = filters;
  const q = normalizeSearchText(query);

  let list = [...(nutritionists || [])].filter((item) =>
    matchesNutriAdvancedFilters(item, filters)
  );

  if (q) {
    list = list.filter((item) => {
      const haystack = [
        item.nome_completo_nutri,
        item.crm_numero,
        item.email_acesso,
        getNutriEspecialidadeLabel(item),
        ...(item.especialidades || []),
        item.bio_resumo,
        'nutricao',
        'teleconsulta',
      ]
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (quickFilter === 'top') {
    list.sort(
      (a, b) =>
        Number(getStableRating(b.id_nutricionista_uuid)) -
        Number(getStableRating(a.id_nutricionista_uuid))
    );
  }

  return list;
}

export function filterSlotsByDateRange(slots, { dateFrom, dateTo }) {
  if (!dateFrom && !dateTo) return slots || [];

  return (slots || []).filter((slot) => {
    const key = formatSlotDateKey(slot.scheduledAt);
    if (!key) return false;
    if (dateFrom && key < dateFrom) return false;
    if (dateTo && key > dateTo) return false;
    return true;
  });
}

export function nutritionistHasSlotsInRange(slots, { dateFrom, dateTo }) {
  return filterSlotsByDateRange(slots, { dateFrom, dateTo }).some(
    (slot) => slot.status === 'available'
  );
}

export function filterSlotsByQuick(slots, quickFilter) {
  if (!quickFilter || quickFilter === 'all' || quickFilter === 'online') {
    return slots;
  }

  if (quickFilter === 'today') {
    const today = formatSlotDateKey(new Date().toISOString());
    return slots.filter((slot) => formatSlotDateKey(slot.scheduledAt) === today);
  }

  if (quickFilter === 'tomorrow') {
    const tomorrow = new Date(Date.now() + MS_DAY);
    const key = formatSlotDateKey(tomorrow.toISOString());
    return slots.filter((slot) => formatSlotDateKey(slot.scheduledAt) === key);
  }

  return slots;
}

export function getConsultaStatusMeta(status) {
  const normalized = String(status || 'scheduled').toLowerCase();

  if (normalized === 'confirmed') {
    return { label: 'Confirmada', tone: 'confirmed', icon: 'checkmark-circle-outline' };
  }
  if (normalized === 'cancelled') {
    return { label: 'Cancelada', tone: 'cancelled', icon: 'close-circle-outline' };
  }
  if (normalized === 'done') {
    return { label: 'Concluída', tone: 'done', icon: 'checkmark-done-outline' };
  }
  if (normalized === 'no_show') {
    return { label: 'Não compareceu', tone: 'cancelled', icon: 'alert-circle-outline' };
  }
  return { label: 'Pendente', tone: 'pending', icon: 'time-outline' };
}

export function buildWeekDays(anchor = new Date()) {
  const start = new Date(anchor);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const dateKey = formatSlotDateKey(current.toISOString());
    return {
      dateKey,
      weekday: current.toLocaleDateString('pt-BR', { weekday: 'short' }),
      day: String(current.getDate()).padStart(2, '0'),
      isToday: isTodayKey(dateKey),
    };
  });
}

export function groupConsultasForWeek(consultas, weekDays) {
  const keys = new Set(weekDays.map((d) => d.dateKey));
  const grouped = {};

  weekDays.forEach((d) => {
    grouped[d.dateKey] = [];
  });

  (consultas || []).forEach((item) => {
    const key = formatSlotDateKey(item.scheduled_at);
    if (!keys.has(key)) return;
    grouped[key].push(item);
  });

  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) =>
      String(a.scheduled_at).localeCompare(String(b.scheduled_at))
    );
  });

  return grouped;
}
