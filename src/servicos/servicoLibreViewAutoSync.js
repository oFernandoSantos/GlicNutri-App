import {
  mapRemoteGlucoseReadingToEntry,
  refreshPatientGlucoseReadings,
  syncCgmGlucoseReadings,
} from './servicoDadosPaciente';
import { garantirSessaoRpcClinicaComPerfil } from './servicoSessaoRpc';
import { invalidatePatientExperienceCache } from './cacheExperienciaPaciente';
import { mesclarLimitesDadosPaciente } from './limitesDadosPaciente';
import {
  getCachedGlucoseReadings,
  replaceCachedGlucoseReadings,
} from './centralGlicose';
import {
  fetchLibreViewReadings,
  loadLibreLinkUpCredentials,
  saveLibreLinkUpCredentials,
  DEFAULT_LIBRE_API_REGION,
  normalizeLibreApiRegion,
} from './servicoLibreView';

export const LIBRE_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const LIBRE_AUTO_SYNC_START_DELAY_MS = 45 * 1000;
export const LIBRE_MIN_MANUAL_SYNC_GAP_MS = 90 * 1000;
export const LIBRE_RATE_LIMIT_BACKOFF_MS = 10 * 60 * 1000;
const LIBRE_RPC_SESSION_TIMEOUT_MS = 12 * 1000;

let activeTimerId = null;
let activeStartTimerId = null;
let activePatientId = null;
let syncInFlight = false;
let activeOptions = null;
const lastLibreApiSyncAtByPatient = new Map();
const libreSyncInFlightByPatient = new Map();

function isRateLimitError(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('429') ||
    message.includes('430') ||
    message.includes('limitou tentativas') ||
    message.includes('bloqueou login')
  );
}

function resolveLibreSyncGapMs({ force = false } = {}) {
  if (force) {
    return LIBRE_MIN_MANUAL_SYNC_GAP_MS;
  }

  return Math.max(LIBRE_MIN_MANUAL_SYNC_GAP_MS, LIBRE_AUTO_SYNC_INTERVAL_MS - 60 * 1000);
}

function shouldSkipLibreApiSync(patientId, { force = false } = {}) {
  const lastAttemptAt = lastLibreApiSyncAtByPatient.get(patientId) || 0;
  return Date.now() - lastAttemptAt < resolveLibreSyncGapMs({ force });
}

function buildReadingFingerprint(reading) {
  if (reading?.readingTimeUtc) {
    return `${reading.readingTimeUtc}|${reading?.value}|${String(reading?.fonte || reading?.source || 'librelinkup').toLowerCase()}`;
  }

  return `${reading?.date}|${String(reading?.time || '').slice(0, 8)}|${reading?.value}|${String(reading?.fonte || reading?.source || 'librelinkup').toLowerCase()}`;
}

function isCgmLikeReading(item) {
  const source = String(item?.source || item?.fonte || '').toLowerCase();
  return source.includes('libre') || source.includes('cgm');
}

function filterNewReadings(readings, existingReadings = []) {
  const known = new Set(
    (existingReadings || []).map((item) => buildReadingFingerprint(item))
  );

  return (readings || []).filter(
    (reading) => !known.has(buildReadingFingerprint({ ...reading, fonte: reading?.fonte || 'librelinkup' }))
  );
}

function filterNewLibreReadings(libreReadings, existingReadings = []) {
  const cgmExisting = (existingReadings || []).filter(isCgmLikeReading);
  return filterNewReadings(libreReadings, cgmExisting);
}

function resolveLibreRpcActor({ actor, patientId, patientEmail } = {}) {
  if (actor && typeof actor === 'object') {
    return actor;
  }

  return {
    id_paciente_uuid: patientId,
    email_pac: patientEmail || '',
    email: patientEmail || '',
  };
}

function mapLibreReadingsToCacheEntries(readings, patientId) {
  return (readings || [])
    .map((reading, index) => mapRemoteGlucoseReadingToEntry(reading, patientId, { index }))
    .filter(Boolean);
}

