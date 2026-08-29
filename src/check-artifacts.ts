// src/check-artifacts.ts
// Mission artifact gate (roadmap v0.8 item 4): every Lane 2+ mission must
// carry its evidence trail — plan.md (the contract) and flows/* execution
// evidence — or the archive refuses to fold, same as the secret gate.
// Lane 0/1 missions are audit-lite: no plan/flows required.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ArtifactCheck {
  ok: boolean;
  missing: string[];
  lane: string | null;
}

const LANE_MIN = new Set(['standard', 'full', 'spike']);

/** Lane 2+ (standard/full/spike) missions require the evidence trail. */
export function checkMissionArtifacts(missionDir: string): ArtifactCheck {
  const statePath = join(missionDir, 'state.json');
  if (!existsSync(statePath)) {
    // archived mission (report.md survives, state folded away) — nothing to check
    return { ok: true, missing: [], lane: null };
  }
  let lane = 'unknown';
  try {
    const s = JSON.parse(readFileSyncSafe(statePath)) as Record<string, unknown>;
    if (typeof s.lane === 'string') lane = s.lane;
  } catch { /* unreadable state → treat as unknown lane */ }

  if (!LANE_MIN.has(lane)) {
    return { ok: true, missing: [], lane }; // audit-lite lanes pass without trail
  }

  const missing: string[] = [];
  if (!existsSync(join(missionDir, 'plan.md'))) missing.push('plan.md');
  const flowsDir = join(missionDir, 'flows');
  const hasFlows = existsSync(flowsDir) && readdirSync(flowsDir).length > 0;
  if (!hasFlows) missing.push('flows/ (no execution evidence)');

  return { ok: missing.length === 0, missing, lane };
}

function readFileSyncSafe(p: string): string {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}
