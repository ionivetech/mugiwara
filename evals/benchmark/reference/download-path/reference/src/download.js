import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
export function readUpload(baseDir, name) {
  const base = resolve(baseDir);
  const target = resolve(base, name);
  const rel = relative(base, target);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('path escapes the uploads directory');
  return readFileSync(target);
}
