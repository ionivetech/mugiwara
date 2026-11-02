export const DEFAULT_WINDOW_MS = 60_000;
export function createLimiter({ limit, windowMs, now = Date.now }) {
  const hits = new Map(); // key -> timestamps of allowed calls, oldest first
  return {
    allow(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => x > t - windowMs);
      const ok = recent.length < limit;
      if (ok) recent.push(t);
      hits.set(key, recent);
      return ok;
    },
  };
}
