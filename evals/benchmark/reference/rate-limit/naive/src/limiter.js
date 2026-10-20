export const DEFAULT_WINDOW_MS = 60_000;
export function createLimiter({ limit, windowMs, now = Date.now }) {
  const counters = new Map(); // key -> { slot, count }
  return {
    allow(key) {
      const slot = Math.floor(now() / windowMs);
      const c = counters.get(key);
      if (!c || c.slot !== slot) { counters.set(key, { slot, count: 1 }); return true; }
      if (c.count >= limit) return false;
      c.count++;
      return true;
    },
  };
}
