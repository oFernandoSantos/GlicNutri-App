import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';

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

export function buildSlotLabel({ weekday, startTime, endTime, slotMinutes }) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return `${days[normalizeWeekday(weekday)]} ${startTime}–${endTime} (${slotMinutes} min)`;
}

export async function listNutriAvailability(nutricionistaId) {
  if (!nutricionistaId) return [];

  const { data, error } = await supabase
    .from('nutri_disponibilidade')
    .select('*')
    .eq('nutricionista_id', nutricionistaId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function upsertNutriAvailability({
  id,
  nutricionistaId,
  weekday,
  startTime,
  endTime,
  slotMinutes,
  active,
  actor,
  origin = 'agenda_nutricionista',
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador.');

  const payload = {
    ...(id ? { id } : null),
    nutricionista_id: nutricionistaId,
    weekday: normalizeWeekday(weekday),
    start_time: normalizeTimeHHMM(startTime),
    end_time: normalizeTimeHHMM(endTime),
    slot_minutes: Number(slotMinutes) || 30,
    active: active !== false,
  };

  if (!payload.start_time || !payload.end_time) {
    throw new Error('Informe horario inicial e final (HH:MM).');
  }

  const { data, error } = await supabase
    .from('nutri_disponibilidade')
    .upsert([payload], { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) throw error;

  if (data?.id) {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || 'nutricionista',
      action: id ? 'nutri_disponibilidade_atualizada' : 'nutri_disponibilidade_criada',
      entity: 'nutri_disponibilidade',
      entityId: data.id,
      origin,
      details: {
        nutricionistaId,
        weekday: data.weekday,
        startTime: data.start_time,
        endTime: data.end_time,
        slotMinutes: data.slot_minutes,
        active: data.active,
      },
    });
  }

  return data;
}

export async function deleteNutriAvailability({ id, actor, origin = 'agenda_nutricionista' }) {
  if (!id) throw new Error('Disponibilidade sem identificador para excluir.');

  const { data: existing } = await supabase
    .from('nutri_disponibilidade')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('nutri_disponibilidade').delete().eq('id', id);
  if (error) throw error;

  await registrarLogAuditoria({
    actor: actor || null,
    actorType: actor?.tipo_perfil || 'nutricionista',
    action: 'nutri_disponibilidade_excluida',
    entity: 'nutri_disponibilidade',
    entityId: id,
    origin,
    details: {
      nutricionistaId: existing?.nutricionista_id || null,
      weekday: existing?.weekday ?? null,
      startTime: existing?.start_time || null,
      endTime: existing?.end_time || null,
    },
  });

  return true;
}

function addMinutes(date, minutes) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function startOfDayLocal(date = new Date()) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  return current;
}

function setTimeOnDate(date, timeHHMM) {
  const [hh, mm] = String(timeHHMM || '00:00').split(':');
  const next = new Date(date);
  next.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
  return next;
}

export function generateSlotsForNextDays(availabilityRows, { days = 14 } = {}) {
  const start = startOfDayLocal();
  const end = addMinutes(new Date(start.getTime() + days * 24 * 60 * 60 * 1000), 0);
  const avail = Array.isArray(availabilityRows) ? availabilityRows : [];
  const slots = [];

  for (let dayCursor = new Date(start); dayCursor < end; dayCursor = addMinutes(dayCursor, 24 * 60)) {
    const weekday = dayCursor.getDay(); // 0-6
    const dayAvail = avail.filter((row) => row.active !== false && normalizeWeekday(row.weekday) === weekday);

    dayAvail.forEach((row) => {
      const slotMinutes = Number(row.slot_minutes) || 30;
      const startAt = setTimeOnDate(dayCursor, row.start_time);
      const endAt = setTimeOnDate(dayCursor, row.end_time);

      for (let t = new Date(startAt); t < endAt; t = addMinutes(t, slotMinutes)) {
        const nextT = addMinutes(t, slotMinutes);
        if (nextT > endAt) break;
        slots.push({
          scheduledAt: t.toISOString(),
          localLabel: t.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
          weekday,
          startTime: row.start_time,
          endTime: row.end_time,
          slotMinutes,
        });
      }
    });
  }

  return slots;
}

