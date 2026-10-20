export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
export function deepMerge(base, override) {
  const out = {};
  for (const [k, v] of Object.entries(base)) if (!UNSAFE.has(k)) out[k] = isPlainObject(v) ? deepMerge(v, {}) : v;
  for (const [k, v] of Object.entries(override)) {
    if (UNSAFE.has(k)) continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : isPlainObject(v) ? deepMerge({}, v) : v;
  }
  return out;
}
