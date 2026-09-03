import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/lib/actions/auth";
import { safeNextPath } from "@/lib/auth/next-url";

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;

  // Same filtering as /login (lib/auth/next-url.ts) — this control is
  // hygiene (avoids writing a doubtful destination into the page's HTML),
  // the one inside signUp itself is the actual guard.
  const next = safeNextPath(raw) ?? undefined;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <AuthShell title="Create your account">
      <AuthForm
        action={signUp}
        submitLabel="Create account"
        passwordAutoComplete="new-password"
        next={next}
      />
      <p className="text-helper text-ink-2">
        Already have an account?{" "}
        <Link href={loginHref} className="text-ink underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
