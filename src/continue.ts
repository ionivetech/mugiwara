// src/continue.ts
// Deterministic resume-point reader. Powers `mugiwara continue` and
// `mugiwara status` — pure fs + JSON, zero model judgement. The prose skills
// used to describe this scan so the host model would perform it; that cost a
// full reasoning turn to answer "what is in flight?". This is the same answer
// in one process spawn.
//
// Reads what scripts/savepoint.sh writes:
//   .mugiwara/missions/<mission>/state.json              (solo state)
//   .mugiwara/missions/<mission>/<member>.json           (team state)
//   .mugiwara/missions/<mission>/continue.json           (solo resume point)
//   .mugiwara/missions/<mission>/continue-<member>.json  (team resume point)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * v0.6 legacy layout: `.mugiwara/state/<mission>/<member>.json`
 * (and `.mugiwara/continue/<mission>/...`) is invisible to v0.8
 * `missions/` readers. Detect it so status/continue can warn.
 */
export function hasLegacyLayout(projectDir: string): boolean {
  for (const legacy of [join(projectDir, '.mugiwara', 'state'), join(projectDir, '.mugiwara', 'continue')]) {
    if (!existsSync(legacy)) continue;
    try {
      const walk = (dir: string): boolean => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          if (e.isFile() && e.name.endsWith('.json')) return true;
          if (e.isDirectory() && walk(join(dir, e.name))) return true;
        }
        return false;
      };
      if (walk(legacy)) return true;
    } catch { /* ignore */ }
  }
  // also legacy flat files at .mugiwara/state.json style already handled by missions scan,
  // but treat top-level .mugiwara/state/*.json absence as no legacy
  return false;
}

/** Mission/member allowlist — identical to savepoint.sh and mission.ts. */
const SAFE = /^[A-Za-z0-9._-]+$/;
const isSafeKey = (s: string): boolean => SAFE.test(s) && !/^\.+$/.test(s);

export type ContinueEntry = {
  mission: string;
  member: string | null;
  actor: string;
  branch: string;
  flow: number;
  mode: string;
  tasks_done: number;
  tasks_total: number;
  lane: string;
  next_action: string;
  next_session_prompt: string;
  updated_at: string;
};

export type StateEntry = ContinueEntry & {
  lane_reason: string;
  lane_rose: boolean;
  lane_prev: string;
  lane_peak: string;
  base_sha: string;
  sensitive_paths: string[];
  blockers_open: number;
  heal_cycle: number;
  heal_max_cycles: number;
  heal_halt: boolean;
  delegate_threshold: number;
  delegate_due: boolean;
  tokens_est: number;
  budget: number;
  budget_status: string;
  files_touched: number;
  evidence: string[];
  schema_version: number | string | null;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Resolve the git actor exactly as scripts/savepoint.sh does:
 * STATE_ACTOR → GIT_AUTHOR_NAME → "name <email>" → USER. A byte difference
 * here silently filters every mission out of the listing.
 */
export function gitActor(cwd: string): string {
  const env = (process.env.STATE_ACTOR ?? '').trim();
  if (env) return env;
  const author = (process.env.GIT_AUTHOR_NAME ?? '').trim();
  if (author) return author;
  const git = (args: string[]): string => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  const name = git(['config', 'user.name']);
  const email = git(['config', 'user.email']);
  if (name && email) return `${name} <${email}>`;
  // USERNAME is the Windows spelling of USER; savepoint.sh resolves the same
  // chain, and the two must stay byte-identical or the actor filter drops rows.
  return name || process.env.USER || process.env.USERNAME || '';
}

const unreadable: string[] = [];

/** State files that exist but could not be parsed. Cleared by each scan. (B6) */
export function unreadableStateFiles(): string[] { return [...unreadable]; }

/**
 * Read every mission dir under `.mugiwara/missions/<mission>/`, picking the
 * files this reader owns: state readers take `state.json` / `<member>.json`,
 * continue readers take `continue.json` / `continue-<member>.json`. Corrupt
 * files are skipped.
 */
function scan<T>(projectDir: string, kind: 'state' | 'continue', map: (raw: Record<string, unknown>, member: string | null) => T): T[] {
  unreadable.length = 0;
  const base = join(projectDir, '.mugiwara', 'missions');
  if (!existsSync(base)) return [];
  const out: T[] = [];
  const missions = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isSafeKey(e.name))
    .map((e) => e.name)
    .sort();
  for (const mission of missions) {
    const dir = join(base, mission);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      const stem = f.slice(0, -'.json'.length);
      // state files: `state` (solo) or `<member>`; continue files: `continue`
      // (solo) or `continue-<member>`. Each scan ignores the other kind.
      let member: string | null;
      if (kind === 'state') {
        if (stem === 'continue' || stem.startsWith('continue-')) continue;
        member = stem === 'state' ? null : stem;
      } else {
        if (stem === 'continue') member = null;
        else if (stem.startsWith('continue-')) member = stem.slice('continue-'.length);
        else continue;
      }
      if (member !== null && !isSafeKey(member)) continue;
      try {
        const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
        // trust the path over the file body: a mission field that disagrees
        // with its own directory is a corrupt or hand-edited file
        if (text(raw.mission) !== mission) continue;
        out.push(map(raw, member));
      } catch {
        unreadable.push(join(mission, f));
      }
    }
  }
  return out;
}

