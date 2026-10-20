export const PERMISSIONS = {
  admin: ['read', 'write', 'delete'],
  editor: ['read', 'write'],
  viewer: ['read'],
};
export function can(role, action) {
  return (PERMISSIONS[role] || []).includes(action);
}
