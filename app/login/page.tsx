import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/lib/actions/auth";
import { safeNextPath } from "@/lib/auth/next-url";
import { reachableWithoutAccount } from "@/lib/supabase/middleware";

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

  /*
   * ── ⚠ ELLE ARRIVE D'UN BRIEF QU'ELLE N'A PAS COMMENCÉ ICI ─────────────
   *
   * Une visiteuse anonyme qui ouvre sa révélation sur un SECOND appareil
   * atterrit ici : le jeton est un cookie, il est resté sur le premier. Sans
   * cette phrase elle lit « Sign in » pour un travail fait vingt minutes plus
   * tôt sur une machine où elle n'a pas de compte, et rien n'explique rien.
   *
   * Elle a une sortie, et c'est pour ça que la phrase vaut la peine : l'offre
   * « email me a link » lui a été faite deux fois, à la fin du brief et sur la
   * révélation. Si elle l'a prise, le lien est dans sa boîte et pose le cookie
   * sur l'appareil qui l'ouvre. La phrase ne fait donc pas que nommer
   * l'impasse — elle ouvre la porte pour celles qui ont pris l'offre.
   *
   * Seulement quand `next` désigne une surface anonyme : sur `/app/checkout`
   * ou `/app/settings`, il n'y a pas de brief sans compte à retrouver, et la
   * phrase serait du bruit.
   */
  const fromAnonymousSurface = next ? reachableWithoutAccount(next) : false;

  return (
    <AuthShell title="Sign in">
      {fromAnonymousSurface ? (
        <p className="border-l border-accent pl-3 text-helper leading-prose text-ink-2">
          Started a brief without an account? It lives on the device you
          started it on. If you asked us to email you a link to come back to
          it, open that link on this device and it&rsquo;ll be here.
        </p>
      ) : null}
      <AuthForm action={signIn} submitLabel="Sign in" next={next} />
      <p className="text-helper text-ink-2">
        No account yet?{" "}
        <Link href="/signup" className="text-ink underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
