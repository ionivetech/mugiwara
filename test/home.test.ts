import { test, expect } from 'bun:test';
import { homedir } from 'node:os';
import { homeDir } from '../src/home.ts';

test('returns non-empty HOME', () => {
  const prev = process.env.HOME;
  process.env.HOME = '/tmp/fake-home';
  try {
    expect(homeDir()).toBe('/tmp/fake-home');
  } finally {
    if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
  }
});

test('falls back to os homedir when HOME is empty', () => {
  const prev = process.env.HOME;
  process.env.HOME = '   ';
  try {
    expect(homeDir()).toBe(homedir());
  } finally {
    if (prev === undefined) delete process.env.HOME; else process.env.HOME = prev;
  }
});
