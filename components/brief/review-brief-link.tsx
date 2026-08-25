import Link from "next/link";

/*
 * Lien vers le récapitulatif du brief.
 *
 * Extrait du rail d'étapes parce que le rail est masqué sous 1024px
 * (`hidden lg:block`) : le lien n'existait donc pas du tout sur écran étroit,
 * et le récapitulatif — seul écran qui dit ce qu'il reste à remplir et qui
 * porte le bouton de génération — n'était atteignable que par le bouton de
 * l'étape 7, lui-même conditionné à une validation réussie. Sur mobile, le
 * praticien bloqué n'avait aucune sortie.
 */
export function ReviewBriefLink({
  projectId,
  className = "",
}: {
  projectId: string;
  className?: string;
}) {
  return (
    <Link
      href={`/app/projets/${projectId}/brief/recapitulatif`}
      className={`font-mono text-sm underline hover:opacity-60 ${className}`}
    >
      Review your brief
    </Link>
  );
}
