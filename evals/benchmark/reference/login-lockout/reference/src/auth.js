const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;
export function login(db, username, password, now = Date.now()) {
  // Counters are keyed by the submitted username, whether or not it exists, so state and errors never differ.
  const attempts = (db.attempts ??= new Map());
  const a = attempts.get(username) ?? { fails: 0, lockedUntil: 0 };
  if (now < a.lockedUntil) throw new Error('invalid credentials');
  const user = [...db.users.values()].find((u) => u.username === username);
  if (user && user.password === password) {
    attempts.delete(username);
    const token = crypto.randomUUID();
    db.sessions.set(token, user.id);
    return token;
  }
  a.fails++;
  if (a.fails >= MAX_FAILS) { a.lockedUntil = now + LOCK_MS; a.fails = 0; }
  attempts.set(username, a);
  throw new Error('invalid credentials');
}
