# Four-Phase Debugging — Worked Example

A real bug traced end to end through reproduce → localize → reduce → fix + guard.

## The bug report

```
Title: Users see "null" instead of display name on profile page
Severity: medium
Reported: Aug 2026
```

## Phase 1 — Reproduce

```bash
# Create user with no displayName
$ curl -X POST /api/users -d '{"email":"test@ex.com"}'
{"id": "u_42", "email": "test@ex.com"}

# Fetch profile
$ curl /api/users/u_42
{"id": "u_42", "displayName": "null", "email": "test@ex.com"}
```

Expected: `displayName` should be `null` (JSON null) or omitted, not string `"null"`.

## Phase 2 — Localize

```bash
$ git grep -n 'displayName' src/
src/models/user.ts:12:  displayName?: string | null;
src/services/user-profile.ts:34:  return user.displayName ?? 'null';
```

Bug at `src/services/user-profile.ts:34`: `?? 'null'` is the string `"null"`, not the JavaScript `null` value. The default should be `null` or `undefined`.

## Phase 3 — Reduce

```ts
// Before (broken):
return user.displayName ?? 'null'; // string "null"!

// Minimal reproduction:
const result = undefined ?? 'null'; // "null" — this is a string
```

The `??` operator returns the right operand only when the left is `null`/`undefined`. But `'null'` is a truthy string — it's never the `null` value.

## Phase 4 — Fix + Guard

```ts
// Fix:
return user.displayName ?? null; // JSON null

// Guard test:
it('returns null for missing displayName, not string "null"', () => {
  const user = { id: 'u_42', email: 'test@ex.com' };
  const profile = buildProfile(user);
  expect(profile.displayName).toBeNull(); // was: toBe('null')
});
```

```
$ npm test -- user-profile.test.ts
PASS  user-profile.test.ts
  ✓ returns null for missing displayName, not string "null"
```

## Lesson

String `"null"` ≠ JavaScript `null`. The `??` operator with a string default is almost always a bug. Grep the codebase: `git grep "?? '"` to find similar patterns.
