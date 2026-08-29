// test/scope.test.ts
// Phase 4 Scope & Code Governor — src/scope.ts unit tests.
// Seven verdict capabilities (§51 Phase 4): scope drift detection, existing-code
// reuse checks, abstraction justification, dependency justification, minimum
// sufficient implementation policy, code waste detection, and change-surface
// measurement — plus recordScopeDecision (→ recordOptDecision §41, scope-governor
// actor). Every verdict family is a pure function with exact-value assertions.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectScopeDrift,
  checkExistingCodeReuse,
  evaluateAbstraction,
  evaluateDependency,
  minimumSufficientCheck,
  detectCodeWaste,
  measureChangeSurface,
  recordScopeDecision,
} from '../src/scope.ts';

describe('detectScopeDrift — scope drift detection (§14/§51-1)', () => {
  it('all files within declared_scope → drift:false, scope_score:0', () => {
    const r = detectScopeDrift({
      change: 'add scope governor',
      declared_scope: ['scope', 'governor'],
      touched_files: ['src/scope.ts', 'src/governor.ts'],
    });
    expect(r.drift).toBe(false);
    expect(r.scope_score).toBe(0);
    expect(r.reason).toBe('within declared scope');
  });

  it('one file outside → drift:true, scope_score:0.5 (2 files, 1 outside)', () => {
    const r = detectScopeDrift({
      change: 'add scope governor',
      declared_scope: ['scope', 'governor'],
      touched_files: ['src/scope.ts', 'src/README.md'],
    });
    expect(r.drift).toBe(true);
    expect(r.scope_score).toBe(0.5);
  });

  it('outside file name appears in reason', () => {
    const r = detectScopeDrift({
      change: 'add scope governor',
      declared_scope: ['scope'],
      touched_files: ['src/scope.ts', 'src/unrelated.ts'],
    });
    expect(r.drift).toBe(true);
    expect(r.reason).toContain('unrelated.ts');
  });

  it('empty touched_files → scope_score:0, drift:false', () => {
    const r = detectScopeDrift({ change: 'planning only', declared_scope: ['scope'], touched_files: [] });
    expect(r.scope_score).toBe(0);
    expect(r.drift).toBe(false);
  });

  it('reason names every outside file when multiple drift', () => {
    const r = detectScopeDrift({
      change: 'drift everywhere',
      declared_scope: ['scope'],
      touched_files: ['src/scope.ts', 'a.ts', 'b.ts'],
    });
    expect(r.scope_score).toBeCloseTo(2 / 3);
    expect(r.reason).toContain('a.ts');
    expect(r.reason).toContain('b.ts');
  });
});

describe('checkExistingCodeReuse — existing-code reuse checks (§14/§51-2)', () => {
  const base = {
    change: 'add date formatter',
    existing_symbol: false,
    existing_component: false,
    existing_utility: false,
    existing_module: false,
    local_modification_viable: true,
  };

  it('existing_utility + local_modification_viable → reuse:true', () => {
    const r = checkExistingCodeReuse({ ...base, existing_utility: true });
    expect(r.reuse).toBe(true);
    expect(r.reason).toContain('existing');
  });

  it('existing_component + viable → reuse:true', () => {
    const r = checkExistingCodeReuse({ ...base, existing_component: true });
    expect(r.reuse).toBe(true);
  });

  it('existing_symbol but NOT viable → reuse:false, reason contains "not viable"', () => {
    const r = checkExistingCodeReuse({ ...base, existing_symbol: true, local_modification_viable: false });
    expect(r.reuse).toBe(false);
    expect(r.reason).toContain('not viable');
  });

  it('no existing_* → reuse:false, reason contains "no existing"', () => {
    const r = checkExistingCodeReuse(base);
    expect(r.reuse).toBe(false);
    expect(r.reason).toContain('no existing');
  });

  it('existing_* with viable false never returns reuse:true', () => {
    const r = checkExistingCodeReuse({
      ...base,
      existing_symbol: true,
      existing_utility: true,
      existing_module: true,
      local_modification_viable: false,
    });
    expect(r.reuse).toBe(false);
  });
});

