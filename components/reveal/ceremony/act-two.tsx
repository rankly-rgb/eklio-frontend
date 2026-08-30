import { BrandPreview } from "@/components/preview/brand-preview";
import { ProofLayer } from "@/components/reveal/ceremony/proof-layer";
import { DecisionZone } from "@/components/reveal/ceremony/decision-zone";
import {
  previewModelFromDirection,
  type RevealPayloadDirection,
  type SocialTemplates,
  type VoiceGuide,
} from "@/lib/brand/shapes";

/*
 * Acte 2 — la scène d'UNE direction : lueur d'ambiance, typographie fantôme,
 * la maquette-vedette dans son chrome de navigateur, la cascade au premier
 * plan (téléphone, tuiles sociales, carte de visite, papier à en-tête), la
 * couche de preuve, la zone de décision.
 *
 * ⚠ POSITIONNEMENT NON VÉRIFIÉ CONTRE `reveal-ref-1-ceremony.png` — le
 * fichier n'a pas atteint cette session (texte reçu, pas d'image). La
 * cascade ci-dessous est un arrangement raisonnable, pas un calque du
 * fichier de référence. À corriger dès que le PNG est réellement disponible
 * — ne pas prendre cette disposition pour la cible.
 *
 * `RevealCeremony` (fichier voisin) possède l'index courant, le clavier, le
 * swipe et la retinte de la lueur ; ce composant ne fait que dessiner UNE
 * direction donnée.
 */
export function ActTwoScene({
  brandKitId,
  projectId,
  direction,
  practiceName,
  specialties,
  practitionerLine,
  socialTemplates,
  voiceGuide,
  paid,
  index,
  total,
}: {
  brandKitId: string;
  projectId: string;
  direction: RevealPayloadDirection;
  practiceName: string | null;
  specialties: string[];
  practitionerLine: string | null;
  socialTemplates: SocialTemplates | null;
  voiceGuide: VoiceGuide | null;
  paid: boolean;
  index: number;
  total: number;
}) {
  const model = previewModelFromDirection(direction, practiceName, specialties);
  const glow = direction.palette.primary;
  const posts = (socialTemplates ?? []).filter((template) => template.type === "post");

  return (
    <>
      {/*
        La lueur et la typographie fantôme retintent en 400ms (§4) — géré par
        `transition` CSS pure sur la couleur, donc couvert par la garde
        globale `prefers-reduced-motion` (`app/globals.css`) sans code
        supplémentaire : elle neutralise `transition-duration` en `!important`
        sur tout le sous-arbre, y compris les valeurs posées en style inline.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-[background] duration-[400ms] ease-in-out"
        style={{
          background: `radial-gradient(ellipse 1100px 700px at 24% 18%, ${glow}26, transparent 70%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden transition-colors duration-[400ms] ease-in-out"
      >
        <span
          className="font-display font-medium leading-none whitespace-nowrap select-none"
          style={{ fontSize: "clamp(120px, 20vw, 420px)", color: glow, opacity: 0.06 }}
        >
          {direction.name}
        </span>
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed right-10 bottom-0 select-none font-display font-medium leading-none transition-colors duration-[400ms] ease-in-out"
        style={{ fontSize: "34vh", color: glow, opacity: 0.05 }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="relative z-10 flex min-h-full flex-col items-center px-8 py-16 max-md:px-4">
        {/* Chrome du haut : compteur, nom de la direction. « Compare all
            three » redevient un lien à l'étape 6 (Acte 3). */}
        <div className="flex w-full max-w-[1100px] items-center justify-between font-mono text-mono-sm uppercase tracking-mono-16 text-ink-2">
          <span>
            {index + 1} of {total}
          </span>
          <span className="text-ink-3">Compare all three</span>
        </div>

        <div className="mt-8 w-full max-w-[900px]" style={{ "--stagger-index": 0 } as React.CSSProperties}>
          <div className="reveal-rise">
            <BrandPreview model={model} size="hero" />
          </div>
        </div>

        {/* Cascade au premier plan — téléphone, trois posts sociaux, carte de
            visite, papier à en-tête. Recouvrement volontaire, ombres mutuelles
            via `shadow-preview`. */}
        <div className="relative mt-10 flex w-full max-w-[900px] flex-wrap items-end justify-center gap-6">
          <div
            className="reveal-rise"
            style={{ "--stagger-index": 1 } as React.CSSProperties}
          >
            <BrandPreview model={model} size="phone" />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {posts.map((template, postIndex) => (
              <div
                key={template.id}
                className="reveal-rise"
                style={{ "--stagger-index": postIndex + 2 } as React.CSSProperties}
              >
                <BrandPreview model={model} variant="social" template={template} />
              </div>
            ))}
          </div>

          <div
            className="reveal-rise flex flex-col gap-4"
            style={{ "--stagger-index": posts.length + 2 } as React.CSSProperties}
          >
            <BrandPreview
              model={model}
              variant="business-card"
              practitionerLine={practitionerLine}
            />
            <BrandPreview model={model} variant="letterhead" />
          </div>
        </div>

        <div className="mt-10 w-full max-w-[900px]">
          <ProofLayer direction={direction} voiceGuide={voiceGuide} />
        </div>

        <div className="mt-8 mb-4 w-full max-w-[900px]">
          <DecisionZone
            brandKitId={brandKitId}
            projectId={projectId}
            directionId={direction.id}
            paid={paid}
          />
        </div>
      </div>
    </>
  );
}
