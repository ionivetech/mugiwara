export function requestReset(db, email, now = Date.now()) {
  const user = [...db.users.values()].find((u) => u.email === email);
  if (!user) throw new Error('unknown email');
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  db.resetTokens.set(token, { userId: user.id, createdAt: now });
  return token;
}
export function confirmReset(db, token, newPassword, now = Date.now()) {
  const rec = db.resetTokens.get(token);
  if (!rec) throw new Error('invalid token');
  db.users.get(rec.userId).password = newPassword;
  return true;
}
