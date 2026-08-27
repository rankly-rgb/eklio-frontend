import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Coquille des pages de compte — connexion, inscription, confirmation.
 * Wordmark, titre de page, contenu. Mêmes tokens que l'espace connecté.
 */
export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="route-enter mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-8 px-[var(--gutter-sm)] py-24">
      <div className="flex flex-col gap-4">
        <Link
          href="/"
          className="font-display text-wordmark font-semibold tracking-wordmark text-ink"
        >
          Eklio
        </Link>
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1">
          {title}
        </h1>
      </div>
      {children}
    </main>
  );
}
