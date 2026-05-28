import { supabase } from './configSupabase';
import { registrarLogAuditoria } from './servicoAuditoria';
import { enrichRpcClinicalParams } from './servicoSessaoRpc';

// ─── Prontuário Base ───────────────────────────────────────────────────────────

export async function fetchProntuarioBase(pacienteId) {
  if (!pacienteId) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'obter_prontuario_paciente',
    await enrichRpcClinicalParams({ p_paciente_id: pacienteId }, pacienteId)
  );

  if (!rpcError) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return row || null;
  }

  const rpcMsg = String(rpcError.message || '').toLowerCase();
  if (!rpcMsg.includes('does not exist') && !rpcMsg.includes('schema cache')) {
    console.log('RPC obter_prontuario_paciente:', rpcError.message);
  }

  const { data, error } = await supabase
    .from('prontuario')
    .select('*')
    .eq('paciente_id', pacienteId)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return null;
    throw error;
  }
  return data || null;
}

export async function upsertProntuarioBase({
  pacienteId,
  queixaPrincipal,
  historicoDomencaAtual,
  historicoFamiliar,
  comorbidades,
  alergias,
  diagnosticosCid,
  tipoDiabetes,
  anoDiagnosticoDiabetes,
  usaInsulina,
  esquemaInsulina,
  observacoesGerais,
  actor,
}) {
  if (!pacienteId) throw new Error('Paciente sem identificador para salvar prontuário.');

  const { data, error } = await supabase.rpc(
    'upsert_prontuario_paciente',
    await enrichRpcClinicalParams(
      {
        p_paciente_id: pacienteId,
        p_queixa_principal: queixaPrincipal || null,
        p_historico_doenca_atual: historicoDomencaAtual || null,
        p_historico_familiar: historicoFamiliar || null,
        p_comorbidades: Array.isArray(comorbidades) ? comorbidades : null,
        p_alergias: Array.isArray(alergias) ? alergias : null,
        p_diagnosticos_cid: Array.isArray(diagnosticosCid) ? diagnosticosCid : null,
        p_tipo_diabetes: tipoDiabetes || null,
        p_ano_diagnostico_diabetes: anoDiagnosticoDiabetes || null,
        p_usa_insulina: typeof usaInsulina === 'boolean' ? usaInsulina : null,
        p_esquema_insulina: esquemaInsulina || null,
        p_observacoes_gerais: observacoesGerais || null,
      },
      pacienteId
    )
  );

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      // Fallback: direct upsert
      const { data: direct, error: directErr } = await supabase
        .from('prontuario')
        .upsert({ paciente_id: pacienteId, queixa_principal: queixaPrincipal, observacoes_gerais: observacoesGerais }, { onConflict: 'paciente_id' })
        .select('*')
        .maybeSingle();
      if (directErr) throw directErr;
      return direct;
    }
    throw error;
  }

  if (actor && pacienteId) {
    registrarLogAuditoria({
      actor,
      actorType: 'nutricionista',
      targetPatientId: pacienteId,
      action: 'prontuario_atualizado',
      entity: 'prontuario',
      entityId: pacienteId,
      origin: 'prontuario_nutri',
    }).catch(() => {});
  }

  return Array.isArray(data) ? data[0] : data;
}

// ─── Antropometria ─────────────────────────────────────────────────────────────

export async function fetchAntropometriaHistorico(pacienteId, limit = 20) {
  if (!pacienteId) return [];

  const { data, error } = await supabase
    .from('prontuario_antropometria')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('data_afericao', { ascending: false })
    .limit(limit);

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return [];
    throw error;
  }
  return data || [];
}

