"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { TextAreaField } from "@/components/ui/text-field";
import { CopyButton } from "@/components/site/copy-chip";
import { CHECK_MAX_CHARS, CHECK_MIN_CHARS, type CheckFinding } from "@/lib/check/review";

/*
 * ── CHECK, THE SCREEN ───────────────────────────────────────────────────
 *
 * ⚠ NO SCORE, NO PERCENTAGE, NO PASS BADGE. What comes back is a list of
 * findings or an empty list, and the empty case says what it actually means:
 * these six patterns did not fire. It never says "compliant" — that is a
 * legal conclusion, and this is six regular expressions.
 *
 * ⚠ HER TEXT NEVER LEAVES THIS PAGE except to be scanned. It is not saved, not
 * drafted, not restored on reload, and there is deliberately no autosave here:
 * the one surface in the product where forgetting is the feature.
 *
 * The rewrite is always shown WITH its own re-scan. When the model's rewrite
 * still trips a rule, that is displayed rather than hidden — a rewrite she
 * trusts because Eklio handed it to her is exactly the one that must not be
 * quietly wrong.
 */

type ScanState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "scanned"; findings: CheckFinding[]; clear: boolean }
  | { kind: "error"; message: string };

type RewriteState =
  | { kind: "idle" }
  | { kind: "working" }
  | {
      kind: "done";
      text: string;
      after: CheckFinding[];
      resolved: boolean;
      unchanged: boolean;
    }
  | { kind: "error"; message: string };

export function CheckView({ brandKitId }: { brandKitId: string }) {
  const [text, setText] = useState("");
  const [scan, setScan] = useState<ScanState>({ kind: "idle" });
  const [rewrite, setRewrite] = useState<RewriteState>({ kind: "idle" });

  const tooShort = text.trim().length < CHECK_MIN_CHARS;

  async function check() {
    setScan({ kind: "working" });
    setRewrite({ kind: "idle" });
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandKitId, text }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setScan({ kind: "error", message: body?.error ?? "That could not be checked." });
        return;
      }
      setScan({ kind: "scanned", findings: body.findings, clear: body.clear });
    } catch {
      setScan({ kind: "error", message: "That could not be checked. Check your connection." });
    }
  }

  async function askRewrite() {
    setRewrite({ kind: "working" });
    try {
      const response = await fetch("/api/check/rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandKitId, text }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setRewrite({ kind: "error", message: body?.error ?? "That could not be rewritten." });
        return;
      }
      setRewrite({
        kind: "done",
        text: body.text,
        after: body.after,
        resolved: body.resolved,
        unchanged: body.unchanged,
      });
    } catch {
      setRewrite({ kind: "error", message: "That could not be rewritten. Try again." });
    }
  }

  const blocking =
    scan.kind === "scanned" ? scan.findings.filter((finding) => finding.severity === "block") : [];

  return (
    <div className="mt-8 flex max-w-[760px] flex-col gap-6">
      <TextAreaField
        id="check-text"
        label="Your words"
        hint="A directory profile, a post, an email, a page. Paste it and see what it trips."
        rows={12}
        maxLength={CHECK_MAX_CHARS}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setScan({ kind: "idle" });
          setRewrite({ kind: "idle" });
        }}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => void check()} disabled={tooShort || scan.kind === "working"}>
          {scan.kind === "working" ? "Checking…" : "Check it"}
        </Button>
        <p className="text-helper text-ink-3">
          {`${text.trim().length} characters. Nothing you paste here is saved.`}
        </p>
      </div>

      {scan.kind === "error" ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          {scan.message}
        </p>
      ) : null}

      {scan.kind === "scanned" ? (
        <section aria-live="polite" className="flex flex-col gap-4">
          {scan.findings.length === 0 ? (
            /*
             * The honest empty state. NOT "compliant", NOT a checkmark, NOT a
             * score: the only claim Eklio can support is that these six
             * patterns did not fire on this text.
             */
            <p className="text-body leading-prose text-ink">
              Nothing in this text trips the six rules. That is what this check can tell you — it
              reads for those six patterns, not for everything a board might care about.
            </p>
          ) : (
            <>
              <MonoLabel tracking="16" as="h2">
                {scan.findings.length === 1 ? "One thing to look at" : `${scan.findings.length} things to look at`}
              </MonoLabel>
              <ul className="flex flex-col gap-4">
                {scan.findings.map((finding, index) => (
                  <FindingRow key={`${finding.ruleId}-${index}`} finding={finding} />
                ))}
              </ul>
            </>
          )}

          {blocking.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
              <Button
                variant="secondary"
                onClick={() => void askRewrite()}
                disabled={rewrite.kind === "working"}
              >
                {rewrite.kind === "working" ? "Rewriting…" : "Rewrite it for me"}
              </Button>
              <p className="text-helper leading-prose text-ink-2">
                This uses one of your rewrites, and only if it works.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {rewrite.kind === "error" ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          {rewrite.message}
        </p>
      ) : null}

      {rewrite.kind === "done" ? <RewriteResult rewrite={rewrite} /> : null}
    </div>
  );
}

function FindingRow({ finding }: { finding: CheckFinding }) {
  return (
    <li className="flex flex-col gap-2 border-l border-accent pl-4">
      <p className="text-ui font-medium text-ink">{finding.label}</p>
      <p className="text-helper leading-prose text-ink-2">{finding.description}</p>
      <p className="text-helper leading-prose text-ink">
        Your words: <span className="font-mono text-mono">{finding.excerpt}</span>
      </p>
      {finding.severity === "warn" ? (
        <MonoLabel tracking="14" tone="ink-3">
          Worth a look, not a blocker
        </MonoLabel>
      ) : null}
    </li>
  );
}

function RewriteResult({
  rewrite,
}: {
  rewrite: { text: string; after: CheckFinding[]; resolved: boolean; unchanged: boolean };
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <MonoLabel tracking="16" as="h2">
        The rewrite
      </MonoLabel>

      {rewrite.unchanged ? (
        <p className="text-helper leading-prose text-ink-2">
          Nothing came back. Your own words are untouched, and no rewrite was used.
        </p>
      ) : (
        <>
          {/*
           * The re-scan, stated before the text rather than after it. She
           * should know what she is reading before she reads it.
           */}
          {rewrite.resolved ? (
            <p className="text-helper leading-prose text-ink-2">
              This rewrite no longer trips the rules it was asked to fix. Read it before you use it:
              it is your voice it is standing in for.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-helper leading-prose text-ink">
                The rewrite still trips a rule. It is shown anyway, because hiding it would leave
                you with nothing to work from — but do not paste it as it stands.
              </p>
              <ul className="flex flex-col gap-4">
                {rewrite.after.map((finding, index) => (
                  <FindingRow key={`${finding.ruleId}-${index}`} finding={finding} />
                ))}
              </ul>
            </div>
          )}

          <pre className="overflow-x-auto whitespace-pre-wrap rounded-card border border-line bg-paper-2 p-5 text-body leading-prose text-ink">
            {rewrite.text}
          </pre>

          <CopyButton text={rewrite.text} variant="secondary">
            Copy the rewrite
          </CopyButton>
        </>
      )}
    </section>
  );
}
