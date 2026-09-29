// test/content-prose.test.ts — prose rules for the crew prompts. Each rule is
// the machine form of a defect this repo shipped; the test names say which.
import { describe, test, expect } from 'bun:test';
import { checkContentProse } from '../src/content-prose.ts';

const F = (text: string) => [{ path: 'x.md', text }];
const run = (text: string) => checkContentProse(F(text));

describe('banner form', () => {
  test('a correct banner passes', () => {
    expect(run('## ⚔️ Flow 3 — Zoro (Execution)')).toEqual([]);
  });

  test('a banner without its crew emoji is flagged', () => {
    expect(run('## Flow 3 — Zoro (Execution)')[0]).toContain('no crew emoji');
  });

  test('a banner without its (Role) suffix is flagged', () => {
    expect(run('## ⚔️ Flow 3 — Zoro')[0]).toContain('no "(Role)" suffix');
  });

  // `## Flow 0 — Triage (always first)` is a section heading. "Triage" is a
  // stage name, not a crew member, so the line is not a banner at all.
  test('a section heading is not mistaken for a banner', () => {
    expect(run('## Flow 0 — Triage (always first)')).toEqual([]);
  });
});

describe('handoff form', () => {
  test('a correct handoff passes', () => {
    expect(run('→ 🩺 Flow 4 — Chopper')).toEqual([]);
  });

  // The role belongs to the banner. An example carrying it on the handoff is
  // how the wrong form spread: the model copies the example, not the rule.
  test('a handoff carrying a role is flagged', () => {
    expect(run('→ 🩺 Flow 4 — Chopper (Checkpoint)')[0]).toContain('carries a role');
  });

  test('a handoff without its emoji is flagged', () => {
    expect(run('→ Flow 4 — Chopper')[0]).toContain('no crew emoji');
  });

  test('the documented return hop is allowed at any flow', () => {
    expect(run('→ 🏴‍☠️ Flow 2 — Luffy (routing)')).toEqual([]);
  });
});

describe('flow-to-crew pairing', () => {
  // src/features.ts advertised ship at Flow 8. Flow 8 is Brook. The same
  // off-by-one is just as easy to write in prose.
  test('a flow paired with the wrong crew is flagged, and names the right one', () => {
    const e = run('## 🏴‍☠️ Flow 8 — Luffy (Ship)')[0];
    expect(e).toContain('Flow 8');
    expect(e).toContain('Brook');
  });

  test('Flow 7 accepts Jinbe as well as Robin', () => {
    expect(run('## 🌊 Flow 7 — Jinbe (Security)')).toEqual([]);
    expect(run('## 📚 Flow 7 — Robin (Review)')).toEqual([]);
  });

  test('a crew name the pipeline does not place there is flagged', () => {
    expect(run('## 🎻 Flow 3 — Brook (Healing)')[0]).toContain('the pipeline runs Zoro there');
  });
});

describe('host-capability coupling', () => {
  // A crew rule named after a host capability depends on something the docs
  // themselves say "varies by host".
  test('naming a host capability in a crew rule is flagged', () => {
    expect(run('Compact output (have-adhd scan-format).')[0]).toContain('have-adhd');
  });

  test('every host name is caught, not just one', () => {
    for (const cap of ['have-adhd', 'anti-stuff', 'anti-fluff', 'just-enough', 'anti-slop']) {
      expect(run(`see ${cap} for the shape`).length, cap).toBe(1);
    }
  });

  test('the allowlist exempts the file that maps the names', () => {
    const files = [{ path: 'references/cost-governor.md', text: 'anti-slop is waste detection' }];
    expect(checkContentProse(files, { hostNameAllowlist: ['references/cost-governor.md'] })).toEqual([]);
  });
});
