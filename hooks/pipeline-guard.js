#!/usr/bin/env node
// @bun

// hooks/pipeline-guard.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readFileSync as readFileSync3, readdirSync as readdirSync2, statSync as statSync2, lstatSync as lstatSync2, writeFileSync as writeFileSync2 } from "fs";
import { execFileSync } from "child_process";
import { homedir as homedir2 } from "os";
import { dirname as dirname2, join as join4 } from "path";
import { spawnSync as spawnSync2 } from "child_process";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/run.ts
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var here = dirname(fileURLToPath(import.meta.url));
var SCRIPTS_DIR = join(here, "..", "scripts");
function findBash() {
  const explicit = process.env.MUGIWARA_BASH?.trim();
  if (explicit)
    return existsSync(explicit) ? explicit : null;
  const candidates = process.platform === "win32" ? [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "bin", "bash.exe")
  ] : ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash", "/opt/homebrew/bin/bash"];
  for (const p of candidates) {
    if (p && existsSync(p))
      return p;
  }
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["bash"], {
    encoding: "utf8"
  });
  const first = probe.stdout?.split(/\r?\n/).find((l) => l.trim());
  return first?.trim() || null;
}

// src/config.ts
import { existsSync as existsSync2, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// src/home.ts
import { homedir } from "node:os";
function homeDir() {
  if (process.platform !== "win32") {
    const h = process.env.HOME?.trim();
    if (h)
      return h;
  }
  return homedir();
}

// src/config.ts
import { join as join2 } from "node:path";
var DEFAULT_CONFIG = [
  "mode=guided",
  "verbosity=normal",
  "branch=feature/{type}-{issue}-{slug}",
  "commit=conventional",
  "auto_commit=off",
  "coverage=85",
  "review_depth=full",
  "quality_depth=full",
  "delegate_threshold=60",
  "heal_max_cycles=3",
  "independent_review=on",
  "# lane_scope_glob=packages/api/**",
  "# context_budget_chars=150000",
  "# team=off",
  "# sign=auto",
  "# features=core+auto",
  "# enforce=warn"
].join(`
`) + `
`;
function configPaths(projectDir) {
  return [join2(projectDir, ".mugiwara", "config"), join2(homeDir(), ".mugiwara", "config")];
}
function readConfig(projectDir) {
  const out = {};
  for (const file of configPaths(projectDir)) {
    if (!existsSync2(file))
      continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#"))
        continue;
      const eq = t.indexOf("=");
      if (eq === -1)
        continue;
      const key = t.slice(0, eq).trim();
      if (!key)
        continue;
      if (key in out)
        continue;
      let rawVal = t.slice(eq + 1).trim();
      const hash = rawVal.indexOf("#");
      if (hash !== -1)
        rawVal = rawVal.slice(0, hash).trim();
      out[key] = rawVal;
    }
  }
  return out;
}

// src/active-mission.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, readdirSync, statSync } from "node:fs";
import { join as join3 } from "node:path";
var SAFE = /^[A-Za-z0-9._-]+$/;
var REVIEW_LEDGER = "review-dispatch.jsonl";
function dispatchedAgents(cwd, mission) {
  const out = new Set;
  if (!mission)
    return out;
  try {
    const file = join3(cwd, ".mugiwara", REVIEW_LEDGER);
    if (!existsSync3(file))
      return out;
    for (const line of readFileSync2(file, "utf8").split(/\r?\n/)) {
      if (!line.trim())
        continue;
      try {
        const e = JSON.parse(line);
        if (e.mission === mission && typeof e.agent === "string")
          out.add(e.agent);
      } catch {}
    }
  } catch {}
  return out;
}
function closingPending(cwd) {
  const base = join3(cwd, ".mugiwara", "missions");
  let best = null;
  try {
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
        continue;
      const dir = join3(base, e.name);
      const files = readdirSync(dir);
      const live = files.some((f) => f.endsWith(".json") && f !== "continue.json" && !f.startsWith("continue-"));
      if (!live || files.includes("report.md"))
        continue;
      const marks = ["06-closure.md", "07-pr-verdict.md"].map((f) => join3(dir, "flows", f)).filter((f) => existsSync3(f));
      if (!marks.length)
        continue;
      const at = Math.max(...marks.map((f) => statSync(f).mtimeMs));
      if (!best || at > best.at)
        best = { name: e.name, at };
    }
  } catch {}
  return best?.name ?? null;
}

