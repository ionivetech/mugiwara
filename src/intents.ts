// src/intents.ts — O(1) structural-intent derivation (pure, no IO).
//
// Extracts the inline derivation formerly in `featuresCmd` (src/cli.ts) into
// one unit-testable function. IO (readState/readContinue/rosterSize) stays in
// the caller; this module only folds already-loaded rows + a caller-supplied
// count into a FULL ResolveIntent. Judged intents (tests/vague/bug/gitOp/
// gatesPass/meta) have no O(1) disk signal and stay explicit `false`.
import type { StateEntry, ContinueEntry } from './continue.ts';
import type { ResolveIntent } from './features.ts';

/** Flow number carrying close/archive intent — ship trigger source. */
export const CLOSE_FLOW = 8;

export function deriveStructuralIntents(opts: {
  mission: string;
  states: StateEntry[];
  continues: ContinueEntry[];
  rosterSize: number;
}): ResolveIntent {
  const { mission, states, continues, rosterSize } = opts;
  return {
    close: states.some((s) => s.flow === CLOSE_FLOW),
    tests: false,
    vague: false,
    bug: false,
    gitOp: false,
    failure: states.some((s) => s.heal_cycle > 0 || s.blockers_open > 0),
    gatesPass: false,
    interrupted: continues.some((c) => c.mission === mission && !states.some((s) => s.member === c.member)),
    meta: false,
    rosterSize,
  };
}
