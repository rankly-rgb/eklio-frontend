import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./shared";

/*
 * ── THE PREFLIGHT ───────────────────────────────────────────────────────
 *
 * ⚠ WHY THIS EXISTS, AND IT IS NOT HYPOTHETICAL. Four separate rounds of the
 * one real generation this product needs a human for failed, every time for
 * the same reason and never with a message that said so: the checkout was
 * behind `origin/main`, or on another branch, with uncommitted files under
 * `lib/images/` silently blocking every `git pull`. The run then generated
 * against an OLD `IMAGE_PROMPT_VERSION`, whose fingerprint already had seven
 * images in storage, and the pipeline answered `REFUSED already_ready` —
 * which is correct, and which reads like a bug.
 *
 * The fingerprint is the whole of it. `IMAGE_PROMPT_VERSION` is hashed into
 * it (`lib/images/fingerprint.ts`), so a checkout one version behind is
 * asking for a photograph that already exists rather than the one that is
 * missing. Nothing downstream can tell those two apart.
 *
 * So: three checks, and each refusal names the command that fixes it.
 *
 * ⚠ IT NEVER DISCARDS ANYTHING. Every instruction is `git stash push`, never
 * `checkout --` and never `reset --hard`. Local edits are worth keeping, and
 * `.env.local` is untracked so a stash does not move the tokens the run needs.
 *
 * It is read-only against git except for one `git fetch`, which changes no
 * working file: comparing against `origin/main` is meaningless if the remote
 * ref is itself stale, and a stale ref is exactly the state that caused this.
 */

/** Runs git and returns trimmed stdout, or null when the command fails. */
function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** `IMAGE_PROMPT_VERSION` as written in a given copy of `lib/images/config.ts`. */
export function parsePromptVersion(source: string): number | null {
  const match = source.match(/export const IMAGE_PROMPT_VERSION\s*=\s*(\d+)\s*;/);
  return match ? Number(match[1]) : null;
}

/** The paths whose uncommitted state can change what a run generates. */
export const WATCHED_PATHS = ["lib/images/", "scripts/brand-image/"];

/** Which watched paths have uncommitted changes, from `git status --porcelain`. */
export function dirtyWatchedPaths(porcelain: string): string[] {
  const changed = porcelain
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // `XY path` and `XY old -> new`; the destination is what matters.
    .map((line) => {
      const withoutStatus = line.replace(/^\S+\s+/, "");
      const arrow = withoutStatus.indexOf(" -> ");
      return arrow === -1 ? withoutStatus : withoutStatus.slice(arrow + 4);
    });

  return WATCHED_PATHS.filter((watched) =>
    changed.some((file) => file.startsWith(watched))
  );
}

export type PreflightProblem = { title: string; detail: string; fix: string[] };

/**
 * Everything wrong with this checkout, in the order it has to be fixed.
 *
 * Pure enough to reason about: it takes the four facts and returns problems.
 * `runPreflight` below is what actually asks git for them.
 */
export function preflightProblems(facts: {
  localVersion: number | null;
  remoteVersion: number | null;
  behindBy: number | null;
  dirty: string[];
}): PreflightProblem[] {
  const problems: PreflightProblem[] = [];

  /*
   * The dirty check comes FIRST in the output even though it is the least
   * severe, because it is what blocks the fix for the other two. Telling
   * someone to pull without telling them why the pull will fail is how four
   * rounds of this went.
   */
  if (facts.dirty.length > 0) {
    problems.push({
      title: `Uncommitted changes under ${facts.dirty.join(" and ")}`,
      detail:
        "These change what this script generates, and they will block the pull below.",
      fix: [
        "git stash push -m 'before image run' -- " + facts.dirty.join(" "),
        "# your edits are kept; `git stash pop` brings them back afterwards.",
        "# .env.local is untracked, so your tokens do not move.",
      ],
    });
  }

  if (facts.behindBy !== null && facts.behindBy > 0) {
    problems.push({
      title: `This checkout is ${facts.behindBy} commit${facts.behindBy === 1 ? "" : "s"} behind origin/main`,
      detail: "The deployed prompt is on main. Generating from behind it makes a photograph nobody will see.",
      fix: ["git checkout main", "git pull --ff-only origin main"],
    });
  }

  if (
    facts.localVersion !== null &&
    facts.remoteVersion !== null &&
    facts.localVersion !== facts.remoteVersion
  ) {
    problems.push({
      title: `IMAGE_PROMPT_VERSION is ${facts.localVersion} here and ${facts.remoteVersion} on origin/main`,
      detail:
        "The version is hashed into the image fingerprint. At the wrong one, this run asks for a " +
        "photograph that already exists and the pipeline answers `already_ready` — correctly, and " +
        "unhelpfully.",
      fix: ["git checkout main", "git pull --ff-only origin main"],
    });
  }

  if (facts.localVersion === null) {
    problems.push({
      title: "IMAGE_PROMPT_VERSION could not be read from lib/images/config.ts",
      detail: "Without it there is no way to tell whether this run would be a no-op.",
      fix: ["# check that lib/images/config.ts still exports IMAGE_PROMPT_VERSION"],
    });
  }

  return problems;
}

/**
 * Refuses the run, loudly and with instructions, when this checkout would
 * generate against the wrong prompt.
 *
 * `die` is passed in rather than imported so the caller decides how a refusal
 * exits — and so this is testable without killing the test process.
 */
export function runPreflight(die: (message: string) => never): void {
  // Read-only, and the only network call: a comparison against a stale
  // `origin/main` is the exact failure this file exists to prevent.
  git(["fetch", "--quiet", "origin", "main"]);

  const localVersion = parsePromptVersion(
    readFileSync(path.join(REPO_ROOT, "lib/images/config.ts"), "utf8")
  );
  const remoteSource = git(["show", "origin/main:lib/images/config.ts"]);
  const remoteVersion = remoteSource === null ? null : parsePromptVersion(remoteSource);

  const counts = git(["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
  const behindBy = counts === null ? null : Number(counts.split(/\s+/)[0]);

  const dirty = dirtyWatchedPaths(git(["status", "--porcelain"]) ?? "");

  const problems = preflightProblems({ localVersion, remoteVersion, behindBy, dirty });
  if (problems.length === 0) return;

  const lines = [
    "PREFLIGHT REFUSED — this checkout would generate against the wrong prompt.",
    "",
  ];
  for (const [index, problem] of problems.entries()) {
    lines.push(`${index + 1}. ${problem.title}`);
    lines.push(`   ${problem.detail}`);
    lines.push("");
    for (const line of problem.fix) lines.push(`     ${line}`);
    lines.push("");
  }
  lines.push("Then run this command again. Nothing has been generated and nothing has been spent.");

  die(lines.join("\n"));
}
