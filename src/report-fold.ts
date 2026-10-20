// src/report-fold.ts
// Builds the archived report.md from a seed (agent-written report or closure
// summary) plus the loose mission files. Reader-first: one title, a short
// plain summary and the verdict, then topic sections in plain sentences. Crew
// names, Flow numbers and tooling-only lines live in a final Evidence appendix
// (tooling in a collapsed block). Pure: no I/O.

export type FoldFile = { name: string; body: string };

export type ReportInput = {
  mission: string;
  /** Existing report.md, or the closure file content when none exists. */
  seed: string;
  /** True when the seed IS flows/NN-closure.md (do not fold it a second time). */
  seedIsClosure: boolean;
  files: FoldFile[];
  /** Plain one-line change summary from state, e.g. "2 files changed (+10 / -3) on branch `x`." */
  changeLine: string;
  /** Full "## Cost" section, or '' when none. */
  cost: string;
  /** Full "Where to start reviewing" section, or '' when none. */
  routing: string;
  /** Tooling-only lines/blocks for the collapsed details block. */
  tooling: string[];
  /** True when state exists: generated Verdict / Decisions / Not verified apply. */
  hasState: boolean;
  /**
   * Plain agent names the review-dispatch ledger records for this mission
   * (see dispatchedAgents). The independence label comes ONLY from this, never
   * from anything written in review.md / security.md.
   */
  dispatched?: string[];
};

type Topic = { title: string; flow: string; crew: string };

/** Stem (no number prefix, no .md) → report topic + where it came from. */
const TOPICS: Record<string, Topic> = {
  spec: { title: 'Spec', flow: '-', crew: '-' },
  todos: { title: 'Tasks', flow: '-', crew: '-' },
  execution: { title: 'Implementation', flow: '3', crew: 'Zoro' },
  audit: { title: 'Audit', flow: '4', crew: 'Chopper' },
  quality: { title: 'Quality', flow: '5', crew: 'Sanji' },
  gates: { title: 'Coverage', flow: '6', crew: 'Franky' },
  security: { title: 'Security', flow: '7', crew: 'Jinbe' },
  review: { title: 'Review', flow: '7', crew: 'Robin' },
  healing: { title: 'Fixes', flow: '8', crew: 'Brook' },
  verifier: { title: 'Verification', flow: '4.5', crew: 'Skeptic' },
  closure: { title: 'Closure', flow: '9', crew: 'Luffy' },
  decisions: { title: 'Decisions', flow: '-', crew: '-' },
  blockers: { title: 'Blockers', flow: '-', crew: '-' },
};

/** Sections whose independence label the machine derives from the dispatch ledger. */
const LABELLED: Record<string, { agent: string; name: string }> = {
  Review: { agent: 'robin-reviewer', name: 'Robin' },
  Security: { agent: 'jinbe-security', name: 'Jinbe' },
};

const ORDER = ['Spec', 'Tasks', 'Implementation', 'Audit', 'Quality', 'Coverage', 'Security', 'Review', 'Fixes', 'Verification', 'Closure'];
const COST_GOV = /^## Cost governor decisions[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m;
const TOOLING_LINE = /^(Context footprint:|Ranked reading order for ).*$/gm;

function topicFor(name: string): Topic {
  const stem = name.replace(/\.md$/, '').replace(/^\d+-/, '');
  const known = TOPICS[stem];
  if (known) return known;
  const words = stem.replace(/[-_]+/g, ' ').trim();
  return { title: words ? words[0].toUpperCase() + words.slice(1) : 'Notes', flow: '-', crew: '-' };
}