export async function addAntropometria({
  pacienteId,
  nutricionistaId,
  medicoId,
  dataAfericao,
  pesoKg,
  alturaCm,
  circAbdominalCm,
  circQuadrilCm,
  percGordura,
  pressaoSistolica,
  pressaoDiastolica,
  observacao,
  actor,
}) {
  if (!pacienteId) throw new Error('Paciente sem identificador para registrar antropometria.');

  const payload = {
    paciente_id:                  pacienteId,
    nutricionista_id:             nutricionistaId || null,
    medico_id:                    medicoId || null,
    data_afericao:                dataAfericao || new Date().toISOString().slice(0, 10),
    peso_kg:                      pesoKg != null ? Number(pesoKg) : null,
    altura_cm:                    alturaCm != null ? Number(alturaCm) : null,
    circunferencia_abdominal_cm:  circAbdominalCm != null ? Number(circAbdominalCm) : null,
    circunferencia_quadril_cm:    circQuadrilCm != null ? Number(circQuadrilCm) : null,
    percentual_gordura:           percGordura != null ? Number(percGordura) : null,
    pressao_sistolica:            pressaoSistolica != null ? Number(pressaoSistolica) : null,
    pressao_diastolica:           pressaoDiastolica != null ? Number(pressaoDiastolica) : null,
    observacao:                   observacao || null,
  };

  const { data, error } = await supabase
    .from('prontuario_antropometria')
    .insert([payload])
    .select('*')
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return null;
    throw error;
  }

  if (pesoKg != null && pacienteId) {
    await supabase
      .from('paciente')
      .update({ peso_atual_kg: Number(pesoKg), data_hora_ultima_atualizacao: new Date().toISOString() })
      .eq('id_paciente_uuid', pacienteId);
  }

  if (actor) {
    registrarLogAuditoria({
      actor,
      actorType: 'nutricionista',
      targetPatientId: pacienteId,
      action: 'antropometria_registrada',
      entity: 'prontuario_antropometria',
      entityId: data?.id,
      origin: 'prontuario_nutri',
      details: { pesoKg, alturaCm },
    }).catch(() => {});
  }

  return data;
}

// ─── Evolução Clínica ──────────────────────────────────────────────────────────

export async function fetchEvolucaoHistorico(pacienteId, limit = 30) {
  if (!pacienteId) return [];

  const { data, error } = await supabase
    .from('prontuario_evolucao')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return [];
    throw error;
  }
  return data || [];
}

export async function addEvolucao({
  pacienteId,
  nutricionistaId,
  medicoId,
  consultaId,
  subjetivo,
  avaliacao,
  plano,
  orientacoes,
  adesaoPlano,
  dificuldadesRelatadas,
  ajustesPlano,
  retornoEm,
  actor,
}) {
  if (!pacienteId) throw new Error('Paciente sem identificador para registrar evolução.');
  if (!nutricionistaId && !medicoId) {
    throw new Error('Informe nutricionista ou médico para registrar evolução.');
  }

  // Try RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'registrar_evolucao_prontuario',
    await enrichRpcClinicalParams(
      {
        p_paciente_id: pacienteId,
        p_nutricionista_id: nutricionistaId || null,
        p_medico_id: medicoId || null,
        p_consulta_id: consultaId || null,
        p_subjetivo: subjetivo || null,
        p_avaliacao: avaliacao || null,
        p_plano: plano || null,
        p_orientacoes: orientacoes || null,
      },
      pacienteId
    )
  );

  let saved = null;

  if (!rpcError) {
    saved = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  } else {
    const msg = String(rpcError.message || '').toLowerCase();
    if (!msg.includes('does not exist') && !msg.includes('schema cache')) {
      throw rpcError;
    }
    // Fallback direct insert
    const { data: direct, error: directErr } = await supabase
      .from('prontuario_evolucao')
      .insert([{
        paciente_id:      pacienteId,
        nutricionista_id: nutricionistaId || null,
        medico_id:        medicoId || null,
        consulta_id:      consultaId || null,
        subjetivo:        subjetivo || null,
        avaliacao:        avaliacao || null,
        plano:            plano || null,
        orientacoes_gerais: orientacoes || null,
        adesao_plano_alimentar: adesaoPlano || null,
        dificuldades_relatadas: dificuldadesRelatadas || null,
        ajustes_plano:    ajustesPlano || null,
        retorno_em:       retornoEm || null,
      }])
      .select('*')
      .maybeSingle();

    if (directErr) {
      const dMsg = String(directErr.message || '').toLowerCase();
      if (!dMsg.includes('does not exist')) throw directErr;
      return null;
    }
    saved = direct;
  }

  // Also create prontuario_nota for backward compat (feeds existing timeline)
  const textoNota = [subjetivo, avaliacao, plano, orientacoes].filter(Boolean).join('\n\n');
  if (textoNota && pacienteId && (nutricionistaId || medicoId)) {
    await supabase
      .from('prontuario_nota')
      .insert([{
        nutricionista_id: nutricionistaId || null,
        medico_id:        medicoId || null,
        paciente_id:      pacienteId,
        consulta_id:      consultaId || null,
        texto:            textoNota,
      }])
      .select('id')
      .maybeSingle();
  }

  if (actor) {
    registrarLogAuditoria({
      actor,
      actorType: 'nutricionista',
      targetPatientId: pacienteId,
      action: 'evolucao_clinica_registrada',
      entity: 'prontuario_evolucao',
      entityId: saved?.id,
      origin: 'prontuario_nutri',
    }).catch(() => {});
  }

  return saved;
}

