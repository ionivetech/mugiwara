export const TABLE = 'products';
const SORTABLE = ['name', 'price', 'status'];
export function buildSearchQuery({ name, minPrice, status, sortBy, desc } = {}) {
  const where = [], params = [];
  if (name !== undefined) { where.push('name LIKE ?'); params.push('%' + name + '%'); }
  if (minPrice !== undefined) { where.push('price >= ?'); params.push(minPrice); }
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  let sql = 'SELECT * FROM ' + TABLE;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  if (sortBy !== undefined) {
    if (!SORTABLE.includes(sortBy)) throw new RangeError('cannot sort by ' + sortBy);
    sql += ' ORDER BY ' + sortBy + (desc ? ' DESC' : '');
  }
  return { sql, params };
}