/** Drop the leading stage/title heading, demote the rest below the section heading, lift tooling lines out. */
function cleanBody(raw: string, tooling: string[]): string {
  let body = raw.replace(/\r\n/g, '\n').trim();
  for (let i = 0; i < 2; i++) {
    const m = body.match(/^#{1,2} [^\n]*\n*/);
    if (!m) break;
    body = body.slice(m[0].length);
  }
  body = body.replace(TOOLING_LINE, (l) => { tooling.push(l.trim()); return ''; });
  let fence = false;
  body = body.split('\n').map((l) => {
    if (/^```/.test(l)) fence = !fence;
    return !fence && /^#{1,2} /.test(l) ? `#${l}` : l;
  }).join('\n');
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

function parseSeed(seed: string): { title: string | null; intro: string; sections: Array<{ title: string; text: string }> } {
  const lines = seed.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  let title: string | null = null;
  if (/^# /.test(lines[i] ?? '')) { title = lines[i].slice(2).trim(); i++; }
  const parts = lines.slice(i).join('\n').split(/^(?=## )/m);
  const first = parts[0] ?? '';
  const hasHead = !first.startsWith('## ');
  // A "date · actor · branch · lane" meta line is tooling-shaped; the summary replaces it.
  const intro = (hasHead ? first : '').split('\n').filter((l) => !(l.includes(' · ') && /lane/i.test(l))).join('\n').trim();
  const sections = parts.slice(hasHead ? 1 : 0).map((p) => {
    const nl = p.indexOf('\n');
    return { title: (nl === -1 ? p : p.slice(0, nl)).slice(3).trim(), text: nl === -1 ? '' : p.slice(nl + 1).trim() };
  });
  return { title, intro, sections };
}

export function buildReport(o: ReportInput): string {
  const tooling = [...o.tooling];
  const seed = parseSeed(o.seed);
  const seedHas = (t: string) => seed.sections.some((s) => s.title.toLowerCase() === t.toLowerCase());
  const seedSec = (t: string) => seed.sections.find((s) => s.title.toLowerCase() === t.toLowerCase());

  // Group loose files by topic title, keeping file order within a topic.
  const groups = new Map<string, string[]>();
  const evidence: Array<{ title: string; file: string; topic: Topic }> = [];
  for (const f of o.files) {
    const topic = topicFor(f.name);
    if (o.seedIsClosure && topic.title === 'Closure') {
      evidence.push({ title: 'Summary', file: f.name, topic });
      continue;
    }
    let raw = f.body;
    if (topic.title === 'Decisions') {
      const gov = raw.match(COST_GOV);
      if (gov) { tooling.push(gov[0].trim()); raw = raw.replace(COST_GOV, ''); }
    }
    let body = cleanBody(raw, tooling);
    if (!body) continue;
    const who = LABELLED[topic.title];
    if (who) {
      const label = (o.dispatched ?? []).includes(who.agent)
        ? `*Checked independently: ${who.name} ran as a separate agent with fresh context.*`
        : '*Checked inline: the same conversation and model that wrote the change.*';
      body = `${label}\n\n${body}`;
    }
    groups.set(topic.title, [...(groups.get(topic.title) ?? []), body]);
    evidence.push({ title: topic.title, file: f.name, topic });
  }

  const out: string[] = [`# ${seed.title ?? `Mission: ${o.mission}`}`];
  const summary = [seed.intro, o.changeLine].filter(Boolean).join('\n\n');
  if (summary) out.push(summary);

  out.push(`## Verdict\n\n${seedSec('Verdict')?.text || fallbackVerdict(o.files.map((f) => f.body))}`);

  const reserved = new Set(['verdict', 'cost', 'decisions', 'not verified', 'gates', 'review order', 'where to start reviewing']);
  // Seed sections the author wrote (what changed, etc.) keep their place.
  for (const s of seed.sections) {
    if (!reserved.has(s.title.toLowerCase())) out.push(`## ${s.title}\n\n${s.text}`);
  }
  const titles = [...groups.keys()].filter((t) => t !== 'Decisions' && t !== 'Blockers');
  titles.sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib) || a.localeCompare(b);
  });
  for (const t of titles) out.push(`## ${t}\n\n${(groups.get(t) as string[]).join('\n\n')}`);

  const decisions = seedSec('Decisions')?.text ?? (groups.get('Decisions') ?? []).join('\n\n');
  if (decisions) out.push(`## Decisions\n\n${decisions}`);
  else if (o.hasState) out.push('## Decisions\n\nNo decisions recorded.');
  if (groups.has('Blockers')) out.push(`## Blockers\n\n${(groups.get('Blockers') as string[]).join('\n\n')}`);

  const notVerified = seedSec('Not verified')?.text;
  if (notVerified) out.push(`## Not verified\n\n${notVerified}`);
  else if (o.hasState) out.push('## Not verified\n\nNo list of unverified items was recorded. Treat that as unknown, not as "nothing".');

  const seedCost = seedSec('Cost')?.text;
  out.push(seedCost ? `## Cost\n\n${seedCost}` : o.cost.trim());
  const seedOrder = seedSec('Where to start reviewing') ?? seedSec('Review order');
  out.push(seedOrder ? `## ${seedOrder.title}\n\n${seedOrder.text}` : o.routing.trim());

  // Evidence appendix: the only place crew names and Flow numbers appear.
  const ev = ['## Evidence', '', 'Where each part of this report came from. Crew names and Flow numbers appear only here.', '',
    ...(evidence.some((e) => e.title in LABELLED)
      ? ['The Review and Security labels come from a record kept by the tooling, not from the review text. "Checked independently" means that reviewer was started as a separate agent with fresh context. "Checked inline" means the same conversation and model that wrote the change did the check.', ''] : []),
    '| Section | Source file | Flow | Crew |', '|---|---|---|---|'];
  for (const e of evidence) ev.push(`| ${e.title} | \`${e.file}\` | ${e.topic.flow} | ${e.topic.crew} |`);
  if (seedHas('Gates')) ev.push('', '### Gates', '', (seedSec('Gates') as { text: string }).text);
  const log = [...new Set(tooling.map((t) => t.trim()).filter(Boolean))];
  if (log.length) ev.push('', '<details>', '<summary>Tooling log</summary>', '', ...log.flatMap((l) => [l, '']), '</details>');
  out.push(ev.join('\n'));

  return out.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

/**
 * Verdict when the author wrote none. Never claims ready without evidence: a failed
 * gate in the trail wins, and an empty trail says the verdict was not recorded.
 */
function fallbackVerdict(bodies: string[]): string {
  const all = bodies.join('\n');
  if (/\bNO-GO\b|\bneeds fixes\b|\bnot ready\b|^\s*[-*]?\s*\**(verdict|result|status)\**\s*:?\s*\**\s*FAIL/im.test(all)) {
    return '**Needs fixes.** A check in the trail failed. Read the sections below before merging.';
  }
  if (!/\b(PASS|passed|ready for review)\b/i.test(all)) return '**Not enough evidence.** The trail holds no check result, so nothing is claimed as ready.';
  return '**Ready for review.** The recorded checks passed.';
}
