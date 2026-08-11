# Source-Backed Backend — Worked Example

A backend task done with the source-grounding protocol.

## The task

```
Task 2: add rate limiting to POST /api/invite
Files: src/middleware/rate-limit.ts, src/routes/invite.ts
Acceptance: 10 rapid POSTs → 429 on 11th
```

## Step 1: Pin the stack

```bash
$ cat package.json | grep -A2 '"express'
    "express": "^4.21.0",
```

Express 4.21 — use the 4.x docs, not 5.x (unreleased).

## Step 2: Consult the docs

`https://expressjs.com/en/4x/api.html#app.use` — middleware order matters. Rate
limit middleware must run before the route handler.

`https://www.npmjs.com/package/express-rate-limit/v/7.4.0` — `express-rate-limit`
7.4.0 is already in `package.json`. The API:

```ts
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({ windowMs: 60000, max: 10 });
app.use('/api/invite', limiter);
```

## Step 3: Code to the docs (not memory)

```ts
// src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const inviteLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,   // RateLimit-* headers (v7.4+)
  legacyHeaders: false,
  message: { error: 'Too many invites. Try again in a minute.' },
});
```

The `standardHeaders` option was added in v7.2 — not from memory, from docs.

## Step 4: Test (RED → GREEN)

```ts
// Test fails: no rate limit on the route yet
it('returns 429 after 10 rapid invites', async () => {
  for (let i = 0; i < 10; i++) {
    await request(app).post('/api/invite').send({ email: `t${i}@ex.com` });
  }
  const res = await request(app).post('/api/invite').send({ email: 't11@ex.com' });
  expect(res.status).toBe(429);
});
```

## Step 5: Verify

```bash
$ npm test -- rate-limit
PASS  rate-limit.test.ts
  ✓ returns 429 after 10 rapid invites
```

## Citation

`express-rate-limit` v7.4.0, `standardHeaders` option:
https://www.npmjs.com/package/express-rate-limit/v/7.4.0
