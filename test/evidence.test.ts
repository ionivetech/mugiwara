// test/evidence.test.ts
// Phase 2 Context Governor — src/evidence.ts unit tests.
// Content-fingerprint registry: stable E### references (spec §11) + duplicate
// detection (spec §12). Reuse-or-create: a repeat read returns the existing
// reference instead of a new one. Persisted as append-only context-registry.jsonl.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fingerprint,
  registerRead,
  findRepeats,
  persistRegistry,
  loadRegistry,
  type RegistryEntry,
} from '../src/evidence.ts';

describe('fingerprint', () => {
  it('is a stable sha256 hex of the content', () => {
    const a = fingerprint('same content');
    const b = fingerprint('same content');
    const c = fingerprint('different content');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('registerRead — reuse-or-create', () => {
  it('same file+content read twice → second returns same ref, repeated, reads 2', () => {
    const registry: RegistryEntry[] = [];
    const first = registerRead(registry, { kind: 'file', file: 'src/a.ts', content: 'aaa' });
    const second = registerRead(registry, { kind: 'file', file: 'src/a.ts', content: 'aaa' });
    expect(first.repeated).toBe(false);
    expect(second.repeated).toBe(true);
    expect(second.ref).toBe(first.ref);
    expect(registry).toHaveLength(1);
    expect(registry[0].reads).toBe(2);
  });

  it('different content → distinct fingerprints, distinct monotonic E### ids', () => {
    const registry: RegistryEntry[] = [
      { fingerprint: 'seed', kind: 'symbol', file: 'src/seed.ts', id: 'E011', reads: 1, ref: 'E011 src/seed.ts' },
    ];
    const a = registerRead(registry, { kind: 'symbol', file: 'src/b.ts', content: 'bbb' });
    const b = registerRead(registry, { kind: 'symbol', file: 'src/c.ts', content: 'ccc' });
    expect(a.ref).not.toBe(b.ref);
    expect(a.repeated).toBe(false);
    expect(b.repeated).toBe(false);
    expect(registry[1].id).toMatch(/^E\d{3}$/);
    expect(registry[2].id).toMatch(/^E\d{3}$/);
    // ids are monotonic: E012 then E013 (never reused)
    expect(registry[1].id).toBe('E012');
    expect(registry[2].id).toBe('E013');
  });

  it('next id continues past existing max (stability, no reuse)', () => {
    const registry: RegistryEntry[] = [
      { fingerprint: 'x1', kind: 'file', file: 'a', id: 'E011', reads: 1, ref: 'E011 a' },
      { fingerprint: 'x2', kind: 'file', file: 'b', id: 'E012', reads: 1, ref: 'E012 b' },
    ];
    const r = registerRead(registry, { kind: 'file', file: 'c', content: 'ccc' });
    expect(registry[2].id).toBe('E013');
    expect(r.ref.startsWith('E013')).toBe(true);
    expect(r.repeated).toBe(false);
  });

  it('same content with a different kind is NOT a repeat (kind-scoped)', () => {
    const registry: RegistryEntry[] = [];
    registerRead(registry, { kind: 'file', file: 'src/a.ts', content: 'same' });
    const r = registerRead(registry, { kind: 'command', file: 'bash', content: 'same' });
    expect(r.repeated).toBe(false);
    expect(registry).toHaveLength(2);
  });
});

describe('findRepeats', () => {
  it('returns only entries with reads >= 2', () => {
    const registry: RegistryEntry[] = [
      { fingerprint: 'a', kind: 'file', file: 'a', id: 'E001', reads: 3, ref: 'E001 a' },
      { fingerprint: 'b', kind: 'file', file: 'b', id: 'E002', reads: 1, ref: 'E002 b' },
      { fingerprint: 'c', kind: 'symbol', file: 'c', id: 'E003', reads: 2, ref: 'E003 c' },
    ];
    const repeats = findRepeats(registry);
    expect(repeats.map((e) => e.id)).toEqual(['E001', 'E003']);
  });

  it('filters by kind when given', () => {
    const registry: RegistryEntry[] = [
      { fingerprint: 'a', kind: 'file', file: 'a', id: 'E001', reads: 3, ref: 'E001 a' },
      { fingerprint: 'b', kind: 'symbol', file: 'b', id: 'E002', reads: 2, ref: 'E002 b' },
    ];
    expect(findRepeats(registry, 'symbol').map((e) => e.id)).toEqual(['E002']);
  });
});

describe('persistRegistry / loadRegistry — JSONL round-trip', () => {
  it('round-trips a temp dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-evidence-'));
    const registry: RegistryEntry[] = [
      { fingerprint: 'f1', kind: 'file', file: 'src/a.ts', id: 'E001', reads: 2, ref: 'E001 src/a.ts' },
    ];
    persistRegistry(dir, registry);
    expect(existsSync(join(dir, 'context-registry.jsonl'))).toBe(true);
    const loaded = loadRegistry(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(registry[0]);
  });

  it('appends a second entry without rewriting the first', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-evidence-'));
    persistRegistry(dir, [{ fingerprint: 'f1', kind: 'file', file: 'a', id: 'E001', reads: 1, ref: 'E001 a' }]);
    persistRegistry(dir, [{ fingerprint: 'f2', kind: 'file', file: 'b', id: 'E002', reads: 1, ref: 'E002 b' }]);
    const lines = readFileSync(join(dir, 'context-registry.jsonl'), 'utf8').trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe('E001');
    expect(JSON.parse(lines[1]).id).toBe('E002');
    expect(loadRegistry(dir)).toHaveLength(2);
  });

  it('creates the mission dir when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-evidence-'));
    const nested = join(dir, 'missions', 'demo');
    persistRegistry(nested, [{ fingerprint: 'f1', kind: 'file', file: 'a', id: 'E001', reads: 1, ref: 'E001 a' }]);
    expect(existsSync(join(nested, 'context-registry.jsonl'))).toBe(true);
    expect(loadRegistry(nested)).toHaveLength(1);
  });

  it('returns empty list when no registry file exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-evidence-'));
    expect(loadRegistry(dir)).toEqual([]);
  });
});
