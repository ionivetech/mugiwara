// src/manifest.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Scope = 'global' | 'project';

export type Manifest = {
  version: string;
  scope: Scope;
  type: string;
  installedAt: string;
  targets: string[];
  files: string[];
};

export function manifestPath({ scope, projectDir, home }: { scope: Scope; projectDir: string; home: string }): string {
  return scope === 'global'
    ? join(home, '.mugiwara', 'manifest.json')
    : join(projectDir, '.mugiwara', 'manifest.json');
}

export function readManifest(file: string): Manifest | null {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Manifest : null;
}

export function writeManifest(file: string, data: Manifest): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
