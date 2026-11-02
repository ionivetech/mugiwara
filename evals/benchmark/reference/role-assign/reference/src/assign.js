import { ROLES } from './roles.js';
const rank = (role) => ROLES.indexOf(String(role).trim().toLowerCase());
export function assignRole(db, actor, targetId, role) {
  const target = db.users.get(targetId);
  if (!target) throw new Error('unknown user');
  const want = rank(role);
  if (want === -1) throw new Error('unknown role');
  const mine = rank(actor.role);
  if (mine < ROLES.indexOf('admin')) throw new Error('not allowed to assign roles');
  if (actor.id === targetId) throw new Error('cannot change your own role');
  if (want > mine || rank(target.role) > mine) throw new Error('cannot grant or change a role above your own');
  target.role = ROLES[want];
  return target;
}
