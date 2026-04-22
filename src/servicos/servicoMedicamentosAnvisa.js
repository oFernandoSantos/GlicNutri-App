import { supabase, supabaseAnonKey, supabaseUrl } from './configSupabase';

const ANVISA_MEDICINES_CSV_URL =
  'https://dados.anvisa.gov.br/dados/CONSULTAS/PRODUTOS/TA_CONSULTA_MEDICAMENTOS.CSV';
const ANVISA_MEDICINES_API_URL =
  'https://consultas.anvisa.gov.br/api/consulta/medicamento/produtos/';
const BULARIO_ANVISA_SEARCH_URL = 'https://bula.vercel.app/pesquisar';
const CUSTOM_MEDICINES_API_URL = process.env.EXPO_PUBLIC_MEDICAMENTOS_API_URL;

const FALLBACK_MEDICINES = [
  'Metformina',
  'Dipirona',
  'Dipirona monoidratada',
  'Paracetamol',
  'Ibuprofeno',
  'Amoxicilina',
  'Losartana',
  'Sinvastatina',
  'AAS',
  'Glibenclamida',
  'Gliclazida',
  'Empagliflozina',
  'Dapagliflozina',
  'Sitagliptina',
  'Liraglutida',
  'Semaglutida',
  'Omeprazol',
  'Atenolol',
  'Enalapril',
  'Hidroclorotiazida',
  'Rivotril',
  'Clonazepam',
  'Glifage',
  'Ozempic',
  'Xarelto',
  'Jardiance',
  'Forxiga',
  'Novorapid',
  'Lantus',
];

let cachedMedicines = null;
let loadingPromise = null;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function compactSearchText(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function buildQueryVariants(query) {
  const trimmedQuery = String(query || '').trim();
  const compactQuery = compactSearchText(trimmedQuery);
  const variants = [trimmedQuery];

  if (compactQuery && compactQuery !== normalizeText(trimmedQuery)) {
    variants.push(compactQuery);
  }

  return Array.from(new Set(variants.filter((item) => item.length >= 2)));
}

function splitCsvLine(line, separator) {
  const values = [];
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

function pickMedicineNameColumn(headers) {
  const normalizedHeaders = headers.map(normalizeText);
  const preferredNames = [
    'nome produto',
    'nome_produto',
    'produto',
    'medicamento',
    'nome comercial',
    'nome_comercial',
  ];

  const foundIndex = normalizedHeaders.findIndex((header) =>
    preferredNames.some((name) => header === normalizeText(name))
  );

  if (foundIndex >= 0) return foundIndex;

  return Math.max(
    normalizedHeaders.findIndex((header) => header.includes('produto')),
    0
  );
}

function pickMedicineNameColumns(headers) {
  const normalizedHeaders = headers.map(normalizeText);
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
  const indexes = normalizedHeaders
    .map((header, index) =>
      preferredFragments.some((fragment) => header.includes(normalizeText(fragment)))
        ? index
        : -1
    )
    .filter((index) => index >= 0);

  if (indexes.length) return indexes;

  return [pickMedicineNameColumn(headers)];
}

function parseMedicineNamesFromCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) return [];

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0], separator);
  const nameColumnIndexes = pickMedicineNameColumns(headers);
  const names = new Set();

  lines.slice(1).forEach((line) => {
    const columns = splitCsvLine(line, separator);

    nameColumnIndexes.forEach((nameColumnIndex) => {
      const rawName = String(columns[nameColumnIndex] || '')
        .replace(/^"|"$/g, '')
        .trim();

      rawName
        .split(/\s*[+;/]\s*/)
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => names.add(name));
    });
  });

  return Array.from(names).sort((left, right) =>
    left.localeCompare(right, 'pt-BR')
  );
}

function extractNamesFromApiPayload(payload) {
  const names = new Set();

  function visit(value) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== 'object') return;

    [
      value.nomeProduto,
      value.nomeComercial,
      value.produto,
      value.medicamento,
      value.principioAtivo,
      value.principio_ativo,
      value.substancia,
      value.nome,
      value.nomeMedicamento,
      value.nome_medicamento,
      value.nomeBula,
      value.nome_bula,
      value.razaoSocial,
      value.razao_social,
    ]
      .filter(Boolean)
      .forEach((name) => {
        String(name)
          .split(/\s*[+;/]\s*/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => names.add(item));
      });

    Object.values(value).forEach(visit);
  }

  visit(payload);
  return Array.from(names).sort((left, right) =>
    left.localeCompare(right, 'pt-BR')
  );
}

async function fetchAnvisaApiByFilter(query, limit, filterName) {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) return [];

  const params = new URLSearchParams({
    count: String(limit),
    page: '1',
  });
  params.append(`filter[${filterName}]`, normalizedQuery);

  const response = await fetch(`${ANVISA_MEDICINES_API_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: 'Guest',
      Referer: 'https://consultas.anvisa.gov.br/',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar medicamentos na API da Anvisa: ${response.status}`);
  }

  const payload = await response.json();
  return extractNamesFromApiPayload(payload).slice(0, limit);
}

