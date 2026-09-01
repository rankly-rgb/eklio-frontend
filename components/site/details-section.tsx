"use client";

import { RailSection } from "@/components/site/rail-section";
import { LimitedField } from "@/components/site/limited-field";
import { ClampNote } from "@/components/site/clamp-note";
import { clampNoteFor } from "@/lib/site/seed-clamped";
import {
  PRACTITIONER_NAME_KEY,
  detailFields,
  practitionerNameMissing,
} from "@/lib/site/details";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { Direction } from "@/lib/brand/shapes";
import type { PracticeDetails, SiteCatalog } from "@/lib/site/types";

/*
 * Vos coordonnées.
 *
 * Ce bloc ne se voit pas dans la maquette : il alimente le pied de page, les
 * mentions de licence et la ligne du bouton dans les instructions. Il est donc
 * dans le rail, et nulle part ailleurs.
 *
 * ⚠ LE LIEN DE RÉSERVATION EST LE SIEN. Eklio ne prend pas de rendez-vous, ne
 * reçoit rien, ne stocke rien : on IMPRIME ce lien dans ses instructions, et
 * c'est tout. Le dire sous le champ n'est pas une précaution juridique, c'est
 * ce qui l'empêche d'attendre de nous quelque chose que nous ne faisons pas.
 *
 * ⚠ SON NOM VIENT EN PREMIER, et c'est le seul champ qu'on RÉCLAME quand il
 * est vide (cf. `lib/site/details.ts`). Un site qui ne nomme pas la
 * praticienne annonce une pratique sous licence sans nommer la licenciée.
 */

export function DetailsSection({
  editor,
  catalog,
  direction,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
  direction: Direction;
}) {
  const { spec } = editor.envelope;
  const limits = catalog.site_spec_limits;
  const ctaClamp = clampNoteFor(spec.seed_clamped, direction, "hero.cta_label");
  const missingName = practitionerNameMissing(spec.practice_details);

  function detail(key: keyof PracticeDetails, value: string) {
    editor.edit({ practice_details: { ...spec.practice_details, [key]: value } });
  }

  return (
    <RailSection id="site-details" title="Your details">
      <div className="flex flex-col gap-4">
        {detailFields(spec.practice_details).map(({ key, label }) => (
          <LimitedField
            key={key}
            label={label}
            hint={
              key === PRACTITIONER_NAME_KEY
                ? "The name that appears on your site, as it reads on your license."
                : undefined
            }
            value={spec.practice_details[key] ?? ""}
            limit={limits.section_text}
            error={
              editor.error?.field === `practice_details.${key}`
                ? editor.error.message
                : null
            }
            note={
              key === PRACTITIONER_NAME_KEY && missingName ? <MissingName /> : null
            }
            onChange={(next) => detail(key, next)}
          />
        ))}

        <LimitedField
          label="Button label"
          value={spec.hero.cta_label}
          limit={limits.hero_cta_label}
          error={editor.error?.field === "hero.cta_label" ? editor.error.message : null}
          note={ctaClamp ? <ClampNote field={ctaClamp} /> : null}
          onChange={(next) =>
            editor.edit({ hero: { ...spec.hero, cta_label: next } })
          }
        />

        <LimitedField
          label="Where should the button send people?"
          hint="We print this in your instructions. Eklio never handles your bookings."
          value={spec.hero.cta_target_url}
          limit={limits.section_text}
          error={
            editor.error?.field === "hero.cta_target_url" ? editor.error.message : null
          }
          onChange={(next) =>
            editor.edit({ hero: { ...spec.hero, cta_target_url: next } })
          }
        />
      </div>
    </RailSection>
  );
}

/**
 * Le rappel, quand le nom est vide.
 *
 * Il DIT ce qui manque et pourquoi, sans affirmer une règle d'un board qu'on
 * ne connaît pas : la formulation reste factuelle (« votre site ne vous nomme
 * pas encore »), et le socle déontologique complet vit sur le kit.
 */
function MissingName() {
  return (
    <p className="border-l-2 border-[var(--warning)] pl-3 text-meta leading-body text-ink">
      Your site doesn&rsquo;t name you yet. Everything else here describes the
      practice &mdash; this is the line that says who the visitor would be
      seeing.
    </p>
  );
}
