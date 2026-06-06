export function executarComTimeout(promise, timeoutMs, label = 'operacao') {
  const safeMs = Math.max(Number(timeoutMs) || 0, 1);

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} excedeu ${safeMs}ms`));
      }, safeMs);
    }),
  ]);
}
