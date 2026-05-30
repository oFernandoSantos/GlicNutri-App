import { hashIdsForCache, trimCacheMap } from '../utilitarios/chaveCache';

const DEFAULT_TTL_MS = 90 * 1000;
const MAX_EXPERIENCE_CACHE_ENTRIES = 100;
const MAX_NUTRI_INBOX_CACHE_ENTRIES = 40;
const HOME_EXPERIENCE_TTL_MS = 3 * 60 * 1000;
const CHAT_CACHE_TTL_MS = 20 * 1000;
export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORICO_EXPERIENCE_TTL_MS = 3 * 60 * 1000;

const experienceCache = new Map();
const experienceInFlight = new Map();

const profileCache = new Map();
const profileInFlight = new Map();

const chatCache = new Map();
const chatInFlight = new Map();

const nutriInboxCache = new Map();
const nutriInboxInFlight = new Map();
const NUTRI_INBOX_TTL_MS = 20 * 1000;

function buildLimitsFingerprint(options = {}) {
  return [
    options.homeOnly ? 'h1' : '',
    options.homeCritical ? 'hc' : '',
    options.planOnly ? 'p1' : '',
    options.chatOnly ? 'c1' : '',
    options.skipChat ? 'sc' : '',
    options.includeMealPlan ? 'plan' : '',
    options.minimalProfile ? 'mp' : '',
    `g${options.glucoseLimit ?? '*'}`,
    `m${options.medicationLimit ?? '*'}`,
    `e${options.mealLimit ?? '*'}`,
  ]
    .filter(Boolean)
    .join('-');
}

function buildExperienceCacheKey(patientId, options = {}) {
  const scope = options.planOnly
    ? 'plan'
    : options.homeOnly
      ? 'home'
      : options.chatOnly
        ? 'chat'
        : 'full';
  const limitsKey = buildLimitsFingerprint(options);
  return `${patientId}:${scope}:${limitsKey}:${options.includeHidden ? 'all' : 'visible'}`;
}

function resolveExperienceTtlMs(options = {}) {
  if (options.homeOnly) return options.cacheTtlMs ?? HOME_EXPERIENCE_TTL_MS;
  if (options.historicoPreset) return options.cacheTtlMs ?? HISTORICO_EXPERIENCE_TTL_MS;
  return options.cacheTtlMs ?? DEFAULT_TTL_MS;
}

function getFreshEntry(cache, key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlMs) return null;
  return entry.data;
}

export function isPatientExperienceCacheFresh(patientId, options = {}, ttlMs) {
  if (!patientId) return false;
  const effectiveTtl = ttlMs ?? resolveExperienceTtlMs(options);
  return Boolean(
    getFreshEntry(experienceCache, buildExperienceCacheKey(patientId, options), effectiveTtl)
  );
}

export function getCachedPatientExperience(patientId, options = {}, ttlMs) {
  if (!patientId) return null;
  const effectiveTtl = ttlMs ?? resolveExperienceTtlMs(options);
  return getFreshEntry(experienceCache, buildExperienceCacheKey(patientId, options), effectiveTtl);
}

export function invalidatePatientExperienceCache(patientId) {
  if (!patientId) {
    experienceCache.clear();
    experienceInFlight.clear();
    profileCache.clear();
    profileInFlight.clear();
    return;
  }

  [...experienceCache.keys()].forEach((key) => {
    if (key.startsWith(`${patientId}:`)) {
      experienceCache.delete(key);
    }
  });

  [...experienceInFlight.keys()].forEach((key) => {
    if (key.startsWith(`${patientId}:`)) {
      experienceInFlight.delete(key);
    }
  });

  profileCache.delete(patientId);
  profileInFlight.delete(patientId);

  chatCache.delete(`${patientId}:chat`);
  chatInFlight.delete(`${patientId}:chat`);
}

export function getCachedPatientChat(patientId, ttlMs = CHAT_CACHE_TTL_MS) {
  if (!patientId) return null;
  return getFreshEntry(chatCache, `${patientId}:chat`, ttlMs);
}

