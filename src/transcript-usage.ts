// src/transcript-usage.ts — provider-reported token usage from a Claude Code
// session transcript (JSONL). Numbers only: no message content is kept or written.
//
// Shape (verified against real transcripts under ~/.claude/projects): one JSON
// object per line; assistant turns have `type: "assistant"` and
// `message.usage.{input_tokens, output_tokens, cache_read_input_tokens,
// cache_creation_input_tokens}`. One API response is split over several lines
// (one per content block) that repeat the same `message.id` and the same usage,
// so usage is counted once per message id.
import { readFileSync, statSync } from 'node:fs';

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

const MAX_BYTES = 256 * 1024 * 1024; // ponytail: whole-file read; stream if transcripts outgrow this

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Sum usage over a transcript; null when unreadable or it holds no usage rows. Never throws. */
export function sumTranscriptUsage(path: string): TokenUsage | null {
  try {
    if (statSync(path).size > MAX_BYTES) return null;
    const byId = new Map<string, TokenUsage>();
    let anon = 0;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.includes('"usage"')) continue;
      let o: { type?: string; uuid?: string; message?: { id?: string; usage?: Record<string, unknown> } };
      try { o = JSON.parse(line); } catch { continue; }
      const u = o.message?.usage;
      if (o.type !== 'assistant' || !u || typeof u !== 'object') continue;
      byId.set(o.message?.id ?? o.uuid ?? `anon-${anon++}`, {
        input_tokens: n(u.input_tokens),
        output_tokens: n(u.output_tokens),
        cache_read_input_tokens: n(u.cache_read_input_tokens),
        cache_creation_input_tokens: n(u.cache_creation_input_tokens),
      });
    }
    if (!byId.size) return null;
    const total: TokenUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    for (const u of byId.values()) for (const k of Object.keys(total) as (keyof TokenUsage)[]) total[k] += u[k];
    return total;
  } catch {
    return null;
  }
}
