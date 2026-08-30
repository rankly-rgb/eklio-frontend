import { BrandPreview } from "@/components/preview/brand-preview";
import { previewModelFromDirection, type RevealPayloadDirection } from "@/lib/brand/shapes";

/*
 * Acte 2 de la révélation — UNE direction, plein écran.
 *
 * ÉTAPE 3 DU PLAN DE LIVRAISON : la coquille et la maquette de scène
 * seulement. Pas de cascade (téléphone, tuiles sociales, carte de visite,
 * coin de papier à en-tête), pas de couche de preuve (police/contraste/
 * mots-clés/tampon déontologique), pas de zone de décision (CTA), pas de
 * navigation entre les trois directions, pas de transition de teinte — tout
 * cela est l'étape 4. Cette version est délibérément plus nue que les
 * références PNG ; voir le message qui accompagne la capture d'écran pour la
 * liste des écarts.
 *
 * PAS D'ANIMATION ICI, DONC PAS DE GARDE `prefers-reduced-motion` À POSER : la
 * règle du produit est qu'une garde arrive dans le MÊME commit que le
 * mouvement qu'elle contient, pas qu'une garde existe par anticipation d'un
 * mouvement qui n'existe pas encore.
 *
 * PAS D'EN-TÊTE, PAS DE NAVIGATION — même technique que l'écran de génération
 * (`components/reveal/generation-screen.tsx`) : un recouvrement
 * `fixed inset-0` par-dessus la coquille de `/app`, sans en modifier le
 * routage ni sa garde de session.
 */
export function ActTwoStatic({
  direction,
  practiceName,
  specialties,
  index,
  total,
}: {
  direction: RevealPayloadDirection;
  practiceName: string | null;
  specialties: string[];
  index: number;
  total: number;
}) {
  const model = previewModelFromDirection(direction, practiceName, specialties);
  const glow = direction.palette.primary;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      {/*
        La lueur d'ambiance — teintée du primaire de CETTE direction. Statique
        pour l'instant : la retinte à 400ms au changement de direction (§4) et
        le grain de film (§1) sont posés avec la navigation, à l'étape 4/5.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(ellipse 1100px 700px at 24% 18%, ${glow}26, transparent 70%)`,
        }}
      />

      {/* Typographie fantôme — le nom de la direction, énorme, à ~6% d'opacité. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden"
      >
        <span
          className="font-display font-medium leading-none whitespace-nowrap select-none"
          style={{
            fontSize: "clamp(120px, 20vw, 420px)",
            color: glow,
            opacity: 0.06,
          }}
        >
          {direction.name}
        </span>
      </div>
      {/* Numéral fantôme de l'index — coin bas-droit, encore plus discret. */}
      <div
        aria-hidden
        className="pointer-events-none fixed right-10 bottom-0 select-none font-display font-medium leading-none"
        style={{ fontSize: "34vh", color: glow, opacity: 0.05 }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-8 py-24 max-md:px-4">
        <div className="w-full max-w-[900px]">
          <BrandPreview model={model} size="hero" />
        </div>

        <div className="mt-8 font-mono text-mono-sm tracking-mono-16 text-ink-2 uppercase">
          {index + 1} of {total} — {direction.name}
        </div>
      </div>
    </div>
  );
}
