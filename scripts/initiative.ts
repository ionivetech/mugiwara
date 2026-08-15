#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const USAGE = `initiative — team sub-mission coordination for mugiwara plans

Usage:
  bun run scripts/initiative.ts status <plan-file>
  bun run scripts/initiative.ts conflict-check <plan-file>
  bun run scripts/initiative.ts set-status <plan-file> --id <id> --status <pending|in-progress|done|blocked>

Commands:
  status          Parse Sub-missions table, render ASCII dashboard
  conflict-check  Detect overlapping Touched Files across in-progress sub-missions
  set-status      Update status marker for a sub-mission row
`;

interface SubMission {
  id: string;
  name: string;
  assignee: string;
  branch: string;
  status: string;
  dependsOn: string;
  touchedFiles: string[];
}

const STATUS_MARKERS: Record<string, string> = {
  pending: '[ ]',
  'in-progress': '[~]',
  done: '[x]',
  blocked: '[!]',
};

function resolvePlan(planFile: string): string {
  const resolved = resolve(process.cwd(), planFile);
  if (existsSync(resolved)) return resolved;

  const plansDir = join(process.cwd(), '.mugiwara', 'plans');
  const plansPath = join(plansDir, planFile.endsWith('.md') ? planFile : `${planFile}.md`);
  if (existsSync(plansPath)) return plansPath;
  if (!planFile.endsWith('.md') && existsSync(join(plansDir, planFile))) return join(plansDir, planFile);

  const alt = join(plansDir, `${planFile}.md`);
  const err = `Plan not found: "${planFile}" (tried: ${resolved}, ${plansPath}, ${alt})`;
  throw new Error(err);
}

// A plan is a markdown document. Garbage (no markdown structure) is not a
// "solo mission" — it is a malformed plan. Heading check keeps the
// no-sub-missions-but-valid-markdown case working as solo mission.
function assertPlanContent(content: string, planFile: string): void {
  if (!/^#{1,6}\s/m.test(content)) {
    throw new Error(`Not a valid plan file: "${planFile}" — expected markdown (no heading found)`);
  }
}

function parseSubMissions(content: string): { subs: SubMission[]; hasSection: boolean } {
  const lines = content.split('\n');
  let inTable = false;
  let inSubSection = false;
  let hasSection = false;
  const subs: SubMission[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().toLowerCase().startsWith('## sub-missions')) {
      inSubSection = true;
      hasSection = true;
      continue;
    }
    if (inSubSection && line.startsWith('## ') && !line.trim().toLowerCase().startsWith('## sub-missions')) {
      break;
    }
    if (!inSubSection) continue;

    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('| id ') && lower.includes('| name ')) {
      inTable = true;
      continue;
    }
    if (inTable && trimmed.startsWith('|---')) continue;
    if (inTable && trimmed.startsWith('|')) {
      // Keep interior empty cells (e.g. empty "depends on"): filter(Boolean)
      // would shift columns and drop the touched-files tail.
      const cols = trimmed.split('|').map(c => c.trim());
      while (cols.length && cols[0] === '') cols.shift();
      while (cols.length && cols[cols.length - 1] === '') cols.pop();
      if (cols.length >= 6) {
        subs.push({
          id: cols[0],
          name: cols[1],
          assignee: cols[2],
          branch: cols[3],
          status: cols[4].replace('[X]', '[x]'),
          dependsOn: cols[5],
          touchedFiles: cols.slice(6).join(' ').split(/[,\s]+/).map(s => s.trim()).filter(Boolean),
        });
      }
    }
    if (inTable && !trimmed.startsWith('|')) {
      inTable = false;
    }
  }

  return { subs, hasSection };
}

function assertRowsParsed(planFile: string, content: string): { subs: SubMission[]; hasSection: boolean } {
  const { subs, hasSection } = parseSubMissions(content);
  if (hasSection && subs.length === 0) {
    console.error('initiative: "## Sub-missions" section found but no rows parsed.');
    console.error('  Expected header: | ID | Name | Assignee | Branch | Status | Depends On | Touched Files |');
    process.exit(1);
  }
  return { subs, hasSection };
}

function cmdStatus(planFile: string): void {
  const content = readFileSync(planFile, 'utf8');
  assertPlanContent(content, planFile);
  const { subs } = assertRowsParsed(planFile, content);

  if (subs.length === 0) {
    console.log('No sub-missions found — solo mission.');
    return;
  }

  const doneCount = subs.filter(s => s.status === '[x]').length;
  const total = subs.length;
  const pct = Math.round((doneCount / total) * 100);
  const barLen = 20;
  const filled = Math.round((doneCount / total) * barLen);
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

  // dependency blocking: a sub whose dependency is not done is blocked
  const statusById = new Map(subs.map(s => [s.id, s.status]));
  const blockedBy = new Map<string, string>();
  for (const s of subs) {
    if (s.dependsOn && statusById.has(s.dependsOn) && statusById.get(s.dependsOn) !== '[x]') {
      blockedBy.set(s.id, s.dependsOn);
    }
  }

  console.log(`\n${doneCount}/${total} done [${bar}] ${pct}%\n`);
  console.log(`${'ID'.padEnd(8)} ${'Name'.padEnd(20)} ${'Assignee'.padEnd(12)} ${'Branch'.padEnd(28)} ${'Status'.padEnd(8)} ${'Depends'.padEnd(10)} ${'Files'}`);
  console.log('─'.repeat(120));

  for (const s of subs) {
    const icon = { '[ ]': '◻', '[~]': '◉', '[x]': '✓', '[!]': '✗' }[s.status] || '?';
    const blocked = blockedBy.has(s.id) ? ` ⛔ blocked-by ${blockedBy.get(s.id)}` : '';
    console.log(
      `${s.id.padEnd(8)} ${s.name.padEnd(20)} ${s.assignee.padEnd(12)} ${s.branch.padEnd(28)} ${icon} ${s.status.padEnd(3)} ${s.dependsOn.padEnd(10)} ${s.touchedFiles.join(', ')}${blocked}`
    );
  }
  console.log();
}

function cmdConflictCheck(planFile: string): void {
  const content = readFileSync(planFile, 'utf8');
  assertPlanContent(content, planFile);
  const { subs } = assertRowsParsed(planFile, content);

  if (subs.length === 0) {
    console.log('No sub-missions — no conflicts possible.');
    return;
  }

  const active = subs.filter(s => s.status === '[~]');
  if (active.length < 2) {
    console.log('Fewer than 2 in-progress sub-missions — no conflicts to check.');
    return;
  }

  const fileToSubs = new Map<string, string[]>();
  for (const s of active) {
    for (const f of s.touchedFiles) {
      const entries = fileToSubs.get(f) || [];
      entries.push(s.id);
      fileToSubs.set(f, entries);
    }
  }

  const conflicts: string[] = [];
  for (const [file, ids] of fileToSubs) {
    if (ids.length > 1) {
      conflicts.push(`  ⚠ ${file} — touched by: ${ids.join(', ')}`);
    }
  }

  if (conflicts.length === 0) {
    console.log('No file conflicts among in-progress sub-missions.');
  } else {
    console.log(`\n${conflicts.length} file conflict(s) detected:\n`);
    console.log(conflicts.join('\n'));
    console.log();
    process.exit(1);
  }
}

function cmdSetStatus(planFile: string, id: string, status: string): void {
  if (!STATUS_MARKERS[status]) {
    console.error(`Invalid status: "${status}". Use: pending, in-progress, done, blocked`);
    process.exit(1);
  }

  const content = readFileSync(planFile, 'utf8');
  assertPlanContent(content, planFile);
  const lines = content.split('\n');
  const newMarker = STATUS_MARKERS[status];
  let inTable = false;
  let inSubSection = false;
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().toLowerCase().startsWith('## sub-missions')) {
      inSubSection = true;
      continue;
    }
    if (inSubSection && line.startsWith('## ') && !line.trim().toLowerCase().startsWith('## sub-missions')) {
      break;
    }
    if (!inSubSection) continue;

    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('| id ')) { inTable = true; continue; }
    if (!inTable || !trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('|---')) continue;

    // same cell handling as parseSubMissions: interior empty cells preserved
    const cols = trimmed.split('|').map(c => c.trim());
    while (cols.length && cols[0] === '') cols.shift();
    while (cols.length && cols[cols.length - 1] === '') cols.pop();
    if (cols[0] === id) {
      let oldMarker = cols[4];
      if (oldMarker === '[X]') oldMarker = '[x]';
      if (!Object.values(STATUS_MARKERS).includes(oldMarker)) {
        console.error(`Row ${id}: status column "${oldMarker}" is not a recognized marker`);
        process.exit(1);
      }
      // rewrite only the status cell — a marker string elsewhere in the row
      // (name, touched files) must not be clobbered by a row-wide replace
      lines[i] = `| ${cols.slice(0, 4).join(' | ')} | ${newMarker} | ${cols.slice(5).join(' | ')} |`;
      found = true;
      break;
    }
  }

  if (!found) {
    console.error(`Sub-mission "${id}" not found in Sub-missions table.`);
    process.exit(1);
  }

  writeFileSync(planFile, lines.join('\n'));
  console.log(`✓ ${id}: ${status}`);
}

// --- main ---

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const cmd = args[0];

try {
  if (cmd === 'status') {
    if (args.length < 2) { console.error('Missing plan-file argument.'); process.exit(1); }
    cmdStatus(resolvePlan(args[1]));
  } else if (cmd === 'conflict-check') {
    if (args.length < 2) { console.error('Missing plan-file argument.'); process.exit(1); }
    cmdConflictCheck(resolvePlan(args[1]));
  } else if (cmd === 'set-status') {
    const idIdx = args.indexOf('--id');
    const statusIdx = args.indexOf('--status');
    if (idIdx === -1 || statusIdx === -1 || args.length < 6) {
      console.error('set-status requires --id <id> --status <status>');
      process.exit(1);
    }
    const id = args[idIdx + 1];
    const statusVal = args[statusIdx + 1];
    cmdSetStatus(resolvePlan(args[1]), id, statusVal);
  } else {
    console.error(`Unknown command: "${cmd}"`);
    console.log(USAGE);
    process.exit(1);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
