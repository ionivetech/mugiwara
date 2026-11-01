import { test, expect, spyOn } from 'bun:test';
import { main, MARKERS } from '../scripts/smoke-lifecycle.ts';

test('lifecycle smoke passes for every first-class target', () => {
  const log = spyOn(console, 'log').mockImplementation(() => {});
  try {
    expect(main([])).toBe(0);
    for (const id of Object.keys(MARKERS)) {
      expect(log.mock.calls.flat().join('\n')).toContain(`ok ${id}:`);
    }
  } finally { log.mockRestore(); }
}, 60_000);

test('lifecycle smoke rejects an unknown target', () => {
  const err = spyOn(console, 'error').mockImplementation(() => {});
  try { expect(main(['nope'])).toBe(2); } finally { err.mockRestore(); }
});
