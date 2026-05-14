import { supabase } from './configSupabase';
import {
  fetchGlucoseReadings,
  fetchMealEntries,
  fetchMedicationEntries,
} from './servicoDadosPaciente';

function safeDateTimeKey(date, time) {
  const d = String(date || '1970-01-01').slice(0, 10);
  const t = String(time || '00:00').slice(0, 5);
  return `${d}T${t}:00`;
}

function toIsoFromLocalDateTime(date, time) {
  const key = safeDateTimeKey(date, time);
  const parsed = new Date(key);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
}

function normalizeGlucoseEvent(reading) {
  return {
    id: `glucose-${reading.id}`,
    kind: 'glucose',
    occurredAt: toIsoFromLocalDateTime(reading.date, String(reading.time || '').slice(0, 5)),
    title: `Glicemia: ${reading.value} mg/dL`,
    subtitle: reading.glucoseType ? `Tipo: ${reading.glucoseType}` : '',
    raw: reading,
  };
}

function normalizeMealEvent(entry) {
  return {
    id: entry.id || `meal-${entry.date}-${entry.time}`,
    kind: 'meal',
    occurredAt: toIsoFromLocalDateTime(entry.date, entry.time),
    title: entry.title || 'Refeicao',
    subtitle: entry.description || '',
    raw: entry,
  };
}

function normalizeMedicationEvent(entry) {
  const kind = entry.medicationKind === 'insulin' ? 'insulin' : 'medicine';
  const name = entry.medicineName ? ` - ${entry.medicineName}` : '';
  const qty = entry.medicineQuantity ? ` (${entry.medicineQuantity}${entry.medicineUnit ? ` ${entry.medicineUnit}` : ''})` : '';
  return {
    id: entry.databaseId ? `med-${entry.databaseId}` : entry.id || `med-${entry.date}-${entry.time}`,
    kind,
    occurredAt: toIsoFromLocalDateTime(entry.date, entry.time),
    title: `${kind === 'insulin' ? 'Insulina' : 'Medicacao'}${name}${qty}`,
    subtitle: entry.label || '',
    raw: entry,
  };
}

function normalizeConsultaEvent(consulta) {
  const occurredAt = consulta?.scheduled_at ? new Date(consulta.scheduled_at).toISOString() : new Date(0).toISOString();
  return {
    id: `consulta-${consulta.id}`,
    kind: 'consulta',
    occurredAt,
    title: `Consulta (${String(consulta.status || 'scheduled')})`,
    subtitle: consulta.motivo || '',
    raw: consulta,
  };
}

function normalizeNotaEvent(nota) {
  const occurredAt = nota?.created_at ? new Date(nota.created_at).toISOString() : new Date(0).toISOString();
  const texto = String(nota.texto || '').trim();
  const isDieta = texto.includes('=== Sugestao de padrao alimentar');
  return {
    id: `nota-${nota.id}`,
    kind: 'nota',
    occurredAt,
    title: isDieta ? 'Sugestao de padrao alimentar' : 'Nota do prontuario',
    subtitle: texto,
    raw: nota,
  };
}

export async function fetchNutriProntuario({
  pacienteId,
  nutricionistaId,
  limit = 180,
}) {
  if (!pacienteId) {
    return {
      timeline: [],
      consultas: [],
      notas: [],
      glucoseReadings: [],
      meals: [],
      medications: [],
    };
  }

  const [glucoseReadings, meals, medications, consultasResult, notasResult] = await Promise.all([
    fetchGlucoseReadings(pacienteId, Math.min(limit, 240)).catch(() => []),
    fetchMealEntries(pacienteId, Math.min(limit, 240)).catch(() => []),
    fetchMedicationEntries(pacienteId, Math.min(limit, 240)).catch(() => []),
    supabase
      .from('consulta')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('scheduled_at', { ascending: false })
      .limit(80),
    supabase
      .from('prontuario_nota')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  const consultas = consultasResult?.data || [];
  const notas = notasResult?.data || [];

  const timeline = [
    ...glucoseReadings.map(normalizeGlucoseEvent),
    ...meals.map(normalizeMealEvent),
    ...medications.map(normalizeMedicationEvent),
    ...consultas.map(normalizeConsultaEvent),
    ...notas.map(normalizeNotaEvent),
  ]
    .filter(Boolean)
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
    .slice(0, limit);

  return {
    timeline,
    consultas,
    notas,
    glucoseReadings,
    meals,
    medications,
  };
}

export async function createProntuarioNota({
  nutricionistaId,
  pacienteId,
  consultaId,
  texto,
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador para salvar nota.');
  if (!pacienteId) throw new Error('Paciente sem identificador para salvar nota.');

  const payload = {
    nutricionista_id: nutricionistaId,
    paciente_id: pacienteId,
    consulta_id: consultaId || null,
    texto: String(texto || '').trim(),
  };

  if (!payload.texto) {
    throw new Error('Digite um texto para salvar a nota.');
  }

  const { data, error } = await supabase
    .from('prontuario_nota')
    .insert([payload])
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

