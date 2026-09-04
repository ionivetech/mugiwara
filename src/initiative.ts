// src/initiative.ts — sub-mission dashboard + conflict detection (N1).
//
// Flow 2 produces a `## Sub-missions` table on team missions; nothing checked
// it after the original command was deleted. `status` renders the dashboard,
// `conflict-check` exits 1 when one file is touched by two sub-missions.
import { existsSync, readFileSync } from 'node:fs';

export interface SubMission {
  id: string;
  name: string;
  assignee: string;
  branch: string;
  status: string;
  dependsOn: string;
  touchedFiles: string[];
}

/** Canonical header — printed as the hint when a table fails to parse. */
export const SUB_MISSIONS_HEADER =
  '| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |';

/** Split a Touched Files cell on commas AND whitespace; no trailing commas survive. */
export function splitTouchedFiles(cell: string): string[] {
  return cell
    .split(/[,\s]+/)
    .map((s) => s.trim().replace(/,+$/, ''))
    .filter(Boolean);
}

export interface ParseResult {
  /** True when a `## Sub-missions` section exists (any case). */
  hasSection: boolean;
  rows: SubMission[];
}

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

/**
 * Parse the `## Sub-missions` table. Header match is case-insensitive
 * (`| id | name |` and `| ID | Name |` both work). Returns zero rows — not an
 * error here — when the section exists but no data rows parse; the caller
 * decides what that means (conflict-check treats it as a defect, never as a
 * solo mission).
 */
export function parseSubMissions(planText: string): ParseResult {
  const lines = planText.split('\n');
  const sectionIdx = lines.findIndex((l) => /^##\s+sub-missions\s*$/i.test(l.trim()));
  if (sectionIdx < 0) return { hasSection: false, rows: [] };
  const endIdx = lines.findIndex((l, i) => i > sectionIdx && /^##\s+\S/.test(l.trim()));
  const body = lines.slice(sectionIdx + 1, endIdx < 0 ? undefined : endIdx);

  const isTableLine = (l: string): boolean => /^\s*\|.*\|\s*$/.test(l);
  const isSeparator = (l: string): boolean => /^\s*\|?[\s:|-]+\|?[\s:|.-]*$/.test(l) && /-/.test(l);
  const table = body.filter((l) => isTableLine(l));
  if (!table.length) return { hasSection: true, rows: [] };
  const header = splitRow(table[0]).map((c) => c.toLowerCase());
  // Case-insensitive header match: must at least identify id + name columns.
  const idIdx = header.findIndex((c) => c === 'id');
  const nameIdx = header.findIndex((c) => c === 'name');
  if (idIdx < 0 || nameIdx < 0) return { hasSection: true, rows: [] };
  const col = (name: string, fallback: number): number => {
    const i = header.findIndex((c) => c === name);
    return i < 0 ? fallback : i;
  };
  const touchedIdx = header.findIndex((c) => /touch/.test(c));
  const dataStart = table.length > 1 && isSeparator(table[1]) ? 2 : 1;
  const rows: SubMission[] = [];
  for (const line of table.slice(dataStart)) {
    if (isSeparator(line)) continue;
    const cells = splitRow(line);
    const id = cells[idIdx] ?? '';
    if (!id) continue;
    rows.push({
      id,
      name: cells[nameIdx] ?? '',
      assignee: cells[col('assignee', 2)] ?? '',
      branch: cells[col('branch', 3)] ?? '',
      status: cells[col('status', 4)] ?? '',
      dependsOn: cells[col('depends on', 5)] ?? '',
      touchedFiles: touchedIdx < 0 ? [] : splitTouchedFiles(cells[touchedIdx] ?? ''),
    });
  }
  return { hasSection: true, rows };
}

const DONE = /(\[x\]|done|complete|merged|closed)/i;

/** Rows whose Depends On names an unfinished sub-mission. */
export function blockedRows(rows: SubMission[]): Array<{ id: string; blockedBy: string }> {
  const statusOf = new Map(rows.map((r) => [r.id.toLowerCase(), r.status]));
  const out: Array<{ id: string; blockedBy: string }> = [];
  for (const r of rows) {
    const dep = r.dependsOn.trim();
    if (!dep || dep === '-') continue;
    for (const part of dep.split(/[,\s]+/).filter(Boolean)) {
      const st = statusOf.get(part.toLowerCase());
      if (st !== undefined && !DONE.test(st)) {
        out.push({ id: r.id, blockedBy: part });
        break;
      }
      if (st === undefined && !DONE.test(dep)) {
        out.push({ id: r.id, blockedBy: part });
        break;
      }
    }
  }
  return out;
}

export interface Conflict {
  file: string;
  ids: string[];
}

/** Files touched by more than one sub-mission. */
export function findConflicts(rows: SubMission[]): Conflict[] {
  const owners = new Map<string, string[]>();
  for (const r of rows) {
    for (const f of r.touchedFiles) {
      const list = owners.get(f) ?? [];
      if (!list.includes(r.id)) list.push(r.id);
      owners.set(f, list);
    }
  }
  return [...owners.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([file, ids]) => ({ file, ids }));
}

export interface InitiativeResult {
  code: number;
  output: string;
}

export function runInitiative(sub: string | undefined, planPath: string | undefined): InitiativeResult {
  if (!sub || (sub !== 'status' && sub !== 'conflict-check')) {
    return { code: 1, output: 'usage: mugiwara initiative <status|conflict-check> <plan>\n' };
  }
  if (!planPath) {
    return { code: 1, output: `usage: mugiwara initiative ${sub} <plan>\n` };
  }
  if (!existsSync(planPath)) {
    return { code: 1, output: `mugiwara: plan not found: ${planPath}\n` };
  }
  const { hasSection, rows } = parseSubMissions(readFileSync(planPath, 'utf8'));
  if (!hasSection) {
    return { code: 0, output: 'solo mission (no ## Sub-missions section)\n' };
  }
  if (!rows.length) {
    return {
      code: 1,
      output: `mugiwara: ## Sub-missions section present but no rows parsed — expected header:\n${SUB_MISSIONS_HEADER}\n`,
    };
  }
  if (sub === 'status') {
    const blocked = new Map(blockedRows(rows).map((b) => [b.id, b.blockedBy]));
    const lines = ['id | name | assignee | branch | status | blocked-by'];
    for (const r of rows) {
      lines.push(
        `${r.id} | ${r.name} | ${r.assignee} | ${r.branch} | ${r.status} | ${blocked.get(r.id) ?? '-'}`,
      );
    }
    return { code: 0, output: lines.join('\n') + '\n' };
  }
  const conflicts = findConflicts(rows);
  if (!conflicts.length) return { code: 0, output: 'no conflicts: no file is touched by two sub-missions\n' };
  const lines = conflicts.map((c) => `conflict: ${c.file} touched by ${c.ids.join(', ')}`);
  return { code: 1, output: lines.join('\n') + '\n' };
}
