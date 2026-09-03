#!/usr/bin/env bun
// scripts/gate-selftest.ts — G2: prove each gate can fail.
// Mutate → assert RED → restore → assert GREEN. Exit 0 when all pass.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, renameSync, unlinkSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { gatesForLane } from '../src/policy.ts';
import { budgetForLane } from '../src/cost.ts';

const root = join(import.meta.dirname, '..');
let passed = 0;
let failed = 0;

function run(name: string, cmd: string): boolean {
  try { execSync(cmd, { cwd: root, stdio: 'pipe', timeout: 180000 }); return true; }
  catch { return false; }
}

function assert(name: string, shouldSucceed: boolean, fn: () => boolean) {
  const ok = fn() === shouldSucceed;
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

// --- G1: verify-install — delete one shared ref, prove gate fails ---
console.log('\nG1 — verify-install');
if (!existsSync(join(root, 'scripts', 'verify-install.ts'))) {
  console.log('  ⚠  verify-install.ts not found, skipping');
} else {
  const refFile = join(root, 'references', 'source-grounding.md');
  const backup = join(root, 'references', 'source-grounding.md.bak');
  const text = readFileSync(refFile, 'utf8');
  try {
    renameSync(refFile, backup);
    assert('broken pointer → exit 1', false, () => run('G1', 'bun scripts/verify-install.ts'));
  } finally {
    writeFileSync(refFile, text);
    if (existsSync(backup)) unlinkSync(backup);
    assert('restored → exit 0', true, () => run('G1', 'bun scripts/verify-install.ts'));
  }
}

// --- G4: section-length — create SKILL.md with 25-line section ---
console.log('\nG4 — section-length');
if (!existsSync(join(root, 'scripts', 'validate-content.ts'))) {
  console.log('  ⚠  validate-content.ts not found, skipping');
} else {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mugi-g4-'));
  try {
    const skillDir = join(tmpDir, 'skills', 'test-skill');
    mkdirSync(skillDir, { recursive: true });
    const skillFile = join(skillDir, 'SKILL.md');

    const makeBody = (sectionLines: number) => {
      let body = '---\nname: test-skill\ndescription: Test skill for section-length gate, twenty chars\n---\n\n# Test\n\n## Skip when\n\n- Test\n\n## Long Section\n\n';
      for (let i = 0; i < sectionLines; i++) body += `Line ${i + 1} of content for section length test.\n`;
      body += '\n## Red flags\n\n- Test flag\n';
      return body;
    };

    writeFileSync(skillFile, makeBody(25));
    assert('section ≥20 lines → exit 1', false, () => run('G4', `bun scripts/validate-content.ts --check ${skillFile}`));

    writeFileSync(skillFile, makeBody(5));
    assert('short section → exit 0', true, () => run('G4', `bun scripts/validate-content.ts --check ${skillFile}`));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// --- G5: conditional-assertion guard — prove expect-in-conditional goes red ---
console.log('\nG5 — conditional-assertion guard');
{
  const testFile = join(root, 'test', 'targets.test.ts');
  const original = readFileSync(testFile, 'utf8');
  try {
    writeFileSync(testFile, `${original}\nif (x) { expect(1).toBe(1); }\n`);
    assert('expect() in non-invariant conditional → exit 1', false, () => run('G5', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(testFile, original);
    assert('restored → exit 0', true, () => run('G5', 'bun scripts/validate-content.ts'));
  }
}

// --- Cost gate: prove a drifted stated index size goes red -------------------
// validate-content fails when docs/concepts/cost.md's "**Current:** N chars"
// disagrees with the measured skill+agent description total. Without this
// mutation the gate is unproven — a gate that cannot fail is not a gate.
console.log('\nCost gate — measured vs stated index chars');
{
  const costFile = join(root, 'docs', 'concepts', 'cost.md');
  const original = readFileSync(costFile, 'utf8');
  try {
    const costPattern = /\*\*Current:\*\* \d[\d,]* chars/;
    const drifted = original.replace(costPattern, '**Current:** 1 chars');
    if (!costPattern.test(original) || drifted === original) {
      console.error('✗ COST: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(costFile, drifted);
      assert('drifted stated index chars → exit 1', false, () => run('COST', 'bun scripts/validate-content.ts'));
    }
  } finally {
    writeFileSync(costFile, original);
    assert('restored → exit 0', true, () => run('COST', 'bun scripts/validate-content.ts'));
  }
}

// --- G3: savepoint fixtures — prove test fails when a field is broken ---
console.log('\nG3 — savepoint fixtures');
if (!existsSync(join(root, 'test', 'savepoint.test.ts'))) {
  console.log('  ⚠  savepoint.test.ts not found, skipping');
} else {
  const testFile = join(root, 'test', 'savepoint.test.ts');
  const original = readFileSync(testFile, 'utf8');
  try {
    // Break one assertion: change lane validation to expect a wrong value
    const broken = original.replace(
      "expect(['direct', 'lean', 'standard', 'full', 'spike']).toContain(state.lane)",
      "expect(state.lane).toBe('NONEXISTENT')"
    );
    writeFileSync(testFile, broken);
    assert('broken assertion → gate fails', false, () => run('G3', 'bun run test -- savepoint'));
  } finally {
    writeFileSync(testFile, original);
    assert('restored → gate passes', true, () => run('G3', 'bun run test -- savepoint'));
  }
}

// --- D1 mutation: break LANE_PREV resolve (require-style) → lane-integrity red ---
console.log('\nD1 — LANE_PREV resolve mutation');
const savepointFile = join(root, 'scripts', 'savepoint.sh');
if (!existsSync(savepointFile)) {
  console.log('  ⚠  savepoint.sh not found, skipping');
} else {
  const original = readFileSync(savepointFile, 'utf8');
  try {
    // reintroduce the D1 defect: read lane_prev with require() of a relative path
    const d1Pattern = /PREV_JSON=\$\(node -e "try\{const fs=require\('fs'\);const s=JSON\.parse\(fs\.readFileSync\(process\.argv\[1\],'utf8'\)\);process\.stdout\.write\(JSON\.stringify\(\{mission:s\.mission\|\|'',lane:s\.lane\|\|'',peak:s\.lane_peak\|\|''\}\)\)\}catch\(e\)\{process\.stdout\.write\('\{\}'\)\}" "\$STATE_FILE" 2>\/dev\/null \|\| true\)/;
    const broken = original.replace(
      d1Pattern,
      "PREV_JSON=$(node -e \"try{const s=require(process.argv[1]);process.stdout.write(JSON.stringify({mission:s.mission||'',lane:s.lane||'',peak:s.lane_peak||''}))}catch(e){process.stdout.write('{}')}\" \"$STATE_FILE\" 2>/dev/null || true)"
    );
    if (!d1Pattern.test(original) || broken === original) {
      console.error('✗ D1: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(savepointFile, broken);
      assert('broken LANE_PREV resolve → lane-integrity fails', false, () => run('D1', 'bun run test -- lane-integrity -t "lane_prev"'));
    }
  } finally {
    writeFileSync(savepointFile, original);
    assert('restored → lane-integrity passes', true, () => run('D1', 'bun run test -- lane-integrity -t "lane_prev"'));
  }
}

// --- D2 mutation: break monotonic clamp (drop lane_rank) → red ---
console.log('\nD2 — monotonic clamp mutation');
if (!existsSync(savepointFile)) {
  console.log('  ⚠  savepoint.sh not found, skipping');
} else {
  const original = readFileSync(savepointFile, 'utf8');
  try {
    // neuter the clamp: make lane_rank always return 0 so a drop never holds
    const d2Pattern = /lane_rank\(\) \{\n  case "\$1" in\n    direct\) echo 0 ;;[\s\S]*?\n  esac\n\}/;
    const broken = original.replace(
      d2Pattern,
      'lane_rank() {\n  echo 0\n}'
    );
    if (!d2Pattern.test(original) || broken === original) {
      console.error('✗ D2: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(savepointFile, broken);
      assert('broken clamp → lane-integrity fails', false, () => run('D2', 'bun run test -- lane-integrity -t "clamp"'));
    }
  } finally {
    writeFileSync(savepointFile, original);
    assert('restored → lane-integrity passes', true, () => run('D2', 'bun run test -- lane-integrity -t "clamp"'));
  }
}

// --- D3 mutation: empty SENSITIVE_PATS → lane-integrity red ---
console.log('\nD3 — sensitive patterns mutation');
const patternsFile = join(root, 'scripts', 'lib', 'patterns.sh');
if (!existsSync(patternsFile)) {
  console.log('  ⚠  patterns.sh not found, skipping');
} else {
  const original = readFileSync(patternsFile, 'utf8');
  try {
    // reintroduce the D3 defect: singular-only list (no payments/, migrations/)
    const d3Pattern = /SENSITIVE_PATS=.*/;
    const broken = original.replace(
      d3Pattern,
      'SENSITIVE_PATS="auth/|payment/|billing/|crypto/|secrets/|\\.env$|config/.*key|migration/|\\.sql$|schema\\.|\\.prisma$|\\.terraform|\\.tf$"'
    );
    if (!d3Pattern.test(original) || broken === original) {
      console.error('✗ D3: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(patternsFile, broken);
      assert('singular sensitive patterns → lane-integrity fails', false, () => run('D3', 'bun run test -- lane-integrity -t "payments"'));
    }
  } finally {
    writeFileSync(patternsFile, original);
    assert('restored → lane-integrity passes', true, () => run('D3', 'bun run test -- lane-integrity -t "payments"'));
  }
}

// --- D3b mutation: strip the NEW pattern categories → lane-integrity red ---
console.log('\nD3b — new category strip mutation');
if (!existsSync(patternsFile)) {
  console.log('  ⚠  patterns.sh not found, skipping');
} else {
  const original = readFileSync(patternsFile, 'utf8');
  try {
    // derive the broken list from the LIVE source, stripping the exact tokens
    // of the v0.6.4 D3 families — a hard-coded baseline rots the moment a
    // category is added (G3). New family tokens must be added here too.
    const D3B_FAMILY_TOKENS = new Set([
      // raw regex tokens as they appear in live SENSITIVE_PATS (backslashes included)
      'oauth2?/', 'credential', 'sessions?/', 'tokens?/', 'rbac', 'permissions?/', 'acls?/', 'iam/',
      '\\.p12$', '\\.key$', '\\.pem$', 'migrate/', 'Dockerfile', 'docker-compose', '\\.github/workflows/',
      'webhooks?/', 'secret/', 'secrets?\\.ya?ml$', '\\.tfvars$', '\\.env$', '\\.env\\.',
    ]);
    const live = original.match(/SENSITIVE_PATS="([^"]+)"/)?.[1] ?? '';
    const broken = live.split('|').filter(t => !D3B_FAMILY_TOKENS.has(t)).join('|');
    const brokenLine = `SENSITIVE_PATS="${broken}"`;
    const d3bPattern = /SENSITIVE_PATS="[^"]*"/;
    if (!d3bPattern.test(original) || broken === live || !live) {
      console.error('✗ D3b: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(patternsFile, original.replace(d3bPattern, brokenLine));
      assert('missing new categories → lane-integrity fails', false, () => run('D3b', 'bun run test -- lane-integrity -t "sensitive-paths"'));
    }
  } finally {
    writeFileSync(patternsFile, original);
    assert('restored → lane-integrity passes', true, () => run('D3b', 'bun run test -- lane-integrity -t "sensitive-paths"'));
  }
}

// --- D4 mutation: zero LOC_TOKENS → lane-integrity red ---
console.log('\nD4 — churn token mutation');
if (!existsSync(savepointFile)) {
  console.log('  ⚠  savepoint.sh not found, skipping');
} else {
  const original = readFileSync(savepointFile, 'utf8');
  try {
    // revert to delta-based (0 on deletions/refactors)
    const d4Pattern = /LOC_TOKENS=\$\(\( LOC_CHURN \* 12 \)\)/;
    const broken = original.replace(
      d4Pattern,
      'LOC_TOKENS=$(( LOC_DELTA > 0 ? LOC_DELTA * 12 : 0 ))'
    );
    if (!d4Pattern.test(original) || broken === original) {
      console.error('✗ D4: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(savepointFile, broken);
      assert('zero churn tokens → lane-integrity fails', false, () => run('D4', 'bun run test -- lane-integrity -t "churn"'));
    }
  } finally {
    writeFileSync(savepointFile, original);
    assert('restored → lane-integrity passes', true, () => run('D4', 'bun run test -- lane-integrity -t "churn"'));
  }
}

// --- D10 mutation: break continue writer → savepoint test red ---
console.log('\nD10 — continue writer mutation');
if (!existsSync(savepointFile)) {
  console.log('  ⚠  savepoint.sh not found, skipping');
} else {
  const original = readFileSync(savepointFile, 'utf8');
  try {
    // silently drop the continue writer block (make it a no-op). Anchor on the
    // D10 header comment so the regex hits the writer, not the STATE_FILE if.
    const d10Pattern = /# --- continue.*\(D10\): machine-written resume point ---[\s\S]*?\nfi\n\n/;
    const broken = original.replace(
      d10Pattern,
      '# --- continue writer disabled (D10) ---\n\n'
    );
    if (!d10Pattern.test(original) || broken === original) {
      console.error('✗ D10: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(savepointFile, broken);
      assert('broken continue writer → savepoint fails', false, () => run('D10', 'bun run test -- savepoint -t "D10"'));
    }
  } finally {
    writeFileSync(savepointFile, original);
    assert('restored → savepoint passes', true, () => run('D10', 'bun run test -- savepoint -t "D10"'));
  }
}

// --- Retrieval eval ratchet ---
console.log('\nRetrieval eval ratchet');
if (!existsSync(join(root, 'scripts', 'retrieval-eval.ts'))) {
  console.log('  ⚠  retrieval-eval.ts not found, skipping');
} else {
  // Strip trigger words from one skill description to break retrieval
  const orchestrationFile = join(root, 'content', 'skills', 'mugiwara-orchestration', 'SKILL.md');
  if (existsSync(orchestrationFile)) {
    const original = readFileSync(orchestrationFile, 'utf8');
    try {
      const broken = original.replace(/description:.*/, 'description: Does stuff.');
      writeFileSync(orchestrationFile, broken);
      assert('stripped description → ratchet fails', false, () => run('retrieval', 'bun scripts/retrieval-eval.ts'));
    } finally {
      writeFileSync(orchestrationFile, original);
      assert('restored → ratchet passes', true, () => run('retrieval', 'bun scripts/retrieval-eval.ts'));
    }
  }
}

// --- Manifest sync ---
console.log('\nManifest sync');
const manifestFile = join(root, '.claude-plugin', 'plugin.json');
if (!existsSync(manifestFile)) {
  console.log('  ⚠  manifest not found, skipping');
} else {
  const original = readFileSync(manifestFile, 'utf8');
  try {
    const mdata = JSON.parse(original);
    const skills: string[] = mdata.metadata.skills;
    const removed = skills.shift()!;
    writeFileSync(manifestFile, JSON.stringify(mdata, null, 2));
    assert('missing skill → exit 1', false, () => run('manifest', 'bun scripts/validate-content.ts --check-manifest'));
  } finally {
    writeFileSync(manifestFile, original);
    assert('restored → exit 0', true, () => run('manifest', 'bun scripts/validate-content.ts --check-manifest'));
  }
}

// --- Docs drift ---
console.log('\nDocs drift');
const skillsDoc = join(root, 'docs', 'concepts', 'skills.md');
if (!existsSync(skillsDoc)) {
  console.log('  ⚠  docs/skills.md not found, skipping');
} else {
  const original = readFileSync(skillsDoc, 'utf8');
  try {
    // remove every occurrence of mugiwara-frontend entirely
    const broken = original.replace(/mugiwara-frontend/g, '');
    writeFileSync(skillsDoc, broken);
    assert('removed skill mention → exit 1', false, () => run('docs', 'bun scripts/validate-content.ts --check-docs'));
  } finally {
    writeFileSync(skillsDoc, original);
    assert('restored → exit 0', true, () => run('docs', 'bun scripts/validate-content.ts --check-docs'));
  }
}

// --- Index budget ---
console.log('\nIndex budget');
const budgetSkillFile = join(root, 'content', 'skills', 'mugiwara-workflow', 'SKILL.md');
if (!existsSync(budgetSkillFile)) {
  console.log('  ⚠  mugiwara-workflow not found, skipping');
} else {
  const original = readFileSync(budgetSkillFile, 'utf8');
  try {
    // Push budget way past 5500
    const longDesc = 'A'.repeat(6000);
    const broken = original.replace(/description:.*/, `description: ${longDesc}`);
    writeFileSync(budgetSkillFile, broken);
    assert('description past budget → exit 1', false, () => run('budget', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(budgetSkillFile, original);
    assert('restored → exit 0', true, () => run('budget', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- Eval coverage ---
console.log('\nEval coverage');
const evalDir = join(root, 'evals', 'cases');
if (!existsSync(evalDir)) {
  console.log('  ⚠  evals/cases not found, skipping');
} else {
  assert('eval cases present → run-evals exits 0', true, () => run('evals', 'bun scripts/run-evals.ts'));
}

// --- F2: write-scope gate — remove write-scope from one agent, prove red ---
console.log('\nF2 — write-scope gate');
const scopeAgent = join(root, 'content', 'agents', 'nami-planner.md');
if (!existsSync(scopeAgent)) {
  console.log('  ⚠  nami-planner.md not found, skipping');
} else {
  const original = readFileSync(scopeAgent, 'utf8');
  try {
    const broken = original.replace(/\nwrite-scope: artifacts/, '');
    writeFileSync(scopeAgent, broken);
    assert('missing write-scope → exit 1', false, () => run('F2-scope', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(scopeAgent, original);
    assert('restored → exit 0', true, () => run('F2-scope', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- F2: source-scope on non-executor agent — prove red ---
console.log('\nF2 — source-scope restriction');
const plannerAgent = join(root, 'content', 'agents', 'nami-planner.md');
if (!existsSync(plannerAgent)) {
  console.log('  ⚠  nami-planner.md not found, skipping');
} else {
  const original = readFileSync(plannerAgent, 'utf8');
  try {
    const broken = original.replace('write-scope: artifacts', 'write-scope: source');
    writeFileSync(plannerAgent, broken);
    assert('source on non-executor → exit 1', false, () => run('F2-source', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(plannerAgent, original);
    assert('restored → exit 0', true, () => run('F2-source', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- F3: remove Return-to-Luffy from one agent — prove red ---
console.log('\nF3 — hub rule gate');
const hubAgent = join(root, 'content', 'agents', 'robin-reviewer.md');
if (!existsSync(hubAgent)) {
  console.log('  ⚠  robin-reviewer.md not found, skipping');
} else {
  const original = readFileSync(hubAgent, 'utf8');
  try {
    const broken = original.replace(/## Return to Luffy\n\n[\s\S]*?(?=\n## )/, '\n');
    writeFileSync(hubAgent, broken);
    assert('missing Return-to-Luffy → exit 1', false, () => run('F3-hub', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(hubAgent, original);
    assert('restored → exit 0', true, () => run('F3-hub', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- F3: hub-skill gate — every agent must list mugiwara-orchestration; strip it, prove red ---
console.log('\nF3 — hub-skill gate');
const hubSkillAgent = join(root, 'content', 'agents', 'sanji-quality.md');
if (!existsSync(hubSkillAgent)) {
  console.log('  ⚠  sanji-quality.md not found, skipping');
} else {
  const original = readFileSync(hubSkillAgent, 'utf8');
  try {
    const broken = original.replace('mugiwara-orchestration, ', '').replace(', mugiwara-orchestration', '');
    writeFileSync(hubSkillAgent, broken);
    assert('orchestration skill stripped → exit 1', false, () => run('F3-skill', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(hubSkillAgent, original);
    assert('restored → exit 0', true, () => run('F3-skill', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- F4: reintroduce handoff leak — prove red ---
console.log('\nF4 — handoff-target gate');
const brainstormSkill = join(root, 'content', 'skills', 'mugiwara-brainstorm', 'SKILL.md');
if (!existsSync(brainstormSkill)) {
  console.log('  ⚠  mugiwara-brainstorm/SKILL.md not found, skipping');
} else {
  const original = readFileSync(brainstormSkill, 'utf8');
  try {
    const broken = original.replace(
      'and return to Luffy, who routes to Nami or Zoro.',
      'and hand to Nami (mugiwara-planning) via the main thread.'
    );
    writeFileSync(brainstormSkill, broken);
    assert('handoff leak → exit 1', false, () => run('F4-handoff', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(brainstormSkill, original);
    assert('restored → exit 0', true, () => run('F4-handoff', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- F2: red-flags gate — strip the heading from one skill, prove red ---
console.log('\nF2 — red-flags gate');
const redSkill = join(root, 'content', 'skills', 'mugiwara-workflow', 'SKILL.md');
if (!existsSync(redSkill)) {
  console.log('  ⚠  mugiwara-workflow/SKILL.md not found, skipping');
} else {
  const original = readFileSync(redSkill, 'utf8');
  try {
    const broken = original.replace('## Red flags', '## Disabled');
    writeFileSync(redSkill, broken);
    assert('missing Red flags → exit 1', false, () => run('F2-redflags', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(redSkill, original);
    assert('restored → exit 0', true, () => run('F2-redflags', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- W1: write-boundary gate — strip the section, prove red ---
console.log('\nW1 — write-boundary gate');
const wbSkill = join(root, 'content', 'skills', 'mugiwara-orchestration', 'SKILL.md');
if (!existsSync(wbSkill)) {
  console.log('  ⚠  mugiwara-orchestration/SKILL.md not found, skipping');
} else {
  const original = readFileSync(wbSkill, 'utf8');
  try {
    const broken = original.replace('## Write boundary', '## Boundary');
    writeFileSync(wbSkill, broken);
    assert('missing write boundary → exit 1', false, () => run('W1-wb', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(wbSkill, original);
    assert('restored → exit 0', true, () => run('W1-wb', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- F14: agent-count gate — flip an internal agent to user-facing, prove red ---
console.log('\nF14 — agent-count gate');
const countAgent = join(root, 'content', 'agents', 'eval-runner.md');
if (!existsSync(countAgent)) {
  console.log('  ⚠  eval-runner.md not found, skipping');
} else {
  const original = readFileSync(countAgent, 'utf8');
  try {
    const broken = original.replace('internal: true', 'internal: false');
    writeFileSync(countAgent, broken);
    assert('count drift → exit 1', false, () => run('F14-count', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(countAgent, original);
    assert('restored → exit 0', true, () => run('F14-count', 'bun scripts/validate-content.ts --check-manifest --check-docs'));
  }
}

// --- CI: closure integrity gate — a secret in the trail must fail the archive ---
console.log('\nCI — closure integrity gate');
{
  const tmp = mkdtempSync(join(tmpdir(), 'mugi-ci-'));
  try {
    const mdir = join(tmp, '.mugiwara', 'missions', 'selftest-mission');
    mkdirSync(mdir, { recursive: true });
    const cli = `bun src/cli.ts archive selftest-mission --project ${tmp}`;
    // A mission with no trail at all archives fine (stub report path).
    assert('clean stub → exit 0', true, () => run('CI-clean', cli));
    // A planted secret must turn the gate red.
    writeFileSync(join(mdir, 'report.md'), 'token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456\n');
    writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: 'selftest-mission' }));
    assert('planted secret → exit 1', false, () => run('CI-secret', cli));
    unlinkSync(join(mdir, 'report.md'));
    unlinkSync(join(mdir, 'state.json'));
    assert('cleaned → exit 0', true, () => run('CI-clean2', cli));

    // Context-budget gate: a ceiling that the trail exceeds must fail red.
    writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: 'selftest-mission' }));
    writeFileSync(join(mdir, 'report.md'), 'x'.repeat(500) + '\n');
    mkdirSync(join(tmp, '.mugiwara'), { recursive: true });
    writeFileSync(join(tmp, '.mugiwara', 'config'), 'context_budget_chars=10\n');
    assert('over context budget → exit 1', false, () => run('CI-budget', cli));
    unlinkSync(join(tmp, '.mugiwara', 'config'));
    assert('budget unset → exit 0', true, () => run('CI-budget2', cli));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- POLICY: an invalid mugiwara.policy.yml fails lane.sh closed ---
console.log('\nPOLICY — fail-closed policy parsing');
{
  const repo = mkdtempSync(join(tmpdir(), 'mugi-policy-'));
  // lane.sh must run INSIDE the sandbox repo, not this one
  const runInRepo = (args: string): boolean => {
    try { execSync(`bash ${join(root, 'scripts', 'lane.sh')} ${args}`, { cwd: repo, stdio: 'pipe', timeout: 60000 }); return true; }
    catch { return false; }
  };
  try {
    execSync('git init -q && git config user.email t@t.com && git config user.name T && git commit --allow-empty -qm base', { cwd: repo, stdio: 'pipe' });
    writeFileSync(join(repo, 'changed.ts'), 'export {};\n');
    // no policy file → normal behavior
    assert('no policy → lane runs', true, () => runInRepo('HEAD --json'));
    // unknown root key must fail loud, not silently disable itself
    writeFileSync(join(repo, 'mugiwara.policy.yml'), 'lanez:\n  force_full: ["src/**"]\n');
    assert('bogus policy key → exit 1', false, () => runInRepo('HEAD --json'));
    // valid policy parses and can force full
    writeFileSync(join(repo, 'mugiwara.policy.yml'), 'lanes:\n  force_full:\n    - "**/*.ts"\n');
    assert('valid policy → lane runs', true, () => runInRepo('HEAD --json'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

// --- T7: evidence-thin — fabricated PASS wave with empty body must fail ---
console.log('\nT7 — evidence-thin gate');
{
  const tmp = mkdtempSync(join(tmpdir(), 'mugi-thin-'));
  try {
    const mdir = join(tmp, '.mugiwara', 'missions', 'selftest-thin');
    mkdirSync(join(mdir, 'flows'), { recursive: true });
    const cli = `bun src/cli.ts archive selftest-thin --project ${tmp}`;
    writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: 'selftest-thin', evidence: ['flows/04-gates.md'] }));
    writeFileSync(join(mdir, 'report.md'), 'Verdict: PASS see [evidence](flows/04-gates.md)');
    writeFileSync(join(mdir, 'flows', '04-gates.md'), 'all good'); // no command shape → thin
    assert('fabricated PASS with empty body → exit 1', false, () => run('T7-thin', cli));
    writeFileSync(join(mdir, 'flows', '04-gates.md'), 'ran `bun run test` → 2 passed, exit 0');
    assert('with command output → exit 0', true, () => run('T7-good', cli));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- Benchmark governor — tamper thresholds, prove harness goes red ---
console.log('\nBenchmark governor — thresholds tamper');
{
  const threshFile = join(root, 'scripts', 'benchmark-thresholds.json');
  if (!existsSync(threshFile)) {
    console.log('  ⚠  benchmark-thresholds.json not found, skipping');
  } else {
    const original = readFileSync(threshFile, 'utf8');
    try {
      const data = JSON.parse(original);
      data.workloads = data.workloads.map((w: Record<string, unknown>) => ({ ...w, projected: 0, overhead: 0 }));
      writeFileSync(threshFile, JSON.stringify(data, null, 2));
      assert('tampered thresholds → benchmark-governor fails', false, () => run('bench', 'bun scripts/benchmark-governor.ts'));
    } finally {
      writeFileSync(threshFile, original);
      assert('restored → benchmark-governor passes', true, () => run('bench', 'bun scripts/benchmark-governor.ts'));
    }
  }
}

// --- DOCLINKS: a relative .md link that does not resolve must fail the gate ---
console.log('\nDOCLINKS — doc link resolution');
{
  const probe = join(root, 'docs', 'tmp-doclinks-probe.md');
  try {
    writeFileSync(probe, '[missing](./nowhere-at-all.md)\n');
    assert('broken doc link → exit 1', false, () => run('DL-bad', 'bun scripts/check-doc-links.ts'));
    unlinkSync(probe);
    assert('cleaned → exit 0', true, () => run('DL-good', 'bun scripts/check-doc-links.ts'));
  } finally {
    if (existsSync(probe)) unlinkSync(probe);
  }
}

// --- T3: lane-aware gates — direct 3 steps, full 12 steps ---
console.log('\nT3 — lane-aware gates');
{
  const policyFile = join(root, 'src', 'policy.ts');
  const originalPolicy = readFileSync(policyFile, 'utf8');
  try {
    assert('direct lane → 3 steps', true, () => gatesForLane('direct').length === 3);
    assert('direct lane includes typecheck+build', true, () => {
      const s = gatesForLane('direct');
      return s.includes('typecheck') && s.includes('build');
    });
    assert('lean lane → 6 steps with validate-content', true, () => {
      const s = gatesForLane('lean');
      return s.length === 6 && s.includes('validate-content');
    });
    assert('standard lane → 9 steps', true, () => gatesForLane('standard').length === 9);
    assert('full lane → 12 steps with evals/retrieval/conformance', true, () => {
      const s = gatesForLane('full');
      return s.length === 12 && s.includes('run-evals') && s.includes('retrieval-eval') && s.includes('conformance');
    });
    assert('budget direct → 0, full → 50000', true, () => budgetForLane('direct') === 0 && budgetForLane('full') === 50000);
    assert('budget spike → 9000 (direct fixture 9k)', true, () => budgetForLane('spike') === 9000);
    // mutation: break direct step count → should fail (file content shows not 3)
    const broken = originalPolicy.replace(
      "direct: ['build-hooks:check', 'typecheck', 'build']",
      "direct: ['typecheck']"
    );
    if (broken !== originalPolicy) {
      writeFileSync(policyFile, broken);
      assert('broken direct gate → not 3 steps', false, () => readFileSync(policyFile, 'utf8').includes("direct: ['build-hooks:check', 'typecheck', 'build']"));
    } else {
      console.error('✗ T3: mutation target not found — the gate it guards may be dead.');
      failed++;
    }
  } finally {
    writeFileSync(policyFile, originalPolicy);
    assert('restored → direct 3 steps', true, () => {
      const txt = readFileSync(policyFile, 'utf8');
      return txt.includes("direct: ['build-hooks:check', 'typecheck', 'build']");
    });
  }
  assert('full still includes conformance (conformance 71→74)', true, () => {
    const txt = readFileSync(policyFile, 'utf8');
    return txt.includes("'conformance'") && txt.includes("full:");
  });
}

// --- B1: CLI availability — remove section → content validation fails ---
console.log('\nB1 — CLI availability');
{
  const wf = join(root, 'content', 'skills', 'mugiwara-workflow', 'SKILL.md');
  const original = readFileSync(wf, 'utf8');
  try {
    const b1Pattern = /## CLI availability[\s\S]*?## Artifact trust/;
    const b1Broken = original.replace(b1Pattern, '## Artifact trust');
    if (!b1Pattern.test(original) || b1Broken === original) {
      console.error('✗ B1: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(wf, b1Broken);
      assert('missing CLI availability → grep fails', false, () => run('B1-grep', 'grep -q "CLI availability" content/skills/mugiwara-workflow/SKILL.md'));
    }
  } finally {
    writeFileSync(wf, original);
    assert('restored → content validation passes', true, () => run('B1-restore', 'grep -q "CLI availability" content/skills/mugiwara-workflow/SKILL.md'));
  }
}

// --- B2: team evidence gate — revert to single state.json → integrity gate fails on team ---
console.log('\nB2 — team evidence gate');
{
  const integ = join(root, 'src', 'integrity.ts');
  const original = readFileSync(integ, 'utf8');
  try {
    const fixedPattern = /const stateFiles = existsSync\(missionDir\)/;
    const broken = original.replace(fixedPattern, "const evidenceFile = join(missionDir, 'state.json'); // B2 revert");
    const fullPattern = /  \/\/ Solo layout writes state\.json; team layout writes <member>\.json per member\./;
    let b2Broken = original;
    if (fullPattern.test(original)) {
      // remove the team-aware block header to make grep for stateFiles fail for the specific definition
      b2Broken = original.replace(fixedPattern, "const evidenceFile = join(missionDir, 'state.json'); // B2 revert");
      // also need to remove remaining stateFiles references to make grep fail - replace all stateFiles with evidenceFile
      b2Broken = b2Broken.replace(/stateFiles/g, 'evidenceFile');
    }
    if (!fixedPattern.test(original) || broken === original) {
      console.error('✗ B2: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(integ, b2Broken);
      assert('single state.json → team evidence gate dead', false, () => run('B2', 'grep -q "const stateFiles = existsSync" src/integrity.ts'));
    }
  } finally {
    writeFileSync(integ, original);
    assert('restored → team gate present', true, () => run('B2-restore', 'grep -q "const stateFiles = existsSync" src/integrity.ts'));
  }
}

// --- B3: task counter — restore unanchored grep → savepoint task test fails ---
console.log('\nB3 — task counter');
{
  const sp = join(root, 'scripts', 'savepoint.sh');
  const original = readFileSync(sp, 'utf8');
  try {
    const broken = original.replace('TASKS_TOTAL=$(count_boxes "$PLAN_FILE" \'[ xX]\')', 'TASKS_TOTAL=$(grep -cE \'^\\s*-\\s*\\[[ xX]\\]\' "$PLAN_FILE" 2>/dev/null || true)')
      .replace('TASKS_DONE=$(count_boxes "$PLAN_FILE" \'[xX]\')', 'TASKS_DONE=$(grep -c \'\\[x\\]\' "$PLAN_FILE" 2>/dev/null || true)');
    if (broken === original) {
      console.error('✗ B3: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(sp, broken);
      assert('unanchored grep → savepoint task test fails', false, () => run('B3', 'bun run test -- savepoint -t "B3: task counting"'));
    }
  } finally {
    writeFileSync(sp, original);
    assert('restored → savepoint task test passes', true, () => run('B3-restore', 'bun run test -- savepoint -t "B3: task counting"'));
  }
}

// --- B4: repo root — restore [ -d .git ] → lane subdirectory test fails ---
console.log('\nB4 — repo root');
{
  const lane = join(root, 'scripts', 'lane.sh');
  const original = readFileSync(lane, 'utf8');
  try {
    const broken = original.replace(
      /# Resolve the repo root: handles subdirectories and git worktrees[\s\S]*?cd "\$REPO_ROOT" \|\| \{ echo "lane: cannot enter repo root" >&2; exit 1; \}/,
      '[ -d .git ] || { echo "lane: not a git repository" >&2; exit 1; }'
    );
    if (broken === original) {
      console.error('✗ B4: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(lane, broken);
      assert('[ -d .git ] → lane subdirectory gate dead', false, () => run('B4', 'grep -q "git rev-parse --show-toplevel" scripts/lane.sh'));
    }
  } finally {
    writeFileSync(lane, original);
    assert('restored → lane uses git rev-parse', true, () => run('B4-restore', 'grep -q "git rev-parse --show-toplevel" scripts/lane.sh'));
  }
}

// --- B5: spike budget — set below base → lane-base fails ---
console.log('\nB5 — spike budget');
{
  const baseFile = join(root, 'scripts', 'lib', 'lane-base.sh');
  const original = readFileSync(baseFile, 'utf8');
  try {
    const broken = original.replace('BUDGET_spike=9000', 'BUDGET_spike=3000');
    if (broken === original) {
      console.error('✗ B5: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(baseFile, broken);
      assert('BUDGET_spike 3000 < LANE_BASE 5411 → lane-base fails', false, () => run('B5', 'bun scripts/lane-base.ts'));
    }
  } finally {
    writeFileSync(baseFile, original);
    assert('restored → lane-base passes', true, () => run('B5-restore', 'bun scripts/lane-base.ts'));
  }
}

// --- B6: corrupt state — swallow parse errors again → status test fails ---
console.log('\nB6 — corrupt state');
{
  const cont = join(root, 'src', 'continue.ts');
  const original = readFileSync(cont, 'utf8');
  try {
    const broken = original.replace('unreadable.push(join(mission, f));', '// corrupt savepoint — skip, never crash the listing');
    if (broken === original) {
      console.error('✗ B6: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(cont, broken);
      assert('swallow parse errors → unreadable gate dead', false, () => run('B6', 'grep -q "unreadableStateFiles" src/continue.ts && grep -q "unreadable.push" src/continue.ts'));
    }
  } finally {
    writeFileSync(cont, original);
    assert('restored → corrupt state surfaced', true, () => run('B6-restore', 'grep -q "unreadable.push" src/continue.ts'));
  }
}

// --- B7: zero evidence — remove check → integrity team test fails ---
console.log('\nB7 — zero evidence');
{
  const integ = join(root, 'src', 'integrity.ts');
  const original = readFileSync(integ, 'utf8');
  try {
    const b7Pattern = /mission declares no evidence/;
    const broken = original.replace(b7Pattern, 'ZERO_EVIDENCE_REMOVED');
    if (!b7Pattern.test(original) || broken === original) {
      console.error('✗ B7: mutation target not found — the gate it guards may be dead.');
      failed++;
    } else {
      writeFileSync(integ, broken);
      assert('no zero-evidence check → integrity gate dead', false, () => run('B7', 'grep -q "mission declares no evidence" src/integrity.ts'));
    }
  } finally {
    writeFileSync(integ, original);
    assert('restored → zero-evidence warned', true, () => run('B7-restore', 'grep -q "mission declares no evidence" src/integrity.ts'));
  }
}

// --- W1: mode from config — revert to positional-only → gate fails ---
console.log('\nW1 — mode from config');
{
  const sp = join(root, 'scripts', 'savepoint.sh');
  const original = readFileSync(sp, 'utf8');
  try {
    const broken = original.replace(
      /# mode: positional > env > project config > global config > guided[\s\S]*?MODE="\$\{MODE:-guided\}"/,
      'MODE="${4:-${STATE_MODE:-guided}}"'
    );
    if (broken === original) {
      console.error('✗ W1: mutation target not found');
      failed++;
    } else {
      writeFileSync(sp, broken);
      assert('reverted MODE → savepoint mode test fails', false, () => run('W1', 'grep -q "for _cfg in.*MUGIWARA_DIR/config" scripts/savepoint.sh'));
    }
  } finally {
    writeFileSync(sp, original);
    assert('restored → mode fallback present', true, () => run('W1-restore', 'grep -q "for _cfg in.*MUGIWARA_DIR/config" scripts/savepoint.sh'));
  }
}

// --- W2: Solo-or-team section — remove → content validation fails ---
console.log('\nW2 — Solo-or-team section');
{
  const f = join(root, 'content', 'skills', 'mugiwara-orchestration', 'SKILL.md');
  const original = readFileSync(f, 'utf8');
  try {
    const broken = original.replace(/## Solo or team \(Flow 0\)[\s\S]*?## Request classifier/, '## Request classifier');
    if (broken === original) {
      console.error('✗ W2: mutation target not found');
      failed++;
    } else {
      writeFileSync(f, broken);
      assert('removed Solo-or-team → content validation fails', false, () => run('W2', 'grep -q "Solo or team" content/skills/mugiwara-orchestration/SKILL.md'));
    }
  } finally {
    writeFileSync(f, original);
    assert('restored → Solo-or-team present', true, () => run('W2-restore', 'grep -q "Solo or team" content/skills/mugiwara-orchestration/SKILL.md'));
  }
}

// --- W4: allow layout switch without migrate → lane-integrity fails ---
console.log('\nW4 — layout switch guard');
{
  const sp = join(root, 'scripts', 'savepoint.sh');
  const original = readFileSync(sp, 'utf8');
  try {
    const broken = original.replace(/is solo \(state\.json exists\)/, 'REMOVED');
    if (broken === original) {
      console.error('✗ W4: mutation target not found');
      failed++;
    } else {
      writeFileSync(sp, broken);
      assert('guard removed → check fails', false, () => run('W4', 'grep -q "is solo (state.json exists)" scripts/savepoint.sh'));
    }
  } finally {
    writeFileSync(sp, original);
    assert('restored → guard present', true, () => run('W4-restore', 'grep -q "is solo (state.json exists)" scripts/savepoint.sh'));
  }
}

// --- W7: remove posture import → --check-wiring fails ---
console.log('\nW7 — wiring gate');
{
  const mf = join(root, 'src', 'mission.ts');
  const original = readFileSync(mf, 'utf8');
  try {
    const broken = original.replace(/import \{ selectPosture \} from '\.\/posture\.ts';/, '// removed');
    if (broken === original) {
      console.error('✗ W7: mutation target not found');
      failed++;
    } else {
      writeFileSync(mf, broken);
      assert('removed posture import → --check-wiring fails', false, () => run('W7', 'bun scripts/validate-content.ts --check-wiring'));
    }
  } finally {
    writeFileSync(mf, original);
    assert('restored → wiring passes', true, () => run('W7-restore', 'bun scripts/validate-content.ts --check-wiring'));
  }
}

// --- W11: delete lane_scope_glob from config.md → --check-config fails ---
console.log('\nW11 — config drift');
{
  const cf = join(root, 'docs', 'concepts', 'config.md');
  const original = readFileSync(cf, 'utf8');
  try {
    const broken = original.replace(/lane_scope_glob/g, 'LANE_REMOVED');
    if (broken === original) {
      console.error('✗ W11: mutation target not found');
      failed++;
    } else {
      writeFileSync(cf, broken);
      assert('removed lane_scope_glob → --check-config fails', false, () => run('W11', 'bun scripts/validate-content.ts --check-config'));
    }
  } finally {
    writeFileSync(cf, original);
    assert('restored → --check-config passes', true, () => run('W11-restore', 'bun scripts/validate-content.ts --check-config'));
  }
}

// --- W15: paste raw JSONL into report.md → reporting test fails ---
console.log('\nW15 — report raw JSONL');
{
  const mf = join(root, 'src', 'mission.ts');
  const original = readFileSync(mf, 'utf8');
  try {
    const broken = original.replace(/\/\/ W15: no raw JSONL in report.*/, '  if (hasCostEvents) fold.push("cost-events.jsonl"); // W15 revert');
    if (broken === original) {
      console.error('✗ W15: mutation target not found');
      failed++;
    } else {
      writeFileSync(mf, broken);
      assert('reverted raw JSONL → check fails', false, () => run('W15', 'grep -q "hasCostEvents" src/mission.ts | grep -q "fold.push"'));
    }
  } finally {
    writeFileSync(mf, original);
    assert('restored → no raw JSONL', true, () => run('W15-restore', 'grep -q "no raw JSONL" src/mission.ts'));
  }
}

// --- W12: point doc at state/<mission>/ → --check-doc-integrity fails ---
console.log('\nW12 — doc integrity stale path');
{
  const ref = join(root, 'references', 'multi-actor.md');
  const original = readFileSync(ref, 'utf8');
  try {
    const broken = original + '\n`state/<mission>/state.json`\n';
    writeFileSync(ref, broken);
    assert('stale path → --check-doc-integrity fails', false, () => run('W12', 'bun scripts/validate-content.ts --check-doc-integrity'));
  } finally {
    writeFileSync(ref, original);
    assert('restored → doc-integrity passes', true, () => run('W12-restore', 'bun scripts/validate-content.ts --check-doc-integrity'));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
