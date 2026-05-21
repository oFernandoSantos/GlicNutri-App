const DEFAULT_TTL_MS = 45 * 1000;

const experienceCache = new Map();
const experienceInFlight = new Map();

const profileCache = new Map();
const profileInFlight = new Map();

function buildExperienceCacheKey(patientId, options = {}) {
  return `${patientId}:${options.includeHidden ? 'all' : 'visible'}`;
}

function getFreshEntry(cache, key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlMs) return null;
  return entry.data;
}

export function isPatientExperienceCacheFresh(patientId, options = {}, ttlMs = DEFAULT_TTL_MS) {
  if (!patientId) return false;
  return Boolean(getFreshEntry(experienceCache, buildExperienceCacheKey(patientId, options), ttlMs));
}

export function getCachedPatientExperience(patientId, options = {}, ttlMs = DEFAULT_TTL_MS) {
  if (!patientId) return null;
  return getFreshEntry(experienceCache, buildExperienceCacheKey(patientId, options), ttlMs);
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
}

export function isPatientProfileCacheFresh(patientId, ttlMs = DEFAULT_TTL_MS) {
  if (!patientId) return false;
  return Boolean(getFreshEntry(profileCache, patientId, ttlMs));
}

export function getCachedPatientProfile(patientId, ttlMs = DEFAULT_TTL_MS) {
  if (!patientId) return null;
  return getFreshEntry(profileCache, patientId, ttlMs);
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
  const ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
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

export async function fetchCachedPatientProfile(patientId, options, loader) {
  if (!patientId) {
    return loader();
  }

  const ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
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
