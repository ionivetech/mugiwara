export const TABLE = 'products';
export function buildSearchQuery({ name, minPrice, status, sortBy, desc } = {}) {
  const where = [], params = [];
  if (name !== undefined) { where.push('name LIKE ?'); params.push('%' + name + '%'); }
  if (minPrice !== undefined) { where.push('price >= ?'); params.push(minPrice); }
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  let sql = 'SELECT * FROM ' + TABLE;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  if (sortBy) sql += ' ORDER BY ' + sortBy + (desc ? ' DESC' : '');
  return { sql, params };
}
