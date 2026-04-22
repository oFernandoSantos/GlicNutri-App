import { corsHeaders } from '../_shared/cors.ts';

const ANVISA_MEDICINES_API_URL =
  'https://consultas.anvisa.gov.br/api/consulta/medicamento/produtos/';
const ANVISA_OPEN_DATA_URLS = [
  'https://dados.anvisa.gov.br/dados/CONSULTAS/PRODUTOS/TA_CONSULTA_MEDICAMENTOS.CSV',
  'http://dados.anvisa.gov.br/dados/CONSULTAS/PRODUTOS/TA_CONSULTA_MEDICAMENTOS.CSV',
];

const FALLBACK_MEDICINES = [
  'AAS',
  'Amoxicilina',
  'Atenolol',
  'Dapagliflozina',
  'Dipirona',
  'Dipirona monoidratada',
  'Dipirona sódica',
  'Empagliflozina',
  'Enalapril',
  'Glibenclamida',
  'Gliclazida',
  'Hidroclorotiazida',
  'Ibuprofeno',
  'Liraglutida',
  'Losartana',
  'Metformina',
  'Omeprazol',
  'Paracetamol',
  'Semaglutida',
  'Sinvastatina',
  'Sitagliptina',
];

type SearchPayload = {
  query?: string;
  limit?: number;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function compactSearchText(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function buildQueryVariants(query: string) {
  const trimmedQuery = query.trim();
  const compactQuery = compactSearchText(trimmedQuery);
  const variants = [trimmedQuery];

  if (compactQuery && compactQuery !== normalizeText(trimmedQuery)) {
    variants.push(compactQuery);
  }

  return Array.from(new Set(variants.filter((item) => item.length >= 2)));
}

function addName(names: Set<string>, value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return;

  String(value || '')
    .replace(/^"|"$/g, '')
    .split(/\s*[+,;/]\s*/)
    .map((item) => item.trim())
    .filter((item) => item && normalizeText(item) !== 'object object')
    .forEach((item) => names.add(item));
}

function extractNamesFromPayload(payload: unknown) {
  const names = new Set<string>();

  function visit(value: unknown) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    [
      record.nome,
      record.nomeProduto,
      record.nomeComercial,
      record.nomeMedicamento,
      record.produto,
      record.medicamento,
      record.principioAtivo,
      record.principio_ativo,
      record.substancia,
    ].forEach((item) => addName(names, item));

    Object.values(record).forEach(visit);
  }

  visit(payload);
  return Array.from(names).sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

function splitCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === separator && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function getCsvNameColumns(headers: string[]) {
  const preferredFragments = [
    'nome produto',
    'nome_produto',
    'produto',
    'medicamento',
    'nome comercial',
    'nome_comercial',
    'principio ativo',
    'principio_ativo',
    'substancia',
  ];
  const normalizedHeaders = headers.map(normalizeText);
  const indexes = normalizedHeaders
    .map((header, index) =>
      preferredFragments.some((fragment) => header.includes(normalizeText(fragment)))
        ? index
        : -1
    )
    .filter((index) => index >= 0);

  return indexes.length ? indexes : [0];
}

function parseCsvNames(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) return [];

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0], separator);
  const nameColumns = getCsvNameColumns(headers);
  const names = new Set<string>();

  lines.slice(1).forEach((line) => {
    const columns = splitCsvLine(line, separator);
    nameColumns.forEach((index) => addName(names, columns[index]));
  });

  return Array.from(names).sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

