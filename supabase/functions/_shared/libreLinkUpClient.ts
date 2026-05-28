export type LibreLinkUpReading = {
  value: number;
  date: string;
  time: string;
};

type LibreSession = {
  token: string;
  accountIdHash: string;
  baseUrl: string;
  region: string;
};

const CLIENT_VERSION = '4.16.0';
const DEFAULT_REGIONS = ['la', 'br', 'eu', 'us'];

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildBaseUrl(region: string) {
  if (!region || region === 'global') {
    return 'https://api.libreview.io';
  }
  return `https://api-${region}.libreview.io`;
}

function commonHeaders() {
  return {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'cache-control': 'no-cache',
    connection: 'Keep-Alive',
    'content-type': 'application/json',
    product: 'llu.android',
    version: CLIENT_VERSION,
  };
}

function authedHeaders(session: LibreSession) {
  return {
    ...commonHeaders(),
    Authorization: `Bearer ${session.token}`,
    'Account-Id': session.accountIdHash,
  };
}

function parseTimestamp(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const now = new Date();
    return {
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
    };
  }

  const date = new Date(numeric > 1e12 ? numeric : numeric * 1000);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return {
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
    };
  }

  return {
    date: date.toISOString().slice(0, 10),
    time: date.toTimeString().slice(0, 8),
  };
}

function normalizeMeasurement(item: Record<string, unknown> | null | undefined) {
  const value = Number(item?.ValueInMgPerDl ?? item?.Value ?? item?.value);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const timestamp = parseTimestamp(
    item?.FactoryTimestamp ?? item?.Timestamp ?? item?.timestamp ?? item?.created_at
  );

  return {
    value,
    date: timestamp.date,
    time: timestamp.time,
  } satisfies LibreLinkUpReading;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

async function continueAuthStep(
  session: Pick<LibreSession, 'baseUrl' | 'token' | 'accountIdHash'>,
  stepType: string
) {
  const response = await fetch(`${session.baseUrl}/llu/auth/continue/${stepType}`, {
    method: 'POST',
    headers: authedHeaders(session as LibreSession),
    body: JSON.stringify({}),
  });

  return parseJson(response);
}

async function loginOnce(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/llu/auth/login`, {
    method: 'POST',
    headers: commonHeaders(),
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `Falha ao autenticar no LibreLinkUp (${response.status}).`
    );
  }

  return payload;
}

async function resolveLoginPayload(email: string, password: string, preferredRegion?: string) {
  const regions = preferredRegion
    ? [preferredRegion, ...DEFAULT_REGIONS.filter((region) => region !== preferredRegion)]
    : DEFAULT_REGIONS;

  let lastError = 'Nao foi possivel autenticar no LibreLinkUp.';

  for (const region of regions) {
    let baseUrl = buildBaseUrl(region);
    let payload = await loginOnce(baseUrl, email, password);

    if (payload?.data?.redirect && payload?.data?.region) {
      const resolvedRegion = String(payload.data.region).trim();
      baseUrl = buildBaseUrl(resolvedRegion);
      payload = await loginOnce(baseUrl, email, password);
    }

    let guard = 0;
    while (payload?.status === 4 && payload?.data?.step?.type && guard < 4) {
      const stepType = String(payload.data.step.type);
      const token = payload?.data?.authTicket?.token;
      const userId = payload?.data?.user?.id;

      if (!token || !userId) {
        throw new Error(
          'Aceite os termos de uso no app LibreLinkUp e tente novamente.'
        );
      }

      payload = await continueAuthStep(
        {
          baseUrl,
          token,
          accountIdHash: await sha256Hex(String(userId)),
        },
        stepType
      );
      guard += 1;
    }

    const token = payload?.data?.authTicket?.token;
    const userId = payload?.data?.user?.id;

    if (payload?.status === 0 && token && userId) {
      return {
        token,
        accountIdHash: await sha256Hex(String(userId)),
        baseUrl,
        region: payload?.data?.region || region,
      } satisfies LibreSession;
    }

    lastError =
      payload?.error?.message ||
      payload?.message ||
      'Credenciais invalidas ou conta sem permissao para compartilhar dados.';
  }

  throw new Error(lastError);
}

async function fetchGraph(session: LibreSession, patientId: string) {
  const response = await fetch(`${session.baseUrl}/llu/connections/${patientId}/graph`, {
    method: 'GET',
    headers: authedHeaders(session),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `Nao foi possivel buscar leituras do sensor (${response.status}).`
    );
  }

  return payload;
}

async function fetchConnections(session: LibreSession) {
  const response = await fetch(`${session.baseUrl}/llu/connections`, {
    method: 'GET',
    headers: authedHeaders(session),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `Nao foi possivel listar conexoes do LibreLinkUp (${response.status}).`
    );
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

function extractReadingsFromGraph(payload: Record<string, unknown>, limit: number) {
  const connection = (payload?.data as Record<string, unknown>)?.connection as
    | Record<string, unknown>
    | undefined;

  const graphData = Array.isArray(connection?.graphData) ? connection.graphData : [];
  const current = connection?.glucoseMeasurement;

  const readings = [...graphData, current]
    .map((item) => normalizeMeasurement((item || {}) as Record<string, unknown>))
    .filter((item): item is LibreLinkUpReading => Boolean(item));

  const deduped = new Map<string, LibreLinkUpReading>();

  readings.forEach((reading) => {
    const key = `${reading.date}|${reading.time}|${reading.value}`;
    deduped.set(key, reading);
  });

  return Array.from(deduped.values())
    .sort((left, right) => `${right.date}T${right.time}`.localeCompare(`${left.date}T${left.time}`))
    .slice(0, Math.max(1, limit));
}

export async function fetchLibreLinkUpReadings({
  email,
  password,
  region,
  limit = 48,
  connectionPatientId,
}: {
  email: string;
  password: string;
  region?: string;
  limit?: number;
  connectionPatientId?: string;
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error('Informe e-mail e senha do LibreLinkUp.');
  }

  const session = await resolveLoginPayload(normalizedEmail, normalizedPassword, region);
  const connections = await fetchConnections(session);

  if (!connections.length) {
    throw new Error(
      'Nenhuma conexao encontrada. Compartilhe os dados no LibreLink/LibreLinkUp ou use a conta correta.'
    );
  }

  const selectedConnection =
    connections.find((item) => item?.patientId === connectionPatientId) || connections[0];
  const patientId = String(selectedConnection?.patientId || '').trim();

  if (!patientId) {
    throw new Error('Conexao LibreLinkUp invalida: patientId ausente.');
  }

  const graphPayload = await fetchGraph(session, patientId);
  const readings = extractReadingsFromGraph(
    (graphPayload || {}) as Record<string, unknown>,
    limit
  );

  if (!readings.length) {
    throw new Error('Conexao encontrada, mas sem leituras recentes do sensor.');
  }

  return {
    readings,
    connection: {
      patientId,
      firstName: selectedConnection?.firstName || '',
      lastName: selectedConnection?.lastName || '',
      region: session.region,
    },
  };
}
