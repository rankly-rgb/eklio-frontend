import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function CheckYourEmailPage() {
  return (
    <AuthShell title="Check your email">
      <p className="text-helper leading-prose text-ink-2">
        We just sent you a confirmation link. Click it to activate your account.
      </p>
      <Link href="/login" className="text-ui text-ink-2 hover:text-ink">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
