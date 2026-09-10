"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/text-field";
import { TextField } from "@/components/ui/text-field";

/*
 * ── "EMAIL ME A LINK TO COME BACK TO THIS" ──────────────────────────────
 *
 * The only place the anonymous path asks for an email address.
 *
 * ⚠ IT IS AN OFFER, NOT A GATE. Nothing behind it is withheld: she can finish
 * the brief, see her three directions and buy without ever typing anything
 * here. The wall this product used to have demanded the same address before
 * giving her anything; this asks for it at the moment it is worth giving,
 * which is when she is looking at something she wants to keep.
 *
 * ⚠ AND THE REASON IS THE TRUE ONE. Not "create an account", not "save your
 * progress" — the brief is already saved. What she risks is the cookie: a
 * different phone, a cleared browser, a private tab, and it is unreachable
 * forever. That is what this prevents, and saying so plainly is what makes it
 * an ask she has a reason to accept.
 */
export function EmailMeALink({
  projectId,
  where,
}: {
  projectId: string;
  /** Which surface is asking — the wording differs, the promise does not. */
  where: "review" | "reveal";
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/briefs/${projectId}/email-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as
        | { sent?: boolean; error?: string }
        | null;

      if (!response.ok || !body?.sent) {
        setError(body?.error ?? "We couldn't send that. Try again in a moment.");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded-card border border-line bg-card p-5"
      >
        <p className="text-ui text-ink">Sent. Check your inbox.</p>
        <p className="text-helper leading-prose text-ink-2">
          The link works for 30 days, on any device. If it isn&rsquo;t there in
          a minute, look in spam — it comes from Eklio.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line p-5">
      <p className="text-ui text-ink">
        {where === "reveal"
          ? "Want to come back to these?"
          : "Want to come back to this later?"}
      </p>
      <p className="text-helper leading-prose text-ink-2">
        {/*
          The honest reason, said in her terms. "You will lose it" is the
          actual risk, and it is the whole argument for typing an address.
        */}
        We&rsquo;ll email you one link. No account, no list — it just means a
        new phone or a cleared browser doesn&rsquo;t lose your work.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <TextField
            id={`email-link-${where}`}
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@yourpractice.com"
          />
        </div>
        <Button
          variant="secondary"
          onClick={send}
          disabled={isPending || email.trim() === ""}
        >
          {isPending ? "Sending…" : "Email me the link"}
        </Button>
      </div>

      {error ? <InlineError>{error}</InlineError> : null}
    </section>
  );
}
