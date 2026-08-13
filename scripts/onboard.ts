#!/usr/bin/env bun
// scripts/onboard.ts — Mugiwara onboarding wizard (10 fixed questions, no network)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const root = join(import.meta.dirname, "..");
const mugiwaraDir = join(root, ".mugiwara");
const configPath = join(mugiwaraDir, "config");

function ask(rl: import("node:readline").Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

async function confirm(rl: import("node:readline").Interface, prompt: string): Promise<boolean> {
  const a = await ask(rl, prompt);
  return a.toLowerCase() === "y" || a.toLowerCase() === "yes";
}

async function pick(
  rl: import("node:readline").Interface,
  prompt: string,
  options: string[],
): Promise<number> {
  while (true) {
    const a = await ask(rl, prompt);
    const n = Number.parseInt(a, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= options.length) return n;
    console.log(`  Enter a number 1–${options.length}`);
  }
}

async function main() {
  // --help / no-tty guard
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: bun scripts/onboard.ts");
    console.log("Runs the Mugiwara onboarding wizard (10 fixed questions).");
    console.log("Writes .mugiwara/config.");
    process.exit(0);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("");
    console.log("╔══════════════════════════════════════╗");
    console.log("║   Mugiwara Onboarding Wizard         ║");
    console.log("╚══════════════════════════════════════╝");
    console.log("");

    // Check for existing config
    if (existsSync(configPath)) {
      const redo = await confirm(
        rl,
        "Existing .mugiwara/config found. Re-onboard? (y/n): ",
      );
      if (!redo) {
        console.log("Onboarding cancelled. Config preserved.");
        process.exit(0);
      }
      console.log("");
    }

    // ---- Phase 1: Project Context ----
    console.log("── Phase 1: Project Context ──");
    console.log("");

    const q1 = await pick(rl, "Q1 — Project type:\n  [1] Web application\n  [2] Mobile application\n  [3] CLI tool\n  [4] Library/SDK\n  [5] Backend service / API\n  [6] Other\n  > ", [
      "Web application",
      "Mobile application",
      "CLI tool",
      "Library/SDK",
      "Backend service / API",
      "Other",
    ]);
    console.log("");

    const q2 = await pick(rl, "Q2 — Primary language:\n  [1] TypeScript\n  [2] JavaScript\n  [3] Python\n  [4] Go\n  [5] Rust\n  [6] Java\n  [7] Other\n  > ", [
      "TypeScript",
      "JavaScript",
      "Python",
      "Go",
      "Rust",
      "Java",
      "Other",
    ]);
    console.log("");

    const q3 = await pick(rl, "Q3 — Team size:\n  [1] Solo\n  [2] 2–5\n  [3] 6–15\n  [4] 16+\n  > ", [
      "Solo",
      "2–5",
      "6–15",
      "16+",
    ]);
    console.log("");

    const q4 = await pick(rl, "Q4 — Git workflow:\n  [1] Trunk-based (feature/{type}-{issue}-{slug})\n  [2] GitFlow (feature/{slug})\n  [3] GitHub Flow (feat/{slug})\n  [4] Other (feature/{slug})\n  > ", [
      "trunk-based",
      "gitflow",
      "github-flow",
      "other",
    ]);
    console.log("");

    const q5 = await pick(rl, "Q5 — CI/CD platform:\n  [1] GitHub Actions\n  [2] GitLab CI\n  [3] CircleCI\n  [4] Jenkins\n  [5] None / manual\n  [6] Other\n  > ", [
      "GitHub Actions",
      "GitLab CI",
      "CircleCI",
      "Jenkins",
      "None / manual",
      "Other",
    ]);
    console.log("");

    // ---- Phase 2: Mugiwara Preferences ----
    console.log("── Phase 2: Mugiwara Preferences ──");
    console.log("");

    const q6 = await pick(rl, "Q6 — Autonomy mode:\n  [1] guided — ask before every wave transition\n  [2] semi — auto-advance through waves, pause on failures\n  [3] auto — full auto-pilot\n  > ", [
      "guided",
      "semi",
      "auto",
    ]);
    console.log("");

    const q8a = await pick(rl, "Q7 — Code review depth:\n  [1] full — breaking-change map, five-axis review, ≤3 cycles\n  [2] standard — five-axis review, 1 cycle\n  [3] quick — diff-only, no caller-map\n  > ", [
      "full",
      "standard",
      "quick",
    ]);
    console.log("");

    const q8b = await pick(rl, "Q8 — Quality check depth:\n  [1] full — format, lint, typecheck, test, build\n  [2] standard — lint, typecheck, test\n  [3] quick — test only\n  > ", [
      "full",
      "standard",
      "quick",
    ]);
    console.log("");

    console.log("Q9 — Test coverage threshold:");
    const q9 = await pick(rl, "  [1] 90/80 — new code 90%, modified 80%\n  [2] 80/70 — new code 80%, modified 70%\n  [3] custom — enter your own values\n  [4] none — 0/0, no coverage enforcement\n  > ", [
      "90/80",
      "80/70",
      "custom",
      "none",
    ]);
    let coverageNew = 90;
    let coverageModified = 80;
    if (q9 === 1) {
      coverageNew = 90;
      coverageModified = 80;
    } else if (q9 === 2) {
      coverageNew = 80;
      coverageModified = 70;
    } else if (q9 === 3) {
      const cNew = await ask(rl, "  Enter coverage threshold for new code (%): ");
      const cMod = await ask(rl, "  Enter coverage threshold for modified code (%): ");
      coverageNew = Number.parseInt(cNew, 10) || 0;
      coverageModified = Number.parseInt(cMod, 10) || 0;
    } else {
      coverageNew = 0;
      coverageModified = 0;
    }
    console.log("");

    const q10 = await pick(rl, "Q10 — Commit style:\n  [1] Conventional Commits (feat:, fix:, chore:, docs:)\n  [2] Semantic (type(scope): message)\n  [3] Free-form\n  > ", [
      "conventional",
      "semantic",
      "free-form",
    ]);
    console.log("");

    // ---- Branch name format ----
    const branchFormats: Record<number, string> = {
      1: "feature/{type}-{issue}-{slug}",
      2: "feature/{slug}",
      3: "feat/{slug}",
      4: "feature/{slug}",
    };
    const branch = branchFormats[q4] || "feature/{slug}";

    // ---- Autonomy mode ----
    const modes: Record<number, string> = { 1: "guided", 2: "semi", 3: "auto" };
    const mode = modes[q6] || "semi";

    // ---- Commit style ----
    const commitStyles: Record<number, string> = { 1: "conventional", 2: "semantic", 3: "free-form" };
    const commit = commitStyles[q10] || "conventional";

    // ---- Review depth ----
    const reviewDepths: Record<number, string> = { 1: "full", 2: "standard", 3: "quick" };
    const reviewDepth = reviewDepths[q8a] || "standard";

    // ---- Quality depth ----
    const qualityDepths: Record<number, string> = { 1: "full", 2: "standard", 3: "quick" };
    const qualityDepth = qualityDepths[q8b] || "standard";

    // ---- Write config ----
    if (!existsSync(mugiwaraDir)) mkdirSync(mugiwaraDir, { recursive: true });

    const config = {
      mode,
      branch,
      coverage_new: coverageNew,
      coverage_modified: coverageModified,
      commit,
      review_depth: reviewDepth,
      quality_depth: qualityDepth,
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

    // ---- Summary ----
    const qLabels: Record<string, Record<number, string>> = {
      project_type: {
        1: "Web application",
        2: "Mobile application",
        3: "CLI tool",
        4: "Library/SDK",
        5: "Backend service / API",
        6: "Other",
      },
      primary_language: {
        1: "TypeScript",
        2: "JavaScript",
        3: "Python",
        4: "Go",
        5: "Rust",
        6: "Java",
        7: "Other",
      },
      team_size: { 1: "Solo", 2: "2–5", 3: "6–15", 4: "16+" },
      git_workflow: { 1: "Trunk-based", 2: "GitFlow", 3: "GitHub Flow", 4: "Other" },
      ci_cd: { 1: "GitHub Actions", 2: "GitLab CI", 3: "CircleCI", 4: "Jenkins", 5: "None", 6: "Other" },
      autonomy_mode: { 1: "guided", 2: "semi", 3: "auto" },
      review_depth: { 1: "full", 2: "standard", 3: "quick" },
      quality_depth: { 1: "full", 2: "standard", 3: "quick" },
      coverage_threshold: { 1: "90/80", 2: "80/70", 3: "custom", 4: "none" },
      commit_style: { 1: "Conventional", 2: "Semantic", 3: "Free-form" },
    };

    console.log("╔══════════════════════════════════════╗");
    console.log("║   Onboarding Complete                ║");
    console.log("╚══════════════════════════════════════╝");
    console.log("");
    console.log("  Project type:     ", qLabels.project_type[q1]);
    console.log("  Primary language: ", qLabels.primary_language[q2]);
    console.log("  Team size:        ", qLabels.team_size[q3]);
    console.log("  Git workflow:     ", qLabels.git_workflow[q4]);
    console.log("  CI/CD:            ", qLabels.ci_cd[q5]);
    console.log("  Autonomy mode:    ", qLabels.autonomy_mode[q6]);
    console.log("  Review depth:     ", qLabels.review_depth[q8a]);
    console.log("  Quality depth:    ", qLabels.quality_depth[q8b]);
    console.log("  Coverage:         ", q9 === 3 ? `${coverageNew}/${coverageModified}` : qLabels.coverage_threshold[q9]);
    console.log("  Commit style:     ", qLabels.commit_style[q10]);
    console.log("");
    console.log(`  Config written:   ${configPath}`);
    console.log("");
  } finally {
    rl.close();
  }
}

main();
