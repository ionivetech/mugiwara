import { randomBytes } from 'node:crypto';
const TTL_MS = 60 * 60_000;
export function issueToken(db, userId, now = Date.now()) {
  const token = randomBytes(32).toString('hex');
  db.tokens.set(token, { userId, expiresAt: now + TTL_MS });
  return token;
}
export function verifyToken(db, token, now = Date.now()) {
  const rec = db.tokens.get(token);
  return rec && now < rec.expiresAt ? rec.userId : null;
}
