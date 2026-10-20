import { randomBytes } from 'node:crypto';
const TTL_MS = 60 * 60 * 1000;
export function requestReset(db, email, now = Date.now()) {
  const user = [...db.users.values()].find((u) => u.email === email);
  if (!user) throw new Error('unknown email');
  const token = randomBytes(32).toString('hex');
  db.resetTokens.set(token, { userId: user.id, expiresAt: now + TTL_MS });
  return token;
}
export function confirmReset(db, token, newPassword, now = Date.now()) {
  const rec = db.resetTokens.get(token);
  if (!rec) throw new Error('invalid token');
  db.resetTokens.delete(token);
  if (now >= rec.expiresAt) throw new Error('token expired');
  db.users.get(rec.userId).password = newPassword;
  return true;
}
