export const PERMISSIONS = {
  admin: ['read', 'write', 'delete'],
  editor: ['read', 'write'],
  viewer: ['read'],
};
export function can(role, action) {
  if (typeof role !== 'string' || !Object.hasOwn(PERMISSIONS, role)) return false;
  return PERMISSIONS[role].includes(action);
}
