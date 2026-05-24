import { supabase } from './configSupabase';

function startOfDay(date = new Date()) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  return current;
}

function endOfDay(date = new Date()) {
  const current = new Date(date);
  current.setHours(23, 59, 59, 999);
  return current;
}

function safeNutriId(usuarioLogado) {
  return (
    usuarioLogado?.id_nutricionista_uuid ||
    usuarioLogado?.user_metadata?.id_nutricionista_uuid ||
    usuarioLogado?.id ||
    null
  );
}

export async function fetchNutriDashboard(usuarioLogado) {
  const nutricionistaId = safeNutriId(usuarioLogado);
  if (!nutricionistaId) {
    return {
      nutricionistaId: null,
      patientsCount: 0,
      consultsTodayCount: 0,
      upcomingConsults: [],
      recentPatients: [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  const dayStart = startOfDay();
  const dayEnd = endOfDay();

  const [
    patientsCountResp,
    consultsTodayResp,
    upcomingResp,
    recentPatientsResp,
  ] = await Promise.all([
    supabase
      .from('paciente')
      .select('id_paciente_uuid', { count: 'exact', head: true })
      .eq('id_nutricionista_uuid', nutricionistaId)
      .or('excluido.is.null,excluido.eq.false'),
    supabase
      .from('consulta')
      .select('id', { count: 'exact', head: true })
      .eq('nutricionista_id', nutricionistaId)
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .not('status', 'eq', 'cancelled'),
    supabase
      .from('consulta')
      .select(
        'id, paciente_id, scheduled_at, status, motivo, paciente:paciente_id(nome_completo, email_pac)'
      )
      .eq('nutricionista_id', nutricionistaId)
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(12),
    supabase
      .from('paciente')
      .select('id_paciente_uuid, nome_completo, email_pac, data_hora_ultima_atualizacao')
      .eq('id_nutricionista_uuid', nutricionistaId)
      .or('excluido.is.null,excluido.eq.false')
      .order('data_hora_ultima_atualizacao', { ascending: false })
      .limit(8),
  ]);

  const patientsCount = patientsCountResp?.count || 0;
  const consultsTodayCount = consultsTodayResp?.count || 0;

  return {
    nutricionistaId,
    patientsCount,
    consultsTodayCount,
    upcomingConsults: upcomingResp?.data || [],
    recentPatients: recentPatientsResp?.data || [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

