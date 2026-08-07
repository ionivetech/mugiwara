// test/frontmatter.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, stringifyFrontmatter } from '../src/frontmatter.js';

test('parses flat frontmatter', () => {
  const { data, body } = parseFrontmatter('---\nname: x\ndescription: y z\n---\nBody here\n');
  assert.equal(data.name, 'x');
  assert.equal(data.description, 'y z');
  assert.equal(body, 'Body here\n');
});

test('handles CRLF', () => {
  const { data, body } = parseFrontmatter('---\r\nname: x\r\n---\r\nB\r\n');
  assert.equal(data.name, 'x');
  assert.equal(body, 'B\r\n');
});

test('throws without fence', () => {
  assert.throws(() => parseFrontmatter('no fence'), /frontmatter/i);
});

test('throws on bad line', () => {
  assert.throws(() => parseFrontmatter('---\nno-colon-line\n---\n'), /bad frontmatter/i);
});

test('roundtrip', () => {
  const text = stringifyFrontmatter({ name: 'a', description: 'b' }, 'body\n');
  const { data, body } = parseFrontmatter(text);
  assert.deepEqual(data, { name: 'a', description: 'b' });
  assert.equal(body, 'body\n');
});
