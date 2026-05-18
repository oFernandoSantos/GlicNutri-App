import { Linking } from 'react-native';
import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import {
  buildGoogleMeetLinkFromConsulta,
  isValidGoogleMeetUrl,
  normalizeGoogleMeetUrl,
  resolveMeetLink,
} from './servicoGoogleMeet';
import { criarNotificacaoConsulta } from './servicoNotificacoesConsulta';

export function normalizeConsultaStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  const allowed = new Set(['scheduled', 'confirmed', 'cancelled', 'done', 'no_show']);
  return allowed.has(status) ? status : 'scheduled';
}

export function formatConsultaDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export async function abrirLinkGoogleMeet(url) {
  const link = normalizeGoogleMeetUrl(url);
  if (!link) {
    throw new Error('Link do Google Meet indisponível para esta consulta.');
  }

  const canOpen = await Linking.canOpenURL(link);
  if (!canOpen) {
    throw new Error('Não foi possível abrir o Google Meet neste dispositivo.');
  }

  await Linking.openURL(link);
}

async function persistirMeetLink(consulta, nutricionista) {
  if (!consulta?.id) return consulta;

  const atual = normalizeGoogleMeetUrl(consulta.meet_link);
  if (atual && isValidGoogleMeetUrl(atual)) {
    return consulta;
  }

  const meetLink = resolveMeetLink({ consulta, nutricionista });
  if (!meetLink) {
    return consulta;
  }

  const { data, error } = await supabase
    .from('consulta')
    .update({ meet_link: meetLink, canal: 'google_meet' })
    .eq('id', consulta.id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.log('Erro ao salvar link Google Meet:', error);
    return { ...consulta, meet_link: meetLink, canal: 'google_meet' };
  }

  return data || { ...consulta, meet_link: meetLink, canal: 'google_meet' };
}

async function notificarAgendamento({ consulta, nutricionista, pacienteNome }) {
  const quando = formatConsultaDateTime(consulta.scheduled_at);
  const meetLink = resolveMeetLink({ consulta, nutricionista });
  const nomeNutri =
    nutricionista?.nome_completo_nutri || nutricionista?.nome_nutri || 'Nutricionista';

  await criarNotificacaoConsulta({
    consultaId: consulta.id,
    destinatarioTipo: 'nutricionista',
    destinatarioId: consulta.nutricionista_id,
    evento: 'agendada',
    titulo: 'Nova teleconsulta agendada',
    mensagem: `${pacienteNome || 'Paciente'} agendou consulta para ${quando}.`,
  });

  await criarNotificacaoConsulta({
    consultaId: consulta.id,
    destinatarioTipo: 'paciente',
    destinatarioId: consulta.paciente_id,
    evento: 'meet_disponivel',
    titulo: 'Teleconsulta confirmada',
    mensagem: `Consulta com ${nomeNutri} em ${quando}. Link Google Meet: ${meetLink}`,
  });
}

async function notificarMudancaStatus({ consulta, status, nutricionista }) {
  const quando = formatConsultaDateTime(consulta.scheduled_at);
  const meetLink = resolveMeetLink({ consulta, nutricionista });

  if (status === 'cancelled') {
    await criarNotificacaoConsulta({
      consultaId: consulta.id,
      destinatarioTipo: 'paciente',
      destinatarioId: consulta.paciente_id,
      evento: 'cancelada',
      titulo: 'Consulta cancelada',
      mensagem: `Sua consulta de ${quando} foi cancelada.`,
    });
    await criarNotificacaoConsulta({
      consultaId: consulta.id,
      destinatarioTipo: 'nutricionista',
      destinatarioId: consulta.nutricionista_id,
      evento: 'cancelada',
      titulo: 'Consulta cancelada',
      mensagem: `A consulta de ${quando} foi cancelada.`,
    });
    return;
  }

  if (status === 'confirmed') {
    await criarNotificacaoConsulta({
      consultaId: consulta.id,
      destinatarioTipo: 'paciente',
      destinatarioId: consulta.paciente_id,
      evento: 'confirmada',
      titulo: 'Consulta confirmada pelo profissional',
      mensagem: `Sua teleconsulta em ${quando} foi confirmada. Entre pelo Google Meet: ${meetLink}`,
    });
  }
}

