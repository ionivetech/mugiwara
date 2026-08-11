# Worked Example — Full TDD Task

One task, from failing test to green commit, with real output.

## The plan task

```
Task 3: extract formatDate to shared utils
Files: src/utils/format.ts, src/utils/format.test.ts
Size: S
Steps:
  [ ] Write failing test for formatDate export
  [ ] Implement formatDate
  [ ] Refactor callers to use shared function
  [ ] Commit
Acceptance: npm test -- src/utils/format.test.ts passes
```

## Step 1: Write failing test (RED)

```ts
// src/utils/format.test.ts
import { formatDate } from './format';

describe('formatDate', () => {
  it('formats ISO date to locale string', () => {
    const result = formatDate('2026-08-11T12:00:00Z');
    expect(result).toBe('Aug 11, 2026');
  });

  it('returns "—" for null input', () => {
    expect(formatDate(null)).toBe('—');
  });
});
```

```
$ npm test -- src/utils/format.test.ts
FAIL  src/utils/format.test.ts
  ● formatDate › formats ISO date to locale string
    TypeError: (0, format_1.formatDate) is not a function
```

## Step 2: Implement minimum (GREEN)

```ts
// src/utils/format.ts — add:
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
```

```
$ npm test -- src/utils/format.test.ts
PASS  src/utils/format.test.ts
  ✓ formats ISO date to locale string
  ✓ returns "—" for null input
```

## Step 3: Refactor callers

```ts
// Before: src/components/Invoice.tsx
const date = new Date(invoice.createdAt).toLocaleDateString('en-US', {...});

// After:
import { formatDate } from '@/utils/format';
const date = formatDate(invoice.createdAt);
```

## Step 4: Commit

```
$ git add src/utils/format.ts src/utils/format.test.ts src/components/Invoice.tsx
$ git commit -m "feat: extract formatDate to shared utils

Test-first: wrote failing test, implemented, refactored callers."
```

## What this teaches

1. Test fails **for the right reason** (function doesn't exist), not a typo.
2. Minimum implementation passes the test — no gold-plating.
3. Refactor while green — callers use the shared function.
4. One commit per logical task — not one per micro-step.