// ─── Metas Clínicas ────────────────────────────────────────────────────────────

export async function fetchMetaClinicaAtiva(pacienteId) {
  if (!pacienteId) return null;

  const { data, error } = await supabase
    .from('prontuario_meta_clinica')
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('vigente', true)
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return null;
    throw error;
  }
  return data || null;
}

export async function upsertMetaClinica({
  pacienteId,
  nutricionistaId,
  metaHba1c,
  metaGlicemiaJejum,
  metaGlicemiaPosPrandial,
  metaCalorias,
  metaCarboidratos,
  metaProteinas,
  metaGorduras,
  metaFibras,
  metaAgua,
  metaPeso,
  vigenteSince,
  vigenteTil,
  observacao,
  actor,
}) {
  if (!pacienteId) throw new Error('Paciente sem identificador para salvar metas.');

  // Desativa meta anterior
  await supabase
    .from('prontuario_meta_clinica')
    .update({ vigente: false })
    .eq('paciente_id', pacienteId)
    .eq('vigente', true);

  const { data, error } = await supabase
    .from('prontuario_meta_clinica')
    .insert([{
      paciente_id:                        pacienteId,
      nutricionista_id:                   nutricionistaId || null,
      meta_hba1c_pct:                     metaHba1c || null,
      meta_glicemia_jejum_mgdl:           metaGlicemiaJejum || null,
      meta_glicemia_pos_prandial_mgdl:    metaGlicemiaPosPrandial || null,
      meta_calorias_dia:                  metaCalorias || null,
      meta_carboidratos_g:                metaCarboidratos || null,
      meta_proteinas_g:                   metaProteinas || null,
      meta_gorduras_g:                    metaGorduras || null,
      meta_fibras_g:                      metaFibras || null,
      meta_agua_litros:                   metaAgua || null,
      meta_peso_kg:                       metaPeso || null,
      vigente:                            true,
      vigente_desde:                      vigenteSince || new Date().toISOString().slice(0, 10),
      vigente_ate:                        vigenteTil || null,
      observacao:                         observacao || null,
    }])
    .select('*')
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return null;
    throw error;
  }

  if (actor) {
    registrarLogAuditoria({
      actor,
      actorType: 'nutricionista',
      targetPatientId: pacienteId,
      action: 'meta_clinica_atualizada',
      entity: 'prontuario_meta_clinica',
      entityId: data?.id,
      origin: 'prontuario_nutri',
    }).catch(() => {});
  }

  return data;
}

// ─── Fetch completo do prontuário ──────────────────────────────────────────────

export async function fetchProntuarioCompleto(pacienteId) {
  if (!pacienteId) return null;

  const [prontuario, antropometria, evolucao, meta] = await Promise.all([
    fetchProntuarioBase(pacienteId).catch(() => null),
    fetchAntropometriaHistorico(pacienteId, 10).catch(() => []),
    fetchEvolucaoHistorico(pacienteId, 20).catch(() => []),
    fetchMetaClinicaAtiva(pacienteId).catch(() => null),
  ]);

  return {
    prontuario,
    antropometria,          // array, mais recente primeiro
    ultimaAntropometria: antropometria[0] || null,
    evolucao,               // array, mais recente primeiro
    metaAtiva: meta,
  };
}

// ─── Histórico de consultas do paciente (para nutri) ──────────────────────────

