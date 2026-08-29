"use client";

import { RailSection } from "@/components/site/rail-section";
import { LimitedField } from "@/components/site/limited-field";
import { ClampNote } from "@/components/site/clamp-note";
import { clampNoteFor } from "@/lib/site/seed-clamped";
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
 */

const DETAIL_FIELDS: Array<{ key: keyof PracticeDetails; label: string }> = [
  { key: "practice_name", label: "Practice name" },
  { key: "license_label", label: "License" },
  { key: "license_number", label: "License number" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

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

  function detail(key: keyof PracticeDetails, value: string) {
    editor.edit({ practice_details: { ...spec.practice_details, [key]: value } });
  }

  return (
    <RailSection id="site-details" title="Your details">
      <div className="flex flex-col gap-4">
        {DETAIL_FIELDS.map(({ key, label }) => (
          <LimitedField
            key={key}
            label={label}
            value={spec.practice_details[key] ?? ""}
            limit={limits.section_text}
            error={
              editor.error?.field === `practice_details.${key}`
                ? editor.error.message
                : null
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
