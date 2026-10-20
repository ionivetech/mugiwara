import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export function readUpload(baseDir, name) {
  return readFileSync(join(baseDir, name));
}
