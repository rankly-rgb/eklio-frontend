"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/invite/[token]/actions";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/text-field";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite({ token });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.push("/app/profile");
    });
  }

  if (done) {
    return <p className="text-ui text-ink-2">You're in — taking you to your profile…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={handleAccept} disabled={isPending}>
        {isPending ? "Joining…" : "Accept invite"}
      </Button>
      {error ? <InlineError>{error}</InlineError> : null}
    </div>
  );
}
