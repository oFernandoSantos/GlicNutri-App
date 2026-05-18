import { supabase } from './configSupabase';

export async function criarNotificacaoConsulta({
  consultaId,
  destinatarioTipo,
  destinatarioId,
  evento,
  titulo,
  mensagem,
}) {
  if (!destinatarioTipo || !destinatarioId) return null;

  const { data, error } = await supabase
    .from('consulta_notificacao')
    .insert([
      {
        consulta_id: consultaId || null,
        destinatario_tipo: destinatarioTipo,
        destinatario_id: destinatarioId,
        evento,
        titulo,
        mensagem,
        lida: false,
      },
    ])
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listarNotificacoesConsulta({
  destinatarioTipo,
  destinatarioId,
  apenasNaoLidas = false,
  limit = 40,
}) {
  if (!destinatarioTipo || !destinatarioId) return [];

  let query = supabase
    .from('consulta_notificacao')
    .select('*')
    .eq('destinatario_tipo', destinatarioTipo)
    .eq('destinatario_id', destinatarioId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (apenasNaoLidas) {
    query = query.eq('lida', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function marcarNotificacoesComoLidas({
  destinatarioTipo,
  destinatarioId,
  ids = [],
}) {
  if (!destinatarioTipo || !destinatarioId) return;

  let query = supabase
    .from('consulta_notificacao')
    .update({ lida: true })
    .eq('destinatario_tipo', destinatarioTipo)
    .eq('destinatario_id', destinatarioId)
    .eq('lida', false);

  if (ids.length) {
    query = query.in('id', ids);
  }

  const { error } = await query;
  if (error) throw error;
}

export function subscribeNotificacoesConsulta({
  destinatarioTipo,
  destinatarioId,
  onChange,
  intervalMs = 20000,
}) {
  if (!destinatarioTipo || !destinatarioId || typeof onChange !== 'function') {
    return () => {};
  }

  let active = true;

  async function poll() {
    if (!active) return;
    try {
      const items = await listarNotificacoesConsulta({
        destinatarioTipo,
        destinatarioId,
        apenasNaoLidas: true,
        limit: 20,
      });
      onChange(items);
    } catch (error) {
      console.log('Erro ao buscar notificações de consulta:', error);
    }
  }

  poll();
  const timer = setInterval(poll, intervalMs);

  return () => {
    active = false;
    clearInterval(timer);
  };
}
