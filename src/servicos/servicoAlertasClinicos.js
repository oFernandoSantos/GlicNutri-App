import { supabase } from './configSupabase';
import { enrichRpcClinicalParams } from './servicoSessaoRpc';

function isMissingRpc(error, name = '') {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST202' ||
    message.includes('alerta_clinico') ||
    (name && message.includes(name.toLowerCase()))
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

export async function persistClinicalAlerts(alerts = [], pacienteId = null) {
  if (!alerts.length) return [];

  const targetPacienteId = pacienteId || alerts[0]?.paciente_id || null;
  if (!targetPacienteId) return [];

  const { data: count, error } = await supabase.rpc(
    'inserir_alertas_clinicos',
    await enrichRpcClinicalParams(
      {
        p_paciente_id: targetPacienteId,
        p_alertas: alerts,
      },
      targetPacienteId
    )
  );

  if (error) {
    if (isMissingRpc(error, 'inserir_alertas_clinicos')) return [];
    console.log('Erro ao persistir alertas:', error);
    return [];
  }

  return Number(count) > 0 ? alerts : [];
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

  const recent = await listPatientClinicalAlerts(pacienteId, { onlyUnread: false, limit: 50 });
  const existingTypes = new Set(
    (recent || [])
      .filter((item) => {
        const createdAt = item?.created_at ? new Date(item.created_at) : null;
        return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= since;
      })
      .map((item) => item.tipo)
  );
  const toInsert = built.filter((item) => !existingTypes.has(item.tipo));

  return persistClinicalAlerts(toInsert, pacienteId);
}

export async function listPatientClinicalAlerts(pacienteId, { onlyUnread = true, limit = 30 } = {}) {
  if (!pacienteId) return [];

  const { data, error } = await supabase.rpc(
    'listar_alertas_paciente',
    await enrichRpcClinicalParams(
      {
        p_paciente_id: pacienteId,
        p_apenas_nao_lidos: onlyUnread,
        p_limite: limit,
      },
      pacienteId
    )
  );

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

  const { data, error } = await supabase.rpc(
    'listar_alertas_nutricionista',
    await enrichRpcClinicalParams(
      {
        p_nutricionista_id: nutricionistaId,
        p_apenas_nao_lidos: onlyUnread,
        p_limite: limit,
      },
      null
    )
  );

  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }

  return data || [];
}

export async function markPatientAlertRead(alertId, pacienteId = null) {
  if (!alertId || !pacienteId) return;

  const { error } = await supabase.rpc(
    'marcar_alerta_paciente_lido',
    await enrichRpcClinicalParams(
      {
        p_alerta_id: alertId,
        p_paciente_id: pacienteId,
      },
      pacienteId
    )
  );

  if (error && !isMissingRpc(error, 'marcar_alerta_paciente_lido')) {
    console.log('Erro ao marcar alerta do paciente como lido:', error.message);
  }
}

export async function markNutritionistAlertRead(alertId, nutricionistaId = null) {
  if (!alertId || !nutricionistaId) return;

  const { error } = await supabase.rpc(
    'marcar_alerta_nutricionista_lido',
    await enrichRpcClinicalParams(
      {
        p_alerta_id: alertId,
        p_nutricionista_id: nutricionistaId,
      },
      null
    )
  );

  if (error && !isMissingRpc(error, 'marcar_alerta_nutricionista_lido')) {
    console.log('Erro ao marcar alerta do nutricionista como lido:', error.message);
  }
}
