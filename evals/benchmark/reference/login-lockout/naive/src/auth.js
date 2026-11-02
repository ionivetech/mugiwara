const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;
export function login(db, username, password, now = Date.now()) {
  const user = [...db.users.values()].find((u) => u.username === username);
  if (!user) throw new Error('invalid credentials');
  if (now < (user.lockedUntil ?? 0)) throw new Error('account locked');
  if (user.password !== password) {
    user.fails = (user.fails ?? 0) + 1;
    if (user.fails >= MAX_FAILS) { user.lockedUntil = now + LOCK_MS; user.fails = 0; }
    throw new Error('invalid credentials');
  }
  user.fails = 0;
  const token = crypto.randomUUID();
  db.sessions.set(token, user.id);
  return token;
}
