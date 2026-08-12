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

function parseSubMissions(content: string): SubMission[] {
  const lines = content.split('\n');
  let inTable = false;
  let inSubSection = false;
  const subs: SubMission[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## Sub-missions')) {
      inSubSection = true;
      continue;
    }
    if (inSubSection && line.startsWith('## ') && !line.startsWith('## Sub-missions')) {
      break;
    }
    if (!inSubSection) continue;

    const trimmed = line.trim();
    if (trimmed.startsWith('| ID ') && trimmed.includes('| Name ')) {
      inTable = true;
      continue;
    }
    if (inTable && trimmed.startsWith('|---')) continue;
    if (inTable && trimmed.startsWith('|')) {
      const cols = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 6) {
        subs.push({
          id: cols[0],
          name: cols[1],
          assignee: cols[2],
          branch: cols[3],
          status: cols[4],
          dependsOn: cols[5],
          touchedFiles: cols.slice(6).join(' ').split(/\s+/).filter(Boolean),
        });
      }
    }
    if (inTable && !trimmed.startsWith('|')) {
      inTable = false;
    }
  }

  return subs;
}

function cmdStatus(planFile: string): void {
  const content = readFileSync(planFile, 'utf8');
  const subs = parseSubMissions(content);

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

  console.log(`\n${doneCount}/${total} done [${bar}] ${pct}%\n`);
  console.log(`${'ID'.padEnd(8)} ${'Name'.padEnd(20)} ${'Assignee'.padEnd(12)} ${'Branch'.padEnd(28)} ${'Status'.padEnd(8)} ${'Depends'.padEnd(10)} ${'Files'}`);
  console.log('─'.repeat(120));

  for (const s of subs) {
    const icon = { '[ ]': '◻', '[~]': '◉', '[x]': '✓', '[!]': '✗' }[s.status] || '?';
    console.log(
      `${s.id.padEnd(8)} ${s.name.padEnd(20)} ${s.assignee.padEnd(12)} ${s.branch.padEnd(28)} ${icon} ${s.status.padEnd(3)} ${s.dependsOn.padEnd(10)} ${s.touchedFiles.join(', ')}`
    );
  }
  console.log();
}

function cmdConflictCheck(planFile: string): void {
  const content = readFileSync(planFile, 'utf8');
  const subs = parseSubMissions(content);

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
  }
}

function cmdSetStatus(planFile: string, id: string, status: string): void {
  if (!STATUS_MARKERS[id]) {
    // `status` here is the status string from args — check it
  }
  if (!STATUS_MARKERS[status]) {
    console.error(`Invalid status: "${status}". Use: pending, in-progress, done, blocked`);
    process.exit(1);
  }

  const content = readFileSync(planFile, 'utf8');
  const lines = content.split('\n');
  const newMarker = STATUS_MARKERS[status];
  let inTable = false;
  let inSubSection = false;
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## Sub-missions')) {
      inSubSection = true;
      continue;
    }
    if (inSubSection && line.startsWith('## ') && !line.startsWith('## Sub-missions')) {
      break;
    }
    if (!inSubSection) continue;

    const trimmed = line.trim();
    if (trimmed.startsWith('| ID ')) { inTable = true; continue; }
    if (!inTable || !trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('|---')) continue;

    const cols = trimmed.split('|').map(c => c.trim()).filter(Boolean);
    if (cols[0] === id) {
      const oldMarker = cols[4];
      if (!Object.values(STATUS_MARKERS).includes(oldMarker)) {
        console.error(`Row ${id}: status column "${oldMarker}" is not a recognized marker`);
        process.exit(1);
      }
      lines[i] = lines[i].replace(oldMarker, newMarker);
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
