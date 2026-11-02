// src/mission.ts
// Mission-state helpers for the mugiwara CLI.
import { existsSync, rmSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync, openSync, writeSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { checkTrail, formatIssues } from './integrity.ts';
import { checkMissionArtifacts } from './check-artifacts.ts';
import { generateRollback } from './rollback.ts';
import { writeProvenance } from './provenance.ts';
import { loadPolicy } from './policy.ts';
import { rankFiles, renderRouting } from './routing.ts';
import { formatFootprint, measureContextChars, readBudgetConfig, shouldCompress, compressThreshold } from './budget.ts';
import { budgetForLane, costEnvelope, appendCostEvent, COMPRESSED_KIND } from './cost.ts';
import { loadRegistry } from './evidence.ts';
import { computeContextMetrics, contextStatus } from './context.ts';
import { buildCostLedger, renderAdaptationSection } from './reporting.ts';
import { buildReport } from './report-fold.ts';
import { dispatchedAgents } from './active-mission.ts';
import { readConfig } from './config.ts';
import { selectPosture } from './posture.ts';
import { recordWasteChecks, runWasteChecks } from './work.ts';

function isStateFile(f: string): boolean {
  // state.json (solo) or <member>.json (team) — never continue*.json
  const stem = f.replace(/\.json$/, '');
  return f.endsWith('.json') && stem !== 'continue' && !stem.startsWith('continue-');
}

/** Deterministic state-file order: solo state.json first, members
 * alphabetical. Raw readdir order is unspecified — Bun returns newest
 * first, Node oldest first — so any user-visible sequence built from it
 * must sort (the provenance model list depended on it and flipped). */
function orderedStateFiles(files: string[]): string[] {
  return files.filter(isStateFile).sort((a, b) =>
    a === 'state.json' ? -1 : b === 'state.json' ? 1 : a.localeCompare(b));
}

/** Primary state for closure artifacts: solo state.json wins over members. */
function primaryState(dir: string, files: string[]): Record<string, unknown> | null {
  const name = files.includes('state.json') ? 'state.json' : files.find((f) => f.endsWith('.json') && f !== 'continue.json' && !f.startsWith('continue-'));
  if (!name) return null;
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extract tasks from state.json — handles nested tasks:{done,total} (current savepoint) and legacy flat fields. */
function tasksFromState(state: Record<string, unknown> | null): { done: number; total: number } {
  if (!state) return { done: 0, total: 0 };
  const t = (state as Record<string, unknown>).tasks as { done?: unknown; total?: unknown } | undefined;
  if (t && typeof t.done === 'number' && typeof t.total === 'number') return { done: t.done, total: t.total };
  const done = Number((state as Record<string, unknown>).tasks_done);
  const total = Number((state as Record<string, unknown>).tasks_total);
  return { done: Number.isFinite(done) ? done : 0, total: Number.isFinite(total) ? total : 0 };
}

/** Fresh task counts from plan.md, with sub-plan fallback for large campaigns (>3 phases). */
function countPlanTasks(missionDir: string): { done: number; total: number } {
  let total = 0;
  let done = 0;
  const planFile = join(missionDir, 'plan.md');
  if (existsSync(planFile)) {
    try {
      const text = readFileSync(planFile, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        if (/^\s*-\s*\[[ xX]\]/.test(line)) {
          total++;
          if (/^\s*-\s*\[[xX]\]/.test(line)) done++;
        }
      }
    } catch { /* best-effort */ }
  }
  if (total === 0) {
    const subPlanDir = join(missionDir, 'sub-plan');
    if (existsSync(subPlanDir)) {
      try {
        for (const f of readdirSync(subPlanDir)) {
          if (!f.endsWith('.md')) continue;
          const text = readFileSync(join(subPlanDir, f), 'utf8');
          for (const line of text.split(/\r?\n/)) {
            if (/^\s*-\s*\[[ xX]\]/.test(line)) {
              total++;
              if (/^\s*-\s*\[[xX]\]/.test(line)) done++;
            }
          }
        }
      } catch { /* best-effort */ }
    }
  }
  return { done, total };
}

/** Files the mission changed, base..branch. Empty on any git failure — routing is best-effort. */
function changedFiles(projectDir: string, state: Record<string, unknown> | null): string[] {
  const base = typeof state?.base_sha === 'string' ? state.base_sha : '';
  const branch = typeof state?.branch === 'string' ? state.branch : '';
  if (!base || base === 'unknown' || !branch) return [];
  try {
    return execFileSync('git', ['diff', '--name-only', base, branch], {
      cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Count distinct assignees in the mission's sub-mission table. This replaces
 * the deleted `team_members` config key — the roster is the only place that
 * knows how many people are on a mission, and it cannot disagree with the plan
 * because it IS the plan.
 * Returns 1 when there is no table (solo mission).
 */
export function rosterSize(missionDir: string): number {
  const plan = join(missionDir, 'plan.md');
  if (!existsSync(plan)) return 1;
  const text = readFileSync(plan, 'utf8');
  const assignees = new Set<string>();
  let inTable = false;
  for (const line of text.split('\n')) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('| id ') && lower.includes('| name ')) { inTable = true; continue; }
    if (inTable) {
      if (!line.trim().startsWith('|')) break;
      if (/^\|[\s:-]+\|/.test(line)) continue;          // separator row
      const cols = line.split('|').map((c) => c.trim());
      const who = cols[3];                               // Assignee column
      if (who && who !== '-') assignees.add(who);
    }
  }
  return assignees.size || 1;
}

export function rosterAssignees(missionDir: string): string[] {
  const plan = join(missionDir, 'plan.md');
  if (!existsSync(plan)) return [];
  const text = readFileSync(plan, 'utf8');
  const assignees = new Set<string>();
  let inTable = false;
  for (const line of text.split('\n')) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('| id ') && lower.includes('| name ')) { inTable = true; continue; }
    if (inTable) {
      if (!line.trim().startsWith('|')) break;
      if (/^\|[\s:-]+\|/.test(line)) continue;
      const cols = line.split('|').map((c) => c.trim());
      const who = cols[3];
      if (who && who !== '-') assignees.add(who);
    }
  }
  return [...assignees];
}

export function readMemberStates(missionDir: string): Array<{ member: string | null; flow: number }> {
  if (!existsSync(missionDir)) return [];
  const out: Array<{ member: string | null; flow: number }> = [];
  for (const f of orderedStateFiles(readdirSync(missionDir))) {
    try {
      const raw = JSON.parse(readFileSync(join(missionDir, f), 'utf8')) as Record<string, unknown>;
      const member = f === 'state.json' ? null : f.slice(0, -'.json'.length);
      const flow = Number((raw as Record<string, unknown>).flow ?? (raw as Record<string, unknown>).wave ?? 0);
      if (member !== null && !/^[A-Za-z0-9._-]+$/.test(member)) continue;
      if (member === 'continue') continue;
      out.push({ member: member as string | null, flow: Number.isFinite(flow) ? flow : 0 });
    } catch { /* corrupt — skip */ }
  }
  return out;
}

export function closureBlockers(missionDir: string, mission: string): string[] {
  const roster = rosterAssignees(missionDir);
  const states = readMemberStates(missionDir);
  const problems: string[] = [];
  for (const who of roster) {
    const s = states.find((x) => x.member === who);
    if (!s) problems.push(`  ${who.padEnd(12)} assigned, never started`);
    else if (s.flow < 9) problems.push(`  ${who.padEnd(12)} Flow ${s.flow}, still in flight`);
  }
  for (const s of states) {
    if (s.member && roster.length && !roster.includes(s.member)) {
      problems.push(`  ${s.member.padEnd(12)} has state but no sub-mission in plan.md`);
    }
  }
  // Solo mission (state.json, no member files) whose plan still names people:
  // the common cause is a literal "solo" assignee — solo rows use "-".
  if (states.some((x) => !x.member) && !states.some((x) => x.member) && roster.length) {
    problems.push(`  plan names ${roster.length} assignee(s) but mission is solo — use "-" for solo rows or run: mugiwara migrate --to-team <member>`);
  }
  return problems;
}

function activeActor(projectDir: string): string | null {
  // state now lives at .mugiwara/missions/<mission>/[member].json — scan the
  // latest state file for its actor
  const missionsDir = join(projectDir, '.mugiwara', 'missions');
  if (!existsSync(missionsDir)) return null;
  const missions = readdirSync(missionsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
  let latest: { actor: string; updated: number } | null = null;
  for (const mission of missions) {
    const d = join(missionsDir, mission);
    for (const f of readdirSync(d).filter(isStateFile)) {
      try {
        const s = JSON.parse(readFileSync(join(d, f), 'utf8'));
        const t = Date.parse(s.updated_at || '') || 0;
        if (!latest || t > latest.updated) latest = { actor: s.actor || null, updated: t };
      } catch { /* corrupt — skip */ }
    }
  }
  return latest ? latest.actor : null;
}

export function resetMission(projectDir: string, keepLogs: boolean, force?: boolean): { removed: string[]; kept: string[]; blocked?: string } {
  const root = join(projectDir, '.mugiwara');
  if (!existsSync(root)) return { removed: [], kept: [] };

  // safe multi-actor: refuse to wipe another actor's live mission
  if (!force) {
    const actor = activeActor(projectDir);
    if (actor) {
      return { removed: [], kept: [], blocked: `Active mission for '${String(actor).replace(/\s*<[^>]*>\s*$/, '')}'. Use --force to override.` };
    }
  }

  const removed: string[] = [];
  const kept: string[] = [];
  // current layout: everything lives in missions/. Legacy pre-0.7 dirs are
  // removed too so an upgraded project ends up with one layout, not two.
  for (const dir of ['missions', 'spec', 'plans', 'results', 'review', 'issues', 'reports', 'state', 'continue']) {
    const p = join(root, dir);
    if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(dir); }
  }
  // legacy flat state files — state.json + branch-specific state-*.json
  for (const f of readdirSync(root)) {
    if (/^state(-.+)?\.json$/.test(f)) {
      const p = join(root, f);
      if (existsSync(p)) { rmSync(p); removed.push(f); }
    }
  }
  // lessons.md moved to the .mugiwara root; legacy home was logs/
  if (!keepLogs) {
    for (const p of [join(root, 'lessons.md'), join(root, 'logs')]) {
      if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(p.startsWith(join(root, 'logs')) ? 'logs' : 'lessons.md'); }
    }
  } else {
    if (existsSync(join(root, 'lessons.md'))) kept.push('lessons.md');
    else if (existsSync(join(root, join('logs', 'lessons.md')))) kept.push(join('logs', 'lessons.md'));
  }
  // index.md is the archive history — after a full reset (missions gone) its entries are dangling (point to deleted report.md). A reset is a fresh start, so clear it; next archive recreates "# Mission index" header.
  if (removed.includes('missions') && existsSync(join(root, 'index.md'))) {
    rmSync(join(root, 'index.md'));
    removed.push('index.md');
  }
  for (const f of ['config', 'manifest.json', 'backup']) {
    if (existsSync(join(root, f))) kept.push(f);
  }
  return { removed, kept };
}

/** Attestation gate (D4); lazy-loads the attest add-on only when policy requires it. Throws when unsigned/untrusted. */
export async function requireAttestation(projectDir: string, mission: string): Promise<void> {
  let required = false;
  try { required = !!loadPolicy(projectDir)?.attestation?.required; } catch (e) {
    if ((e as Error).message.startsWith('unknown policy key')) throw e;
    return; // other policy load errors are best-effort — do not block archive
  }
  if (!required) return;
  const { verifyReport } = await import('./addons/attest/sign.ts');
  const dir = join(projectDir, '.mugiwara', 'missions', mission);
  const v = verifyReport(projectDir, dir);
  if (!v.ok) throw new Error(`closure integrity gate failed — attestation required but report not signed/trusted: ${v.message}`);
}

export function archiveMission(projectDir: string, mission: string, opts: { dryRun?: boolean; force?: boolean; attestationChecked?: boolean } = {}): { report: string | null; removed: string[]; kept: string[]; index?: string } {
  const { dryRun = false, force = false } = opts;
  const root = join(projectDir, '.mugiwara');
  // mission allowlist — same as savepoint.sh. Dot-only
  // names (".", "..") would resolve upward through join(...,"..") and let
  // rmSync reach state.json/config outside the mission dir.
  if (!mission || /[^a-zA-Z0-9._-]/.test(mission) || /^\.+$/.test(mission)) throw new Error(`invalid mission name "${mission}" (allowlist: [a-zA-Z0-9._-], not a dot-path)`);
  const removed: string[] = [];
  const kept: string[] = [];

  const dir = join(root, 'missions', mission);
  if (!existsSync(dir)) return { report: null, removed, kept };

  // Closure gate: a mission is not done when a member is not done. Archive
  // deletes session state, so closing early destroys other people's resume
  // points. Checks both directions — assigned but not started, and started but
  // not finished.
  if (!dryRun) {
    const blockers = closureBlockers(dir, mission);
    if (blockers.length && !force) {
      const msg = `closure blocked — mission "${mission}" is not finished:\n${blockers.join('\n')}\n\n  Every assignee must reach Flow 9. Run \`mugiwara status\` to check.\n  Use --force to archive anyway — in-flight resume points will be lost.`;
      throw new Error(msg);
    }
  }

  // Closure integrity gate: the trail validates itself before it
  // folds. Dangling links, secrets, or missing evidence fail the archive.
  // Card-number shapes are warn-only — they do not block archive.
  if (!dryRun) {
    const issues = checkTrail(dir, projectDir);
    const blocking = issues.filter((i) => i.kind !== 'secret-warn' && i.severity !== 'warn');
    if (blocking.length) {
      throw new Error(`closure integrity gate failed — fix these before archiving:\n${formatIssues(blocking)}`);
    }
    if (issues.length && blocking.length === 0) {
      // warn-only — log but do not fail
      // console.warn is best-effort; archive proceeds
      try {
        const warnText = formatIssues(issues);
        if (warnText) console.warn(`closure integrity warnings (non-blocking):\n${warnText}`);
      } catch { /* ignore */ }
    }
    // Artifact gate (roadmap v0.8 item 4): Lane 2+ missions must carry
    // plan.md + flows/* evidence — a mission without its trail does not fold.
    const artifacts = checkMissionArtifacts(dir);
    if (!artifacts.ok) {
      throw new Error(`archive artifact gate failed — missing: ${artifacts.missing.join(', ')} (lane ${artifacts.lane}). Record what actually ran with: mugiwara record <execution|audit|quality|gates|healing|closure> (or mugiwara close <mission>) before archiving; never invent evidence.`);
    }
    // Attestation gate (D4): when attestation.required is true, the report must be signed and
    // trusted. The verifier is a lazy add-on, so the async check runs in requireAttestation()
    // (CLI callers); a direct sync caller that skipped it fails closed here.
    if (!opts.attestationChecked) {
      let required = false;
      try { required = !!loadPolicy(projectDir)?.attestation?.required; } catch (e) {
        if ((e as Error).message.startsWith('unknown policy key')) throw e;
      }
      if (required) throw new Error('closure integrity gate failed — attestation required but not checked: run `mugiwara archive` (CLI) or await requireAttestation() first');
    }
  }

  const files = readdirSync(dir);
  const state = primaryState(dir, files);
  // Independent-review gate: a risky mission (full lane or sensitive paths) does
  // not close until Robin (review) AND Jinbe (security) each ran as a separate
  // agent for it. Enforced only where the Claude hook ledger exists (marker or
  // ledger file present): other hosts record no dispatches and must not be
  // blocked forever. --force archives anyway and the report says "inline".
  if (!dryRun && !force && state) {
    const risky = state.lane === 'full' || (Array.isArray(state.sensitive_paths) && state.sensitive_paths.length > 0);
    const ledgerActive = existsSync(join(root, '.engaged')) || existsSync(join(root, 'review-dispatch.jsonl'));
    if (risky && ledgerActive && readConfig(projectDir).independent_review !== 'off') {
      const ran = dispatchedAgents(projectDir, mission);
      const missing = [
        ran.has('robin-reviewer') ? '' : 'the review (Robin)',
        ran.has('jinbe-security') ? '' : 'the security check (Jinbe)',
      ].filter(Boolean);
      if (missing.length) {
        throw new Error(
          `closure blocked — mission "${mission}" has not had ${missing.join(' and ')} run as a separate agent. ` +
          'This change touches a risky area, so those checks must not be done in the conversation that wrote it. ' +
          'Run the missing check as a separate agent, then close again; or set independent_review=off in .mugiwara/config to accept an inline check (--force also archives, and the report then says the check was inline).',
        );
      }
    }
  }
  try {
    if (state) {
      // Posture is chosen deterministically at closure too (savepoint.sh writes the live value to state).
      // ponytail: result unused today; delete src/posture.ts + references/posture-routing.md when nothing reads it.
      const sRisk = Array.isArray(state.sensitive_paths) && (state.sensitive_paths as string[]).length ? 'high' : 'low';
      const sTokens = typeof state.tokens_est === 'number' ? state.tokens_est : 0;
      const sBudget = typeof state.budget === 'number' ? state.budget : 0;
      selectPosture({
        lane: (typeof state.lane === 'string' ? state.lane : 'standard') as 'direct' | 'lean' | 'standard' | 'full' | 'spike',
        risk: sRisk,
        independent_tasks: 0,
        order_dependent: true,
        context_pressure: sBudget > 0 && sTokens > sBudget * 0.6,
        team_members: rosterSize(dir),
        phases: 1,
        plan_lines: 0,
        governor: state.budget_status === 'stop' ? 'stop' : state.budget_status === 'warn' ? 'avoid' : 'normal',
      });
      // T6 anti-slop: advisory waste-detector pass over the mission diff.
      // Warn-only — findings land as slop-governor trail rows; archive never
      // blocks here (blocking needs 2+ recorded rejections — shouldBlockWaste).
      // Declared scope is unknown at fold time, so the diff self-scopes: the
      // scope detector cannot false-fire here; supply scope via `mugiwara waste`.
      try {
        const wFiles = changedFiles(projectDir, state);
        if (wFiles.length) {
          const wCheck = runWasteChecks({
            change: `archive:${mission}`,
            files_changed: wFiles,
            declared_scope: wFiles,
            acceptance_expanded: true,
          });
          recordWasteChecks(dir, wCheck);
        }
      } catch { /* advisory — never blocks archive */ }
    }
  } catch {}
  // unique models across every stage's state file (A4) — collected HERE,
  // before the fold deletes the .json files; team members and solo
  // re-savepoints each record the model that ran their stage.
  const stageModels = [...new Set(orderedStateFiles(files).map((f) => {
    try {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
      return typeof s.model === 'string' ? s.model : '';
    } catch { return ''; }
  }).filter(Boolean))];

  // Cost surface — always readable section for the report (T8)
  let costSection = '';
  const toolingLog: string[] = []; // tooling-only lines -> collapsed block in the report appendix
  if (!dryRun && state) {
    const chars = measureContextChars(dir);
    const budget = readBudgetConfig(projectDir);
    const footprintLine = formatFootprint(chars, budget);
    const est = typeof state.tokens_est === 'number' ? state.tokens_est : 0;
    const src = typeof state.tokens_source === 'string' ? state.tokens_source : 'computed';
    const lane = typeof state.lane === 'string' ? state.lane : 'unknown';
    // C2: `status` gates on the LANE token budget (what savepoint.sh enforces),
    // never on the context char budget. `contextStatus` below is its own gate.
    const laneBudget = budgetForLane(lane);
    // Q1/Q2: the normalized envelope computes planned/used/remaining/pct/status
    // on the lane token budget — ONE computation (Q2), reused at render and for
    // the closure event. `effBudget` stays only for the readable delta display.
    const env = costEnvelope({ lane, budget: laneBudget, tokens_est: est });
    const effBudget = budget || laneBudget; // display-only delta basis — never for status (C2)
    const delta = effBudget ? (est <= effBudget ? `${(effBudget - est).toLocaleString()} under` : `${(est - effBudget).toLocaleString()} over`) : 'no budget configured';
    const srcLabel = src === 'reported' ? 'provider-reported' : 'estimator';
    const statusLabel = env.status.toUpperCase(); // derived from the single computation, not recomputed
    // context status on context_budget_chars — separate gate, never token `est` (C2)
    const ctxStatus = contextStatus(budget, chars);
    // context-efficiency metrics from the evidence registry (reads), else all-zero
    // with a note — a zero row must not be misread as "efficient" (risk row).
    const registry = loadRegistry(dir);
    const reads_total = registry.reduce((s, e) => s + e.reads, 0);
    const repeated_reads = registry.reduce((s, e) => s + Math.max(e.reads - 1, 0), 0);
    // M1: honest char accounting — each registered entry carries the content
    // length it holds (chars). total_chars = chars actually loaded (each entry
    // × its reads); unique_chars = distinct payload bytes. computeContextMetrics
    // derives duplicate_chars = total − unique (bytes re-read) and
    // read_avoidance_chars = same (bytes not reloaded by reuse). When a
    // registry exists but carries no char payloads (legacy/absent field), the
    // char fields render as n/a — never fabricated 0 — so reuse_rate > 0 never
    // sits beside a false "read_avoidance_chars: 0".
    const unique_chars = registry.reduce((s, e) => s + (e.chars ?? 0), 0);
    const total_chars = registry.reduce((s, e) => s + (e.chars ?? 0) * e.reads, 0);
    const charTracked = registry.length > 0 && total_chars > 0;
    const metrics = registry.length
      ? computeContextMetrics({
          files_loaded: registry.length,
          reads_total,
          reads_reused: repeated_reads,
          unique_chars,
          total_chars,
          repeated_reads,
        })
      : { files_loaded: 0, repeated_reads: 0, duplicate_chars: 0, reuse_rate: 0, read_avoidance_chars: 0 };
    const ctxNote = registry.length
      ? (charTracked ? '' : ' (char data not tracked)')
      : ' (no registry — reads not tracked)';
    // provider-reported rollup when any stage reported
    let reportedTotal = 0;
    let hasReported = false;
    let processEst = 0;
    let cacheRead = 0;
    let cacheCreate = 0;
    for (const f of files.filter(isStateFile)) {
      try {
        const s = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
        if (s.tokens_source === 'reported' && typeof s.tokens_est === 'number') {
          reportedTotal += s.tokens_est;
          hasReported = true;
          if (typeof s.tokens_process_est === 'number') processEst += s.tokens_process_est;
          if (typeof s.tokens_cache_read === 'number') cacheRead += s.tokens_cache_read;
          if (typeof s.tokens_cache_creation === 'number') cacheCreate += s.tokens_cache_creation;
        }
      } catch { /* corrupt — skip */ }
    }
    if (!hasReported && src === 'reported' && est > 0) {
      reportedTotal = est;
      hasReported = true;
    }
    // W15: single Cost paragraph — one number, no internal field names, no n/a.
    // Lane and fix-cycle counts are tooling detail: they go to the appendix.
    const healCycleVal = typeof state.heal_cycle === 'number' ? state.heal_cycle : 1;
    const pctOf = (n: number) => (effBudget ? ` of ${effBudget.toLocaleString()} tokens (${Math.round((n / effBudget) * 100)}%)` : ' tokens');
    // Provider usage (input+output, no cache) is a different measure from the
    // budget, which is defined on the process estimate. Never divide it by the budget.
    if (hasReported && reportedTotal) {
      costSection = `## Cost\n\n${processEst ? `Process estimate: ${processEst.toLocaleString()}${pctOf(processEst)}.` : 'The process estimate was not recorded.'}\n`;
      costSection += `\nProvider-reported: ${reportedTotal.toLocaleString()} input and output tokens` +
        (cacheRead || cacheCreate ? `, plus ${cacheRead.toLocaleString()} cache reads and ${cacheCreate.toLocaleString()} cache writes` : '') + '.\n';
    } else {
      costSection = `## Cost\n\nUsed **${est.toLocaleString()}** of ${effBudget ? effBudget.toLocaleString() : '—'} tokens${effBudget ? ` (${env.pct}%)` : ''}.\n`;
    }
    toolingLog.push(`Lane \`${lane}\`, ${healCycleVal} heal cycle${healCycleVal === 1 ? '' : 's'}.`);
    // Phase E — adaptation summary from the posture decision trail
    try {
      const adaptation = renderAdaptationSection(dir).trim();
      if (adaptation) toolingLog.push(adaptation.replace(/^## /, '### '));
    } catch { /* best-effort */ }

    // T4: auto-compress when context >80% budget — compress flows → stub, not throw
    // (record compressed event; closure still recorded; hard gate only at 100%)
    if (shouldCompress(budget, chars)) {
      try {
        const flowsDir = join(dir, 'flows');
        const wavesDir = join(dir, 'waves');
        const targetDir = existsSync(flowsDir) ? flowsDir : existsSync(wavesDir) ? wavesDir : null;
        if (targetDir && existsSync(targetDir)) {
          const flowFiles = readdirSync(targetDir).filter(f => f.endsWith('.md'));
          if (flowFiles.length) {
            const pct = Math.round((chars / budget) * 100);
            const stub = `# Compressed trail\n\nTrail ${chars} chars exceeds ${pct}% of budget ${budget} (threshold ${compressThreshold(budget)}) — flows archived as stub to preserve budget. Original flows: ${flowFiles.join(', ')}\n`;
            for (const f of flowFiles) {
              try { rmSync(join(targetDir, f), { force: true }); } catch {}
            }
            writeFileSync(join(targetDir, '00-compressed.md'), stub);
          }
        }
        appendCostEvent(dir, {
          kind: COMPRESSED_KIND,
          mission,
          tokens_est: est,
          budget: laneBudget,
          status: 'compressed',
          context_chars: chars,
          context_status: ctxStatus,
          context_metrics: metrics,
        });
        toolingLog.push(`Context compressed: ${chars} chars is over 80% of the ${budget} budget; flow files were replaced by 00-compressed.md.`);
      } catch { /* compress best-effort — never blocks archive */ }
    }

    // Cost Governor: record the closure cost event — the mission's final
    // cost snapshot, folded into report.md with the rest of the trail.
    // (Phase 1 — native cost governor; pure append, never rewrites state.)
    appendCostEvent(dir, {
      kind: 'closure',
      mission,
      tokens_est: est,
      budget: laneBudget,
      status: env.status, // Q2: the single lane-token-budget computation
      context_chars: chars,
      context_status: ctxStatus,
      context_metrics: metrics,
    });
    // M2: the closure event (with context_status possibly 'over') is recorded
    // BEFORE the hard gate throws — an over-budget closure still leaves a
    // ledger row so the over-budget condition is observable, never erased.
    // T4: over 80% already compressed above; hard fail only at 100% preserves gate-selftest.
    if (budget && chars > budget) {
      throw new Error(`closure context budget failed — ${footprintLine}. Trim the trail or raise context_budget_chars.`);
    }
  }

  // Stateless missions skip the cost section above, but the context budget is
  // a trail property, not a state property — a 200KB trail with no state.json
  // used to archive silently. Gate it anyway (no ledger row to record: there
  // is no state to hang the closure event on).
  if (!dryRun && !state) {
    const chars = measureContextChars(dir);
    const budget = readBudgetConfig(projectDir);
    if (budget && chars > budget) {
      throw new Error(`closure context budget failed — ${formatFootprint(chars, budget)}. Trim the trail or raise context_budget_chars.`);
    }
  }

  // Fold order: narrative artifacts first, wave evidence last (chronological).
  const FOLD_TOP = ['decisions.md', 'blockers.md', 'review.md', 'security.md', 'spec.md'];
  const fold: string[] = [];
  for (const f of FOLD_TOP) {
    if (files.includes(f)) fold.push(f);
  }
  // Flow artifacts: flows/ is the current layout; a legacy mission that still
  // keeps waves/ folds from there so an upgrade never strands a trail.
  // 07-pr-verdict.md SURVIVES archive as a standalone `pr-verdict.md` at the
  // mission root — it is the PR material handed to the user, so it must not
  // fold away into report.md.
  const PR_VERDICT = 'pr-verdict.md';
  const PR_VERDICT_SRC = join('flows', '07-pr-verdict.md');
  const flowsDir = join(dir, 'flows');
  const legacyWavesDir = join(dir, 'waves');
  const artDir = existsSync(flowsDir) ? flowsDir : existsSync(legacyWavesDir) ? legacyWavesDir : flowsDir;
  const artRel = artDir === legacyWavesDir ? 'waves' : 'flows';
  if (existsSync(artDir)) {
    for (const f of readdirSync(artDir).sort()) {
      if (artRel === 'flows' && f === '07-pr-verdict.md') continue; // survives as pr-verdict.md
      fold.push(join(artRel, f));
    }
  }
  // Cost events ledger — appended by the closure event above (or a prior
  // savepoint in a later phase); folds like any other trail artifact so
  // nothing survives loose after archive.
  // W15: no raw JSONL in report — cost-events folds into Cost prose, don't paste
  const hasCostEvents = existsSync(join(dir, 'cost-events.jsonl'));
  const hasRegistry = existsSync(join(dir, 'context-registry.jsonl'));
  // previously both were pushed to fold — now they are removed without pasting

  // The report survives: an existing report.md wins; otherwise the closure
  // wave seeds it; otherwise it starts empty.
  let report = '';
  const reportPath = join(dir, 'report.md');
  if (files.includes('report.md')) report = readFileSync(reportPath, 'utf8');
  else if (existsSync(join(artDir, '06-closure.md'))) report = readFileSync(join(artDir, '06-closure.md'), 'utf8');

  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    // PR verdict survives archive as a standalone file at the mission root —
    // it is the PR material handed to the user and must not fold away.
    const prVerdictSrc = join(dir, PR_VERDICT_SRC);
    if (existsSync(prVerdictSrc)) {
      const prVerdictPath = join(dir, PR_VERDICT);
      writeFileSync(prVerdictPath, readFileSync(prVerdictSrc, 'utf8'));
      kept.push(join('missions', mission, PR_VERDICT));
    }
    // Reader-first report: summary + verdict, topic sections, Evidence appendix.
    const rs = state as Record<string, unknown> | null;
    const num = (k: string): number => (rs && typeof rs[k] === 'number' ? rs[k] as number : 0);
    const sens = rs && Array.isArray(rs.sensitive_paths) ? rs.sensitive_paths as string[] : [];
    const changeLine = state
      ? `${num('files_touched')} file${num('files_touched') === 1 ? '' : 's'} changed (+${num('loc_ins')} / -${num('loc_del')}) on branch \`${typeof state.branch === 'string' ? state.branch : 'unknown'}\`, closed ${new Date().toISOString().slice(0, 10)}.` +
        (sens.length ? ` Sensitive paths touched: \`${sens.join('`, `')}\`.` : '')
      : '';
    const routingSection = state
      ? renderRouting(rankFiles(changedFiles(projectDir, state), {
          mission,
          evidence: Array.isArray(state.evidence) ? (state.evidence as string[]) : [],
          sensitive_paths: Array.isArray(state.sensitive_paths) ? (state.sensitive_paths as string[]) : [],
        } as never), mission)
      : '';
    const seedIsClosure = !files.includes('report.md') && existsSync(join(artDir, '06-closure.md'));
    const folded = fold.map((f) => ({ name: f.split('/').pop() ?? f, body: readFileSync(join(dir, f), 'utf8') }));
    const hasReportBody = fold.length > 0 || changeLine || routingSection || costSection;
    if (hasReportBody || !existsSync(reportPath)) {
      const tmp = `${reportPath}.tmp`;
      writeFileSync(tmp, buildReport({
        mission, seed: report, seedIsClosure, files: folded, changeLine,
        cost: costSection, routing: routingSection, tooling: toolingLog, hasState: !!state,
        dispatched: [...dispatchedAgents(projectDir, mission)],
        absent: ['review.md', 'security.md'].filter((f) => !files.includes(f)),
      }));
      renameSync(tmp, reportPath);
    }
    for (const f of fold) {
      rmSync(join(dir, f), { force: true, recursive: true });
      removed.push(join('missions', mission, f));
    }
    if (hasCostEvents) {
      rmSync(join(dir, 'cost-events.jsonl'), { force: true });
      removed.push(join('missions', mission, 'cost-events.jsonl'));
    }
    if (hasRegistry) {
      rmSync(join(dir, 'context-registry.jsonl'), { force: true });
      removed.push(join('missions', mission, 'context-registry.jsonl'));
    }
    // the pr-verdict source was copied to the root — remove the flows/ copy
    if (existsSync(prVerdictSrc)) {
      rmSync(join(dir, PR_VERDICT_SRC), { force: true });
      removed.push(join('missions', mission, PR_VERDICT_SRC));
    }
    // session state dies with the mission
    for (const f of files.filter((f) => f.endsWith('.json'))) rmSync(join(dir, f), { force: true });
    // flows/ may now be empty — remove the folder
    if (existsSync(artDir) && readdirSync(artDir).length === 0) rmSync(artDir, { recursive: true, force: true });
    // report.md must exist after archive — the closed marker `mugiwara clean`
    // filters on. A stale in-flight mission folds nothing, so seed a stub.
    if (!existsSync(reportPath)) {
      writeFileSync(reportPath, `# Mission: ${mission}\n\nArchived before closure — no wave artifacts were present.\n\n## Not verified\n\nNo review.md and no security.md in the mission folder, so nothing was checked or recorded.\n`);
    }
    // Closure artifacts: executable rollback map and the
    // two-layer provenance record. Best-effort — absent git/base degrades.
    if (state && typeof state.branch === 'string') {
      const rb = generateRollback(projectDir, dir, {
        mission,
        branch: state.branch,
        baseSha: typeof state.base_sha === 'string' ? state.base_sha : 'unknown',
      });
      if (rb) kept.push(join('missions', mission, rb.file));
      try {
        const st = tasksFromState(state);
        const pt = countPlanTasks(dir);
        const tasks_done = pt.total > 0 ? pt.done : st.done;
        const tasks_total = pt.total > 0 ? pt.total : st.total;
        const baseShaForNote = typeof state.base_sha === 'string' ? state.base_sha : undefined;
        writeProvenance(projectDir, dir, {
          mission,
          actor: typeof state.actor === 'string' ? state.actor : '',
          lane: typeof state.lane === 'string' ? state.lane : '',
          mode: typeof state.mode === 'string' ? state.mode : '',
          branch: state.branch,
          tasks_done,
          tasks_total,
          evidence: Array.isArray(state.evidence) ? (state.evidence as string[]) : [],
          models: stageModels,
          base_sha: baseShaForNote,
        } as never, baseShaForNote);
        kept.push(join('missions', mission, 'provenance.md'));
      } catch { /* provenance is additive; archive proceeds */ }
    }
  } else {
    for (const f of fold) removed.push(join('missions', mission, f));
  }
  removed.push(join('missions', mission, '<session state>'));
  if (files.includes('plan.md')) kept.push(join('missions', mission, 'plan.md'));
  if (files.includes('handoff.md')) kept.push(join('missions', mission, 'handoff.md'));
  kept.push(join('missions', mission, 'report.md'));

  // summary index: append one line per archived mission (retention aid).
  // Atomic-append contract (finding A3): the line is written as ONE write()
  // on an O_APPEND fd — POSIX positions O_APPEND writes atomically, so
  // concurrent archivers never overwrite each other's bytes, and a small
  // (<4k) single write does not interleave in practice. The pre-read
  // idempotency check below still has a benign race window under true
  // concurrency: two racers may both see the line missing and both append.
  // That is a duplicate line, not a lost one — duplicates are the preferred
  // failure mode; any future consumer of index.md must dedupe lines on read.
  // Header creation stays racy-but-safe: two first-appends may each prepend
  // "# Mission index\n\n", and header-only-plus-lines remains valid markdown
  // either way.
  let index: string | undefined;
  const indexFile = join(root, 'index.md');
  const line = `- ${mission} — ${new Date().toISOString().slice(0, 10)}\n`;
  if (!dryRun) {
    const existing = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    if (!existing.split(/\r?\n/).some(l => l.startsWith(`- ${mission} —`))) {
      const header = existing ? '' : '# Mission index\n\n';
      const fd = openSync(indexFile, 'a');
      try {
        writeSync(fd, header + line);
      } finally {
        closeSync(fd);
      }
    }
    index = 'index.md';
  }
  return { report: join('missions', mission, 'report.md'), removed, kept, index };
}