describe('evaluateAbstraction — abstraction justification (§15/§51-3)', () => {
  const base = {
    abstraction: 'handler factory',
    used_in_places: 1,
    reduces_duplication: false,
    required_by_contract: false,
    speculative: false,
  };

  it('used_in_places:2 + reduces_duplication → justified:true', () => {
    const r = evaluateAbstraction({ ...base, used_in_places: 2, reduces_duplication: true });
    expect(r.justified).toBe(true);
    expect(r.reason).toContain('2');
  });

  it('required_by_contract → justified:true regardless of use count', () => {
    const r = evaluateAbstraction({ ...base, required_by_contract: true });
    expect(r.justified).toBe(true);
  });

  it('speculative → justified:false', () => {
    const r = evaluateAbstraction({ ...base, speculative: true, used_in_places: 5, reduces_duplication: true });
    expect(r.justified).toBe(false);
    expect(r.reason).toContain('speculative');
  });

  it('single-use no-contract no-dup → justified:false', () => {
    const r = evaluateAbstraction(base);
    expect(r.justified).toBe(false);
  });

  it('use_count echoes input exactly', () => {
    const r = evaluateAbstraction({ ...base, used_in_places: 7, reduces_duplication: true });
    expect(r.use_count).toBe(7);
  });

  it('used_in_places:2 but no duplication benefit → justified:false', () => {
    const r = evaluateAbstraction({ ...base, used_in_places: 2, reduces_duplication: false });
    expect(r.justified).toBe(false);
  });
});

describe('evaluateDependency — dependency justification (§16/§51-4)', () => {
  const base = {
    dependency: 'luxon',
    equivalent_available: false,
    solvable_with_existing: false,
    long_term_value: true,
    maintenance_cost: 10,
    removed_cost: 10,
  };

  it('all four §16 conditions → justified:true', () => {
    const r = evaluateDependency(base);
    expect(r.justified).toBe(true);
  });

  it('equivalent_available → justified:false, reason names it', () => {
    const r = evaluateDependency({ ...base, equivalent_available: true });
    expect(r.justified).toBe(false);
    expect(r.reason).toMatch(/equivalent/);
  });

  it('solvable_with_existing → justified:false', () => {
    const r = evaluateDependency({ ...base, solvable_with_existing: true });
    expect(r.justified).toBe(false);
    expect(r.reason).toMatch(/existing/);
  });

  it('no long-term value → justified:false', () => {
    const r = evaluateDependency({ ...base, long_term_value: false });
    expect(r.justified).toBe(false);
    expect(r.reason).toMatch(/long-term/);
  });

  it('maintenance_cost > removed_cost → justified:false', () => {
    const r = evaluateDependency({ ...base, maintenance_cost: 20, removed_cost: 10 });
    expect(r.justified).toBe(false);
    expect(r.reason).toMatch(/maintenance/);
  });

  it('maintenance_cost <= removed_cost still justified', () => {
    const r = evaluateDependency({ ...base, maintenance_cost: 10, removed_cost: 20 });
    expect(r.justified).toBe(true);
  });

  it('reason names the first failing clause', () => {
    const r = evaluateDependency({ ...base, equivalent_available: true, solvable_with_existing: true });
    expect(r.reason).toMatch(/equivalent/);
  });
});

describe('minimumSufficientCheck — minimum sufficient implementation (§15/§38/§51-5)', () => {
  const base = {
    change: 'add config loader',
    necessary_complexity: 4,
    incidental_complexity: 0,
    verifiable: true,
    coverage_satisfied: true,
  };

  it('!verifiable → status:"under", sufficient:false', () => {
    const r = minimumSufficientCheck({ ...base, verifiable: false });
    expect(r.status).toBe('under');
    expect(r.sufficient).toBe(false);
    expect(r.reason).toMatch(/verif/);
  });

  it('!coverage_satisfied → status:"under", sufficient:false', () => {
    const r = minimumSufficientCheck({ ...base, coverage_satisfied: false });
    expect(r.status).toBe('under');
    expect(r.sufficient).toBe(false);
    expect(r.reason).toMatch(/coverage/);
  });

  it('incidental_complexity:5 → status:"over", sufficient:false', () => {
    const r = minimumSufficientCheck({ ...base, incidental_complexity: 5 });
    expect(r.status).toBe('over');
    expect(r.sufficient).toBe(false);
    expect(r.reason).toMatch(/incidental/);
  });

  it('necessary:10 + incidental:0 + verifiable + coverage → status:"sufficient"', () => {
    const r = minimumSufficientCheck({ ...base, necessary_complexity: 10 });
    expect(r.status).toBe('sufficient');
    expect(r.sufficient).toBe(true);
  });

  it('necessary complexity is not penalized (not minimum-LOC at quality expense)', () => {
    const r = minimumSufficientCheck({ ...base, necessary_complexity: 30 });
    expect(r.status).toBe('sufficient');
    expect(r.sufficient).toBe(true);
  });
});

