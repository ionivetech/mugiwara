// test/guards.test.ts — direct unit cover for src/guards.ts (D1).
//
// The hook tests exercise the guard through spawned node processes, so the
// shared predicate module itself read ~0% in-process coverage. These vectors
// pin the table directly: fast, no subprocess, no timeout surface.
import { test, expect } from 'bun:test';
import { checkCommand, refusalMessage, FORBIDDEN } from '../src/guards.ts';

const DENY: Array<[string, string]> = [
  ['gh pr create --fill', 'opening or merging a PR'],
  ['gh pr merge 12', 'opening or merging a PR'],
  ['gh release create v1', 'creating a release'],
  ['git merge feat/x', 'merging a branch'],
  ['git push origin main', 'pushing to a protected branch'],
  ['git push --force origin feat/x', 'force-pushing'],
  ['npm publish', 'publishing a package'],
  ['kubectl apply -f x.yaml', 'changing a cluster'],
  ['terraform apply', 'changing infrastructure'],
  ['docker push img:tag', 'pushing an image'],
  ['aws s3api create-bucket --bucket b', 'changing cloud resources'],
  ['git stash push -m wip', 'stashing away uncommitted work'],
  ['git stash pop', 'stashing away uncommitted work'],
  ['git reset --hard HEAD', 'discarding uncommitted work'],
  ['git clean -fd', 'deleting untracked files'],
  ['git checkout -- src/x.ts', 'discarding uncommitted work'],
];

const ALLOW = [
  'git push -u origin feature/MKR-412',
  'git push -u origin enforcement-gaps',
  'gh pr view 42',
  'terraform plan',
  'git log --oneline',
  'kubectl get pods',
  'git checkout -b feat/x',
  'git commit -m feat(x): y',
  'git status -s',
  'git diff --name-only main..HEAD',
];

test('guards: every forbidden class resolves to its action', () => {
  expect(FORBIDDEN).toHaveLength(14);
  for (const [command, action] of DENY) {
    expect(checkCommand(command), command).toBe(action);
  }
});

test('guards: feature pushes and reads resolve to null', () => {
  for (const command of ALLOW) {
    expect(checkCommand(command), command).toBeNull();
  }
});

test('guards: refusal names the action, the human, and the escape hatch', () => {
  const msg = refusalMessage('opening or merging a PR');
  expect(msg).toContain('opening or merging a PR');
  expect(msg).toContain('human');
  expect(msg).toContain('enforce=off');
});