export async function createConsulta({
  nutricionistaId,
  pacienteId,
  scheduledAt,
  motivo,
  tipoConsulta,
  convenio,
  especialidade,
  valorCentavos,
  nutricionista,
  pacienteNome,
  actor,
  origin = 'agendamento_paciente',
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador para agendar.');
  if (!pacienteId) throw new Error('Paciente sem identificador para agendar.');
  if (!scheduledAt) throw new Error('Horario nao informado para agendamento.');

  const payload = {
    nutricionista_id: nutricionistaId,
    paciente_id: pacienteId,
    scheduled_at: scheduledAt,
    status: 'scheduled',
    motivo: motivo ? String(motivo).trim() : null,
    tipo_consulta: tipoConsulta || 'Teleconsulta',
    convenio: convenio || 'Particular',
    especialidade: especialidade || '',
    valor_centavos: Number(valorCentavos) || 0,
    canal: 'google_meet',
    meet_link: '',
  };

  const { data, error } = await supabase
    .from('consulta')
    .insert([payload])
    .select('*')
    .maybeSingle();

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('idx_consulta_unique_slot')) {
      throw new Error('Este horario ja foi reservado. Escolha outro slot.');
    }
    if (
      message.includes('tipo_consulta') ||
      message.includes('meet_link') ||
      message.includes('valor_centavos')
    ) {
      const fallbackPayload = {
        nutricionista_id: nutricionistaId,
        paciente_id: pacienteId,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        motivo: [
          motivo,
          tipoConsulta ? `Tipo: ${tipoConsulta}` : '',
          convenio ? `Convênio: ${convenio}` : '',
          especialidade ? `Especialidade: ${especialidade}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      };
      const retry = await supabase.from('consulta').insert([fallbackPayload]).select('*').maybeSingle();
      if (retry.error) throw retry.error;
      const withMeet = await persistirMeetLink(retry.data, nutricionista);
      try {
        await notificarAgendamento({ consulta: withMeet, nutricionista, pacienteNome });
      } catch (notifyError) {
        console.log('Erro ao notificar agendamento:', notifyError);
      }
      return withMeet;
    }
    throw error;
  }

  let consulta = data;
  consulta = await persistirMeetLink(consulta, nutricionista);

  if (!consulta?.meet_link && consulta?.id) {
    consulta = {
      ...consulta,
      meet_link: buildGoogleMeetLinkFromConsulta(consulta.id),
      canal: 'google_meet',
    };
  }

  try {
    await notificarAgendamento({ consulta, nutricionista, pacienteNome });
  } catch (notifyError) {
    console.log('Erro ao notificar agendamento:', notifyError);
  }

  if (consulta?.id) {
    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || null,
      targetPatientId: pacienteId,
      action: 'consulta_agendada',
      entity: 'consulta',
      entityId: consulta.id,
      origin,
      details: {
        nutricionistaId,
        scheduledAt,
        status: consulta.status,
        meetLink: consulta.meet_link,
      },
    });
  }

  return consulta;
}

export async function listConsultasByNutricionista(nutricionistaId, { limit = 120 } = {}) {
  if (!nutricionistaId) return [];

  const { data, error } = await supabase
    .from('consulta')
    .select('*')
    .eq('nutricionista_id', nutricionistaId)
    .order('scheduled_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function listConsultasByPaciente(pacienteId, { limit = 120 } = {}) {
  if (!pacienteId) return [];

  const { data, error } = await supabase
    .from('consulta')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('scheduled_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function updateConsultaStatus({
  consultaId,
  status,
  observacoesNutri,
  nutricionista,
  actor,
  origin = 'agenda_nutricionista',
}) {
  if (!consultaId) throw new Error('Consulta sem identificador para atualizar.');

  const nextStatus = normalizeConsultaStatus(status);
  const patch = {
    status: nextStatus,
    observacoes_nutri: typeof observacoesNutri === 'string' ? observacoesNutri : undefined,
  };

  const { data, error } = await supabase
    .from('consulta')
    .update(patch)
    .eq('id', consultaId)
    .select('*')
    .maybeSingle();

  if (error) throw error;

  if (data?.id) {
    try {
      await notificarMudancaStatus({ consulta: data, status: nextStatus, nutricionista });
    } catch (notifyError) {
      console.log('Erro ao notificar mudança de status:', notifyError);
    }

    await registrarLogAuditoria({
      actor: actor || null,
      actorType: actor?.tipo_perfil || null,
      targetPatientId: data.paciente_id || null,
      action: 'consulta_atualizada_status',
      entity: 'consulta',
      entityId: data.id,
      origin,
      details: {
        status: data.status,
        scheduledAt: data.scheduled_at,
      },
    });
  }

  return data;
}

export async function updateConsultaSchedule({
  consultaId,
  scheduledAt,
  motivo,
  tipoConsulta,
  convenio,
  especialidade,
  valorCentavos,
  nutricionista,
  actor,
  origin = 'reagendamento_paciente',
}) {
  if (!consultaId) throw new Error('Consulta sem identificador para reagendar.');
  if (!scheduledAt) throw new Error('Novo horario nao informado.');

  const patch = {
    scheduled_at: scheduledAt,
    motivo: motivo ? String(motivo).trim() : undefined,
    tipo_consulta: tipoConsulta || undefined,
    convenio: convenio || undefined,
    especialidade: especialidade || undefined,
    valor_centavos: Number(valorCentavos) || 0,
    status: 'scheduled',
    canal: 'google_meet',
  };

  const { data, error } = await supabase
    .from('consulta')
    .update(patch)
    .eq('id', consultaId)
    .select('*')
    .maybeSingle();

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('idx_consulta_unique_slot')) {
      throw new Error('Este horario ja foi reservado. Escolha outro slot.');
    }
    throw error;
  }

  let consulta = data;
  consulta = await persistirMeetLink(consulta, nutricionista);

  try {
    const quando = formatConsultaDateTime(consulta.scheduled_at);
    const nomeNutri =
      nutricionista?.nome_completo_nutri || nutricionista?.nome_nutri || 'Nutricionista';

    await criarNotificacaoConsulta({
      consultaId: consulta.id,
      destinatarioTipo: 'paciente',
      destinatarioId: consulta.paciente_id,
      evento: 'reagendada',
      titulo: 'Consulta reagendada',
      mensagem: `Sua consulta com ${nomeNutri} foi reagendada para ${quando}.`,
    });

    await criarNotificacaoConsulta({
      consultaId: consulta.id,
      destinatarioTipo: 'nutricionista',
      destinatarioId: consulta.nutricionista_id,
      evento: 'reagendada',
      titulo: 'Consulta reagendada pelo paciente',
      mensagem: `A consulta foi reagendada para ${quando}.`,
    });
  } catch (notifyError) {
    console.log('Erro ao notificar reagendamento:', notifyError);
  }

  await registrarLogAuditoria({
    actor: actor || null,
    actorType: actor?.tipo_perfil || null,
    targetPatientId: consulta?.paciente_id || null,
    action: 'consulta_reagendada',
    entity: 'consulta',
    entityId: consulta?.id || consultaId,
    origin,
    details: {
      scheduledAt: consulta?.scheduled_at || scheduledAt,
      status: consulta?.status || 'scheduled',
    },
  });

  return consulta;
}
