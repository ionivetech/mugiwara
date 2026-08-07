// test/args.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';

test('default command is install', () => {
  assert.equal(parseArgs([]).command, 'install');
});

test('parses commands and flags', () => {
  const r = parseArgs(['install', '--global', '--target', 'claude,opencode', '--type', 'frontend', '--yes']);
  assert.equal(r.command, 'install');
  assert.equal(r.flags.global, true);
  assert.equal(r.flags.target, 'claude,opencode');
  assert.equal(r.flags.type, 'frontend');
  assert.equal(r.flags.yes, true);
});

test('parses uninstall/update/list/dry-run/force/project', () => {
  assert.equal(parseArgs(['uninstall']).command, 'uninstall');
  assert.equal(parseArgs(['update']).command, 'update');
  assert.equal(parseArgs(['list']).command, 'list');
  const r = parseArgs(['install', '--project', './x', '--dry-run', '--force']);
  assert.equal(r.flags.project, './x');
  assert.equal(r.flags.dryRun, true);
  assert.equal(r.flags.force, true);
});

test('help and version', () => {
  assert.equal(parseArgs(['--help']).flags.help, true);
  assert.equal(parseArgs(['--version']).flags.version, true);
});

test('unknown flag throws', () => {
  assert.throws(() => parseArgs(['--nope']), /unknown flag/i);
});

test('flag missing value throws', () => {
  assert.throws(() => parseArgs(['--target']), /missing value/i);
});
