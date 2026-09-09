// test/bun-vitest-compat.d.ts
//
// Vitest-style options-object-as-second-argument overloads for bun:test.
// bun:test's runtime accepts `test('name', { timeout }, fn)` (it parses an
// options object wherever it sits), but bun-types only declares the options
// on the THIRD argument. The test suite was ported from vitest and kept the
// vitest call shape, so tsc rejected every `{ timeout }`-second-argument call
// with TS2353. These augmentations teach tsc the vitest forms without editing
// ~140 call sites. See docs/test/mocks.mdx (vi alias) + test.d.ts (Test).
export {};

declare module "bun:test" {
  interface Test<T extends ReadonlyArray<unknown>> {
    (
      label: string,
      options: TestOptions,
      fn: (...args: unknown[]) => void | Promise<unknown>,
    ): void;
  }

  interface Expect {
    /**
     * Assert that the test fails at this point, equivalent to vitest's
     * `expect.fail(message)` — throws so the test reports as failed.
     */
    fail(message?: string): never;
  }
}
