import { supabase } from './configSupabase';
import { isValidGoogleMeetUrl, normalizeGoogleMeetUrl } from './servicoGoogleMeet';

const PERFIL_TELECONSULTA_SELECT = '*';

export async function listNutritionists({ limit = 80 } = {}) {
  const { data, error } = await supabase
    .from('nutricionista')
    .select(PERFIL_TELECONSULTA_SELECT)
    .order('nome_completo_nutri', { ascending: true })
    .limit(limit);

  if (error) {
    const fallback = await supabase
      .from('nutricionista')
      .select('id_nutricionista_uuid, nome_completo_nutri, crm_numero, email_acesso')
      .order('nome_completo_nutri', { ascending: true })
      .limit(limit);
    if (fallback.error) throw fallback.error;
    return (fallback.data || []).map(enrichNutricionistaFallback);
  }

  return (data || []).map(enrichNutricionistaFallback);
}

function enrichNutricionistaFallback(item) {
  return {
    ...item,
    especialidade: item?.especialidade || 'Nutrição clínica',
    especialidades: item?.especialidades?.length
      ? item.especialidades
      : ['Nutrição clínica', 'Controle glicêmico', 'Nutrição esportiva'],
    bio_resumo:
      item?.bio_resumo ||
      'Atendimento por teleconsulta com foco em controle glicêmico e plano alimentar personalizado.',
    valor_consulta_centavos: Number(item?.valor_consulta_centavos) || 12000,
    meet_link_padrao: item?.meet_link_padrao || '',
    aceita_convenio: item?.aceita_convenio !== false,
    formacao_resumo: item?.formacao_resumo || '',
    rating_media:
      Number.isFinite(Number(item?.rating_media)) && Number(item?.rating_media) > 0
        ? Number(item.rating_media)
        : null,
    total_avaliacoes:
      Number.isFinite(Number(item?.total_avaliacoes)) && Number(item?.total_avaliacoes) >= 0
        ? Number(item.total_avaliacoes)
        : null,
    anos_experiencia:
      Number.isFinite(Number(item?.anos_experiencia)) && Number(item?.anos_experiencia) >= 0
        ? Number(item.anos_experiencia)
        : null,
  };
}

export async function getNutritionistById(nutricionistaId) {
  if (!nutricionistaId) return null;

  const { data, error } = await supabase
    .from('nutricionista')
    .select(PERFIL_TELECONSULTA_SELECT)
    .eq('id_nutricionista_uuid', nutricionistaId)
    .maybeSingle();

  if (error) throw error;
  return data ? enrichNutricionistaFallback(data) : null;
}

export async function updateNutricionistaTeleconsultaPerfil({
  nutricionistaId,
  meetLinkPadrao,
  bioResumo,
  especialidade,
  valorConsultaCentavos,
  aceitaConvenio,
  formacaoResumo,
}) {
  if (!nutricionistaId) throw new Error('Nutricionista sem identificador.');

  const meet = normalizeGoogleMeetUrl(meetLinkPadrao);
  if (meet && !isValidGoogleMeetUrl(meet)) {
    throw new Error('Informe um link válido do Google Meet (ex.: https://meet.google.com/abc-defg-hij).');
  }

  const patch = {
    meet_link_padrao: meet || '',
    bio_resumo: bioResumo != null ? String(bioResumo).trim() : undefined,
    especialidade: especialidade != null ? String(especialidade).trim() : undefined,
    valor_consulta_centavos:
      valorConsultaCentavos != null ? Number(valorConsultaCentavos) : undefined,
    aceita_convenio: typeof aceitaConvenio === 'boolean' ? aceitaConvenio : undefined,
    formacao_resumo: formacaoResumo != null ? String(formacaoResumo).trim() : undefined,
  };

  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined) delete patch[key];
  });

  const { data, error } = await supabase
    .from('nutricionista')
    .update(patch)
    .eq('id_nutricionista_uuid', nutricionistaId)
    .select(PERFIL_TELECONSULTA_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data ? enrichNutricionistaFallback(data) : null;
}
