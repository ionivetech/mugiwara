export const createDb = () => ({ users: new Map() });
export function registerUser(db, email) {
  const key = email.trim().toLowerCase();
  for (const u of db.users.values()) if (u.email.toLowerCase() === key) throw new Error('email already registered');
  const user = { id: 'u' + (db.users.size + 1), email: email.trim() };
  db.users.set(user.id, user);
  return user;
}
