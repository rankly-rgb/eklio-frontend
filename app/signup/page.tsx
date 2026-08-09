import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/lib/actions/auth";

export default function SignupPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-2">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
          Eklio
        </Link>
        <h1 className="font-display text-3xl">Créer un compte</h1>
      </div>

      <AuthForm action={signUp} submitLabel="Créer mon compte" />

      <p className="font-mono text-sm text-ink-muted">
        Déjà un compte ?{" "}
        <Link href="/login" className="underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
