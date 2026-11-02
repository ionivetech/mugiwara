import { ROLES } from './roles.js';
export function assignRole(db, actor, targetId, role) {
  const target = db.users.get(targetId);
  if (!target) throw new Error('unknown user');
  const name = String(role).trim().toLowerCase();
  if (!ROLES.includes(name)) throw new Error('unknown role');
  if (ROLES.indexOf(actor.role) < ROLES.indexOf('admin')) throw new Error('not allowed to assign roles');
  if (ROLES.indexOf(role) > ROLES.indexOf(actor.role)) throw new Error('cannot grant a role above your own');
  target.role = name;
  return target;
}
