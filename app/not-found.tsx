import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-24">
      <p className="font-mono text-xs tracking-[0.08em] text-ink-muted">404</p>
      <h1 className="font-display text-[40px] leading-tight">
        Cette page n&rsquo;existe pas.
      </h1>
      <p className="text-base text-ink-soft">
        Le lien est peut-être erroné, ou ce contenu ne vous appartient pas.
      </p>
      <Link
        href="/app"
        className="mt-2 self-start rounded bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-colors hover:bg-ink-soft"
      >
        Retour à vos projets
      </Link>
    </div>
  );
}
