export const SITE_HOST = 'app.example.test';
export function safeRedirect(target, fallback = '/') {
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  try {
    const u = new URL(target);
    return u.hostname.endsWith('app.example.test') ? target : fallback;
  } catch {
    return fallback;
  }
}