async function ensureLibreRpcSession(rpcActor) {
  try {
    await Promise.race([
      garantirSessaoRpcClinicaComPerfil(rpcActor),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Sessao RPC expirou ao sincronizar LibreView.')),
          LIBRE_RPC_SESSION_TIMEOUT_MS
        );
      }),
    ]);
    return { ok: true, rpcUnavailable: false };
  } catch (error) {
    console.log('Sessao RPC ausente ao sincronizar LibreView:', error?.message || error);
    return { ok: false, rpcUnavailable: true, error };
  }
}

function applyOptimisticLibreReadings(patientId, normalizedLibreReadings) {
  const optimisticEntries = mapLibreReadingsToCacheEntries(normalizedLibreReadings, patientId);
  replaceCachedGlucoseReadings(patientId, optimisticEntries);
  invalidatePatientExperienceCache(patientId);
  return optimisticEntries;
}

export async function hasLibreLinkUpLinked(patientId) {
  const credentials = await loadLibreLinkUpCredentials(patientId);
  return Boolean(credentials?.email && credentials?.password);
}

export async function syncLinkedLibreViewReadings({
  patientId,
  patientEmail,
  actor,
  credentials = null,
  glucoseLimit = 120,
  silent = true,
  force = false,
} = {}) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para sincronizar o LibreView.');
  }

  if (libreSyncInFlightByPatient.has(patientId)) {
    return libreSyncInFlightByPatient.get(patientId);
  }

  if (shouldSkipLibreApiSync(patientId, { force })) {
    if (silent) {
      return {
        linked: true,
        imported: 0,
        readings: getCachedGlucoseReadings(patientId),
        skipped: true,
        silent,
      };
    }

    throw new Error('Sync recente. Aguarde cerca de 2 minutos antes de tentar de novo.');
  }

  const syncPromise = (async () => {
    try {
      const result = await executeLinkedLibreViewSync({
        patientId,
        patientEmail,
        actor,
        credentials,
        glucoseLimit,
        silent,
        force,
      });
      lastLibreApiSyncAtByPatient.set(patientId, Date.now());
      return result;
    } catch (error) {
      if (isRateLimitError(error)) {
        lastLibreApiSyncAtByPatient.set(
          patientId,
          Date.now() + LIBRE_RATE_LIMIT_BACKOFF_MS - resolveLibreSyncGapMs({ force })
        );
      } else {
        lastLibreApiSyncAtByPatient.delete(patientId);
      }
      throw error;
    } finally {
      libreSyncInFlightByPatient.delete(patientId);
    }
  })();

  libreSyncInFlightByPatient.set(patientId, syncPromise);
  return syncPromise;
}

