import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/lib/actions/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-2">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
          Eklio
        </Link>
        <h1 className="font-display text-3xl">Sign in</h1>
      </div>

      <AuthForm action={signIn} submitLabel="Sign in" />

      <p className="font-mono text-sm text-gris-fonce">
        New here?{" "}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
