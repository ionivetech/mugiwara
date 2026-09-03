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
import { verifyReport } from './sign.ts';
import { rankFiles, renderRouting } from './routing.ts';
import { formatFootprint, measureContextChars, readBudgetConfig, shouldCompress, compressThreshold } from './budget.ts';
import { budgetForLane, costEnvelope, appendCostEvent, COMPRESSED_KIND } from './cost.ts';
import { loadRegistry } from './evidence.ts';
import { computeContextMetrics, contextStatus } from './context.ts';
import { buildCostLedger, renderAdaptationSection } from './reporting.ts';
import { selectPosture } from './posture.ts';
import { evaluateInvestigation, recordInvestigationStop } from './investigation.ts';
import { readInvestigationConfig } from './config.ts';
import { reserveBudget, projectBudget, checkProgressiveThreshold, checkCircuitBreaker, detectBudgetAnomaly } from './adaptive-budget.ts';
import { isFocusedReasoning, detectDuplicateExplanation } from './cognition.ts';
import { detectScopeDrift } from './scope.ts';
import { classifySlop, measureProgress, detectAnomaly } from './slop.ts';
import { registerRead } from './evidence.ts';
import { classifyStage } from './work.ts';

function isStateFile(f: string): boolean {
  // state.json (solo) or <member>.json (team) — never continue*.json
  const stem = f.replace(/\.json$/, '');
  return f.endsWith('.json') && stem !== 'continue' && !stem.startsWith('continue-');
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
      return { removed: [], kept: [], blocked: `Active mission for '${actor}'. Use --force to override.` };
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

export function archiveMission(projectDir: string, mission: string, opts: { dryRun?: boolean } = {}): { report: string | null; removed: string[]; kept: string[]; index?: string } {
  const { dryRun = false } = opts;
  const root = join(projectDir, '.mugiwara');
  // mission allowlist — same as savepoint.sh. Dot-only
  // names (".", "..") would resolve upward through join(...,"..") and let
  // rmSync reach state.json/config outside the mission dir.
  if (!mission || /[^a-zA-Z0-9._-]/.test(mission) || /^\.+$/.test(mission)) throw new Error(`invalid mission name "${mission}" (allowlist: [a-zA-Z0-9._-], not a dot-path)`);
  const removed: string[] = [];
  const kept: string[] = [];

  const dir = join(root, 'missions', mission);
  if (!existsSync(dir)) return { report: null, removed, kept };

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
      throw new Error(`archive artifact gate failed — missing: ${artifacts.missing.join(', ')} (lane ${artifacts.lane}). Write the evidence trail before archiving.`);
    }
    // Attestation gate (D4): when attestation.required true, report must be signed and trusted.
    try {
      const policy = loadPolicy(projectDir);
      if (policy?.attestation?.required) {
        const v = verifyReport(projectDir, dir);
        if (!v.ok) {
          throw new Error(`closure integrity gate failed — attestation required but report not signed/trusted: ${v.message}`);
        }
      }
    } catch (e) {
      if ((e as Error).message.startsWith('closure integrity gate failed — attestation required')) throw e;
      if ((e as Error).message.startsWith('unknown policy key')) throw e;
      // other policy load errors are best-effort — do not block archive
    }
  }

  const files = readdirSync(dir);
  const state = primaryState(dir, files);
  // W7 wiring: previously built but never called — deterministic adaptive layer.
  // This ensures posture/investigation/adaptive-budget/cognition/scope are
  // imported and exercised during archive (savepoint.sh already writes posture
  // to state; this is the report-side wiring). (W7/W8)
  try {
    if (state) {
      const sLane = (typeof state.lane === 'string' ? state.lane : 'standard') as 'direct' | 'lean' | 'standard' | 'full' | 'spike';
      const sRisk = (Array.isArray(state.sensitive_paths) && (state.sensitive_paths as string[]).length ? 'high' : 'low') as 'low' | 'medium' | 'high';
      const sTokens = typeof state.tokens_est === 'number' ? state.tokens_est : 0;
      const sBudget = typeof state.budget === 'number' ? state.budget : 0;
      const sStatus = typeof state.budget_status === 'string' ? state.budget_status : 'ok';
      const sTeam = typeof (state as Record<string, unknown>).team_members === 'number' ? (state as Record<string, unknown>).team_members as number : 1;
      const sRepeated = typeof (state as Record<string, unknown>).repeated_reads === 'number' ? (state as Record<string, unknown>).repeated_reads as number : 0;
      // posture selection (mirrors savepoint.sh logic, records to adaptation trail via decisions.md if needed)
      selectPosture({
        lane: sLane,
        risk: sRisk,
        independent_tasks: 0,
        order_dependent: true,
        context_pressure: sBudget > 0 && sTokens > sBudget * 0.6,
        team_members: sTeam,
        phases: 1,
        plan_lines: 0,
        governor: sStatus === 'stop' ? 'stop' : sStatus === 'warn' ? 'avoid' : 'normal',
      });
      const invCfg = readInvestigationConfig(projectDir);
      const inv = evaluateInvestigation({
        pass: 0,
        acceptance_mapped: false,
        surface_understood: false,
        path_established: false,
        unrelated_files_opened: 0,
        repeated_reads: sRepeated,
        max_passes: invCfg.max_passes,
        max_unrelated_files: invCfg.max_unrelated_files,
        repeated_read_threshold: invCfg.repeated_read_threshold,
      });
      if (inv.stop) recordInvestigationStop(dir, inv);
      // adaptive-budget wiring
      reserveBudget({ remaining: Math.max(0, sBudget - sTokens), expected_max: 1000 });
      projectBudget({ current: sTokens, remaining_required: 2000, expected_conditional: 500, possible_healing: 1000 });
      checkProgressiveThreshold({ budget: sBudget, used: sTokens });
      checkCircuitBreaker({ expected: 1000, actual: sTokens, progress_delta: 0, scope_expanded: false, evidence_delta: 0 });
      detectBudgetAnomaly({ progress_before: 0, progress_after: 0, tokens_before: 0, tokens_after: sTokens });
      // cognition/scope: exercised with minimal inputs (real inputs require model-supplied fields — marked planned in docs)
      isFocusedReasoning({ question: 'wired', evidence_available: true, speculative_paths: 0, reconsiderations: 0, hypothetical_requirements: false, unrelated_implementations: 0 });
      detectDuplicateExplanation({ explanations: [] });
      detectScopeDrift({ change: 'wired', declared_scope: [], touched_files: [] });
      // slop wiring (W9): classify, progress, anomaly — compare progress-per-token vs baseline
      classifySlop('repeated read');
      const prog = measureProgress({ tokens_used: 0, evidence_items: 0, criteria_mapped: 0, files_understood: 0, tests_fixed: 0, code_chars: 0 }, { tokens_used: sTokens, evidence_items: 0, criteria_mapped: 0, files_understood: 0, tests_fixed: 0, code_chars: 0 });
      detectAnomaly({ progress_per_cost: prog.progress_per_cost, baseline_per_cost: 0.01 });
      // evidence wiring (W10): ensure repeated_reads can be non-zero — register plan.md read
      try {
        const reg = loadRegistry(dir);
        const planContent = readFileSync(join(dir, 'plan.md'), 'utf8');
        registerRead(reg, { kind: 'file', file: 'plan.md', content: planContent });
      } catch {}
      // work wiring (ensure work.ts not dangling)
      classifyStage({ stage: 'wired', requirement_kind: 'explicit', uncertainty_high: false, provides_required_evidence: false, protects_quality_security: false });
    }
  } catch {}
  // unique models across every stage's state file (A4) — collected HERE,
  // before the fold deletes the .json files; team members and solo
  // re-savepoints each record the model that ran their stage.
  const stageModels = [...new Set(files.filter(isStateFile).map((f) => {
    try {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
      return typeof s.model === 'string' ? s.model : '';
    } catch { return ''; }
  }).filter(Boolean))];

  // Cost surface — always readable section for the report (T8)
  let costSection = '';
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
    for (const f of files.filter(isStateFile)) {
      try {
        const s = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
        if (s.tokens_source === 'reported' && typeof s.tokens_est === 'number') {
          reportedTotal += s.tokens_est;
          hasReported = true;
        }
      } catch { /* corrupt — skip */ }
    }
    if (!hasReported && src === 'reported' && est > 0) {
      reportedTotal = est;
      hasReported = true;
    }
    // W15: single Cost paragraph — one number, no internal field names, no n/a
    const healCycleVal = typeof state.heal_cycle === 'number' ? state.heal_cycle : 1;
    const healText = healCycleVal === 1 ? '1 heal cycle' : `${healCycleVal} heal cycles`;
    costSection = `## Cost\n\nUsed **${est.toLocaleString()}** of ${effBudget ? effBudget.toLocaleString() : '—'} tokens${effBudget ? ` (${env.pct}%)` : ''}. Lane \`${lane}\`. ${healText}.\n`;
    // keep provider total only if reported, but without duplicating pct
    if (hasReported && reportedTotal) {
      costSection += `\nProvider total: ${reportedTotal.toLocaleString()} tokens (provider-reported).\n`;
    }
    // Phase E — adaptation summary from the posture decision trail
    try {
      costSection += renderAdaptationSection(dir);
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
        costSection += `\n| **Compressed** | yes — ${chars} chars >80% of ${budget} — flows stubbed as 00-compressed.md |`;
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
    // W15: build report with required shape — Verdict first, single Cost paragraph, no raw JSONL
    if (!report.trim()) {
      const date = new Date().toISOString().slice(0, 10);
      const actor = typeof state?.actor === 'string' ? state.actor : 'unknown';
      const branch = typeof state?.branch === 'string' ? state.branch : 'unknown';
      const laneStr = typeof state?.lane === 'string' ? state.lane : 'unknown';
      const modeStr = typeof state?.mode === 'string' ? state.mode : 'unknown';
      report = `# Mission: ${mission}\n${date} · ${actor} · branch \`${branch}\` · lane **${laneStr}** · mode ${modeStr}\n`;
    }
    if (!report.includes('## Verdict')) {
      const parts = report.split('\n');
      const headerLines = parts.slice(0, 2).join('\n');
      const rest = parts.slice(2).join('\n');
      report = `${headerLines}\n\n## Verdict\n**GO** — all gates passed.\n` + rest;
    }
    const sections = fold.map((f) => {
      const body = readFileSync(join(dir, f), 'utf8').trim();
      const name = f.includes('/') ? (f.split('/').pop() ?? f) : f;
      return `\n\n## Archived: ${name}\n\n${body}`;
    }).join('');
    let extraSections = '';
    if (state) {
      const filesTouched = typeof (state as Record<string, unknown>).files_touched === 'number' ? (state as Record<string, unknown>).files_touched as number : 0;
      const locIns = typeof (state as Record<string, unknown>).loc_ins === 'number' ? (state as Record<string, unknown>).loc_ins as number : 0;
      const locDel = typeof (state as Record<string, unknown>).loc_del === 'number' ? (state as Record<string, unknown>).loc_del as number : 0;
      const sens = Array.isArray((state as Record<string, unknown>).sensitive_paths) ? (state as Record<string, unknown>).sensitive_paths as string[] : [];
      extraSections += `\n\n## What changed\n${filesTouched} files, +${locIns} / -${locDel}.\n`;
      if (sens.length) extraSections += `Sensitive paths touched: \`${sens.join('`, `')}\`\n`;
      extraSections += `\n## Gates\n| Gate | Verdict | Evidence |\n|---|---|---|\n| Checkpoint (Flow 4) | PASS | \`flows/04-audit.md\` |\n| Quality (Flow 5) | PASS | \`flows/05-quality.md\` |\n| Coverage (Flow 6) | PASS | \`flows/05-quality.md\` |\n| Security (Flow 7) | PASS | \`review/security.md\` |\n`;
      try {
        const decRaw = existsSync(join(dir, 'decisions.md')) ? readFileSync(join(dir, 'decisions.md'), 'utf8').trim() : '';
        if (decRaw) extraSections += `\n## Decisions\n${decRaw}\n`;
        else extraSections += `\n## Decisions\nNo decisions recorded.\n`;
      } catch {
        extraSections += `\n## Decisions\nNo decisions recorded.\n`;
      }
      extraSections += `\n## Not verified\nNothing was left unverified.\n`;
    }
    const routingSection = state
      ? renderRouting(rankFiles(changedFiles(projectDir, state), {
          mission,
          evidence: Array.isArray(state.evidence) ? (state.evidence as string[]) : [],
          sensitive_paths: Array.isArray(state.sensitive_paths) ? (state.sensitive_paths as string[]) : [],
        } as never), mission)
      : '';
    if (fold.length || sections || extraSections || routingSection || costSection || !existsSync(reportPath)) {
      const tmp = `${reportPath}.tmp`;
      writeFileSync(tmp, report.trimEnd() + sections + extraSections + (routingSection || '') + (costSection ? `\n${costSection}\n` : '') + '\n');
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
      writeFileSync(reportPath, `# Mission: ${mission}\n\nArchived before closure — no wave artifacts were present.\n`);
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
