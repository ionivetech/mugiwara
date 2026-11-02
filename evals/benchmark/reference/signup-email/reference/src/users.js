export const createDb = () => ({ users: new Map() });
const canonical = (email) => email.trim().normalize('NFC').toLowerCase();
export function registerUser(db, email) {
  const key = canonical(email);
  for (const u of db.users.values()) if (canonical(u.email) === key) throw new Error('email already registered');
  const user = { id: 'u' + (db.users.size + 1), email: email.trim() };
  db.users.set(user.id, user);
  return user;
}