export async function fetchConsultasHistorico(pacienteId, nutricionistaId, limit = 30) {
  if (!pacienteId) return [];

  let query = supabase
    .from('consulta')
    .select('id, scheduled_at, status, motivo, observacoes_nutri, conduta, proximos_passos, duracao_minutos, realizada_em, nutricionista_id, meet_link')
    .eq('paciente_id', pacienteId)
    .order('scheduled_at', { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('conduta') || msg.includes('proximos_passos')) {
      const retry = await supabase
        .from('consulta')
        .select('id, scheduled_at, status, motivo, observacoes_nutri, nutricionista_id, meet_link')
        .eq('paciente_id', pacienteId)
        .order('scheduled_at', { ascending: false })
        .limit(limit);
      if (retry.error) throw retry.error;
      return retry.data || [];
    }
    throw error;
  }
  return data || [];
}

// ─── Plano alimentar estruturado ──────────────────────────────────────────────

export async function fetchPlanoCompleto(planoId) {
  if (!planoId) return null;

  const { data, error } = await supabase
    .rpc('buscar_plano_alimentar_completo', { p_plano_id: planoId });

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) return null;
    throw error;
  }
  return data || null;
}

export async function fetchHistoricoPlanos(pacienteId, limit = 10) {
  if (!pacienteId) return [];

  const { data, error } = await supabase
    .rpc('listar_planos_paciente', { p_paciente_id: pacienteId, p_limite: limit })
    .catch(async () => {
      return await supabase
        .from('plano_alimentar')
        .select('id, titulo, ativo, inicio_em, fim_em, updated_at')
        .eq('paciente_id', pacienteId)
        .order('updated_at', { ascending: false })
        .limit(limit);
    });

  if (error) throw error;
  return data || [];
}

