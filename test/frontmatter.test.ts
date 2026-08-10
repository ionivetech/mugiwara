// test/frontmatter.test.ts
import { test, expect } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from '../src/frontmatter.ts';

test('parses flat frontmatter', () => {
  const { data, body } = parseFrontmatter('---\nname: x\ndescription: y z\n---\nBody here\n');
  expect(data.name).toBe('x');
  expect(data.description).toBe('y z');
  expect(body).toBe('Body here\n');
});

test('handles CRLF', () => {
  const { data, body } = parseFrontmatter('---\r\nname: x\r\n---\r\nB\r\n');
  expect(data.name).toBe('x');
  expect(body).toBe('B\r\n');
});

test('throws without fence', () => {
  expect(() => parseFrontmatter('no fence')).toThrow(/frontmatter/i);
});

test('throws on bad line', () => {
  expect(() => parseFrontmatter('---\nno-colon-line\n---\n')).toThrow(/bad frontmatter/i);
});

test('roundtrip', () => {
  const text = stringifyFrontmatter({ name: 'a', description: 'b' }, 'body\n');
  const { data, body } = parseFrontmatter(text);
  expect(data).toEqual({ name: 'a', description: 'b' });
  expect(body).toBe('body\n');
});
