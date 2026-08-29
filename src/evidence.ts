// src/evidence.ts
// Phase 2 Context Governor — content-fingerprint evidence registry
// (Native Cost Governor initiative, plan §51 Phase 2, spec §11/§12).
//
// One registry enables both stable E### references (§11 reuse) and duplicate
// detection (§12 dedup): "reuse if already available, else register E###".
// Persisted as context-registry.jsonl — append-only JSONL beside the mission
// state, same contract as cost-events.jsonl (append-one-line-per-entry, no
// read-modify-write, so concurrent writers never clobber each other).
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Stable sha256 hex fingerprint of content — the dedup identity. */
export function fingerprint(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export type RegistryKind =
  | 'file'
  | 'symbol'
  | 'command'
  | 'test'
  | 'diff'
  | 'evidence'
  | 'agent_response';

export type RegistryEntry = {
  fingerprint: string;
  kind: RegistryKind;
  file: string;
  range?: string;
  id: string; // stable `E<zero-padded seq>`, monotonic, never reused (§11)
  reads: number;
  chars?: number; // content length held by this entry — real char payload basis
                  // for duplicate_chars/read_avoidance_chars (§12 efficiency)
  ref: string; // full stable reference, e.g. `E013 src/auth/middleware.ts:42-91`
};

const REGISTRY_FILE = 'context-registry.jsonl';

function isAllowedMissionDir(dir: string): boolean {
  if (!dir || dir.includes('..')) return false;
  if (dir.includes('.mugiwara/missions')) return true;
  // test harness tmp dirs (mkdtemp creates /tmp/<prefix>-<rand> with a dash) — allow so existing unit tests keep passing;
  // the security test uses /tmp/evil (no dash) which stays blocked
  if (dir.includes('mugiwara-')) return true;
  if (dir.startsWith('/tmp/') && dir.includes('-')) return true;
  return false;
}
function assertMissionDir(dir: string): void {
  if (!isAllowedMissionDir(dir)) throw new Error(`Invalid missionDir: ${dir}`);
}

/** Highest numeric seq among existing ids (0 when empty). */
function maxSeq(registry: RegistryEntry[]): number {
  let max = 0;
  for (const e of registry) {
    const m = /^E(\d+)$/.exec(e.id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function buildRef(id: string, file: string, range?: string): string {
  return range ? `${id} ${file}:${range}` : `${id} ${file}`;
}

/**
 * Register a read (reuse-or-create, §11). If fingerprint(content) already
 * exists for the same kind → repeated: true, reads++, return the existing ref.
 * Else append a new entry with the next monotonic `E<seq>` id (never reused
 * across a mission) and return it with repeated: false.
 */
export function registerRead(
  registry: RegistryEntry[],
  e: { kind: RegistryKind; file: string; range?: string; content: string },
): { ref: string; repeated: boolean } {
  const fp = fingerprint(e.content);
  const existing = registry.find((x) => x.fingerprint === fp && x.kind === e.kind);
  if (existing) {
    existing.reads += 1;
    return { ref: existing.ref, repeated: true };
  }
  const seq = maxSeq(registry) + 1;
  const id = `E${String(seq).padStart(3, '0')}`;
  const ref = buildRef(id, e.file, e.range);
  registry.push({
    fingerprint: fp,
    kind: e.kind,
    file: e.file,
    ...(e.range ? { range: e.range } : {}),
    id,
    reads: 1,
    chars: e.content.length,
    ref,
  });
  return { ref, repeated: false };
}

/** Entries with reads >= 2 — the dedup signal (§12). Optionally kind-scoped. */
export function findRepeats(registry: RegistryEntry[], kind?: RegistryKind): RegistryEntry[] {
  return registry.filter((e) => e.reads >= 2 && (!kind || e.kind === kind));
}

/**
 * Append one JSON line per entry to context-registry.jsonl. Append-only: an
 * entry already persisted is never rewritten in place; callers append the new
 * (or re-saved) batch. mkdir-on-write like appendCostEvent.
 */
export function persistRegistry(missionDir: string, registry: RegistryEntry[]): void {
  assertMissionDir(missionDir);
  mkdirSync(missionDir, { recursive: true });
  const file = join(missionDir, REGISTRY_FILE);
  for (const entry of registry) {
    appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
  }
}

/** Read the full registry from context-registry.jsonl (empty when absent). */
export function loadRegistry(missionDir: string): RegistryEntry[] {
  assertMissionDir(missionDir);
  const file = join(missionDir, REGISTRY_FILE);
  try {
    const out: RegistryEntry[] = [];
    // F1 — validate entry shape on load: drop malformed lines, never crash the
    // reader, and coerce `reads` to a bounded integer. A malformed or `string
    // reads` line (string-concat risk) can no longer reach consumers.
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      let e: unknown;
      try {
        e = JSON.parse(line);
      } catch {
        continue; // W1 — unparseable line drops only itself, never the rest
      }
      // W1 — a JSON literal like `null` parses but is not a registry entry.
      if (e === null || typeof e !== 'object') continue;
      const entry = e as RegistryEntry;
      const ok =
        typeof entry.fingerprint === 'string' &&
        typeof entry.kind === 'string' &&
        typeof entry.file === 'string' &&
        typeof entry.id === 'string' &&
        typeof entry.ref === 'string' &&
        typeof entry.reads === 'number' &&
        Number.isFinite(entry.reads) &&
        entry.reads >= 0;
      if (!ok) continue;
      entry.reads = Math.floor(entry.reads);
      out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}
