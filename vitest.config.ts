import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      // @vitest/coverage-v8 was already a devDependency with nothing wired to
      // it. Run with `npx vitest run --coverage`.
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      // `include` reports every shipped source file, not only the ones a test
      // imported — otherwise an untested module reads as covered by being absent
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // NO global thresholds in this mission. `.mugiwara/config` declares
      // coverage_new=90 / coverage_modified=80, which mugiwara-gates applies
      // to the DIFF; a hard global gate is a separate baseline mission
      // (decision log row 20). Measure and report first.
    },
  },
});
