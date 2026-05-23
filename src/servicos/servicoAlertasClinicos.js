import { supabase } from './configSupabase';

function isMissingRpc(error) {
  return (
    error?.code === 'PGRST202' ||
    String(error?.message || '').toLowerCase().includes('alerta_clinico')
  );
}

export function buildGlucoseAlerts(glucoseReadings = [], { pacienteId, nutricionistaId } = {}) {
  const alerts = [];
  const latest = (glucoseReadings || [])
    .map((item) => ({ ...item, value: Number(item?.value) }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => String(b.date + b.time).localeCompare(String(a.date + a.time)))[0];

  if (!latest) return alerts;

  const base = {
    paciente_id: pacienteId,
    nutricionista_id: nutricionistaId || null,
  };

  if (latest.value < 70) {
    alerts.push({
      ...base,
      tipo: 'hipoglicemia',
      titulo: 'Glicemia baixa',
      mensagem: `Ultima leitura: ${latest.value} mg/dL. Reforce hidratacao e alimentacao conforme plano.`,
      severidade: 'danger',
    });
  } else if (latest.value > 180) {
    alerts.push({
      ...base,
      tipo: 'hiperglicemia',
      titulo: 'Glicemia elevada',
      mensagem: `Ultima leitura: ${latest.value} mg/dL. Revise refeicao, medicacao e atividade.`,
      severidade: latest.value > 250 ? 'danger' : 'warning',
    });
  }

  return alerts;
}

export async function persistClinicalAlerts(alerts = []) {
  if (!alerts.length) return [];

  const { data, error } = await supabase.from('alerta_clinico').insert(alerts).select('*');

  if (error) {
    if (isMissingRpc(error)) return [];
    console.log('Erro ao persistir alertas:', error);
    return [];
  }

  return data || [];
}

export async function syncGlucoseAlertsForPatient({
  pacienteId,
  nutricionistaId,
  glucoseReadings = [],
}) {
  const built = buildGlucoseAlerts(glucoseReadings, { pacienteId, nutricionistaId });
  if (!built.length) return [];

  const since = new Date();
  since.setHours(since.getHours() - 12);

  const { data: recent } = await supabase
    .from('alerta_clinico')
    .select('id, tipo, created_at')
    .eq('paciente_id', pacienteId)
    .gte('created_at', since.toISOString());

  const existingTypes = new Set((recent || []).map((item) => item.tipo));
  const toInsert = built.filter((item) => !existingTypes.has(item.tipo));

  return persistClinicalAlerts(toInsert);
}

export async function listPatientClinicalAlerts(pacienteId, { onlyUnread = true, limit = 30 } = {}) {
  if (!pacienteId) return [];

  const { data, error } = await supabase.rpc('listar_alertas_paciente', {
    p_paciente_id: pacienteId,
    p_apenas_nao_lidos: onlyUnread,
    p_limite: limit,
  });

  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }

  return data || [];
}

export async function listNutritionistClinicalAlerts(
  nutricionistaId,
  { onlyUnread = true, limit = 50 } = {}
) {
  if (!nutricionistaId) return [];

  const { data, error } = await supabase.rpc('listar_alertas_nutricionista', {
    p_nutricionista_id: nutricionistaId,
    p_apenas_nao_lidos: onlyUnread,
    p_limite: limit,
  });

  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }

  return data || [];
}

export async function markPatientAlertRead(alertId) {
  if (!alertId) return;
  await supabase.from('alerta_clinico').update({ lido_paciente: true }).eq('id', alertId);
}

export async function markNutritionistAlertRead(alertId) {
  if (!alertId) return;
  await supabase.from('alerta_clinico').update({ lido_nutri: true }).eq('id', alertId);
}
