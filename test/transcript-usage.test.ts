import { test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sumTranscriptUsage } from '../src/transcript-usage.ts';

/** Synthetic transcript in the real Claude Code shape: one line per content block, usage repeated per message id. */
export function syntheticTranscript(): string {
  const a = (id: string, usage: Record<string, number>, text = 'SECRET-PROMPT-TEXT') =>
    JSON.stringify({ type: 'assistant', uuid: `u-${id}`, message: { id, role: 'assistant', content: [{ type: 'text', text }], usage } });
  return [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello' } }),
    a('msg_1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500 }),
    a('msg_1', { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500 }), // second block, same response
    a('msg_2', { input_tokens: 5, output_tokens: 50 }),
    'not json at all',
    JSON.stringify({ type: 'system', message: { usage: { input_tokens: 999999, output_tokens: 999999 } } }), // not an assistant turn
  ].join('\n') + '\n';
}

test('sums usage once per message id, cache kept separate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-tu-'));
  try {
    const f = join(dir, 't.jsonl');
    writeFileSync(f, syntheticTranscript());
    expect(sumTranscriptUsage(f)).toEqual({ input_tokens: 15, output_tokens: 150, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('missing, empty, or usage-less transcript → null (never throws)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-tu-'));
  try {
    expect(sumTranscriptUsage(join(dir, 'nope.jsonl'))).toBeNull();
    writeFileSync(join(dir, 'e.jsonl'), '{"type":"user"}\n');
    expect(sumTranscriptUsage(join(dir, 'e.jsonl'))).toBeNull();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