async function searchAnvisaApi(query: string, limit: number) {
  const normalizedQuery = normalizeText(query);
  const filters = ['nomeProduto', 'principioAtivo'];
  const searches = await Promise.allSettled(
    filters.map(async (filterName) => {
      const params = new URLSearchParams({
        count: String(limit),
        page: '1',
      });
      params.append(`filter[${filterName}]`, query);

      const response = await fetch(`${ANVISA_MEDICINES_API_URL}?${params.toString()}`, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Authorization: 'Guest',
          Referer: 'https://consultas.anvisa.gov.br/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Anvisa API ${filterName}: ${response.status}`);
      }

      return extractNamesFromPayload(await response.json());
    })
  );
  const names = new Set<string>();

  searches.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((item) => names.add(item));
  });

  const results = Array.from(names);
  const matchingResults = results.filter((item) =>
    normalizeText(item).includes(normalizedQuery)
  );
  const rankedResults = (matchingResults.length ? matchingResults : results).sort((left, right) => {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);
    const leftExact = normalizedLeft === normalizedQuery ? 0 : 1;
    const rightExact = normalizedRight === normalizedQuery ? 0 : 1;
    const leftStartsWith = normalizedLeft.startsWith(normalizedQuery) ? 0 : 1;
    const rightStartsWith = normalizedRight.startsWith(normalizedQuery) ? 0 : 1;

    return (
      leftExact - rightExact ||
      leftStartsWith - rightStartsWith ||
      left.localeCompare(right, 'pt-BR')
    );
  });

  return rankedResults.slice(0, limit);
}

async function searchAnvisaOpenData(query: string, limit: number) {
  const normalizedQuery = normalizeText(query);

  for (const url of ANVISA_OPEN_DATA_URLS) {
    try {
      const response = await fetch(url);

      if (!response.ok) continue;

      const names = parseCsvNames(await response.text());
      return names
        .filter((name) => normalizeText(name).includes(normalizedQuery))
        .slice(0, limit);
    } catch (error) {
      console.log('Erro ao buscar CSV da Anvisa:', error);
    }
  }

  return [];
}

function searchFallback(query: string, limit: number) {
  const normalizedQuery = normalizeText(query);

  return FALLBACK_MEDICINES.filter((item) =>
    normalizeText(item).includes(normalizedQuery)
  ).slice(0, limit);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Metodo nao permitido.' }, 405);
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as SearchPayload;
    const query = String(payload.query || '').trim();
    const limit = Math.max(1, Math.min(Number(payload.limit) || 40, 80));

    if (query.length < 2) {
      return jsonResponse({ ok: true, results: [], source: 'empty' });
    }

    const queryVariants = buildQueryVariants(query);
    let apiResults: string[] = [];

    for (const queryVariant of queryVariants) {
      apiResults = await searchAnvisaApi(queryVariant, limit);

      if (apiResults.length) break;
    }

    if (apiResults.length) {
      return jsonResponse({ ok: true, results: apiResults, source: 'anvisa-api' });
    }

    for (const queryVariant of queryVariants) {
      if (queryVariant.length > 4) {
        const prefixResults = await searchAnvisaApi(queryVariant.slice(0, 4), limit * 2);
        const normalizedQuery = normalizeText(queryVariant);
        const compactQuery = compactSearchText(queryVariant);
        const matchingPrefixResults = prefixResults
          .filter((item) => {
            const normalizedItem = normalizeText(item);
            const compactItem = compactSearchText(item);

            return (
              normalizedItem.includes(normalizedQuery) ||
              compactItem.includes(compactQuery)
            );
          })
          .slice(0, limit);

        if (matchingPrefixResults.length) {
          return jsonResponse({
            ok: true,
            results: matchingPrefixResults,
            source: 'anvisa-api',
          });
        }
      }
    }

    let openDataResults: string[] = [];

    for (const queryVariant of queryVariants) {
      openDataResults = await searchAnvisaOpenData(queryVariant, limit);

      if (openDataResults.length) break;
    }

    if (openDataResults.length) {
      return jsonResponse({ ok: true, results: openDataResults, source: 'anvisa-open-data' });
    }

    const fallbackResults = queryVariants
      .flatMap((queryVariant) => searchFallback(queryVariant, limit))
      .filter((item, index, array) => array.indexOf(item) === index)
      .slice(0, limit);

    return jsonResponse({
      ok: true,
      results: fallbackResults,
      source: 'fallback',
    });
  } catch (error) {
    console.log('Erro na busca de medicamentos:', error);

    return jsonResponse({
      ok: false,
      message: 'Nao foi possivel buscar medicamentos agora.',
      results: [],
    }, 500);
  }
});
