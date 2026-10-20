export const SITE_HOST = 'app.example.test';
export function safeRedirect(target, fallback = '/') {
  // Browsers treat backslash as slash and drop tabs/newlines, so reject them outright.
  if (typeof target !== 'string' || /[\\\u0000-\u001f\u007f]/.test(target)) return fallback;
  if (target.startsWith('/')) return target.startsWith('//') ? fallback : target;
  try {
    const u = new URL(target);
    return u.protocol === 'https:' && u.host === SITE_HOST && !u.username && !u.password ? target : fallback;
  } catch {
    return fallback;
  }
}
