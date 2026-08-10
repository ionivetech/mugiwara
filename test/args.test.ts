// test/args.test.ts
import { test, expect } from 'vitest';
import { parseArgs } from '../src/args.ts';

test('default command is install', () => {
  expect(parseArgs([]).command).toBe('install');
});

test('parses commands and flags', () => {
  const r = parseArgs(['install', '--global', '--target', 'claude,opencode', '--yes']);
  expect(r.command).toBe('install');
  expect(r.flags.global).toBe(true);
  expect(r.flags.target).toBe('claude,opencode');
  expect(r.flags.yes).toBe(true);
});

test('unknown --type flag is rejected', () => {
  expect(() => parseArgs(['--type', 'frontend'])).toThrow(/unknown flag/i);
});

test('parses uninstall/update/list/dry-run/force/project', () => {
  expect(parseArgs(['uninstall']).command).toBe('uninstall');
  expect(parseArgs(['update']).command).toBe('update');
  expect(parseArgs(['list']).command).toBe('list');
  const r = parseArgs(['install', '--project', './x', '--dry-run', '--force']);
  expect(r.flags.project).toBe('./x');
  expect(r.flags.dryRun).toBe(true);
  expect(r.flags.force).toBe(true);
});

test('help and version', () => {
  expect(parseArgs(['--help']).flags.help).toBe(true);
  expect(parseArgs(['--version']).flags.version).toBe(true);
});

test('unknown flag throws', () => {
  expect(() => parseArgs(['--nope'])).toThrow(/unknown flag/i);
});

test('flag missing value throws', () => {
  expect(() => parseArgs(['--target'])).toThrow(/missing value/i);
});