// src/risk.ts
var RISK_WORDS = new RegExp("\\b(" + [
  "auth\\w*",
  "log[- ]?in",
  "sign[- ]?in",
  "password\\w*",
  "credential\\w*",
  "secrets?",
  "tokens?",
  "rbac",
  "roles?",
  "permissions?",
  "tenant\\w*",
  "multi-tenant",
  "payments?",
  "billing",
  "refund\\w*",
  "invoices?",
  "migrat\\w+",
  "schema",
  "ci/cd",
  "github actions",
  "izin",
  "hak akses",
  "otorisasi",
  "autentikasi",
  "masuk akun",
  "pembayaran",
  "penagihan",
  "pengembalian dana",
  "kata sandi",
  "sandi",
  "rahasia",
  "kunci api",
  "penyewa",
  "migrasi",
  "skema"
].join("|") + ")\\b", "i");
var RISK_PATH_PARTS = new Set(["auth", "payment", "payments", "billing", "migration", "migrations", "rbac", "permission", "permissions", "secret", "secrets"]);
function reviewNextStep(mission, ran = new Set) {
  const todo = [["robin-reviewer", "Robin"], ["jinbe-security", "Jinbe"]].filter(([a]) => !ran.has(a)).map(([a, n]) => `${n} (${a})`);
  return `Next step: start ${todo.length ? todo.join(" and ") : "the reviewers"} as separate agents for mission "${mission}", then run \`mugiwara archive ${mission}\`.`;
}

