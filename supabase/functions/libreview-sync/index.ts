import { corsHeaders } from '../_shared/cors.ts';

type SyncPayload = {
  patientId?: string;
  patientEmail?: string;
  limit?: number;
};

type NormalizedReading = {
  value: number;
  date: string;
  time: string;
};

const providerUrl = Deno.env.get('LIBREVIEW_PROVIDER_URL') || '';
const providerToken = Deno.env.get('LIBREVIEW_PROVIDER_TOKEN') || '';
const providerAuthHeader = Deno.env.get('LIBREVIEW_PROVIDER_AUTH_HEADER') || 'Authorization';
const providerStaticHeaders = Deno.env.get('LIBREVIEW_PROVIDER_EXTRA_HEADERS') || '';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeDate(value: unknown) {
  if (!value) return new Date().toISOString().slice(0, 10);

  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return text.slice(0, 10);
}

function normalizeTime(value: unknown) {
  if (!value) return new Date().toTimeString().slice(0, 8);

  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toTimeString().slice(0, 8);
  }

  const text = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(text)) {
    return `${text}:00`;
  }

  return text.slice(0, 8);
}

function parseStaticHeaders(raw: string) {
  const headers: Record<string, string> = {};

  String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex <= 0) return;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key && value) {
        headers[key] = value;
      }
    });

  return headers;
}

function normalizeReading(item: Record<string, unknown>): NormalizedReading | null {
  const timestamp =
    item.timestamp ||
    item.dateTime ||
    item.date_time ||
    item.datetime ||
    item.createdAt ||
    item.time ||
    null;

  const value = Number(
    item.valueMgDl ||
      item.value_mg_dl ||
      item.value_in_mg_per_dl ||
      item.glucose ||
      item.glucoseMgDl ||
      item.value
  );

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return {
    value,
    date: normalizeDate(item.date || timestamp),
    time: normalizeTime(item.hour || item.hora || item.time || timestamp),
  };
}

function normalizeProviderPayload(payload: unknown) {
  const rawReadings = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>)?.readings)
      ? ((payload as Record<string, unknown>).readings as Array<Record<string, unknown>>)
      : [];

  return rawReadings
    .map((item) => normalizeReading((item || {}) as Record<string, unknown>))
    .filter((item): item is NormalizedReading => Boolean(item));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao suportado.' }, 405);
  }

  if (!providerUrl) {
    return jsonResponse(
      {
        error: 'Integração LibreView nao configurada.',
        details:
          'Defina LIBREVIEW_PROVIDER_URL e, se necessario, LIBREVIEW_PROVIDER_TOKEN nas secrets da function.',
      },
      501
    );
  }

  try {
    const body = (await request.json()) as SyncPayload;
    const patientId = String(body?.patientId || '').trim();
    const patientEmail = String(body?.patientEmail || '').trim();
    const limit = Number(body?.limit) || 24;

    if (!patientId && !patientEmail) {
      return jsonResponse(
        { error: 'Informe patientId ou patientEmail para sincronizar o LibreView.' },
        400
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...parseStaticHeaders(providerStaticHeaders),
    };

    if (providerToken) {
      headers[providerAuthHeader] = providerToken;
    }

    const response = await fetch(providerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        patientId,
        patientEmail,
        limit,
      }),
    });

    const responseText = await response.text();
    let payload: unknown = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      payload = responseText;
    }

    if (!response.ok) {
      return jsonResponse(
        {
          error: 'Falha ao buscar leituras do provedor LibreView.',
          status: response.status,
          providerResponse: payload,
        },
        502
      );
    }

    const readings = normalizeProviderPayload(payload);

    return jsonResponse({
      readings,
      count: readings.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('libreview-sync error', error);
    return jsonResponse(
      {
        error: 'Erro interno ao sincronizar LibreView.',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
