/** Gera chave estavel para cache baseada em lista de UUIDs (ordem independente). */
export function hashIdsForCache(ids = []) {
  const sorted = [...new Set((ids || []).filter(Boolean))].sort();
  if (!sorted.length) return 'empty';
  if (sorted.length <= 4) return sorted.join(',');
  const head = sorted.slice(0, 2).join(',');
  const tail = sorted.slice(-2).join(',');
  return `${sorted.length}:${head}:${tail}`;
}

/** Limita tamanho de Map de cache (LRU simples por ordem de insercao). */
export function trimCacheMap(cache, maxEntries = 80) {
  if (!cache || cache.size <= maxEntries) return;
  const keys = [...cache.keys()];
  const removeCount = cache.size - maxEntries;
  for (let index = 0; index < removeCount; index += 1) {
    cache.delete(keys[index]);
  }
}
