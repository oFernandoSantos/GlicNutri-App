/**
 * Fotos modelo de profissionais (retrato real) quando não há foto no cadastro.
 * Índice estável por UUID/nome — mesmo profissional = mesma foto.
 */

const FOTO_PARAMS = 'w=256&h=256&fit=crop&crop=faces&auto=format&q=80';

/** Nutricionistas — retratos profissionais (diversidade). */
const FOTOS_MODELO_NUTRICIONISTA = [
  `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1582750433449-648ed127bb54?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1594824476967-48c8b964273f?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1551836022-d5d88e9528e0?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1560250097-0b93528c311a?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?${FOTO_PARAMS}`,
];

/** Médicos — retratos clínicos. */
const FOTOS_MODELO_MEDICO = [
  `https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1537368914554-14b4d5aebffa?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1622253692010-333f21724b1a?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1559839734-2b71ea197ec2?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1516540806160-ef87f5c4edd6?${FOTO_PARAMS}`,
  `https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?${FOTO_PARAMS}`,
];

function stablePhotoIndex(seed, poolLength) {
  const key = String(seed || 'profissional').trim();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return poolLength ? hash % poolLength : 0;
}

function pickFotoModelo(pool, record, fallbackSeed) {
  const seed =
    record?.id_nutricionista_uuid ||
    record?.id_medico_uuid ||
    record?.nome_completo_nutri ||
    record?.nome_completo_medico ||
    record?.nome ||
    fallbackSeed ||
    'profissional';
  return pool[stablePhotoIndex(seed, pool.length)];
}

function resolveFotoCadastrada(record) {
  return String(
    record?.foto_url ||
      record?.foto_perfil_url ||
      record?.foto_perfil ||
      record?.avatar_url ||
      record?.url_foto ||
      ''
  ).trim();
}

/** @param {'nutri'|'medico'} tipo */
export function resolveFotoUriProfissional(record, tipo = 'nutri') {
  const cadastrada = resolveFotoCadastrada(record);
  if (cadastrada) return cadastrada;
  return tipo === 'medico'
    ? getMedicoFotoModeloUri(record)
    : getNutricionistaFotoModeloUri(record);
}

export function getNutricionistaFotoModeloUri(nutri) {
  const cadastrada = resolveFotoCadastrada(nutri);
  if (cadastrada) return cadastrada;
  return pickFotoModelo(FOTOS_MODELO_NUTRICIONISTA, nutri, 'nutricionista');
}

export function getMedicoFotoModeloUri(medico) {
  const cadastrada = resolveFotoCadastrada(medico);
  if (cadastrada) return cadastrada;
  return pickFotoModelo(FOTOS_MODELO_MEDICO, medico, 'medico');
}

/** Compat — nomes usados nas telas antigas. */
export const getNutriAvatarUri = getNutricionistaFotoModeloUri;
export const getMedicoAvatarUri = getMedicoFotoModeloUri;