export async function fetchCachedPatientChat(patientId, options, loader) {
  if (!patientId) {
    return loader();
  }

  const cacheKey = `${patientId}:chat`;
  const ttlMs = options.cacheTtlMs ?? CHAT_CACHE_TTL_MS;
  const forceRefresh = options.forceRefresh === true;

  return readThroughPatientCache({
    cache: chatCache,
    inFlight: chatInFlight,
    cacheKey,
    forceRefresh,
    ttlMs,
    loader,
  });
}

export function getCachedPatientProfile(patientId, ttlMs = PROFILE_CACHE_TTL_MS) {
  if (!patientId) return null;
  return getFreshEntry(profileCache, patientId, ttlMs);
}

export function isPatientProfileCacheFresh(patientId, ttlMs = PROFILE_CACHE_TTL_MS) {
  if (!patientId) return false;
  return Boolean(getFreshEntry(profileCache, patientId, ttlMs));
}

export async function readThroughPatientCache({
  cache,
  inFlight,
  cacheKey,
  forceRefresh,
  ttlMs,
  loader,
}) {
  if (!forceRefresh) {
    const cached = getFreshEntry(cache, cacheKey, ttlMs);
    if (cached) {
      return cached;
    }

    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }
  } else {
    cache.delete(cacheKey);
    inFlight.delete(cacheKey);
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((data) => {
      cache.set(cacheKey, {
        data,
        fetchedAt: Date.now(),
      });
      if (cache === experienceCache) {
        trimCacheMap(experienceCache, MAX_EXPERIENCE_CACHE_ENTRIES);
      }
      if (cache === nutriInboxCache) {
        trimCacheMap(nutriInboxCache, MAX_NUTRI_INBOX_CACHE_ENTRIES);
      }
      inFlight.delete(cacheKey);
      return data;
    })
    .catch((error) => {
      inFlight.delete(cacheKey);
      throw error;
    });

  inFlight.set(cacheKey, promise);
  return promise;
}

export async function fetchCachedPatientExperience(patientId, options, loader) {
  if (!patientId) {
    return loader();
  }

  const cacheKey = buildExperienceCacheKey(patientId, options);
  const ttlMs = resolveExperienceTtlMs(options);
  const forceRefresh = options.forceRefresh === true;

  return readThroughPatientCache({
    cache: experienceCache,
    inFlight: experienceInFlight,
    cacheKey,
    forceRefresh,
    ttlMs,
    loader,
  });
}

export async function fetchCachedNutriChatInbox(nutricionistaId, patientIds, loader) {
  if (!nutricionistaId) {
    return loader();
  }

  const cacheKey = `${nutricionistaId}:inbox:${hashIdsForCache(patientIds)}`;
  const forceRefresh = false;

  return readThroughPatientCache({
    cache: nutriInboxCache,
    inFlight: nutriInboxInFlight,
    cacheKey,
    forceRefresh,
    ttlMs: NUTRI_INBOX_TTL_MS,
    loader,
  });
}

export function invalidateNutriChatInboxCache(nutricionistaId) {
  if (!nutricionistaId) {
    nutriInboxCache.clear();
    nutriInboxInFlight.clear();
    return;
  }

  [...nutriInboxCache.keys()].forEach((key) => {
    if (key.startsWith(`${nutricionistaId}:`)) {
      nutriInboxCache.delete(key);
    }
  });
  [...nutriInboxInFlight.keys()].forEach((key) => {
    if (key.startsWith(`${nutricionistaId}:`)) {
      nutriInboxInFlight.delete(key);
    }
  });
}

export async function fetchCachedPatientProfile(patientId, options, loader) {
  if (!patientId) {
    return loader();
  }

  const ttlMs = options.cacheTtlMs ?? PROFILE_CACHE_TTL_MS;
  const forceRefresh = options.forceRefresh === true;

  return readThroughPatientCache({
    cache: profileCache,
    inFlight: profileInFlight,
    cacheKey: patientId,
    forceRefresh,
    ttlMs,
    loader,
  });
}
