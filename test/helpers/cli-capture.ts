// In-process run() capture with process.exit mocked — shared by the doctor and
// corrupt-state tests. Spawned subprocesses are not counted by coverage.
import { vi } from 'bun:test';
import { run } from '../../src/cli.ts';

class ExitSignal extends Error { code: number; constructor(c: number) { super(`exit ${c}`); this.code = c; } }

export async function cap(args: string[]): Promise<{ out: string; err: string; code: number }> {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((c: number) => { throw new ExitSignal(c); }) as never);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  let code = 0;
  try { await run(args); } catch (e) { code = e instanceof ExitSignal ? e.code : 99; if (code === 99) errSpy(String(e)); }
  const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  const err = errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  exitSpy.mockRestore(); logSpy.mockRestore(); errSpy.mockRestore();
  return { out, err, code };
}
