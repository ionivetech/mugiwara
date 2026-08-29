// src/posture.ts
// Mugiwara Phase B — deterministic posture selection matrix. Maps existing
// lane/risk/dependency/context/governor inputs to an execution posture with a
// concrete reason + evidence refs — never an opaque score. Pure, testable.
//
// Posture is independent of control mode (guided/semi/auto). The governor's
// verdict can pause but never silently changes mode or crew roles.

export type Posture =
  | 'inline-sequential'
  | 'inline-batched'
  | 'parallel-workers'
  | 'context-relief'
  | 'phase-isolated'
  | 'team-scoped';

export type GovernorVerdict = 'normal' | 'avoid' | 'stop';

export type PostureInput = {
  lane: 'direct' | 'lean' | 'standard' | 'full' | 'spike';
  risk: 'low' | 'medium' | 'high';
  independent_tasks: number;
  order_dependent: boolean;
  context_pressure: boolean;
  team_members: number;
  phases: number;
  plan_lines: number;
  governor: GovernorVerdict;
};

export type PostureResult = {
  posture: Posture;
  pause: boolean;
  reason: string;
  evidence_refs: string[];
};

export function selectPosture(input: PostureInput): PostureResult {
  // stop verdict → safe pause, keep prior topology (recorded, never silent)
  if (input.governor === 'stop') {
    return {
      posture: 'inline-sequential',
      pause: true,
      reason: 'governor stop — pause safely, keep inline; state + continue emitted',
      evidence_refs: ['governor circuit-breaker', 'state.json'],
    };
  }
  if (input.team_members > 1) {
    return {
      posture: 'team-scoped',
      pause: false,
      reason: `${input.team_members} team members with non-overlapping scope`,
      evidence_refs: ['plan ownership map'],
    };
  }
  if (input.phases > 3 || input.plan_lines > 1500) {
    return {
      posture: 'phase-isolated',
      pause: false,
      reason: `large campaign — ${input.phases} phases / ${input.plan_lines} lines`,
      evidence_refs: ['plan.md', 'large-campaign-subplan.md'],
    };
  }
  if (input.context_pressure && input.order_dependent) {
    return {
      posture: 'context-relief',
      pause: false,
      reason: 'context pressure with ordered dependent tasks — one worker at a time, order preserved',
      evidence_refs: ['state context metrics', 'remaining task order'],
    };
  }
  if (input.independent_tasks >= 2) {
    return {
      posture: 'parallel-workers',
      pause: false,
      reason: `${input.independent_tasks} independent tasks, no shared files/interfaces`,
      evidence_refs: ['Nami dependency map', 'work-governor delegation verdict'],
    };
  }
  return {
    posture: 'inline-sequential',
    pause: false,
    reason: 'no parallel/phase/team/relief trigger — default inline in plan order',
    evidence_refs: ['triage route', 'lane'],
  };
}
