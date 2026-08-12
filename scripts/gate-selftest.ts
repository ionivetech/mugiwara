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
      body += '\n';
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
const usingSkillFile = join(root, 'content', 'skills', 'using-mugiwara', 'SKILL.md');
if (!existsSync(usingSkillFile)) {
  console.log('  ⚠  using-mugiwara not found, skipping');
} else {
  const original = readFileSync(usingSkillFile, 'utf8');
  try {
    // Push budget way past 5500
    const longDesc = 'A'.repeat(6000);
    const broken = original.replace(/description:.*/, `description: ${longDesc}`);
    writeFileSync(usingSkillFile, broken);
    assert('description past budget → exit 1', false, () => run('budget', 'bun scripts/validate-content.ts'));
  } finally {
    writeFileSync(usingSkillFile, original);
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
