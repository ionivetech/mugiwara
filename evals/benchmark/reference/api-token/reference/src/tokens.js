import { createHash, randomBytes } from 'node:crypto';
const TTL_MS = 60 * 60_000;
// Only a SHA-256 digest is stored: a leaked store does not leak usable tokens.
const digest = (token) => createHash('sha256').update(token).digest('hex');
export function issueToken(db, userId, now = Date.now()) {
  const token = randomBytes(32).toString('hex');
  db.tokens.set(digest(token), { userId, expiresAt: now + TTL_MS });
  return token;
}
export function verifyToken(db, token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const rec = db.tokens.get(digest(token));
  return rec && now < rec.expiresAt ? rec.userId : null;
}