describe('detectCodeWaste — code waste detection (§15/§51-6)', () => {
  const base = {
    change: 'refactor handlers',
    unnecessary_helper: false,
    unnecessary_abstraction: false,
    unnecessary_wrapper: false,
    unnecessary_interface: false,
    unnecessary_config: false,
    unnecessary_dependency: false,
    unnecessary_generated_code: false,
    unnecessary_refactor: false,
  };

  it('one true flag → waste:true, waste_types equals that one name', () => {
    const r = detectCodeWaste({ ...base, unnecessary_wrapper: true });
    expect(r.waste).toBe(true);
    expect(r.waste_types).toEqual(['wrapper']);
    expect(r.reason).toContain('wrapper');
  });

  it('multiple true flags → all named', () => {
    const r = detectCodeWaste({ ...base, unnecessary_helper: true, unnecessary_interface: true, unnecessary_config: true });
    expect(r.waste).toBe(true);
    expect(r.waste_types).toEqual(['helper', 'interface', 'config']);
  });

  it('none → waste:false, waste_types:[]', () => {
    const r = detectCodeWaste(base);
    expect(r.waste).toBe(false);
    expect(r.waste_types).toEqual([]);
    expect(r.reason).toContain('no code waste');
  });

  it('every §15 waste type is detected', () => {
    const r = detectCodeWaste({
      change: 'everything',
      unnecessary_helper: true,
      unnecessary_abstraction: true,
      unnecessary_wrapper: true,
      unnecessary_interface: true,
      unnecessary_config: true,
      unnecessary_dependency: true,
      unnecessary_generated_code: true,
      unnecessary_refactor: true,
    });
    expect(r.waste_types).toEqual([
      'helper',
      'abstraction',
      'wrapper',
      'interface',
      'config',
      'dependency',
      'generated code',
      'refactor',
    ]);
  });
});

describe('measureChangeSurface — change-surface measurement (§5.4/§51-7)', () => {
  const base = {
    change: 'add scope governor',
    files_changed: 2,
    loc_added: 100,
    loc_removed: 20,
    new_abstractions: 0,
    new_dependencies: 0,
    new_files: 1,
    generated_boilerplate: 0,
    within_declared_scope: true,
  };

  it('loc_added:100 + loc_removed:20 → loc_changed:120', () => {
    const r = measureChangeSurface(base);
    expect(r.surface.loc_changed).toBe(120);
  });

  it('within_declared_scope + 0 new abstractions/deps → justified:true', () => {
    const r = measureChangeSurface(base);
    expect(r.justified).toBe(true);
    expect(r.reason).toContain('proportional');
  });

  it('new_dependencies:1 → justified:false', () => {
    const r = measureChangeSurface({ ...base, new_dependencies: 1 });
    expect(r.justified).toBe(false);
    expect(r.reason).toMatch(/dependenc/);
  });

  it('new_abstractions:2 → justified:false', () => {
    const r = measureChangeSurface({ ...base, new_abstractions: 2 });
    expect(r.justified).toBe(false);
    expect(r.reason).toMatch(/abstract/);
  });

  it('outside declared scope → justified:false', () => {
    const r = measureChangeSurface({ ...base, within_declared_scope: false });
    expect(r.justified).toBe(false);
    expect(r.reason).toMatch(/scope/);
  });

  it('surface echoes every §5.4 metric field', () => {
    const r = measureChangeSurface(base);
    expect(r.surface).toEqual({
      files_changed: 2,
      loc_added: 100,
      loc_removed: 20,
      loc_changed: 120,
      new_abstractions: 0,
      new_dependencies: 0,
      new_files: 1,
      generated_boilerplate: 0,
      within_declared_scope: true,
    });
  });
});

describe('recordScopeDecision — decision trail (§41)', () => {
  it('writes a single ## Cost governor decisions bullet with scope-governor actor', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-scope-'));
    recordScopeDecision(dir, { decision: 'drift detected', reason: 'unrelated.ts outside scope', evidence: 'E004' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    expect(body.split(/\r?\n/).filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toContain('scope-governor');
    expect(bullets[0]).toContain('drift detected');
    expect(bullets[0]).toContain('reason: unrelated.ts outside scope');
    expect(bullets[0]).toContain('E004');
  });

  it('sanitizes a newline-injected reason (S2 reuse)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-scope-'));
    recordScopeDecision(dir, { decision: 'waste\n## fake', reason: 'a\r\nb' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).not.toContain('\n');
    expect(bullets[0]).not.toContain('\r');
    expect(body.split(/\r?\n/).some((l) => l.trim().startsWith('## fake'))).toBe(false);
  });

  it('creates the mission dir when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-scope-'));
    const nested = join(dir, 'missions', 'demo');
    recordScopeDecision(nested, { decision: 'over-scoped', reason: 'incidental complexity' });
    expect(existsSync(join(nested, 'decisions.md'))).toBe(true);
  });
});
