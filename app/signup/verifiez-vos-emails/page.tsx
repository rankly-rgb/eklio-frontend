import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-3xl">Vérifiez vos emails</h1>
      <p className="font-mono text-sm text-ink-muted">
        Un lien de confirmation vient de vous être envoyé. Cliquez dessus pour
        activer votre compte.
      </p>
      <Link href="/login" className="mt-4 font-mono text-sm underline">
        Retour à la connexion
      </Link>
    </div>
  );
}
