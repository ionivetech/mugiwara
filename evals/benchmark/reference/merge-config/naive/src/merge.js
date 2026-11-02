export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export function deepMerge(base, override) {
  const out = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = isPlainObject(override[k]) && isPlainObject(out[k]) ? deepMerge(out[k], override[k]) : override[k];
  }
  return out;
}
