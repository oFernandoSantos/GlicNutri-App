import {
  fetchGlucoseReadings,
  syncCgmGlucoseReadings,
} from './servicoDadosPaciente';
import { executarEmLotes } from '../utilitarios/carregamentoTela';
import { mesclarLimitesDadosPaciente } from './limitesDadosPaciente';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  replaceCachedGlucoseReadings,
} from './centralGlicose';
import {
  fetchLibreViewReadings,
  loadLibreLinkUpCredentials,
  saveLibreLinkUpCredentials,
} from './servicoLibreView';

export const LIBRE_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

let activeTimerId = null;
let activePatientId = null;
let syncInFlight = false;
let activeOptions = null;

function buildReadingFingerprint(reading) {
  return `${reading?.date}|${String(reading?.time || '').slice(0, 5)}|${reading?.value}`;
}

function filterNewReadings(readings, existingReadings = []) {
  const known = new Set(
    (existingReadings || []).map((item) =>
      buildReadingFingerprint({
        date: item?.date,
        time: item?.time,
        value: item?.value,
      })
    )
  );

  return (readings || []).filter((reading) => !known.has(buildReadingFingerprint(reading)));
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
} = {}) {
  if (!patientId) {
    throw new Error('Paciente sem identificador para sincronizar o LibreView.');
  }

  const saved = credentials || (await loadLibreLinkUpCredentials(patientId));
  const libreEmail = String(saved?.email || '').trim();
  const librePassword = String(saved?.password || '');

  if (!libreEmail || !librePassword) {
    return {
      linked: false,
      imported: 0,
      readings: [],
    };
  }

  const result = await fetchLibreViewReadings({
    patientId,
    patientEmail,
    libreEmail,
    librePassword,
    libreRegion: saved?.region || 'la',
    connectionPatientId: saved?.connectionPatientId || undefined,
    limit: 48,
  });

  const cachedReadings = getCachedGlucoseReadings(patientId);
  const fetchedReadings = await fetchGlucoseReadings(patientId, glucoseLimit).catch(() => []);
  const mergedExisting = mergeCachedGlucoseReadings(fetchedReadings, cachedReadings);
  const newReadings = filterNewReadings(result.readings, mergedExisting);

  if (newReadings.length) {
    await syncCgmGlucoseReadings(patientId, newReadings, {
      fonte: 'librelinkup',
      actor,
    });
  }

  const refreshedReadings = await fetchGlucoseReadings(patientId, glucoseLimit);
  const mergedReadings = mergeCachedGlucoseReadings(refreshedReadings, cachedReadings);
  replaceCachedGlucoseReadings(patientId, mergedReadings);

  if (result.connection?.patientId) {
    await saveLibreLinkUpCredentials(patientId, {
      email: libreEmail,
      password: librePassword,
      region: result.connection?.region || saved?.region || 'la',
      connectionPatientId: result.connection.patientId,
    });
  }

  return {
    linked: true,
    imported: newReadings.length,
    readings: mergedReadings,
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
      glucoseLimit: monitorLimits.glucoseLimit || 120,
      silent: true,
    });

    activeOptions.onSync?.(result);
  } catch (error) {
    console.log('Erro na sincronizacao automatica LibreView:', error);
    activeOptions.onError?.(error);
  } finally {
    syncInFlight = false;
  }
}

export function stopLibreViewAutoSync() {
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
  runImmediately = true,
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
  }

  activeTimerId = setInterval(runScheduledSync, intervalMs);
}

export async function triggerLibreViewAutoSyncNow(options = {}) {
  return syncLinkedLibreViewReadings(options);
}
