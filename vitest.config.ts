import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      // Run with `bun run test:coverage`; `bun run coverage-gate` reads the
      // json-summary this writes.
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      // `include` reports every shipped source file, not only the ones a test
      // imported — otherwise an untested module reads as covered by being absent
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // No GLOBAL threshold by design. `.mugiwara/config` declares
      // coverage_new=90 / coverage_modified=80 and those apply to the files in
      // the DIFF, not to a project-wide number — enforced by
      // `scripts/coverage-gate.ts` (`bun run coverage-gate`, wired into
      // `bun run gate`). A global percentage would let an untested new file
      // hide behind an old well-covered one (decision log row 50).
    },
  },
});
