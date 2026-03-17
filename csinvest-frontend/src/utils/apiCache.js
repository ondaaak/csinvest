const memoryCache = new Map();

const now = () => Date.now();

export async function getCachedJson(url, options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : 120000;
  const force = !!options.force;
  const key = String(url);

  if (!force) {
    const cached = memoryCache.get(key);
    if (cached && cached.expiresAt > now()) {
      return cached.value;
    }
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  const data = await res.json();

  memoryCache.set(key, {
    value: data,
    expiresAt: now() + ttlMs,
  });

  return data;
}

export function invalidateCachedUrl(url) {
  memoryCache.delete(String(url));
}
