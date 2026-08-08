import Link from "next/link";

const STEPS = [
  "Brief",
  "Positionnement",
  "Audience",
  "Ton",
  "Palette",
  "Typographies",
  "Site",
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-noir/10 px-6 py-5 md:px-12">
        <span className="font-mono text-sm tracking-[0.2em] uppercase">
          Eklio
        </span>
        <nav className="flex items-center gap-6 font-mono text-sm">
          <Link href="/login" className="hover:opacity-60">
            Connexion
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-noir px-4 py-2 hover:bg-noir hover:text-cream-light transition-colors"
          >
            Générer ma marque
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-24 md:px-12 md:py-36">
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-gris-fonce">
            Identité de marque — solopreneurs &amp; prestataires
          </p>
          <h1 className="font-display text-4xl leading-[1.1] md:text-6xl">
            L&rsquo;identité de marque qui vous ressemble, et qui vous
            propulse.
          </h1>
          <p className="max-w-xl text-lg text-gris-fonce">
            Répondez à un brief guidé de 5 à 7 minutes. Recevez trois
            directions créatives contrastées, un kit de marque complet, et un
            prompt prêt à coller dans Lovable, Framer ou Webflow.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light hover:bg-gris-fonce transition-colors"
            >
              Générer ma marque
            </Link>
            <span className="font-mono text-sm text-gris-fonce">
              29 € — sans engagement
            </span>
          </div>
        </section>

        <section className="border-t border-noir/10 bg-cream-light px-6 py-16 md:px-12">
          <div className="mx-auto max-w-4xl">
            <p className="mb-8 font-mono text-sm uppercase tracking-[0.2em] text-gris-fonce">
              Le parcours
            </p>
            <ol className="grid grid-cols-2 gap-x-6 gap-y-4 font-mono text-sm sm:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-baseline gap-2">
                  <span className="text-gris-fonce/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-noir/10 px-6 py-8 font-mono text-xs text-gris-fonce md:px-12">
        © {new Date().getFullYear()} Eklio
      </footer>
    </div>
  );
}
