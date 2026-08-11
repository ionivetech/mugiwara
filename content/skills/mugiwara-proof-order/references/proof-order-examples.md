# Proof Order Examples

The test's proof value comes from WHEN it runs, not that it exists.

## Why order matters

```
❌ Write implementation → Write test → Test passes immediately
   The test never demonstrated it could catch the bug.
   You cannot prove the test is testing the right thing.

✅ Write test (red) → Watch it fail → Write implementation → Test passes (green)
   The red phase proves the test catches the absence of the feature.
   The green phase proves the feature satisfies the test.
```

## Example: password validation

```ts
// RED — test first, watch it fail
describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('short')).toBe(false);
  });
});

// FAIL: validatePassword is not defined

// GREEN — minimal impl
function validatePassword(pw: string): boolean {
  return pw.length >= 8;
}

// REFACTOR — while green
function validatePassword(pw: string): boolean {
  if (pw.length < 8) return false;
  if (!/[A-Z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  return true;
}
```

## Anti-pattern: test after implementation

```ts
// Code already written, then test added later:
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Test passes immediately — proves nothing:
it('formats currency', () => {
  expect(formatCurrency(10)).toBe('$10.00'); // green on first run
});
```

The fix: comment out the implementation, watch the test fail, then uncomment.
If the test still passes with implementation removed, the test is wrong.

## Rule

A test that passes on first run has proven nothing. Discard the implementation and redo test-first, or comment it out and prove the test actually fails before restoring.
