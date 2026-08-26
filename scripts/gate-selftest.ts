#!/usr/bin/env bun
// scripts/gate-selftest.ts — G2: prove each gate can fail.
// Mutate → assert RED → restore → assert GREEN. Exit 0 when all pass.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, renameSync, unlinkSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(import.meta.dirname, '..');
let passed = 0;
let failed = 0;

function run(name: string, cmd: string): boolean {
  try { execSync(cmd, { cwd: root, stdio: 'pipe', timeout: 60000 }); return true; }
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
    const broken = original.replace(
      /PREV_JSON=\$\(node -e "try\{const fs=require\('fs'\);const s=JSON\.parse\(fs\.readFileSync\(process\.argv\[1\],'utf8'\)\);process\.stdout\.write\(JSON\.stringify\(\{mission:s\.mission\|\|'',lane:s\.lane\|\|'',peak:s\.lane_peak\|\|''\}\)\)\}catch\(e\)\{process\.stdout\.write\('\{\}'\)\}" "\$STATE_FILE" 2>\/dev\/null \|\| true\)/,
      "PREV_JSON=$(node -e \"try{const s=require(process.argv[1]);process.stdout.write(JSON.stringify({mission:s.mission||'',lane:s.lane||'',peak:s.lane_peak||''}))}catch(e){process.stdout.write('{}')}\" \"$STATE_FILE\" 2>/dev/null || true)"
    );
    if (broken === original) {
      console.log('  ⚠  D1 mutation pattern not found — skipping');
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
    const broken = original.replace(
      /lane_rank\(\) \{\n  case "\$1" in\n    direct\) echo 0 ;;[\s\S]*?\n  esac\n\}/,
      'lane_rank() {\n  echo 0\n}'
    );
    if (broken === original) {
      console.log('  ⚠  D2 mutation pattern not found — skipping');
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
    const broken = original.replace(
      /SENSITIVE_PATS=.*/,
      'SENSITIVE_PATS="auth/|payment/|billing/|crypto/|secrets/|\\.env$|config/.*key|migration/|\\.sql$|schema\\.|\\.prisma$|\\.terraform|\\.tf$"'
    );
    if (broken === original) {
      console.log('  ⚠  D3 mutation pattern not found — skipping');
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
    if (broken === live || !live) {
      console.log('  ⚠  D3b: no D3 family tokens found in live SENSITIVE_PATS — skipping');
    } else {
      writeFileSync(patternsFile, original.replace(/SENSITIVE_PATS="[^"]*"/, brokenLine));
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
    const broken = original.replace(
      /LOC_TOKENS=\$\(\( LOC_CHURN \* 12 \)\)/,
      'LOC_TOKENS=$(( LOC_DELTA > 0 ? LOC_DELTA * 12 : 0 ))'
    );
    if (broken === original) {
      console.log('  ⚠  D4 mutation pattern not found — skipping');
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
    const broken = original.replace(
      /# --- continue\/<mission>\/<member>\.json \(D10\): machine-written resume point ---[\s\S]*?\nfi\n\n/,
      '# --- continue writer disabled (D10) ---\n\n'
    );
    if (broken === original) {
      console.log('  ⚠  D10 mutation pattern not found — skipping');
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
