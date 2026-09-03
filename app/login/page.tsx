import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
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
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <AuthShell title="Sign in">
      <AuthForm action={signIn} submitLabel="Sign in" next={next} />
      <p className="text-helper text-ink-2">
        No account yet?{" "}
        <Link href={signupHref} className="text-ink underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