async function executeLinkedLibreViewSync({
  patientId,
  patientEmail,
  actor,
  credentials = null,
  glucoseLimit = 120,
  silent = true,
  force = false,
} = {}) {
  const rpcActor = resolveLibreRpcActor({ actor, patientId, patientEmail });
  const saved = credentials || (await loadLibreLinkUpCredentials(patientId));
  const libreEmail = String(saved?.email || '').trim();
  const librePassword = String(saved?.password || '');

  if (!libreEmail || !librePassword) {
    const emptyResult = {
      linked: false,
      imported: 0,
      fetched: 0,
      readings: getCachedGlucoseReadings(patientId),
    };

    if (!silent) {
      throw new Error(
        'Credenciais LibreLinkUp ausentes neste aparelho. Informe a senha e toque em Atualizar vinculo.'
      );
    }

    return emptyResult;
  }

  const result = await fetchLibreViewReadings({
    patientId,
    patientEmail,
    libreEmail,
    librePassword,
    libreRegion: saved?.region || DEFAULT_LIBRE_API_REGION,
    connectionPatientId: saved?.connectionPatientId || undefined,
    limit: Math.max(Number(glucoseLimit) || 0, 48),
  });

  const normalizedLibreReadings = (result.readings || []).map((reading) => ({
    value: reading?.value,
    readingTimeUtc: reading?.readingTimeUtc,
    fonte: reading?.fonte || 'librelinkup',
    raw:
      reading?.raw ||
      (reading?.Timestamp || reading?.FactoryTimestamp
        ? {
            value: reading?.value,
            Timestamp: reading?.Timestamp ?? reading?.timestamp ?? null,
            FactoryTimestamp: reading?.FactoryTimestamp ?? reading?.factoryTimestamp ?? null,
          }
        : null),
  }));
  const fetchedCount = normalizedLibreReadings.length;

  if (!fetchedCount) {
    const emptyReadings = getCachedGlucoseReadings(patientId);
    const emptyResult = {
      linked: true,
      imported: 0,
      fetched: 0,
      pending: 0,
      ignored: 0,
      readings: emptyReadings,
      connection: result.connection || null,
      silent,
    };

    if (!silent) {
      throw new Error(
        'LibreLinkUp conectado, mas sem leituras recentes do sensor. Confirme compartilhamento no app Abbott.'
      );
    }

    return emptyResult;
  }

  const rpcSession = await ensureLibreRpcSession(rpcActor);
  if (!rpcSession.ok) {
    const optimisticReadings = applyOptimisticLibreReadings(patientId, normalizedLibreReadings);
    if (!silent) {
      throw rpcSession.error || new Error('Sessao clinica indisponivel para salvar leituras Libre.');
    }
    return {
      linked: true,
      imported: 0,
      fetched: fetchedCount,
      pending: normalizedLibreReadings.length,
      ignored: 0,
      readings: optimisticReadings.length ? optimisticReadings : getCachedGlucoseReadings(patientId),
      connection: result.connection || null,
      rpcUnavailable: true,
      silent,
    };
  }

  let importedCount = 0;
  let ignoredCount = 0;

  const syncResult = await syncCgmGlucoseReadings(patientId, normalizedLibreReadings, {
    fonte: 'librelinkup',
    actor: rpcActor,
  });
  importedCount = Number(syncResult?.inseridos || 0);
  ignoredCount = Number(syncResult?.ignorados || 0);

  if (importedCount === 0 && ignoredCount === 0 && fetchedCount > 0 && !silent) {
    throw new Error(
      `LibreLinkUp trouxe ${fetchedCount} leitura(s), mas nenhuma foi salva. Saia e entre de novo, depois sincronize outra vez.`
    );
  }

  let mergedReadings = [];

  try {
    mergedReadings = await refreshPatientGlucoseReadings(patientId, {
      actor: rpcActor,
      patientContext: rpcActor,
      glucoseLimit: Math.max(Number(glucoseLimit) || 0, 120),
    });
    replaceCachedGlucoseReadings(patientId, mergedReadings);
    invalidatePatientExperienceCache(patientId);
  } catch (error) {
    console.log('Falha ao atualizar cache de glicose apos LibreView:', error?.message || error);
    mergedReadings = applyOptimisticLibreReadings(patientId, normalizedLibreReadings);
  }

  if (result.connection?.patientId) {
    await saveLibreLinkUpCredentials(patientId, {
      email: libreEmail,
      password: librePassword,
      region: normalizeLibreApiRegion(result.connection?.region || saved?.region),
      connectionPatientId: result.connection.patientId,
    });
  }

  return {
    linked: true,
    imported: importedCount,
    fetched: fetchedCount,
    pending: normalizedLibreReadings.length,
    ignored: ignoredCount,
    readings: mergedReadings,
    connection: result.connection || null,
    silent,
  };
}

async function runScheduledSync() {
  if (!activePatientId || !activeOptions || syncInFlight) {
    return;
  }

  syncInFlight = true;

  try {
    const linked = await hasLibreLinkUpLinked(activePatientId);
    if (!linked) {
      return;
    }

    const monitorLimits = mesclarLimitesDadosPaciente('monitoramento');
    const result = await syncLinkedLibreViewReadings({
      patientId: activePatientId,
      patientEmail: activeOptions.patientEmail,
      actor: activeOptions.actor,
      glucoseLimit: monitorLimits.glucoseLimit || 60,
      silent: true,
    });

    activeOptions?.onSync?.(result);
  } catch (error) {
    console.log('Erro na sincronizacao automatica LibreView:', error);
    activeOptions?.onError?.(error);
  } finally {
    syncInFlight = false;
  }
}