async function searchAnvisaApi(query, limit) {
  const searches = await Promise.allSettled([
    fetchAnvisaApiByFilter(query, limit, 'nomeProduto'),
    fetchAnvisaApiByFilter(query, limit, 'principioAtivo'),
  ]);
  const names = new Set();

  searches.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((name) => names.add(name));
  });

  return Array.from(names)
    .sort((left, right) => left.localeCompare(right, 'pt-BR'))
    .slice(0, limit);
}

async function searchBularioAnvisaApi(query, limit) {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) return [];

  const params = new URLSearchParams({
    nome: normalizedQuery,
    pagina: '1',
  });

  const response = await fetch(`${BULARIO_ANVISA_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar medicamentos no Bulário da Anvisa: ${response.status}`);
  }

  const payload = await response.json();
  return extractNamesFromApiPayload(payload).slice(0, limit);
}

async function searchCustomMedicinesApi(query, limit) {
  if (!CUSTOM_MEDICINES_API_URL) return [];

  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) return [];

  const params = new URLSearchParams({
    q: normalizedQuery,
    nome: normalizedQuery,
    limit: String(limit),
  });
  const separator = CUSTOM_MEDICINES_API_URL.includes('?') ? '&' : '?';
  const response = await fetch(`${CUSTOM_MEDICINES_API_URL}${separator}${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar medicamentos na API configurada: ${response.status}`);
  }

  const payload = await response.json();

  if (Array.isArray(payload)) {
    return payload
      .map((item) => (typeof item === 'string' ? item : extractNamesFromApiPayload(item)[0]))
      .filter(Boolean)
      .slice(0, limit);
  }

  return extractNamesFromApiPayload(payload).slice(0, limit);
}

async function searchSupabaseMedicinesFunction(query, limit) {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) return [];

  const { data, error } = await supabase.functions.invoke('medicines-search', {
    body: {
      query: normalizedQuery,
      limit,
    },
  });

  if (error || data?.ok === false) {
    const response = await fetch(`${supabaseUrl}/functions/v1/medicines-search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        limit,
      }),
    });

    if (!response.ok) {
      throw new Error(data?.message || error?.message || `Falha ao buscar medicamentos no Supabase: ${response.status}`);
    }

    const fallbackData = await response.json();

    if (fallbackData?.ok === false) {
      throw new Error(fallbackData?.message || 'Falha ao buscar medicamentos no Supabase.');
    }

    return Array.isArray(fallbackData?.results)
      ? fallbackData.results.filter(Boolean).slice(0, limit)
      : [];
  }

  return Array.isArray(data?.results) ? data.results.filter(Boolean).slice(0, limit) : [];
}

async function loadAnvisaMedicines() {
  if (cachedMedicines) return cachedMedicines;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch(ANVISA_MEDICINES_CSV_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Falha ao buscar medicamentos da Anvisa: ${response.status}`);
      }

      return response.text();
    })
    .then((csvText) => {
      const parsedNames = parseMedicineNamesFromCsv(csvText);
      cachedMedicines = parsedNames.length ? parsedNames : FALLBACK_MEDICINES;
      return cachedMedicines;
    })
    .catch((error) => {
      console.log('Erro ao carregar medicamentos da Anvisa:', error);
      cachedMedicines = FALLBACK_MEDICINES;
      return cachedMedicines;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

export async function buscarMedicamentosAnvisa(query, limit = 30) {
  const normalizedQuery = normalizeText(query);
  const queryVariants = buildQueryVariants(query);

  if (normalizedQuery) {
    for (const queryVariant of queryVariants) {
      try {
        const supabaseResults = await searchSupabaseMedicinesFunction(queryVariant, limit);

        if (supabaseResults.length) {
          return supabaseResults;
        }
      } catch (error) {
        console.log('Erro ao buscar medicamentos na Edge Function:', error);
      }
    }

    for (const queryVariant of queryVariants) {
      try {
        const customResults = await searchCustomMedicinesApi(queryVariant, limit);

        if (customResults.length) {
          return customResults;
        }
      } catch (error) {
        console.log('Erro ao buscar medicamentos na API configurada:', error);
      }
    }

    for (const queryVariant of queryVariants) {
      try {
        const apiResults = await searchAnvisaApi(queryVariant, limit);

        if (apiResults.length) {
          return apiResults;
        }
      } catch (error) {
        console.log('Erro ao buscar medicamentos na API da Anvisa:', error);
      }
    }

    for (const queryVariant of queryVariants) {
      try {
        const bularioResults = await searchBularioAnvisaApi(queryVariant, limit);

        if (bularioResults.length) {
          return bularioResults;
        }
      } catch (error) {
        console.log('Erro ao buscar medicamentos no Bulário da Anvisa:', error);
      }
    }
  }

  const medicines = await loadAnvisaMedicines();

  if (!normalizedQuery) {
    return medicines.slice(0, limit);
  }

  return medicines
    .filter((medicine) =>
      queryVariants.some(
        (queryVariant) =>
          normalizeText(medicine).includes(normalizeText(queryVariant)) ||
          compactSearchText(medicine).includes(compactSearchText(queryVariant))
      )
    )
    .slice(0, limit);
}
