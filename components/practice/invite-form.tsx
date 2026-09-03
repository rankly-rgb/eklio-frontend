"use client";

import { useState, useTransition } from "react";
import { sendInvite } from "@/app/app/practice/invite/actions";
import { Button } from "@/components/ui/button";
import { TextField, InlineError } from "@/components/ui/text-field";
import { CopyButton } from "@/components/site/copy-chip";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Same "use client" + useTransition() shape as
 * components/billing/checkout-form.tsx — no <form>, the server action is a
 * plain async function called from a click handler.
 *
 * The token is shown exactly ONCE, right here, right after creation —
 * create_org_invite never returns it again (only its sha256 is stored). A
 * clinician who loses this link needs a new invite, not a lookup.
 */
export function InviteForm() {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await sendInvite({ email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setLink(`${origin}/invite/${result.token}`);
    });
  }

  if (link) {
    return (
      <div className="flex flex-col gap-4 rounded-card border border-line p-6">
        <MonoLabel tracking="16">Invite link</MonoLabel>
        <p className="break-all font-mono text-mono-sm tracking-mono-url text-ink">{link}</p>
        <CopyButton text={link} className="self-start">
          Copy link
        </CopyButton>
        <p className="text-helper leading-prose text-ink-2">
          This link won't be shown again. Copy it now and send it to{" "}
          {email || "the clinician"} yourself — we don't email it for you.
        </p>
        <Button
          variant="tertiary"
          className="self-start"
          onClick={() => {
            setLink(null);
            setEmail("");
          }}
        >
          Invite someone else
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TextField
        id="invite-email"
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button onClick={handleSubmit} disabled={isPending || !email}>
        {isPending ? "Creating invite…" : "Create invite link"}
      </Button>
      {error ? <InlineError>{error}</InlineError> : null}
    </div>
  );
}