export async function upsertPlanoComRefeicoes({
  planoId,
  nutricionistaId,
  pacienteId,
  titulo,
  descricao,
  metas,
  inicioEm,
  fimEm,
  ativo = true,
  refeicoes = [],   // array de { nome, horario, tipo, objetivo, calorias_total, carboidratos_g, proteinas_g, gorduras_g, itens[] }
  actor,
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador para salvar plano.');
  if (!pacienteId) throw new Error('Paciente sem identificador para salvar plano.');

  // Upsert plano_alimentar
  const planPayload = {
    ...(planoId ? { id: planoId } : {}),
    nutricionista_id: nutricionistaId,
    paciente_id:      pacienteId,
    titulo:           String(titulo || 'Plano alimentar').trim(),
    descricao:        String(descricao || '').trim(),
    metas:            metas || null,
    inicio_em:        inicioEm || null,
    fim_em:           fimEm || null,
    ativo:            Boolean(ativo),
  };

  const planQuery = planoId
    ? supabase.from('plano_alimentar').update(planPayload).eq('id', planoId)
    : supabase.from('plano_alimentar').insert([planPayload]);

  const { data: plano, error: planoError } = await planQuery.select('*').maybeSingle();
  if (planoError) throw planoError;

  const savedPlanoId = plano?.id;
  if (!savedPlanoId) throw new Error('Plano alimentar não confirmado pelo banco.');

  // Apaga refeições antigas antes de inserir novas (não mantém histórico de itens, apenas de planos)
  if (refeicoes.length > 0) {
    await supabase.from('plano_alimentar_refeicao').delete().eq('plano_id', savedPlanoId);
  }

  // Insere novas refeições e itens
  for (let index = 0; index < refeicoes.length; index++) {
    const ref = refeicoes[index];

    const { data: savedRef, error: refError } = await supabase
      .from('plano_alimentar_refeicao')
      .insert([{
        plano_id:         savedPlanoId,
        paciente_id:      pacienteId,
        nutricionista_id: nutricionistaId,
        nome:             String(ref.nome || ref.title || 'Refeição').trim(),
        horario:          ref.horario || ref.time || null,
        tipo:             ref.tipo || 'principal',
        objetivo:         ref.objetivo || ref.objective || null,
        observacoes:      ref.observacoes || null,
        calorias_total:   ref.calorias_total != null ? Number(ref.calorias_total) : null,
        carboidratos_g:   ref.carboidratos_g != null ? Number(ref.carboidratos_g) : null,
        proteinas_g:      ref.proteinas_g != null ? Number(ref.proteinas_g) : null,
        gorduras_g:       ref.gorduras_g != null ? Number(ref.gorduras_g) : null,
        fibras_g:         ref.fibras_g != null ? Number(ref.fibras_g) : null,
        ordem:            index,
      }])
      .select('id')
      .maybeSingle();

    if (refError) continue;

    const refeicaoId = savedRef?.id;
    const itens = Array.isArray(ref.itens) ? ref.itens : Array.isArray(ref.foods) ? ref.foods.map(f => ({ nome_alimento: f })) : [];

    if (itens.length && refeicaoId) {
      const itemPayloads = itens.map((item, itemIndex) => ({
        refeicao_id:      refeicaoId,
        plano_id:         savedPlanoId,
        paciente_id:      pacienteId,
        nome_alimento:    String(item.nome_alimento || item.nome || item.name || item).trim(),
        quantidade:       item.quantidade != null ? Number(item.quantidade) : null,
        unidade_medida:   item.unidade_medida || item.unidade || 'g',
        calorias:         item.calorias != null ? Number(item.calorias) : null,
        carboidratos_g:   item.carboidratos_g != null ? Number(item.carboidratos_g) : null,
        proteinas_g:      item.proteinas_g != null ? Number(item.proteinas_g) : null,
        gorduras_g:       item.gorduras_g != null ? Number(item.gorduras_g) : null,
        fibras_g:         item.fibras_g != null ? Number(item.fibras_g) : null,
        substituicoes:    Array.isArray(item.substituicoes) ? item.substituicoes : null,
        observacao:       item.observacao || null,
        ordem:            itemIndex,
      }));

      await supabase.from('plano_alimentar_item').insert(itemPayloads);
    }
  }

  if (actor) {
    registrarLogAuditoria({
      actor,
      actorType: 'nutricionista',
      targetPatientId: pacienteId,
      action: planoId ? 'plano_alimentar_atualizado' : 'plano_alimentar_criado',
      entity: 'plano_alimentar',
      entityId: savedPlanoId,
      origin: 'prontuario_nutri',
    }).catch(() => {});
  }

  return plano;
}

// ─── Finalizar consulta com conduta ───────────────────────────────────────────

export async function finalizarConsultaComConduta({
  consultaId,
  conduta,
  proximosPassos,
  duracaoMinutos,
  nutricionistaId,
  pacienteId,
  notaEvolucao,
  actor,
}) {
  if (!consultaId) throw new Error('Consulta sem identificador para finalizar.');

  // Try RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc('finalizar_consulta_nutri', {
    p_consulta_id:      consultaId,
    p_conduta:          conduta || null,
    p_proximos_passos:  proximosPassos || null,
    p_duracao_minutos:  duracaoMinutos || null,
    p_nutricionista_id: nutricionistaId || null,
    p_paciente_id:      pacienteId || null,
    p_nota_evolucao:    notaEvolucao || null,
  });

  if (!rpcError) {
    return Array.isArray(rpcData) ? rpcData[0] : rpcData;
  }

  // Fallback: separate updates
  const patch = { status: 'done' };
  const msg = String(rpcError.message || '').toLowerCase();
  if (!msg.includes('conduta') && !msg.includes('proximos_passos')) {
    if (!msg.includes('does not exist') && !msg.includes('schema cache')) {
      console.log('finalizar_consulta_nutri RPC falhou:', rpcError.message);
    }
  }

  try {
    const fullPatch = { ...patch, observacoes_nutri: conduta || null };
    await supabase.from('consulta').update(fullPatch).eq('id', consultaId);
  } catch (_) {
    await supabase.from('consulta').update(patch).eq('id', consultaId);
  }

  if (notaEvolucao && pacienteId && nutricionistaId) {
    await supabase.from('prontuario_nota').insert([{
      nutricionista_id: nutricionistaId,
      paciente_id:      pacienteId,
      consulta_id:      consultaId,
      texto:            [notaEvolucao, proximosPassos].filter(Boolean).join('\n\nPróximos passos: '),
    }]).select('id').maybeSingle();
  }

  const { data: consulta } = await supabase
    .from('consulta').select('*').eq('id', consultaId).maybeSingle();

  if (actor) {
    registrarLogAuditoria({
      actor,
      actorType: 'nutricionista',
      targetPatientId: pacienteId,
      action: 'consulta_finalizada',
      entity: 'consulta',
      entityId: consultaId,
      origin: 'consulta_nutri',
      details: { conduta: !!conduta, nota: !!notaEvolucao },
    }).catch(() => {});
  }

  return consulta;
}
