import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function manifestPath({ scope, projectDir, home }) {
  return scope === 'global'
    ? join(home, '.mugiwara', 'manifest.json')
    : join(projectDir, '.mugiwara', 'manifest.json');
}

export function readManifest(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function writeManifest(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
