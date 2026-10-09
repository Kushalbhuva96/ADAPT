const values = new Map();
const pending = new Map();
let globalGeneration = 0;
const scopedGenerations = new Map();

function scopeOf(key) {
  const separator = key.indexOf(":", key.indexOf(":") + 1);
  return separator < 0 ? key : key.slice(0, separator);
}

export function cachedRequest(key, load, ttlMs) {
  const cached = values.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (pending.has(key)) return pending.get(key);

  const requestGeneration = globalGeneration;
  const scope = scopeOf(key);
  const scopeGeneration = scopedGenerations.get(scope) || 0;
  const request = Promise.resolve().then(load).then((value) => {
    if (requestGeneration === globalGeneration && scopeGeneration === (scopedGenerations.get(scope) || 0)) {
      values.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function readRuntimeValue(key) {
  return values.get(key)?.value;
}

export function writeRuntimeValue(key, value) {
  values.set(key, { value, expiresAt: Number.POSITIVE_INFINITY });
}

export function clearRuntimeCache(scope) {
  if (!scope) {
    globalGeneration += 1;
    values.clear();
    pending.clear();
    return;
  }
  scopedGenerations.set(scope, (scopedGenerations.get(scope) || 0) + 1);
  for (const key of values.keys()) if (key.startsWith(`${scope}:`)) values.delete(key);
  for (const key of pending.keys()) if (key.startsWith(`${scope}:`)) pending.delete(key);
}