// hooks/pipeline-guard.ts
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var MARKER_TTL_MS = 12 * 60 * 60 * 1000;
function readEnforce() {
  for (const base of [cwd, homedir2()]) {
    if (!base)
      continue;
    const file = join4(base, ".mugiwara", "config");
    if (!existsSync4(file))
      continue;
    for (const line of readFileSync3(file, "utf8").split(/\r?\n/)) {
      const [k, v] = line.split("=").map((s) => s.trim());
      if (k !== "enforce")
        continue;
      if (v === "off" || v === "warn" || v === "block")
        return v;
      process.stderr.write(`mugiwara: unknown enforce="${v}" in ${file}, using "warn"
`);
      return "warn";
    }
  }
  return "warn";
}
function countForcedContinuation() {
  try {
    const file = join4(cwd, ".mugiwara", ".forced-continuations");
    const prev = existsSync4(file) ? Number(readFileSync3(file, "utf8").trim()) : 0;
    mkdirSync2(join4(cwd, ".mugiwara"), { recursive: true });
    writeFileSync2(file, `${(Number.isInteger(prev) && prev > 0 ? prev : 0) + 1}
`);
  } catch {}
}
function engaged(sessionId) {
  const file = join4(cwd, ".mugiwara", ".engaged");
  if (!existsSync4(file))
    return false;
  try {
    const m = JSON.parse(readFileSync3(file, "utf8"));
    if (sessionId && m.session_id)
      return m.session_id === sessionId;
    const touched = Date.parse(m.touched_at ?? "") || 0;
    return Date.now() - touched < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function sourceChanged(ignoreInstallNoise = false) {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split(/\r?\n/).map((l) => l.slice(3).trim()).filter(Boolean).some((p) => !p.startsWith(".mugiwara/") && !(ignoreInstallNoise && /^(\.claude\/|\.opencode\/|\.gitignore$)/.test(p)));
  } catch {
    return false;
  }
}
function sessionStartFrom(markerFile) {
  try {
    const m = JSON.parse(readFileSync3(markerFile, "utf8"));
    return Date.parse(m.first_seen ?? "") || Date.parse(m.touched_at ?? "") || 0;
  } catch {
    return 0;
  }
}
function artifactWorkNow() {
  const markerFile = join4(cwd, ".mugiwara", ".engaged");
  if (!existsSync4(markerFile))
    return false;
  const sessionStart = sessionStartFrom(markerFile);
  if (!sessionStart)
    return false;
  try {
    const stack = ["missions", "spec", "plans"].map((s) => join4(cwd, ".mugiwara", s)).filter((p) => existsSync4(p));
    while (stack.length) {
      const cur = stack.pop();
      for (const e of readdirSync2(cur, { withFileTypes: true })) {
        const full = join4(cur, e.name);
        try {
          if (e.isSymbolicLink())
            continue;
          if (e.isDirectory()) {
            stack.push(full);
            continue;
          }
          if (statSync2(full).mtimeMs + 1000 >= sessionStart)
            return true;
        } catch {}
      }
    }
  } catch {
    return false;
  }
  return false;
}
function newestMissionState() {
  const base = join4(cwd, ".mugiwara", "missions");
  if (!existsSync4(base))
    return null;
  let best = null;
  let bestAt = -1;
  try {
    for (const e of readdirSync2(base, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      for (const f of readdirSync2(join4(base, e.name))) {
        const stem = f.replace(/\.json$/, "");
        if (!f.endsWith(".json") || stem === "continue" || stem.startsWith("continue-"))
          continue;
        const p = join4(base, e.name, f);
        try {
          const s = JSON.parse(readFileSync3(p, "utf8"));
          if (typeof s.mission !== "string" || !s.mission)
            continue;
          const at = statSync2(p).mtimeMs;
          if (at <= bestAt)
            continue;
          bestAt = at;
          best = { mission: s.mission, lane: typeof s.lane === "string" ? s.lane : "", dir: e.name, sensitive: Array.isArray(s.sensitive_paths) && s.sensitive_paths.length > 0 };
        } catch {}
      }
    }
  } catch {}
  return best;
}
var LANE_RANK = { direct: 0, lean: 1, standard: 2, full: 3, spike: 4 };
function executorDispatched(sessionId) {
  const file = join4(cwd, ".mugiwara", ".engaged");
  if (!existsSync4(file))
    return false;
  try {
    const m = JSON.parse(readFileSync3(file, "utf8"));
    const at = Date.parse(m.executor_dispatched_at ?? "") || 0;
    if (!at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function plannerDispatched(sessionId) {
  const file = join4(cwd, ".mugiwara", ".engaged");
  if (!existsSync4(file))
    return false;
  try {
    const m = JSON.parse(readFileSync3(file, "utf8"));
    const at = Date.parse(m.planner_dispatched_at ?? "") || 0;
    if (!at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function planTouched() {
  const missionsDir = join4(cwd, ".mugiwara", "missions");
  if (!existsSync4(missionsDir))
    return false;
  const markerFile = join4(cwd, ".mugiwara", ".engaged");
  if (!existsSync4(markerFile))
    return false;
  let sessionStart = 0;
  try {
    const m = JSON.parse(readFileSync3(markerFile, "utf8"));
    sessionStart = Date.parse(m.first_seen ?? "") || 0;
  } catch {}
  if (!sessionStart)
    return false;
  try {
    for (const e of readdirSync2(missionsDir, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      const plan = join4(missionsDir, e.name, "plan.md");
      if (!existsSync4(plan))
        continue;
      const at = lstatSync2(plan).mtimeMs;
      if (at + 1000 >= sessionStart)
        return true;
    }
  } catch {}
  return false;
}
var TRANSCRIPT_BANNER_RE = /## .*Flow (\d+)\s*\u2014/g;
var CREW_BANNER_RE = /## \S+ (?:Luffy|Nami|Usopp|Zoro|Chopper|Sanji|Franky|Robin|Jinbe|Brook|Skeptic) \u00B7 [^\n"]*?\((\d+)\/\d+\)/g;
function extractBannerFlow(text) {
  let best = 0;
  for (const re of [TRANSCRIPT_BANNER_RE, CREW_BANNER_RE]) {
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > best)
        best = n;
    }
  }
  return best;
}
function recordBannerFlow(flow, sessionId) {
  const file = join4(cwd, ".mugiwara", ".engaged");
  try {
    const prev = existsSync4(file) ? JSON.parse(readFileSync3(file, "utf8")) : {};
    const sameSession = !sessionId || typeof prev.session_id !== "string" || prev.session_id === sessionId;
    if (!sameSession)
      return;
    writeFileSync2(file, JSON.stringify({
      ...prev,
      touched_at: new Date().toISOString(),
      last_banner_flow: flow,
      last_banner_flow_at: new Date().toISOString()
    }, null, 2) + `
`);
  } catch {}
}
function bannerRecorded(sessionId) {
  const file = join4(cwd, ".mugiwara", ".engaged");
  if (!existsSync4(file))
    return false;
  try {
    const m = JSON.parse(readFileSync3(file, "utf8"));
    if (typeof m.last_banner_flow !== "number" || !m.last_banner_flow_at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - (Date.parse(m.last_banner_flow_at) || 0) < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function bannerFromTranscript(payload) {
  const p = payload.transcript_path;
  if (typeof p !== "string" || !p)
    return null;
  try {
    if (!existsSync4(p))
      return null;
    return extractBannerFlow(readFileSync3(p, "utf8"));
  } catch {
    return null;
  }
}
function bannerThisSession() {
  const markerFile = join4(cwd, ".mugiwara", ".engaged");
  if (!existsSync4(markerFile))
    return true;
  const sessionStart = sessionStartFrom(markerFile);
  if (!sessionStart)
    return true;
  const re = /^## .*Flow (\d+)\s*\u2014/m;
  try {
    const missionsDir = join4(cwd, ".mugiwara", "missions");
    for (const e of readdirSync2(missionsDir, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      const files = [`${join4(missionsDir, e.name)}/decisions.md`];
      const flowsDir = join4(missionsDir, e.name, "flows");
      if (existsSync4(flowsDir)) {
        for (const f of readdirSync2(flowsDir)) {
          if (f.endsWith(".md"))
            files.push(join4(flowsDir, f));
        }
      }
      for (const f of files) {
        try {
          if (!existsSync4(f))
            continue;
          if (statSync2(f).mtimeMs + 1000 < sessionStart)
            continue;
          if (re.test(readFileSync3(f, "utf8")))
            return true;
        } catch {}
      }
    }
  } catch {
    return true;
  }
  return false;
}
var EXPLICIT_MAX_BLOCKS = 2;
var root = join4(dirname2(fileURLToPath2(import.meta.url)), "..");
function readMarker() {
  try {
    return JSON.parse(readFileSync3(join4(cwd, ".mugiwara", ".engaged"), "utf8"));
  } catch {
    return {};
  }
}
function explicitSession(sessionId) {
  const m = readMarker();
  if (!m.explicit_crew_at)
    return false;
  if (sessionId && m.session_id)
    return m.session_id === sessionId;
  return Date.now() - (Date.parse(m.touched_at ?? "") || 0) < MARKER_TTL_MS;
}
function computedLane() {
  try {
    const bash = findBash();
    const script = join4(root, "scripts", "lane.sh");
    if (!bash || !existsSync4(script))
      return null;
    const r = spawnSync2(bash, [script, "main", "--json"], { cwd, encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
    if (r.status !== 0)
      return null;
    const j = JSON.parse(r.stdout);
    if (typeof j.lane !== "string")
      return null;
    return {
      lane: j.lane,
      sensitive: Array.isArray(j.sensitive_paths) ? j.sensitive_paths.filter((x) => typeof x === "string") : [],
      files: typeof j.files_touched === "number" ? j.files_touched : 0
    };
  } catch {
    return null;
  }
}
function closedThisSession(sessionId) {
  try {
    const base = join4(cwd, ".mugiwara", "missions");
    if (!existsSync4(base))
      return false;
    const start = sessionStartFrom(join4(cwd, ".mugiwara", ".engaged"));
    let ledger = [];
    try {
      ledger = readFileSync3(join4(cwd, ".mugiwara", "review-dispatch.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      });
    } catch {}
    for (const e of readdirSync2(base, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      const closed = ["report.md", "pr-verdict.md"].map((f) => join4(base, e.name, f)).filter((f) => existsSync4(f));
      if (!closed.length)
        continue;
      if (start && closed.some((f) => statSync2(f).mtimeMs + 1000 >= start))
        return true;
      if (ledger.some((x) => x.mission === e.name && (!sessionId || !x.session_id || x.session_id === sessionId)))
        return true;
    }
  } catch {}
  return false;
}
function explicitProblem(sessionId) {
  if (!sourceChanged(true))
    return null;
  const lane = computedLane();
  if (!lane || lane.lane === "direct")
    return null;
  const state = newestMissionState();
  if (!state) {
    if (closedThisSession(sessionId))
      return null;
    if (!(lane.lane === "full" || lane.sensitive.length))
      return null;
    const what = lane.sensitive.length ? `a risky area (${lane.sensitive.slice(0, 3).join(", ")}${lane.sensitive.length > 3 ? `, and ${lane.sensitive.length - 3} more` : ""})` : `${lane.files} files`;
    return `Mugiwara: this change touches ${what}, and the crew's process was requested with /mugiwara but has not run. ` + "Size and record the work, then plan, build, review and check security before finishing; if the crew was not wanted, tell the user that instead of continuing.";
  }
  if (!(lane.lane === "full" || state.sensitive || lane.sensitive.length))
    return null;
  const dir = join4(cwd, ".mugiwara", "missions", state.dir);
  const missing = [];
  if (!existsSync4(join4(dir, "review.md")))
    missing.push("review");
  if (!existsSync4(join4(dir, "security.md")))
    missing.push("security check");
  if (missing.length) {
    return `Mugiwara: this change has no ${missing.join(" and no ")}, and the crew's process was requested with /mugiwara. ` + `Run the ${missing.join(" and the ")} now and write the result into the mission folder before finishing.`;
  }
  if (readConfig(cwd).independent_review !== "off" && dispatchedAgents(cwd, state.mission).size === 0) {
    return "Mugiwara: the review of this change ran in the same conversation that wrote it, and the crew's process was requested with /mugiwara. " + "Ask the crew to run the independent review (Robin and Jinbe as separate agents) before finishing, or tell the user you are skipping it. " + reviewNextStep(state.mission);
  }
  return null;
}
function explicitCheck(sessionId) {
  const reason = explicitProblem(sessionId);
  if (!reason)
    return false;
  const marker = readMarker();
  const blocks = typeof marker.explicit_blocks === "number" ? marker.explicit_blocks : 0;
  if (blocks >= EXPLICIT_MAX_BLOCKS) {
    process.stderr.write(`\u26A0 ${reason}
`);
    return false;
  }
  try {
    writeFileSync2(join4(cwd, ".mugiwara", ".engaged"), JSON.stringify({ ...marker, explicit_blocks: blocks + 1 }, null, 2) + `
`);
  } catch {}
  countForcedContinuation();
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  return true;
}
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {}
  const sid0 = typeof payload.session_id === "string" ? payload.session_id : "";
  if (payload.hook_event_name !== "SubagentStop" && explicitSession(sid0) && readEnforce() !== "off" && explicitCheck(sid0))
    return;
  if (payload.stop_hook_active === true)
    return;
  const enforce = readEnforce();
  if (enforce === "off")
    return;
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  if (!engaged(sessionId))
    return;
  const state = newestMissionState();
  const sourceChangedNow = sourceChanged();
  const pending = closingPending(cwd);
  if (pending)
    process.stderr.write(`Mugiwara: mission "${pending}" has its closing files but no report.md. Run \`mugiwara archive ${pending}\` to write it.
`);
  if (state) {
    const rank = LANE_RANK[state.lane] ?? -1;
    if (rank >= 1 && sourceChangedNow && !executorDispatched(sessionId)) {
      process.stderr.write(`\u26A0 Mugiwara: source files changed in mission "${state.mission}" but no builder agent (zoro-execution or brook-healing) was started this session. ` + `Start one, or set enforce=off in .mugiwara/config to stop these warnings.
`);
    }
    if (planTouched() && !plannerDispatched(sessionId)) {
      process.stderr.write("\u26A0 Mugiwara: a plan was written this session but the planner (nami-planner) was not started. " + `Start nami-planner to write it, or set enforce=off in .mugiwara/config to stop these warnings.
`);
    }
    try {
      const risky = state.lane === "full" || state.sensitive;
      const reviewed = ["review.md", "security.md"].some((f) => existsSync4(join4(cwd, ".mugiwara", "missions", state.dir, f)));
      if (risky && reviewed && readConfig(cwd).independent_review !== "off" && dispatchedAgents(cwd, state.mission).size === 0) {
        process.stderr.write("Mugiwara: the review of this change ran in the same conversation that wrote it. " + "Ask the crew to run the independent review (Robin and Jinbe as separate agents), or set independent_review=off if you accept an inline review. " + reviewNextStep(state.mission, dispatchedAgents(cwd, state.mission)) + `
`);
      }
    } catch {}
    const transcriptFlow = bannerFromTranscript(payload);
    if (transcriptFlow !== null && transcriptFlow > 0)
      recordBannerFlow(transcriptFlow, sessionId);
    const bannerShown = transcriptFlow !== null ? transcriptFlow > 0 : bannerRecorded(sessionId) || bannerThisSession();
    if ((sourceChangedNow || planTouched()) && !bannerShown) {
      process.stderr.write("\u26A0 Mugiwara: work was recorded but no crew banner was shown this session. " + `Open each stage with its crew banner (see references/flow-banners.md) so the user can see the crew ran.
`);
    }
    return;
  }
  if (!state) {
    if (!sourceChangedNow && !artifactWorkNow())
      return;
    const reason = "Mugiwara: this session changed source or mission artifacts but no mission was started to size the work. " + "Start the mugiwara workflow first (it also records trivial work), or set enforce=off in .mugiwara/config to stop this check.";
    if (enforce === "warn") {
      process.stderr.write(`\u26A0 ${reason}
`);
      return;
    }
    countForcedContinuation();
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
  }
}
main().catch(() => {});
