#!/usr/bin/env bash
# scripts/lib/lane-base.sh — LANE_BASE + BUDGET constants, single source of
# truth. Validated by scripts/lane-base.ts against measured content word-sums.
# Change a constant here → run `bun scripts/lane-base.ts`; the gate fails if
# the constant drifts from the honest instruction load (D5).

# LANE_BASE: token estimate for skills/agents loaded in this lane. Derived
# from content word-sums × 1.35 (see scripts/lane-base.ts). spike is a
# resize, not a rise — small base, tiny budget.
LANE_BASE_lean=8421
LANE_BASE_standard=13325
LANE_BASE_full=22016
LANE_BASE_spike=5411

# BUDGET: warn at 1.5×, stop at 3×.
BUDGET_lean=12000
BUDGET_standard=25000
BUDGET_full=50000
BUDGET_spike=3000
