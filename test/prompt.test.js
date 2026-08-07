// test/prompt.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { choose, multiChoose, confirm } from '../src/prompt.js';

function mockRl(answers) {
  return { question: async () => answers.shift() };
}

test('choose returns index, retries on invalid', async () => {
  const rl = mockRl(['9', 'x', '2']);
  const idx = await choose(rl, 'pick', ['a', 'b', 'c']);
  assert.equal(idx, 1);
});

test('multiChoose parses list and all', async () => {
  assert.deepEqual(await multiChoose(mockRl(['1,3']), 'q', ['a', 'b', 'c']), [0, 2]);
  assert.deepEqual(await multiChoose(mockRl(['all']), 'q', ['a', 'b']), [0, 1]);
});

test('multiChoose dedupes and retries invalid', async () => {
  const rl = mockRl(['0,5', '2,2']);
  assert.deepEqual(await multiChoose(rl, 'q', ['a', 'b', 'c']), [1]);
});

test('confirm y/n', async () => {
  assert.equal(await confirm(mockRl(['y']), 'ok?'), true);
  assert.equal(await confirm(mockRl(['no']), 'ok?'), false);
  assert.equal(await confirm(mockRl(['']), 'ok?'), false);
});
