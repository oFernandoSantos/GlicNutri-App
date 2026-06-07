import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { generateSlotsForNextDays } from './servicoAgendaNutri';

export { generateSlotsForNextDays };

const DEFAULT_AVAILABILITY_ROWS = [
  { weekday: 1, start_time: '08:00', end_time: '12:00', slot_minutes: 30, active: true },
  { weekday: 1, start_time: '14:00', end_time: '18:00', slot_minutes: 30, active: true },
  { weekday: 2, start_time: '08:00', end_time: '12:00', slot_minutes: 30, active: true },
  { weekday: 2, start_time: '14:00', end_time: '18:00', slot_minutes: 30, active: true },
  { weekday: 3, start_time: '08:00', end_time: '12:00', slot_minutes: 30, active: true },
  { weekday: 3, start_time: '14:00', end_time: '18:00', slot_minutes: 30, active: true },
  { weekday: 4, start_time: '08:00', end_time: '12:00', slot_minutes: 30, active: true },
  { weekday: 4, start_time: '14:00', end_time: '18:00', slot_minutes: 30, active: true },
  { weekday: 5, start_time: '08:00', end_time: '12:00', slot_minutes: 30, active: true },
  { weekday: 5, start_time: '14:00', end_time: '18:00', slot_minutes: 30, active: true },
];

function buildDefaultAvailability(medicoId) {
  return DEFAULT_AVAILABILITY_ROWS.map((row, index) => ({
    ...row,
    id: `default-${medicoId}-${index}`,
    medico_id: medicoId,
    is_default: true,
  }));
}

function normalizeWeekday(value) {
  const weekday = Number(value);
  if (!Number.isFinite(weekday)) return 0;
  return Math.max(0, Math.min(6, Math.trunc(weekday)));
}

function normalizeTimeHHMM(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{2}):(\d{2})/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDateKeyToBr(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return '';
  const [year, month, day] = String(dateKey).split('-');
  return `${day}/${month}/${year}`;
}

function weekdayFromDateKey(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return 0;
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function buildMedicoSlotLabel({ weekday, startTime, endTime, slotMinutes, availabilityDate }) {
  const dateLabel = availabilityDate ? formatDateKeyToBr(availabilityDate) : '';
  if (dateLabel) {
    return `${dateLabel} ${startTime}–${endTime} (${slotMinutes} min)`;
  }
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return `${days[normalizeWeekday(weekday)]} ${startTime}–${endTime} (${slotMinutes} min)`;
}

export async function listMedicoAvailability(medicoId) {
  if (!medicoId) return [];

  const { data, error } = await supabase
    .from('medico_disponibilidade')
    .select('*')
    .eq('medico_id', medicoId)
    .order('availability_date', { ascending: true, nullsFirst: false })
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data?.length ? data : buildDefaultAvailability(medicoId);
}

export async function upsertMedicoAvailability({
  id,
  medicoId,
  weekday,
  availabilityDate,
  startTime,
  endTime,
  slotMinutes,
  active,
  actor,
  origin = 'agenda_medico',
}) {
  if (!medicoId) throw new Error('Medico sem identificador.');

  const normalizedDate =
    availabilityDate && /^\d{4}-\d{2}-\d{2}$/.test(String(availabilityDate))
      ? String(availabilityDate)
      : null;

  const payload = {
    ...(id ? { id } : null),
    medico_id: medicoId,
    availability_date: normalizedDate,
    weekday: normalizedDate ? weekdayFromDateKey(normalizedDate) : normalizeWeekday(weekday),
    start_time: normalizeTimeHHMM(startTime),
    end_time: normalizeTimeHHMM(endTime),
    slot_minutes: Number(slotMinutes) || 30,
    active: active !== false,
  };

  if (!payload.start_time || !payload.end_time) {
    throw new Error('Informe horario inicial e final (HH:MM).');
  }

  const { data, error } = await supabase
    .from('medico_disponibilidade')
    .upsert([payload], { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) throw error;

  if (data?.id) {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'medico',
      action: id ? 'medico_disponibilidade_atualizada' : 'medico_disponibilidade_criada',
      entity: 'medico_disponibilidade',
      entityId: data.id,
      origin,
      details: {
        medicoId,
        weekday: data.weekday,
        availabilityDate: data.availability_date || null,
        startTime: data.start_time,
        endTime: data.end_time,
        slotMinutes: data.slot_minutes,
        active: data.active,
      },
    });
  }

  return data;
}

export async function deleteMedicoAvailability({ id, actor, origin = 'agenda_medico' }) {
  if (!id) throw new Error('Disponibilidade sem identificador para excluir.');

  const { data: existing } = await supabase
    .from('medico_disponibilidade')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('medico_disponibilidade').delete().eq('id', id);
  if (error) throw error;

  await registrarLogAuditoria({
    actor: actor || null,
    actorType: actor?.tipo_perfil || 'medico',
    action: 'medico_disponibilidade_excluida',
    entity: 'medico_disponibilidade',
    entityId: id,
    origin,
    details: {
      medicoId: existing?.medico_id || null,
      weekday: existing?.weekday ?? null,
      startTime: existing?.start_time || null,
      endTime: existing?.end_time || null,
    },
  });

  return true;
}
