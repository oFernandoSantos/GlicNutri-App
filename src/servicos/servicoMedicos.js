import { supabase } from './configSupabase';
import {
  getStableExperienceYears,
  getStableRating,
  getStableReviewCount,
} from '../utilitarios/slotsTeleconsulta';

const MEDICO_PUBLIC_SELECT =
  'id_medico_uuid, nome_completo_medico, crm_medico, email_medico, especialidade_medico, telefone_medico, ativo, created_at, updated_at';

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterMedicos(medicos, filters = {}) {
  const { query, quickFilter, especialidade, maxValorCentavos, ratingMinimo, somenteConvenio } =
    filters;
  const q = normalizeSearchText(query);

  let list = [...(medicos || [])];

  if (especialidade && especialidade !== 'Todas') {
    const needle = normalizeSearchText(especialidade);
    list = list.filter((item) =>
      normalizeSearchText(getMedicoEspecialidadeLabel(item)).includes(needle)
    );
  }

  if (somenteConvenio) {
    list = list.filter((item) => item?.aceita_convenio !== false);
  }

  if (Number.isFinite(Number(maxValorCentavos)) && Number(maxValorCentavos) > 0) {
    list = list.filter(
      (item) => Number(item?.valor_consulta_centavos || 0) <= Number(maxValorCentavos)
    );
  }

  if (Number.isFinite(Number(ratingMinimo)) && Number(ratingMinimo) > 0) {
    list = list.filter((item) => {
      const seed = item?.id_medico_uuid || item?.nome_completo_medico || 'medico';
      const rating =
        Number.isFinite(Number(item?.rating_media)) && Number(item?.rating_media) > 0
          ? Number(item.rating_media)
          : Number(getStableRating(seed));
      return rating >= Number(ratingMinimo);
    });
  }

  if (q) {
    list = list.filter((item) => {
      const haystack = normalizeSearchText(
        [
          item?.nome_completo_medico,
          item?.crm_medico,
          item?.email_medico,
          getMedicoEspecialidadeLabel(item),
          item?.bio_resumo,
        ].join(' ')
      );
      return haystack.includes(q);
    });
  }

  if (quickFilter === 'top') {
    list.sort(
      (a, b) =>
        Number(getStableRating(b.id_medico_uuid)) - Number(getStableRating(a.id_medico_uuid))
    );
  }

  return list;
}

export async function listMedicos({ limit = null } = {}) {
  let query = supabase
    .from('medico')
    .select(MEDICO_PUBLIC_SELECT)
    .eq('ativo', true)
    .order('nome_completo_medico', { ascending: true });

  if (Number.isFinite(Number(limit)) && Number(limit) > 0) {
    query = query.limit(Number(limit));
  }

  const { data, error } = await query;

  if (error) {
    const fallback = await supabase
      .from('medico')
      .select('id_medico_uuid, nome_completo_medico, crm_medico, email_medico, especialidade_medico, ativo')
      .eq('ativo', true)
      .order('nome_completo_medico', { ascending: true });

    if (fallback.error) throw fallback.error;
    return (fallback.data || []).map(enrichMedicoFallback);
  }

  return (data || []).map(enrichMedicoFallback);
}

function enrichMedicoFallback(item) {
  const seed = item?.id_medico_uuid || item?.nome_completo_medico || item?.email_medico || 'medico';

  return {
    ...item,
    especialidade: item?.especialidade_medico || item?.especialidade || 'Endocrinologia e diabetes',
    bio_resumo:
      item?.bio_resumo ||
      'Acompanhamento clinico de diabetes, glicemia, medicacao e insulina por teleconsulta.',
    valor_consulta_centavos: Number(item?.valor_consulta_centavos) || 25000,
    aceita_convenio: item?.aceita_convenio !== false,
    rating_media:
      Number.isFinite(Number(item?.rating_media)) && Number(item?.rating_media) > 0
        ? Number(item.rating_media)
        : Number(getStableRating(seed)),
    total_avaliacoes:
      Number.isFinite(Number(item?.total_avaliacoes)) && Number(item?.total_avaliacoes) > 0
        ? Number(item.total_avaliacoes)
        : getStableReviewCount(seed),
    anos_experiencia:
      Number.isFinite(Number(item?.anos_experiencia)) && Number(item?.anos_experiencia) > 0
        ? Number(item.anos_experiencia)
        : getStableExperienceYears(seed),
  };
}

export async function getMedicoById(medicoId) {
  if (!medicoId) return null;

  const { data, error } = await supabase
    .from('medico')
    .select(MEDICO_PUBLIC_SELECT)
    .eq('id_medico_uuid', medicoId)
    .maybeSingle();

  if (error) throw error;
  return data ? enrichMedicoFallback(data) : null;
}

export function getMedicoEspecialidadeLabel(medico) {
  return String(medico?.especialidade_medico || medico?.especialidade || 'Clinica medica').trim();
}
