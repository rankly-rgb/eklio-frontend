import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/lib/actions/auth";

export default function SignupPage() {
  return (
    <AuthShell title="Create your account">
      <AuthForm
        action={signUp}
        submitLabel="Create account"
        passwordAutoComplete="new-password"
      />
      <p className="text-helper text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
