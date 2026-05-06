import { Platform } from 'react-native';

function getDefaultHost() {
  // Android emulator uses 10.0.2.2 to reach host machine (localhost).
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  // iOS simulator / web / desktop environments
  return '127.0.0.1';
}

export function getMlApiBaseUrl({ host, port } = {}) {
  const safeHost = host || getDefaultHost();
  const safePort = port || 8001;
  return `http://${safeHost}:${safePort}`;
}

function withTimeout(promise, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo esgotado ao conectar na API de ML.')), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function mlHealthcheck(options = {}) {
  const baseUrl = getMlApiBaseUrl(options);
  const response = await withTimeout(fetch(`${baseUrl}/health`), 8000);
  if (!response.ok) {
    throw new Error(`Healthcheck falhou: HTTP ${response.status}`);
  }
  return await response.json();
}

export async function mlPredict(payload, options = {}) {
  const baseUrl = getMlApiBaseUrl(options);
  const response = await withTimeout(
    fetch(`${baseUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    }),
    12000
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Erro na previsão (HTTP ${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error(`Resposta inválida da API de ML: ${text}`);
  }
}

