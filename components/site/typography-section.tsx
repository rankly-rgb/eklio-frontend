"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { RailSection } from "@/components/site/rail-section";
import { useBrandFont } from "@/components/preview/use-brand-font";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { TypePairing } from "@/lib/catalog/types";

/*
 * La typographie — les paires du catalogue, chacune rendue POUR DE VRAI.
 *
 * Une paire typographique ne se choisit pas sur son nom : « Fraunces / Nunito
 * Sans » ne dit rien tant qu'on ne l'a pas vue porter son propre nom de
 * practice. Chaque carte rend donc le nom de la practice dans la police de
 * titre, au-dessus d'une phrase dans la police de corps.
 *
 * Les quatre champs partent ENSEMBLE. `type_pairing_id` seul laisserait
 * `heading_font`, `body_font` et `google_fonts_url` sur la paire précédente si
 * la base ne les dérive pas — et la maquette chargerait une feuille qui ne
 * correspond plus.
 */
export function TypographySection({
  editor,
  pairings,
}: {
  editor: SiteEditorState;
  pairings: TypePairing[];
}) {
  const { spec, preview } = editor.envelope;
  const practice = preview.practice_name ?? "Your practice";

  return (
    <RailSection
      id="site-typography"
      title="Typography"
      hint="Two faces, everywhere on your site."
    >
      <div className="flex flex-col gap-2.5">
        {pairings.map((pairing) => (
          <PairingCard
            key={pairing.id}
            pairing={pairing}
            practice={practice}
            selected={pairing.id === spec.type_pairing_id}
            onSelect={() =>
              editor.commit({
                type_pairing_id: pairing.id,
                heading_font: pairing.heading_font,
                body_font: pairing.body_font,
                google_fonts_url: pairing.google_fonts_url,
              })
            }
          />
        ))}
      </div>
    </RailSection>
  );
}

function PairingCard({
  pairing,
  practice,
  selected,
  onSelect,
}: {
  pairing: TypePairing;
  practice: string;
  selected: boolean;
  onSelect: () => void;
}) {
  /*
   * La feuille de chaque paire est chargée à l'affichage de la carte, pas au
   * moment du choix : c'est ce qui permet de COMPARER. `useBrandFont`
   * déduplique par href et ne retire jamais un <link>, donc les six paires
   * coûtent six requêtes une fois pour toutes.
   */
  const ready = useBrandFont(pairing.google_fonts_url);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-card border p-[14px_16px] text-left transition-colors duration-[var(--dur-select)] ${
        selected ? "border-accent bg-card" : "border-line hover:bg-card"
      }`}
    >
      <div
        className="transition-opacity duration-[var(--dur-font)]"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <div
          className="truncate"
          style={{
            fontFamily: `"${pairing.heading_font}", Georgia, serif`,
            fontWeight: 600,
            fontSize: 22,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          {practice}
        </div>
        <div
          className="mt-1.5"
          style={{
            fontFamily: `"${pairing.body_font}", system-ui, sans-serif`,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink-2)",
          }}
        >
          A consult is fifteen minutes on the phone, at no charge.
        </div>
      </div>

      <MonoLabel tracking="14" tone="ink-3" className="mt-2.5 block">
        {`${pairing.heading_font} · ${pairing.body_font}`}
      </MonoLabel>
    </button>
  );
}
