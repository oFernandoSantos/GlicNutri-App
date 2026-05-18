const MEET_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export function isValidGoogleMeetUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  return /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?.*)?$/i.test(value);
}

export function normalizeGoogleMeetUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('meet.google.com/')) {
    return `https://${raw}`;
  }
  if (!raw.startsWith('http')) {
    return `https://meet.google.com/${raw.replace(/^\/+/, '')}`;
  }
  return raw;
}

export function buildMeetCodeFromSeed(seed) {
  const text = String(seed || 'glicnutri').replace(/-/g, '');
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  const pick = (offset) => MEET_CODE_ALPHABET[(hash + offset) % MEET_CODE_ALPHABET.length];

  const part1 = `${pick(1)}${pick(2)}${pick(3)}`;
  const part2 = `${pick(4)}${pick(5)}${pick(6)}${pick(7)}`;
  const part3 = `${pick(8)}${pick(9)}${pick(10)}`;

  return `${part1}-${part2}-${part3}`;
}

export function buildGoogleMeetLinkFromConsulta(consultaId) {
  const code = buildMeetCodeFromSeed(consultaId);
  return `https://meet.google.com/${code}`;
}

export function resolveMeetLink({ consulta, nutricionista }) {
  const stored = normalizeGoogleMeetUrl(consulta?.meet_link);
  if (stored && isValidGoogleMeetUrl(stored)) {
    return stored;
  }

  const padrao = normalizeGoogleMeetUrl(nutricionista?.meet_link_padrao);
  if (padrao && isValidGoogleMeetUrl(padrao)) {
    return padrao;
  }

  if (consulta?.id) {
    return buildGoogleMeetLinkFromConsulta(consulta.id);
  }

  return '';
}

export function formatValorConsulta(centavos) {
  const value = Number(centavos) || 0;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