export function readContinue(projectDir: string): ContinueEntry[] {
  return scan(projectDir, 'continue', (r, member) => ({
    mission: text(r.mission),
    member,
    actor: text(r.actor),
    branch: text(r.branch),
    flow: num(r.flow ?? r.wave),
    mode: text(r.mode) || 'guided',
    tasks_done: num(r.tasks_done),
    tasks_total: num(r.tasks_total),
    lane: text(r.lane) || 'direct',
    next_action: text(r.next_action),
    next_session_prompt: text(r.next_session_prompt),
    updated_at: text(r.updated_at),
  }));
}

export function readState(projectDir: string): StateEntry[] {
  return scan(projectDir, 'state', (r, member) => {
    const tasks = (r.tasks ?? {}) as Record<string, unknown>;
    const sv = r.schema_version;
    return {
      mission: text(r.mission),
      member,
      actor: text(r.actor),
      branch: text(r.branch),
      flow: num(r.flow ?? r.wave),
      mode: text(r.mode) || 'guided',
      tasks_done: num(tasks.done),
      tasks_total: num(tasks.total),
      lane: text(r.lane) || 'direct',
      lane_reason: text(r.lane_reason),
      lane_rose: r.lane_rose === true,
      lane_prev: text(r.lane_prev),
      lane_peak: text(r.lane_peak),
      base_sha: text(r.base_sha),
      sensitive_paths: Array.isArray(r.sensitive_paths) ? r.sensitive_paths.map(text).filter(Boolean) : [],
      next_action: text(r.next_action),
      next_session_prompt: text(r.next_session_prompt),
      updated_at: text(r.updated_at),
      blockers_open: num(r.blockers_open),
      heal_cycle: num(r.heal_cycle),
      heal_max_cycles: num(r.heal_max_cycles) || 3,
      heal_halt: r.heal_halt === true,
      delegate_threshold: num(r.delegate_threshold) || 60,
      delegate_due: r.delegate_due === true,
      tokens_est: num(r.tokens_est),
      budget: num(r.budget),
      budget_status: text(r.budget_status) || 'ok',
      files_touched: num(r.files_touched),
      evidence: Array.isArray(r.evidence) ? r.evidence.map(text).filter(Boolean) : [],
      schema_version: typeof sv === 'number' || typeof sv === 'string' ? sv : null,
    };
  });
}

export type Resolution =
  | { kind: 'none' }
  | { kind: 'missions'; entries: ContinueEntry[] }
  | { kind: 'members'; mission: string; entries: ContinueEntry[] }
  | { kind: 'unknown-mission'; mission: string; known: string[] }
  | { kind: 'unknown-member'; mission: string; member: string; known: string[] }
  | { kind: 'resume'; entry: ContinueEntry };

/**
 * The three command forms, decided from disk alone:
 *   (none)            → list every in-flight mission
 *   <mission>         → solo resumes; team lists its members
 *   <mission> <member>→ resume that member
 *
 * Solo-vs-team needs no plan-doc parse: savepoint writes `state.json` with a
 * null member for solo and `<member>.json` per team member.
 */
export function resolveContinue(entries: ContinueEntry[], mission?: string, member?: string): Resolution {
  if (!entries.length) return { kind: 'none' };

  if (!mission) {
    const missions = [...new Set(entries.map((e) => e.mission))];
    if (missions.length === 1) return resolveContinue(entries, missions[0], member);
    return { kind: 'missions', entries };
  }

  const inMission = entries.filter((e) => e.mission === mission);
  if (!inMission.length) {
    return { kind: 'unknown-mission', mission, known: [...new Set(entries.map((e) => e.mission))] };
  }

  if (member) {
    const hit = inMission.find((e) => e.member === member);
    if (!hit) {
      return {
        kind: 'unknown-member',
        mission,
        member,
        known: inMission.map((e) => e.member ?? '(solo)'),
      };
    }
    return { kind: 'resume', entry: hit };
  }

  const solo = inMission.find((e) => e.member === null);
  // a solo file resumes directly; anything else needs the member picked, and
  // is never guessed — resuming the wrong member's work is unrecoverable
  if (solo && inMission.length === 1) return { kind: 'resume', entry: solo };
  return { kind: 'members', mission, entries: inMission };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

/** Fixed-width table — the whole point is that the host prints this verbatim. */
export function formatTable(entries: ContinueEntry[]): string {
  const rows = entries.map((e) => [
    e.mission,
    e.member ?? '—',
    String(e.flow),
    `${e.tasks_done}/${e.tasks_total}`,
    e.lane,
    e.mode,
  ]);
  const head = ['MISSION', 'MEMBER', 'FLOW', 'TASKS', 'LANE', 'MODE'];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]): string =>
    '  ' + cells.map((c, i) => pad(c, widths[i])).join('  ').trimEnd();
  return [line(head), ...rows.map(line)].join('\n');
}

/** The single resume line the mugiwara-resume skill contracts for. */
export function formatResume(e: ContinueEntry): string {
  const scope = e.member ? ` [${e.member}]` : '';
  const next = e.next_session_prompt || '(no next_session_prompt recorded)';
  return `Resumed: ${e.mission}${scope}, Flow ${e.flow}, ${e.tasks_done}/${e.tasks_total} tasks — next_action: ${e.next_action} — run: ${next}`;
}