export function stopLibreViewAutoSync() {
  if (activeStartTimerId) {
    clearTimeout(activeStartTimerId);
    activeStartTimerId = null;
  }
  if (activeTimerId) {
    clearInterval(activeTimerId);
    activeTimerId = null;
  }
  activePatientId = null;
  activeOptions = null;
}

export function startLibreViewAutoSync({
  patientId,
  patientEmail,
  actor,
  intervalMs = LIBRE_AUTO_SYNC_INTERVAL_MS,
  runImmediately = false,
  startDelayMs = LIBRE_AUTO_SYNC_START_DELAY_MS,
  onSync,
  onError,
} = {}) {
  if (!patientId) {
    stopLibreViewAutoSync();
    return;
  }

  if (activePatientId === patientId && activeTimerId) {
    activeOptions = {
      patientEmail,
      actor,
      onSync,
      onError,
    };
    return;
  }

  stopLibreViewAutoSync();

  activePatientId = patientId;
  activeOptions = {
    patientEmail,
    actor,
    onSync,
    onError,
  };

  if (runImmediately) {
    runScheduledSync();
  } else if (startDelayMs > 0) {
    activeStartTimerId = setTimeout(() => {
      activeStartTimerId = null;
      if (activePatientId === patientId) {
        runScheduledSync();
      }
    }, startDelayMs);
  }

  activeTimerId = setInterval(runScheduledSync, intervalMs);
}

export function buildLibreSyncFeedback(result, { linking = false } = {}) {
  const imported = Number(result?.imported || 0);
  const fetched = Number(result?.fetched || 0);
  const pending = Number(result?.pending || 0);
  const ignored = Number(result?.ignored || 0);

  if (imported > 0) {
    return linking
      ? `Sensor vinculado. ${imported} leitura(s) importada(s) com horario do LibreLinkUp. Sync a cada 5 min.`
      : `LibreLinkUp: ${imported} leitura(s) importada(s) com horario do sensor.`;
  }

  if (fetched > 0 && ignored > 0) {
    return `LibreLinkUp OK. ${fetched} leitura(s) recebida(s), ${ignored} ja estavam no historico.`;
  }

  if (fetched > 0 && pending > 0 && imported === 0) {
    return `LibreLinkUp trouxe ${fetched} leitura(s), mas nenhuma foi salva. Tente sincronizar de novo.`;
  }

  if (fetched > 0 && pending === 0) {
    return `LibreLinkUp conectado. ${fetched} leitura(s) ja estavam sincronizadas.`;
  }

  if (fetched > 0) {
    return `LibreLinkUp conectado (${fetched} leitura(s)), mas nenhuma nova para importar.`;
  }

  if (result?.skipped) {
    return 'Sync recente. Aguarde 1-2 minutos e tente novamente.';
  }

  return linking
    ? 'Sensor vinculado. Sync automatico a cada 5 min.'
    : 'LibreLinkUp conectado, mas nenhuma leitura retornada pelo sensor.';
}

export async function triggerLibreViewAutoSyncNow(options = {}) {
  return syncLinkedLibreViewReadings(options);
}

export async function bootstrapLibreSyncOnLogin({
  patientId,
  patientEmail,
  actor,
  glucoseLimit = 120,
} = {}) {
  if (!patientId) {
    return null;
  }

  const linked = await hasLibreLinkUpLinked(patientId);
  if (!linked) {
    return null;
  }

  try {
    const result = await syncLinkedLibreViewReadings({
      patientId,
      patientEmail,
      actor,
      glucoseLimit,
      silent: true,
    });

    invalidatePatientExperienceCache(patientId);
    return result;
  } catch (error) {
    console.log('Libre sync no login:', error?.message || error);
    return null;
  }
}
