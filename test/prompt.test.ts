// test/prompt.test.ts
import { test, expect } from 'vitest';
import { choose, multiChoose, confirm, type Rl } from '../src/prompt.ts';

function mockRl(answers: string[]): Rl {
  return { question: async () => answers.shift() ?? '' };
}

test('choose returns index, retries on invalid', async () => {
  const rl = mockRl(['9', 'x', '2']);
  const idx = await choose(rl, 'pick', ['a', 'b', 'c']);
  expect(idx).toBe(1);
});

test('multiChoose parses list and all', async () => {
  expect(await multiChoose(mockRl(['1,3']), 'q', ['a', 'b', 'c'])).toEqual([0, 2]);
  expect(await multiChoose(mockRl(['all']), 'q', ['a', 'b'])).toEqual([0, 1]);
});

test('multiChoose dedupes and retries invalid', async () => {
  const rl = mockRl(['0,5', '2,2']);
  expect(await multiChoose(rl, 'q', ['a', 'b', 'c'])).toEqual([1]);
});

test('confirm y/n', async () => {
  expect(await confirm(mockRl(['y']), 'ok?')).toBe(true);
  expect(await confirm(mockRl(['no']), 'ok?')).toBe(false);
  expect(await confirm(mockRl(['']), 'ok?')).toBe(false);
});
