import { StartBriefButton } from "@/components/brief/start-brief-button";

/*
 * Accueil de rétention (Écran 7). Cette version ne porte que la coquille : la
 * salutation et le point d'entrée du brief. La carte de marque, la checklist
 * de lancement et la grille de contenu du mois arrivent au lot 8, avec leurs
 * lectures agrégées.
 */
export default function AppHomePage() {
  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pt-8 max-md:px-[var(--gutter-sm)]">
      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1">
        Your brand
      </h1>
      <p className="mt-4 max-w-[520px] text-helper leading-prose text-ink-2">
        Your first brand takes about 7 minutes. Here&rsquo;s what you&rsquo;ll
        get.
      </p>
      <div className="mt-6">
        <StartBriefButton />
      </div>
    </main>
  );
}
