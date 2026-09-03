import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { previewOrgInvite } from "@/lib/tenancy/rpc";
import { AcceptInviteButton } from "@/components/practice/accept-invite-button";

/*
 * Lot D4 — the public invite landing page. NOT flag-gated on read: a
 * clinician following a link she was sent should never see a 404 for a
 * flag she has no way to know about. Unauthenticated, no app chrome.
 *
 * An unknown, expired, or already-used token reads the exact same way
 * (preview_org_invite returns zero rows for all three, by design — see
 * lib/tenancy/rpc.ts) — a neutral "not valid" message, never a hint about
 * which of the three it was.
 */
export default async function InviteLandingPage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const supabase = await createClient();

  const preview = await previewOrgInvite(supabase, { token });
  const invite = preview.ok ? preview.data : null;

  if (!invite) {
    return (
      <main className="route-enter mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-4 px-[var(--gutter-sm)] py-24">
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          This invite link isn't valid
        </h1>
        <p className="text-body text-ink-2">
          It may have expired, already been used, or been typed incorrectly.
          Ask whoever invited you for a new link.
        </p>
        <Link
          href="/"
          className="text-ui text-ink underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]"
        >
          Go to Eklio
        </Link>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="route-enter mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 px-[var(--gutter-sm)] py-24">
      <div className="flex flex-col gap-4">
        <Link href="/" className="font-display text-wordmark font-semibold tracking-wordmark text-ink">
          Eklio
        </Link>
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          Join {invite.organizationName}
        </h1>
        <p className="text-body text-ink-2">
          You've been invited to {invite.organizationName} as{" "}
          {invite.invitedEmail}.
        </p>
      </div>

      {user ? (
        <AcceptInviteButton token={token} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-ui text-ink-2">Sign in with {invite.invitedEmail} to accept.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="inline-flex h-10 w-fit items-center justify-center rounded-pill bg-ink px-[30px] text-ui font-semibold text-bg hover:bg-ink-2"
          >
            Sign in
          </Link>
          <p className="text-helper leading-prose text-ink-2">
            No account yet?{" "}
            <Link
              href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="text-ink underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]"
            >
              Create one
            </Link>
            , confirm your email, and you'll land back here automatically.
          </p>
        </div>
      )}
    </main>
  );
}
