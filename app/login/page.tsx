import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/lib/actions/auth";
import { safeNextPath } from "@/lib/auth/next-url";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;

  /*
   * La destination demandée avant la connexion, posée par le proxy
   * (`/login?next=/app/checkout`). Elle est filtrée DEUX FOIS, ici et à la
   * soumission : ce contrôle-ci évite d'écrire une destination douteuse dans le
   * HTML de la page, celui de `signIn` est celui qui protège réellement la
   * redirection. Le premier est de l'hygiène, le second est la garde.
   */
  const next = safeNextPath(raw) ?? undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-2">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
          Eklio
        </Link>
        <h1 className="font-display text-3xl">Connexion</h1>
      </div>

      <AuthForm action={signIn} submitLabel="Se connecter" next={next} />

      <p className="font-mono text-sm text-ink-muted">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
